import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Trust proxy for Cloud Run reverse proxy
app.set('trust proxy', 1);

// Security: Disable X-Powered-By header to avoid technology fingerprinting
app.disable('x-powered-by');

// Security: Set non-blocking security headers (allowing preview iframe embedding)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Security: Limit JSON body size to prevent memory exhaustion / DoS
app.use(express.json({ limit: '500kb' }));

// Security: Bounded in-memory rate limiter with LRU eviction to prevent heap exhaustion
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const MAX_RATE_LIMIT_ENTRIES = 5000;
const rateLimitMap = new Map<string, RateLimitRecord>();

// Periodically clean up expired rate-limit records every 3 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (record.resetTime < now) {
      rateLimitMap.delete(key);
    }
  }
}, 3 * 60 * 1000);
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

function rateLimiter(windowMs: number, maxRequests: number, prefix: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Use validated req.ip from Express trust proxy, preventing client header forgery
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const key = `${prefix}:${clientIp}`;
    const now = Date.now();
    const record = rateLimitMap.get(key);

    if (!record || record.resetTime < now) {
      // Prevent unbounded memory growth by evicting oldest entry if map reaches max capacity
      if (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
        const firstKey = rateLimitMap.keys().next().value;
        if (firstKey) {
          rateLimitMap.delete(firstKey);
        }
      }
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      res.setHeader('Retry-After', retryAfter);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      return res.status(429).json({
        error: 'Muitas requisições. Por favor, aguarde alguns instantes antes de tentar novamente.',
        retryAfter,
      });
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - record.count);
    next();
  };
}

// CSRF / Origin validation middleware for state-changing or quota-consuming POST APIs
function validateOrigin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const origin = req.headers.origin;
  const secFetchSite = req.headers['sec-fetch-site'];

  // If Sec-Fetch-Site is cross-site, reject request
  if (secFetchSite === 'cross-site') {
    return res.status(403).json({ error: 'Acesso cruzado de origem não autorizada.' });
  }

  // If origin header is present, ensure it matches current host or allowed development origins
  if (origin && typeof origin === 'string') {
    const host = req.headers.host;
    try {
      const originUrl = new URL(origin);
      const isSameHost = host && (originUrl.host === host || host.startsWith(originUrl.host));
      const isAllowedCloudRun = originUrl.hostname.endsWith('.run.app') || originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1';
      if (!isSameHost && !isAllowedCloudRun) {
        return res.status(403).json({ error: 'Origem de requisição não autorizada.' });
      }
    } catch {
      return res.status(403).json({ error: 'Cabeçalho de origem inválido.' });
    }
  }

  next();
}

// Sanitization helpers
function sanitizeText(value: unknown, maxLength = 200): string {
  if (typeof value !== 'string') return '';
  // Strip null bytes and non-printable control characters
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maxLength);
}

function sanitizeId(value: unknown, maxLength = 64): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength).replace(/[^a-zA-Z0-9_-]/g, '');
}

// Output sanitizer for AI responses to protect against Indirect Prompt Injection
function sanitizeAIOutput(data: any): any {
  if (!data || typeof data !== 'object') {
    return { detectedCompanyId: '', orders: [], allItems: [], summaryText: '' };
  }

  const detectedCompanyId = sanitizeId(data.detectedCompanyId);
  const summaryText = sanitizeText(data.summaryText, 500);

  const sanitizeItem = (it: any) => ({
    collaboratorName: sanitizeText(it?.collaboratorName, 100),
    foodQty: typeof it?.foodQty === 'number' ? Math.max(0, Math.min(999, Math.floor(it.foodQty))) : sanitizeText(it?.foodQty, 10),
    foodItem: sanitizeText(it?.foodItem, 150),
    fruits: sanitizeText(it?.fruits, 100),
    drinks: sanitizeText(it?.drinks, 150),
    marmitaType: sanitizeText(it?.marmitaType, 20) || 'Nº 9',
    marmitaQty: typeof it?.marmitaQty === 'number' ? Math.max(0, Math.min(999, Math.floor(it.marmitaQty))) : sanitizeText(it?.marmitaQty, 10),
    pickupTime: sanitizeText(it?.pickupTime, 10),
    notes: sanitizeText(it?.notes, 300),
  });

  const orders = Array.isArray(data.orders)
    ? data.orders.slice(0, 50).map((ord: any) => ({
        solicitante: sanitizeText(ord?.solicitante, 100),
        cafeQty: typeof ord?.cafeQty === 'number' ? Math.max(0, Math.min(999, Math.floor(ord.cafeQty))) : 0,
        almocoQty: typeof ord?.almocoQty === 'number' ? Math.max(0, Math.min(999, Math.floor(ord.almocoQty))) : 0,
        horario: sanitizeText(ord?.horario, 10),
        observacoes: sanitizeText(ord?.observacoes, 300),
        items: Array.isArray(ord?.items) ? ord.items.slice(0, 50).map(sanitizeItem) : [],
      }))
    : [];

  const allItems = Array.isArray(data.allItems)
    ? data.allItems.slice(0, 100).map(sanitizeItem)
    : [];

  return {
    detectedCompanyId,
    orders,
    allItems,
    summaryText,
  };
}

