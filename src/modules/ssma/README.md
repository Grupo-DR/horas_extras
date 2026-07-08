# Modulo SSMA

O modulo SSMA oficial vive em `src/modules/ssma`. A pasta de prototipo antiga, quando existir na raiz do projeto, e apenas referencia historica e nao deve ser importada pelo fluxo produtivo.

## Papeis

- `SSMA_MANAGER`: ve tudo, cria/edita/cancela lancamentos, gerencia cadastros e metas.
- `SSMA_REGIONAL_MANAGER`: ve e atua nos lancamentos da sua regional.
- `SSMA_SITE_MANAGER`: ve e atua nos lancamentos das suas obras.
- `SSMA_SUPERVISOR`: ve e atua nos lancamentos das suas obras.
- `SSMA_TECHNICIAN`: ve e atua nos lancamentos das suas obras.
- `SSMA_FOREMAN`: ve e atua nos lancamentos das suas obras.
- `SSMA_VIEWER`: somente leitura dentro do escopo.
- `isSuperAdmin`: preserva acesso total para suporte administrativo.

## Escopos

O escopo SSMA vem de `user_profiles/{uid}.modules.ssma.scope`:

- `ALL`: acesso total.
- `REGIONAL`: lista de regionais permitidas.
- `COST_CENTER`: lista de obras/centros de custo permitidos.

Eventos e evidencias carregam `regionalId` e `costCenterId`; por isso conseguem ser validados por rules e services. Metas mensais sao por pessoa e nao carregam escopo denormalizado nesta versao, entao a leitura de metas e liberada para usuarios SSMA e a UI/services filtram colaboradores visiveis por escopo.

## Modelo de Dados

- `ssma_regionals`: catalogo de regionais.
- `ssma_cost_centers`: catalogo de obras/centros de custo.
- `ssma_monthly_targets`: metas mensais por pessoa.
- `ssma_inspection_events`: lancamentos reais de inspecao.
- `ssma_evidences`: metadados de evidencias.
- `ssma_monthly_person_results`: resumo persistivel por pessoa.
- `ssma_monthly_collective_results`: resumo persistivel coletivo.
- `ssma_audit_logs`: trilha de auditoria append-only via Cloud Functions.

Dados legados em `ssma_inspections` nao sao fonte principal do dashboard nem da listagem operacional. O acesso legado fica isolado em adapters/services de compatibilidade ate migracao aprovada.

## Metas Mensais

A meta e mensal e vinculada a pessoa, nunca a obra. A chave logica e:

```text
{competence}_{employeeUid}
```

Grupos canonicos:

- `GREG`: Gerente Regional.
- `GESTOR`: Gestor de Obra.
- `SUPSSMA`: Supervisor de SSMA.
- `TST`: Tecnico de Seguranca.
- `ENCARREGADO`: Encarregado.

`SSMA_REGIONAL_MANAGER` entra como `GREG` e tem meta propria.

## Lancamentos

Lancamentos ficam em `ssma_inspection_events`.

- `createdBy`: usuario que cadastrou.
- `executorUid`: pessoa que executou e recebe o realizado.
- `regionalId` e `costCenterId`: escopo do local onde o evento aconteceu.
- `status`: `VALID` ou `CANCELLED`.

Nao existe hard delete. "Apagar" na UI significa cancelamento logico com `cancelReason`, `cancelledAt` e `cancelledBy`.

## Evidencias

Arquivos sao enviados para Firebase Storage:

```text
ssma/evidences/{competence}/{regionalId}/{costCenterId}/{inspectionEventId}/{fileName}
```

Metadados ficam em `ssma_evidences`. Nao salvar Base64 no Firestore.

Tipos aceitos:

- `image/jpeg`
- `image/png`
- `image/webp`
- `application/pdf`

Limite: 10 MB.

Remocao de evidencia e soft delete (`active=false`); o arquivo no Storage nao e apagado nesta fase.

## Calculo Individual

Fonte: eventos reais `VALID` + metas mensais.

```text
resultadoIndividual =
(realIFS + realAlojamento) / (metaIFS + metaAlojamento)
```

Tratamento de meta zero:

- `metaTotal > 0`: calcula normalmente.
- `metaTotal = 0` e `realTotal = 0`: `resultadoIndividual = null`, status `SEM_META`.
- `metaTotal = 0` e `realTotal > 0`: `resultadoIndividual = null`, status `REALIZADO_SEM_META`.

