import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  ArrowUp, 
  ArrowDown, 
  Coffee,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  BookmarkPlus,
  AlertCircle,
  Download,
  Upload,
  ShieldCheck
} from 'lucide-react';
import { DailyOrderSheet, CompanyContract, CompanyCatalogEntry } from '../types';
import { createEmptyItem, generateId } from '../data/defaultData';
import { 
  saveMasterCompanyTemplates, 
  getCompanyCatalog, 
  saveCompanyCatalog, 
  upsertCompanyCatalogEntry, 
  removeCompanyCatalogEntry,
  getDefaultCompanyCatalog,
  exportAllSheetsBackup,
  importSheetsBackup,
  loadSheetFromStorage
} from '../utils/storage';

interface ManageCompaniesModalProps {
  sheet: DailyOrderSheet;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSheet: (updater: (prev: DailyOrderSheet) => DailyOrderSheet) => void;
}

export const ManageCompaniesModal: React.FC<ManageCompaniesModalProps> = ({
  sheet,
  isOpen,
  onClose,
  onUpdateSheet,
}) => {
  const [catalog, setCatalog] = useState<CompanyCatalogEntry[]>([]);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyRows, setNewCompanyRows] = useState(4);
  const [newCompanyKit, setNewCompanyKit] = useState('1 Pão c/ Manteiga + 100ml Leite / 150ml Café');

  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editKit, setEditKit] = useState('');

  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Load catalog on open and sync any sheet companies to catalog
  useEffect(() => {
    if (isOpen) {
      const storedCatalog = getCompanyCatalog();
      // Ensure all sheet companies are also present in catalog
      let hasNewToCatalog = false;
      const updatedCatalog = [...storedCatalog];

      sheet.companies.forEach((comp) => {
        const exists = updatedCatalog.some(
          (c) => c.id === comp.id || c.name.trim().toLowerCase() === comp.name.trim().toLowerCase()
        );
        if (!exists) {
          updatedCatalog.push({
            id: comp.id,
            name: comp.name,
            kitDescription: comp.kitDescription || '',
            defaultRowsCount: comp.defaultRowsCount || comp.items.length || 4,
            badgeColor: comp.badgeColor || 'amber',
          });
          hasNewToCatalog = true;
        }
      });

      if (hasNewToCatalog) {
        saveCompanyCatalog(updatedCatalog);
      }
      setCatalog(updatedCatalog);
    }
  }, [isOpen, sheet.companies]);

  if (!isOpen) return null;

  const showFeedback = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => {
      setFeedbackNotice((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  // Find companies in catalog that are not currently in the sheet
  const activeCompanyNames = new Set(sheet.companies.map((c) => c.name.trim().toLowerCase()));
  const activeCompanyIds = new Set(sheet.companies.map((c) => c.id));
  const availableFromCatalog = catalog.filter(
    (c) => !activeCompanyIds.has(c.id) && !activeCompanyNames.has(c.name.trim().toLowerCase())
  );

  // Add brand new company (to both sheet and catalog)
  const handleAddBrandNewCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    const trimmedName = newCompanyName.trim();
    const newId = generateId();

    const newCompany: CompanyContract = {
      id: newId,
      name: trimmedName,
      defaultRowsCount: newCompanyRows,
      kitDescription: newCompanyKit.trim(),
      badgeColor: 'amber',
      items: Array.from({ length: newCompanyRows }, () => createEmptyItem('')),
    };

    const catalogEntry: CompanyCatalogEntry = {
      id: newId,
      name: trimmedName,
      kitDescription: newCompanyKit.trim(),
      defaultRowsCount: newCompanyRows,
      badgeColor: 'amber',
    };

    upsertCompanyCatalogEntry(catalogEntry);
    setCatalog(getCompanyCatalog());

    onUpdateSheet((prev) => {
      const updated = [...prev.companies, newCompany];
      saveMasterCompanyTemplates(updated);
      return {
        ...prev,
        companies: updated,
      };
    });

    showFeedback(`Empresa "${trimmedName}" cadastrada e adicionada com sucesso!`);
    setNewCompanyName('');
    setNewCompanyKit('1 Pão c/ Manteiga + 100ml Leite / 150ml Café');
    setNewCompanyRows(4);
  };

  // Add an existing pre-registered company from catalog to the active sheet
  const handleAddFromCatalog = (entry: CompanyCatalogEntry) => {
    const newCompany: CompanyContract = {
      id: entry.id || generateId(),
      name: entry.name,
      defaultRowsCount: entry.defaultRowsCount || 4,
      kitDescription: entry.kitDescription,
      badgeColor: entry.badgeColor || 'amber',
      items: Array.from({ length: entry.defaultRowsCount || 4 }, () => createEmptyItem('')),
    };

    onUpdateSheet((prev) => {
      const updated = [...prev.companies, newCompany];
      saveMasterCompanyTemplates(updated);
      return {
        ...prev,
        companies: updated,
      };
    });

    showFeedback(`"${entry.name}" foi adicionada à planilha de hoje!`);
  };

  // Add all available pre-registered companies back to sheet
  const handleAddAllAvailable = () => {
    if (availableFromCatalog.length === 0) return;

    const newCompaniesToAdd: CompanyContract[] = availableFromCatalog.map((entry) => ({
      id: entry.id || generateId(),
      name: entry.name,
      defaultRowsCount: entry.defaultRowsCount || 4,
      kitDescription: entry.kitDescription,
      badgeColor: entry.badgeColor || 'amber',
      items: Array.from({ length: entry.defaultRowsCount || 4 }, () => createEmptyItem('')),
    }));

    onUpdateSheet((prev) => {
      const updated = [...prev.companies, ...newCompaniesToAdd];
      saveMasterCompanyTemplates(updated);
      return {
        ...prev,
        companies: updated,
      };
    });

    showFeedback(`${newCompaniesToAdd.length} empresas do catálogo foram adicionadas à planilha.`);
  };

  // Remove company from the active sheet ONLY (it remains in catalog to re-add anytime)
  const handleRemoveFromSheet = (company: CompanyContract) => {
    // Ensure it exists in catalog before removing
    upsertCompanyCatalogEntry({
      id: company.id,
      name: company.name,
      kitDescription: company.kitDescription || '',
      defaultRowsCount: company.defaultRowsCount || company.items.length || 4,
      badgeColor: company.badgeColor || 'amber',
    });
    setCatalog(getCompanyCatalog());

    onUpdateSheet((prev) => {
      const updated = prev.companies.filter((c) => c.id !== company.id);
      saveMasterCompanyTemplates(updated);
      return {
        ...prev,
        companies: updated,
      };
    });

    showFeedback(`"${company.name}" removida da folha de hoje. Ela continua salva no catálogo abaixo!`);
  };

  // Permanently delete from catalog if really needed
  const handlePermanentDeleteCatalog = (catalogId: string, name: string) => {
    if (confirm(`Deseja realmente remover permanentemente "${name}" do catálogo geral de empresas?`)) {
      removeCompanyCatalogEntry(catalogId);
      setCatalog(getCompanyCatalog());
      showFeedback(`"${name}" removida do catálogo permanente.`);
    }
  };

  // Restore default catalog (12 standard companies)
  const handleRestoreDefaultCatalog = () => {
    const defaults = getDefaultCompanyCatalog();
    saveCompanyCatalog(defaults);
    setCatalog(defaults);
    showFeedback('Catálogo restaurado com as empresas padrão do Gauchão.');
  };

  const handleStartEdit = (company: CompanyContract) => {
    setEditingCompanyId(company.id);
    setEditName(company.name);
    setEditKit(company.kitDescription || '');
  };

  const handleSaveEdit = (companyId: string) => {
    const trimmedName = editName.trim();
    const trimmedKit = editKit.trim();

    onUpdateSheet((prev) => {
      const updated = prev.companies.map((c) =>
        c.id === companyId
          ? {
              ...c,
              name: trimmedName || c.name,
              kitDescription: trimmedKit,
            }
          : c
      );
      saveMasterCompanyTemplates(updated);

      const targetComp = updated.find((c) => c.id === companyId);
      if (targetComp) {
        upsertCompanyCatalogEntry({
          id: targetComp.id,
          name: targetComp.name,
          kitDescription: targetComp.kitDescription,
          defaultRowsCount: targetComp.defaultRowsCount || 4,
          badgeColor: targetComp.badgeColor || 'amber',
        });
        setCatalog(getCompanyCatalog());
      }

      return {
        ...prev,
        companies: updated,
      };
    });
    setEditingCompanyId(null);
    showFeedback('Dados da empresa e kit atualizados com sucesso.');
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sheet.companies.length) return;

    onUpdateSheet((prev) => {
      const companies = [...prev.companies];
      const temp = companies[index];
      companies[index] = companies[targetIndex];
      companies[targetIndex] = temp;
      saveMasterCompanyTemplates(companies);
      return { ...prev, companies };
    });
  };

  const handleAdjustDefaultRows = (companyIndex: number, newCount: number) => {
    if (newCount < 1 || newCount > 25) return;

    onUpdateSheet((prev) => {
      const companies = [...prev.companies];
      const company = { ...companies[companyIndex] };
      const currentItems = [...company.items];

      if (newCount > currentItems.length) {
        const diff = newCount - currentItems.length;
        for (let i = 0; i < diff; i++) {
          currentItems.push(createEmptyItem(''));
        }
      } else if (newCount < currentItems.length) {
        currentItems.splice(newCount);
      }

      company.items = currentItems;
      company.defaultRowsCount = newCount;
      companies[companyIndex] = company;

      // Update catalog entry default row count too
      upsertCompanyCatalogEntry({
        id: company.id,
        name: company.name,
        kitDescription: company.kitDescription || '',
        defaultRowsCount: newCount,
        badgeColor: company.badgeColor || 'amber',
      });
      setCatalog(getCompanyCatalog());
      saveMasterCompanyTemplates(companies);

      return { ...prev, companies };
    });
  };

  const handleExportBackup = () => {
    try {
      const backupJson = exportAllSheetsBackup();
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-gauchao-pedidos-${sheet.date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showFeedback('Backup completo exportado com sucesso em arquivo JSON!');
    } catch (err: any) {
      alert('Falha ao exportar backup: ' + (err?.message || ''));
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Security: Limit file size to 2MB to prevent browser memory exhaustion DoS
    if (file.size > 2 * 1024 * 1024) {
      alert('O arquivo de backup é muito grande (limite máximo de 2MB).');
      e.target.value = '';
      return;
    }

    const confirmed = window.confirm(
      'Restaurar este backup atualizará as empresas e dados correspondentes no sistema com as informações do arquivo. Deseja continuar?'
    );
    if (!confirmed) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      alert('Falha ao ler o arquivo selecionado.');
      e.target.value = '';
    };
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (!content) return;
      const res = importSheetsBackup(content);
      if (res.success) {
        setCatalog(getCompanyCatalog());
        onUpdateSheet((prev) => {
          const reloaded = loadSheetFromStorage(prev.date);
          return reloaded;
        });
        showFeedback(`Backup restaurado com sucesso! (${res.importedDates} datas recuperadas).`);
      } else {
        alert('Erro ao restaurar backup: ' + (res.error || 'Arquivo inválido'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>Gerenciar Empresas e Contratos</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                  {sheet.companies.length} na planilha
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Selecione empresas pré-cadastradas no catálogo, adicione novas ou altere a ordem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert if any */}
        {feedbackNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2 flex items-center gap-2 text-xs font-semibold text-emerald-800 animate-in fade-in duration-150 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">

          {/* ======================================================== */}
          {/* SECTION 1: EMPRESAS NA PLANILHA DO DIA */}
          {/* ======================================================== */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-3.5 bg-amber-600 rounded-xs"></span>
                  Empresas na Planilha do Dia ({sheet.companies.length})
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Empresas visíveis na ficha de controle e na folha impressa de hoje.
                </p>
              </div>
            </div>

            {sheet.companies.length === 0 ? (
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
                <p className="text-xs font-bold text-amber-950">
                  Nenhuma empresa está ativa na planilha de hoje.
                </p>
                <p className="text-xs text-amber-800">
                  Selecione empresas pré-cadastradas no catálogo logo abaixo para ativá-las!
                </p>
                {availableFromCatalog.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAddAllAvailable}
                    className="mt-2 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    Adicionar todas do catálogo
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {sheet.companies.map((company, index) => {
                  const isEditing = editingCompanyId === company.id;

                  return (
                    <div
                      key={company.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                    >
                      {/* Left Info / Edit Form */}
                      <div className="flex-1 space-y-1">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500">Nome:</span>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-2.5 py-1 text-xs font-bold text-slate-900 bg-white border border-amber-500 rounded focus:outline-none"
                                placeholder="Nome da Empresa"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500">Kit:</span>
                              <input
                                type="text"
                                value={editKit}
                                onChange={(e) => setEditKit(e.target.value)}
                                className="w-full px-2.5 py-1 text-xs text-slate-700 bg-white border border-slate-300 rounded focus:outline-none"
                                placeholder="Descrição do Kit de Café Contratado"
                              />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">
                                {index + 1}. {company.name}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-700 font-semibold rounded-md">
                                {company.items.length} linhas
                              </span>
                            </div>
                            {company.kitDescription && (
                              <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                                <Coffee className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                <span className="line-clamp-1">{company.kitDescription}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right Controls */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {/* Adjust Rows */}
                        {!isEditing && (
                          <div 
                            className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs"
                            title="Quantidade de linhas / colaboradores para esta empresa"
                          >
                            <span className="text-[10px] text-slate-500 font-medium">Linhas:</span>
                            <input
                              type="number"
                              min={1}
                              max={25}
                              value={company.items.length}
                              onChange={(e) =>
                                handleAdjustDefaultRows(index, parseInt(e.target.value) || 1)
                              }
                              className="w-8 text-center text-xs font-bold text-slate-800 focus:outline-none"
                            />
                          </div>
                        )}

                        {/* Reorder Up/Down */}
                        <button
                          type="button"
                          onClick={() => handleMove(index, 'up')}
                          disabled={index === 0}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer transition-colors"
                          title="Mover para cima"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(index, 'down')}
                          disabled={index === sheet.companies.length - 1}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer transition-colors"
                          title="Mover para baixo"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>

                        {/* Edit / Save */}
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(company.id)}
                            className="p-1.5 text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded font-bold cursor-pointer transition-colors"
                            title="Salvar alterações"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(company)}
                            className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-100/70 rounded cursor-pointer transition-colors"
                            title="Editar nome e kit desta empresa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Remove from Sheet Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveFromSheet(company)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                          title="Remover desta folha diária (a empresa continua salva no catálogo abaixo para reativar quando quiser)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* SECTION 2: EMPRESAS PRÉ-CADASTRADAS DISPONÍVEIS */}
          {/* ======================================================== */}
          <div className="bg-amber-50/70 rounded-2xl border border-amber-200/90 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                  <BookmarkPlus className="w-4 h-4 text-amber-700" />
                  Catálogo de Empresas Pré-Cadastradas
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full">
                    {availableFromCatalog.length} disponíveis para adicionar
                  </span>
                </h4>
                <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
                  Caso alguma empresa tenha sido excluída ou não esteja no dia, ela fica guardada aqui para você reativar com 1 clique, sem precisar redigitar!
                </p>
              </div>

              {availableFromCatalog.length > 1 && (
                <button
                  type="button"
                  onClick={handleAddAllAvailable}
                  className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
                  title="Adicionar todas as empresas disponíveis à planilha de hoje"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Todas</span>
                </button>
              )}
            </div>

            {availableFromCatalog.length === 0 ? (
              <div className="p-3.5 bg-white/80 rounded-xl border border-amber-200/60 text-xs text-amber-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Todas as empresas do catálogo estão ativas na planilha de hoje.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availableFromCatalog.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 bg-white border border-amber-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-amber-400 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-xs truncate">
                          {entry.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium shrink-0">
                          ({entry.defaultRowsCount || 4} lin.)
                        </span>
                      </div>
                      {entry.kitDescription && (
                        <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                          {entry.kitDescription}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAddFromCatalog(entry)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                        title={`Adicionar "${entry.name}" de volta à planilha`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePermanentDeleteCatalog(entry.id, entry.name)}
                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Excluir do catálogo definitivo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 text-[11px] text-amber-800">
              <span>Catálogo total: {catalog.length} empresas registradas</span>
              <button
                type="button"
                onClick={handleRestoreDefaultCatalog}
                className="text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer flex items-center gap-1"
                title="Restaura as 12 empresas padrão do restaurante no catálogo"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar 12 Padrões</span>
              </button>
            </div>
          </div>

          {/* ======================================================== */}
          {/* SECTION 3: CADASTRAR NOVA EMPRESA */}
          {/* ======================================================== */}
          <form
            onSubmit={handleAddBrandNewCompany}
            className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5"
          >
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-amber-600" />
                Cadastrar Nova Empresa no Sistema
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                A nova empresa entrará na planilha e ficará gravada no catálogo permanente para sempre.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nome da Empresa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Ex: Fazenda Santa Maria"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 font-medium"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Linhas Iniciais
                </label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={newCompanyRows}
                  onChange={(e) => setNewCompanyRows(parseInt(e.target.value) || 4)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 font-medium text-center"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Kit Café Contratado (Descrição)
                </label>
                <input
                  type="text"
                  value={newCompanyKit}
                  onChange={(e) => setNewCompanyKit(e.target.value)}
                  placeholder="Ex: 1 Pão c/ Frios + 100ml Leite / 150ml Café"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                type="submit"
                disabled={!newCompanyName.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Salvar e Adicionar à Planilha</span>
              </button>
            </div>
          </form>

          {/* Section: Backup e Proteção de Dados */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Backup e Proteção Contra Perda de Dados
                </h4>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Segurança Pré-Produção</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Exporte uma cópia completa de todas as planilhas, histórico e catálogo de empresas em formato JSON. Caso precise trocar de dispositivo ou limpar os dados do navegador, você pode restaurar tudo com 1 clique.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportBackup}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-xs transition-colors cursor-pointer"
                title="Baixar arquivo JSON com todas as empresas e pedidos"
              >
                <Download className="w-3.5 h-3.5 text-amber-600" />
                <span>Exportar Backup Completo</span>
              </button>

              <label
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-xs transition-colors cursor-pointer"
                title="Carregar arquivo JSON de backup previamente salvo"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Restaurar Backup</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-500">
            Alterações são salvas automaticamente no navegador.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
