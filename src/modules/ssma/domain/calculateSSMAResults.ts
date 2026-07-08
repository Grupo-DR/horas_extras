import { SSMAInspection, SSMARule, SSMAEmployee, SSMATargetFunctionGroup, SSMAMonthlyTarget, SSMAInspectionEvent, SSMAMonthlyPersonResult, SSMAMonthlyCollectiveResult } from '../types';
import { SSMARole, Scope } from '../../iam/types';

export const calculateInspecoesFields = (
  raw: Omit<
    SSMAInspection,
    | 'metaGestorIFS'
    | 'metaGestorAlojamento'
    | 'metaEncarregadoIFS'
    | 'metaEncarregadoAlojamento'
    | 'metaSupssmaIFS'
    | 'metaSupssmaAlojamento'
    | 'metaTstIFS'
    | 'metaTstAlojamento'
    | 'resultadoGestor'
    | 'resultadoEncarregado'
    | 'resultadoSupssma'
    | 'resultadoTst'
    | 'resultadoGeral'
    | 'status'
  > & {
    regra?: SSMARule;
  },
  colaboradores?: SSMAEmployee[]
): SSMAInspection => {
  // Configuração default se não houver regra. Assume 95% e 1 de meta
  const r = raw.regra || {
    monthlyTarget: 1, // Assume 1 para simplificar o default se não vier
    percentualAtendimento: 95
  } as any;

  // A regra padrão no protótipo era:
  const metaDefaultGestorIFS = 1;
  const metaDefaultGestorAlojamento = 1;
  const metaDefaultEncarregadoAlojamento = 1;
  const metaDefaultSupssmaIFS = 1;
  const metaDefaultSupssmaAlojamento = 1;
  const metaDefaultTstIFS = 1;
  const metaDefaultTstAlojamento = 1;
  const percentualAtendimento = r.percentualAtendimento ?? 95;

  const gestorCol = colaboradores?.find(c => c.name === raw.gestor && c.functionGroup === 'SITE_MANAGER');
  const encarregadoCol = colaboradores?.find(c => c.name === raw.encarregado && c.functionGroup === 'FOREMAN');
  const supssmaCol = colaboradores?.find(c => c.name === raw.supssma && c.functionGroup === 'SUPERVISOR');
  const tstCol = colaboradores?.find(c => c.name === raw.tst && c.functionGroup === 'TECHNICIAN');

  const metaGestorIFS = gestorCol?.targetIFS !== undefined ? gestorCol.targetIFS : metaDefaultGestorIFS;
  const metaGestorAlojamento = gestorCol?.targetAlojamento !== undefined ? gestorCol.targetAlojamento : metaDefaultGestorAlojamento;
  
  const metaEncarregadoIFS = encarregadoCol?.targetIFS !== undefined 
    ? encarregadoCol.targetIFS 
    : (encarregadoCol?.targetRDO !== undefined ? encarregadoCol.targetRDO : raw.qtdeRdo);
  const metaEncarregadoAlojamento = encarregadoCol?.targetAlojamento !== undefined ? encarregadoCol.targetAlojamento : metaDefaultEncarregadoAlojamento;
  
  const metaSupssmaIFS = supssmaCol?.targetIFS !== undefined ? supssmaCol.targetIFS : metaDefaultSupssmaIFS;
  const metaSupssmaAlojamento = supssmaCol?.targetAlojamento !== undefined ? supssmaCol.targetAlojamento : metaDefaultSupssmaAlojamento;
  
  const metaTstIFS = tstCol?.targetIFS !== undefined ? tstCol.targetIFS : metaDefaultTstIFS;
  const metaTstAlojamento = tstCol?.targetAlojamento !== undefined ? tstCol.targetAlojamento : metaDefaultTstAlojamento;

  const totalMetaGestor = metaGestorIFS + metaGestorAlojamento;
  const totalRealGestor = raw.realizadoGestorIFS + raw.realizadoGestorAlojamento;
  const resultadoGestor = totalMetaGestor > 0 
    ? Math.round((totalRealGestor / totalMetaGestor) * 100)
    : 0;

  const totalMetaEncarregado = metaEncarregadoIFS + metaEncarregadoAlojamento;
  const totalRealEncarregado = raw.realizadoEncarregadoIFS + raw.realizadoEncarregadoAlojamento;
  const resultadoEncarregado = totalMetaEncarregado > 0 
    ? Math.round((totalRealEncarregado / totalMetaEncarregado) * 100)
    : 0;

  const totalMetaSupssma = metaSupssmaIFS + metaSupssmaAlojamento;
  const totalRealSupssma = raw.realizadoSupssmaIFS + raw.realizadoSupssmaAlojamento;
  const resultadoSupssma = totalMetaSupssma > 0 
    ? Math.round((totalRealSupssma / totalMetaSupssma) * 100)
    : 0;

  const totalMetaTst = metaTstIFS + metaTstAlojamento;
  const totalRealTst = raw.realizadoTstIFS + raw.realizadoTstAlojamento;
  const resultadoTst = totalMetaTst > 0 
    ? Math.round((totalRealTst / totalMetaTst) * 100)
    : 0;

  const resultadoGeral = Math.round((resultadoGestor + resultadoEncarregado + resultadoSupssma + resultadoTst) / 4);

  const status = resultadoGeral >= percentualAtendimento ? 'ATENDE' : 'NÃO ATENDE';

  return {
    ...raw,
    metaGestorIFS,
    metaGestorAlojamento,
    metaEncarregadoIFS,
    metaEncarregadoAlojamento,
    metaSupssmaIFS,
    metaSupssmaAlojamento,
    metaTstIFS,
    metaTstAlojamento,
    resultadoGestor,
    resultadoEncarregado,
    resultadoSupssma,
    resultadoTst,
    resultadoGeral,
    status,
  } as SSMAInspection;
};

