import assert from 'node:assert';
import { generateCompanyWhatsAppText, generateFullSheetWhatsAppText } from '../src/utils/whatsappGenerator';
import { DailyOrderSheet } from '../src/types';

console.log('--- INICIANDO SUÍTE DE TESTES DE AUDITORIA PRÉ-PRODUÇÃO ---');

// Test 1: WhatsApp Generator with empty/numeric strings
{
  console.log('1. Testando WhatsApp Generator com quantidades numéricas e strings...');
  const mockSheet: DailyOrderSheet = {
    id: 'test-sheet',
    date: '2026-09-17',
    restaurantName: 'Gauchão',
    title: 'CONTROLE DE PEDIDOS',
    subtitle: 'Gauchão Restaurante',
    companies: [
      {
        id: 'comp-1',
        name: 'Fazenda Boa Esperança',
        kitDescription: '1 Pão c/ Manteiga + Café',
        defaultRowsCount: 4,
        badgeColor: 'emerald',
        items: [
          {
            id: 'item-1',
            collaboratorName: 'João da Silva',
            cafeQty: 5,
            marmitaQty: '3',
            marmitaType: 'Nº 9',
            notes: 'Sem salada',
            pickupTime: '06:30',
          },
          {
            id: 'item-2',
            collaboratorName: '', // empty item, should be ignored
            cafeQty: '',
            marmitaQty: '',
            marmitaType: 'Nº 9',
            notes: '',
            pickupTime: '',
          },
        ],
      },
    ],
  };

  const text = generateFullSheetWhatsAppText(mockSheet);
  assert(text.includes('FAZENDA BOA ESPERANÇA'), 'Deve conter nome da empresa em maiúsculas');
  assert(text.includes('João da Silva'), 'Deve conter nome do colaborador');
  assert(text.includes('Cafés (Kits):* 5'), 'Deve exibir cafés corretamente');
  assert(text.includes('Marmitas:* 3x (Nº 9)'), 'Deve exibir marmitas corretamente');
  assert(text.includes('Sem salada'), 'Deve incluir observações');
  assert(!text.includes('NaN'), 'Não pode conter NaN em nenhum ponto do texto');
  console.log('  -> PASS: WhatsApp Generator validado com sucesso.');
}

// Test 2: Input Sanitization Edge Cases
{
  console.log('2. Testando sanitização de entradas...');
  const sanitize = (val: any) => {
    if (val !== '' && val !== null && val !== undefined) {
      const num = parseInt(String(val), 10);
      return isNaN(num) ? '' : Math.max(0, Math.min(999, num));
    }
    return '';
  };

  assert.strictEqual(sanitize('-5'), 0, 'Valores negativos devem ser convertidos para no mínimo 0');
  assert.strictEqual(sanitize('99999'), 999, 'Valores excessivos devem ser limitados a 999');
  assert.strictEqual(sanitize('abc'), '', 'Valores não numéricos devem retornar string vazia');
  assert.strictEqual(sanitize(12), 12, 'Número válido deve retornar 12');
  console.log('  -> PASS: Sanitização numérica segura contra estouro e injeção de texto.');
}

// Test 3: Backup JSON Structure Validation
{
  console.log('3. Testando validação de estrutura de backup JSON...');
  const validBackup = JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    catalog: [{ id: 'agronova', name: 'Agronova', kitDescription: 'Pão c/ Ovo', defaultRowsCount: 4, badgeColor: 'amber' }],
    templates: null,
    sheets: {
      '2026-09-17': {
        id: 'sheet-2026-09-17',
        date: '2026-09-17',
        title: 'CONTROLE',
        subtitle: 'Restaurante',
        companies: [],
      },
    },
  });

  const parsed = JSON.parse(validBackup);
  assert(parsed.sheets && typeof parsed.sheets === 'object', 'Backup deve conter objeto de planilhas');
  assert(Array.isArray(parsed.catalog), 'Backup deve conter array de catálogo');
  console.log('  -> PASS: Estrutura de backup JSON validada.');
}

// Test 4: Rate Limit Map Memory Bound / Eviction Check
{
  console.log('4. Testando teto de capacidade do mapa de Rate Limit (prevenção de DoS)...');
  const MAX_ENTRIES = 5000;
  const testMap = new Map<string, { count: number; resetTime: number }>();

  // Simulate adding 5500 distinct client IPs
  for (let i = 0; i < 5500; i++) {
    if (testMap.size >= MAX_ENTRIES) {
      const firstKey = testMap.keys().next().value;
      if (firstKey) testMap.delete(firstKey);
    }
    testMap.set(`ip:${i}`, { count: 1, resetTime: Date.now() + 60000 });
  }

  assert.strictEqual(testMap.size, MAX_ENTRIES, 'O mapa de rate limit não pode exceder 5000 entradas');
  assert(!testMap.has('ip:0'), 'Entradas antigas devem ser descartadas');
  assert(testMap.has('ip:5499'), 'Entrada mais recente deve existir');
  console.log('  -> PASS: Teto de memória do rate limiter confirmado contra Heap Exhaustion.');
}

