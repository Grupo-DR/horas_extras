import { AbsenteeismEventType, AbsenteeismFact, AbsenteeismSummary, AbsenteeismGroupSummary, DEFAULT_ABSENTEEISM_TARGETS } from './absenteeismTypes';
import { HeadcountRecord, OvertimeRecord } from '../types';
import { getCCRegional, getCCName } from '../data/ccMaster';
import { getPayrollMonthKey } from '../utils/overtime';

export function normalizeAbsenteeismEvent(evento?: string): AbsenteeismEventType | null {
  const ev = (evento || '').trim().toUpperCase();
  if (ev === 'DESCONTO_FALTAS' || ev === 'DESCONTO FALTAS' || ev === 'FALTA' || ev === 'FALTAS') {
    return 'ABSENCE';
  }
  if (ev === 'DESCONTO_ATRASOS' || ev === 'DESCONTO ATRASOS' || ev === 'ATRASO' || ev === 'ATRASOS') {
    return 'DELAY';
  }
  return null;
}

export function isAbsenceEvent(evento?: string): boolean {
  return normalizeAbsenteeismEvent(evento) === 'ABSENCE';
}

export function isDelayEvent(evento?: string): boolean {
  return normalizeAbsenteeismEvent(evento) === 'DELAY';
}

export function isAbsenteeismEvent(evento?: string): boolean {
  return normalizeAbsenteeismEvent(evento) !== null;
}

export function calculateAvailableHours(headcount: HeadcountRecord[], chapa: string, costCenter: string): number {
  // Encontrar o registro de headcount aplicável.
  // Por enquanto, somamos as distribuições de todos os registros da chapa no CC no período.
  // TODO: evoluir para calendário oficial de dias úteis/feriados para períodos parciais.
  const records = headcount.filter(h => h.chapa === chapa && h.centroCusto === costCenter);
  if (records.length === 0) return 0;
  
  // 176 horas é a base mensal padrão.
  let totalAvailable = 0;
  records.forEach(r => {
    // distribuição = 1 (100%), 0.5 (50%), etc.
    totalAvailable += 176 * (r.distribuicao || 1);
  });
  
  return totalAvailable;
}

export function calculateHourlyCost(salary: number, availableHours: number): number {
  if (!salary || availableHours <= 0) return 0;
  return salary / availableHours;
}

export function buildAbsenteeismFacts(
  overtimeRecords: OvertimeRecord[],
  headcountRecords: HeadcountRecord[]
): AbsenteeismFact[] {
  // Pre-calcular informações de headcount por chapa e CC para rápida busca
  const hcMap = new Map<string, HeadcountRecord[]>();
  headcountRecords.forEach(h => {
    const key = `${h.chapa}_${h.centroCusto}`;
    if (!hcMap.has(key)) hcMap.set(key, []);
    hcMap.get(key)!.push(h);
  });

  return overtimeRecords
    .filter(r => isAbsenteeismEvent(r.EVENTO))
    .map(r => {
      const eventType = normalizeAbsenteeismEvent(r.EVENTO)!;
      const hours = Number(r.HORAS) || 0;
      
      const key = `${r.CHAPA}_${r.CODCCUSTO}`;
      const hcList = hcMap.get(key) || [];
      const hcRecord = hcList[0]; // Usamos o primeiro para dados básicos

      const availableHours = calculateAvailableHours(hcList, r.CHAPA, r.CODCCUSTO);
      
      // Regra de salário: 1) hcRecord.salario 2) 0
      const salary = hcRecord?.salario || 0;
      const hourlyCost = calculateHourlyCost(salary, availableHours);
      const estimatedCost = hours * hourlyCost;
      const allocation = hcRecord?.distribuicao || 1;
      const regional = getCCRegional(r.CODCCUSTO) || 'Outros';

      return {
        monthKey: getPayrollMonthKey(r.DATA) || 'Unknown',
        date: r.DATA,
        chapa: r.CHAPA,
        employeeName: hcRecord?.nome || r.NOME || 'Desconhecido',
        functionName: hcRecord?.funcao || r.FUNCAO || 'Não informada',
        costCenter: r.CODCCUSTO,
        costCenterName: getCCName(r.CODCCUSTO),
        regional,
        eventType,
        hours,
        salary,
        allocation,
        availableHours,
        hourlyCost,
        estimatedCost
      };
    });
}

