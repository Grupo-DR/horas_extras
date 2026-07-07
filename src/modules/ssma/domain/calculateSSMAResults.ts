import { SSMAInspection, SSMARule, SSMAEmployee } from '../types';

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
    ? Math.min(100, Math.round((totalRealGestor / totalMetaGestor) * 100)) 
    : 100;

  const totalMetaEncarregado = metaEncarregadoIFS + metaEncarregadoAlojamento;
  const totalRealEncarregado = raw.realizadoEncarregadoIFS + raw.realizadoEncarregadoAlojamento;
  const resultadoEncarregado = totalMetaEncarregado > 0 
    ? Math.min(100, Math.round((totalRealEncarregado / totalMetaEncarregado) * 100)) 
    : 100;

  const totalMetaSupssma = metaSupssmaIFS + metaSupssmaAlojamento;
  const totalRealSupssma = raw.realizadoSupssmaIFS + raw.realizadoSupssmaAlojamento;
  const resultadoSupssma = totalMetaSupssma > 0 
    ? Math.min(100, Math.round((totalRealSupssma / totalMetaSupssma) * 100)) 
    : 100;

  const totalMetaTst = metaTstIFS + metaTstAlojamento;
  const totalRealTst = raw.realizadoTstIFS + raw.realizadoTstAlojamento;
  const resultadoTst = totalMetaTst > 0 
    ? Math.min(100, Math.round((totalRealTst / totalMetaTst) * 100)) 
    : 100;

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
