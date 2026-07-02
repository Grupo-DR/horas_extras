# Documentação Técnica — Portal Gerenciador (Module Obras)

> **Versão:** 2.0 (pós-migração Firestore)
> **Última atualização:** 2026-06-24
> **Responsável:** Equipe de Engenharia — DR Construtora

---

## 1. Visão Geral do Sistema

O **Portal Gerenciador — Module Obras** é uma aplicação web Single Page Application
(SPA) para gestão operacional de obras de construção civil. Permite:

- **Gestão de Obras (Projects):** Cadastro, status e dados contratuais
- **Gestão de Equipes (Teams):** Alocação por obra com controle de orçamento
- **Relatório Diário de Obra (RDO):** Registro de atividades, mão de obra e equipamentos
- **Análise de Histograma:** Comparativo planejado vs. realizado de MO e Equipamentos
- **Contract Intelligence:** Extração inteligente de dimensões e composições via IA (Gemini)
- **Planejamento:** Registro de valores planejados por equipe por data

### Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework UI | React | 19.2.4 |
| Linguagem | TypeScript | 5.8.x |
| Build Tool | Vite | 6.2.x |
| Banco de Dados | Google Firestore | firebase@12.15.0 |
| IA Generativa | Google Gemini | @google/genai@1.40.0 |
| Gráficos | Recharts | 3.7.x |
| Ícones | Lucide React | 0.563.x |
| Excel | SheetJS (xlsx) | 0.18.5 |

---

## 2. Estrutura de Pastas

```
module_Obras/
│
├── App.tsx                    # Componente raiz — estado global + CRUD principal
├── App_fixed.tsx              # Variante legada de App.tsx (consolidar futuramente)
├── index.tsx                  # Entry point React — monta <App /> no DOM
├── index.html                 # Template HTML do Vite
├── types.ts                   # Todos os tipos de domínio (Project, Team, RDO, etc.)
├── utils.ts                   # Utilitários globais (formatMoney, parseDate, generateUUID)
├── index.css                  # Estilos globais
├── vite.config.ts             # Configuração do Vite (porta 3000, alias @, env)
├── tsconfig.json              # Configuração TypeScript
├── package.json               # Dependências e scripts
├── .env                       # Variáveis de ambiente (NÃO versionar)
│
├── services/                  # Camada de serviços externos
│   ├── firebase.ts            # Inicialização Firebase SDK (singleton)
│   ├── firestoreService.ts    # 19 funções CRUD para Firestore
│   ├── contractDataService.ts # Dados contratuais (localStorage)
│   ├── dailyPlanService.ts    # Planejamento diário (localStorage)
│   ├── histogramService.ts    # Parser de histogramas Excel
│   └── geminiService.ts       # Chamadas Google Gemini AI
│
├── components/                # Componentes React principais
│   ├── App.tsx-related components...
│   ├── Breadcrumbs.tsx
│   ├── ContractAnalysisTab.tsx
│   ├── ContractDataTab.tsx
│   ├── DailyBreakdownTable.tsx
│   ├── DashboardCharts.tsx
│   ├── FinancialTable.tsx
│   ├── HistogramAnalysis.tsx  # Importa firestoreService
│   ├── InfoCards.tsx
│   ├── PlanningTab.tsx
│   ├── ProductionAnalysis.tsx
│   ├── ProductionPriceTable.tsx
│   ├── ProjectList.tsx
│   ├── ProjectServices.tsx
│   ├── RDODetail.tsx
│   ├── RDOEditForm.tsx
│   ├── RDOList.tsx            # Importa firestoreService
│   ├── TeamList.tsx
│   └── ContractIntelligence/
│       ├── CompositionsUpload.tsx     # Importa firestoreService
│       ├── ContractIntelligencePage.tsx # Importa firestoreService
│       └── DimensionsUpload.tsx       # Importa firestoreService
│
├── data/
│   └── mockData.ts            # Dados mock para inicialização/seed
│
├── utils/
│   ├── excelExportUtils.ts
│   ├── histogramUtils.ts
│   └── ...
│
├── src/                       # Módulo analytics (submódulo independente)
│   ├── analytics/
│   │   ├── core/              # Lógica de negócio analytics
│   │   ├── engines/           # Motores de processamento
│   │   ├── exporters/         # Exportadores de dados
│   │   ├── parsers/           # Parsers de arquivos Excel/PDF
│   │   └── types/
│   │       └── analyticsTypes.ts  # Tipos do módulo analytics
│   ├── components/            # Componentes exclusivos do módulo analytics
│   └── services/
│       └── compositionAIService.ts  # Integração IA para composições
│
└── docs/                      # Documentação técnica
    ├── ARCHITECTURE.md        # Este arquivo
    ├── ARCHITECTURE_REVIEW.md # Revisão arquitetural pós-migração
    ├── HANDOVER.md            # Guia de transferência
    ├── MIGRATION_FINAL_REPORT.md
    ├── FIRESTORE_MIGRATION_ANALYSIS.md
    ├── FIRESTORE_SERVICE_REPORT.md
    ├── PERSISTENCE_SWAP_REPORT.md
    ├── AWS_AUDIT_REPORT.md
    ├── AWS_REMOVAL_REPORT.md
    └── POST_MIGRATION_VALIDATION.md
```