function calculateStatus(rate: number, target: number): 'OK' | 'ATTENTION' | 'CRITICAL' {
  if (rate <= target) return 'OK';
  if (rate <= target * 1.25) return 'ATTENTION';
  return 'CRITICAL';
}

export function calculateAbsenteeismSummary(
  facts: AbsenteeismFact[],
  globalHeadcountRecords: HeadcountRecord[]
): AbsenteeismSummary {
  let absenceHours = 0;
  let delayHours = 0;
  let estimatedCost = 0;
  const impactedChapas = new Set<string>();

  facts.forEach(f => {
    if (f.eventType === 'ABSENCE') absenceHours += f.hours;
    else if (f.eventType === 'DELAY') delayHours += f.hours;
    estimatedCost += f.estimatedCost || 0;
    impactedChapas.add(f.chapa);
  });

  const totalHours = absenceHours + delayHours;
  const equivalentDays = totalHours / 8;

  // Total available hours no escopo global (baseado no headcount passado)
  let availableHours = 0;
  const uniqueChapasHeadcount = new Set<string>();
  globalHeadcountRecords.forEach(h => {
    uniqueChapasHeadcount.add(h.chapa);
    availableHours += 176 * (h.distribuicao || 1);
  });
  
  if (availableHours === 0) {
      // Fallback para evitar divisão por zero se não tiver headcount
      availableHours = impactedChapas.size > 0 ? impactedChapas.size * 176 : 176;
  }

  const absenteeismRate = totalHours / availableHours;
  const absenceRate = absenceHours / availableHours;
  const delayRate = delayHours / availableHours;
  const workforceAvailabilityRate = 1 - absenteeismRate;

  return {
    absenceHours,
    delayHours,
    totalHours,
    equivalentDays,
    availableHours,
    absenteeismRate,
    absenceRate,
    delayRate,
    workforceAvailabilityRate,
    estimatedCost,
    impactedEmployees: impactedChapas.size,
    headcount: uniqueChapasHeadcount.size
  };
}

// Agrupamentos
function groupFactsBy<T extends string>(
    facts: AbsenteeismFact[], 
    globalHeadcountRecords: HeadcountRecord[],
    keySelector: (fact: AbsenteeismFact) => T,
    hcKeySelector: (hc: HeadcountRecord) => T,
    labelSelector: (fact: AbsenteeismFact) => string
): AbsenteeismGroupSummary[] {
    const factsGrouped = new Map<T, AbsenteeismFact[]>();
    const hcGrouped = new Map<T, HeadcountRecord[]>();
    const labelMap = new Map<T, string>();
    const firstFactMap = new Map<T, AbsenteeismFact>();

    facts.forEach(f => {
        const key = keySelector(f);
        if (!factsGrouped.has(key)) {
            factsGrouped.set(key, []);
            labelMap.set(key, labelSelector(f));
            firstFactMap.set(key, f);
        }
        factsGrouped.get(key)!.push(f);
    });

    globalHeadcountRecords.forEach(h => {
        const key = hcKeySelector(h);
        if (!hcGrouped.has(key)) hcGrouped.set(key, []);
        hcGrouped.get(key)!.push(h);
    });
    
    // Precisamos iterar sobre TODAS as chaves de HC também, pois pode haver regional com HC mas sem faltas
    const allKeys = new Set([...factsGrouped.keys(), ...hcGrouped.keys()]);

    const result: AbsenteeismGroupSummary[] = [];

    allKeys.forEach(key => {
        const groupFacts = factsGrouped.get(key) || [];
        const groupHc = hcGrouped.get(key) || [];
        
        const summary = calculateAbsenteeismSummary(groupFacts, groupHc);
        
        // Se a taxa for calculada, validamos com a meta
        const targetRate = DEFAULT_ABSENTEEISM_TARGETS.totalRate;
        const status = calculateStatus(summary.absenteeismRate, targetRate);
        const deviationFromTarget = summary.absenteeismRate - targetRate;
        
        const firstFact = firstFactMap.get(key);
        // Tentar obter a label do HC caso não tenha fato
        let label = labelMap.get(key) || String(key);
        
        result.push({
            ...summary,
            id: String(key),
            label,
            regional: firstFact?.regional,
            costCenter: firstFact?.costCenter,
            functionName: firstFact?.functionName,
            chapa: firstFact?.chapa,
            status,
            targetRate,
            deviationFromTarget
        });
    });

    return result.sort((a, b) => b.absenteeismRate - a.absenteeismRate);
}

