/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DailyOrderSheet } from './types';
import { getTodayDateString, createEmptyItem } from './data/defaultData';
import { loadSheetFromStorage, saveSheetToStorage } from './utils/storage';
import { Header } from './components/Header';
import { CompanyTable } from './components/CompanyTable';
import { ManageCompaniesModal } from './components/ManageCompaniesModal';
import { PrintSheetView } from './components/PrintSheetView';
import { ConfirmModal } from './components/ConfirmModal';
import { Printer, Building2, AlertTriangle, X } from 'lucide-react';

export default function App() {
  const [currentDate, setCurrentDate] = useState<string>(() => getTodayDateString());
  const [sheet, setSheet] = useState<DailyOrderSheet>(() => loadSheetFromStorage(getTodayDateString()));
  const [printWithDate, setPrintWithDate] = useState<boolean>(false);
  const [storageQuotaWarning, setStorageQuotaWarning] = useState<boolean>(false);

  // Modals state
  const [isManageCompaniesOpen, setIsManageCompaniesOpen] = useState(false);
  const [isResetDayModalOpen, setIsResetDayModalOpen] = useState(false);

  // Listen for storage quota warnings
  useEffect(() => {
    const handleQuotaExceeded = () => {
      setStorageQuotaWarning(true);
    };
    window.addEventListener('gauchao_storage_quota_exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gauchao_storage_quota_exceeded', handleQuotaExceeded);
    };
  }, []);

  // Load sheet when date changes
  useEffect(() => {
    const loaded = loadSheetFromStorage(currentDate);
    setSheet(loaded);
  }, [currentDate]);

  // Save sheet on change
  const handleUpdateSheet = (updater: (prev: DailyOrderSheet) => DailyOrderSheet) => {
    setSheet((prev) => {
      const updated = updater(prev);
      saveSheetToStorage(updated);
      return updated;
    });
  };

  const handleDateChange = (newDate: string) => {
    if (!newDate) return;
    setCurrentDate(newDate);
  };

  // Reset current day with empty lines
  const handleConfirmResetDay = () => {
    handleUpdateSheet((prev) => ({
      ...prev,
      companies: prev.companies.map((comp) => ({
        ...comp,
        items: Array.from({ length: comp.defaultRowsCount || 4 }, () =>
          createEmptyItem('')
        ),
      })),
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-amber-200 selection:text-amber-900">
      {/* Screen Header */}
      <Header
        sheet={sheet}
        onDateChange={handleDateChange}
        onOpenManageCompanies={() => setIsManageCompaniesOpen(true)}
        onPrint={handlePrint}
        onResetDay={() => setIsResetDayModalOpen(true)}
        printWithDate={printWithDate}
        onTogglePrintWithDate={setPrintWithDate}
      />

      {/* Storage Quota Warning Banner */}
      {storageQuotaWarning && (
        <div className="no-print bg-amber-500 text-slate-900 px-4 py-2.5 flex items-center justify-between text-xs font-semibold shadow-inner">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0" />
            <span>
              Atenção: O espaço de armazenamento do seu navegador está próximo do limite. Recomendamos abrir "Gerenciar Empresas" e clicar em <strong>"Exportar Backup Completo"</strong> para garantir seus dados.
            </span>
          </div>
          <button
            onClick={() => setStorageQuotaWarning(false)}
            className="p-1 hover:bg-amber-600 rounded-md transition-colors cursor-pointer"
            title="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main className="flex-1 no-print pb-24">
        <CompanyTable
          sheet={sheet}
          onUpdateSheet={handleUpdateSheet}
        />
      </main>

      {/* Floating Bottom Quick-Action Bar for easy access */}
      <div className="no-print fixed bottom-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-2xl border border-slate-700 flex items-center gap-3.5 text-xs">
        <div className="flex items-center gap-1.5 text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="font-bold">{sheet.date.split('-').reverse().join('/')}</span>
        </div>

        <div className="h-4 w-px bg-slate-700"></div>

        <button
          onClick={() => setIsManageCompaniesOpen(true)}
          className="flex items-center gap-1.5 text-slate-300 hover:text-white font-semibold transition-colors cursor-pointer"
        >
          <Building2 className="w-4 h-4 text-amber-400" />
          <span>Gerenciar Empresas</span>
        </button>

        <div className="h-4 w-px bg-slate-700"></div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 text-white font-bold bg-amber-600 hover:bg-amber-500 px-3 py-1 rounded-full shadow-sm transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Imprimir Ficha</span>
        </button>
      </div>

      {/* Modals */}
      <ManageCompaniesModal
        sheet={sheet}
        isOpen={isManageCompaniesOpen}
        onClose={() => setIsManageCompaniesOpen(false)}
        onUpdateSheet={handleUpdateSheet}
      />

      <ConfirmModal
        isOpen={isResetDayModalOpen}
        title="Limpar e Resetar Dia"
        message="Deseja limpar todos os nomes, quantidades e observações preenchidos no dia de hoje? A estrutura das empresas será mantida vazia para novo preenchimento."
        confirmText="Resetar Dia"
        cancelText="Cancelar"
        variant="warning"
        onConfirm={handleConfirmResetDay}
        onClose={() => setIsResetDayModalOpen(false)}
      />

      {/* Dedicated Print Layout (rendered only when window.print() is executed) */}
      <PrintSheetView sheet={sheet} printWithDate={printWithDate} />
    </div>
  );
}
