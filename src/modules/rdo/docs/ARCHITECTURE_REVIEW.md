# Revisão de Arquitetura — Portal Gerenciador (Module Obras)

> **Papel:** Arquiteto de Software Sênior
> **Data:** 2026-06-24
> **Versão avaliada:** Pós-migração AWS → Firestore
> **Scope:** Análise completa da arquitetura resultante

---

## 1. Pontos Fortes

### 1.1 Camada de Serviço como Contrato Explícito

A decisão de encapsular toda a persistência em `services/firestoreService.ts`
com API pública **idêntica** ao `dbService.ts` original é o ponto arquitetural
mais forte do sistema. Isso permitiu:

- A troca de banco de dados sem tocar em nenhum componente React
- A futura troca do Firestore por qualquer outro backend com zero impacto nos consumidores
- Testes de integração isolados da camada de UI

> **Padrão identificado:** Repository Pattern com inversão de dependência implícita.

### 1.2 Separação entre Módulos Internos e Externos

A estrutura `src/analytics/` foi concebida como um módulo independente com
subdivisões claras: `core/`, `engines/`, `exporters/`, `parsers/`, `types/`.
Isso indica visão de design para crescimento do módulo de inteligência contratual.

### 1.3 Inicialização Firebase com Singleton e Proteção HMR

O `services/firebase.ts` implementa corretamente o padrão singleton com
`getApps().length === 0 ? initializeApp(...) : getApp()`, evitando o erro
clássico de múltiplas instâncias durante o hot reload do Vite.

### 1.4 Estratégia de Fallback com localStorage

`firestoreService.ts` mantém dual-write com localStorage para histogramas,
dimensões e composições. Em caso de falha de rede ou quota Firestore, a
aplicação degrada graciosamente em vez de travar.

### 1.5 Tipagem TypeScript Forte

`types.ts` define todas as entidades de domínio com interfaces explícitas e
discriminated unions. O sistema nunca usa `any` nos contratos públicos dos serviços.

### 1.6 Stack Moderna e Alinhada ao Mercado

React 19, Vite 6, TypeScript 5.8, Firebase 12 — todas as escolhas são versões
atuais e com suporte ativo de longo prazo.

---

## 2. Pontos Fracos

### 2.1 Duplicação de App.tsx e App_fixed.tsx

**Crítico.** Existem dois arquivos de aplicação quase idênticos (1066 e 1046 linhas
respectivamente) no mesmo nível da raiz. Isso significa que qualquer mudança de
comportamento precisa ser aplicada duas vezes, criando risco de divergência silenciosa.

**Causa provável:** `App_fixed.tsx` foi criado como correção de emergência de
`App.tsx` e nunca foi consolidado.

**Risco:** Bugs diferentes em produção dependendo de qual arquivo está sendo
referenciado pelo `index.tsx`.

### 2.2 App.tsx com 1066 Linhas — God Component

`App.tsx` concentra estado global, lógica de negócio (CRUD completo), roteamento,
e orquestração de UI em um único componente. Isso viola o Single Responsibility
Principle e dificulta:
- Testes unitários
- Manutenção por mais de um desenvolvedor simultaneamente
- Identificação de bugs em produção

### 2.3 Ausência de Gerenciamento de Estado Global

Não há Context API, Zustand, Redux nem qualquer mecanismo formal de estado
compartilhado. Todas as operações passam por `App.tsx` via prop drilling.
Componentes filhos dependem de callbacks passados por props, tornando o fluxo
de dados difícil de rastrear.

### 2.4 Ausência de Autenticação

O sistema lida com dados sensíveis de obras, contratos e equipes, mas não
implementa nenhuma camada de autenticação (Firebase Auth ou similar). As Security
Rules do Firestore estão configuradas para aceitar qualquer leitura/escrita, o
que é inaceitável em produção.

### 2.5 Estrutura de Pastas Inconsistente — Dois Módulos `components`

Existem componentes em dois locais distintos:
- `/components/` — componentes principais
- `/src/components/` — componentes do módulo analytics

Isso indica que o módulo `src/analytics` começou como submódulo separado mas
foi integrado parcialmente sem consolidação da estrutura.

### 2.6 Importações com Caminhos Relativos Profundos

Importações como `../../src/analytics/types/analyticsTypes` aparecem em
componentes. O alias `@` configurado no Vite não está sendo utilizado de forma
consistente.

### 2.7 Variáveis Firebase não Configuradas

O `.env` contém as 6 variáveis `VITE_FIREBASE_*` vazias. O sistema compila e
faz build, mas não é operacional em produção até que essas variáveis sejam
preenchidas.

### 2.8 writeBatch sem Tratamento de Quota Firestore