export function calculateAbsenteeismByRegional(facts: AbsenteeismFact[], globalHeadcount: HeadcountRecord[]): AbsenteeismGroupSummary[] {
    return groupFactsBy(
        facts, 
        globalHeadcount, 
        f => f.regional, 
        h => getCCRegional(h.centroCusto) || 'Outros', 
        f => f.regional
    );
}

export function calculateAbsenteeismByCostCenter(facts: AbsenteeismFact[], globalHeadcount: HeadcountRecord[]): AbsenteeismGroupSummary[] {
    return groupFactsBy(
        facts, 
        globalHeadcount, 
        f => f.costCenter, 
        h => h.centroCusto, 
        f => `${f.costCenter} - ${f.costCenterName}`
    );
}

export function calculateAbsenteeismByFunction(facts: AbsenteeismFact[], globalHeadcount: HeadcountRecord[]): AbsenteeismGroupSummary[] {
    return groupFactsBy(
        facts, 
        globalHeadcount, 
        f => f.functionName, 
        h => h.funcao || 'Não informada', 
        f => f.functionName
    );
}

export function calculateAbsenteeismByEmployee(facts: AbsenteeismFact[], globalHeadcount: HeadcountRecord[]): AbsenteeismGroupSummary[] {
    return groupFactsBy(
        facts, 
        globalHeadcount, 
        f => f.chapa, 
        h => h.chapa, 
        f => `${f.chapa} - ${f.employeeName}`
    );
}

export function calculateAbsenteeismMonthlyEvolution(facts: AbsenteeismFact[], globalHeadcount: HeadcountRecord[]): AbsenteeismGroupSummary[] {
    // Aqui não agrupamos o HC de forma global pois o headcount precisa ser o ATIVO no mês.
    // Como a tabela de headcount que entra já está filtrada para o período, uma aproximação é aceitável,
    // mas o correto é cruzar monthKey com a vigência do HeadcountRecord.
    // Por enquanto, faremos o cálculo com base na vigência simplificada se dataInicio estiver disponível, 
    // ou assumiremos que todo HC global pertence ao monthKey onde os eventos ocorreram.
    
    // Identificar meses com eventos
    const monthKeys = new Set(facts.map(f => f.monthKey));
    
    const result: AbsenteeismGroupSummary[] = [];
    
    monthKeys.forEach(monthKey => {
        const monthFacts = facts.filter(f => f.monthKey === monthKey);
        
        // TODO: Filtrar globalHeadcount para apenas os registros vigentes em monthKey.
        // Como o headcount upload ainda tem limitações de datas normatizadas,
        // usaremos o headcount inteiro ou os registros que cobrem esse mês.
        // Assumimos que globalHeadcount já foi filtrado para o mês atual pelo componente.
        const monthHc = globalHeadcount; 
        
        const summary = calculateAbsenteeismSummary(monthFacts, monthHc);
        const targetRate = DEFAULT_ABSENTEEISM_TARGETS.totalRate;
        const status = calculateStatus(summary.absenteeismRate, targetRate);
        const deviationFromTarget = summary.absenteeismRate - targetRate;
        
        result.push({
            ...summary,
            id: monthKey,
            label: monthKey,
            status,
            targetRate,
            deviationFromTarget
        });
    });
    
    return result.sort((a, b) => a.id.localeCompare(b.id));
}