---

## 3. Fluxo de Dados

### 3.1 Inicialização da Aplicação

```
Browser
  └── index.html
        └── index.tsx  →  ReactDOM.createRoot() → <App />
              └── App.tsx
                    ├── useEffect (mount)
                    │     ├── db.getProjects()  → firestoreService → Firestore
                    │     ├── db.getTeams()     → firestoreService → Firestore
                    │     └── db.getRdos()      → firestoreService → Firestore
                    └── setState(projects, teams, rdos)
```

### 3.2 Persistência de Dados

```
Usuário (UI Action)
  └── App.tsx handler (ex: handleSaveProject)
        └── db.saveProject(project)
              └── firestoreService.ts
                    └── setDoc(doc(db, 'construction_projects', id), project)
                          └── Firestore (GCP)
                                └── Coluna projects/{id}
```

### 3.3 Fallback de Persistência (Histogramas/Dimensões/Composições)

```
firestoreService.ts → Firestore (tentativa primária)
  ├── SUCESSO → dado persistido na nuvem
  └── FALHA   → localStorage (fallback automático)
                  └── Dado preservado localmente
                        └── Próxima sessão: tentativa nova no Firestore
```

### 3.4 Fluxo de Inteligência Contratual (Gemini)

```
DimensionsUpload.tsx / CompositionsUpload.tsx
  └── Usuário faz upload de arquivo Excel/PDF
        └── parseDimensionsExcel() / extractCompositionsFromPDF()
              └── geminiService.ts → Google Gemini API
                    └── Resultado processado
                          └── saveDimensions() / saveCompositions()
                                └── firestoreService → Firestore
                                        └── + localStorage (dual-write)
```

---

## 4. Firestore — Modelo de Dados

### 4.1 Coleções

| Coleção | Document ID | Descrição |
|---|---|---|
| `construction_projects` | `project.id` (UUID) | Cadastro de obras |
| `construction_teams` | `team.id` (UUID) | Equipes por obra |
| `construction_rdos` | `rdo.id` (UUID) | Relatórios diários |
| `construction_histograms` | `item.id` (UUID) | Itens do histograma por obra |
| `construction_dimensions` | `projectId` | Dimensões contratuais (1 doc/obra) |
| `construction_compositions` | `projectId` | Composições de IA (1 doc/obra) |

### 4.2 Exemplo de Documento — Project

```json
{
  "id": "uuid-v4",
  "name": "Obra Centro SP",
  "location": "São Paulo - SP",
  "client": "Prefeitura Municipal",
  "startDate": "2025-01-15",
  "endDate": "2025-12-31",
  "status": "ACTIVE",
  "contractValue": 2500000,
  "regional": "Sudeste",
  "budgetValue": 2300000,
  "forecastValue": 2450000,
  "createdAt": "2025-01-10T10:00:00Z",
  "services": [
    { "code": "001", "scope": "Terraplanagem", "unit": "m³", "value": 45.00 }
  ]
}
```

### 4.3 Queries Utilizadas

| Operação | Firestore Op | Detalhe |
|---|---|---|
| Listar projetos | `getDocs(collection)` | Full scan |
| Listar RDOs por equipe | `query(where('teamId', '==', id))` | Filtro simples |
| Listar histogramas por obra | `query(where('projectId', '==', id))` | Filtro simples |
| Buscar dimensões | `getDoc(doc(db, 'construction_dimensions', projectId))` | Documento único |
| Salvar em lote | `writeBatch` (chunks de 500) | Operação atômica por lote |

### 4.4 Security Rules (Configurar no Firebase Console)

**Desenvolvimento (atual):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // APENAS DESENVOLVIMENTO
    }
  }
}
```

**Produção (recomendado — após implementar Firebase Auth):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null
        && request.auth.token.email.matches('.*@drconstrutora\\.com\\.br');
    }
  }
}
```

---

## 5. Google Gemini AI

### 5.1 Funcionalidades

| Feature | Modelo | Arquivo |
|---|---|---|
| Extração de composições de PDF | gemini-2.5-pro | `src/services/compositionAIService.ts` |
| Análise de contratos | gemini-2.5-pro | `services/geminiService.ts` |

### 5.2 Configuração

```typescript
// A chave é lida de duas formas (compatibilidade com AI Studio e Vite):
const API_KEY = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
```

