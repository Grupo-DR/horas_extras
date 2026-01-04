import { PipelineStage } from '../types';

export const PIPELINE_STEPS = [
    PipelineStage.LEAD_RECEBIDO,
    PipelineStage.DECISAO_PARTICIPACAO,
    PipelineStage.ORCAMENTO_PREVIO,
    PipelineStage.MEMORIA_COMPOSICOES,
    PipelineStage.PROPOSTA_TECNICA,
    PipelineStage.PROPOSTA_COMERCIAL,
    PipelineStage.REVISAO_FINAL,
    PipelineStage.ENVIO_PROPOSTA,
    PipelineStage.AGUARDANDO_RESULTADO,
    PipelineStage.RESULTADO
];

export const getPipelineStages = (): PipelineStage[] => {
    return [...PIPELINE_STEPS];
};

export const getNextStage = (currentStage: PipelineStage): PipelineStage | null => {
    const index = PIPELINE_STEPS.indexOf(currentStage);
    if (index === -1 || index === PIPELINE_STEPS.length - 1) {
        return null;
    }
    return PIPELINE_STEPS[index + 1];
};

export const getExecutionPercent = (stage: PipelineStage): number => {
    switch (stage) {
        case PipelineStage.LEAD_RECEBIDO: return 0;
        case PipelineStage.DECISAO_PARTICIPACAO: return 12.5;
        case PipelineStage.ORCAMENTO_PREVIO: return 25.0;
        case PipelineStage.MEMORIA_COMPOSICOES: return 37.5;
        case PipelineStage.PROPOSTA_TECNICA: return 50.0;
        case PipelineStage.PROPOSTA_COMERCIAL: return 62.5;
        case PipelineStage.REVISAO_FINAL: return 75.0;
        case PipelineStage.ENVIO_PROPOSTA: return 87.5;
        case PipelineStage.AGUARDANDO_RESULTADO: return 90.0;
        case PipelineStage.RESULTADO: return 100.0;
        default: return 0;
    }
};

export const getStageLabel = (stage: PipelineStage): string => {
    switch (stage) {
        case PipelineStage.LEAD_RECEBIDO: return 'Lead Recebido';
        case PipelineStage.DECISAO_PARTICIPACAO: return 'Decisão de Participação';
        case PipelineStage.ORCAMENTO_PREVIO: return 'Orçamento Prévio';
        case PipelineStage.MEMORIA_COMPOSICOES: return 'Memória e Compor';
        case PipelineStage.PROPOSTA_TECNICA: return 'Proposta Técnica';
        case PipelineStage.PROPOSTA_COMERCIAL: return 'Proposta Comercial';
        case PipelineStage.REVISAO_FINAL: return 'REVISAO';
        case PipelineStage.ENVIO_PROPOSTA: return 'Envio da Proposta';
        case PipelineStage.AGUARDANDO_RESULTADO: return 'Aguardando Resultado';
        case PipelineStage.RESULTADO: return 'Concluído / Resultado';
        default: return stage;
    }
};
