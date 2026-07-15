import { SSMARole } from '../../iam/types';
import { SSMAEmployee, SSMATargetFunctionGroup } from '../types';

export const deriveCompetenceFromDate = (date: string): string => {
    return date.slice(0, 7);
};

export const roleToTargetFunctionGroup = (role: SSMARole | string): SSMATargetFunctionGroup => {
    switch (role) {
        case 'SSMA_REGIONAL_MANAGER':
            return 'GREG';
        case 'SSMA_SITE_MANAGER':
            return 'GESTOR';
        case 'SSMA_SUPERVISOR':
            return 'SUPSSMA';
        case 'SSMA_FOREMAN':
            return 'ENCARREGADO';
        case 'SSMA_TECHNICIAN':
        default:
            return 'TST';
    }
};

export const employeeFunctionGroupToTargetGroup = (employee: SSMAEmployee): SSMATargetFunctionGroup => {
    switch (employee.functionGroup) {
        case 'MANAGER':
            return 'GREG';
        case 'SITE_MANAGER':
            return 'GESTOR';
        case 'SUPERVISOR':
            return 'SUPSSMA';
        case 'FOREMAN':
            return 'ENCARREGADO';
        case 'TECHNICIAN':
        default:
            return 'TST';
    }
};

export const targetFunctionGroupLabel = (group: SSMATargetFunctionGroup): string => {
    switch (group) {
        case 'GREG':
            return 'Ger. Regional';
        case 'GESTOR':
            return 'Gestor';
        case 'SUPSSMA':
            return 'Sup. SSMA';
        case 'TST':
            return 'TST';
        case 'ENCARREGADO':
            return 'Encarregado';
        default:
            return group;
    }
};

export const ssmaRoleLabel = (role: string): string => {
    switch (role) {
        case 'SSMA_MANAGER':
            return 'Gerente SSMA';
        case 'SSMA_REGIONAL_MANAGER':
            return 'Gerente Regional';
        case 'SSMA_SITE_MANAGER':
            return 'Gestor de Obra';
        case 'SSMA_SUPERVISOR':
            return 'Supervisor SSMA';
        case 'SSMA_TECHNICIAN':
            return 'Tecnico de Seguranca';
        case 'SSMA_FOREMAN':
            return 'Encarregado';
        case 'SSMA_VIEWER':
            return 'Visualizador';
        case 'SSMA_ADMIN':
            return 'Admin SSMA';
        default:
            return role;
    }
};
