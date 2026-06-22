# 🏗️ DR Nexus — Portal Gerenciador Comercial

> **Sistema de gestão interno da DR Construtora e Serviços Ltda**, integrando módulos Comercial, Contratos, CRM e Capital Humano em uma única plataforma web.

---

## 📋 Índice

1. [Visão Geral](#-visão-geral)
2. [Módulos do Sistema](#-módulos-do-sistema)
3. [Arquitetura Técnica](#-arquitetura-técnica)
4. [Stack de Tecnologias](#-stack-de-tecnologias)
5. [Estrutura de Pastas](#-estrutura-de-pastas)
6. [Configuração do Ambiente](#-configuração-do-ambiente)
7. [Rodando o Projeto Localmente](#-rodando-o-projeto-localmente)
8. [Autenticação e Controle de Acesso (IAM)](#-autenticação-e-controle-de-acesso-iam)
9. [Banco de Dados — Firebase Firestore](#-banco-de-dados--firebase-firestore)
10. [Módulo Capital Humano — Horas Extras](#-módulo-capital-humano--horas-extras)
11. [Módulo Comercial e CRM](#-módulo-comercial-e-crm)
12. [Módulo Contratos e Produção](#-módulo-contratos-e-produção)
13. [Módulo Obra (Construction)](#-módulo-obra-construction)
14. [Deploy e Ambientes](#-deploy-e-ambientes)
15. [Variáveis de Ambiente](#-variáveis-de-ambiente)
16. [Fluxos de Trabalho Importantes](#-fluxos-de-trabalho-importantes)
17. [Pendências e Roadmap](#-pendências-e-roadmap)
18. [Contato e Suporte](#-contato-e-suporte)

---

## 🎯 Visão Geral

O **DR Nexus** é o portal de gestão interno da DR Construtora. Ele nasceu como um pipeline comercial (Kanban de licitações) e foi evoluindo para incorporar:

- Gestão de todo o **funil comercial** (pipeline de licitações, propostas, CRM de clientes)
- **Contratos ativos** com medições, eventos e dashboards financeiros
- **Horas extras** dos colaboradores, com planejamento, aprovação e análise por IA (Gemini)
- **Obra** (RDO — Relatório Diário de Obra) com análise de PDFs via IA
- **IAM** (Identity and Access Management) para controle granular de permissões por módulo

O sistema utiliza **Firebase** como backend (Firestore para dados, Firebase Auth para autenticação, Cloud Functions para automações) e é uma **SPA React** servida via Vite.

---

## 📦 Módulos do Sistema

| Módulo | Rota | Descrição |
|--------|------|-----------|
| **Comercial** | `/` | Pipeline Kanban de licitações, dashboard de oportunidades |
| **Prospecção** | `/prospecting` | Gestão de prospects em estágios (Kanban de prospecção) |
| **CRM — Clientes** | `/crm/clients` | Cadastro completo de clientes, saúde do relacionamento |
| **CRM — Detalhe** | `/crm/clients/:id` | Histórico de interações, contatos, oportunidades por cliente |
| **Contratos** | `/contracts` | Lista de contratos ativos, suspensos e finalizados |
| **Dashboard Contratos** | `/contracts/dashboard` | Visão analítica global de todos os contratos |
| **Produção** | `/production` | Gestão de medições por contrato (BM + RDO) |
| **Ações** | `/actions` | Central de tarefas e ações da equipe |
| **Capital Humano** | `/human-capital/*` | Horas extras, planejamento, aprovação, análise IA |
| **Obra** | `/construction/*` | Dashboard RDO, importação de relatórios |
| **Usuários** | `/users` | Gestão de perfis e permissões (IAM Admin) |
| **Config** | `/config/account` | Configurações da conta do usuário |

---

## 🏛️ Arquitetura Técnica

```
┌─────────────────────────────────────────────────────────────┐
│                      BROWSER (React SPA)                     │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐ │
│  │ Comercial│  │ Contratos│  │Cap. Humano │  │   Obra   │ │
│  │  + CRM   │  │  + BM    │  │(HC Module) │  │  (RDO)   │ │
│  └──────────┘  └──────────┘  └────────────┘  └──────────┘ │
│          │           │               │              │        │
│          └───────────┴───────────────┴──────────────┘       │
│                              │                              │
│                    ┌─────────────────┐                      │
│                    │   IAM / Auth    │                      │
│                    │ (Firebase Auth) │                      │
│                    └─────────────────┘                      │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────────┐
│                     FIREBASE (Backend)                       │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Firestore   │  │ Firebase Auth│  │ Cloud Functions  │  │
│  │  (Database)  │  │  (Login/SSO) │  │  (Automações)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                  GOOGLE GEMINI API                           │
│       (Análise de PDFs de RDO/BM via IA, Chat HC)           │
└─────────────────────────────────────────────────────────────┘
```

### Contextos React (State Management)

O sistema usa **Context API** do React — sem Redux:

| Contexto | Arquivo | Responsabilidade |
|----------|---------|-----------------|
| `AuthContext` | `contexts/AuthContext.tsx` | Usuário logado, perfil, módulos acessíveis |
| `ContractsContext` | `contexts/ContractsContext.tsx` | Contratos, medições, eventos em memória |
| `CrmContext` | `contexts/CrmContext.tsx` | Clientes, interações, oportunidades |

---

## 🛠️ Stack de Tecnologias

| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| **React** | 19.x | Framework UI |
| **TypeScript** | 5.8.x | Tipagem estática |
| **Vite** | 6.x | Bundler e dev server |
| **TailwindCSS** | 4.x | Estilização |
| **Firebase** | 12.x | Auth + Firestore + Functions |
| **React Router** | 7.x | Roteamento SPA |
| **Recharts** | 3.x | Gráficos e dashboards |
| **Framer Motion** | 12.x | Animações |
| **Lucide React** | 0.56x | Ícones |
| **date-fns** | 4.x | Manipulação de datas |
| **xlsx** | 0.18.x | Leitura/escrita de planilhas Excel |
| **pdfjs-dist** | 5.x | Extração de texto de PDFs |
| **@google/genai** | 1.40.x | SDK Google Gemini AI |
| **sonner** | 2.x | Notificações toast |

---

## 📁 Estrutura de Pastas

```
Portal-commercial/
│
├── index.html              # Ponto de entrada HTML
├── index.tsx               # Ponto de entrada React — define rotas e providers
├── index.css               # CSS global
├── types.ts                # Tipos TypeScript globais (Contratos, CRM, Comercial)
├── constants.ts            # Constantes globais (estágios pipeline, etc.)
│
├── pages/                  # Páginas do módulo Comercial (rota padrão com sidebar)
│   ├── CommercialView.tsx  # Pipeline Kanban de licitações
│   ├── ProspectingView.tsx # Pipeline de prospecção de novos clientes
│   ├── ContractsView.tsx   # Lista de contratos
│   ├── ContractDashboardView.tsx  # Dashboard analítico de contratos
│   ├── ConstructionSiteView.tsx   # Tela de produção / medições
│   ├── ActionsView.tsx     # Central de tarefas e ações
│   ├── LoginPage.tsx       # Tela de login (Firebase Auth)
│   ├── crm/
│   │   ├── ClientsView.tsx        # Lista de clientes CRM
│   │   └── ClientDetailsView.tsx  # Detalhe do cliente CRM
│   └── config/
│       └── AccountSettings.tsx    # Configurações de conta
│
├── components/             # Componentes reutilizáveis
│   ├── ContractCard.tsx
│   ├── ContractDetailsModal.tsx
│   ├── DocumentImportModal.tsx  # Import de PDFs (BM/RDO) via IA
│   ├── KPICard.tsx / KPIForm.tsx / KPIDetailsModal.tsx
│   ├── Pipeline/           # Componentes do funil/Kanban
│   ├── crm/                # Componentes específicos de CRM
│   ├── production/         # Componentes de medição/produção
│   ├── ui/                 # Componentes UI base (botões, modais, etc.)
│   └── users/              # Componentes de gestão de usuários
│
├── contexts/               # Contextos React (state global)
│   ├── AuthContext.tsx
│   ├── ContractsContext.tsx
│   └── CrmContext.tsx
│
├── services/               # Camada de serviços Firebase
│   ├── firebaseConfig.ts   # Inicialização do Firebase
│   ├── bidService.ts       # CRUD de licitações
│   ├── contractService.ts  # CRUD de contratos e medições
│   ├── clientService.ts    # CRUD de clientes
│   ├── kpiService.ts       # KPIs por contrato
│   ├── taskService.ts      # Tarefas e ações
│   ├── userService.ts      # Usuários
│   ├── LocalBMParser.ts    # Parser local de Boletins de Medição (PDF)
│   └── RDOAnalytics.ts     # Análise de RDOs
│
├── hooks/                  # Custom React Hooks
├── layout/                 # Layout principal (Sidebar, Header)
├── domain/                 # Lógica de domínio pura
├── utils/                  # Utilitários gerais
├── types/                  # Tipos adicionais TypeScript
│
├── src/                    # Módulos independentes (layout próprio)
│   └── modules/
│       ├── human-capital/  # ★ MÓDULO PRINCIPAL: Horas Extras
│       │   ├── HumanCapitalDashboard.tsx  # Dashboard HC com tabs
│       │   ├── types.ts                  # Tipos do módulo HC
│       │   ├── components/
│       │   │   ├── Dashboard.tsx         # Visão geral de horas extras
│       │   │   ├── AnalysisPanel.tsx     # Análise avançada (tabelas, gráficos)
│       │   │   ├── Planning.tsx          # Planejamento de horas
│       │   │   ├── ApprovalPanel.tsx     # Painel de aprovação (gestores)
│       │   │   ├── DataGrid.tsx          # Grid de dados de horas
│       │   │   ├── FilterBar.tsx         # Filtros (CC, período, colaborador)
│       │   │   ├── GeminiPanel.tsx       # Chat IA (Gemini) para análise
│       │   │   ├── HeadcountGovernance.tsx # Governança de headcount
│       │   │   ├── HeadcountUpload.tsx   # Upload planilha headcount
│       │   │   ├── PlanningTable.tsx     # Tabela de planejamento
│       │   │   └── ProfileManager.tsx    # Gerenciamento de perfis
│       │   ├── services/
│       │   │   └── planning.ts           # Serviços de planejamento HC
│       │   ├── data/                     # Dados estáticos / seed
│       │   └── utils/                    # Utilitários do módulo HC
│       │
│       ├── construction/   # Módulo Obra (RDO)
│       │   ├── ConstructionDashboard.tsx
│       │   ├── components/
│       │   ├── services/
│       │   └── ...
│       │
│       └── iam/            # Identity and Access Management
│           ├── types.ts          # Tipos de roles e escopos
│           ├── profileService.ts # Serviço de perfis de usuário
│           └── components/
│               └── ProfileManager.tsx
│
├── functions/              # Firebase Cloud Functions (Node.js/TypeScript)
│
├── firestore.rules         # Regras de segurança do Firestore
├── firebase.json           # Configuração do Firebase CLI
├── vite.config.ts          # Configuração do Vite
├── tailwind.config.js      # Configuração do Tailwind
├── tsconfig.json           # Configuração TypeScript
└── package.json            # Dependências e scripts
```

---

## ⚙️ Configuração do Ambiente

### Pré-requisitos

- **Node.js** 18+ (recomendado 20 LTS)
- **npm** 9+
- Acesso ao projeto Firebase `kanbancomercial-af561`
- Chave de API do **Google Gemini** (para features de IA)
- Conta com acesso ao repositório GitHub **Grupo-DR/horas_extras**

### 1. Clonar o repositório

```bash
git clone https://github.com/Grupo-DR/horas_extras.git
cd horas_extras
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente



> ⚠️ **ATENÇÃO**: Nunca commitar o arquivo `.env.local` no repositório. Ele já está no `.gitignore`.  
> A chave do Firebase neste README é pública (usada no cliente web) mas a chave do Gemini deve ser mantida em segredo.

---

## 🚀 Rodando o Projeto Localmente

```bash
# Iniciar servidor de desenvolvimento
npm run dev
```

Acesse: **http://localhost:5173**

```bash
# Build de produção
npm run build

# Preview do build de produção
npm run preview
```

---

## 🔐 Autenticação e Controle de Acesso (IAM)

### Fluxo de Autenticação

1. O usuário acessa `/login` e faz login com **email + senha** via Firebase Authentication.
2. Após login, o `AuthContext` busca o **perfil do usuário** na coleção `user_profiles/{uid}` do Firestore.
3. O perfil define quais **módulos** o usuário pode acessar e com qual **role**.
4. As rotas privadas (`PrivateRoute`) verificam se o usuário tem acesso ao módulo requerido.

### Estrutura de Perfis (IAM)

Cada usuário tem um documento em `/user_profiles/{uid}` com a seguinte estrutura:

```typescript
{
  name: string;
  email: string;
  isSuperAdmin?: boolean;  // Acesso total ao sistema
  modules: {
    commercial?: { role: 'VIEWER' | 'EDITOR' | 'IAM_ADMIN' };
    human_capital?: { role: CHRole; scope?: Scope };
    construction?: { role: string };
  }
}
```

### Roles do Módulo Capital Humano (`CHRole`)

| Role | Permissões |
|------|-----------|
| `ADMIN` | Acesso total, gerencia usuários e configurações |
| `APPROVER` | Aprova/rejeita planejamentos de horas extras |
| `MANAGER` | Visualiza e planeja para seu centro de custo |
| `VIEWER` | Apenas visualização |

### Scope (Escopo)

O campo `scope` limita o que o usuário pode ver:
```typescript
{
  costCenters?: string[]; // CCs específicos que o usuário pode acessar
}
```

### Como criar um novo usuário admin

1. Acesse o [Console do Firebase](https://console.firebase.google.com/) → Projeto `kanbancomercial-af561`
2. Em **Authentication**, crie o usuário com email e senha
3. Em **Firestore**, crie o documento `/user_profiles/{uid}` com as permissões desejadas

---

## 🗄️ Banco de Dados — Firebase Firestore

### Coleções Principais

| Coleção | Descrição |
|---------|-----------|
| `user_profiles` | Perfis de usuário com permissões por módulo |
| `user_directory` | Diretório público de usuários (escrito por Cloud Functions) |
| `users` | Coleção legacy de usuários (compatibilidade) |
| `audit_logs` | Logs de auditoria de ações críticas |
| `hc_planning_records` | Registros de planejamento de horas extras |
| `bids` | Licitações/oportunidades comerciais |
| `contracts` | Contratos ativos |
| `clients` | Cadastro de clientes |
| `interactions` | Interações CRM |
| `tasks` | Tarefas e ações |
| `prospects` | Prospects do funil de prospecção |
| `solutions` | Soluções/serviços ofertados |
| `kpis` | KPIs de contratos |

### Regras de Segurança

As regras estão em `firestore.rules`. Resumo:

- Usuários não autenticados não acessam **nada**.
- Usuários só leem seu próprio perfil (exceto IAM Admins que leem todos).
- Escrita em `user_profiles` é restrita a IAM Admins.
- `user_directory` é escrito **apenas por Cloud Functions** (Admin SDK).
- `hc_planning_records` permite leitura/escrita para qualquer autenticado (TODO: adicionar verificação de role).

---

## 👥 Módulo Capital Humano — Horas Extras

Este é o **módulo principal** deste repositório (`/human-capital/*`).

### Funcionalidades

#### 📊 Dashboard (`/human-capital`)
- Visão geral de horas extras do período selecionado
- Métricas: total de horas, horas 60%, horas 100%, custo estimado
- Filtros por **Centro de Custo**, **Colaborador** e **Período**
- Exportação para Excel

#### 🔍 Análise (`AnalysisPanel`)
- Tabela detalhada por colaborador com breakdown 60% / 100%
- Gráficos de evolução temporal
- Comparativo entre colaboradores por dia (`EmployeeDailyComparisonModal`)
- **Chat com IA (Gemini)** para análise interativa dos dados (`GeminiPanel`)

#### 📅 Planejamento (`Planning`)
- Planejamento de horas extras futuras por colaborador/CC
- Criação de registros com status `draft → pending → approved`
- Tabela de planejamento com edição inline

#### ✅ Aprovação (`ApprovalPanel`)
- Painel exclusivo para `APPROVER` e `ADMIN`
- Lista de planejamentos pendentes de aprovação
- Aprovação/rejeição com comentário

#### 👤 Governança de Headcount
- Upload de planilha Excel de headcount (`HeadcountUpload`)
- Validação estrutural e de negócio
- Visualização da alocação por CC

### Fonte de Dados

Os dados de horas extras são consumidos de uma **API externa** configurada via formulário na própria tela. A configuração inclui:

```typescript
{
  url: string;      // URL da API de ponto/horas
  username: string; // Usuário da API
  password: string; // Senha da API
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}
```

Os registros retornados seguem o formato `OvertimeRecord`:

```typescript
{
  CHAPA: string;    // Matrícula do colaborador
  NOME: string;     // Nome completo
  FUNCAO: string;   // Cargo/função
  DATA: string;     // Data da ocorrência
  CODCCUSTO: string; // Código do centro de custo
  SECAO: string;    // Seção/departamento
  EVENTO: string;   // Tipo de hora extra (ex: "H.E. 60%")
  HORAS: number;    // Quantidade de horas
  VALOR: number;    // Valor monetário
}
```

---

## 💼 Módulo Comercial e CRM

### Pipeline de Licitações (`CommercialView`)

Kanban com os seguintes estágios:

| Estágio | Descrição |
|---------|-----------|
| `LEAD_RECEBIDO` | Lead recebido, aguardando análise |
| `DECISAO_PARTICIPACAO` | Decisão se vai participar da licitação |
| `ORCAMENTO_PREVIO` | Orçamento prévio sendo elaborado |
| `MEMORIA_COMPOSICOES` | Memória de composições sendo preparada |
| `PROPOSTA_TECNICA` | Proposta técnica em andamento |
| `PROPOSTA_COMERCIAL` | Proposta comercial sendo finalizada |
| `REVISAO_FINAL` | Revisão final antes do envio |
| `ENVIO_PROPOSTA` | Proposta enviada |
| `AGUARDANDO_RESULTADO` | Aguardando resultado da licitação |
| `RESULTADO` | Resultado recebido (GANHA / PERDIDA) |

### CRM de Clientes

- Cadastro com CNPJ, segmento, endereço, contatos
- **Score de saúde do relacionamento** calculado automaticamente
- Histórico de interações (reuniões, ligações, visitas, e-mails, WhatsApp)
- Oportunidades por cliente

---

## 📄 Módulo Contratos e Produção

### Contratos (`ContractsView`)

- Cadastro com: número, nome da obra, contratante, valor, datas, status
- **Eventos**: Aditivo de prazo, aditivo de valor, reajuste, paralisação
- **Medições (BM)**: Import de PDF de Boletim de Medição via IA (Gemini extrai os dados)
- **Equipes**: Equipes por contrato com RDOs vinculados

### Importação de PDFs

O componente `DocumentImportModal` permite arrastar PDFs de BM (Boletim de Medição) ou RDO e usa o **Gemini AI** para extrair automaticamente os dados estruturados.

---

## 🏗️ Módulo Obra (Construction)

- Dashboard de RDOs (Relatórios Diários de Obra)
- Importação e análise de PDFs de RDO via IA
- Localizado em `src/modules/construction/`
- Tem seu próprio `package.json` e pode ser buildado independentemente

---

## 🌐 Deploy e Ambientes

### Ambiente Atual

O projeto está atualmente configurado para deploy no **Netlify** (arquivo `netlify.toml` na raiz) e usa **Firebase** como backend.

```toml
# netlify.toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Para fazer deploy manual

```bash
# Build
npm run build

# O diretório de saída é /dist
# Configurar no Netlify: Base directory = ./, Build command = npm run build, Publish directory = dist
```

### Firebase Cloud Functions

As Cloud Functions estão em `functions/`. Para deploy:

```bash
# Na raiz do projeto
firebase deploy --only functions

# Para deploy das regras do Firestore
firebase deploy --only firestore:rules
```

---

## 🔑 Variáveis de Ambiente

| Variável | Descrição | Onde obter |
|----------|-----------|-----------|
| `VITE_GEMINI_API_KEY` | Chave da API Google Gemini | [Google AI Studio](https://aistudio.google.com/) |
| `VITE_FIREBASE_API_KEY` | Chave da API do Firebase | Console Firebase → Configurações do projeto |
| `VITE_FIREBASE_AUTH_DOMAIN` | Domínio de autenticação Firebase | Console Firebase |
| `VITE_FIREBASE_PROJECT_ID` | ID do projeto Firebase | `kanbancomercial-af561` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Bucket do Storage Firebase | Console Firebase |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ID do remetente FCM | Console Firebase |
| `VITE_FIREBASE_APP_ID` | ID do app Firebase | Console Firebase |
| `VITE_FIREBASE_MEASUREMENT_ID` | ID do Analytics | Console Firebase |

---

## 🔄 Fluxos de Trabalho Importantes

### Adicionando um Novo Usuário ao Sistema

1. Acesse [Firebase Console](https://console.firebase.google.com/) → `kanbancomercial-af561`
2. **Authentication** → Adicionar usuário (email + senha)
3. Copie o **UID** gerado
4. **Firestore** → Coleção `user_profiles` → Novo documento com ID = `{UID}`
5. Preencha o documento:
   ```json
   {
     "name": "Nome do Usuário",
     "email": "email@drengenharia.com.br",
     "isSuperAdmin": false,
     "modules": {
       "commercial": { "role": "VIEWER" },
       "human_capital": { "role": "VIEWER" }
     }
   }
   ```

### Atualizando as Regras do Firestore

1. Edite `firestore.rules`
2. Execute: `firebase deploy --only firestore:rules`

### Ciclo de Desenvolvimento

```bash
# 1. Criar branch
git checkout -b feature/minha-funcionalidade

# 2. Desenvolver e testar
npm run dev

# 3. Commit
git add .
git commit -m "feat: descrição da funcionalidade"

# 4. Push e PR
git push origin feature/minha-funcionalidade
```

---

## 📋 Pendências e Roadmap

### Débitos Técnicos Conhecidos

- [ ] **Regras Firestore do HC**: A coleção `hc_planning_records` ainda usa `isAuthenticated()` genérico — deveria verificar a role específica do módulo HC
- [ ] **Migração de dados**: Alguns dados ainda usam a coleção `users` (legacy) em vez de `user_profiles`
- [ ] **Testes automatizados**: Não há testes unitários ou de integração implementados
- [ ] **Error boundaries**: Não implementados em todos os módulos

### Funcionalidades Planejadas / Em Desenvolvimento

- [ ] Módulo de **Fornecedores** (estrutura existe no enum `AppModule` mas a tela não foi criada)
- [ ] Módulo **Financeiro** (estrutura existe mas não implementado)
- [ ] Notificações em tempo real (Firestore listeners já existem para algumas coleções)
- [ ] App mobile (React Native) — ainda não iniciado
- [ ] Integração com sistema de ERP

---

## 📞 Contato e Suporte

### Projeto Firebase

- **Console**: https://console.firebase.google.com/project/kanbancomercial-af561
- **Projeto ID**: `kanbancomercial-af561`

### Repositório

- **GitHub**: https://github.com/Grupo-DR/horas_extras

### Quem criou este projeto

Este sistema foi desenvolvido internamente na **DR Construtora e Serviços Ltda** entre 2024 e 2026 como uma solução de gestão personalizada para as necessidades específicas da empresa.

Em caso de dúvidas sobre a arquitetura ou decisões técnicas, consulte o histórico de commits do repositório ou entre em contato com a equipe de TI da DR.

---

## 📝 Notas para o Novo Responsável

> ⚠️ **Atenção especial aos seguintes pontos ao assumir o projeto:**

1. **Firebase**: O projeto usa o plano **Blaze** (pay-as-you-go) do Firebase. Monitore o uso para evitar custos inesperados.

2. **Gemini API**: A chave do Gemini tem cota diária. Se as features de IA pararem de funcionar, verifique os limites no Google AI Studio.

3. **Módulo HC**: O módulo de Capital Humano em `src/modules/human-capital/` é o mais complexo e o que mais recebeu desenvolvimento recente. Preste atenção especial a:
   - `Planning.tsx` (119KB) — lógica de planejamento complexa
   - `AnalysisPanel.tsx` (150KB) — maior arquivo do projeto

4. **Autenticação**: Todos os acessos são via Firebase Auth. Não há autenticação própria.

5. **OneDrive**: O projeto estava sendo desenvolvido em uma pasta do OneDrive sincronizada. Ao clonar do GitHub, os arquivos de `node_modules` e `.env.local` **não estão** no repositório e precisam ser recriados.

6. **`.env.local`**: O arquivo de variáveis de ambiente não está no repositório. Você precisará das credenciais Firebase (disponíveis no Console Firebase) e de uma nova chave Gemini.

---

*Documento gerado em Junho de 2026 para transferência do projeto.*
