# Relatório Técnico — Migração DynamoDB → Firestore

> **Projeto:** Portal Gerenciador — Module Obras
> **Data:** 2026-06-24
> **Status:** ANÁLISE CONCLUÍDA — Nenhuma modificação realizada

---

## 1. Arquivos que Utilizam AWS / DynamoDB

### 1.1 Camada de Serviço (infraestrutura AWS direta)

| Arquivo | Papel | Dependência AWS |
|---|---|---|
| `services/awsConfig.ts` | Configuração do cliente DynamoDB | `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb` |
| `services/dbService.ts` | Todas as operações CRUD contra o DynamoDB | `@aws-sdk/lib-dynamodb` (via awsConfig) |

### 1.2 Componentes / Orchestradores que consomem dbService

| Arquivo | Funções Importadas |
|---|---|
| `App.tsx` | `db.getProjects`, `db.getTeams`, `db.getRdos`, `db.saveProject`, `db.saveTeam`, `db.saveRdo`, `db.deleteProject`, `db.deleteTeam`, `db.deleteRdo` |
| `App_fixed.tsx` | Cópia/variante de App.tsx — mesmo padrão de importação |
| `components/RDOList.tsx` | `db.*` (namespace import) |
| `components/HistogramAnalysis.tsx` | `db.*` (namespace import) — salva/carrega histogramas |
| `components/ContractIntelligence/DimensionsUpload.tsx` | `saveDimensions`, `getDimensions`, `deleteDimensions` |
| `components/ContractIntelligence/CompositionsUpload.tsx` | `saveCompositions`, `getCompositions`, `deleteCompositions` |
| `components/ContractIntelligence/ContractIntelligencePage.tsx` | `getDimensions`, `getCompositions` |

### 1.3 Infraestrutura declarativa AWS

| Arquivo | Descrição |
|---|---|
| `aws_infrastructure.yaml` | CloudFormation template com tabelas DynamoDB e IAM policy |

### 1.4 Serviços SEM dependência AWS (apenas localStorage)

| Arquivo | Mecanismo |
|---|---|
| `services/contractDataService.ts` | 100% localStorage — sem AWS |
| `services/dailyPlanService.ts` | 100% localStorage — sem AWS |
| `services/histogramService.ts` | Parser de Excel — sem AWS |
| `services/geminiService.ts` | Google Gemini AI — sem AWS |

---

## 2. Dependências AWS Encontradas

### 2.1 package.json — dependências de produção

```json
"@aws-sdk/client-dynamodb": "^3.1019.0",
"@aws-sdk/lib-dynamodb":    "^3.1019.0"
```

> ATENÇÃO: O AWS SDK v3 adiciona ~300-500 KB ao bundle. A remoção reduzirá significativamente o tamanho.

### 2.2 Variáveis de ambiente (.env)

```
VITE_AWS_REGION=us-east-1
VITE_AWS_ACCESS_KEY_ID=AKIAREDID2CK5DJY2QWE         <- CREDENCIAL EXPOSTA
VITE_AWS_SECRET_ACCESS_KEY=pmALOQf4...               <- SECRET EXPOSTO
VITE_DYNAMODB_TABLE_PROJECTS=Obras_Projects
VITE_DYNAMODB_TABLE_TEAMS=Obras_Teams
VITE_DYNAMODB_TABLE_RDOS=Obras_RDOs
```

> **RISCO CRÍTICO DE SEGURANÇA:** As credenciais AWS com prefixo `VITE_` são injetadas no
> bundle JavaScript do browser. Essas chaves devem ser **revogadas imediatamente** no AWS IAM
> Console, independentemente da migração.

### 2.3 Tabelas DynamoDB mapeadas (awsConfig.ts)

