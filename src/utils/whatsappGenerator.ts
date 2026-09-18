import { CompanyContract, DailyOrderSheet } from '../types';

export const generateCompanyWhatsAppText = (company: CompanyContract, date: string, mealTitle: string): string => {
  if (!company || !Array.isArray(company.items)) {
    return 'Nenhum dado encontrado.';
  }

  const filledItems = company.items.filter(
    (it) =>
      (it.collaboratorName && it.collaboratorName.trim().length > 0) ||
      (it.notes && it.notes.trim().length > 0) ||
      (it.cafeQty !== '' && it.cafeQty !== undefined && it.cafeQty !== null) ||
      (it.marmitaQty !== '' && it.marmitaQty !== undefined && it.marmitaQty !== null) ||
      (it.pickupTime && it.pickupTime.trim().length > 0)
  );
  
  if (filledItems.length === 0) {
    return `📋 *${company.name}* - Sem pedidos preenchidos para ${date}.`;
  }

  const lines: string[] = [
    `🍽️ *GAUCHÃO RESTAURANTE & COZINHA INDUSTRIAL*`,
    `📌 *Controle de Pedidos - ${company.name.toUpperCase()}*`,
    `📅 Data: ${date} | ${mealTitle}`,
    `📦 *Kit Contratado:* ${company.kitDescription || 'Padrão da Empresa'}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ];

  let totalCafes = 0;
  let totalMarmitas = 0;

  filledItems.forEach((item, index) => {
    const name = (item.collaboratorName || '').trim() || `Colaborador ${index + 1}`;
    lines.push(`👤 *${index + 1}. ${name}*`);
    
    if (item.cafeQty !== '' && item.cafeQty !== undefined && item.cafeQty !== null) {
      const cQty = Number(item.cafeQty) || 0;
      totalCafes += cQty;
      lines.push(`   ☕ *Cafés (Kits):* ${item.cafeQty}`);
    }
    
    if (item.marmitaQty !== '' && item.marmitaQty !== undefined && item.marmitaQty !== null) {
      const mQty = Number(item.marmitaQty) || 0;
      totalMarmitas += mQty;
      lines.push(`   🍱 *Marmitas:* ${item.marmitaQty}x (${item.marmitaType || 'Nº 9'})`);
    }
    
    if (item.pickupTime && item.pickupTime.trim()) {
      lines.push(`   ⏰ *Horário Retirada:* ${item.pickupTime.trim()}`);
    }
    
    if (item.notes && item.notes.trim()) {
      lines.push(`   💬 *Obs:* ${item.notes.trim()}`);
    }
    lines.push(``);
  });

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📊 *Total de Cafés (Kits):* ${totalCafes}`);
  if (totalMarmitas > 0) {
    lines.push(`🍱 *Total de Marmitas:* ${totalMarmitas}`);
  }
  lines.push(`Agradecemos a preferência!`);

  return lines.join('\n');
};

export const generateFullSheetWhatsAppText = (sheet: DailyOrderSheet): string => {
  if (!sheet || !Array.isArray(sheet.companies) || sheet.companies.length === 0) {
    return 'Nenhuma empresa cadastrada na planilha.';
  }

  const sections = sheet.companies.map((comp) =>
    generateCompanyWhatsAppText(comp, sheet.date, sheet.title)
  );

  return sections.join('\n\n==========================\n\n');
};