// --- Monthly targets and real event result functions ---

export type SSMARealByFunctionGroup = Record<SSMATargetFunctionGroup, {
  realIFS: number;
  realAlojamento: number;
  realTotal: number;
}>;

export type SSMAMetaByFunctionGroup = Record<SSMATargetFunctionGroup, {
  metaIFS: number;
  metaAlojamento: number;
  metaTotal: number;
}>;

const TARGET_FUNCTION_GROUPS: SSMATargetFunctionGroup[] = ['GREG', 'GESTOR', 'SUPSSMA', 'TST', 'ENCARREGADO'];

const emptyRealByFunctionGroup = (): SSMARealByFunctionGroup => ({
  GREG: { realIFS: 0, realAlojamento: 0, realTotal: 0 },
  GESTOR: { realIFS: 0, realAlojamento: 0, realTotal: 0 },
  SUPSSMA: { realIFS: 0, realAlojamento: 0, realTotal: 0 },
  TST: { realIFS: 0, realAlojamento: 0, realTotal: 0 },
  ENCARREGADO: { realIFS: 0, realAlojamento: 0, realTotal: 0 }
});

const emptyMetaByFunctionGroup = (): SSMAMetaByFunctionGroup => ({
  GREG: { metaIFS: 0, metaAlojamento: 0, metaTotal: 0 },
  GESTOR: { metaIFS: 0, metaAlojamento: 0, metaTotal: 0 },
  SUPSSMA: { metaIFS: 0, metaAlojamento: 0, metaTotal: 0 },
  TST: { metaIFS: 0, metaAlojamento: 0, metaTotal: 0 },
  ENCARREGADO: { metaIFS: 0, metaAlojamento: 0, metaTotal: 0 }
});

export const mapRoleToFunctionGroup = (role: SSMARole): SSMATargetFunctionGroup => {
  switch (role) {
    case 'SSMA_REGIONAL_MANAGER': return 'GREG';
    case 'SSMA_SITE_MANAGER': return 'GESTOR';
    case 'SSMA_SUPERVISOR': return 'SUPSSMA';
    case 'SSMA_TECHNICIAN': return 'TST';
    case 'SSMA_FOREMAN': return 'ENCARREGADO';
    default:
      return 'GESTOR'; // Safe fallback
  }
};

export const getCompetenceFromDate = (date: string): string => {
  if (!date) return new Date().toISOString().substring(0, 7);
  return date.substring(0, 7);
};

