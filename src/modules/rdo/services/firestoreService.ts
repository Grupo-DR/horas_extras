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

/**
 * Retorna os itens do histograma de um projeto.
 * Mantém fallback para localStorage caso o Firestore falhe (comportamento
 * idêntico ao dbService.ts original).
 *
 * Equivalente DynamoDB: QueryCommand com KeyConditionExpression projectId
 */
export const getHistograms = async (projectId: string): Promise<HistogramItem[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.HISTOGRAMS),
      where("projectId", "==", projectId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as HistogramItem);
  } catch (e) {
    console.warn("Firestore Histogram query failed, falling back to localStorage", e);
    const local = localStorage.getItem(`histograms_${projectId}`);
    return local ? JSON.parse(local) : [];
  }
};

/**
 * Persiste os itens do histograma de um projeto.
 * Usa escritas em lote (writeBatch) para atomicidade — mais eficiente que
 * o loop sequential de PutCommand do dbService original.
 * Mantém o mesmo comportamento de dual-write com localStorage como cache.
 *
 * Equivalente DynamoDB: PutCommand em loop → Obras_Histograms
 *
 * Limitação Firestore: writeBatch suporta até 500 operações por lote.
 * Para projetos com mais de 500 itens de histograma, os lotes são divididos
 * automaticamente.
 */
export const saveHistograms = async (
  projectId: string,
  items: HistogramItem[]
): Promise<void> => {
  try {
    // Divide em lotes de 500 (limite do Firestore writeBatch)
    const BATCH_LIMIT = 500;
    for (let i = 0; i < items.length; i += BATCH_LIMIT) {
      const chunk = items.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      for (const item of chunk) {
        const ref = doc(db, COLLECTIONS.HISTOGRAMS, item.id);
        batch.set(ref, item);
      }
      await batch.commit();
    }
  } catch (e) {
    console.warn("Firestore Histogram save failed, falling back to localStorage", e);
  } finally {
    // Dual-write: mantém cache local (comportamento idêntico ao dbService)
    localStorage.setItem(`histograms_${projectId}`, JSON.stringify(items));
  }
};

/**
 * Remove todos os itens do histograma de um projeto.
 * Busca os documentos pelo campo `projectId` e os deleta em lote.
 * Mantém limpeza do localStorage (comportamento idêntico ao dbService).
 *
 * Equivalente DynamoDB: DeleteCommand em loop → Obras_Histograms
 */
export const deleteHistograms = async (projectId: string): Promise<void> => {
  try {
    const items = await getHistograms(projectId);
    if (items.length > 0) {
      const BATCH_LIMIT = 500;
      for (let i = 0; i < items.length; i += BATCH_LIMIT) {
        const chunk = items.slice(i, i + BATCH_LIMIT);
        const batch = writeBatch(db);
        for (const item of chunk) {
          batch.delete(doc(db, COLLECTIONS.HISTOGRAMS, item.id));
        }
        await batch.commit();
      }
    }
  } catch (e) {
    console.warn("Firestore Histogram delete failed", e);
  } finally {
    localStorage.removeItem(`histograms_${projectId}`);
  }
};

// ===========================================================================
// Dimensions Operations (Contract Intelligence)
// ===========================================================================

/**
 * Persiste as dimensões de uma obra no Firestore (coleção `construction_dimensions`).
 * Estratégia: setDoc com Document ID = projectId (substitui o registro anterior).
 * Sempre persiste no localStorage como cache local antes de gravar no Firestore.
 *
 * Equivalente DynamoDB: PutCommand → Obras_Dimensions Key: { projectId }
 */
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

  // Sempre persiste no localStorage como cache local
  localStorage.setItem(`dimensions_${projectId}`, JSON.stringify(record));

  try {
    await setDoc(doc(db, COLLECTIONS.DIMENSIONS, projectId), record);
  } catch (e) {
    console.warn(
      `Firestore Dimensions save failed for project ${projectId} — dados salvos em localStorage.`,
      e
    );
  }
};

/**
 * Recupera as dimensões de uma obra.
 * Tenta Firestore primeiro; usa localStorage como fallback.
 *
 * Equivalente DynamoDB: GetCommand → Obras_Dimensions Key: { projectId }
 */
export const getDimensions = async (
  projectId: string
): Promise<DimensionStoredRecord | null> => {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.DIMENSIONS, projectId));
    if (snap.exists()) return snap.data() as DimensionStoredRecord;
  } catch (e) {
    console.warn(
      `Firestore Dimensions get failed for project ${projectId} — tentando localStorage.`,
      e
    );
  }

  // Fallback: localStorage
  const local = localStorage.getItem(`dimensions_${projectId}`);
  return local ? (JSON.parse(local) as DimensionStoredRecord) : null;
};

/**
 * Remove as dimensões de uma obra do Firestore e do localStorage.
 *
 * Equivalente DynamoDB: DeleteCommand → Obras_Dimensions Key: { projectId }
 */
export const deleteDimensions = async (projectId: string): Promise<void> => {
  localStorage.removeItem(`dimensions_${projectId}`);
  try {
    await deleteDoc(doc(db, COLLECTIONS.DIMENSIONS, projectId));
  } catch (e) {
    console.warn(`Firestore Dimensions delete failed for project ${projectId}.`, e);
  }
};

// ===========================================================================
// Compositions Operations (Sprint 3 Revisada)
// ===========================================================================

/**
 * Persiste as composições de IA de uma obra no Firestore (coleção `construction_compositions`).
 * Document ID = projectId. Dual-write com localStorage.
 *
 * Equivalente DynamoDB: PutCommand → Obras_Compositions Key: { projectId }
 */
export const saveCompositions = async (
  projectId: string,
  result: CompositionAIExtractionResult
): Promise<void> => {
  try {
    await setDoc(doc(db, COLLECTIONS.COMPOSITIONS, projectId), {
      projectId,
      ...result,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("Firestore Compositions save failed, falling back to localStorage", e);
  } finally {
    localStorage.setItem(`compositions_${projectId}`, JSON.stringify(result));
  }
};

/**
 * Recupera as composições de IA de uma obra.
 * Tenta Firestore primeiro; usa localStorage como fallback.
 *
 * Equivalente DynamoDB: GetCommand → Obras_Compositions Key: { projectId }
 */
export const getCompositions = async (
  projectId: string
): Promise<CompositionAIExtractionResult | null> => {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.COMPOSITIONS, projectId));
    if (snap.exists()) return snap.data() as CompositionAIExtractionResult;
  } catch (e) {
    console.warn(
      `Firestore Compositions get failed for project ${projectId} — tentando localStorage.`,
      e
    );
  }

  // Fallback: localStorage
  const local = localStorage.getItem(`compositions_${projectId}`);
  return local ? (JSON.parse(local) as CompositionAIExtractionResult) : null;
};

/**
 * Remove as composições de IA de uma obra do Firestore e do localStorage.
 *
 * Equivalente DynamoDB: DeleteCommand → Obras_Compositions Key: { projectId }
 */
export const deleteCompositions = async (projectId: string): Promise<void> => {
  localStorage.removeItem(`compositions_${projectId}`);
  try {
    await deleteDoc(doc(db, COLLECTIONS.COMPOSITIONS, projectId));
  } catch (e) {
    console.warn(`Firestore Compositions delete failed for project ${projectId}.`, e);
  }
};