Resultado pode passar de 100%.

## Calculo Coletivo

Fonte: soma de eventos reais `VALID` e metas mensais, respeitando escopo visualizado.

```text
totalRealizado = soma de real IFS/Alojamento por GREG, GESTOR, SUPSSMA, TST e ENCARREGADO
totalMeta = soma de meta IFS/Alojamento por GREG, GESTOR, SUPSSMA, TST e ENCARREGADO
resultadoColetivo = totalRealizado / totalMeta
```

`GREG` sempre entra como grupo proprio.

## Seguranca

Firestore Rules:

- negam delete fisico em colecoes SSMA;
- restringem eventos/evidencias por `regionalId` e `costCenterId`;
- permitem escrita de metas/cadastros apenas para `SSMA_MANAGER`, `SSMA_ADMIN` ou Super Admin;
- impedem alteracao de campos de criacao (`createdAt`, `createdBy`);
- validam campos criticos de eventos, metas e evidencias;
- bloqueiam escrita direta em `ssma_audit_logs`.

Storage Rules:

- negam acesso anonimo;
- negam delete fisico;
- aceitam apenas o caminho SSMA esperado;
- validam `contentType` e tamanho de ate 10 MB.

Limitacao conhecida: Storage Rules nao validam papel/escopo SSMA porque o projeto ainda nao emite custom claims SSMA no Firebase Auth token. A validacao complementar fica no service e nas Firestore Rules de metadados.

## Auditoria

Auditoria server-side foi adicionada em Cloud Functions para:

- `ssma_inspection_events` create/update/cancel;
- `ssma_monthly_targets` create/update;
- `ssma_evidences` create/update/disable.

Os logs sao gravados em `ssma_audit_logs`. Como triggers Firestore nao recebem auth context, o ator e inferido dos snapshots (`createdBy`, `updatedBy`, `cancelledBy`, `uploadedBy`).

O service client-side de auditoria e best-effort para compatibilidade e nao deve ser tratado como fonte autoritativa.

## Validacao de Dominio

Validadores ficam em `src/modules/ssma/domain/validators.ts` e cobrem:

- competencia `YYYY-MM`;
- data `YYYY-MM-DD`;
- tipo de inspecao;
- grupo de meta;
- metas nao negativas;
- evento com regional/obra/executor;
- cancelamento com motivo;
- evidencia com MIME e tamanho validos.

## Performance e Indices

Consultas de eventos usam `competence` como filtro principal e, quando aplicavel, `regionalId` ou `costCenterId`. Para listas maiores que o limite de `in`, os services fazem consultas em lotes.

Indices previstos ficam em `firestore.indexes.json`:

- `ssma_inspection_events`: `competence + regionalId`;
- `ssma_inspection_events`: `competence + costCenterId`;
- `ssma_evidences`: `inspectionEventId + active`;
- `ssma_monthly_targets`: `competence + employeeUid`.

## Como Testar

```bash
npm run test
npm run build
npm run typecheck
```

Observacao: no estado atual do repositorio, `typecheck` ainda possui pendencias fora do modulo SSMA em componentes legados de CRM/contratos/KPI/construction/CH. O filtro por `src/modules/ssma` nao deve retornar erros.

Lint nao foi adicionado nesta sprint porque o repositorio nao possui configuracao ESLint ativa. A validacao minima para o piloto e `test`, `build`, build das Functions e revisao das rules.

## Deploy

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
npm --prefix functions run build
firebase deploy --only functions
```

Para deploy completo do front, usar o pipeline Netlify configurado no projeto.

## Limitacoes Conhecidas

- As rules devem ser validadas em ambiente com Firebase Emulator Suite operacional antes do piloto. Nesta maquina, `firebase emulators:exec` com Firebase CLI 15.7.0 retornou `No emulators to start`, mesmo com `emulators` declarado em `firebase.json`.
- `npm run typecheck` ainda falha por pendencias historicas fora do SSMA; o filtro por `src/modules/ssma` e `functions/src` nao retornou erros nesta sprint.
- O projeto ainda nao possui custom claims SSMA no Auth token; por isso Storage Rules validam autenticacao, caminho, tamanho e MIME, enquanto escopo/papel fica reforcado nos services e nos metadados Firestore.
