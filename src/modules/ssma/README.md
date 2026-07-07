# Módulo SSMA (Saúde, Segurança e Meio Ambiente)

Este módulo encontra-se na fase de migração da arquitetura base.

**ATENÇÃO**: A pasta `dashboard-de-inspeções-ssma` na raiz do projeto é o **protótipo de referência**. O módulo oficial para produção deve ser desenvolvido **exclusivamente** nesta pasta (`src/modules/ssma`).

**Regras de Migração e Dependências:**
- **NÃO** realize imports diretos de qualquer arquivo contido na pasta `dashboard-de-inspeções-ssma`.
- A pasta `dashboard-de-inspeções-ssma` possui seus próprios arquivos de configuração (como `package.json`, `vite.config.ts`, `index.html`, etc.) que não devem ser misturados com o projeto principal.
- O módulo implementa regras de negócio granulares, permissões via IAM corporativo e cálculos focados em Competência (YYYY-MM).

## Sprint 7 - Evidências Fotográficas e Documentais (Storage)

A arquitetura de armazenamento do módulo foi isolada no `Firebase Storage` para impedir gravações excessivas no banco de dados.

- **Coleção:** `ssma_evidences`
- **Caminho Storage:** `ssma/evidences/{year}/{month}/{costCenterId}/{inspectionEventId}/{fileName}`
- **Tipos de Arquivo:** `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- **Limite:** `10 MB`
- **Regra de Arquitetura:** Nenhum arquivo ou imagem em formato Base64 deve ser salvo no Firestore. Os componentes de UI apenas lidam com metadados e o *upload* transacional é empurrado via Hook especializado.

Atenção: Garanta que o arquivo `storage.rules` (na raiz do projeto) esteja deployado configurado no seu `firebase.json` de produção.

## Sprint 9 - Segurança, Auditoria e Hardening (Firestore/Storage)

A arquitetura e segurança dos dados SSMA operam nativamente sobre Firestore Rules e Firebase Storage Rules. Nenhuma interface do frontend possui privilégios de acesso direto ignorados pelo Backend Serverless do Firebase.

- **Coleção:** `ssma_audit_logs`
- **Registro de Log:** Apenas eventos transacionais (*CREATE*, *UPDATE*, *DISABLE*, *CANCEL*) de cadastros, regras, evidências e inspeções geram logs (Append-Only). Não ocorrem logs de *READ* puramente visuais, otimizando custos e foco.
- **Cancelamento vs Exclusão:** Exclusão física (Hard Delete) é estritamente proibida por regras (Firestore: `allow delete: if false`). Utiliza-se *Soft Delete* (`active: false`) ou Status (`CANCELLED`).
- **Papéis:** O `getSSMAScope` restringe a visibilidade. `SSMA_ADMIN` tem visão livre; `SSMA_VIEWER` possui `read-only` absoluto no seu escopo; Roles operacionais (Encarregados, TSTs) têm restrições baseadas nos perfis. O painel de Auditoria só pode ser visto por `SSMA_ADMIN` ou `SSMA_MANAGER`.

## Estrutura de Pastas
- `components/`: Componentes visuais do módulo (Dashboard, Inspections, Registers, Rules, Shared).
- `domain/`: Regras de negócio, cálculos e validações.
- `services/`: Integração com backend (Firestore, Storage).
- `hooks/`: Hooks customizados (React e Zustand).
- `data/`: Mocks de dados para desenvolvimento inicial.

## Restrições Atuais
- Não utiliza `localStorage` global (apenas mocks temporários se necessário e isolados).
- Não conectado com o Firebase (default deny).
- Módulo isolado, não afeta outras rotas do portal.
