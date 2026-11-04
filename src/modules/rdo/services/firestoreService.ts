/**
 * services/firestoreService.ts
 *
 * Implementação Firestore de toda a API pública de services/dbService.ts.
 *
 * REGRAS GARANTIDAS:
 *   - Nomes de função idênticos ao dbService
 *   - Parâmetros idênticos ao dbService
 *   - Tipos de retorno idênticos ao dbService
 *   - Nenhum componente React, App.tsx ou types.ts foi alterado
 *   - Nenhuma breaking change introduzida
 *
 * Coleções Firestore:
 *   projects      → substitui DynamoDB Obras_Projects (agora construction_projects)
 *   teams         → substitui DynamoDB Obras_Teams (agora construction_teams)
 *   rdos          → substitui DynamoDB Obras_RDOs (agora construction_rdos)
 *   histograms    → substitui DynamoDB Obras_Histograms (agora construction_histograms)
 *   dimensions    → substitui DynamoDB Obras_Dimensions (agora construction_dimensions)
 *   compositions  → substitui DynamoDB Obras_Compositions (agora construction_compositions)
 *
 * Dependência: services/firebase.ts (instância `db` do Firestore SDK v10+)
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { Project, Team, RDOData, HistogramItem } from "../types";
import {
  DimensionStoredRecord,
  DimensionImportResult,
  CompositionAIExtractionResult,
} from "../src/analytics/types/analyticsTypes";

// ---------------------------------------------------------------------------
// Nomes das coleções Firestore
// ---------------------------------------------------------------------------

import { COLLECTIONS } from "../src/constants/firestoreCollections";
import { withFirestoreError } from "./firestoreErrors";

// ===========================================================================
// Project Operations
// ===========================================================================

/**
 * Retorna todos os projetos da coleção `construction_projects`.
 * Equivalente DynamoDB: ScanCommand → Obras_Projects
 */
export const getProjects = async (): Promise<Project[]> => {
  const snapshot = await getDocs(collection(db, COLLECTIONS.PROJECTS));
  return snapshot.docs.map((d) => d.data() as Project);
};

/**
 * Cria ou substitui um projeto pelo seu `id`.
 * Equivalente DynamoDB: PutCommand → Obras_Projects
 */
export const saveProject = async (project: Project): Promise<void> => {
  await setDoc(doc(db, COLLECTIONS.PROJECTS, project.id), project);
};

/**
 * Remove um projeto pelo seu `id`.
 * Equivalente DynamoDB: DeleteCommand → Obras_Projects Key: { id }
 */
export const deleteProject = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTIONS.PROJECTS, id));
};

// ===========================================================================
// Team Operations
// ===========================================================================

/**
 * Retorna todas as equipes da coleção `construction_teams`.
 * Equivalente DynamoDB: ScanCommand → Obras_Teams
 */
export const getTeams = async (): Promise<Team[]> => {
  const snapshot = await getDocs(collection(db, COLLECTIONS.TEAMS));
  return snapshot.docs.map((d) => d.data() as Team);
};

/**
 * Cria ou substitui uma equipe pelo seu `id`.
 * Equivalente DynamoDB: PutCommand → Obras_Teams
 */
export const saveTeam = async (team: Team): Promise<void> => {
  await setDoc(doc(db, COLLECTIONS.TEAMS, team.id), team);
};

/**
 * Remove uma equipe pelo seu `id`.
 * Equivalente DynamoDB: DeleteCommand → Obras_Teams Key: { id }
 */
export const deleteTeam = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTIONS.TEAMS, id));
};

// ===========================================================================
// RDO Operations
// ===========================================================================

/**
 * Retorna todos os RDOs da coleção `construction_rdos`.
 * Equivalente DynamoDB: ScanCommand → Obras_RDOs
 */
export const getRdos = async (): Promise<RDOData[]> => {
  const snapshot = await getDocs(collection(db, COLLECTIONS.RDOS));
  return snapshot.docs.map((d) => d.data() as RDOData);
};

/**
 * Retorna os RDOs filtrados por `teamId`.
 * Equivalente DynamoDB: QueryCommand com GSI teamId-index
 *
 * Nota: Requer índice composto no Firebase Console se combinado com orderBy.
 * Para uso atual (filtro simples), nenhum índice composto é necessário.
 */
export const getRdosByTeam = async (teamId: string): Promise<RDOData[]> => {
  const q = query(
    collection(db, COLLECTIONS.RDOS),
    where("teamId", "==", teamId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as RDOData);
};

/**
 * Cria ou substitui um RDO pelo seu `id`.
 * Equivalente DynamoDB: PutCommand → Obras_RDOs
 */
export const saveRdo = async (rdo: RDOData): Promise<void> => {
  await setDoc(doc(db, COLLECTIONS.RDOS, rdo.id), rdo);
};

/**
 * Remove um RDO pelo seu `id`.
 * Equivalente DynamoDB: DeleteCommand → Obras_RDOs Key: { id }
 */
export const deleteRdo = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTIONS.RDOS, id));
};

