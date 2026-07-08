# SSMA Production Checklist

## Deploy

- [ ] Rodar `npm run test`.
- [ ] Rodar `npm run build`.
- [ ] Rodar `npm run typecheck` e registrar/enderecar pendencias globais restantes.
- [ ] Rodar `npm --prefix functions run build`.
- [ ] Validar Firestore/Storage Rules no Firebase Emulator Suite ou em dry-run operacional equivalente.
- [ ] Deploy Firestore Rules: `firebase deploy --only firestore:rules`.
- [ ] Deploy Firestore Indexes: `firebase deploy --only firestore:indexes`.
- [ ] Deploy Storage Rules: `firebase deploy --only storage`.
- [ ] Deploy Cloud Functions de auditoria: `firebase deploy --only functions`.
- [ ] Validar deploy do front no Netlify.

## Regras e Seguranca

- [ ] Confirmar que nenhuma colecao SSMA permite delete fisico.
- [ ] Confirmar que `ssma_audit_logs` nao permite create/update/delete client-side.
- [ ] Confirmar que Storage nao permite delete fisico.
- [ ] Confirmar que Storage bloqueia arquivo acima de 10 MB.
- [ ] Confirmar que Storage bloqueia MIME fora de JPEG, PNG, WEBP e PDF.
- [ ] Confirmar que usuario anonimo nao le Firestore/Storage SSMA.

## Perfis de Acesso

- [ ] Testar com Super Admin.
- [ ] Testar com Gerente SSMA (`SSMA_MANAGER`): ve tudo, edita tudo, gerencia metas e cadastros.
- [ ] Testar com Gerente Regional (`SSMA_REGIONAL_MANAGER`): ve/cria/edita/cancela apenas regional.
- [ ] Testar com Gestor de Obra (`SSMA_SITE_MANAGER`): ve/cria/edita/cancela apenas obras do escopo.
- [ ] Testar com Supervisor SSMA (`SSMA_SUPERVISOR`): ve/cria/edita/cancela apenas obras do escopo.
- [ ] Testar com TST (`SSMA_TECHNICIAN`): ve/cria/edita/cancela apenas obras do escopo.
- [ ] Testar com Encarregado (`SSMA_FOREMAN`): ve/cria/edita/cancela apenas obras do escopo.
- [ ] Testar com Viewer (`SSMA_VIEWER`): somente leitura dentro do escopo.

## Fluxo de Lancamentos

- [ ] Criar lancamento IFS.
- [ ] Criar lancamento ALOJAMENTO.
- [ ] Confirmar `createdBy` diferente de `executorUid` quando gerente lanca para terceiro.
- [ ] Confirmar que papel nao-gerencial lanca apenas para si mesmo.
- [ ] Confirmar que evento fora do escopo e negado.
- [ ] Cancelar lancamento com motivo.
- [ ] Confirmar `status=CANCELLED`, `cancelledAt`, `cancelledBy` e `cancelReason`.
- [ ] Confirmar que evento cancelado nao entra no realizado.

## Evidencias

- [ ] Subir JPG valido.
- [ ] Subir PNG valido.
- [ ] Subir WEBP valido.
- [ ] Subir PDF valido.
- [ ] Bloquear arquivo maior que 10 MB.
- [ ] Bloquear MIME nao permitido.
- [ ] Confirmar arquivo no Storage em `ssma/evidences/{competence}/{regionalId}/{costCenterId}/{eventId}/{fileName}`.
- [ ] Confirmar metadados em `ssma_evidences`.
- [ ] Remover evidencia e confirmar `active=false`.
- [ ] Confirmar que Storage nao sofreu delete fisico.

## Metas e Resultados

- [ ] Selecionar competencia na tela de metas.
- [ ] Salvar meta mensal por pessoa.
- [ ] Copiar metas do mes anterior.
- [ ] Confirmar Gerente Regional como `GREG`.
- [ ] Confirmar que metas nao sao por obra.
- [ ] Confirmar resultado individual por `employeeUid`.
- [ ] Confirmar meta zero com `SEM_META`.
- [ ] Confirmar realizado sem meta com `REALIZADO_SEM_META`.
- [ ] Confirmar resultado acima de 100%.
- [ ] Confirmar resultado coletivo com `GREG`, `GESTOR`, `SUPSSMA`, `TST`, `ENCARREGADO`.
- [ ] Confirmar que resultado coletivo respeita escopo selecionado.

## Auditoria

- [ ] Confirmar log server-side ao criar evento.
- [ ] Confirmar log server-side ao editar evento.
- [ ] Confirmar log server-side ao cancelar evento.
- [ ] Confirmar log server-side ao salvar meta.
- [ ] Confirmar log server-side ao adicionar evidencia.
- [ ] Confirmar log server-side ao desativar evidencia.

## Dados Legados

- [ ] Confirmar que `ssma_inspections` nao aparece na listagem principal de eventos.
- [ ] Confirmar que imagens sinteticas/base64 nao entram no fluxo principal.
- [ ] Confirmar que dados legados nao foram apagados.

## Go/No-Go

- [ ] Issues criticos de rules resolvidos.
- [ ] Indices criados em producao.
- [ ] Usuarios piloto vinculados a escopos reais.
- [ ] Backup/export Firestore realizado antes do piloto.
- [ ] Responsavel operacional definido para acompanhar erros do primeiro ciclo.