// Lazy Google GenAI Client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint (60 requests per minute)
app.get('/api/health', rateLimiter(60 * 1000, 60, 'health'), (_req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Endpoint to parse WhatsApp messages using Gemini 3.7 Flash (max 20 requests per minute to prevent AI quota exhaustion)
app.post('/api/parse-whatsapp', validateOrigin, rateLimiter(60 * 1000, 20, 'parse_whatsapp'), async (req, res) => {
  const rawText = req.body?.text;
  const rawSelectedCompanyId = req.body?.selectedCompanyId;
  const rawCompanies = req.body?.companies;
  const splitIndividualRows = Boolean(req.body?.splitIndividualRows);

  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return res.status(400).json({ error: 'Texto da mensagem do WhatsApp não fornecido.' });
  }

  if (rawText.length > 25000) {
    return res.status(400).json({ error: 'Texto muito extenso. Limite de 25.000 caracteres por envio.' });
  }

  const text = rawText.trim();
  const selectedCompanyId = sanitizeId(rawSelectedCompanyId);

  // Sanitize companies input array and prevent prototype pollution
  const sanitizedCompanies: Array<{
    id: string;
    name: string;
    defaultFood: string;
    defaultDrinks: string;
    defaultFruits: string;
  }> = Array.isArray(rawCompanies)
    ? rawCompanies.slice(0, 50).map((c: any) => ({
        id: sanitizeId(c?.id),
        name: sanitizeText(c?.name, 100),
        defaultFood: sanitizeText(c?.defaultFood, 150),
        defaultDrinks: sanitizeText(c?.defaultDrinks, 150),
        defaultFruits: sanitizeText(c?.defaultFruits, 100),
      }))
    : [];

  try {
    const ai = getAIClient();

    // Fallback parser if Gemini API is not configured
    if (!ai) {
      console.warn('GEMINI_API_KEY not configured, using smart regex fallback parser');
      const fallbackResult = parseWhatsAppWithRegex(text, selectedCompanyId, sanitizedCompanies, splitIndividualRows);
      return res.json({
        success: true,
        source: 'regex_fallback',
        parsedData: fallbackResult,
      });
    }

    const prompt = `Você é um assistente especialista de cozinha industrial e restaurante (Gauchão Restaurante).
Sua tarefa é ler mensagens reais de WhatsApp enviadas pelos clientes/empresas solicitando kits de lanches/café da manhã e marmitas de almoço.

Texto recebido do WhatsApp:
"""
${text}
"""

Empresas cadastradas no sistema:
${JSON.stringify(
  sanitizedCompanies.map((c) => ({
    id: c.id,
    name: c.name,
    defaultFood: c.defaultFood,
    defaultDrinks: c.defaultDrinks,
    defaultFruits: c.defaultFruits,
  })),
  null,
  2
)}

Empresa selecionada atualmente: "${selectedCompanyId || 'auto'}"
Opção de desmembrar em linhas individuais: ${splitIndividualRows ? 'TRUE (Gere 1 linha individual para cada unidade de kit, por exemplo: se Denis Silva pediu 5 cafés e 5 almoços, gere 5 linhas distintas numeradas)' : 'FALSE (Mantenha 1 linha por solicitante com a quantidade total acumulada, ex: Denis Silva com Qtd Café = 5, Qtd Almoço = 5)'}

Regras de Extração e Negócio:
1. Ignore metadados irrelevantes como "[18:36, 28/08/2026] +55...", saudações "Boa noite", "Bom dia", "PROJETO : Matao" (nomes de projetos não importam para a cozinha).
2. Identifique o SOLICITANTE / Responsável (ex: "Denis Silva", "Rafael Roldão").
3. Identifique a quantidade de CAFÉ (lanches/kits de café da manhã) - ex: "CAFÉ: 05 ☕", "05", "5".
4. Identifique a quantidade de ALMOÇO (marmitex) - ex: "ALMOÇO: 05 🍝", "05", "5".
5. Extraia com precisão as OBSERVAÇÕES da cozinha (ex: "Uma sem feijão por gentileza!!", "sem cebola", "trocar suco").
6. Se a mensagem indicar uma empresa específica (ex: "Agronova", "Suzano", "Agro Solution"), associe ao "companyId" correspondente. Caso contrário, utilize o "selectedCompanyId".
7. Se splitIndividualRows for TRUE e o pedido for de 5 cafés e 5 almoços com observação "Uma sem feijão":
   - Linha 1: collaboratorName: "Denis Silva (1/5)", foodQty: 1, marmitaQty: 1, notes: "1 sem feijão"
   - Linhas 2 a 5: collaboratorName: "Denis Silva (2/5)...", foodQty: 1, marmitaQty: 1, notes: ""
8. Se splitIndividualRows for FALSE:
   - Linha 1: collaboratorName: "Denis Silva", foodQty: 5, marmitaQty: 5, notes: "Uma sem feijão por gentileza!!"

Retorne um JSON estrito no seguinte formato:
{
  "detectedCompanyId": "string (id da empresa identificada ou da selecionada)",
  "orders": [
    {
      "solicitante": "string",
      "cafeQty": number,
      "almocoQty": number,
      "horario": "string (ex: 06:30)",
      "observacoes": "string",
      "items": [
        {
          "collaboratorName": "string",
          "foodQty": number | string,
          "foodItem": "string",
          "fruits": "string",
          "drinks": "string",
          "marmitaType": "string (ex: M)",
          "marmitaQty": number | string,
          "pickupTime": "string",
          "notes": "string"
        }
      ]
    }
  ],
  "allItems": [
    {
      "collaboratorName": "string",
      "foodQty": number | string,
      "foodItem": "string",
      "fruits": "string",
      "drinks": "string",
      "marmitaType": "string",
      "marmitaQty": number | string,
      "pickupTime": "string",
      "notes": "string"
    }
  ],
  "summaryText": "string (resumo amigável em português do que foi identificado)"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const rawResponse = response.text || '{}';
    let parsedJson: any;

    try {
      parsedJson = sanitizeAIOutput(JSON.parse(rawResponse));
    } catch (parseErr) {
      console.error('Failed to parse Gemini response as JSON');
      const fallbackResult = parseWhatsAppWithRegex(text, selectedCompanyId, sanitizedCompanies, splitIndividualRows);
      return res.json({
        success: true,
        source: 'regex_fallback_after_gemini_error',
        parsedData: fallbackResult,
      });
    }

    return res.json({
      success: true,
      source: 'gemini-3.7-flash',
      parsedData: parsedJson,
    });
  } catch (error: any) {
    // Log safe error summary server-side without leaking raw user data
    console.error('Error in /api/parse-whatsapp:', error?.message || 'Gemini invocation failed');
    // Provide graceful regex fallback without exposing internal stack or API key details to the client
    const fallbackResult = parseWhatsAppWithRegex(text, selectedCompanyId, sanitizedCompanies, splitIndividualRows);
    return res.json({
      success: true,
      source: 'regex_fallback_error_recovery',
      parsedData: fallbackResult,
    });
  }
});

// Robust Regex fallback parser (ReDoS-safe)
function parseWhatsAppWithRegex(
  rawText: string,
  selectedCompanyId: string,
  companies: any[],
  splitIndividualRows: boolean
) {
  const targetCompany = companies.find((c) => c.id === selectedCompanyId) || companies[0];
  const defaultDrinks = targetCompany?.defaultDrinks || '100ML Leite / 150ML Café';
  const defaultFruits = targetCompany?.defaultFruits || '2 ou Bolo';
  const defaultFood = targetCompany?.defaultFood || '1 Pão c/ Manteiga';

  // Split by WhatsApp message headers or blocks safely without unbounded lookahead
  // E.g., [18:36, 28/08/2026] or SOLICITANTE
  const blocks = rawText.split(/(?=\[\d{1,2}:\d{2}[^\]\r\n]*\]|\bSOLICITANTE\b)/i).filter((b) => b.trim());

  const orders: any[] = [];
  const allItems: any[] = [];

  for (const block of blocks) {
    if (!block.trim()) continue;

    // Extract Solicitante
    const solicitanteMatch = block.match(/SOLICITANTE\s*:\s*[/]?\s*([^\n\r]+)/i);
    let solicitante = solicitanteMatch ? solicitanteMatch[1].trim() : '';

    // If not found with SOLICITANTE, check for "Nome:" or first line
    if (!solicitante) {
      const nameMatch = block.match(/(?:NOME|COLABORADOR|MOTORISTA)\s*:\s*([^\n\r]+)/i);
      if (nameMatch) {
        solicitante = nameMatch[1].trim();
      } else {
        const firstLine = block.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('[') && !l.startsWith('+') && !/^(bom dia|boa noite|ola)/i.test(l));
        if (firstLine && firstLine.length < 40) {
          solicitante = firstLine.replace(/^[0-9]+[\.\-\)]\s*/, '').trim();
        }
      }
    }

    if (!solicitante) {
      solicitante = 'Solicitante';
    }

    // Extract Café / Lanche qty
    let cafeQty = 0;
    const cafeMatch = block.match(/CAF[EÉ]\s*:\s*(\d+)/i);
    if (cafeMatch) {
      cafeQty = parseInt(cafeMatch[1], 10);
    } else {
      const lancheMatch = block.match(/(?:LANCHES?|KITS?|P[AÃ]ES?)\s*:\s*(\d+)/i);
      if (lancheMatch) cafeQty = parseInt(lancheMatch[1], 10);
      else if (/caf[eé]/i.test(block)) cafeQty = 1;
    }

    // Extract Almoço / Marmita qty
    let almocoQty = 0;
    const almocoMatch = block.match(/(?:ALMO[CÇ]O|MARMITAS?|REFEI[CÇ][AÃ]O)\s*:\s*(\d+)/i);
    if (almocoMatch) {
      almocoQty = parseInt(almocoMatch[1], 10);
    } else if (/almo[cç]o/i.test(block)) {
      almocoQty = 1;
    }

    // Extract Observações
    let obs = '';
    const obsMatch = block.match(/(?:OBS|OBSERVA[CÇ][AÃ]O|OBSERVA[CÇ][OÕ]ES)\s*:\s*([^\n\r\[]+)/i);
    if (obsMatch) {
      obs = obsMatch[1].trim();
      if (obs.toLowerCase() === 'v' || obs.toLowerCase() === 'sem obs' || obs.toLowerCase() === 'nenhuma') {
        obs = '';
      }
    }

    // Extract Time if any
    let time = '06:30';
    const timeMatch = block.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)?\b/i);
    if (timeMatch && !block.includes(`[${timeMatch[0]}`)) {
      time = timeMatch[0].replace('h', ':');
      if (!time.includes(':')) time = `${time}:00`;
    }

    const orderItems: any[] = [];
    const count = Math.max(cafeQty, almocoQty, 1);

    if (splitIndividualRows && count > 1) {
      for (let i = 1; i <= count; i++) {
        const itemNote = i === 1 && obs ? obs : '';
        const item = {
          collaboratorName: `${solicitante} (${i}/${count})`,
          foodQty: cafeQty >= i ? 1 : 0,
          foodItem: defaultFood,
          fruits: defaultFruits,
          drinks: defaultDrinks,
          marmitaType: 'M',
          marmitaQty: almocoQty >= i ? 1 : 0,
          pickupTime: time,
          notes: itemNote,
        };
        orderItems.push(item);
        allItems.push(item);
      }
    } else {
      const item = {
        collaboratorName: solicitante + (count > 1 ? ` (Equipe ${count}x)` : ''),
        foodQty: cafeQty || 1,
        foodItem: defaultFood,
        fruits: defaultFruits,
        drinks: defaultDrinks,
        marmitaType: 'M',
        marmitaQty: almocoQty || '',
        pickupTime: time,
        notes: obs,
      };
      orderItems.push(item);
      allItems.push(item);
    }

    orders.push({
      solicitante,
      cafeQty,
      almocoQty,
      horario: time,
      observacoes: obs,
      items: orderItems,
    });
  }

  return {
    detectedCompanyId: selectedCompanyId || targetCompany?.id || 'agronova',
    orders,
    allItems,
    summaryText: `Identificados ${orders.length} pedidos (${allItems.length} itens formatados para a planilha).`,
  };
}

// 404 handler for undefined API routes (prevent falling through to SPA HTML)
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint da API não encontrado.' });
});

// Global error handling middleware for uncaught Express errors
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload muito grande. Limite máximo de 500KB.' });
  }
  res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
});

// Start Server and Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