export function generateExecutiveDiagnosis(
    summary: AbsenteeismSummary, 
    regionalGroups: AbsenteeismGroupSummary[],
    costCenterGroups: AbsenteeismGroupSummary[]
): string {
    const totalRatePercent = (summary.absenteeismRate * 100).toFixed(2);
    const targetPercent = (DEFAULT_ABSENTEEISM_TARGETS.totalRate * 100).toFixed(2);
    
    let diagnosis = `No período analisado, a taxa geral de absenteísmo ficou em ${totalRatePercent}%, `;
    
    if (summary.absenteeismRate <= DEFAULT_ABSENTEEISM_TARGETS.totalRate) {
        diagnosis += `o que representa um resultado EXCELENTE, mantendo-se dentro da meta de ${targetPercent}%. A disponibilidade de mão de obra foi de ${(summary.workforceAvailabilityRate * 100).toFixed(1)}%. `;
    } else {
        const deviation = ((summary.absenteeismRate - DEFAULT_ABSENTEEISM_TARGETS.totalRate) * 100).toFixed(2);
        diagnosis += `ultrapassando a meta de ${targetPercent}% em ${deviation} pontos percentuais. Isso representa uma perda de ${summary.equivalentDays.toFixed(1)} dias equivalentes de trabalho e um custo estimado de ${summary.estimatedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}. `;
    }

    if (regionalGroups.length > 0) {
        const worstRegional = regionalGroups[0];
        if (worstRegional.absenteeismRate > DEFAULT_ABSENTEEISM_TARGETS.totalRate) {
            diagnosis += `A regional que mais exige atenção é "${worstRegional.label}", com uma taxa de ${(worstRegional.absenteeismRate * 100).toFixed(2)}%. `;
        }
    }

    if (costCenterGroups.length > 0) {
        const worstCC = costCenterGroups.filter(c => c.totalHours > 0)[0];
        if (worstCC && worstCC.absenteeismRate > DEFAULT_ABSENTEEISM_TARGETS.totalRate) {
            diagnosis += `Aprofundando a análise, o centro de custo ofensor primário foi "${worstCC.label}", concentrando ${worstCC.totalHours.toFixed(0)} horas de absenteísmo.`;
        }
    }
    
    return diagnosis;
}

export function analyzeAbsenteeismOvertimeCorrelation(
    absenteeismFacts: AbsenteeismFact[],
    allOvertimeRecords: OvertimeRecord[]
): import('./absenteeismTypes').AbsenteeismOvertimeCorrelation[] {
    
    // Filtramos apenas as horas extras (não faltas/atrasos)
    const extraRecords = allOvertimeRecords.filter(r => 
        !isAbsenteeismEvent(r.EVENTO) && 
        (r.EVENTO.includes('HE') || r.EVENTO.includes('HORA EXTRA') || r.EVENTO.includes('DSR'))
    );

    const ccMap = new Map<string, { 
        ccName: string, 
        regional: string, 
        absHours: number, 
        absCost: number, 
        heHours: number, 
        heCost: number 
    }>();

    absenteeismFacts.forEach(f => {
        if (!ccMap.has(f.costCenter)) {
            ccMap.set(f.costCenter, {
                ccName: f.costCenterName || f.costCenter,
                regional: f.regional,
                absHours: 0, absCost: 0, heHours: 0, heCost: 0
            });
        }
        const acc = ccMap.get(f.costCenter)!;
        acc.absHours += f.hours;
        acc.absCost += f.estimatedCost || 0;
    });

    extraRecords.forEach(r => {
        const hours = Number(r.HORAS) || 0;
        const cost = Number(r.VALOR) || 0;
        if (!ccMap.has(r.CODCCUSTO)) {
            ccMap.set(r.CODCCUSTO, {
                ccName: getCCName(r.CODCCUSTO),
                regional: getCCRegional(r.CODCCUSTO) || 'Outros',
                absHours: 0, absCost: 0, heHours: 0, heCost: 0
            });
        }
        const acc = ccMap.get(r.CODCCUSTO)!;
        acc.heHours += hours;
        acc.heCost += cost;
    });

    const result: import('./absenteeismTypes').AbsenteeismOvertimeCorrelation[] = [];

    ccMap.forEach((acc, cc) => {
        if (acc.absHours === 0 && acc.heHours === 0) return;

        let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        let alertMessage = '';

        if (acc.absHours > 40 && acc.heHours > 100) {
            risk = 'HIGH';
            alertMessage = 'Alta correlação: Volume expressivo de faltas coincidente com pico de horas extras no mesmo Centro de Custo. Forte indício de reposição custosa de mão de obra.';
        } else if (acc.absHours > 20 && acc.heHours > 50) {
            risk = 'MEDIUM';
            alertMessage = 'Correlação moderada: Há indícios de que o absenteísmo está forçando a extensão da jornada neste CC.';
        }

        result.push({
            costCenter: cc,
            costCenterName: acc.ccName,
            regional: acc.regional,
            absenteeismHours: acc.absHours,
            overtimeHours: acc.heHours,
            absenteeismEstimatedCost: acc.absCost,
            overtimeCost: acc.heCost,
            correlationRisk: risk,
            alertMessage
        });
    });

    return result.sort((a, b) => b.overtimeHours - a.overtimeHours); // Ordenar pelos que mais gastam HE
}


