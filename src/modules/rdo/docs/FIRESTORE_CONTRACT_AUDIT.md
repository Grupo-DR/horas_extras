# Auditoria de Acesso: FirestoreContractRepository

## 1. Collection Utilizada
A collection sendo acessada no arquivo `FirestoreContractRepository.ts` está sendo referenciada através da constante `COLLECTIONS.CONTRACTS`.

## 2. Nome Exato da Collection
De acordo com o mapeamento no arquivo `src/constants/firestoreCollections.ts`, o valor literal mapeado é:
**`construction_contracts`**

## 3. Path Completo no Firestore
O repositório realiza as operações diretamente na raiz do banco de dados para a respectiva coleção, utilizando o ID do projeto como chave do documento. O path de acesso é:
`/construction_contracts/{projectId}`

## 4. Definição na Constante COLLECTIONS
**Sim.** A collection está corretamente declarada no objeto central de constantes:
```typescript
export const COLLECTIONS = {
  // ...
  CONTRACTS: "construction_contracts",
} as const;
```

## 5. Existência no Firestore
**Indefinido / Bloqueado.** Como é um domínio inserido recentemente (após a migração base do DynamoDB), o Firebase Firestore lida com a "criação" de coleções dinamicamente no momento da inserção. A coleção efetivamente ainda "não existe" como um container validado porque nenhuma inserção obteve sucesso para inicializá-la, barrada pelas restrições de acesso da nuvem.

## 6. Fallback para LocalStorage
**Sim, existe e está ativo.**
A implementação do repositório é tolerante a falhas (resiliente):
- **Ao Salvar (`save` / `update`):** A linha 32 (`localStorage.setItem`) persiste os dados offline antes da instrução `setDoc` para o Firestore. O erro do Firestore é engolido no bloco `catch` (linha 40), emitindo apenas um `console.warn` e impedindo a quebra do sistema.
- **Ao Ler (`getById`):** O bloco `try` tenta buscar com `getDoc`. Ao falhar com a exceção de permissão, ele entra no `catch` e executa um *fallback* imediato (linha 27), devolvendo o JSON recuperado do `localStorage`.

## 7. Verificação da Causa do Erro

O erro `FirebaseError: Missing or insufficient permissions` **ocorre exclusivamente por Regra Firestore (Firestore Security Rules)**.

- **Collection inexistente?** Não causa esse erro. O Firestore criaria a collection automaticamente se a gravação fosse aprovada.
- **Documento inexistente?** Não causa esse erro. Leituras de documentos ausentes em coleções permitidas retornam um `snap` sem dados (`snap.exists() === false`).
- **Path incorreto?** Não. O repositório utiliza construtores da SDK V9 corretamente: `doc(db, COLLECTIONS.CONTRACTS, projectId)`.
- **Regra Firestore:** Sim. Por padrão, o banco Firebase Firestore opera em estado de "Deny All" (nega tudo). Se as políticas de segurança (Security Rules) em nuvem não foram atualizadas para cobrir `match /construction_contracts/{docId}`, todas as requisições oriundas do cliente (`get`, `set`, `update`, `delete`) serão imediatamente rejeitadas pelo backend da Google sob a mensagem "Missing or insufficient permissions".

## Correção Recomendada
Para resolver a falha definitivamente:

1. Acesse o **Firebase Console**.
2. Navegue para **Firestore Database -> Rules**.
3. Adicione um nó de regra declarando e autorizando explicitamente o novo domínio contratual `construction_contracts`, por exemplo:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Suas regras anteriores (projects, teams, rdos, etc)...
    
    // NOVA REGRA PARA CONTRATOS
    match /construction_contracts/{contractId} {
      allow read, write: if true; // Ou "if request.auth != null;" para produção
    }
  }
}
```

Nenhum código front-end (TypeScript/React) precisa ser alterado. O repositório está perfeitamente aderente aos princípios Clean e lidando com falhas perfeitamente graças ao Fallback local.