A divisão em lotes de 500 está implementada, mas não há retry exponencial em
caso de erro de quota (`resource-exhausted`). Em projetos com muitos histogramas,
isso pode gerar falha silenciosa.

### 2.9 Ausência de Testes Automatizados

Não há nenhum arquivo de teste (`*.spec.ts`, `*.test.ts`). Para um sistema de
dados financeiros e contratuais, isso representa risco operacional significativo.

### 2.10 Bundle Monolítico

O bundle final é um único arquivo JS de 2154 KB (590 KB gzip). Não há code
splitting. O tempo de carregamento inicial em conexões lentas (obra em campo)
será alto.

---

## 3. Melhorias Futuras

### Curto Prazo (0–30 dias)

| Prioridade | Melhoria | Esforço |
|---|---|---|
| 🔴 URGENTE | Implementar Firebase Authentication | 2 dias |
| 🔴 URGENTE | Configurar Security Rules adequadas no Firestore | 1 dia |
| 🔴 URGENTE | Consolidar App.tsx + App_fixed.tsx em um único arquivo | 1 dia |
| 🟠 ALTO | Preencher variáveis VITE_FIREBASE_* no .env | 2 horas |
| 🟠 ALTO | Revogar chaves AWS IAM (AKIAREDID2CK5DJY2QWE) | 30 min |

### Médio Prazo (30–90 dias)

| Prioridade | Melhoria | Esforço |
|---|---|---|
| 🟡 MÉDIO | Quebrar App.tsx em contextos (ProjectContext, TeamContext, RDOContext) | 3 dias |
| 🟡 MÉDIO | Adicionar React Query ou SWR para cache e revalidação automática | 2 dias |
| 🟡 MÉDIO | Consolidar estrutura de pastas (eliminar `/src/components` duplicado) | 1 dia |
| 🟡 MÉDIO | Implementar code splitting por rota com React.lazy | 1 dia |
| 🟡 MÉDIO | Padronizar importações usando alias `@/` | 1 dia |

### Longo Prazo (90+ dias)

| Prioridade | Melhoria | Esforço |
|---|---|---|
| 🟢 BAIXO | Testes unitários com Vitest para serviços | 1 semana |
| 🟢 BAIXO | Testes E2E com Playwright para fluxos críticos | 1 semana |
| 🟢 BAIXO | CI/CD pipeline com GitHub Actions | 2 dias |
| 🟢 BAIXO | Offline-first com Firestore persistence (`enableIndexedDbPersistence`) | 2 dias |
| 🟢 BAIXO | Observabilidade com Firebase Performance Monitoring | 1 dia |

---

## 4. Dívida Técnica

### Dívida de Alta Severidade

| ID | Descrição | Impacto |
|---|---|---|
| TD-01 | `App.tsx` + `App_fixed.tsx` duplicados | Divergência de comportamento em produção |
| TD-02 | Ausência de autenticação | Dados de obras expostos a qualquer usuário |
| TD-03 | Security Rules abertas (`allow read, write: if true`) | Dados vulneráveis a escrita/leitura não autorizada |
| TD-04 | Variáveis Firebase vazias no .env | Sistema inoperacional em produção |

### Dívida de Média Severidade

| ID | Descrição | Impacto |
|---|---|---|
| TD-05 | God Component — App.tsx de 1066 linhas | Manutenibilidade comprometida |
| TD-06 | Ausência de testes automatizados | Regressões não detectadas |
| TD-07 | Prop drilling profundo sem Context API | Refatorações arriscadas |
| TD-08 | Bundle monolítico de 2154 KB | Performance de carregamento |

### Dívida de Baixa Severidade

| ID | Descrição | Impacto |
|---|---|---|
| TD-09 | Caminhos relativos profundos sem uso de alias `@/` | Legibilidade |
| TD-10 | Estrutura de pastas `/src` vs raiz inconsistente | Confusão para novos desenvolvedores |
| TD-11 | Comentários JSDoc com referências DynamoDB em firestoreService.ts | Documentação desatualizada |
| TD-12 | `build_new.js`, `update_app.ps1`, `update_props.js` na raiz | Scripts de manutenção sem documentação |

---

## 5. Parecer de Arquitetura

```
AVALIAÇÃO GERAL: BOM (pós-migração) — COM RESTRIÇÕES PARA PRODUÇÃO

A migração foi executada tecnicamente com precisão: API pública preservada,
zero breaking changes, build passando, bundle livre de AWS.

Contudo, dois bloqueadores impedem a classificação de PRONTO PARA PRODUÇÃO:

  1. Ausência de autenticação — dados sensíveis de obras sem controle de acesso
  2. Variáveis Firebase vazias — o sistema não conecta ao banco em produção

Após resolução desses dois pontos, o sistema tem base sólida para crescer.
A separação da camada de serviço é o ativo arquitetural mais valioso do projeto.
```
