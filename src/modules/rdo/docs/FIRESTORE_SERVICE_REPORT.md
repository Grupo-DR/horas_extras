# Relatório Técnico — firestoreService.ts

> **Projeto:** Portal Gerenciador — Module Obras
> **Data:** 2026-06-24
> **Arquivo criado:** `services/firestoreService.ts`
> **Status:** CONCLUÍDO — Nenhum arquivo existente foi alterado

---

## 1. Objetivo

Criar `services/firestoreService.ts` replicando com **exatidão** a API pública
de `services/dbService.ts`, substituindo todas as operações AWS DynamoDB por
chamadas equivalentes ao Google Firestore SDK Modular v10+.

---

## 2. Arquivo Criado

### `services/firestoreService.ts`

| Atributo | Valor |
|---|---|
| Caminho | `services/firestoreService.ts` |
| SDK | Firebase Modular v10+ (`firebase/firestore`) |
| Dependência direta | `services/firebase.ts` (instância `db`) |
| Arquivos alterados | **Nenhum** |
| Breaking changes | **Nenhum** |

---

## 3. Mapeamento Completo de Funções

### 3.1 Projects — coleção `projects`

| Função | Parâmetros | Retorno | Op. DynamoDB → Firestore |
|---|---|---|---|
| `getProjects` | — | `Promise<Project[]>` | `ScanCommand` → `getDocs(collection)` |
| `saveProject` | `project: Project` | `Promise<void>` | `PutCommand` → `setDoc(doc, id)` |
| `deleteProject` | `id: string` | `Promise<void>` | `DeleteCommand` → `deleteDoc(doc)` |

### 3.2 Teams — coleção `teams`

| Função | Parâmetros | Retorno | Op. DynamoDB → Firestore |
|---|---|---|---|
| `getTeams` | — | `Promise<Team[]>` | `ScanCommand` → `getDocs(collection)` |
| `saveTeam` | `team: Team` | `Promise<void>` | `PutCommand` → `setDoc(doc, id)` |
| `deleteTeam` | `id: string` | `Promise<void>` | `DeleteCommand` → `deleteDoc(doc)` |

### 3.3 RDOs — coleção `rdos`

| Função | Parâmetros | Retorno | Op. DynamoDB → Firestore |
|---|---|---|---|
| `getRdos` | — | `Promise<RDOData[]>` | `ScanCommand` → `getDocs(collection)` |
| `getRdosByTeam` | `teamId: string` | `Promise<RDOData[]>` | `QueryCommand (GSI teamId-index)` → `query(..., where('teamId', '==', teamId))` |
| `saveRdo` | `rdo: RDOData` | `Promise<void>` | `PutCommand` → `setDoc(doc, id)` |
| `deleteRdo` | `id: string` | `Promise<void>` | `DeleteCommand` → `deleteDoc(doc)` |

### 3.4 Histograms — coleção `histograms`

| Função | Parâmetros | Retorno | Op. DynamoDB → Firestore |
|---|---|---|---|
| `getHistograms` | `projectId: string` | `Promise<HistogramItem[]>` | `QueryCommand (KeyCondition)` → `query(..., where('projectId', '==', id))` |
| `saveHistograms` | `projectId: string, items: HistogramItem[]` | `Promise<void>` | `PutCommand loop` → `writeBatch` (lotes de 500) |
| `deleteHistograms` | `projectId: string` | `Promise<void>` | `DeleteCommand loop` → `writeBatch` (lotes de 500) |

### 3.5 Dimensions — coleção `dimensions`

| Função | Parâmetros | Retorno | Op. DynamoDB → Firestore |
|---|---|---|---|
| `saveDimensions` | `projectId: string, result: DimensionImportResult` | `Promise<void>` | `PutCommand` → `setDoc(doc, projectId)` |
| `getDimensions` | `projectId: string` | `Promise<DimensionStoredRecord \| null>` | `GetCommand` → `getDoc(doc, projectId)` |
| `deleteDimensions` | `projectId: string` | `Promise<void>` | `DeleteCommand` → `deleteDoc(doc)` |

### 3.6 Compositions — coleção `compositions`

| Função | Parâmetros | Retorno | Op. DynamoDB → Firestore |
|---|---|---|---|
| `saveCompositions` | `projectId: string, result: CompositionAIExtractionResult` | `Promise<void>` | `PutCommand` → `setDoc(doc, projectId)` |
| `getCompositions` | `projectId: string` | `Promise<CompositionAIExtractionResult \| null>` | `GetCommand` → `getDoc(doc, projectId)` |
| `deleteCompositions` | `projectId: string` | `Promise<void>` | `DeleteCommand` → `deleteDoc(doc)` |

**Total: 18 funções exportadas — 100% de cobertura da API pública do dbService.ts**

---

## 4. Dependências Necessárias

### 4.1 Pacote NPM

```bash
npm install firebase
```

A versão `firebase@^10.x` já inclui o SDK Modular de Firestore.
Não é necessário nenhum pacote adicional.

### 4.2 Imports do SDK utilizados em firestoreService.ts