// ===========================================================================
// Histogram Operations
// ===========================================================================
//
// Até a versão 1.4.2 histogramas, dimensões e composições também eram gravados
// no localStorage, e falhas do Firestore eram ignoradas: o usuário via "Salvo!"
// com o dado só no próprio navegador. Agora o Firestore é a única fonte e
// qualquer falha chega à tela. Cópias antigas do navegador são recuperadas por
// services/localRecoveryService.ts.

const BATCH_LIMIT = 500;

type BatchOp = (batch: ReturnType<typeof writeBatch>) => void;

/** Aplica operações em lotes de até 500 (limite do writeBatch). */
const commitInBatches = async (ops: BatchOp[]): Promise<void> => {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
    await batch.commit();
  }
};

/** Retorna os itens do histograma de um projeto. */
export const getHistograms = async (projectId: string): Promise<HistogramItem[]> =>
  withFirestoreError("carregar o histograma", async () => {
    const q = query(
      collection(db, COLLECTIONS.HISTOGRAMS),
      where("projectId", "==", projectId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as HistogramItem);
  });

/**
 * Substitui o histograma de um projeto pelos itens informados.
 * Itens que existiam no banco e não estão mais na lista são apagados
 * (antes, item excluído na tela voltava ao recarregar).
 */
export const saveHistograms = async (
  projectId: string,
  items: HistogramItem[]
): Promise<void> =>
  withFirestoreError("salvar o histograma", async () => {
    const existing = await getDocs(
      query(collection(db, COLLECTIONS.HISTOGRAMS), where("projectId", "==", projectId))
    );
    const keep = new Set(items.map((item) => item.id));
    const ops: BatchOp[] = [
      ...items.map((item): BatchOp => (batch) =>
        batch.set(doc(db, COLLECTIONS.HISTOGRAMS, item.id), { ...item, projectId })
      ),
      ...existing.docs
        .filter((d) => !keep.has(d.id))
        .map((d): BatchOp => (batch) => batch.delete(d.ref)),
    ];
    await commitInBatches(ops);
  });

/** Remove todos os itens do histograma de um projeto. */
export const deleteHistograms = async (projectId: string): Promise<void> =>
  withFirestoreError("excluir o histograma", async () => {
    const existing = await getDocs(
      query(collection(db, COLLECTIONS.HISTOGRAMS), where("projectId", "==", projectId))
    );
    await commitInBatches(existing.docs.map((d): BatchOp => (batch) => batch.delete(d.ref)));
  });

// ===========================================================================
// Dimensions Operations (Contract Intelligence)
// ===========================================================================

/** Persiste as dimensões de uma obra (Document ID = projectId, substitui o anterior). */
export const saveDimensions = async (
  projectId: string,
  result: DimensionImportResult
): Promise<void> => {
  const record: DimensionStoredRecord = {
    projectId,
    type: "DIMENSIONS",
    items:     result.items,
    holidays:  result.holidays,
    metadata:  result.metadata,
    updatedAt: new Date().toISOString(),
  };
  await saveDimensionRecord(record);
};

/** Grava um registro de dimensões já montado (usado também na recuperação de cópias locais). */
export const saveDimensionRecord = async (record: DimensionStoredRecord): Promise<void> =>
  withFirestoreError("salvar as dimensões", () =>
    setDoc(doc(db, COLLECTIONS.DIMENSIONS, record.projectId), record)
  );

/** Recupera as dimensões de uma obra. */
export const getDimensions = async (
  projectId: string
): Promise<DimensionStoredRecord | null> =>
  withFirestoreError("carregar as dimensões", async () => {
    const snap = await getDoc(doc(db, COLLECTIONS.DIMENSIONS, projectId));
    return snap.exists() ? (snap.data() as DimensionStoredRecord) : null;
  });

/** Remove as dimensões de uma obra. */
export const deleteDimensions = async (projectId: string): Promise<void> =>
  withFirestoreError("excluir as dimensões", () =>
    deleteDoc(doc(db, COLLECTIONS.DIMENSIONS, projectId))
  );

// ===========================================================================
// Compositions Operations (Sprint 3 Revisada)
// ===========================================================================

/** Persiste as composições de IA de uma obra (Document ID = projectId). */
export const saveCompositions = async (
  projectId: string,
  result: CompositionAIExtractionResult
): Promise<void> =>
  withFirestoreError("salvar as composições", () =>
    setDoc(doc(db, COLLECTIONS.COMPOSITIONS, projectId), {
      projectId,
      ...result,
      updatedAt: new Date().toISOString(),
    })
  );

/** Recupera as composições de IA de uma obra. */
export const getCompositions = async (
  projectId: string
): Promise<CompositionAIExtractionResult | null> =>
  withFirestoreError("carregar as composições", async () => {
    const snap = await getDoc(doc(db, COLLECTIONS.COMPOSITIONS, projectId));
    return snap.exists() ? (snap.data() as CompositionAIExtractionResult) : null;
  });

/** Remove as composições de IA de uma obra. */
export const deleteCompositions = async (projectId: string): Promise<void> =>
  withFirestoreError("excluir as composições", () =>
    deleteDoc(doc(db, COLLECTIONS.COMPOSITIONS, projectId))
  );
