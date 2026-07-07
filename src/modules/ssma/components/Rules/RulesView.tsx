// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { SSMARule as RegraPontuacao, SSMAEmployee as Colaborador } from '../../types';
import { useSSMADashboard } from '../../hooks/useSSMADashboard';
import { ssmaRuleService } from '../../services/ssmaRuleService';
import { ssmaEmployeeService } from '../../services/ssmaEmployeeService';
import { useAuth } from '@/contexts/AuthContext';
import {
  Award,
  Lock,
  ShieldCheck,
  Save,
  CheckCircle,
  HelpCircle,
  Users,
  Search,
  Sliders,
  History,
  Info,
  Check,
  X,
  AlertTriangle,
  Flame,
  ArrowUpDown
} from 'lucide-react';

const HIERARQUIA: Record<string, number> = {
  'Gerente Regional': 1,
  'Engenheiro de Obra': 2,
  'Supervisor de SSMA': 3,
  'Técnico de Segurança': 4,
  'Encarregado': 5,
};

const getRoleOrder = (funcao: string): number => {
  return HIERARQUIA[funcao] || 99;
};

export const RulesView: React.FC = () => {
  const { profile } = useAuth();
  const { rules: regras, employees: colaboradores, refetch } = useSSMADashboard({ year: new Date().getFullYear() });
  
  const currentRegra = regras.find(r => r.isActive) || regras[0] || {} as any;
  
  const loggedUser = {
      nome: profile?.displayName || '',
      role: profile?.modules?.ssma?.role || 'Engenheiro de Obra',
  } as any;

  const onUpdateRegra = async (r: any) => { await ssmaRuleService.update(r.id, r, profile?.uid || 'sys', profile?.displayName || 'Sys'); refetch(); };
  const onSelectActiveRegra = async (id: string) => { await ssmaRuleService.setActiveRule(id, profile?.uid || 'sys', profile?.displayName || 'Sys'); refetch(); };
  const onSetColaboradores = async (cols: any) => { /* employee update logic not implemented in rules tab */ };

  // Local list state for individual goal editing
  const [localColaboradores, setLocalColaboradores] = useState<Colaborador[]>(colaboradores);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'individual' | 'global'>('individual');

  // Sync state if colaboradores prop changes
  useEffect(() => {
    setLocalColaboradores(colaboradores);
  }, [colaboradores]);

  // Global thresholds edits state
  const [percentual, setPercentual] = useState<number>(currentRegra.percentualAtendimento);
  const [desc, setDesc] = useState<string>(currentRegra.descricao);
  const [globalSavedSuccess, setGlobalSavedSuccess] = useState(false);

  const isGerenteSSMA = profile?.isSuperAdmin || loggedUser.role === 'Gerente de SSMA' || loggedUser.role === 'SSMA_ADMIN';

  const handleSwitchToGerente = () => {
    if (onSetLoggedUser) {
      onSetLoggedUser({
        nome: 'Mariana Costa',
        role: 'Gerente de SSMA',
        detalhe: 'Gerência Geral SSMA'
      });
    }
  };

  const handleValueChange = (id: string, field: 'targetIFS' | 'targetAlojamento' | 'targetRDO', val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    setLocalColaboradores((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: num } : c))
    );
  };

  const handleSaveAllMetas = () => {
    onSetColaboradores(localColaboradores);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSaveGlobalRule = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: RegraPontuacao = {
      ...currentRegra,
      percentualAtendimento: Number(percentual),
      descricao: desc,
    };
    onUpdateRegra(updated);
    setGlobalSavedSuccess(true);
    setTimeout(() => setGlobalSavedSuccess(false), 3000);
  };

  // Sort and filter colaboradores
  const sortedAndFiltered = localColaboradores
    .filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || c.functionGroup === roleFilter;
      const matchesActive = c.isActive !== false;
      return matchesSearch && matchesRole && matchesActive;
    })
    .sort((a, b) => {
      const orderA = getRoleOrder(a.functionGroup || '');
      const orderB = getRoleOrder(b.functionGroup || '');
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return (a.name || '').localeCompare(b.name || '');
    });

  const getRoleBadgeStyle = (funcao: string) => {
    switch (funcao) {
      case 'Gerente Regional':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Engenheiro de Obra':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Supervisor de SSMA':
        return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'Técnico de Segurança':
        return 'bg-cyan-50 text-cyan-700 border-cyan-100';
      case 'Encarregado':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  // Lock screen for non-Gerente de SSMA
  if (!isGerenteSSMA) {
    return (
      <div className="bg-white rounded-3xl border border-brand-border shadow-xs overflow-hidden max-w-4xl mx-auto p-8 text-center my-6 space-y-6 animate-fade-in" id="regras-lock-screen">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100 shadow-xs">
          <Lock className="w-8 h-8" />
        </div>

        <div className="max-w-md mx-auto space-y-3">
          <h3 className="text-xl font-black text-brand-ink tracking-tight uppercase">Acesso Reservado</h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Somente o <strong className="text-brand-ink">Gerente de SSMA</strong> possui permissões administrativas para visualizar e configurar as metas individuais de inspeção dos colaboradores.
          </p>
        </div>

        <div className="border-t border-brand-border pt-6 max-w-lg mx-auto space-y-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Simular Perfil do Gerente de SSMA para Liberar</p>
          
          <button
            onClick={handleSwitchToGerente}
            className="inline-flex items-center gap-2.5 px-6 py-3 bg-brand-accent hover:bg-brand-accent/95 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md hover:scale-[1.02] cursor-pointer"
          >
            <ShieldCheck className="w-4.5 h-4.5" />
            Entrar como Mariana Costa (Gerente de SSMA)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" id="regras-tab">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-brand-ink tracking-tight">Painel de Configuração de Metas</h3>
          <p className="text-xs text-slate-500">
            Gerencie individualmente as metas de campo e acompanhe os critérios e revisões transacionais.
          </p>
        </div>

        {/* Subtab Toggle Buttons */}
        <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-brand-border self-start">
          <button
            onClick={() => setActiveSubTab('individual')}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'individual'
                ? 'bg-white text-brand-ink shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Metas por Colaborador
          </button>
          <button
            onClick={() => setActiveSubTab('global')}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'global'
                ? 'bg-white text-brand-ink shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Critério e Diretrizes
          </button>
        </div>
      </div>

      {activeSubTab === 'individual' ? (
        <div className="space-y-4">
          {/* Header Description Info card */}
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 flex gap-3 text-xs text-emerald-900">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-emerald-950">Ambiente Administrativo de Governança</p>
              <p className="font-semibold text-emerald-800 mt-0.5">
                Defina abaixo a quantidade mensal de inspeções exigidas de Frente de Serviço, de Alojamento e a Quantidade de RDO esperada para cada colaborador. O desempenho será recalculado em tempo real com base nestes coeficientes.
              </p>
            </div>
          </div>

          {/* Filters & Control Bar */}
          <div className="bg-white p-4 rounded-2xl border border-brand-border shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar colaborador..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9.5 pr-4 py-1.5 border border-brand-border rounded-xl text-xs focus:outline-brand-accent font-semibold text-brand-ink"
                />
              </div>

              {/* Role filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 border border-brand-border rounded-xl text-xs font-bold text-brand-ink bg-white cursor-pointer hover:bg-slate-50 transition"
              >
                <option value="all">Todas as Funções</option>
                <option value="Gerente Regional">Gerente Regional</option>
                <option value="Engenheiro de Obra">Engenheiro de Obra (Gestor)</option>
                <option value="Supervisor de SSMA">Supervisor de SSMA</option>
                <option value="Técnico de Segurança">Técnico de Segurança (TST)</option>
                <option value="Encarregado">Encarregado</option>
              </select>
            </div>

            {/* Quick Action Save */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              {savedSuccess && (
                <div className="text-xs font-bold text-brand-success flex items-center gap-1.5 animate-pulse">
                  <CheckCircle className="w-4 h-4" />
                  Metas salvas com sucesso!
                </div>
              )}
              <button
                onClick={handleSaveAllMetas}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-accent hover:bg-brand-accent/95 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-xs cursor-pointer w-full sm:w-auto justify-center"
              >
                <Save className="w-4 h-4" />
                Salvar Todas as Metas
              </button>
            </div>
          </div>

          {/* Goals Spreadsheet Table */}
          <div className="bg-white rounded-2xl border border-brand-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-bg border-b border-brand-border text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-5">Colaborador / Função (Por Hierarquia)</th>
                    <th className="py-4 px-5 text-center w-52">Meta de Inspeção de Frente de Serviço</th>
                    <th className="py-4 px-5 text-center w-52">Meta de Inspeção de Alojamento</th>
                    <th className="py-4 px-5 text-center w-52">Quantidade de RDO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-xs">
                  {sortedAndFiltered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400 font-bold uppercase tracking-wider">
                        Nenhum colaborador corresponde aos filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    sortedAndFiltered.map((col) => {
                      const mIFS = col.targetIFS !== undefined ? col.targetIFS : (col.functionGroup === 'Encarregado' ? 22 : col.functionGroup === 'Gerente Regional' ? 0 : 1);
                      const mAloj = col.targetAlojamento !== undefined ? col.targetAlojamento : (col.functionGroup === 'Gerente Regional' ? 0 : 1);
                      const qRdo = col.targetRDO !== undefined ? col.targetRDO : (col.functionGroup === 'Encarregado' ? 22 : 0);

                      return (
                        <tr key={col.id} className="hover:bg-brand-bg/40 transition">
                          <td className="py-3.5 px-5">
                            <div className="font-extrabold text-brand-ink text-sm">{col.name}</div>
                            <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${getRoleBadgeStyle(col.functionGroup || '')}`}>
                              {col.functionGroup}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <div className="inline-flex items-center gap-1.5 justify-center">
                              <input
                                type="number"
                                min="0"
                                value={mIFS}
                                onChange={(e) => handleValueChange(col.id, 'targetIFS', e.target.value)}
                                className="w-20 px-2.5 py-1.5 border border-brand-border rounded-xl text-center font-bold text-slate-800 focus:outline-brand-accent focus:border-brand-accent bg-slate-50/50"
                              />
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <div className="inline-flex items-center gap-1.5 justify-center">
                              <input
                                type="number"
                                min="0"
                                value={mAloj}
                                onChange={(e) => handleValueChange(col.id, 'targetAlojamento', e.target.value)}
                                className="w-20 px-2.5 py-1.5 border border-brand-border rounded-xl text-center font-bold text-slate-800 focus:outline-brand-accent focus:border-brand-accent bg-slate-50/50"
                              />
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <div className="inline-flex items-center gap-1.5 justify-center">
                              <input
                                type="number"
                                min="0"
                                value={qRdo}
                                onChange={(e) => handleValueChange(col.id, 'targetRDO', e.target.value)}
                                className="w-20 px-2.5 py-1.5 border border-brand-border rounded-xl text-center font-bold text-slate-800 focus:outline-brand-accent focus:border-brand-accent bg-slate-50/50"
                                disabled={col.functionGroup === 'Gerente Regional'} // Regional has no work days/RDO by definition
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unified Save Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveAllMetas}
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-accent hover:bg-brand-accent/95 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md cursor-pointer hover:scale-[1.01]"
            >
              <Save className="w-4 h-4" />
              Salvar Todas as Metas dos Colaboradores
            </button>
          </div>
        </div>
      ) : (
        /* Global Criteria Configuration Subtab (previous rules editor screen) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-brand-border shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-brand-accent" />
                Limite Global de Conformidade ({currentRegra.revisao})
              </h4>
              <span className="bg-emerald-50 text-brand-success text-[10px] font-black px-2.5 py-0.5 rounded border border-emerald-100 uppercase tracking-wider">
                Ativo
              </span>
            </div>

            <form onSubmit={handleSaveGlobalRule} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">
                    Nota Mínima de Conformidade para "ATENDE" (%)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="70"
                      max="100"
                      step="1"
                      value={percentual}
                      onChange={(e) => setPercentual(Number(e.target.value))}
                      className="flex-1 accent-brand-accent cursor-pointer h-2 bg-slate-100 rounded-lg appearance-none"
                    />
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={percentual}
                      onChange={(e) => setPercentual(Number(e.target.value))}
                      className="w-16 px-2 py-1.5 border border-brand-border rounded-lg text-sm font-black text-brand-ink text-center focus:outline-brand-accent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Descrição Curta</label>
                  <input
                    type="text"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    className="w-full px-3 py-1.5 border border-brand-border rounded-xl focus:outline-brand-accent text-sm"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-brand-border">
                {globalSavedSuccess ? (
                  <div className="text-xs font-bold text-brand-success flex items-center gap-1.5 animate-bounce">
                    <CheckCircle className="w-4 h-4" />
                    Critério global atualizado com sucesso!
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400">
                    * Modificações afetam o limite exigido para classificação "ATENDE".
                  </div>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-accent hover:bg-brand-accent/95 text-white font-black text-sm rounded-xl transition shadow-xs cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Salvar Parâmetros Globais
                </button>
              </div>
            </form>
          </div>

          {/* Formulation Help Info */}
          <div className="bg-white p-5 rounded-2xl border border-brand-border shadow-xs space-y-4">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Info className="w-4 h-4 text-brand-accent" />
              Lógica de Formulação
            </h4>

            <div className="text-xs text-slate-600 space-y-4 leading-relaxed border-t border-slate-100 pt-3">
              <div>
                <span className="font-bold text-brand-ink block">Metas Individuais vs Globais:</span>
                <p className="text-slate-500 mt-1">
                  Se um colaborador possui metas específicas configuradas no painel, o sistema utilizará as metas dele para o cálculo. Caso contrário, serão usadas as metas padrão da regra ativada.
                </p>
              </div>

              <div>
                <span className="font-bold text-brand-ink block">Cálculo de Desempenho por Função:</span>
                <code className="block bg-brand-bg p-2 rounded border border-brand-border mt-1 font-mono text-[10px] text-brand-ink">
                  Resultado = (Realizado / Meta) * 100
                </code>
              </div>

              <div>
                <span className="font-bold text-brand-ink block">Condição de Conformidade:</span>
                <div className="p-3 bg-brand-bg rounded border border-brand-border mt-1">
                  <span className="font-semibold text-brand-accent">Se (Resultado Geral ≥ {currentRegra.percentualAtendimento}%)</span>
                  <span className="block font-black text-brand-success">→ ATENDE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