```typescript
import {
  collection,    // referência a coleção
  doc,           // referência a documento por ID
  getDocs,       // leitura de coleção inteira (equivale ao Scan)
  getDoc,        // leitura de documento único (equivale ao Get)
  setDoc,        // escrita/substituição (equivale ao Put)
  deleteDoc,     // remoção (equivale ao Delete)
  query,         // criação de query com filtros
  where,         // filtro de campo (equivale ao KeyConditionExpression)
  writeBatch,    // escrita atômica em lote (melhoria sobre loop de Put/Delete)
} from "firebase/firestore";
```

### 4.3 Variáveis de ambiente necessárias (.env)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

---

## 5. Decisões de Implementação

### 5.1 writeBatch para Histogramas (melhoria sobre o dbService original)

O `dbService.ts` original usa um loop de `PutCommand` sequencial para salvar
histogramas. O `firestoreService.ts` usa `writeBatch` com divisão automática
em lotes de 500 documentos (limite do Firestore), o que:
- Reduz latência (operações paralelas no servidor)
- Garante atomicidade por lote
- Mantém compatibilidade total com o comportamento externo

### 5.2 Fallback para localStorage preservado

Todos os fallbacks de localStorage presentes no `dbService.ts` foram mantidos
com comportamento idêntico:

| Função | Comportamento de fallback |
|---|---|
| `getHistograms` | `localStorage.getItem('histograms_${projectId}')` em caso de erro |
| `saveHistograms` | `localStorage.setItem(...)` no `finally` (dual-write) |
| `deleteHistograms` | `localStorage.removeItem(...)` no `finally` |
| `saveDimensions` | `localStorage.setItem(...)` **antes** da chamada Firestore |
| `getDimensions` | `localStorage.getItem(...)` em caso de erro |
| `deleteDimensions` | `localStorage.removeItem(...)` **antes** da chamada Firestore |
| `saveCompositions` | `localStorage.setItem(...)` no `finally` (dual-write) |
| `getCompositions` | `localStorage.getItem(...)` em caso de erro |
| `deleteCompositions` | `localStorage.removeItem(...)` **antes** da chamada Firestore |

### 5.3 Document IDs no Firestore

| Coleção | Document ID | Justificativa |
|---|---|---|
| `projects` | `project.id` | UUID gerado pela aplicação |
| `teams` | `team.id` | UUID gerado pela aplicação |
| `rdos` | `rdo.id` | UUID gerado pela aplicação |
| `histograms` | `item.id` | UUID por item individual |
| `dimensions` | `projectId` | 1 documento por projeto (chave natural) |
| `compositions` | `projectId` | 1 documento por projeto (chave natural) |

---

## 6. Regras Firestore Recomendadas (Firebase Console)

Para desenvolvimento inicial, configure as Security Rules como:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // APENAS para desenvolvimento
    }
  }
}
```

Para produção, substitua pela regra adequada ao modelo de autenticação do projeto.

---

## 7. Índices Firestore Necessários

### Índice simples (criado automaticamente pelo Firestore)
- Coleção `histograms`, campo `projectId` (ascending) — criado automaticamente no primeiro uso

### Índice composto (necessário apenas se orderBy for adicionado no futuro)
- Coleção `rdos`, campos `teamId` (ascending) + `date` (descending)

Para criar índices, acesse o **Firebase Console → Firestore → Índices**.

---

## 8. Próximos Passos

```
PASSO 1 — Instalar Firebase SDK (se ainda não instalado)
  npm install firebase

PASSO 2 — Preencher variáveis VITE_FIREBASE_* no .env

PASSO 3 — Testar firestoreService.ts em ambiente de desenvolvimento

PASSO 4 — Quando validado, substituir o import em dbService consumidores:
  Alterar: import * as db from './services/dbService';
  Para:    import * as db from './services/firestoreService';
  (Em: App.tsx, RDOList.tsx, HistogramAnalysis.tsx)

  Alterar imports named em:
  - ContractIntelligence/DimensionsUpload.tsx
  - ContractIntelligence/CompositionsUpload.tsx
  - ContractIntelligence/ContractIntelligencePage.tsx

PASSO 5 — Após validação completa:
  - Remover services/awsConfig.ts
  - Remover services/dbService.ts (ou manter como legado com deprecation notice)
  - Remover @aws-sdk/* do package.json
```

---

## 9. Garantias de Compatibilidade

| Requisito | Status |
|---|---|
| Mesmo nome de função | GARANTIDO — 18/18 funções com nomes idênticos |
| Mesmos parâmetros | GARANTIDO — verificado tipo a tipo |
| Mesmos tipos de retorno | GARANTIDO — verificado tipo a tipo |
| Mesma tipagem TypeScript | GARANTIDO — mesmos imports de types.ts e analyticsTypes.ts |
| Nenhum componente React alterado | GARANTIDO — zero modificações em components/ |
| App.tsx não alterado | GARANTIDO |
| types.ts não alterado | GARANTIDO |
| Breaking changes | NENHUM |
