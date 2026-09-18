import React from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  Building2, 
  RotateCcw
} from 'lucide-react';
import { DailyOrderSheet } from '../types';
import { getTodayDateString } from '../data/defaultData';
import gauchaoLogo from '../assets/logo.png';

interface HeaderProps {
  sheet: DailyOrderSheet;
  onDateChange: (date: string) => void;
  onOpenManageCompanies: () => void;
  onPrint: () => void;
  onResetDay: () => void;
  printWithDate: boolean;
  onTogglePrintWithDate: (val: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  sheet,
  onDateChange,
  onOpenManageCompanies,
  onPrint,
  onResetDay,
  printWithDate,
  onTogglePrintWithDate,
}) => {
  const today = getTodayDateString();

  const handlePrevDay = () => {
    const current = new Date(sheet.date + 'T12:00:00');
    current.setDate(current.getDate() - 1);
    const prevDate = current.toISOString().split('T')[0];
    onDateChange(prevDate);
  };

  const handleNextDay = () => {
    const current = new Date(sheet.date + 'T12:00:00');
    current.setDate(current.getDate() + 1);
    const nextDate = current.toISOString().split('T')[0];
    onDateChange(nextDate);
  };

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Branding & Main Controls Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Logo & Titles */}
          <div className="flex items-center gap-3">
            <img
              src={gauchaoLogo}
              alt="Gauchão Restaurante e Cozinha Industrial"
              className="h-12 w-auto object-contain shrink-0"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                  GAUCHÃO
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold uppercase tracking-wider">
                  Cozinha Industrial
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500">
                {sheet.subtitle}
              </p>
            </div>
          </div>

          {/* Date Selector & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date Selector */}
            <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <button
                onClick={handlePrevDay}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-colors cursor-pointer"
                title="Dia anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-800">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <input
                  type="date"
                  value={sheet.date}
                  onChange={(e) => onDateChange(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                />
              </div>

              <button
                onClick={handleNextDay}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-colors cursor-pointer"
                title="Próximo dia"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {sheet.date === today ? (
              <span className="text-[11px] font-bold px-2.5 py-1.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                Hoje
              </span>
            ) : (
              <button
                onClick={() => onDateChange(today)}
                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                Ir para Hoje
              </button>
            )}

            <div className="h-6 w-px bg-slate-200 hidden sm:block mx-1"></div>

            {/* Print Date Option Toggle */}
            <label 
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs cursor-pointer transition-colors select-none"
              title="Por padrão, a impressão sai com campo em branco para preenchimento com caneta. Marque para imprimir com a data preenchida."
            >
              <input
                type="checkbox"
                checked={printWithDate}
                onChange={(e) => onTogglePrintWithDate(e.target.checked)}
                className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-700 font-medium">
                Data impressa
              </span>
            </label>

            <button
              id="btn-print-sheet"
              onClick={onPrint}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-lg shadow-sm transition-all cursor-pointer"
              title="Imprimir ficha de controle formatada para prancheta A4"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Ficha</span>
            </button>

            <button
              id="btn-manage-companies"
              onClick={onOpenManageCompanies}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Gerenciar Empresas e Kits Contratados"
            >
              <Building2 className="w-4 h-4 text-slate-600" />
              <span>Empresas ({sheet.companies.length})</span>
            </button>

            <button
              id="btn-reset-day"
              onClick={onResetDay}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
              title="Limpar todos os campos do dia atual para novo preenchimento"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Resetar Dia</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