export const aggregateRealByFunctionGroup = (events: SSMAInspectionEvent[]): SSMARealByFunctionGroup => {
  const totals = emptyRealByFunctionGroup();

  events
    .filter(event => event.status === 'VALID')
    .forEach(event => {
      const group = event.executorFunctionGroup;
      if (!totals[group]) return;
      if (event.inspectionType === 'IFS') {
        totals[group].realIFS += 1;
      } else if (event.inspectionType === 'ALOJAMENTO') {
        totals[group].realAlojamento += 1;
      }
      totals[group].realTotal = totals[group].realIFS + totals[group].realAlojamento;
    });

  return totals;
};

export const aggregateMetaByFunctionGroup = (targets: SSMAMonthlyTarget[]): SSMAMetaByFunctionGroup => {
  const totals = emptyMetaByFunctionGroup();

  targets
    .filter(target => target.active !== false)
    .forEach(target => {
      const group = target.functionGroup;
      if (!totals[group]) return;
      totals[group].metaIFS += target.metaIFS || 0;
      totals[group].metaAlojamento += target.metaAlojamento || 0;
      totals[group].metaTotal = totals[group].metaIFS + totals[group].metaAlojamento;
    });

  return totals;
};

export const calculatePersonMonthlyResult = (
  employee: SSMAEmployee,
  events: SSMAInspectionEvent[],
  target?: SSMAMonthlyTarget | null
): SSMAMonthlyPersonResult => {
  const competence = target?.competence || (employee as any).competence || events[0]?.competence || getCompetenceFromDate(new Date().toISOString());
  const employeeUid = employee.uid || employee.id;
  const functionGroup = target?.functionGroup || mapRoleToFunctionGroup(((employee as any).roleSnapshot || 'SSMA_TECHNICIAN') as SSMARole);

  const personEvents = events.filter(
    event => event.status === 'VALID' && event.competence === competence && event.executorUid === employeeUid
  );

  const realIFS = personEvents.filter(event => event.inspectionType === 'IFS').length;
  const realAlojamento = personEvents.filter(event => event.inspectionType === 'ALOJAMENTO').length;
  const realTotal = realIFS + realAlojamento;

  const metaIFS = target?.active === false ? 0 : target?.metaIFS || 0;
  const metaAlojamento = target?.active === false ? 0 : target?.metaAlojamento || 0;
  const metaTotal = metaIFS + metaAlojamento;

  let resultadoIndividual: number | null = null;
  let status: SSMAMonthlyPersonResult['status'] = 'SEM_META';

  if (metaTotal > 0) {
    resultadoIndividual = realTotal / metaTotal;
    status = resultadoIndividual >= 0.95 ? 'ATENDE' : 'NAO_ATENDE';
  } else if (realTotal > 0) {
    status = 'REALIZADO_SEM_META';
  }

  return {
    id: `${competence}_${employeeUid}`,
    competence,
    employeeUid,
    employeeNameSnapshot: target?.employeeNameSnapshot || employee.name,
    functionGroup,
    realIFS,
    realAlojamento,
    realTotal,
    metaIFS,
    metaAlojamento,
    metaTotal,
    resultadoIndividual,
    status,
    recalculatedAt: new Date().toISOString()
  };
};

export interface CalculateCollectiveMonthlyResultOptions {
  competence?: string;
  scope?: Scope;
  employeeUids?: string[];
}

