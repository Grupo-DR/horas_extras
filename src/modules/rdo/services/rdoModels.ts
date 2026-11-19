/**
 * Modelos de RDO aceitos pelo RDO Online. Cada obra escolhe o seu no cadastro
 * (Minhas Obras > editar obra); a leitura por IA segue o modelo da obra.
 */
import { Project, RDOData, RdoModelId } from '../types';
import { extractRDOData } from './geminiService';
import { extractValeRDO } from './valeRdoModel';

export const RDO_MODEL_OPTIONS: { id: RdoModelId; label: string; hint: string }[] = [
  {
    id: 'PADRAO',
    label: 'Padrão',
    hint: 'RDO com código de serviço e quantidade em cada atividade.',
  },
  {
    id: 'VALE_NOVAS_FERROVIAS',
    label: 'Vale — Projeto Novas Ferrovias',
    hint: 'RDO da Vale sem código de serviço: a IA usa a PQ da obra (importe-a em Serviços) para identificar cada item.',
  },
];

export const rdoModelLabel = (id?: RdoModelId): string =>
  RDO_MODEL_OPTIONS.find((m) => m.id === (id ?? 'PADRAO'))?.label ?? 'Padrão';

/** Pré-requisitos da obra para ler RDOs no seu modelo; checado uma vez antes do lote. */
export const assertProjectReadyForUpload = (project: Project | null | undefined): void => {
  if (project?.rdoModel === 'VALE_NOVAS_FERROVIAS' && !project.services?.length) {
    throw new Error('Importe a PQ da obra (aba Tabela de preços) antes de enviar RDOs no modelo Vale.');
  }
};

/** Lê o documento com o modelo de RDO da obra. */
export const extractRDOForProject = async (
  base64: string,
  mimeType: string,
  project: Project | null | undefined
): Promise<RDOData> => {
  assertProjectReadyForUpload(project);
  if (project?.rdoModel === 'VALE_NOVAS_FERROVIAS') {
    return extractValeRDO(base64, mimeType, project!.services);
  }
  return extractRDOData(base64, mimeType);
};