| Chave lógica | Nome da tabela | Chave primária | Índice GSI |
|---|---|---|---|
| `TABLES.PROJECTS` | `Obras_Projects` | `id` (HASH) | — |
| `TABLES.TEAMS` | `Obras_Teams` | `id` (HASH) | — |
| `TABLES.RDOS` | `Obras_RDOs` | `id` (HASH) | `teamId-index` (GSI) |
| `TABLES.HISTOGRAMS` | `Obras_Histograms` | `id` (HASH) | `projectId` (KeyCondition) |
| `TABLES.DIMENSIONS` | `Obras_Dimensions` | `projectId` (HASH) | — |
| `TABLES.COMPOSITIONS` | `Obras_Compositions` | `projectId` (HASH) | — |

> Nota: As tabelas HISTOGRAMS, DIMENSIONS e COMPOSITIONS não estão no CloudFormation,
> indicando criação manual ou planejada para sprint futura.

---

## 3. Fluxo Atual de Persistência

```
App.tsx (mount)
└── initData()
    ├── db.getProjects()  ──────► DynamoDB Obras_Projects
    ├── db.getTeams()     ──────► DynamoDB Obras_Teams
    └── db.getRdos()      ──────► DynamoDB Obras_RDOs
        (fallback localStorage se DynamoDB falhar)

    Se !isSynced && projetos vazios:
    ├── Migra localStorage → DynamoDB (dados locais antigos)
    └── Seed MOCK_DATA → DynamoDB (dados de demo)

Operações CRUD (runtime):
├── saveProject/Team/Rdo   ──────► DynamoDB (PutItem)
├── deleteProject/Team/Rdo ──────► DynamoDB (DeleteItem)
├── saveHistograms   ──────────► DynamoDB + localStorage (dual write)
├── getHistograms    ──────────► DynamoDB (fallback localStorage)
├── saveDimensions   ──────────► localStorage + DynamoDB (dual write)
├── getDimensions    ──────────► DynamoDB (fallback localStorage)
├── saveCompositions ──────────► DynamoDB + localStorage (dual write)
└── getCompositions  ──────────► DynamoDB (fallback localStorage)

Dados 100% localStorage (sem AWS):
├── contractDataService: ContractData por projectId
└── dailyPlanService:    DailyPlan[] (key: 'daily_plans')
```

### Mapeamento de operações DynamoDB → Firestore

| Operação DynamoDB | Equivalente Firestore |
|---|---|
| `ScanCommand` | `getDocs(collection(db, 'nome'))` |
| `PutCommand` | `setDoc(doc(db, 'nome', id), data)` |
| `DeleteCommand` | `deleteDoc(doc(db, 'nome', id))` |
| `GetCommand` | `getDoc(doc(db, 'nome', id))` |
| `QueryCommand (KeyCondition)` | `query(collection(...), where('campo', '==', valor))` |

---

## 4. Riscos da Migração

### Risco ALTO

| # | Risco | Detalhe |
|---|---|---|
| R1 | **Credenciais AWS expostas no bundle** | VITE_AWS_* são injetadas no JS do browser. Revogar imediatamente. |
| R2 | **Perda de dados em produção** | Exportar dados do DynamoDB antes de desativar tabelas. |
| R3 | **Regras de segurança Firestore** | Por padrão, novas coleções bloqueiam leituras/escritas. Security Rules devem ser configuradas antes do deploy. |
| R4 | **getRdosByTeam usa GSI** | DynamoDB usa índice `teamId-index`. No Firestore, `where('teamId', '==', id)` pode requerer índice composto se combinado com ordenação. |

### Risco MÉDIO

| # | Risco | Detalhe |
|---|---|---|
| R5 | **Tamanho de documento Firestore** | Limite de 1 MB por documento. Arrays monthlyPlan[] e activities[] podem crescer. |
| R6 | **Fallback localStorage** | Após migração, revisar comportamento de fallback para evitar inconsistências. |
| R7 | **contractDataService e dailyPlanService** | Não migram nesta fase. Escopo futuro pode exigir migração. |
| R8 | **App_fixed.tsx** | Verificar se é arquivo ativo ou legado antes de migrar. |

### Risco BAIXO

