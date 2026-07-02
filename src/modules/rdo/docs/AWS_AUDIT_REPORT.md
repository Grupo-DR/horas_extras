# Relatório de Auditoria AWS — Antes da Remoção

> **Projeto:** Portal Gerenciador — Module Obras
> **Data:** 2026-06-24
> **Finalidade:** Mapeamento completo de dependências AWS antes da remoção
> **Status:** AUDITORIA CONCLUÍDA — Remoção já executada

---

## Resultado da Auditoria

### CRÍTICO

| ID | Localização | Tipo | Detalhe |
|---|---|---|---|
| C1 | `.env` linhas 1–3 | Credencial ativa | `VITE_AWS_ACCESS_KEY_ID` e `VITE_AWS_SECRET_ACCESS_KEY` expostos com prefixo `VITE_` — injetados no bundle do browser |
| C2 | `services/awsConfig.ts` | Arquivo de configuração AWS | Inicializa `DynamoDBClient` com credenciais diretas de ambiente |
| C3 | `services/dbService.ts` | Serviço de dados AWS | 18 funções CRUD usando `@aws-sdk/lib-dynamodb` com PutCommand, GetCommand, ScanCommand, QueryCommand, DeleteCommand |
| C4 | `package.json` | Dependência de produção | `@aws-sdk/client-dynamodb@^3.1019.0` e `@aws-sdk/lib-dynamodb@^3.1019.0` no bundle de produção |

### MÉDIO

| ID | Localização | Tipo | Detalhe |
|---|---|---|---|
| M1 | `.env` linhas 4–6 | Variáveis de configuração | `VITE_DYNAMODB_TABLE_PROJECTS`, `VITE_DYNAMODB_TABLE_TEAMS`, `VITE_DYNAMODB_TABLE_RDOS` referenciadas em awsConfig.ts |
| M2 | `App.tsx` (linhas 36,86,91,105,115,140–141,209,241,272,281,302,316) | Strings de log e alertas | 12 ocorrências de "AWS" em mensagens de erro exibidas ao usuário |
| M3 | `App_fixed.tsx` (linhas 37,82,87,101,111,127–128,181,213,240,261,275) | Strings de log e alertas | 11 ocorrências de "AWS" em mensagens de erro |
| M4 | `aws_infrastructure.yaml` | Infraestrutura declarativa | CloudFormation template com definição das tabelas DynamoDB (Obras_Projects, Obras_Teams, Obras_RDOs) e IAM Policy |
| M5 | `package-lock.json` | Lock file | +80 entradas de pacotes `@aws-sdk/*` transitivos gerados pelo client-dynamodb |

### BAIXO

| ID | Localização | Tipo | Detalhe |
|---|---|---|---|
| B1 | `src/analytics/types/analyticsTypes.ts` linhas 169,172 | Comentário JSDoc | `"Shape do item salvo no DynamoDB"` — apenas documentação histórica |
| B2 | `node_modules/@aws-sdk/` | Pasta em disco | 87 pacotes transitivos em node_modules, sem impacto funcional direto |

---

## Impacto de Segurança

```
CRÍTICO — Credenciais AWS ativas no arquivo .env com prefixo VITE_
  - VITE_AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
  - VITE_AWS_SECRET_ACCESS_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

Ambas as variáveis são injetadas no bundle JavaScript do browser e ficam
expostas para qualquer usuário que inspecione o código-fonte da aplicação.

AÇÃO NECESSÁRIA: Revogar essas chaves no AWS IAM Console imediatamente,
independentemente da migração ter sido concluída.
```

---

## Sumário Quantitativo

| Categoria | Qtd. itens |
|---|---|
| CRÍTICO | 4 |
| MÉDIO | 5 |
| BAIXO | 2 |
| **Total** | **11** |
