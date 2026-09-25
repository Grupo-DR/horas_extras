**Avaliação do planejamento de horas extras — Portal-commercial**

Avaliação em 23/09/2026. Código local: commit `b8fe57b`, de 17/09/2026. O repositório estava sem alterações rastreadas no início da análise.

**Parecer: a função tem uma base funcional aproveitável, mas apresenta falhas graves de confiabilidade e controle de aprovação. Eu não trataria o “salvo”, o “aprovado” ou o custo exibido como garantias suficientes para decisões operacionais sem corrigir os pontos prioritários abaixo.** Existem defeitos reproduzidos em situações normais de uso; não são apenas possibilidades abstratas ou sugestões de organização do código.

Foram examinados a tela de planejamento, a grade por centro de custo, a aprovação, os serviços de persistência, as regras e os índices do Firestore, os perfis de acesso, o headcount e os salários que alimentam os cálculos, os budgets e o consumo do planejamento nos painéis de realizado versus planejado.

O código da aplicação e o banco não foram alterados. Foram adicionados somente este relatório e um script de reprodução local. Não houve implantação, consulta ao banco atual de produção nem confirmação de quais regras estão efetivamente publicadas. Também não foi feita navegação autenticada na interface. As conclusões sobre as regras de segurança se referem ao arquivo versionado, por inspeção; não são resultados de um teste de invasão ou de execução no emulador.

**Como o fluxo funciona hoje**

O gestor seleciona uma competência que corresponde ao período do dia 21 do mês anterior ao dia 20 do mês selecionado. A lista de pessoas combina headcount, registros TOTVS e cadastros manuais. O lançamento é diário por pessoa e centro de custo. A tela mantém horas e status em mapas locais, grava documentos no Firestore e também guarda cópias no navegador.

O envio altera os status para `pending`; o aprovador atua por centro de custo, marcando `approved` ou devolvendo para `draft`. O custo é estimado pelo salário dividido por 220, multiplicado por 1,6 em dias que não são domingo e 2,0 aos domingos. O e-mail é um texto para copiar: não há envio automático nem comprovação de entrega. Os dashboards consultam os registros para comparar planejamento e realização.

**Prioridades para produção**

| Prioridade | Problema | Consequência prática |
|---|---|---|
| Imediata | Aprovação não é protegida pelas regras do banco | Um planejador autorizado a escrever pode gravar aprovação ou modificar registros aprovados |
| Imediata | Erro remoto vira sucesso local | Gestor/aprovador acredita que concluiu uma ação que não chegou ao banco |
| Imediata | Aprovar/devolver alcança datas fora da folha mostrada | Outros períodos podem ser alterados sem revisão |
| Imediata | Atualização do headcount apaga salários de uma competência anterior | Custos históricos podem desaparecer ou cair para zero |
| Alta | Gravação sem verificar versão/status atual | Uma tela antiga pode desfazer uma aprovação recente |
| Alta | Limpar horas de rascunho não persiste a exclusão | Horas apagadas reaparecem ao recarregar |
| Alta | Aprovação usa o centro de custo errado para pessoas em múltiplos CCs | O aprovador revisa números diferentes dos que serão aprovados |
| Alta | Envio ignora filtros de CC/regional | Registros ocultos também são submetidos |
| Alta | Budget ignora o ano | Limite disponível fica inflado quando há vários anos cadastrados |
| Alta | Salário ausente é tratado como custo zero | Estimativa fica artificialmente baixa, sem alerta |
| Alta | Horas e elegibilidade têm validação insuficiente | Valores impossíveis e pessoas inativas podem entrar no planejamento |

“Imediata” significa prioridade de contenção e correção antes de confiar no fluxo como autorização operacional. Não significa que todas as consequências foram constatadas no banco atual. “Alta” indica defeito ou lacuna com impacto relevante; os exemplos reproduzidos são descritos abaixo.

**1. As regras não separam planejar de aprovar — prioridade imediata; confirmado por inspeção.**

`isCHPlanner()` inclui gerentes, planejadores, administradores e aprovadores. Tanto criação quanto atualização de `hc_planning_records` usam essa função. A validação aceita `approved` como qualquer outro status e também permite status ausente. Embora exista `canApproveCH()`, ela não é usada para proteger as transições do planejamento.

Isso permite, pelas regras versionadas, que um planejador com acesso ao CC escreva `approved` diretamente ou altere horas de registros já aprovados. Não é necessário ser administrador para que a regra de escrita autorize o documento. O botão estar escondido na tela não resolve essa condição. Os campos de aprovador, data e identidade do registro também não são protegidos contra alteração nessa coleção.

