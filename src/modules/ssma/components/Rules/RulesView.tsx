import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Lock, Save, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { employeeFunctionGroupToTargetGroup, targetFunctionGroupLabel } from '../../domain/inspectionEventHelpers';
import { useSSMACostCenters } from '../../hooks/useSSMACostCenters';
import { useSSMAEmployees } from '../../hooks/useSSMAEmployees';
import { MonthlyTargetUpsertInput, useSSMAMonthlyTargets } from '../../hooks/useSSMAMonthlyTargets';
import { SSMAMonthlyTarget, SSMAEmployee, SSMATargetFunctionGroup } from '../../types';

type DraftTarget = {
  metaIFS: number;
  metaAlojamento: number;
};

const currentCompetence = () => new Date().toISOString().slice(0, 7);

const canEditTargets = (profile: any): boolean => {
  if (!profile) return false;
  if (profile.isSuperAdmin) return true;
  return profile.modules?.ssma?.enabled && profile.modules.ssma.role === 'SSMA_MANAGER';
};

const isEmployeeAssignedToCostCenter = (employee: SSMAEmployee, costCenter: any): boolean => {
  return (
    employee.costCenterIds?.includes(costCenter.id) ||
    costCenter.engenheiroId === employee.id ||
    costCenter.supervisorId === employee.id ||
    costCenter.tstIds?.includes(employee.id) ||
    costCenter.encarregadoIds?.includes(employee.id)
  );
};

const getScopedEmployees = (profile: any, employees: SSMAEmployee[], costCenters: any[]): SSMAEmployee[] => {
  if (!profile) return [];
  if (profile.isSuperAdmin || profile.modules?.ssma?.role === 'SSMA_MANAGER') return employees;

  const scope = profile.modules?.ssma?.scope;
  if (!scope) return employees.filter(employee => employee.uid === profile.uid);

  if (scope.type === 'REGIONAL') {
    return employees.filter(employee => {
      if (employee.uid === profile.uid) return true;
      if (employee.regionalIds?.some(regionalId => scope.regionals.includes(regionalId))) return true;
      return costCenters.some(costCenter => scope.regionals.includes(costCenter.regionalId) && isEmployeeAssignedToCostCenter(employee, costCenter));
    });
  }

  if (scope.type === 'COST_CENTER') {
    return employees.filter(employee => {
      if (employee.uid === profile.uid) return true;
      if (employee.costCenterIds?.some(costCenterId => scope.costCenters.includes(costCenterId))) return true;
      return costCenters.some(costCenter => scope.costCenters.includes(costCenter.id) && isEmployeeAssignedToCostCenter(employee, costCenter));
    });
  }

  return employees;
};

const targetId = (competence: string, employee: SSMAEmployee) => `${competence}_${employee.uid || employee.id}`;

const getTargetGroup = (employee: SSMAEmployee): SSMATargetFunctionGroup => {
  return employeeFunctionGroupToTargetGroup(employee);
};

const roleOrder: Record<SSMATargetFunctionGroup, number> = {
  GREG: 1,
  GESTOR: 2,
  SUPSSMA: 3,
  TST: 4,
  ENCARREGADO: 5
};

