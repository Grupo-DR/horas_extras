export type AbsenteeismEventType = 'ABSENCE' | 'DELAY';

export const DEFAULT_ABSENTEEISM_TARGETS = {
  totalRate: 0.03,
  delayRate: 0.02,
  absenceRate: 0.01,
};

export interface AbsenteeismFact {
  monthKey: string;
  date: string;
  chapa: string;
  employeeName: string;
  functionName: string;
  costCenter: string;
  costCenterName?: string;
  regional: string;
  eventType: AbsenteeismEventType;
  hours: number;
  salary?: number;
  allocation?: number;
  availableHours?: number;
  hourlyCost?: number;
  estimatedCost?: number;
}

export interface AbsenteeismSummary {
  absenceHours: number;
  delayHours: number;
  totalHours: number;
  equivalentDays: number;
  availableHours: number;
  absenteeismRate: number;
  absenceRate: number;
  delayRate: number;
  workforceAvailabilityRate: number;
  estimatedCost: number;
  impactedEmployees: number;
  headcount: number;
}

export interface AbsenteeismGroupSummary extends AbsenteeismSummary {
  id: string;
  label: string;
  regional?: string;
  costCenter?: string;
  functionName?: string;
  chapa?: string;
  status: 'OK' | 'ATTENTION' | 'CRITICAL';
  targetRate: number;
  deviationFromTarget: number;
}

export interface AbsenteeismOvertimeCorrelation {
  costCenter: string;
  costCenterName: string;
  regional: string;
  absenteeismHours: number;
  overtimeHours: number;
  absenteeismEstimatedCost: number;
  overtimeCost: number;
  correlationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  alertMessage?: string;
}