Existe outra inconsistência: o planejamento trata ausência de status como rascunho, mas Dashboard e AnalysisPanel incluem esses registros como aprovados. Esse caso não apareceu na exportação histórica analisada, mas é permitido pelo contrato atual.

Correção: definir e impor no servidor/regras uma máquina de estados; exigir status; restringir transições a aprovadores; proteger identidade e metadados; exigir nova aprovação quando horas aprovadas mudarem. Registros legados sem status precisam de classificação explícita, não aprovação implícita. Evidências: [firestore.rules:52][r52], [firestore.rules:116][r116], [firestore.rules:338][r338], [Dashboard.tsx:542][d542] e [AnalysisPanel.tsx:2488][a2488]. O Firestore permite restringir campos modificáveis usando as diferenças entre documentos, mecanismo pertinente a essa correção: [documentação oficial](https://firebase.google.com/docs/firestore/security/rules-fields).

**2. O sistema pode informar sucesso sem salvar no servidor — prioridade imediata; reproduzido.**

`savePlanning()` captura erros do Firestore, atualiza o cache e termina normalmente. Quando está offline, nem tenta a gravação remota. Os chamadores interpretam a resolução da promessa como sucesso e mostram “salvo”, “submetido” ou “aprovado”. Não há retorno distinguindo confirmação remota de rascunho local.

Reprodução: foi simulada uma rejeição remota `permission-denied`; o serviço terminou sem erro, criou um registro local e nenhum remoto. Em outro cenário, salvar offline e depois consultar online não sincronizou o registro: a leitura remota retornou vazia. Não foi encontrado mecanismo de fila e reenvio dessa gravação omitida. Uma falha de permissão também não deve ser tratada como mera falta de internet.

Correção: sucesso somente após confirmação remota; propagar erro; oferecer rascunho local com identificação explícita e fila/versionamento caso trabalho offline seja requisito. Aprovação offline não deve ser apresentada como concluída. Evidências: [planning.ts:101][s101], [Planning.tsx:1383][p1383], [Planning.tsx:1507][p1507], [Planning.tsx:1705][p1705].

**3. Aprovação e devolução alteram datas fora da competência mostrada — prioridade imediata; reproduzido.**

Os handlers carregam os dois meses de calendário que interceptam a folha. Depois filtram apenas centro de custo e status; não recortam `date` entre `periodStart` e `periodEnd`. A grade apresentada ao aprovador, porém, percorre somente esse intervalo.

Exemplo reproduzido: para setembro, a tela representa 21/08–20/09. Pendências de 10/08 e 25/09 também foram incluídas tanto na aprovação quanto na devolução. Logo, o conjunto gravado pode ser maior que o conjunto revisado. Também não existe uma entidade de solicitação que preserve o intervalo personalizado enviado pelo gestor.

Correção: a operação deve usar exatamente os IDs e versões apresentados na revisão, vinculados a uma solicitação/intervalo explícito. Como contenção, aplicar o recorte da folha em ambos os handlers. Evidências: [Planning.tsx:1350][p1350], [Planning.tsx:1402][p1402], [Planning.tsx:1905][p1905].

**4. O upload de headcount pode apagar salários da competência anterior — prioridade imediata; reproduzido.**

Essa dependência é relevante porque fornece o salário usado no planejamento. O upload chama `replaceHeadcount()`. A geração dos salários usa a competência de folha da data final. Já a lista de competências a substituir inclui também os meses de calendário das datas inicial e final. As exclusões são feitas antes da inserção.

Reprodução: um headcount válido para 21/08/2026–20/09/2026 ordenou apagar salários de agosto e setembro, mas gerou novos salários apenas para setembro. Se existirem alocações salariais de agosto, elas serão removidas por essa operação. A exclusão por competência atinge todos os registros salariais daquele mês, não só as pessoas do novo arquivo. Além disso, uma falha após a exclusão pode deixar a substituição incompleta; `saveSalaries()` oculta o erro.

Correção: calcular substituição pela mesma definição de competência usada na geração; preservar históricos; validar o lote antes de ativá-lo e tratar exclusão/inserção como publicação controlada de uma nova versão. Evidências: [HeadcountUpload.tsx:274][h274], [planning.ts:48][s48], [planning.ts:79][s79], [planning.ts:232][s232], [firestoreCH.ts:202][f202].

**5. Concorrência pode desfazer aprovações e alterar o conteúdo já aprovado — alta; reproduzido em I/O simulado.**

As gravações usam o estado local da tela e `batch.set(..., { merge: true })`, sem verificar a versão/status atual no banco. O modal e o botão geral reenviam registros carregados, inclusive os que não foram modificados. Não existe transação de leitura e verificação nem bloqueio por versão.

Reprodução: a tela possuía 2 horas em rascunho, enquanto o banco simulado já possuía 8 horas aprovadas. “Salvar rascunho” voltou o registro para 2 horas e `draft`. Outro teste alterou 2 horas aprovadas para 8 horas preservando `approved`. Esse segundo caminho está disponível na interface a administradores/aprovadores pelo `canOverrideLock`. Como a escrita usa merge e não fornece novos metadados de aprovação, a aprovação anterior pode permanecer associada ao novo conteúdo.

Correção: gravar somente alterações explícitas, comparar versões, registrar conflito e exigir nova aprovação ou retificação auditável. Para alterações dependentes do estado atual, transações são um mecanismo apropriado: [documentação oficial](https://firebase.google.com/docs/firestore/manage-data/transactions). Evidências: [Planning.tsx:1453][p1453], [Planning.tsx:1642][p1642], [Planning.tsx:1788][p1788], [firestoreCH.ts:221][f221].

**6. Apagar horas de rascunho não apaga o valor persistido — alta; reproduzido.**

O modal reconhece que uma célula anteriormente preenchida foi limpa e envia zero. Entretanto, `handleCostCenterPlanSave()` descarta rascunhos com horas menores ou iguais a zero. O botão geral repete essa regra. Assim, o estado local pode mostrar zero sem enviar exclusão ou atualização equivalente ao banco.

Reprodução: havia 2 horas salvas. Após limpar e salvar, o banco simulado continuou com 2 horas. A correção que evita criar registros vazios acabou confundindo “nunca foi preenchido” com “foi explicitamente apagado”.

Correção: distinguir célula intocada, edição e remoção; persistir a remoção de forma autorizada e auditável. Evidências: [Planning.tsx:660][p660], [Planning.tsx:1481][p1481], [Planning.tsx:1667][p1667].

**7. A revisão de aprovação pode mostrar horas de outro centro de custo — alta; reproduzido.**

`getEmpObj(chapa)` busca a primeira ocorrência da chapa, sem considerar o CC. Na montagem da aprovação, a chave das horas usa `emp.cc`, e não o CC do grupo em revisão. Na grade de elaboração esse trecho usa o CC do grupo, portanto as duas telas podem divergir.

Reprodução: uma pessoa com 2 horas no CC-A e 5 horas no CC-B apareceu na revisão de CC-B com 2 horas. A operação posterior de aprovação filtra corretamente pelo CC-B no banco: o aprovador pode conferir um valor e aprovar outro. Se a situação/status de A diferir de B, uma pendência de B também pode desaparecer da revisão.

Correção: usar identidade composta por chapa e CC nas buscas/projeções. Evidências: [Planning.tsx:1348][p1348], [Planning.tsx:1886][p1886], [Planning.tsx:1910][p1910].

**8. Enviar para aprovação ignora o filtro visual de CC/regional — alta; reproduzido.**

Resumo e e-mail usam `displayCostCenters`, que aplica os filtros. Já `handleSave(true)` percorre `uniqueEmployees`, com todas as pessoas acessíveis ao usuário. O período é filtrado, mas o centro de custo/regional selecionado não.

Reprodução: com o filtro no CC-A, foram submetidos CC-A e CC-B. Isso continua dentro do escopo de acesso do usuário, mas ultrapassa o conjunto visível e descrito no e-mail. É uma divergência funcional, não um acesso a CC sem permissão.

Correção: usar o mesmo conjunto explícito de registros para prévia, e-mail e submissão, mostrando contagem de CCs, pessoas, dias e horas antes da confirmação. Evidências: [Planning.tsx:1217][p1217], [Planning.tsx:1237][p1237], [Planning.tsx:1642][p1642].

**9. Budget de vários anos é somado indevidamente — alta; reproduzido.**

O sistema carrega todos os budgets, mas o indicador seleciona registros apenas pelo nome do mês (`Setembro`, por exemplo). O campo `monthKey`, que contém ano e mês, não participa desse filtro.

Reprodução: setembro/2025 com R$ 10 mil e setembro/2026 com R$ 12 mil resultaram em R$ 22 mil ao selecionar setembro/2026. Isso distorce saldo, percentual e alerta de estouro.

Correção: filtrar pela competência completa `YYYY-MM`; usar a mesma seleção em todos os indicadores. Evidências: [Planning.tsx:1106][p1106], [Planning.tsx:1546][p1546].

**10. Custo desconhecido aparece como zero — alta; reproduzido.**

Se o salário não existir ou ainda não tiver sido carregado, as horas entram no total, mas nenhum custo é somado. Não há indicador de cobertura salarial, custo incompleto ou bloqueio de envio baseado nessa ausência.

Reprodução: 8 horas planejadas e salário ausente resultaram em custo total zero. Isso pode afetar novos colaboradores, cadastros manuais, competências sem salários e situações provocadas pelo problema do upload descrito no item 4. O fato de a tela chamar o valor de “estimado” não informa ao usuário que parte dele está faltando.

Correção: distinguir zero de desconhecido; informar quantas pessoas/horas estão sem base salarial; exigir resolução ou exceção explicitamente registrada antes de uma aprovação financeira. Evidências: [Planning.tsx:1078][p1078], [Planning.tsx:1521][p1521], [Planning.tsx:1259][p1259].

**11. Validação de horas é permissiva demais — alta; reproduzido e com evidência histórica.**

O conversor aceita `25` como 25 horas, `1:90` como 2,5 horas, `2abc` como 2 horas e `1:xx` como 1 hora. `-01:30` vira -0,5, em vez de -1,5. `Infinity` também atravessa esse parser; isso não foi testado como gravação real no Firestore. Não há validação de domínio consistente antes de salvar. Nas regras, as horas precisam apenas ser um número não negativo; não há teto diário.

O alerta visual de 44 horas é um total por pessoa dentro daquele CC e período. Ele não valida jornada diária, soma da pessoa entre CCs, intervalos, escalas ou qualquer política de exceção. Não é um controle completo de conformidade. Esta avaliação não afirma qual limite contratual/trabalhista deve se aplicar: isso depende da regra aprovada pela empresa.

Correção: parser estrito com mensagem de erro, limites físicos básicos e validações operacionais configuráveis; regras iguais no servidor. Evidências: [formatters.ts:21][fmt21], [Planning.tsx:819][p819], [firestore.rules:120][r120]. A exportação histórica contém 52 registros diários acima de 24 horas, todos em rascunho; não há evidência nela de que esses 52 tenham sido aprovados.

**12. Planejamentos históricos podem ficar invisíveis quando a pessoa sai das fontes atuais — alta; reproduzido.**

As linhas exibidas são construídas a partir de headcount, TOTVS e pessoas manuais. Os próprios registros de planejamento não são usados para garantir a presença da pessoa/CC. O cadastro global fornece nome, mas não inclui uma linha por si só.

Reprodução: com planejamento salvo e cadastro global existente, mas sem presença nas outras três fontes, a lista resultou em zero pessoas. O documento permanece no banco e pode continuar no dashboard, mas ficar ausente da tela de elaboração/aprovação. Mudança de lotação, substituição do headcount ou período diferente na consulta TOTVS tornam esse cenário relevante.

Correção: montar históricos também a partir dos registros já salvos e manter snapshots de pessoa, CC, função e vigência. Diferenciar “não elegível para novo lançamento” de “não deve aparecer no histórico”. Evidências: [Planning.tsx:1009][p1009], [Planning.tsx:1202][p1202].

**13. A trilha de aprovação não permite reconstruir a decisão — alta; confirmado por inspeção.**

Não foram encontradas chamadas de auditoria para salvar, enviar, aprovar, devolver ou retificar o planejamento. Existe `writeAudit()`, mas suas chamadas no módulo são para migração/headcount. Os documentos mantêm a última alteração e, quando aprovados, aprovador/data; isso não constitui um histórico de mudanças.

A devolução transforma `pending` em `draft` sem motivo obrigatório, autor da devolução ou data específica. Não há ID da solicitação, versão aprovada, justificativa, histórico antes/depois ou comprovação do conjunto revisado. Os timestamps e e-mails são fornecidos pelo cliente e não estão vinculados à identidade autenticada nas regras dessa coleção. A regra dos próprios logs também não exige que `userEmail` corresponda ao autor autenticado.

Correção: trilha imutável vinculada ao usuário autenticado e ao horário do servidor; snapshots/versões de submissão; motivo de devolução; política explícita para autoaprovação e retificação. Evidências: [Planning.tsx:1376][p1376], [Planning.tsx:1419][p1419], [firestoreCH.ts:236][f236], [firestoreCH.ts:262][f262], [firestore.rules:406][r406].

**14. Há fragilidades no isolamento de dados por usuário e regional — alta; parte reproduzida, parte por inspeção.**

O cache usa chaves globais do navegador, sem UID. O logout não limpa essas cópias. O fallback de headcount retorna todos os registros locais, sem aplicar o escopo do usuário. Foi reproduzido um usuário limitado ao CC-A recebendo do serviço um registro salarial do CC-B que já estava no cache. A tela de planejamento aplica filtros próprios e reduz a exposição nela; não se deve presumir que toda tela que usa esse serviço esteja protegida. AnalysisPanel também inicializa seu estado com todo o planejamento aprovado do cache antes da atualização remota.

Nas regras regionais há uma questão adicional: o acesso usa `regional`/`regionalId` do documento, campos informados pelo cliente, sem validar o vínculo com o CC em um cadastro confiável. Um escritor regional pode fabricar um documento com CC de outra regional e o rótulo de sua própria regional. Isso não lhe dá automaticamente leitura de todos os documentos legítimos de outras regionais, mas permite introduzir dados mal classificados. Constatado no arquivo de regras, sem tentativa contra produção.

Correção: cache por usuário e escopo, descarte no logout/troca de perfil e filtros também nos fallbacks; validar o vínculo CC–regional no servidor. Revisar se planejadores precisam ler salários individuais, pois hoje a coleção salarial é legível pelos perfis leitores do módulo dentro do escopo. Evidências: [planning.ts:552][s552], [planning.ts:133][s133], [AuthContext.tsx:205][auth205], [AnalysisPanel.tsx:2452][a2452], [firestore.rules:96][r96].

**15. Elegibilidade e vigência do colaborador não são validadas por dia — média/alta, conforme operação.**

Um cadastro manual `INACTIVE` continua na lista de planejamento: reproduzido. Para headcount, basta haver interseção de vigência com o período para a pessoa entrar na lista; o campo diário não verifica se a pessoa está alocada naquele CC naquele dia. Registros TOTVS também acrescentam pessoas sem um teste específico de vínculo ativo para a competência selecionada no planejamento.

A seleção de pessoas não funciona como limite de gravação: os checkboxes servem para filtrar a exibição, mas o salvamento percorre todos os membros e preserva/reenvia suas horas. Isso deve ficar claro na interface.

Correção: elegibilidade por pessoa, CC e dia, com exceções justificadas; manter pessoas inativas visíveis quando houver histórico, sem permitir novos lançamentos indiscriminadamente. Evidências: [Planning.tsx:1021][p1021], [Planning.tsx:1046][p1046], [Planning.tsx:660][p660], [Planning.tsx:839][p839].

**16. Premissas de custo precisam ser explícitas e versionadas — melhoria relevante; não é conclusão de ilegalidade.**

O divisor 220 e os multiplicadores 60%/100% são fixos. Domingo define 100%; feriados não participam do cálculo. Não existe identificação de tipo de extra, escala, adicional noturno ou encargos no registro planejado. Na comparação individual, o realizado inclui também interjornada e adicional noturno. Esses eventos podem não ser comparáveis diretamente com a quantidade genérica de horas planejadas.

O salário não é congelado na submissão/aprovação: uma atualização pode recalcular retroativamente o custo exibido. Além disso, quando há mais de um salário por chapa, a tela escolhe o maior, sem diagnosticar o conflito.

É necessário decidir com RH/DP/gestão: o objetivo é estimar só HE direta ou todo o custo? Como tratar feriados, jornadas com outros divisores, rateio, noturno, exceções e reajustes? A melhoria é centralizar uma regra de cálculo, torná-la explícita e preservar sua versão/base usada na decisão. Evidências: [Planning.tsx:1078][p1078], [Planning.tsx:1532][p1532], [EmployeeDailyComparisonModal.tsx:54][e54].

**17. Importação de budget tem semântica inconsistente e confirma cedo demais — média; confirmado por inspeção.**

`handleBudgetImport()` chama `saveBudgets()` sem `await` e mostra sucesso imediatamente. Na tela, remove todos os budgets anteriores das competências presentes no arquivo. No banco, porém, faz upsert somente das linhas importadas; os outros CCs dessas competências continuam existindo. Ao recarregar, eles podem reaparecer. O cache também é substituído apenas pelo arquivo importado.

Meses não reconhecidos caem na competência selecionada; ano ausente vira o ano corrente; não há prévia de diferenças, rejeição clara de CC desconhecido, tratamento consistente de duplicatas ou proibição de valores negativos. Essas permissividades exigem cuidado especial em reimportações parciais.

Correção: escolher “mesclar por competência+CC” ou “substituir competência” e aplicar a mesma operação em tela, cache e banco; validar e mostrar prévia antes da confirmação; aguardar persistência. Evidências: [Planning.tsx:1581][p1581], [planning.ts:297][s297], [firestoreCH.ts:104][f104].

**18. Carregamento, falhas e edição não estão coordenados — média; confirmado por inspeção.**

O carregamento de planejamento não tem cancelamento da resposta anterior nem versão da requisição. Uma troca rápida de competência pode permitir que a resposta antiga substitua os mapas da seleção mais nova. Não há estado de carregamento que bloqueie essas ações durante a troca. A carga salarial já possui cancelamento, o que é um padrão aproveitável.

O modal reinicializa os campos quando `plans` ou `memberChapas` mudam. Uma atualização em segundo plano pode descartar edição ainda não salva. Fechar o modal não verifica alterações pendentes. O handler de salvar do modal não usa `try/finally`; uma exceção que escape pode deixá-lo em “salvando”. O painel de aprovação não recebe `saving` para desabilitar os botões enquanto a operação está em curso.

Correção: estados claros de carregamento/erro/alterado/salvando, cancelamento de requisições obsoletas, proteção contra clique repetido e confirmação de descarte. Esses comportamentos ainda precisam de testes com navegador. Evidências: [Planning.tsx:574][p574], [Planning.tsx:660][p660], [Planning.tsx:1161][p1161], [ApprovalPanel.tsx:409][ap409].

**19. Cache, volume e manutenção precisam de tratamento estrutural — média; riscos de escala não medidos em carga.**

Atualizar o cache de planejamento apenas mescla os documentos recebidos: não remove registros que desapareceram do resultado remoto. Reproduzido: a consulta online retornou vazia após remoção remota simulada; ao ficar offline, o registro antigo reapareceu. A poda por limite de armazenamento mantém até 8 mil registros, sem comunicar que o histórico local ficou parcial.

Cada busca mensal traz dados de todo o escopo e só depois aplica alguns filtros. O planejamento usa um lote de escrita único, sem dimensionamento, para todos os registros; um clique pode reenviar dias/pessoas intactos. Não foi medido o ponto de falha desse lote nem se afirma um limite fixo de documentos. O Firebase alerta para tamanho de transação e atualizações de índices em lotes grandes: [documentação oficial](https://firebase.google.com/docs/firestore/manage-data/transactions).

`Planning.tsx` tem 2.173 linhas e mistura componentes, cálculos, importação, e-mail, seleção de pessoas, persistência e aprovação. A fórmula financeira aparece em vários lugares. Há restos de implementação, como navegação semanal sem uso no fluxo atual e um handler de calendário individual sem chamada. Existe ainda diagnóstico de uma chapa específica imprimindo o registro de headcount no console, potencialmente com salário.

Correção: extrair domínio de planejamento e cálculo, reduzir leituras/escritas, atualizar cache por consulta/versionamento, dimensionar lotes, remover diagnósticos pessoais e medir desempenho antes de acrescentar funcionalidades. Evidências: [planning.ts:133][s133], [firestoreCH.ts:221][f221], [firestoreCH.ts:246][f246], [Planning.tsx:1023][p1023].

**O que está bem resolvido e merece ser preservado**

- O recorte de folha 21–20 existe de forma explícita; utilitários compartilhados tratam competência e passagem de ano. O defeito principal é a aplicação inconsistente desses limites nos handlers de aprovação.
- O modelo por pessoa, CC, data e tipo é uma boa base para rastreamento diário. Os IDs criados pela tela são determinísticos. Na exportação local não foram encontradas duplicidades pela chave de negócio; as regras, porém, ainda não impõem essa identidade.
- Há separação inicial entre interface, serviços e utilitários. O domínio pode ser extraído gradualmente sem reescrever o módulo inteiro.
- As consultas ao Firestore aplicam escopo de CC/regional e existem índices versionados para planejamento. Não se trata de um banco aberto a qualquer visitante: autenticação, acesso ao módulo e negação padrão estão presentes.
- A interface de elaboração bloqueia edição comum de pendentes/aprovados; a intenção de controle está clara, embora falte proteção correspondente no servidor e contra concorrência.
- A grade organiza regional → CC → pessoa e separa horas em rascunho, pendentes e aprovadas. Busca e filtro por função ajudam no trabalho de equipes grandes. O painel oferece detalhamento diário antes da aprovação.
- Existem dados de aprovador e data no fluxo normal. Todos os registros aprovados da exportação histórica possuíam esses campos; falta ampliar isso para uma trilha confiável e imutável.
- O e-mail consolida período, CCs, pessoas, horas e custos e permite copiar o texto. É um recurso útil, desde que use exatamente a solicitação submetida.
- A integração TOTVS possui testes de erro/formato e metadados de consulta; seus 11 testes passaram nesta avaliação. A compilação também terminou com sucesso.

**Qualidade técnica e verificações executadas**

| Verificação | Resultado | Como interpretar |
|---|---|---|
| Script de auditoria local | 18 verificações concluídas: 17 execuções com dados sintéticos e 1 checagem estática de predicados | Confirma os comportamentos descritos, não a segurança ou correção geral |
| Suíte existente (`npm.cmd test`) | 35 testes: 24 passaram e 11 falharam | 5 falhas em absenteísmo; 6 em SSMA; 11 testes TOTVS passaram |
| Verificação TypeScript (`npm.cmd run typecheck`) | Falhou | Erros em vários módulos, incluindo incompatibilidades nos tipos de headcount; não foram atribuídos todos ao planejamento |
| Compilação de produção | Passou | Geração de bundle não comprova as regras de negócio; o script de build não executa typecheck nem testes |
| Testes específicos preexistentes de planejamento/aprovação/regras | Não encontrados | Os caminhos de maior risco estavam sem cobertura automatizada no repositório |
| Inspeção de dados | Exportação local de junho, somente agregados | Não representa uma consulta atual ao ambiente publicado |

A compilação foi gerada em pasta temporária separada, sem substituir a pasta `dist` existente e sem implantação. Houve avisos de bundle grande e de imports; são contexto técnico, não explicação dos defeitos funcionais. A execução inicial do Vitest foi bloqueada pelo acesso do carregador do Vite a diretórios ancestrais; a execução local com permissão apropriada completou e produziu os resultados acima.

O script [reproduce.cjs][repro] extrai handlers/projeções reais do componente com o parser TypeScript e executa o serviço real com Firestore/navegador simulados. Ele não conecta Firebase, não carrega credenciais e não escreve dados de produção. As asserções confirmam o comportamento defeituoso atual: depois das correções, devem ser substituídas por testes que exijam o comportamento correto. Não equivalem a testes ponta a ponta ou de regras no emulador.

Para repetir a verificação local a partir da raiz do projeto:

```text
node audits/2026-09-23-horas-extras/reproduce.cjs
```

**O que a exportação histórica mostra**

Arquivo: `json_firebase/hc_planning_records_2026-06-12.json`. O nome indica junho/2026; não foi autenticada sua origem nem comparado seu conteúdo com produção. Os registros abrangem datas de fevereiro a junho/2026.

| Medida | Quantidade |
|---|---:|
| Registros totais, todos `DAILY` | 56.784 |
| Rascunhos | 44.186 |
| Aprovados | 10.309 |
| Pendentes | 2.289 |
| Registros com zero horas, em qualquer status | 52.391 |
| Aprovados com zero horas | 7.395 |
| Registros diários acima de 24 horas | 52 |
| Distribuição desses valores | 40 de 100h; 6 de 200h; 6 de 600h |
| Status dos 52 valores acima de 24h | Todos em rascunho |
| Aprovados sem aprovador ou data de aprovação | 0 |
| Registros sem status | 0 |
| Duplicidades de chapa+CC+data+tipo | 0 |
| Pessoas com horas positivas em mais de um CC ao longo do arquivo | 23 |

Zeros aprovados podem ser resíduos de gravação de grade completa; isoladamente não provam pagamento indevido nem perda de horas. Os valores de 100/200/600 horas exigem rastreamento de origem, mas não é correto presumir que foram aprovados, executados ou pagos. A presença de pessoas em vários CCs demonstra relevância desse modelo de dados; não prova alocação simultânea em todos esses casos.

**Sequência recomendada de correção e critérios de aceite**

1. **Conter as falhas de autorização e persistência.** Impor transições nas regras/servidor, tornar aprovações verificáveis, propagar erros, cortar datas corretamente e corrigir a exclusão de salários de competências anteriores. Aceite: planejador não consegue aprovar via API; erro remoto nunca mostra sucesso; setembro não altera 10/08 ou 25/09; upload de setembro não remove salários de agosto.
2. **Corrigir consistência entre decisão, tela e banco.** Implementar versão/conflito, remoção explícita de rascunho, chave pessoa+CC e conjunto único para envio/e-mail/revisão. Aceite: duas sessões não desfazem aprovações silenciosamente; limpar célula persiste; 2h no CC-A e 5h no CC-B continuam corretas em todas as telas; filtro de CC é respeitado no envio.
3. **Sanear estimativas e dados de entrada.** Budget por ano/mês, salário desconhecido destacado, parser estrito, vigência/inatividade e preservação de históricos. Aceite: valores impossíveis são rejeitados; custo parcial nunca se apresenta como completo; pessoa desligada mantém histórico, mas não ganha lançamentos sem regra explícita.
4. **Conferir os dados atuais com uma extração somente de leitura.** Identificar regras publicadas, versões do frontend, aprovados sem metadados, horas impossíveis, períodos alterados além da folha, salários ausentes e divergências de total por CC. Exportar antes de qualquer saneamento e revisar os casos com a operação. Não apagar em massa zeros ou “recalcular tudo” automaticamente.
5. **Criar cobertura permanente e rotina de liberação.** Testes de regras no emulador, duas sessões concorrentes, rede offline/erro, troca de competência, múltiplos CCs, reimportação de budget e upload de headcount. Exigir build, typecheck e testes pertinentes antes de publicar; organizar as falhas preexistentes em paralelo.
6. **Melhorar operação e manutenção.** Solicitação com ID, justificativa, revisão por período, histórico de decisões, notificações se desejadas, fórmula centralizada/configurável e monitoramento de erros de gravação. Isso deve vir depois da estabilização dos dados e aprovações.

A recomendação é uma estabilização dirigida, preservando a estrutura útil já existente. A prioridade é tornar o resultado de cada ação confiável: o que foi revisado precisa ser exatamente o que foi aprovado, o que foi salvo precisa existir no servidor, e o custo precisa declarar quando não pode ser calculado integralmente.

[repro]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/audits/2026-09-23-horas-extras/reproduce.cjs>
[r52]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/firestore.rules:52>
[r96]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/firestore.rules:96>
[r116]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/firestore.rules:116>
[r120]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/firestore.rules:120>
[r338]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/firestore.rules:338>
[r406]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/firestore.rules:406>
[d542]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Dashboard.tsx:542>
[a2452]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/AnalysisPanel.tsx:2452>
[a2488]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/AnalysisPanel.tsx:2488>
[auth205]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/contexts/AuthContext.tsx:205>
[s48]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/services/planning.ts:48>
[s79]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/services/planning.ts:79>
[s101]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/services/planning.ts:101>
[s133]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/services/planning.ts:133>
[s232]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/services/planning.ts:232>
[s297]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/services/planning.ts:297>
[s552]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/services/planning.ts:552>
[f104]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/services/firestoreCH.ts:104>
[f202]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/services/firestoreCH.ts:202>
[f221]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/services/firestoreCH.ts:221>
[f236]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/services/firestoreCH.ts:236>
[f246]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/services/firestoreCH.ts:246>
[f262]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/services/firestoreCH.ts:262>
[h274]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/HeadcountUpload.tsx:274>
[fmt21]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/utils/formatters.ts:21>
[e54]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/EmployeeDailyComparisonModal.tsx:54>
[ap409]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/ApprovalPanel.tsx:409>
[p574]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:574>
[p660]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:660>
[p819]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:819>
[p839]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:839>
[p1009]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1009>
[p1021]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1021>
[p1023]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1023>
[p1046]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1046>
[p1078]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1078>
[p1106]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1106>
[p1161]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1161>
[p1202]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1202>
[p1217]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1217>
[p1237]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1237>
[p1259]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1259>
[p1348]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1348>
[p1350]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1350>
[p1376]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1376>
[p1383]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1383>
[p1402]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1402>
[p1419]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1419>
[p1453]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1453>
[p1481]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1481>
[p1507]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1507>
[p1521]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1521>
[p1532]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1532>
[p1546]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1546>
[p1581]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1581>
[p1642]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1642>
[p1667]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1667>
[p1705]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1705>
[p1788]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1788>
[p1886]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1886>
[p1905]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1905>
[p1910]: <C:/Users/Antonio Augusto/OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/Portal-commercial/src/modules/human-capital/components/Planning.tsx:1910>