export const RulesView: React.FC = () => {
  const { profile } = useAuth();
  const [competence, setCompetence] = useState(currentCompetence());
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<'ALL' | SSMATargetFunctionGroup>('ALL');
  const [drafts, setDrafts] = useState<Record<string, DraftTarget>>({});

  const editable = canEditTargets(profile);
  const { data: employees, loading: employeesLoading } = useSSMAEmployees();
  const { data: costCenters, loading: costCentersLoading } = useSSMACostCenters();
  const { targets, loading: targetsLoading, saving, error, bulkUpsertTargets, copyFromPreviousCompetence } = useSSMAMonthlyTargets(competence);

  const activeEmployees = useMemo(() => employees.filter(employee => employee.active !== false && employee.uid), [employees]);
  const scopedEmployees = useMemo(() => getScopedEmployees(profile, activeEmployees, costCenters), [activeEmployees, costCenters, profile]);
  const targetByEmployeeUid = useMemo(() => {
    const map = new Map<string, SSMAMonthlyTarget>();
    targets.filter(target => target.active !== false).forEach(target => map.set(target.employeeUid, target));
    return map;
  }, [targets]);

  const visibleEmployees = useMemo(() => {
    return scopedEmployees
      .filter(employee => {
        const group = getTargetGroup(employee);
        const matchesGroup = groupFilter === 'ALL' || group === groupFilter;
        const matchesSearch = employee.name.toLowerCase().includes(searchQuery.toLowerCase()) || employee.email?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesGroup && matchesSearch;
      })
      .sort((a, b) => {
        const groupDiff = roleOrder[getTargetGroup(a)] - roleOrder[getTargetGroup(b)];
        if (groupDiff !== 0) return groupDiff;
        return a.name.localeCompare(b.name);
      });
  }, [groupFilter, scopedEmployees, searchQuery]);

  useEffect(() => {
    const nextDrafts: Record<string, DraftTarget> = {};
    scopedEmployees.forEach(employee => {
      const uid = employee.uid || employee.id;
      const existing = targetByEmployeeUid.get(uid);
      nextDrafts[targetId(competence, employee)] = {
        metaIFS: existing?.metaIFS || 0,
        metaAlojamento: existing?.metaAlojamento || 0
      };
    });
    setDrafts(nextDrafts);
  }, [competence, scopedEmployees, targetByEmployeeUid]);

  const loading = employeesLoading || costCentersLoading || targetsLoading;

  const updateDraft = (employee: SSMAEmployee, field: keyof DraftTarget, value: string) => {
    const numericValue = Math.max(0, Number(value) || 0);
    const id = targetId(competence, employee);
    setDrafts(prev => ({
      ...prev,
      [id]: {
        metaIFS: prev[id]?.metaIFS || 0,
        metaAlojamento: prev[id]?.metaAlojamento || 0,
        [field]: numericValue
      }
    }));
  };

  const buildTargetInputs = (employeesToSave: SSMAEmployee[], sourceByUid?: Map<string, SSMAMonthlyTarget>): MonthlyTargetUpsertInput[] => {
    return employeesToSave.map(employee => {
      const uid = employee.uid || employee.id;
      const previous = sourceByUid?.get(uid);
      const draft = drafts[targetId(competence, employee)];
      return {
        competence,
        employeeUid: uid,
        employeeNameSnapshot: employee.name,
        employeeEmailSnapshot: employee.email,
        functionGroup: getTargetGroup(employee),
        roleSnapshot: (employee.roleSnapshot || 'SSMA_TECHNICIAN') as any,
        metaIFS: previous?.metaIFS ?? draft?.metaIFS ?? 0,
        metaAlojamento: previous?.metaAlojamento ?? draft?.metaAlojamento ?? 0,
        active: true
      };
    });
  };

  const handleSaveAll = async () => {
    try {
      await bulkUpsertTargets(buildTargetInputs(scopedEmployees));
      toast.success('Metas mensais salvas.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar metas.');
    }
  };

  const handleCopyPrevious = async () => {
    try {
      await copyFromPreviousCompetence(previousTargets => {
        const previousByUid = new Map(previousTargets.filter(target => target.active !== false).map(target => [target.employeeUid, target]));
        return buildTargetInputs(scopedEmployees, previousByUid);
      });
      toast.success('Metas copiadas do mes anterior.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao copiar metas do mes anterior.');
    }
  };

  if (!profile?.isSuperAdmin && !profile?.modules?.ssma?.enabled) {
    return (
      <div className="rounded border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
        Usuario sem acesso ao modulo SSMA.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Metas mensais por pessoa</h1>
          <p className="text-sm text-gray-500">Fonte principal: ssma_monthly_targets. Metas sao mensais e vinculadas ao colaborador.</p>
        </div>
        {!editable && (
          <div className="inline-flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <Lock size={16} />
            Visualizacao em modo leitura.
          </div>
        )}
      </div>

      <div className="grid gap-3 rounded border border-gray-200 bg-white p-3 md:grid-cols-4">
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Competencia</span>
          <input type="month" value={competence} onChange={event => setCompetence(event.target.value)} className="h-10 w-full rounded border border-gray-300 px-3 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Grupo</span>
          <select value={groupFilter} onChange={event => setGroupFilter(event.target.value as any)} className="h-10 w-full rounded border border-gray-300 px-3 text-sm">
            <option value="ALL">Todos</option>
            <option value="GREG">GREG</option>
            <option value="GESTOR">GESTOR</option>
            <option value="SUPSSMA">SUPSSMA</option>
            <option value="TST">TST</option>
            <option value="ENCARREGADO">ENCARREGADO</option>
          </select>
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pesquisar</span>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Nome ou e-mail" className="h-10 w-full rounded border border-gray-300 pl-9 pr-3 text-sm" />
          </div>
        </label>
      </div>

      {error && <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3">Colaborador</th>
                <th className="px-3 py-3">Grupo</th>
                <th className="px-3 py-3 text-center">Meta IFS</th>
                <th className="px-3 py-3 text-center">Meta Alojamento</th>
                <th className="px-3 py-3 text-center">Meta Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">Carregando metas...</td></tr>
              ) : visibleEmployees.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">Nenhum colaborador elegivel encontrado.</td></tr>
              ) : (
                visibleEmployees.map(employee => {
                  const id = targetId(competence, employee);
                  const draft = drafts[id] || { metaIFS: 0, metaAlojamento: 0 };
                  return (
                    <tr key={employee.uid || employee.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900">{employee.name}</div>
                        <div className="text-xs text-gray-500">{employee.email}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                          {targetFunctionGroupLabel(getTargetGroup(employee))}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input type="number" min="0" value={draft.metaIFS} onChange={event => updateDraft(employee, 'metaIFS', event.target.value)} disabled={!editable} className="h-9 w-24 rounded border border-gray-300 px-2 text-center text-sm disabled:bg-gray-50" />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input type="number" min="0" value={draft.metaAlojamento} onChange={event => updateDraft(employee, 'metaAlojamento', event.target.value)} disabled={!editable} className="h-9 w-24 rounded border border-gray-300 px-2 text-center text-sm disabled:bg-gray-50" />
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-gray-900">{draft.metaIFS + draft.metaAlojamento}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <p className="text-xs text-gray-500">Gerente Regional entra como GREG. Campos legados targetIFS/targetAlojamento nao sao usados como fonte principal.</p>
        {editable && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={handleCopyPrevious} disabled={saving || loading} className="inline-flex h-10 items-center justify-center gap-2 rounded border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <Copy size={16} />
              Copiar mes anterior
            </button>
            <button type="button" onClick={handleSaveAll} disabled={saving || loading} className="inline-flex h-10 items-center justify-center gap-2 rounded bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50">
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar todas'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
