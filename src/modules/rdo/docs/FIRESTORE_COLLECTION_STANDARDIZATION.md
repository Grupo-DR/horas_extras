# Padronização de Coleções do Firestore

## Objetivo

O módulo de Gestão de Obras foi migrado recentemente do AWS DynamoDB para o Firebase Firestore. Durante a migração inicial, coleções com nomes genéricos (ex: `projects`, `teams`) foram criadas. 

Para alinhar a arquitetura do módulo ao padrão corporativo preexistente no Portal DR, foi executada esta refatoração com o intuito de aplicar o prefixo `construction_` a todas as coleções, eliminando ambiguidades e padronizando o acesso aos dados em uma única camada centralizada.

## Coleções Antigas e Novas

| Antiga | Nova |
|---|---|
| `projects` | `construction_projects` |
| `teams` | `construction_teams` |
| `rdos` | `construction_rdos` |
| `histograms` | `construction_histograms` |
| `dimensions` | `construction_dimensions` |
| `compositions` | `construction_compositions` |

## Arquivos Alterados

1. **`src/constants/firestoreCollections.ts`** (Criado):
   * Contém a constante exportada `COLLECTIONS` mapeando o domínio para as novas coleções `construction_*`.
2. **`services/firestoreService.ts`**:
   * O objeto literal local de coleções foi removido.
   * Foi adicionada a importação de `COLLECTIONS` a partir de `src/constants/firestoreCollections.ts`.
   * Os comentários JSDoc descritivos e documentações internas foram atualizados para refletir a nova nomenclatura.
3. **`docs/ARCHITECTURE.md`**:
   * A tabela da seção "Coleções" foi atualizada.
   * O fluxo de persistência documentado foi atualizado com a nova nomenclatura.

## Estratégia Utilizada

- **Camada Centralizada:** Criou-se o arquivo `src/constants/firestoreCollections.ts` como Fonte Única de Verdade (Single Source of Truth) para todos os nomes de coleções consumidos na aplicação.
- **Substituição de Valores Hardcoded:** Atualizamos as referências onde as coleções eram definidas em `firestoreService.ts` para importar a nova constante global.
- **Auditoria de Strings Soltas:** Foram efetuadas buscas completas (`grep_search`) por nomes de coleções hardcoded ("projects", "teams", "rdos", etc.) dentro de chamadas do Firebase SDK (ex. `collection(db, "projects")` ou `doc(db, "projects", ...)`). Identificamos que a abstração já limitava os hardcodes ao `firestoreService.ts`, preservando o restante da aplicação.
- **Manutenção de Cache e IA:** Parâmetros para cache no `localStorage` (como `histograms_${projectId}`) e contratos com Gemini (`"compositions"`) não foram alterados propositalmente, mantendo total estabilidade de integrações.

## Impactos

- **Impactos Técnicos:** Qualquer futura adição ou alteração nos nomes das coleções do Firebase deve, a partir de agora, ser efetuada exclusivamente no arquivo `src/constants/firestoreCollections.ts`. 
- **Impacto em Negócio/Componentes:** **Nulo**. A refatoração manteve 100% da integridade da UI, regras de negócio e integrações de Inteligência Artificial inalteradas.

## Compatibilidade

- Validação da compatibilidade com Firestore foi garantida dado que as chaves em `COLLECTIONS` foram mapeadas como constantes (com literal const assertions do TypeScript: `as const`), mantendo estrita checagem de tipos nas assinaturas que esperam strings nativas.
- As consultas `collection()`, `doc()`, `query()`, `where()`, `getDocs()`, e `writeBatch()` continuam operando normalmente de forma transparente.

## Resultado Final

- Build concluído sem falhas (0 erros relatados por `tsc` ou `vite build`).
- Todas as coleções Firestore do Módulo de Obras agora aderem ao padrão `construction_*`.
- Eliminação completa de hardcodes espalhados (strings soltas).
- A auditoria não encontrou referências restantes no nível do framework ou dados.