export const calculateCollectiveMonthlyResult = (
  events: SSMAInspectionEvent[],
  targets: SSMAMonthlyTarget[],
  options: CalculateCollectiveMonthlyResultOptions = {}
): SSMAMonthlyCollectiveResult => {
  const competence = options.competence || targets[0]?.competence || events[0]?.competence || getCompetenceFromDate(new Date().toISOString());
  const allowedEmployeeUids = options.employeeUids ? new Set(options.employeeUids) : null;

  let filteredEvents = events.filter(event => event.status === 'VALID' && event.competence === competence);
  if (options.scope?.type === 'REGIONAL') {
    filteredEvents = filteredEvents.filter(event => options.scope?.type === 'REGIONAL' && options.scope.regionals.includes(event.regionalId));
  } else if (options.scope?.type === 'COST_CENTER') {
    filteredEvents = filteredEvents.filter(event => options.scope?.type === 'COST_CENTER' && options.scope.costCenters.includes(event.costCenterId));
  }
  if (allowedEmployeeUids) {
    filteredEvents = filteredEvents.filter(event => allowedEmployeeUids.has(event.executorUid));
  }

  const activeTargets = targets.filter(target => {
    if (target.active === false || target.competence !== competence) return false;
    return !allowedEmployeeUids || allowedEmployeeUids.has(target.employeeUid);
  });

  const realByGroup = aggregateRealByFunctionGroup(filteredEvents);
  const metaByGroup = aggregateMetaByFunctionGroup(activeTargets);

  const totalRealizado = TARGET_FUNCTION_GROUPS.reduce((sum, group) => sum + realByGroup[group].realTotal, 0);
  const totalMeta = TARGET_FUNCTION_GROUPS.reduce((sum, group) => sum + metaByGroup[group].metaTotal, 0);
  const resultadoColetivo = totalMeta > 0 ? totalRealizado / totalMeta : null;

  const regionalId = options.scope?.type === 'REGIONAL' ? options.scope.regionals[0] : undefined;
  const costCenterId = options.scope?.type === 'COST_CENTER' ? options.scope.costCenters[0] : undefined;
  const scopeType = options.scope?.type || 'ALL';
  const idSuffix = regionalId || costCenterId || 'ALL';

  return {
    id: `${competence}_${scopeType}_${idSuffix}`,
    competence,
    scopeType,
    regionalId,
    costCenterId,
    realIFS_GREG: realByGroup.GREG.realIFS,
    realAloj_GREG: realByGroup.GREG.realAlojamento,
    realIFS_GESTOR: realByGroup.GESTOR.realIFS,
    realAloj_GESTOR: realByGroup.GESTOR.realAlojamento,
    realIFS_SUPSSMA: realByGroup.SUPSSMA.realIFS,
    realAloj_SUPSSMA: realByGroup.SUPSSMA.realAlojamento,
    realIFS_TST: realByGroup.TST.realIFS,
    realAloj_TST: realByGroup.TST.realAlojamento,
    realIFS_ENCARREGADO: realByGroup.ENCARREGADO.realIFS,
    realAloj_ENCARREGADO: realByGroup.ENCARREGADO.realAlojamento,
    metaIFS_GREG: metaByGroup.GREG.metaIFS,
    metaAloj_GREG: metaByGroup.GREG.metaAlojamento,
    metaIFS_GESTOR: metaByGroup.GESTOR.metaIFS,
    metaAloj_GESTOR: metaByGroup.GESTOR.metaAlojamento,
    metaIFS_SUPSSMA: metaByGroup.SUPSSMA.metaIFS,
    metaAloj_SUPSSMA: metaByGroup.SUPSSMA.metaAlojamento,
    metaIFS_TST: metaByGroup.TST.metaIFS,
    metaAloj_TST: metaByGroup.TST.metaAlojamento,
    metaIFS_ENCARREGADO: metaByGroup.ENCARREGADO.metaIFS,
    metaAloj_ENCARREGADO: metaByGroup.ENCARREGADO.metaAlojamento,
    totalRealizado,
    totalMeta,
    resultadoColetivo,
    recalculatedAt: new Date().toISOString()
  };
};

export const calculateIndividualResult = (
  events: SSMAInspectionEvent[],
  target: SSMAMonthlyTarget
): SSMAMonthlyPersonResult => {
  return calculatePersonMonthlyResult({
    id: target.employeeUid,
    uid: target.employeeUid,
    name: target.employeeNameSnapshot,
    email: target.employeeEmailSnapshot,
    functionGroup: 'TECHNICIAN',
    active: true
  }, events, target);
};

export const calculateCollectiveResult = (
  events: SSMAInspectionEvent[],
  targets: SSMAMonthlyTarget[],
  scope?: Scope
): SSMAMonthlyCollectiveResult => {
  return calculateCollectiveMonthlyResult(events, targets, { scope });
};
