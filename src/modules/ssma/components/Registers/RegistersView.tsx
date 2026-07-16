import React, { useState, useEffect } from 'react';
import { 
  SSMAEmployee,
  SSMACostCenter,
  SSMARegional,
  SSMAFunctionGroup
} from '../../types';
import {
  Plus,
  Trash2,
  Tag,
  Landmark,
  User,
  Settings,
  Check,
  Users,
  Briefcase,
  ShieldCheck,
  Building2,
  MapPin,
  Calendar,
  Layers,
  Loader2,
  Power
} from 'lucide-react';
import { useSSMAEmployees } from '../../hooks/useSSMAEmployees';
import { useSSMARegionals } from '../../hooks/useSSMARegionals';
import { useSSMACostCenters } from '../../hooks/useSSMACostCenters';
import { useSSMAForemen } from '../../hooks/useSSMAForemen';
import { useAuth } from '@/contexts/AuthContext';
import { canManageSSMARegisters } from '../../domain/permissions';
import { ChecklistUpload } from '../Settings/ChecklistUpload';
import { CreateForemanModal } from './CreateForemanModal';

type SubTabType = 'colaboradores' | 'encarregados' | 'regionais' | 'obras' | 'checklist';

type FuncaoLabel = 'Gerente Regional' | 'Gestor de Obra' | 'Supervisor de SSMA' | 'Técnico de Segurança' | 'Encarregado';

const mapFunctionGroupToFuncao = (fg: SSMAFunctionGroup): FuncaoLabel => {
  switch (fg) {
    case 'MANAGER': return 'Gerente Regional';
    case 'SITE_MANAGER': return 'Gestor de Obra';
    case 'SUPERVISOR': return 'Supervisor de SSMA';
    case 'TECHNICIAN': return 'Técnico de Segurança';
    case 'FOREMAN': return 'Encarregado';
    default: return 'Técnico de Segurança';
  }
};

// Local interfaces mapping to old prototype types
export interface Colaborador {
  id: string;
  uid?: string;
  nome: string;
  funcao: FuncaoLabel;
  ativo: boolean;
}

export interface Regional {
  id: string;
  nome: string;
  responsavelId?: string;
  ativo: boolean;
}