O `vite.config.ts` mapeia `GEMINI_API_KEY` → `process.env.API_KEY` para
compatibilidade com o padrão do Google AI Studio.

---

## 6. Componentes Principais

### 6.1 App.tsx — Orquestrador Central

**Responsabilidades:**
- Estado global: `projects`, `teams`, `rdos`, `currentRDO`, `selectedProject`
- Handlers de CRUD: `handleSaveProject`, `handleDeleteProject`, `handleSaveTeam`, etc.
- Roteamento por estado: `MainMenu` × `ViewState`
- Seed inicial com `MOCK_PROJECTS` se Firestore vazio

**Props exportadas para filhos:** via callback functions passadas como props

### 6.2 HistogramAnalysis.tsx (33 KB)

Componente de análise complexa. Integra:
- `db.getHistograms()` / `db.saveHistograms()` (Firestore)
- Recharts para gráficos
- `histogramUtils.ts` para cálculos de aderência

### 6.3 ContractIntelligencePage.tsx

Orquestra as 3 sub-tabs do módulo de inteligência:
- `DimensionsUpload` → parse Excel + Gemini + Firestore
- `CompositionsUpload` → parse PDF + Gemini + Firestore
- Exibição de dados processados

### 6.4 RDOList.tsx

Lista e exportação de RDOs com:
- `db.getRdos()` / `db.deleteRdo()` (Firestore)
- Exportação para Excel via SheetJS

---

## 7. Variáveis de Ambiente

### Arquivo `.env` (raiz do projeto)

```bash
# ─── Google Gemini AI ────────────────────────────────────────────
VITE_GEMINI_API_KEY=<sua_chave_gemini>
GEMINI_API_KEY=<sua_chave_gemini>         # duplicata para compatibilidade

# ─── Firebase / Firestore ────────────────────────────────────────
VITE_FIREBASE_API_KEY=<valor_do_console>
VITE_FIREBASE_AUTH_DOMAIN=<projeto>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<id_do_projeto>
VITE_FIREBASE_STORAGE_BUCKET=<projeto>.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=<sender_id>
VITE_FIREBASE_APP_ID=<app_id>
```

### Onde obter os valores Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Selecione o projeto → ⚙️ Configurações do Projeto
3. Seção "Seus apps" → selecione o app web
4. Copie o objeto `firebaseConfig`

### Importante

- Variáveis com prefixo `VITE_` são injetadas no bundle do browser pelo Vite
- **Nunca commitar o `.env` com valores reais** — adicione ao `.gitignore`
- As chaves Gemini e Firebase são expostas no bundle — use Security Rules e
  restrições de domínio no Google Cloud Console para proteção

---

## 8. Processo de Deploy

### 8.1 Build de Produção

```bash
npm run build
# Saída em: dist/
# index.html  → 1.39 KB
# assets/index-*.js  → ~2154 KB (590 KB gzip)
# assets/index-*.css → ~2.5 KB
```

### 8.2 Servir Localmente

```bash
npm run preview    # Serve o bundle dist/ em http://localhost:4173
```

### 8.3 Deploy em Hospedagem Estática

O projeto é uma SPA estática. Pode ser deployado em qualquer serviço:

| Serviço | Comando / Configuração |
|---|---|
| **Firebase Hosting** | `firebase deploy` (ver `firebase.json`) |
| **Netlify** | Build command: `npm run build`, Publish dir: `dist/` |
| **Vercel** | Build command: `npm run build`, Output dir: `dist/` |
| **Nginx** | Copiar `dist/` e configurar `try_files $uri /index.html` |

### 8.4 Configuração SPA (importante)

Como é uma SPA React, o servidor deve redirecionar todas as rotas para `index.html`.

---

## 9. Dependências Críticas

```json
{
  "firebase": "^12.15.0",        // Banco de dados e infra GCP
  "@google/genai": "^1.40.0",    // Inteligência artificial
  "react": "^19.2.4",            // Framework UI
  "recharts": "^3.7.0",          // Gráficos
  "xlsx": "0.18.5"               // Leitura/escrita Excel (VERSÃO FIXADA)
}
```

> **Atenção com `xlsx@0.18.5`:** A versão está fixada (sem `^`) porque versões
> posteriores têm breaking changes. Não atualizar sem testes explícitos.

---

## 10. Diagrama de Dependências

```
Browser
  │
  ├─ index.html → index.tsx → App.tsx
  │                               │
  │                    ┌──────────┼──────────┐
  │                    ▼          ▼          ▼
  │              components   services/   src/
  │              (UI only)    firebase    analytics
  │                    │          │
  │                    │     firestoreService
  │                    │          │
  │                    └──────────┘
  │                               │
  │                         Firestore (GCP)
  │                         Gemini API (GCP)
  │                         localStorage (browser)
  │
  └─ dist/ (bundle estático)
```