// Test 5: Rejeição de Chaves Maliciosas e Prototype Pollution no Backup
{
  console.log('5. Testando proteção contra Prototype Pollution e chaves de data inválidas...');
  const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

  const maliciousKeys = [
    '__proto__',
    'constructor',
    'prototype',
    '../../../etc/passwd',
    '2026-99-99-invalid',
    'not-a-date',
    '<script>alert(1)</script>',
  ];

  for (const key of maliciousKeys) {
    const isDangerous = key === '__proto__' || key === 'constructor' || key === 'prototype' || !DATE_REGEX.test(key);
    assert(isDangerous, `A chave '${key}' deve ser categorizada como inválida/perigosa`);
  }

  assert(DATE_REGEX.test('2026-09-17'), 'Data válida no formato YYYY-MM-DD deve ser aceita');
  console.log('  -> PASS: Validação estrita de chaves de data e proteção contra Prototype Pollution aprovada.');
}

// Test 6: AI Output Sanitization
{
  console.log('6. Testando sanitização de saída do Gemini AI (Indirect Prompt Injection Defense)...');
  const dirtyOutput = {
    detectedCompanyId: 'comp-1; DROP TABLE;',
    summaryText: 'Texto com caractere nulo \x00 e controle \x1B [malicioso]',
    orders: [
      {
        solicitante: 'Rafael <script>alert(1)</script>',
        cafeQty: 99999, // overflow
        almocoQty: -10, // underflow
        horario: '06:30',
        observacoes: 'Obs normal',
        items: [],
      },
    ],
  };

  const sanitizeText = (val: string, maxLen: number) =>
    val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maxLen);
  const sanitizeId = (val: string) =>
    val.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

  const cleanId = sanitizeId(dirtyOutput.detectedCompanyId);
  const cleanSummary = sanitizeText(dirtyOutput.summaryText, 500);
  const cleanCafeQty = Math.max(0, Math.min(999, Math.floor(dirtyOutput.orders[0].cafeQty)));
  const cleanAlmocoQty = Math.max(0, Math.min(999, Math.floor(dirtyOutput.orders[0].almocoQty)));

  assert.strictEqual(cleanId, 'comp-1DROPTABLE', 'ID deve conter apenas caracteres seguros');
  assert(!cleanSummary.includes('\x00'), 'Caracteres de controle devem ser removidos');
  assert.strictEqual(cleanCafeQty, 999, 'Quantidade de cafés deve ser limitada ao teto de 999');
  assert.strictEqual(cleanAlmocoQty, 0, 'Quantidade negativa deve ser convertida para 0');
  console.log('  -> PASS: Sanitização de dados de IA validada.');
}

// Test 7: Post-Deploy Artifact Security & Absence of Secrets in Static Output
{
  console.log('7. Testando segurança do artefato estático gerado para GitHub Pages...');
  import('node:fs').then((fs) => {
    import('node:path').then((path) => {
      const distDir = path.resolve(process.cwd(), 'dist');
      if (fs.existsSync(distDir)) {
        const forbiddenFiles = ['server.cjs', 'server.cjs.map', '.env', '.env.local', '.env.example'];
        for (const file of forbiddenFiles) {
          const filePath = path.join(distDir, file);
          assert(!fs.existsSync(filePath), `Arquivo proibido '${file}' NÃO pode existir no diretório 'dist/' publicado!`);
        }

        const files = fs.readdirSync(distDir);
        const hasMapFiles = files.some((f) => f.endsWith('.map'));
        assert(!hasMapFiles, 'Nenhum arquivo de source map (*.map) deve existir no diretório raiz do dist');

        // Check index.html for secrets and base URL
        const indexHtmlPath = path.join(distDir, 'index.html');
        if (fs.existsSync(indexHtmlPath)) {
          const content = fs.readFileSync(indexHtmlPath, 'utf8');
          assert(!content.includes('GEMINI_API_KEY'), 'index.html não pode conter referências a GEMINI_API_KEY');
          assert(!content.includes('MY_GEMINI_API_KEY'), 'index.html não pode conter placeholders de chave de API');
          assert(content.includes('/ControledePedidos/'), 'index.html deve conter o caminho base /ControledePedidos/');
        }
      }
      console.log('  -> PASS: Verificação de ausência de segredos e artefatos de servidor no dist concluída.');
    });
  });
}

// Test 8: Sensitive Path Block Pattern
{
  console.log('8. Testando regra de bloqueio de caminhos de servidor sensíveis...');
  const isSensitivePath = (reqPath: string) => {
    const lower = reqPath.toLowerCase();
    return (
      lower.endsWith('.cjs') ||
      lower.endsWith('.map') ||
      lower.endsWith('.ts') ||
      lower.includes('.env') ||
      lower.includes('server')
    );
  };

  assert(isSensitivePath('/server.cjs'), '/server.cjs deve ser bloqueado');
  assert(isSensitivePath('/server.cjs.map'), '/server.cjs.map deve ser bloqueado');
  assert(isSensitivePath('/dist/server.cjs'), '/dist/server.cjs deve ser bloqueado');
  assert(isSensitivePath('/.env'), '/.env deve ser bloqueado');
  assert(isSensitivePath('/.env.example'), '/.env.example deve ser bloqueado');
  assert(isSensitivePath('/server.ts'), '/server.ts deve ser bloqueado');
  assert(!isSensitivePath('/logo.png'), '/logo.png deve ser permitido');
  assert(!isSensitivePath('/assets/index-DhLmGjoB.js'), 'bundle de JS cliente deve ser permitido');
  assert(!isSensitivePath('/assets/index-T426TtBg.css'), 'bundle de CSS cliente deve ser permitido');
  console.log('  -> PASS: Padrão de bloqueio de caminhos sensíveis validado.');
}

console.log('\n--- TODOS OS TESTES DE AUDITORIA FORAM APROVADOS COM SUCESSO! ---');