| # | Risco | Detalhe |
|---|---|---|
| R9 | **Autenticação Firebase** | Projeto sem autenticação. Usar `allow read, write: if true` apenas temporariamente em dev. |
| R10 | **Bundle size** | AWS SDK ~400 KB → Firebase SDK ~200 KB. Redução esperada. |

---

## 5. Mapeamento de Coleções Firestore

```
firestore/
├── projects/       ← substitui Obras_Projects    (Document ID = project.id)
├── teams/          ← substitui Obras_Teams        (Document ID = team.id)
├── rdos/           ← substitui Obras_RDOs         (Document ID = rdo.id)
├── histograms/     ← substitui Obras_Histograms   (Document ID = item.id)
├── dimensions/     ← substitui Obras_Dimensions   (Document ID = projectId)
└── compositions/   ← substitui Obras_Compositions (Document ID = projectId)
```

---

## 6. Ordem Recomendada de Execução

### FASE 0 — Segurança Imediata (ANTES DE TUDO)
- [0.1] Revogar as chaves AWS IAM no Console AWS
- [0.2] Remover VITE_AWS_ACCESS_KEY_ID e VITE_AWS_SECRET_ACCESS_KEY do .env
- [0.3] Verificar que .env está no .gitignore

### FASE 1 — Infraestrutura Firebase (sem quebrar nada)
- [1.1] Instalar firebase SDK: `npm install firebase`
- [1.2] Criar projeto no Firebase Console (caso não exista)
- [1.3] Criar `services/firebase.ts` (app + db) ← **JÁ ENTREGUE NESTA SESSÃO**
- [1.4] Adicionar variáveis VITE_FIREBASE_* ao .env

### FASE 2 — Migração de dados existentes (se houver dados em produção)
- [2.1] Exportar dados do DynamoDB (`aws dynamodb scan --table-name ...`)
- [2.2] Criar script de importação para Firestore (Node.js + firebase-admin)
- [2.3] Executar importação e validar contagens

### FASE 3 — Substituição de dbService.ts
- [3.1] Reescrever `services/dbService.ts` usando Firestore SDK
         (mesmas assinaturas de função — zero impacto nos consumidores)
- [3.2] Remover import de awsConfig.ts do novo dbService.ts

### FASE 4 — Configurar Firestore Security Rules
- [4.1] Definir regras de leitura/escrita no Firebase Console
- [4.2] Criar índices compostos necessários (ex: rdos por teamId)

### FASE 5 — Remoção de AWS
- [5.1] Deletar `services/awsConfig.ts`
- [5.2] Remover `@aws-sdk/client-dynamodb` e `@aws-sdk/lib-dynamodb` do package.json
- [5.3] Executar `npm install` para limpar node_modules
- [5.4] Remover variáveis VITE_AWS_* e VITE_DYNAMODB_TABLE_* do .env
- [5.5] Arquivar ou deletar `aws_infrastructure.yaml`

### FASE 6 — Validação
- [6.1] Executar `npm run build` sem erros TypeScript
- [6.2] Testar CRUD completo (projetos, equipes, RDOs)
- [6.3] Testar histogramas, dimensões e composições
- [6.4] Validar que contractDataService e dailyPlanService continuam funcionando

---

## 7. Resumo Executivo

| Métrica | Valor |
|---|---|
| **Arquivos com código AWS direto** | 2 (`awsConfig.ts`, `dbService.ts`) |
| **Arquivos consumidores de dbService** | 7 |
| **Arquivos SEM dependência AWS** | 4 |
| **Pacotes NPM a remover** | 2 |
| **Pacotes NPM a adicionar** | 1 (`firebase`) |
| **Coleções Firestore a criar** | 6 |
| **Funções a reescrever em dbService.ts** | 18 |
| **Impacto em componentes de UI** | ZERO (interfaces públicas preservadas) |
| **Risco geral** | MÉDIO — mitigado pela arquitetura de serviço isolado |

> A estratégia central é substituir apenas `awsConfig.ts` e `dbService.ts` mantendo as
> mesmas assinaturas de função exportadas. Nenhum componente de interface ou regra de
> negócio precisa ser alterado.