export interface ForemanLocal {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface CostCenter {
  id: string;
  codigo: string;
  nome: string;
  regionalId: string;
  engenheiroId?: string;
  supervisorId?: string;
  tstIds?: string[];
  encarregadoIds?: string[];
  ativo: boolean;
}

export default function RegistersView() {
  const { profile } = useAuth();
  const canManage = canManageSSMARegisters(profile);
  
  const { data: dbColaboradores, refetch: refetchEmp, loading: empLoading } = useSSMAEmployees();
  const { data: dbRegionals, create: createRegional, update: updateRegional, disable: disableRegional, remove: removeRegional, loading: regLoading } = useSSMARegionals();
  const { data: dbCostCenters, create: createCostCenter, update: updateCostCenter, disable: disableCostCenter, remove: removeCostCenter, loading: ccLoading } = useSSMACostCenters();
  const { data: dbForemen, create: createForeman, update: updateForeman, disable: disableForeman, remove: removeForeman, loading: foremenLoading } = useSSMAForemen();

  const loading = empLoading || regLoading || ccLoading || foremenLoading;

  // Local state to simulate synchronous updates while waiting for refresh
  const [colaboradores, setLocalColabs] = useState<Colaborador[]>([]);
  const [regionals, setLocalRegs] = useState<Regional[]>([]);
  const [costCenters, setLocalCcs] = useState<CostCenter[]>([]);
  const [foremen, setLocalForemen] = useState<ForemanLocal[]>([]);
  
  const [isCreateForemanOpen, setIsCreateForemanOpen] = useState(false);

  useEffect(() => {
    setLocalColabs(dbColaboradores.map(c => ({
      id: c.id,
      uid: c.uid,
      nome: c.name,
      funcao: mapFunctionGroupToFuncao(c.functionGroup),
      ativo: c.active !== false
    })));
  }, [dbColaboradores]);

  useEffect(() => {
    setLocalRegs(dbRegionals.map(r => ({
      id: r.id,
      nome: r.name,
      responsavelId: r.responsavelId,
      ativo: r.active !== false
    })));
  }, [dbRegionals]);

  useEffect(() => {
    setLocalForemen(dbForemen.map(f => ({
      id: f.id,
      nome: f.name,
      ativo: f.active !== false
    })));
  }, [dbForemen]);

  useEffect(() => {
    setLocalCcs(dbCostCenters.map(cc => ({
      id: cc.id,
      codigo: cc.code,
      nome: cc.name,
      regionalId: cc.regionalId,
      engenheiroId: cc.engenheiroId,
      supervisorId: cc.supervisorId,
      tstIds: cc.tstIds || [],
      encarregadoIds: cc.encarregadoIds || [],
      ativo: cc.active !== false
    })));
  }, [dbCostCenters]);

  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('colaboradores');

  // Step 2: Regionals Form state
  const [editingRegId, setEditingRegId] = useState<string | null>(null);
  const [regNome, setRegNome] = useState('');
  const [regResponsavelId, setRegResponsavelId] = useState('');

  // Step 2.5: Foremen Form state
  const [editingForemanId, setEditingForemanId] = useState<string | null>(null);
  const [foremanNome, setForemanNome] = useState('');

  // Step 3: Obras (Cost Centers) Form state
  const [editingObraId, setEditingObraId] = useState<string | null>(null);
  const [obraCodigo, setObraCodigo] = useState('');
  const [obraNome, setObraNome] = useState('');
  const [obraRegionalId, setObraRegionalId] = useState('');
  const [obraEngenheiroId, setObraEngenheiroId] = useState('');
  const [obraSupervisorId, setObraSupervisorId] = useState('');
  const [obraTstIds, setObraTstIds] = useState<string[]>([]);
  const [obraEncarregadoIds, setObraEncarregadoIds] = useState<string[]>([]);

  // Toggle status helpers
  const toggleRegionalStatus = async (id: string) => {
    const r = regionals.find(x => x.id === id);
    if (!r) return;
    if (r.ativo === false) {
       await updateRegional(id, { active: true });
    } else {
       await disableRegional(id, 'Desativado pelo usuário');
    }
    setLocalRegs(prev => prev.map(x => x.id === id ? { ...x, ativo: r.ativo === false ? true : false } : x));
  };

  const toggleForemanStatus = async (id: string) => {
    const f = foremen.find(x => x.id === id);
    if (!f) return;
    if (f.ativo === false) {
       await updateForeman(id, { active: true });
    } else {
       await disableForeman(id, 'Desativado pelo usuário');
    }
    setLocalForemen(prev => prev.map(x => x.id === id ? { ...x, ativo: f.ativo === false ? true : false } : x));
  };

  const toggleObraStatus = async (id: string) => {
    const cc = costCenters.find(x => x.id === id);
    if (!cc) return;
    if (cc.ativo === false) {
       await updateCostCenter(id, { active: true });
    } else {
       await disableCostCenter(id, 'Desativado pelo usuário');
    }
    setLocalCcs(prev => prev.map(x => x.id === id ? { ...x, ativo: cc.ativo === false ? true : false } : x));
  };

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (activeSubTab === 'regionais') {
      if (!regNome.trim()) return;
      if (editingRegId) {
        await updateRegional(editingRegId, {
          name: regNome.trim(),
          responsavelId: regResponsavelId || null
        });
        setLocalRegs(prev => prev.map(r => r.id === editingRegId ? { ...r, nome: regNome.trim(), responsavelId: regResponsavelId || undefined } : r));
        setEditingRegId(null);
      } else {
        const id = await createRegional({ name: regNome.trim(), responsavelId: regResponsavelId || undefined, active: true });
        setLocalRegs(prev => [...prev, { id, nome: regNome.trim(), responsavelId: regResponsavelId || undefined, ativo: true }]);
      }
      setRegNome('');
      setRegResponsavelId('');
    } else if (activeSubTab === 'encarregados') {
      if (!foremanNome.trim()) return;
      if (editingForemanId) {
        await updateForeman(editingForemanId, {
          name: foremanNome.trim()
        });
        setLocalForemen(prev => prev.map(f => f.id === editingForemanId ? { ...f, nome: foremanNome.trim() } : f));
        setEditingForemanId(null);
      } else {
        const id = await createForeman({ name: foremanNome.trim(), active: true });
        setLocalForemen(prev => [...prev, { id, nome: foremanNome.trim(), ativo: true }]);
      }
      setForemanNome('');
    } else if (activeSubTab === 'obras') {
      if (!obraCodigo.trim() || !obraNome.trim() || !obraRegionalId) {
        alert('Por favor, preencha o código, nome da obra e selecione a regional.');
        return;
      }
      const data = {
        code: obraCodigo.trim().toUpperCase(),
        name: obraNome.trim(),
        regionalId: obraRegionalId,
        engenheiroId: obraEngenheiroId || null,
        supervisorId: obraSupervisorId || null,
        tstIds: obraTstIds,
        encarregadoIds: obraEncarregadoIds
      };
      if (editingObraId) {
        await updateCostCenter(editingObraId, data);
        setLocalCcs(prev => prev.map(cc => cc.id === editingObraId ? {
          ...cc,
          codigo: data.code,
          nome: data.name,
          regionalId: data.regionalId,
          engenheiroId: data.engenheiroId,
          supervisorId: data.supervisorId,
          tstIds: data.tstIds,
          encarregadoIds: data.encarregadoIds
        } : cc));
        setEditingObraId(null);
      } else {
        const id = await createCostCenter({ ...data, active: true });
        setLocalCcs(prev => [...prev, {
          id,
          codigo: data.code,
          nome: data.name,
          regionalId: data.regionalId,
          engenheiroId: data.engenheiroId,
          supervisorId: data.supervisorId,
          tstIds: data.tstIds,
          encarregadoIds: data.encarregadoIds,
          ativo: true
        }]);
      }
      // Reset Form
      setObraCodigo('');
      setObraNome('');
      setObraRegionalId('');
      setObraEngenheiroId('');
      setObraSupervisorId('');
      setObraTstIds([]);
      setObraEncarregadoIds([]);
    }
  };

