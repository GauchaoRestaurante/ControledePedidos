import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  RotateCcw,
  Coffee,
  Pencil,
  Building2,
  Check,
  X
} from 'lucide-react';
import { OrderItem, DailyOrderSheet } from '../types';
import { createEmptyItem, MARMITA_TYPE_OPTIONS } from '../data/defaultData';
import { ConfirmModal } from './ConfirmModal';
import { saveMasterCompanyTemplates, upsertCompanyCatalogEntry } from '../utils/storage';

interface CompanyTableProps {
  sheet: DailyOrderSheet;
  onUpdateSheet: (updater: (prev: DailyOrderSheet) => DailyOrderSheet) => void;
}

export const CompanyTable: React.FC<CompanyTableProps> = ({
  sheet,
  onUpdateSheet,
}) => {
  // Modal confirmation state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'clear_company' | 'delete_company';
    companyIndex: number;
    companyName: string;
  }>({
    isOpen: false,
    type: 'clear_company',
    companyIndex: -1,
    companyName: '',
  });

  // Modal edit company name & kit state
  const [editingCompany, setEditingCompany] = useState<{
    index: number;
    id: string;
    name: string;
    kitDescription: string;
  } | null>(null);

  const handleStartEditCompany = (companyIndex: number) => {
    const target = sheet.companies[companyIndex];
    if (!target) return;
    setEditingCompany({
      index: companyIndex,
      id: target.id,
      name: target.name,
      kitDescription: target.kitDescription || '',
    });
  };

  const handleSaveEditCompany = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingCompany || !editingCompany.name.trim()) return;

    onUpdateSheet((prev) => {
      const newCompanies = [...prev.companies];
      const target = { ...newCompanies[editingCompany.index] };
      if (!target) return prev;
      target.name = editingCompany.name.trim();
      target.kitDescription = editingCompany.kitDescription.trim();
      newCompanies[editingCompany.index] = target;
      saveMasterCompanyTemplates(newCompanies);
      upsertCompanyCatalogEntry({
        id: target.id,
        name: target.name,
        kitDescription: target.kitDescription,
        defaultRowsCount: target.defaultRowsCount || 4,
        badgeColor: target.badgeColor || 'amber',
      });
      return { ...prev, companies: newCompanies };
    });

    setEditingCompany(null);
  };

  // Update a specific item in a company
  const handleUpdateItem = (
    companyIndex: number,
    itemIndex: number,
    field: keyof OrderItem,
    value: any
  ) => {
    // Sanitize numeric inputs (cafeQty, marmitaQty)
    let sanitizedValue = value;
    if (field === 'cafeQty' || field === 'marmitaQty') {
      if (value !== '' && value !== null && value !== undefined) {
        const num = parseInt(String(value), 10);
        sanitizedValue = isNaN(num) ? '' : Math.max(0, Math.min(999, num));
      } else {
        sanitizedValue = '';
      }
    }

    onUpdateSheet((prev) => {
      const newCompanies = [...prev.companies];
      const company = { ...newCompanies[companyIndex] };
      const newItems = [...company.items];
      newItems[itemIndex] = {
        ...newItems[itemIndex],
        [field]: sanitizedValue,
      };
      company.items = newItems;
      newCompanies[companyIndex] = company;
      return { ...prev, companies: newCompanies };
    });
  };

  // Add a new row to a specific company
  const handleAddRow = (companyIndex: number) => {
    onUpdateSheet((prev) => {
      const newCompanies = [...prev.companies];
      const company = { ...newCompanies[companyIndex] };
      const newItem = createEmptyItem('');
      company.items = [...company.items, newItem];
      newCompanies[companyIndex] = company;
      return { ...prev, companies: newCompanies };
    });
  };

  // Remove a row from a company (Excluir linha)
  const handleRemoveRow = (companyIndex: number, itemIndex: number) => {
    onUpdateSheet((prev) => {
      const newCompanies = [...prev.companies];
      const company = { ...newCompanies[companyIndex] };
      if (company.items.length <= 1) {
        company.items = [createEmptyItem('')];
      } else {
        company.items = company.items.filter((_, idx) => idx !== itemIndex);
      }
      newCompanies[companyIndex] = company;
      return { ...prev, companies: newCompanies };
    });
  };

  // Open confirmation for clearing company data
  const handlePromptClearCompany = (companyIndex: number) => {
    const company = sheet.companies[companyIndex];
    if (!company) return;
    setConfirmDialog({
      isOpen: true,
      type: 'clear_company',
      companyIndex,
      companyName: company.name,
    });
  };

  // Open confirmation for deleting company from sheet
  const handlePromptDeleteCompany = (companyIndex: number) => {
    const company = sheet.companies[companyIndex];
    if (!company) return;
    setConfirmDialog({
      isOpen: true,
      type: 'delete_company',
      companyIndex,
      companyName: company.name,
    });
  };

  // Execute confirmed action
  const handleExecuteConfirm = () => {
    const { type, companyIndex } = confirmDialog;
    if (companyIndex < 0) return;

    if (type === 'clear_company') {
      onUpdateSheet((prev) => {
        const newCompanies = [...prev.companies];
        const target = { ...newCompanies[companyIndex] };
        if (!target) return prev;
        const rowCount = Math.max(target.defaultRowsCount || 4, target.items.length);
        target.items = Array.from({ length: rowCount }, () => createEmptyItem(''));
        newCompanies[companyIndex] = target;
        return { ...prev, companies: newCompanies };
      });
    } else if (type === 'delete_company') {
      onUpdateSheet((prev) => {
        const target = prev.companies[companyIndex];
        if (target) {
          upsertCompanyCatalogEntry({
            id: target.id,
            name: target.name,
            kitDescription: target.kitDescription || '',
            defaultRowsCount: target.defaultRowsCount || 4,
            badgeColor: target.badgeColor || 'amber',
          });
        }
        const newCompanies = prev.companies.filter((_, idx) => idx !== companyIndex);
        saveMasterCompanyTemplates(newCompanies);
        return { ...prev, companies: newCompanies };
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Main Table Matrix */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
        {/* Table Title Banner - Neutral soft tone to save ink and look clean */}
        <div className="bg-slate-100 text-slate-800 px-4 py-3 border-b border-slate-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-wide uppercase">
                {sheet.title}
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                {sheet.subtitle} — DATA: {sheet.date.split('-').reverse().join('/')}
              </p>
            </div>
          </div>
          <div className="text-xs text-amber-900 font-semibold bg-amber-50/80 px-2.5 py-1 rounded border border-amber-200">
            Preenchimento Rápido ({sheet.companies.length} Empresas)
          </div>
        </div>

        {/* The Primary Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            {/* Main Column Header */}
            <thead>
              <tr className="bg-slate-100/80 text-slate-800 text-xs font-bold uppercase tracking-wider border-b-2 border-slate-300">
                <th className="py-3 px-3 w-[260px] border-r border-slate-200 text-slate-900">
                  Empresa / Kit Contratado
                </th>
                <th className="py-3 px-2 w-[45px] text-center border-r border-slate-200">
                  #
                </th>
                <th className="py-3 px-3 w-[240px] border-r border-slate-200">
                  Colaborador / Solicitante
                </th>
                <th className="py-3 px-3 w-[160px] text-center border-r border-slate-200">
                  Qtd de Cafés (Kits)
                </th>
                <th className="py-3 px-3 w-[220px] border-r border-slate-200">
                  Marmitas (Qtd & Nº)
                </th>
                <th className="py-3 px-3 border-r border-slate-200">
                  Observações (Ex: Sem Feijão)
                </th>
                <th className="py-3 px-3 w-[120px] text-center border-r border-slate-200">
                  Horário Retirada
                </th>
                <th className="py-3 px-2 w-[70px] text-center">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody>
              {sheet.companies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <p className="font-semibold">Nenhuma empresa na planilha.</p>
                  </td>
                </tr>
              ) : (
                sheet.companies.map((company, companyIndex) => {
                  const totalFilled = company.items.filter(
                    (i) => i.collaboratorName.trim() || i.notes?.trim() || i.cafeQty !== '' || i.marmitaQty !== ''
                  ).length;

                  return (
                    <React.Fragment key={company.id}>
                      {/* Section Header Row for Company with Action Bar */}
                      <tr className="bg-slate-50 border-t-2 border-slate-300 border-b border-slate-200">
                        <td colSpan={8} className="py-2.5 px-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            {/* Left: Company Name & Kit Description */}
                            <div className="flex items-center flex-wrap gap-2.5">
                              <span className="w-2.5 h-6 rounded-sm bg-amber-600"></span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight">
                                  {company.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditCompany(companyIndex)}
                                  className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-100/70 rounded-md transition-colors cursor-pointer"
                                  title={`Editar nome ou kit da empresa "${company.name}"`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <span className="text-[11px] px-2 py-0.5 bg-slate-200 text-slate-700 font-semibold rounded-md">
                                {totalFilled}/{company.items.length} preenchidos
                              </span>
                              {company.kitDescription && (
                                <span className="inline-flex text-[11px] font-medium text-amber-900 bg-amber-100/80 px-2.5 py-0.5 rounded-md border border-amber-200 items-center gap-1.5">
                                  <Coffee className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                  <span><strong>Kit:</strong> {company.kitDescription}</span>
                                </span>
                              )}
                            </div>

                            {/* Right: Quick actions for this company */}
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              {/* Editar Empresa */}
                              <button
                                type="button"
                                onClick={() => handleStartEditCompany(companyIndex)}
                                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                                title={`Editar nome da empresa ou kit contratado`}
                              >
                                <Pencil className="w-3 h-3 text-amber-600" />
                                <span>Editar</span>
                              </button>

                              {/* Add Row Button */}
                              <button
                                type="button"
                                onClick={() => handleAddRow(companyIndex)}
                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                                title="Adicionar mais uma linha/colaborador para esta empresa"
                              >
                                <Plus className="w-3 h-3" />
                                <span>+ Linha</span>
                              </button>

                              {/* Limpar Linhas da Empresa */}
                              <button
                                onClick={() => handlePromptClearCompany(companyIndex)}
                                className="px-2 py-1 bg-white hover:bg-amber-50 text-amber-700 hover:text-amber-800 border border-amber-200 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                                title={`Limpar todos os dados preenchidos da empresa "${company.name}"`}
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Limpar Empresa</span>
                              </button>

                              {/* Excluir Empresa Inteira */}
                              <button
                                onClick={() => handlePromptDeleteCompany(companyIndex)}
                                className="px-2 py-1 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                                title={`Excluir a empresa "${company.name}" da planilha de hoje`}
                              >
                                <Trash2 className="w-3 h-3" />
                                <span className="hidden sm:inline">Excluir Empresa</span>
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Multi-rows for each collaborator in this company */}
                      {company.items.map((item, itemIndex) => {
                        const isFirstRow = itemIndex === 0;
                        const rowCount = company.items.length;

                        return (
                          <tr
                            key={item.id}
                            className="border-b border-slate-200 hover:bg-amber-50/40 transition-colors"
                          >
                            {/* Company Name Cell (Rowspan on first row to match physical spreadsheet layout!) */}
                            {isFirstRow ? (
                              <td
                                rowSpan={rowCount}
                                className="py-2.5 px-3 border-r-2 border-slate-300 bg-slate-50/60 align-top font-bold text-slate-800 text-sm shadow-2xs"
                              >
                                <div className="sticky top-24 space-y-2">
                                  <div className="text-slate-950 font-bold text-sm tracking-tight flex items-center justify-between">
                                    <span>{company.name}</span>
                                    <span className="text-[10px] font-normal text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                      {company.items.length} linhas
                                    </span>
                                  </div>
                                  
                                  {company.kitDescription && (
                                    <div className="text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-amber-200/80 space-y-1">
                                      <div className="font-bold text-[10px] text-amber-800 uppercase tracking-wider flex items-center gap-1">
                                        <Coffee className="w-3 h-3" /> Kit Café Contratado:
                                      </div>
                                      <div className="text-xs text-slate-800 leading-snug font-medium">
                                        {company.kitDescription}
                                      </div>
                                    </div>
                                  )}

                                  <button
                                    onClick={() => handleAddRow(companyIndex)}
                                    className="w-full py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Adicionar Linha
                                  </button>
                                </div>
                              </td>
                            ) : null}

                            {/* Row Index Number */}
                            <td className="py-2 px-1 text-center border-r border-slate-200 text-xs font-mono font-bold text-slate-400">
                              {itemIndex + 1}
                            </td>

                            {/* Colaborador / Solicitante */}
                            <td className="py-1.5 px-2 border-r border-slate-200">
                              <input
                                type="text"
                                value={item.collaboratorName}
                                onChange={(e) =>
                                  handleUpdateItem(companyIndex, itemIndex, 'collaboratorName', e.target.value)
                                }
                                placeholder={`Colaborador ${itemIndex + 1} ou Motorista...`}
                                className="w-full px-2.5 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all placeholder:text-slate-400 placeholder:italic"
                              />
                            </td>

                            {/* Quantidade de Cafés (Kits) - Ampliado e Vazio por Padrão */}
                            <td className="py-1.5 px-2 border-r border-slate-200 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={99}
                                  value={item.cafeQty === 0 ? 0 : item.cafeQty || ''}
                                  onChange={(e) =>
                                    handleUpdateItem(companyIndex, itemIndex, 'cafeQty', e.target.value)
                                  }
                                  placeholder=""
                                  className="w-20 px-2 py-2 text-sm text-center font-extrabold text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                  title="Quantidade de Cafés (Kits de Café da Manhã) - Deixe vazio para preencher à mão na folha impressa"
                                />
                                <span className="text-xs font-medium text-slate-500">kit(s)</span>
                              </div>
                            </td>

                            {/* Marmitas (Qtd & Nº) - Ampliado */}
                            <td className="py-1.5 px-2 border-r border-slate-200">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={99}
                                  value={item.marmitaQty === 0 ? 0 : item.marmitaQty || ''}
                                  onChange={(e) =>
                                    handleUpdateItem(companyIndex, itemIndex, 'marmitaQty', e.target.value)
                                  }
                                  placeholder=""
                                  title="Quantidade de Marmitas - Deixe vazio para preencher à mão"
                                  className="w-16 px-2 py-2 text-sm text-center font-bold text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                />
                                <select
                                  value={item.marmitaType || 'Nº 9'}
                                  onChange={(e) =>
                                    handleUpdateItem(companyIndex, itemIndex, 'marmitaType', e.target.value)
                                  }
                                  className="flex-1 px-2 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                                  title="Tipo da Marmita"
                                >
                                  {MARMITA_TYPE_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>

                            {/* Observações */}
                            <td className="py-1.5 px-2 border-r border-slate-200">
                              <input
                                type="text"
                                value={item.notes || ''}
                                onChange={(e) =>
                                  handleUpdateItem(companyIndex, itemIndex, 'notes', e.target.value)
                                }
                                placeholder="Ex: Uma sem feijão por gentileza!!"
                                className={`w-full px-2.5 py-2 text-xs rounded border transition-colors ${
                                  item.notes
                                    ? 'bg-rose-50 border-rose-300 text-rose-900 font-medium'
                                    : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 hover:border-slate-300'
                                } focus:outline-none focus:ring-1 focus:ring-amber-500`}
                                title={item.notes || 'Observações / Restrições do pedido'}
                              />
                            </td>

                            {/* Horário Retirada */}
                            <td className="py-1.5 px-2 text-center border-r border-slate-200">
                              <input
                                type="text"
                                value={item.pickupTime || ''}
                                onChange={(e) =>
                                  handleUpdateItem(companyIndex, itemIndex, 'pickupTime', e.target.value)
                                }
                                placeholder=""
                                title="Horário de Retirada (ex: 06:30)"
                                className="w-18 px-1 py-2 text-xs font-mono text-center font-bold text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </td>

                            {/* Ações (Apenas Excluir Linha) */}
                            <td className="py-1.5 px-2 text-center">
                              <div className="flex items-center justify-center">
                                {/* Excluir Linha */}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRow(companyIndex, itemIndex)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="Excluir linha"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* In-app Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={
          confirmDialog.type === 'delete_company'
            ? 'Excluir Empresa'
            : 'Limpar Preenchimento da Empresa'
        }
        message={
          confirmDialog.type === 'delete_company'
            ? `Tem certeza que deseja excluir a empresa "${confirmDialog.companyName}" e todas as suas linhas da planilha de hoje?`
            : `Deseja limpar todos os dados e nomes preenchidos na empresa "${confirmDialog.companyName}"? A estrutura de linhas será restaurada vazia para novo preenchimento.`
        }
        confirmText={
          confirmDialog.type === 'delete_company'
            ? 'Excluir Empresa'
            : 'Limpar Dados'
        }
        cancelText="Cancelar"
        variant={confirmDialog.type === 'delete_company' ? 'danger' : 'warning'}
        onConfirm={handleExecuteConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Modal for Editing Company Name & Kit */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-amber-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-white" />
                <h3 className="text-base font-bold tracking-tight">
                  Editar Empresa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCompany(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCompany} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Nome da Empresa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingCompany.name}
                  onChange={(e) =>
                    setEditingCompany((prev) =>
                      prev ? { ...prev, name: e.target.value } : null
                    )
                  }
                  placeholder="Ex: JR Florestal"
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-900 font-semibold transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Kit de Café Contratado (Descrição)
                </label>
                <textarea
                  rows={2}
                  value={editingCompany.kitDescription}
                  onChange={(e) =>
                    setEditingCompany((prev) =>
                      prev ? { ...prev, kitDescription: e.target.value } : null
                    )
                  }
                  placeholder="Ex: 2 Pães + 2 Frutas + 100ml Leite / 200ml Café"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-800 transition-all resize-none"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                <p className="font-semibold mb-0.5">Salvamento automático:</p>
                <p className="text-amber-800/90 text-[11px] leading-relaxed">
                  O nome será atualizado imediatamente na tabela, na impressão e memorizado para os próximos dias.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCompany(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!editingCompany.name.trim()}
                  className="px-5 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
