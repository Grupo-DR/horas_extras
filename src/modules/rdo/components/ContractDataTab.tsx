import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DollarSign, Calendar, Plus, Trash2, Save, CheckCircle2,
  AlertCircle, FileText, TrendingUp, Clock, ChevronDown, ChevronUp,
  Info, X
} from 'lucide-react';
import { Project, ContractData, ContractAddendum, MonthlyBudgetEntry, AddendumType } from '../types';
import { emptyContractData } from '../services/contractDataService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateUUID = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

const parseBRL = (raw: string): number => {
  const cleaned = raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const fmtBRLInput = (v: number | undefined | null) => {
  if (v === undefined || v === null || v === 0) return '';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

/** Gera lista de meses entre duas datas (inclusive) no formato "YYYY-MM" */
const monthsBetween = (start: string, end: string): string[] => {
  if (!start || !end) return [];
  const result: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (s > e) return [];
  const cur = new Date(s.getFullYear(), s.getMonth(), 1);
  const endMonth = new Date(e.getFullYear(), e.getMonth(), 1);
  while (cur <= endMonth) {
    result.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return result;
};

const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
};

/** Adiciona `days` dias úteis a uma data ISO */
const addDaysToDate = (isoDate: string, days: number): string => {
  if (!isoDate || days === 0) return isoDate;
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const diffDays = (a: string, b: string): number => {
  if (!a || !b) return 0;
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / 86400000);
};



// ─── Addendum Modal ────────────────────────────────────────────────────────────

interface AddendumModalProps {
  onConfirm: (a: Omit<ContractAddendum, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}

const AddendumModal: React.FC<AddendumModalProps> = ({ onConfirm, onClose }) => {
  const [type, setType] = useState<AddendumType>('TIME');
  const [description, setDescription] = useState('');
  const [addedDays, setAddedDays] = useState('');
  const [addedValue, setAddedValue] = useState('');
  const [approvedAt, setApprovedAt] = useState(new Date().toISOString().slice(0, 10));

  const isValid =
    description.trim().length > 0 &&
    approvedAt.length === 10 &&
    (type === 'VALUE' || Number(addedDays) > 0) &&
    (type === 'TIME' || parseBRL(addedValue) > 0);

  const handleSubmit = () => {
    if (!isValid) return;
    onConfirm({
      type,
      description: description.trim(),
      addedDays: type !== 'VALUE' ? Number(addedDays) : undefined,
      addedValue: type !== 'TIME' ? parseBRL(addedValue) : undefined,
      approvedAt,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Novo Aditivo Contratual
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Tipo */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-2">Tipo de Aditivo</label>
            <div className="grid grid-cols-3 gap-2">
              {([['TIME', 'Prazo'], ['VALUE', 'Valor'], ['TIME_AND_VALUE', 'Prazo + Valor']] as [AddendumType, string][]).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setType(v)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border ${
                    type === v
                      ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-2">Descrição</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Aditivo de prazo referente ao período chuvoso"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/50 outline-none"
            />
          </div>

          {/* Dias */}
          {(type === 'TIME' || type === 'TIME_AND_VALUE') && (
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-widest block mb-2">Dias Adicionados</label>
              <input
                type="number"
                min="1"
                value={addedDays}
                onChange={e => setAddedDays(e.target.value)}
                placeholder="Ex: 30"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/50 outline-none"
              />
            </div>
          )}

          {/* Valor */}
          {(type === 'VALUE' || type === 'TIME_AND_VALUE') && (
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-widest block mb-2">Valor Adicional (R$)</label>
              <input
                type="text"
                inputMode="numeric"
                value={addedValue}
                onChange={e => setAddedValue(e.target.value)}
                placeholder="Ex: 150.000"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/50 outline-none"
              />
            </div>
          )}

          {/* Data de aprovação */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-2">Data de Aprovação</label>
            <input
              type="date"
              value={approvedAt}
              onChange={e => setApprovedAt(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 text-sm font-semibold transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              isValid
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400'
                : 'bg-white/5 text-slate-600 cursor-not-allowed'
            }`}
          >
            Confirmar Aditivo
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

interface ContractDataTabProps {
  project: Project | null;
  contractData: ContractData | null;
  onSave: (data: ContractData) => void;
}

export const ContractDataTab: React.FC<ContractDataTabProps> = ({
  project, contractData, onSave
}) => {
  const projectId = project?.id ?? '';

  // ── Local editable state ──────────────────────────────────────────────────
  const [contractValue, setContractValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [monthlyEntries, setMonthlyEntries] = useState<MonthlyBudgetEntry[]>([]);
  const [addenda, setAddenda] = useState<ContractAddendum[]>([]);
  const [showAddendumModal, setShowAddendumModal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // ── Load data when project or contractData changes ────────────────────────
  useEffect(() => {
    const data = contractData ?? emptyContractData(projectId);
    setContractValue(fmtBRLInput(data.contractValue));
    setStartDate(data.contractStartDate);
    setEndDate(data.contractEndDate);
    setMonthlyEntries((data.monthlyEntries ?? []).map((e: any) => {
      if (!e.id) {
        const [y, m] = (e.monthKey || '').split('-');
        let dtStart = '';
        let dtEnd = '';
        let dtName = '';
        if (y && m) {
          const dt = new Date(Number(y), Number(m) - 1, 1);
          dtName = dt.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
          const lastDay = new Date(Number(y), Number(m), 0).getDate();
          dtStart = `${y}-${m}-01`;
          dtEnd = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
        }
        return {
          id: generateUUID(),
          name: dtName || 'Período Legado',
          startDate: dtStart,
          endDate: dtEnd,
          monthKey: e.monthKey,
          budget: e.budget ?? 0,
          forecast: e.forecast ?? 0,
          measured: e.measured ?? 0
        };
      }
      return {
        ...e,
        budget: e.budget ?? 0,
        forecast: e.forecast ?? 0,
        measured: e.measured ?? 0
      };
    }));
    setAddenda(data.addenda);
    setIsDirty(false);
    setSaved(false);
  }, [projectId, contractData]);

  const markDirty = () => { setIsDirty(true); setSaved(false); };

  // ── Computed: addenda totals ───────────────────────────────────────────────
  const totalAddedDays = useMemo(
    () => addenda.reduce((s, a) => s + (a.addedDays ?? 0), 0),
    [addenda]
  );
  const totalAddedValue = useMemo(
    () => addenda.reduce((s, a) => s + (a.addedValue ?? 0), 0),
    [addenda]
  );
  const adjustedEndDate = useMemo(
    () => addDaysToDate(endDate, totalAddedDays),
    [endDate, totalAddedDays]
  );
  const originalDuration = diffDays(startDate, endDate);
  const adjustedDuration = originalDuration + totalAddedDays;
  const totalContractValue = parseBRL(contractValue) + totalAddedValue;

  // ── Monthly totals ─────────────────────────────────────────────────────────
  const totalBudget = monthlyEntries.reduce((s, e) => s + e.budget, 0);
  const totalForecast = monthlyEntries.reduce((s, e) => s + e.forecast, 0);
  const totalMeasured = monthlyEntries.reduce((s, e) => s + (e.measured ?? 0), 0);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCellChange = useCallback(
    (id: string, field: 'budget' | 'forecast' | 'measured' | 'startDate' | 'endDate', raw: string) => {
      setMonthlyEntries(prev =>
        prev.map(e => {
           if (e.id !== id) return e;
           if (field === 'startDate' || field === 'endDate') {
              return { ...e, [field]: raw };
           }
           return { ...e, [field]: parseBRL(raw) };
        })
      );
      markDirty();
    },
    []
  );

  const handleGeneratePeriods = () => {
    if (!startDate || !adjustedEndDate) return;
    
    const dates = [];
    let current = new Date(startDate + 'T00:00:00');
    current.setDate(1); // start of month
    
    const end = new Date(adjustedEndDate + 'T00:00:00');
    const endLimit = new Date(end.getFullYear(), end.getMonth(), 1);

    while (current <= endLimit) {
      dates.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }

    const generatedIds = new Set<string>();
    const newEntries = dates.map(d => {
       const mName = d.toLocaleString('pt-BR', { month: 'long' }) + ' de ' + d.getFullYear();
       const standardName = mName.charAt(0).toUpperCase() + mName.slice(1);
       
       const existing = monthlyEntries.find(e => e.name.toLowerCase() === standardName.toLowerCase());
       if (existing) {
          generatedIds.add(existing.id);
          return { ...existing, name: standardName };
       }
       
       const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
       const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
       const id = generateUUID();
       generatedIds.add(id);
       
       return {
          id,
          name: standardName,
          startDate: start,
          endDate: lastDay,
          budget: 0,
          forecast: 0,
          measured: 0
       };
    });
    
    const preserved = monthlyEntries.filter(e => !generatedIds.has(e.id));
    const allEntries = [...newEntries, ...preserved].sort((a, b) => a.startDate.localeCompare(b.startDate));
    
    setMonthlyEntries(allEntries);
    markDirty();
  };

  const handleAddNextPeriod = () => {
    let nextDate: Date;
    if (monthlyEntries.length > 0) {
      const maxStartStr = monthlyEntries.reduce((max, entry) => entry.startDate > max ? entry.startDate : max, monthlyEntries[0].startDate);
      const lastDate = new Date(maxStartStr + 'T00:00:00');
      nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1);
    } else {
      nextDate = startDate ? new Date(startDate + 'T00:00:00') : new Date();
      nextDate.setDate(1);
    }
    
    const mName = nextDate.toLocaleString('pt-BR', { month: 'long' }) + ' de ' + nextDate.getFullYear();
    const standardName = mName.charAt(0).toUpperCase() + mName.slice(1);
    
    const start = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).toISOString().slice(0, 10);
    
    const newEntry = {
       id: generateUUID(),
       name: standardName,
       startDate: start,
       endDate: lastDay,
       budget: 0,
       forecast: 0,
       measured: 0
    };
    
    setMonthlyEntries(prev => {
       const all = [...prev, newEntry];
       return all.sort((a, b) => a.startDate.localeCompare(b.startDate));
    });
    markDirty();
  };

  const handleDeletePeriod = (id: string) => {
    setMonthlyEntries(prev => prev.filter(e => e.id !== id));
    markDirty();
  };

  const handleAddAddendum = (a: Omit<ContractAddendum, 'id' | 'createdAt'>) => {
    const newA: ContractAddendum = {
      ...a,
      id: generateUUID(),
      createdAt: new Date().toISOString(),
    };
    setAddenda(prev => [...prev, newA]);
    setShowAddendumModal(false);
    markDirty();
  };

  const handleDeleteAddendum = (id: string) => {
    setAddenda(prev => prev.filter(a => a.id !== id));
    markDirty();
  };

  const handleSave = () => {
    if (!projectId) return;
    const data: ContractData = {
      projectId,
      contractValue: parseBRL(contractValue),
      contractStartDate: startDate,
      contractEndDate: endDate,
      monthlyEntries,
      addenda,
      updatedAt: new Date().toISOString(),
    };
    onSave(data);
    setIsDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // ── Addendum type label ───────────────────────────────────────────────────
  const addendumTypeLabel = (type: AddendumType) => {
    const map: Record<AddendumType, string> = {
      TIME: 'Prazo',
      VALUE: 'Valor',
      TIME_AND_VALUE: 'Prazo + Valor',
    };
    return map[type];
  };

  const addendumTypeBadgeColor = (type: AddendumType) => {
    if (type === 'TIME') return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
    if (type === 'VALUE') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  };

  if (!project) {
    return (
      <div className="glass-panel p-12 rounded-3xl border border-white/5 text-center bg-white/[0.02] border-dashed">
        <Info className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-30" />
        <p className="text-slate-500 font-medium">Selecione uma obra para ver os dados do contrato.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">

      {/* ── Save bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-2 text-emerald-400 text-sm font-medium animate-fade-in">
              <CheckCircle2 className="w-4 h-4" /> Salvo com sucesso
            </span>
          )}
          {isDirty && !saved && (
            <span className="flex items-center gap-2 text-amber-400 text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5" /> Alterações não salvas
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            isDirty
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-600/20'
              : 'bg-white/5 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Save className="w-4 h-4" />
          Salvar Dados do Contrato
        </button>
      </div>

      {/* ── Section A: Informações Gerais ── */}
      <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-5">
        <h3 className="text-white font-bold text-base flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          Informações Gerais do Contrato
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Valor contratual original */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-2">
              Valor Original do Contrato (R$)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={contractValue}
              onChange={e => { setContractValue(e.target.value); markDirty(); }}
              placeholder="Ex: 2.500.000"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/50 outline-none"
            />
          </div>

          {/* Data início */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-2">
              Data de Início
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); markDirty(); }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
            />
          </div>

          {/* Data término original */}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-2">
              Término Original
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); markDirty(); }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
            />
          </div>
        </div>

        {/* KPI cards */}
        {startDate && endDate && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Prazo Original</p>
              <p className="text-xl font-bold text-white">{originalDuration} <span className="text-sm text-slate-400 font-normal">dias</span></p>
            </div>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Prazo Total (c/ aditivos)</p>
              <p className={`text-xl font-bold ${totalAddedDays > 0 ? 'text-amber-300' : 'text-white'}`}>
                {adjustedDuration} <span className="text-sm text-slate-400 font-normal">dias</span>
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Valor Original</p>
              <p className="text-xl font-bold text-white">{fmtBRL(parseBRL(contractValue))}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Valor Total (c/ aditivos)</p>
              <p className={`text-xl font-bold ${totalAddedValue > 0 ? 'text-emerald-300' : 'text-white'}`}>
                {fmtBRL(totalContractValue)}
              </p>
            </div>
          </div>
        )}

        {/* Adjusted end date hint */}
        {totalAddedDays > 0 && adjustedEndDate && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded-xl px-4 py-2.5">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span>Término previsto (com aditivos de prazo): <strong>{new Date(adjustedEndDate + 'T00:00:00').toLocaleDateString('pt-BR')}</strong> — {totalAddedDays} dias adicionados</span>
          </div>
        )}
      </div>

      {/* ── Section B: Budget & Forecast Mensal ── */}
      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            Budget & Forecast por Período
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddNextPeriod}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-white/10 transition-all hover:border-white/20"
            >
              <Plus className="w-4 h-4" />
              Adicionar Próximo Mês
            </button>
            <button
              onClick={handleGeneratePeriods}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-sm font-semibold border border-blue-500/30 transition-all hover:border-blue-400/50"
            >
              <Calendar className="w-4 h-4" />
              Gerar Meses do Contrato
            </button>
          </div>
        </div>

        {monthlyEntries.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="sticky left-0 z-10 py-3 px-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-900/95 whitespace-nowrap border-r border-white/5 min-w-[180px]">
                    Período de Medição
                  </th>
                  <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-widest text-blue-400 bg-slate-900/80 whitespace-nowrap min-w-[160px]">
                    Budget (R$)
                  </th>
                  <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-slate-900/80 whitespace-nowrap min-w-[160px]">
                    Forecast (R$)
                  </th>
                  <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-slate-900/80 whitespace-nowrap min-w-[160px]">
                    Medição (R$)
                  </th>
                  <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800/80 whitespace-nowrap min-w-[120px]">
                    Budget Acum.
                  </th>
                  <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800/80 whitespace-nowrap min-w-[120px]">
                    Forecast Acum.
                  </th>
                  <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800/80 whitespace-nowrap min-w-[120px]">
                    Medição Acum.
                  </th>
                  <th className="py-3 px-5 text-[10px] bg-slate-800/80 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let cumBudget = 0;
                  let cumForecast = 0;
                  let cumMeasured = 0;
                  return monthlyEntries.map((entry, idx) => {
                    cumBudget += entry.budget;
                    cumForecast += entry.forecast;
                    cumMeasured += entry.measured ?? 0;
                    return (
                      <tr
                        key={entry.id}
                        className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
                          idx % 2 === 0 ? 'bg-slate-900/10' : 'bg-slate-900/30'
                        }`}
                      >
                        <td className="sticky left-0 z-10 py-2.5 px-5 text-sm font-medium text-slate-200 bg-inherit border-r border-white/5 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className="capitalize font-bold text-white">{entry.name}</span>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-normal">
                               <input 
                                 type="date" 
                                 defaultValue={entry.startDate} 
                                 onBlur={e => handleCellChange(entry.id, 'startDate', e.target.value)}
                                 className="bg-slate-950/50 border border-white/10 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all cursor-text text-slate-400 w-24"
                               />
                               <span>até</span>
                               <input 
                                 type="date" 
                                 defaultValue={entry.endDate} 
                                 onBlur={e => handleCellChange(entry.id, 'endDate', e.target.value)}
                                 className="bg-slate-950/50 border border-white/10 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all cursor-text text-slate-400 w-24"
                               />
                            </div>
                          </div>
                        </td>
                        <td className="py-1.5 px-5">
                          <input
                            type="text"
                            inputMode="numeric"
                            key={`budget_${entry.id}`}
                            defaultValue={entry.budget !== 0 ? fmtBRLInput(entry.budget) : ''}
                            placeholder="—"
                            onBlur={e => handleCellChange(entry.id, 'budget', e.target.value)}
                            className="w-full bg-transparent text-sm text-slate-300 placeholder:text-slate-700 focus:bg-blue-600/10 focus:ring-1 focus:ring-blue-500/40 rounded-lg px-2 py-1.5 outline-none text-right transition-all hover:bg-white/5"
                          />
                        </td>
                        <td className="py-1.5 px-5">
                          <input
                            type="text"
                            inputMode="numeric"
                            key={`forecast_${entry.id}`}
                            defaultValue={entry.forecast !== 0 ? fmtBRLInput(entry.forecast) : ''}
                            placeholder="—"
                            onBlur={e => handleCellChange(entry.id, 'forecast', e.target.value)}
                            className="w-full bg-transparent text-sm text-slate-300 placeholder:text-slate-700 focus:bg-emerald-600/10 focus:ring-1 focus:ring-emerald-500/40 rounded-lg px-2 py-1.5 outline-none text-right transition-all hover:bg-white/5"
                          />
                        </td>
                        <td className="py-1.5 px-5">
                          <input
                            type="text"
                            inputMode="numeric"
                            key={`measured_${entry.id}`}
                            defaultValue={entry.measured !== 0 ? fmtBRLInput(entry.measured) : ''}
                            placeholder="—"
                            onBlur={e => handleCellChange(entry.id, 'measured', e.target.value)}
                            className="w-full bg-transparent text-sm text-slate-300 placeholder:text-slate-700 focus:bg-amber-600/10 focus:ring-1 focus:ring-amber-500/40 rounded-lg px-2 py-1.5 outline-none text-right transition-all hover:bg-white/5"
                          />
                        </td>
                        <td className="py-2.5 px-5 text-right text-xs font-mono text-slate-400 bg-slate-800/20 whitespace-nowrap">
                          {cumBudget > 0 ? fmtBRL(cumBudget) : <span className="text-slate-700">—</span>}
                        </td>
                        <td className="py-2.5 px-5 text-right text-xs font-mono text-slate-400 bg-slate-800/20 whitespace-nowrap">
                          {cumForecast > 0 ? fmtBRL(cumForecast) : <span className="text-slate-700">—</span>}
                        </td>
                        <td className="py-2.5 px-5 text-right text-xs font-mono text-slate-400 bg-slate-800/20 whitespace-nowrap">
                          {cumMeasured > 0 ? fmtBRL(cumMeasured) : <span className="text-slate-700">—</span>}
                        </td>
                        <td className="py-2.5 px-3 bg-slate-800/20 text-center">
                          <button
                            onClick={() => handleDeletePeriod(entry.id)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                            title="Remover período"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 bg-slate-800/60">
                  <td className="sticky left-0 z-10 py-3 px-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800/80 border-r border-white/5 whitespace-nowrap">
                    Total
                  </td>
                  <td className="py-3 px-5 text-right text-sm font-bold font-mono text-blue-300 whitespace-nowrap">
                    {totalBudget > 0 ? fmtBRL(totalBudget) : <span className="text-slate-600">R$ —</span>}
                  </td>
                  <td className="py-3 px-5 text-right text-sm font-bold font-mono text-emerald-300 whitespace-nowrap">
                    {totalForecast > 0 ? fmtBRL(totalForecast) : <span className="text-slate-600">R$ —</span>}
                  </td>
                  <td className="py-3 px-5 text-right text-sm font-bold font-mono text-amber-300 whitespace-nowrap">
                    {totalMeasured > 0 ? fmtBRL(totalMeasured) : <span className="text-slate-600">R$ —</span>}
                  </td>
                  <td colSpan={4} className="py-3 px-5 bg-slate-800/40" />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Calendar className="w-8 h-8 text-slate-700 mx-auto mb-3 opacity-40" />
            <p className="text-slate-500 text-sm">Nenhum período de medição cadastrado. Clique no botão acima para adicionar.</p>
          </div>
        )}
      </div>

      {/* ── Section C: Aditivos Contratuais ── */}
      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-violet-400" />
            Aditivos Contratuais
            {addenda.length > 0 && (
              <span className="text-xs bg-violet-500/15 text-violet-300 border border-violet-500/30 rounded-full px-2 py-0.5">
                {addenda.length}
              </span>
            )}
          </h3>
          <button
            onClick={() => setShowAddendumModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-sm font-semibold border border-violet-500/30 transition-all hover:border-violet-400/50"
          >
            <Plus className="w-4 h-4" />
            Adicionar Aditivo
          </button>
        </div>

        <div className="divide-y divide-white/5">
          {addenda.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-8 h-8 text-slate-700 mx-auto mb-3 opacity-40" />
              <p className="text-slate-500 text-sm">Nenhum aditivo registrado.</p>
            </div>
          ) : (
            addenda.map((a, idx) => (
              <div key={a.id} className="flex items-start gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-400">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${addendumTypeBadgeColor(a.type)}`}>
                      {addendumTypeLabel(a.type)}
                    </span>
                    <span className="text-white text-sm font-medium">{a.description}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                    {a.addedDays != null && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> +{a.addedDays} dias</span>
                    )}
                    {a.addedValue != null && (
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> +{fmtBRL(a.addedValue)}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Aprovado em {new Date(a.approvedAt + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteAddendum(a.id)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
                  title="Remover aditivo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Totals summary */}
        {addenda.length > 0 && (
          <div className="px-6 py-3 border-t border-white/5 bg-slate-800/40 flex items-center gap-6 flex-wrap">
            {totalAddedDays > 0 && (
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-violet-400" />
                Total de prazo adicionado: <strong className="text-violet-300 ml-1">+{totalAddedDays} dias</strong>
              </span>
            )}
            {totalAddedValue > 0 && (
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Total de valor adicionado: <strong className="text-emerald-300 ml-1">+{fmtBRL(totalAddedValue)}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddendumModal && (
        <AddendumModal
          onConfirm={handleAddAddendum}
          onClose={() => setShowAddendumModal(false)}
        />
      )}
    </div>
  );
};