  const startEditRegional = (reg: Regional) => {
    setEditingRegId(reg.id);
    setRegNome(reg.nome);
    setRegResponsavelId(reg.responsavelId || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEditForeman = (f: ForemanLocal) => {
    setEditingForemanId(f.id);
    setForemanNome(f.nome);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEditObra = (cc: CostCenter) => {
    setEditingObraId(cc.id);
    setObraCodigo(cc.codigo);
    setObraNome(cc.nome);
    setObraRegionalId(cc.regionalId);
    setObraEngenheiroId(cc.engenheiroId || '');
    setObraSupervisorId(cc.supervisorId || '');
    setObraTstIds(cc.tstIds || []);
    setObraEncarregadoIds(cc.encarregadoIds || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleHardDeleteRegional = async (id: string) => {
    if (window.confirm('Excluir COMPLETAMENTE esta regional? Esta ação não pode ser desfeita e todas as inspeções vinculadas podem ficar órfãs.')) {
      await removeRegional(id);
      setLocalRegs(prev => prev.filter(item => item.id !== id));
      setLocalCcs(prev => prev.map(cc => cc.regionalId === id ? { ...cc, regionalId: '' } : cc));
    }
  };

  const handleHardDeleteForeman = async (id: string) => {
    if (window.confirm('Excluir COMPLETAMENTE este encarregado? Esta ação não pode ser desfeita.')) {
      await removeForeman(id);
      setLocalForemen(prev => prev.filter(item => item.id !== id));
      setLocalCcs(prev => prev.map(cc => ({
        ...cc,
        encarregadoIds: cc.encarregadoIds?.filter(eid => eid !== id) || []
      })));
    }
  };

  const handleHardDeleteObra = async (id: string) => {
    if (window.confirm('Excluir COMPLETAMENTE esta obra (Centro de Custo)? Esta ação não pode ser desfeita.')) {
      await removeCostCenter(id);
      setLocalCcs(prev => prev.filter(item => item.id !== id));
    }
  };

  return (
    <div className="space-y-6" id="cadastros-tab">
      <div>
        <h3 className="text-xl font-black text-brand-ink tracking-tight">Configurações do Sistema</h3>
        <p className="text-xs text-slate-500">
          Gerencie colaboradores, regionais e obras para estruturar as atribuições e frentes de serviço do sistema.
        </p>
      </div>

      {/* Horizontal Tab Navigation */}
      <div className="bg-white p-1.5 rounded-xl border border-brand-border shadow-xs flex flex-col sm:flex-row gap-1.5">
        <button
          onClick={() => setActiveSubTab('colaboradores')}
          className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition cursor-pointer ${
            activeSubTab === 'colaboradores'
              ? 'bg-blue-600 text-white font-bold shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4.5 h-4.5 shrink-0" />
          <span>Cadastro Colaboradores</span>
          <span className={`ml-1.5 text-xs px-2 py-0.5 rounded-full font-bold ${
            activeSubTab === 'colaboradores' ? 'bg-blue-700/80 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {colaboradores.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('regionais')}
          className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition cursor-pointer ${
            activeSubTab === 'regionais'
              ? 'bg-blue-600 text-white font-bold shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <MapPin className="w-4.5 h-4.5 shrink-0" />
          <span>Cadastro Regionais</span>
          <span className={`ml-1.5 text-xs px-2 py-0.5 rounded-full font-bold ${
            activeSubTab === 'regionais' ? 'bg-blue-700/80 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {regionals.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('encarregados')}
          className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition cursor-pointer ${
            activeSubTab === 'encarregados'
              ? 'bg-blue-600 text-white font-bold shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Briefcase className="w-4.5 h-4.5 shrink-0" />
          <span>Encarregados</span>
          <span className={`ml-1.5 text-xs px-2 py-0.5 rounded-full font-bold ${
            activeSubTab === 'encarregados' ? 'bg-blue-700/80 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {foremen.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('obras')}
          className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition cursor-pointer ${
            activeSubTab === 'obras'
              ? 'bg-blue-600 text-white font-bold shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-4.5 h-4.5 shrink-0" />
          <span>Cadastro de Obras</span>
          <span className={`ml-1.5 text-xs px-2 py-0.5 rounded-full font-bold ${
            activeSubTab === 'obras' ? 'bg-blue-700/80 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {costCenters.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('checklist')}
          className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition cursor-pointer ${
            activeSubTab === 'checklist'
              ? 'bg-blue-600 text-white font-bold shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Settings className="w-4.5 h-4.5 shrink-0" />
          <span>Checklist Excel</span>
        </button>
      </div>

      {/* Form and Records list based on current active step */}
      <div className="space-y-6">
          
          {/* STEP 1: COLLABORATORS PANEL */}
          {activeSubTab === 'colaboradores' && (
            <div className="space-y-6">
              <div className="mb-2">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Gestão de Equipes por Função
                </span>
                <h4 className="text-base font-black text-brand-ink mt-2">Cadastro de Colaboradores</h4>
                <p className="text-xs text-slate-500 mt-1">
                  O quadro de colaboradores é gerido automaticamente pela Gestão de Acessos (IAM). Apenas leitura.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    funcao: 'Gerente Regional' as const,
                    titulo: 'Gerente Regional',
                    subtitulo: 'GREG da Regional',
                    placeholder: 'Ex: João Regional',
                    colorClass: 'purple',
                    icon: User,
                  },
                  {
                    funcao: 'Gestor de Obra' as const,
                    titulo: 'Gestor de Obra',
                    subtitulo: 'Resp. pelo Empreendimento',
                    placeholder: 'Ex: Carlos Gestor',
                    colorClass: 'blue',
                    icon: Briefcase,
                  },
                  {
                    funcao: 'Supervisor de SSMA' as const,
                    titulo: 'Supervisor SSMA',
                    subtitulo: 'Supervisor de Área',
                    placeholder: 'Ex: Maria Supervisor',
                    colorClass: 'amber',
                    icon: ShieldCheck,
                  },
                  {
                    funcao: 'Técnico de Segurança' as const,
                    titulo: 'TST',
                    subtitulo: 'Técnico de Segurança',
                    placeholder: 'Ex: Pedro TST',
                    colorClass: 'emerald',
                    icon: ShieldCheck,
                  }
                ].map((role) => {
                  const filtered = colaboradores.filter((c) => c.funcao === role.funcao);
                  const IconComp = role.icon;
                  const themeColors = {
                    purple: { bg: 'bg-purple-50/70', text: 'text-purple-700', border: 'border-purple-100', accent: 'bg-purple-600 hover:bg-purple-700' },
                    blue: { bg: 'bg-blue-50/70', text: 'text-blue-700', border: 'border-blue-100', accent: 'bg-blue-600 hover:bg-blue-700' },
                    amber: { bg: 'bg-amber-50/70', text: 'text-amber-700', border: 'border-amber-100', accent: 'bg-amber-600 hover:bg-amber-700' },
                    emerald: { bg: 'bg-emerald-50/70', text: 'text-emerald-700', border: 'border-emerald-100', accent: 'bg-emerald-600 hover:bg-emerald-700' },
                    slate: { bg: 'bg-slate-50/70', text: 'text-slate-700', border: 'border-slate-100', accent: 'bg-slate-700 hover:bg-slate-800' },
                  }[role.colorClass as 'purple'|'blue'|'amber'|'emerald'|'slate'];

                  return (
                    <div key={role.funcao} className="bg-white rounded-2xl border border-brand-border shadow-xs flex flex-col h-[520px] overflow-hidden">
                      {/* Column Header */}
                      <div className={`p-4 border-b border-brand-border ${themeColors.bg} flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg bg-white/90 ${themeColors.text} border ${themeColors.border}`}>
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="text-xs font-black text-slate-800 leading-tight">{role.titulo}</h5>
                            <span className="text-[10px] text-slate-500 font-medium leading-none">{role.subtitulo}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-black bg-white/80 text-slate-600 px-1.5 py-0.5 rounded-md border border-brand-border">
                            {filtered.length}
                          </span>
                          {canManage && role.funcao === 'Encarregado' && (
                            <button
                              onClick={() => setIsCreateForemanOpen(true)}
                              title="Adicionar Encarregado"
                              className="p-1 bg-white hover:bg-slate-100 text-slate-600 rounded-md border border-brand-border transition-colors shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Collaborators list */}
                      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1.5 bg-white">
                        {filtered.length === 0 ? (
                          <div className="py-12 text-center text-[11px] text-slate-400 font-medium">
                            Nenhum cadastrado
                          </div>
                        ) : (
                          filtered.map((item) => {
                            const isAtivo = item.ativo !== false;
                            return (
                              <div
                                key={item.id}
                                className={`p-2.5 rounded-xl flex flex-col justify-between hover:bg-slate-50/50 transition border border-transparent ${
                                  !isAtivo ? 'opacity-65 bg-slate-50/30' : 'bg-white border-brand-border shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1 mb-1.5">
                                  <span className={`text-xs font-bold leading-tight break-all ${!isAtivo ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                    {item.nome}
                                  </span>
                                  
                                </div>
                                
                                <div className="flex items-center justify-between gap-1 mt-1">
                                  {/* Status indicator */}
                                  <div className="flex items-center gap-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${isAtivo ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                      {isAtivo ? 'Ativo' : 'Desativado'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 1.5: FOREMEN PANEL */}
          {activeSubTab === 'encarregados' && (
            <div className="space-y-6">
              {canManage && (
                <div className="bg-white p-5 rounded-2xl border border-brand-border shadow-xs">
                  <div className="mb-4">
                    <span className="text-[10px] bg-amber-50 text-amber-700 font-extrabold px-2 py-1 rounded-full uppercase tracking-wider">
                      Cadastro de Encarregados
                    </span>
                    <h4 className="text-base font-black text-brand-ink mt-2">{editingForemanId ? 'Editar Encarregado' : 'Cadastrar Novo Encarregado'}</h4>
                    <p className="text-xs text-slate-500 mt-1">Crie encarregados para que sejam atribuídos às obras e avaliados pelas inspeções de campo.</p>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Nome Completo</label>
                      <input
                        type="text"
                        value={foremanNome}
                        onChange={(e) => setForemanNome(e.target.value)}
                        placeholder="Ex: João da Silva..."
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition"
                      />
                    </div>
                    
                    <div className="flex gap-2 w-full sm:w-auto">
                      {editingForemanId && (
                        <button
                          type="button"
                          onClick={() => { setEditingForemanId(null); setForemanNome(''); }}
                          className="flex-1 sm:flex-none h-10 px-4 flex items-center justify-center rounded-lg font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={!foremanNome.trim()}
                        className="flex-1 sm:flex-none h-10 px-5 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Check className="w-4 h-4" />
                        {editingForemanId ? 'Salvar' : 'Cadastrar'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {foremen.map(f => {
                  const isAtivo = f.ativo !== false;
                  return (
                    <div key={f.id} className={`bg-white rounded-xl border p-3.5 flex flex-col justify-between transition-all group ${!isAtivo ? 'opacity-60 border-slate-200' : 'border-brand-border hover:border-blue-300 hover:shadow-md'}`}>
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className={`text-sm font-black leading-tight break-all ${!isAtivo ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                            {f.nome}
                          </h4>
                          <div className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${isAtivo ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                            {isAtivo ? 'Ativo' : 'Inativo'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => toggleForemanStatus(f.id)}
                          title={isAtivo ? 'Desativar' : 'Reativar'}
                          className={`flex-1 flex items-center justify-center gap-1.5 p-1.5 rounded-lg text-xs font-bold transition-colors ${
                            isAtivo 
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' 
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          {isAtivo ? 'Desativar' : 'Reativar'}
                        </button>
                        
                        {canManage && (
                          <>
                            <button
                              onClick={() => startEditForeman(f)}
                              title="Editar"
                              className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleHardDeleteForeman(f.id)}
                              title="Excluir Permanentemente"
                              className="p-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: REGIONALS PANEL */}
          {activeSubTab === 'regionais' && (
            <div className="space-y-6">
              {canManage && (
                <div className="bg-white p-5 rounded-2xl border border-brand-border shadow-xs">
                  <div className="mb-4">
                    <span className="text-[10px] bg-purple-50 text-purple-700 font-extrabold px-2 py-1 rounded-full uppercase tracking-wider">
                      Regional e Responsável
                    </span>
                    <h4 className="text-base font-black text-brand-ink mt-2">Cadastrar Nova Regional</h4>
                    <p className="text-xs text-slate-500 mt-1">Crie a regional (GREG) e indique quem é o Gerente Regional responsável.</p>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Nome da Regional</label>
                      <input
                        type="text"
                        value={regNome}
                        onChange={(e) => setRegNome(e.target.value)}
                        placeholder="Ex: Regional Norte..."
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Gerente Regional (Opcional)</label>
                      <select
                        value={regResponsavelId}
                        onChange={(e) => setRegResponsavelId(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition"
                      >
                        <option value="">Sem responsável definido...</option>
                        {colaboradores
                          .filter((c) => c.funcao === 'Gerente Regional' && c.ativo !== false)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shrink-0 cursor-pointer w-full sm:w-auto"
                    >
                      <Plus className="w-4 h-4" />
                      {editingRegId ? 'Salvar Alterações' : 'Cadastrar'}
                    </button>
                    {editingRegId && (
                      <button
                        type="button"
                        onClick={() => { setEditingRegId(null); setRegNome(''); setRegResponsavelId(''); }}
                        className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shrink-0 cursor-pointer w-full sm:w-auto"
                      >
                        Cancelar
                      </button>
                    )}
                  </form>
                </div>
              )}

              {/* Regionals List */}
              <div className="bg-white rounded-2xl border border-brand-border shadow-xs overflow-hidden">
                <div className="px-5 py-4 bg-brand-bg border-b border-brand-border flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lista de Regionais</span>
                  <span className="text-xs text-slate-400 font-bold font-mono">
                    {regionals.length} registradas
                  </span>
                </div>

                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {regionals.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-400 font-medium">Nenhuma regional cadastrada. Use o formulário acima para criar uma!</p>
                  ) : (
                    regionals.map((item) => {
                      const resp = colaboradores.find((c) => c.id === item.responsavelId);
                      const isAtivo = item.ativo !== false;
                      return (
                        <div key={item.id} className={`p-4 flex items-center justify-between hover:bg-slate-50/50 transition ${!isAtivo ? 'bg-slate-50/50 opacity-75' : ''}`}>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-sm font-bold ${!isAtivo ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{item.nome}</span>
                              {!isAtivo ? (
                                <span className="bg-rose-50 text-rose-600 border border-rose-100 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">
                                  Inativa
                                </span>
                              ) : (
                                <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">
                                  Ativa
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                              <span className="font-semibold text-slate-400 uppercase text-[10px]">Responsável:</span>
                              {resp ? (
                                <span className="font-bold text-indigo-600">{resp.nome}</span>
                              ) : (
                                <span className="text-rose-500 italic font-semibold text-[11px]">(Nenhum responsável atribuído)</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <button
                              onClick={() => startEditRegional(item)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Editar Regional"
                            >
                              <User className="w-4.5 h-4.5" />
                            </button>
                            <button
                              onClick={() => toggleRegionalStatus(item.id)}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                isAtivo
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                              }`}
                              title={isAtivo ? 'Desativar Regional' : 'Reativar Regional'}
                            >
                              <Power className="w-4.5 h-4.5" />
                            </button>
                            <button
                              onClick={() => handleHardDeleteRegional(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Excluir Regional Definitivamente"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: OBRAS PANEL */}
          {activeSubTab === 'obras' && (
            <div className="space-y-6">
              {canManage && (
                <div className="bg-white p-6 rounded-2xl border border-brand-border shadow-xs">
                  <div className="mb-5">
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-2 py-1 rounded-full uppercase tracking-wider">
                      Cadastro de Obras e Atribuições
                    </span>
                    <h4 className="text-base font-black text-brand-ink mt-2">Cadastrar Nova Obra (Centro de Custo)</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Crie a obra dentro de uma regional e configure toda a equipe de campo responsável (Engenheiro, Supervisor SSMA, TSTs e Encarregados).
                    </p>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Info Básica */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Código da Obra / CC</label>
                        <input
                          type="text"
                          placeholder="Ex: CC-060"
                          value={obraCodigo}
                          onChange={(e) => setObraCodigo(e.target.value)}
                          className="w-full px-4 py-2 border border-brand-border rounded-xl focus:outline-brand-accent text-sm font-mono font-bold"
                          required
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Nome do Empreendimento / Obra</label>
                        <input
                          type="text"
                          placeholder="Ex: Complexo Fotovoltaico Solar de Juazeiro"
                          value={obraNome}
                          onChange={(e) => setObraNome(e.target.value)}
                          className="w-full px-4 py-2 border border-brand-border rounded-xl focus:outline-brand-accent text-sm"
                          required
                        />
                      </div>
                    </div>

                    {/* Regional e Responsáveis Individuais */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Regional Vinculada</label>
                        <select
                          value={obraRegionalId}
                          onChange={(e) => setObraRegionalId(e.target.value)}
                          className="w-full px-4 py-2 border border-brand-border rounded-xl focus:outline-brand-accent text-sm bg-white cursor-pointer"
                          required
                        >
                          <option value="">Selecione a Regional...</option>
                          {regionals.filter((item) => item.ativo !== false).map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Gestor de Obra</label>
                        <select
                          value={obraEngenheiroId}
                          onChange={(e) => setObraEngenheiroId(e.target.value)}
                          className="w-full px-4 py-2 border border-brand-border rounded-xl focus:outline-brand-accent text-sm bg-white cursor-pointer"
                        >
                          <option value="">Selecione...</option>
                          {colaboradores
                            .filter((c) => c.funcao === 'Gestor de Obra' && c.ativo !== false)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nome}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Supervisor SSMA</label>
                        <select
                          value={obraSupervisorId}
                          onChange={(e) => setObraSupervisorId(e.target.value)}
                          className="w-full px-4 py-2 border border-brand-border rounded-xl focus:outline-brand-accent text-sm bg-white cursor-pointer"
                        >
                          <option value="">Selecione...</option>
                          {colaboradores
                            .filter((c) => c.funcao === 'Supervisor de SSMA' && c.ativo !== false)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nome}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* Técnicos de Segurança (TST) */}
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                        Atribuir Técnicos de Segurança (TST) da Obra
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {colaboradores.filter((c) => c.funcao === 'Técnico de Segurança' && c.ativo !== false).length === 0 ? (
                          <p className="text-xs text-slate-400 italic col-span-full">Nenhum TST ativo cadastrado.</p>
                        ) : (
                          colaboradores
                            .filter((c) => c.funcao === 'Técnico de Segurança' && c.ativo !== false)
                            .map((c) => {
                              const isChecked = obraTstIds.includes(c.id);
                              return (
                                <button
                                  type="button"
                                  key={c.id}
                                  onClick={() => {
                                    setObraTstIds((prev) =>
                                      prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                    );
                                  }}
                                  className={`px-3 py-2 text-left rounded-xl border text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                                    isChecked
                                      ? 'border-brand-accent bg-brand-bg text-brand-accent'
                                      : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100/70'
                                  }`}
                                >
                                  <span className="truncate">{c.nome}</span>
                                  {isChecked && <Check className="w-3.5 h-3.5 shrink-0 ml-1 text-brand-accent" />}
                                </button>
                              );
                            })
                        )}
                      </div>
                    </div>

                    {/* Encarregados */}
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                        Atribuir Encarregados da Obra
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {foremen.filter((c) => c.ativo !== false).length === 0 ? (
                          <p className="text-xs text-slate-400 italic col-span-full">Nenhum encarregado ativo cadastrado.</p>
                        ) : (
                          foremen
                            .filter((c) => c.ativo !== false)
                            .map((c) => {
                              const isChecked = obraEncarregadoIds.includes(c.id);
                              return (
                                <button
                                  type="button"
                                  key={c.id}
                                  onClick={() => {
                                    setObraEncarregadoIds((prev) =>
                                      prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                    );
                                  }}
                                  className={`px-3 py-2 text-left rounded-xl border text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                                    isChecked
                                      ? 'border-brand-accent bg-brand-bg text-brand-accent'
                                      : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100/70'
                                  }`}
                                >
                                  <span className="truncate">{c.nome}</span>
                                  {isChecked && <Check className="w-3.5 h-3.5 shrink-0 ml-1 text-brand-accent" />}
                                </button>
                              );
                            })
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                      {editingObraId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingObraId(null);
                            setObraCodigo('');
                            setObraNome('');
                            setObraRegionalId('');
                            setObraEngenheiroId('');
                            setObraSupervisorId('');
                            setObraTstIds([]);
                            setObraEncarregadoIds([]);
                          }}
                          className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shrink-0 cursor-pointer w-full sm:w-auto"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shrink-0 cursor-pointer w-full sm:w-auto shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        {editingObraId ? 'Salvar Alterações' : 'Salvar Obra e Atribuições'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Obras Grid list - Bento styled */}
              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Obras Cadastradas</h4>
                
                {costCenters.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-brand-border text-center text-slate-400 font-medium">
                    Nenhuma obra cadastrada. Cadastre uma no painel acima!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {costCenters.map((item) => {
                      const regObj = regionals.find((r) => r.id === item.regionalId);
                      const engObj = colaboradores.find((c) => c.id === item.engenheiroId || (c as any).uid === item.engenheiroId);
                      const supObj = colaboradores.find((c) => c.id === item.supervisorId || (c as any).uid === item.supervisorId);
                      
                      const assignedTsts = colaboradores.filter((c) => item.tstIds?.includes(c.id) || item.tstIds?.includes((c as any).uid));
                      const assignedEncs = foremen.filter((f) => item.encarregadoIds?.includes(f.id));
                      const isAtivo = item.ativo !== false;

                      return (
                        <div key={item.id} className={`bg-white rounded-2xl border border-brand-border p-5 flex flex-col justify-between hover:border-slate-300 transition shadow-xs space-y-4 ${!isAtivo ? 'opacity-70 bg-slate-50/40 border-dashed' : ''}`}>
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-[11px] font-bold text-brand-accent bg-brand-bg px-2 py-0.5 rounded-md">
                                  {item.codigo}
                                </span>
                                {!isAtivo ? (
                                  <span className="bg-rose-50 text-rose-600 border border-rose-100 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                                    Encerrada
                                  </span>
                                ) : (
                                  <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                                    Ativa
                                  </span>
                                )}
                              </div>
                              <h5 className={`font-extrabold text-sm mt-1.5 ${!isAtivo ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{item.nome}</h5>
                              
                              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                <span className="font-semibold">{regObj ? regObj.nome : <span className="text-rose-500 italic">Sem Regional</span>}</span>
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-1.5 shrink-0 pl-2">
                              <button
                                onClick={() => startEditObra(item)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="Editar Obra"
                              >
                                <User className="w-4.5 h-4.5" />
                              </button>
                              <button
                                onClick={() => toggleObraStatus(item.id)}
                                className={`p-1.5 rounded-lg transition cursor-pointer ${
                                  isAtivo
                                    ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                    : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                                }`}
                                title={isAtivo ? 'Encerrar Obra' : 'Reativar Obra'}
                              >
                                <Power className="w-4.5 h-4.5" />
                              </button>
                              <button
                                onClick={() => handleHardDeleteObra(item.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Excluir Obra Definitivamente"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block">Gestor de Obra</span>
                                <span className="font-bold text-slate-700">{engObj ? engObj.nome : <span className="text-slate-400 italic">Nenhum</span>}</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block">Supervisor SSMA</span>
                                <span className="font-bold text-slate-700">{supObj ? supObj.nome : <span className="text-slate-400 italic">Nenhum</span>}</span>
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Técnicos de Segurança ({assignedTsts.length})</span>
                              <div className="flex flex-wrap gap-1">
                                {assignedTsts.length === 0 ? (
                                  <span className="text-slate-400 italic">Nenhum</span>
                                ) : (
                                  assignedTsts.map(t => (
                                    <span key={t.id} className="bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                      {t.nome}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Encarregados ({assignedEncs.length})</span>
                              <div className="flex flex-wrap gap-1">
                                {assignedEncs.length === 0 ? (
                                  <span className="text-slate-400 italic">Nenhum</span>
                                ) : (
                                  assignedEncs.map(e => (
                                    <span key={e.id} className="bg-slate-50 text-slate-700 font-bold px-1.5 py-0.5 rounded text-[10px] border border-slate-200">
                                      {e.nome}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'checklist' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
               <ChecklistUpload />
            </div>
          )}
        </div>

      <CreateForemanModal 
        isOpen={isCreateForemanOpen} 
        onClose={() => setIsCreateForemanOpen(false)} 
        onSuccess={() => refetchEmp()} 
      />
    </div>
  );
}
