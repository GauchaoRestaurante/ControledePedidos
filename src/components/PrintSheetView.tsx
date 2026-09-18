import React from 'react';
import { DailyOrderSheet } from '../types';
import gauchaoLogo from '../assets/logo.png';

interface PrintSheetViewProps {
  sheet: DailyOrderSheet;
  printWithDate?: boolean;
}

export const PrintSheetView: React.FC<PrintSheetViewProps> = ({ 
  sheet, 
  printWithDate = false 
}) => {
  const [year, month, day] = sheet.date.split('-');
  const dateFormatted = `${day || '__'} / ${month || '__'} / ${year || '2026'}`;

  return (
    <div className="print-only print-container p-3 bg-white text-black font-sans text-xs">
      {/* Top Header Box - Clean ink-saving outline */}
      <div className="border-2 border-slate-800 mb-3 p-2.5 flex items-center justify-between bg-white rounded-sm">
        <div className="flex items-center gap-3.5">
          <img
            src={gauchaoLogo}
            alt="Gauchão Restaurante e Cozinha Industrial"
            className="h-14 w-auto object-contain shrink-0 max-w-[140px]"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="font-extrabold text-sm uppercase tracking-wider text-slate-900">
              {sheet.title}
            </h1>
            <h2 className="font-bold text-xs uppercase text-slate-700">
              {sheet.subtitle}
            </h2>
          </div>
        </div>

        {/* Date Box on Right - Designed for manual handwriting or printed date */}
        <div className="border-2 border-slate-800 rounded px-4 py-1.5 text-center bg-slate-50/80 min-w-[210px]">
          <div className="text-[9.5px] font-black uppercase tracking-wider text-slate-700 mb-0.5">
            DATA DO PEDIDO:
          </div>
          {printWithDate ? (
            <div className="text-sm font-black tracking-wider text-slate-900 font-mono">
              {dateFormatted}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 font-mono text-sm font-black text-slate-900">
              <div className="flex flex-col items-center">
                <span className="w-11 h-4 border-b-2 border-slate-800 text-center font-bold">
                  &nbsp;
                </span>
                <span className="text-[8px] font-sans font-bold text-slate-600 uppercase">Dia</span>
              </div>
              <span className="text-slate-700 font-black text-base -mt-3">/</span>
              <div className="flex flex-col items-center">
                <span className="w-11 h-4 border-b-2 border-slate-800 text-center font-bold">
                  &nbsp;
                </span>
                <span className="text-[8px] font-sans font-bold text-slate-600 uppercase">Mês</span>
              </div>
              <span className="text-slate-700 font-black text-base -mt-3">/</span>
              <div className="flex flex-col items-center">
                <span className="w-16 h-4 border-b-2 border-slate-800 text-center font-bold">
                  &nbsp;
                </span>
                <span className="text-[8px] font-sans font-bold text-slate-600 uppercase">Ano</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Company Tables - Each company has its own table with repeating thead for Excel-style multi-page repeating headers */}
      <div className="space-y-3.5">
        {sheet.companies.map((company) => {
          const isCompact = company.items.length <= 6;

          return (
            <table 
              key={company.id} 
              className={`company-table w-full border-collapse border-2 border-slate-800 text-[10px] ${
                isCompact ? 'break-inside-avoid' : ''
              }`}
            >
              {/* thead: Repeats automatically on subsequent pages if a company table spans across pages! */}
              <thead className="table-header-group">
                {/* Row 1: Company Header Banner + Big Kit Description */}
                <tr className="bg-slate-100 border-b-2 border-slate-800">
                  <th colSpan={6} className="p-2 text-left border border-slate-700 bg-slate-50/90">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      {/* Company Name */}
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-800 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-wider uppercase">
                          Empresa
                        </span>
                        <span className="print-company-title text-sm sm:text-base font-black uppercase tracking-wider text-slate-950">
                          {company.name}
                        </span>
                      </div>

                      {/* Kit Contratado - Prominently enlarged for low vision legibility */}
                      {company.kitDescription && (
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border-2 border-slate-600 shadow-2xs">
                          <span className="text-[11px] font-black uppercase text-amber-950 tracking-wide shrink-0">
                            ☕ KIT CONTRATADO:
                          </span>
                          <span className="print-kit-description text-xs sm:text-[13.5px] font-extrabold text-slate-950 tracking-tight leading-snug">
                            {company.kitDescription}
                          </span>
                        </div>
                      )}
                    </div>
                  </th>
                </tr>

                {/* Row 2: Column Headers */}
                <tr className="bg-slate-200/90 border-b-2 border-slate-800 text-center font-bold uppercase text-[9.5px]">
                  <th className="border border-slate-600 p-1.5 w-[35px] text-slate-900">#</th>
                  <th className="border border-slate-600 p-1.5 w-[240px] text-left text-slate-900">Colaborador / Solicitante</th>
                  <th className="border border-slate-600 p-1.5 w-[90px] text-slate-900 text-center">Qtd Cafés</th>
                  <th className="border border-slate-600 p-1.5 w-[110px] text-slate-900 text-center">Marmitas</th>
                  <th className="border border-slate-600 p-1.5 text-left text-slate-900">Observações</th>
                  <th className="border border-slate-600 p-1.5 w-[85px] text-slate-900 text-center">Horário</th>
                </tr>
              </thead>

              {/* tbody: Rows with individual borders for writing */}
              <tbody className="table-row-group">
                {company.items.map((item, idx) => {
                  const isLastRow = idx === company.items.length - 1;

                  return (
                    <tr 
                      key={item.id} 
                      className={`h-9.5 ${
                        isLastRow ? 'border-b-2 border-slate-800' : 'border-b border-slate-400'
                      }`}
                    >
                      {/* # */}
                      <td className="border border-slate-500 p-1.5 text-center font-mono text-slate-700 font-semibold">
                        {idx + 1}
                      </td>

                      {/* Colaborador */}
                      <td className="border border-slate-500 p-1.5 font-bold text-[11px] text-slate-950">
                        {item.collaboratorName || ''}
                      </td>

                      {/* Qtd Cafés (Kits) */}
                      <td className="border border-slate-500 p-1.5 text-center font-mono font-black text-xs text-slate-950">
                        {item.cafeQty !== '' && item.cafeQty !== undefined ? `${item.cafeQty}x` : ''}
                      </td>

                      {/* Marmitas */}
                      <td className="border border-slate-500 p-1.5 text-center font-mono font-bold text-slate-950">
                        {item.marmitaQty !== '' && item.marmitaQty !== undefined ? `${item.marmitaQty}x (${item.marmitaType || 'Nº 9'})` : ''}
                      </td>

                      {/* Observações */}
                      <td className="border border-slate-500 p-1.5 text-[10px] text-slate-800">
                        {item.notes || ''}
                      </td>

                      {/* Horario Retirada */}
                      <td className="border border-slate-500 p-1.5 text-center font-mono font-bold text-slate-950">
                        {item.pickupTime || ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })}
      </div>

      {/* Print Footer */}
      <div className="mt-2.5 flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-300 pt-1.5">
        <div>Gauchão Restaurante & Cozinha Industrial — Controle Diário de Pedidos</div>
        <div>Emissão: {new Date().toLocaleTimeString()}</div>
      </div>
    </div>
  );
};
