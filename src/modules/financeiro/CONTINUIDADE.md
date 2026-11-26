# Lakehouse financeiro — estado atual e como continuar

Retrato em **26/11/2026**, versão do portal **1.8.0** (commit `ea187e5` na `main`).
O projeto foi pausado para outras tarefas; este documento basta para retomar sem reler a conversa.

- Desenho completo (camadas, regras de negócio, acesso, validação): [`LAKEHOUSE.md`](LAKEHOUSE.md).
- Código recuperado dos relatórios Power BI → HTML: [`legacy/README.md`](legacy/README.md).

---

## 1. Objetivo do projeto

Três frentes, pedidas em 24/11/2026:

1. **Relatórios como páginas do portal:** Gerencial, Financeiro/Contábil e Semanal, que hoje são HTMLs com os
   dados congelados em 18/11/2026 e sem controle de acesso.
2. **Medições de obra e previsões semanais dos engenheiros digitadas no portal**, sem Excel.
3. **Razão contábil num lakehouse + chat com IA** para os usuários consultarem os números.

## 2. Situação em uma tabela

| Item | Situação |
|---|---|
| Lakehouse no BigQuery, camada bronze | ✅ no ar |
| Carga do razão do Protheus (Excel cru) | ✅ no ar (1.7.0/1.7.1). **Carregado em produção em 24/11:** 79.891 lançamentos, 01–11/2026 |
| Carga de Budget, Forecast, Valores gerenciais e Dimensões (Excel) | ✅ no ar (1.8.0). **Nenhuma carga real feita ainda em produção** |
| Versões de Budget/Forecast + versão vigente | ✅ no ar (1.8.0) |
| Telas de digitação: medições de obra e previsões semanais | ⏳ próximo passo |
| Camadas prata e ouro (SQL) | ⏳ não iniciado |
| Relatórios como páginas do portal (portar `legacy/engine.js`) | ⏳ não iniciado |
| Chat com IA sobre a camada ouro | ⏳ não iniciado |
| Acesso por área BI + regional | ⏳ hoje só o super admin usa a tela de cargas |

## 3. Decisões tomadas (não rediscutir sem motivo novo)

| Data | Decisão |
|---|---|
| 24/11 | BigQuery no projeto `kanbancomercial-af561`, região `southamerica-east1` (São Paulo). |
| 24/11 | Razão chega por **upload do Excel no portal**, no formato **cru** exportado do Protheus. A classificação do histórico que o `protheus_parserV5.py` fazia roda no sistema. |
| 24/11 | Começar pelo lakehouse; depois relatórios e chat. |
| 24/11 | Acesso futuro: permissão da área BI + recorte por regional, aplicado no servidor. |
| 24/11 | Por enquanto **só o administrador (super admin) envia cargas**. Papel próprio de Controladoria fica para depois. |
| 25/11 | Medições de obra e previsões dos engenheiros: **digitadas em tela**. Budget, Forecast, Dimensões e Valores gerenciais: **por Excel**. |
| 25/11 | Budget é identificado por **ano + nome da versão**; reenviar o mesmo nome substitui aquela versão. |
| 25/11 | Forecast é identificado por **ano + tipo + revisão**. Tipos aceitos: **só 3+9, 6+6 e 9+3**. A revisão é numerada automaticamente. |
| 25/11 | A **versão vigente** (uma por tipo e ano) é escolhida no envio e pode ser trocada depois na lista de versões. |
| 25/11 | Budget/Forecast em que o nome do mês ("Mês") não bate com a data (coluna "Ano") é **recusado**. A tela mostra o total de linhas divergentes e 20 exemplos com o número da linha. |

## 4. O que está construído

### 4.1 Arquivos

| Onde | O que faz |
|---|---|
| `src/modules/financeiro/lib/planilha.ts` | Utilitários comuns: `norm`, `texto`, `dataExcel` (série do Excel ou dd/mm/aaaa), `numero` (aceita formato BR), `localizarColunas` (acha o cabeçalho nas 15 primeiras linhas pelo nome) |
| `lib/historicoClassifier.ts` | Porte fiel do `protheus_parserV5.py`: Padrão, Código, Empresa/Pessoa, Descrição, Pedido, Observação, Ativo |
| `lib/razaoProtheus.ts` | Lê o razão: junta as linhas de continuação (Débito vazio), aplica a máscara de CC/conta, classifica |
| `lib/budgetForecast.ts` | Lê Budget/Forecast (mesmo layout); `DivergenciaMesError`; `TIPOS_FORECAST`; um arquivo = um ano |
| `lib/dimensoes.ts` | Lê as abas de Centros de Custo e Contas (acha pelo cabeçalho); chave repetida fica com a 1ª ocorrência, com aviso |
| `lib/valoresGerenciais.ts` | Lê "Fatos Fora Totvs": sem linhas de continuação; débito/crédito vazios = 0 |
| `lib/razaoProtheus.test.ts`, `lib/cargasExcel.test.ts` | 21 testes unitários (`npx vitest run src/modules/financeiro`) |
| `pages/CargasFinanceirasPage.tsx` | Tela `/financeiro/cargas` (só super admin; atalho "Cargas Financeiras" na tela inicial): uma aba por fonte, prévia antes do envio, formulário de versão, recusa com exemplos, lista de versões com "Tornar vigente", histórico das cargas |
| `functions/src/financeiro.ts` | `finAutorizarCarga` (grava a custom claim `finCarga` para super admin) e `finCarregarRazao`. Exporta `bigquery`, `LOCATION`, `DATASET_BRONZE`, `assertSuperAdmin`, `garantirTabela` |
| `functions/src/financeiroPlanilhas.ts` | `finCarregarPlanilha` (budget, forecast, dimensoes, gerenciais) e `finDefinirVigente` |
| `functions/scripts/sync-shared.js` | Antes do build, copia os arquivos de `lib/` para `functions/src/shared/financeiro/` (pasta gerada, no `.gitignore`). **Arquivo novo em `lib/` usado pelas Functions precisa entrar na lista daqui** |
| `storage.rules` | `fin-cargas/{tipo}/{carga}/{arquivo}`: só cria, com claim `finCarga`, Excel de até 100 MB; leitura e exclusão bloqueadas |
| `firestore.rules` | `fin_cargas` e `fin_versoes`: leitura só super admin; escrita só pelas Functions |

**Os leitores ficam no portal e são compartilhados com as Functions.** O portal confere o arquivo antes do
envio; a função lê de novo com o mesmo código. Assim a prévia e o que é gravado nunca divergem.

### 4.2 Fluxo de uma carga

1. A tela lê o Excel no navegador e mostra a prévia (ou a recusa).
2. Chama `finAutorizarCarga` e renova o token, para a regra do Storage enxergar a claim `finCarga`.
3. Envia o arquivo para `fin-cargas/<tipo>/<cargaId>/<arquivo>` no Storage padrão.
4. Chama `finCarregarRazao` ou `finCarregarPlanilha`. A função:
   1. confere o super admin;
   2. baixa o arquivo e lê;
   3. grava um NDJSON temporário;
   4. faz um load job para uma tabela temporária;
   5. troca os dados numa transação (`DELETE` + `INSERT`) e apaga a tabela temporária;
   6. registra a carga em `fin_cargas/<cargaId>` com status `processando`, `concluida` ou `erro` e o resumo.

### 4.3 Tabelas no BigQuery (dataset `fin_bronze`)

Todas têm as colunas de controle `carga_id`, `arquivo`, `carregado_em` e `carregado_por`. Os nomes não
levam o `_` inicial previsto no LAKEHOUSE.md.

| Tabela | Substituição a cada carga | Partição / cluster |
|---|---|---|
| `razao_totvs` | competências × filiais do arquivo | mês de `data` / filial, centro_custo, conta |
| `budget`, `forecast` | `versao_id` (a versão enviada) | mês de `data` / versao_id, cc_dr, conta |
| `plano_versoes` | tabela inteira (espelho do Firestore `fin_versoes`) | — |
| `dim_centro_custo`, `dim_conta` | tabela inteira | — |
| `valores_gerenciais` | competências do arquivo | mês de `data` / centro_custo, conta |

Cada tabela é criada sozinha na primeira carga. Até agora só existe `razao_totvs`; as outras aparecem quando
a primeira carga de cada fonte for feita.

**Diferença em relação ao desenho original:** o LAKEHOUSE.md previa substituir Budget/Forecast pelo ano.
Com as versões, cada versão fica guardada lado a lado (`versao_id`) e os relatórios devem filtrar a versão
vigente com um join em `plano_versoes` (`vigente = TRUE`).

### 4.4 Versões de Budget e Forecast

- O catálogo de origem é o Firestore `fin_versoes/{versaoId}`, espelhado em `fin_bronze.plano_versoes` a cada mudança.
- Formato do `versaoId`:
  - Budget: `budget-2026-original` (ano mais o nome em minúsculas, sem acentos).
  - Forecast: `forecast-2026-6mais6-r2`.
- A primeira versão de um tipo e ano entra sempre como vigente. Marcar outra como vigente desmarca as demais
  do mesmo tipo e ano.
- Ao reenviar um Budget com o mesmo nome, a versão continua vigente se já era.

## 5. Validações feitas com os arquivos reais

Os arquivos ficam em `projeto_financeiro/` na raiz do repo, que está no `.gitignore`. Nunca commitar dado financeiro.

**Razão (`razão/Razão Contábil.xlsx`, 23/11):**
- A classificação deu resultado idêntico ao do Python nos 79.891 lançamentos.
- Com as regras da prata, jan–out/2026 bateu com o relatório Financeiro de 18/11 em 12.645 de 12.647 chaves.
  A diferença é uma NF duplicada nos dados de 18/11.

**Budget e Forecast** (validação de 25/11):

| Arquivo | Resultado |
|---|---|
| Budget 2025 | aceito: 91.857 linhas; 1 linha ignorada (data digitada "01/05/01/05/2025", linha 78474) |
| Budget 2026 | aceito: 19.642 linhas |
| Forecast 2025 | aceito: 91.858 linhas |
| Forecast 2026 | **recusado**: 1.576 linhas com mês divergente (ex.: linha 19844, "Novembro" × 01/09/2026). **O usuário precisa corrigir a planilha antes de carregar.** |

Em Budget/Forecast, o mês correto é a data da coluna "Ano", e não o nome em "Mês": é o que o Power BI usa.
Os 12 meses conferem com o retrato de 18/11.

**Demais fontes:**
- Dimensões (`Dimensão/Planilha Dimensão.xlsx`): 89 centros de custo e 497 contas, sem avisos.
- Valores gerenciais (`OneDrive_2026-11-18/Medições Gerenciais/Fato Medições Gerenciais.xlsx`, aba "Fatos Fora
  Totvs"): 1.424 lançamentos, de 08/2025 a 10/2026.

**Oráculo para validar prata/ouro:** `Projeto Financeiro/_pipeline/snapshot-2026-11-18/{gerencial,financeiro,semanal}.json`,
na pasta da empresa no OneDrive, fora do repo.

## 6. Primeira coisa a fazer ao retomar

1. Confirmar com o usuário se ele já fez as primeiras cargas pela tela, nesta ordem:
   1. Dimensões;
   2. Valores gerenciais;
   3. Budget 2025 e 2026, com nome da versão;
   4. Forecast 2025, com o tipo.

   Para conferir, ver o histórico em `fin_cargas`.
2. Se algum erro aparecer, ver os logs da função `finCarregarPlanilha` (Cloud Functions, us-central1).
3. Forecast 2026: só depois de o usuário corrigir as 1.576 linhas.

## 7. Próximos passos (em ordem)

1. **Telas de digitação** (decisão de 25/11: sem Excel):
   - **Medições de obra:** hoje vêm de `Tabelas Medições.xlsm`, aba `Tbl_Medcao` (ANO, MES, CUSTO, AREA,
     MEDICAO, GRUPO, CONTA, CC_TOTVS).
   - **Previsões semanais dos engenheiros:** hoje vêm da aba `Tbl_Semanal` (ANO, MES, CUSTO, AREA, PROJECAO,
     GRUPO, ETAPA, CONTA, MES_REFERENCIA, REF_ETAPA).
   - A definir com o usuário: quem digita (engenheiro por obra? com recorte pelos CCs dele, como no Capital
     Humano), se há aprovação, onde gravar (Firestore com espelho no BigQuery, como `fin_versoes`) e o que é
     uma "etapa" da previsão semanal.
   - O arquivo `.xlsm` com essas abas ainda não foi analisado.
2. **Camada prata (`fin_prata`):** transcrever as regras da seção 4 do LAKEHOUSE.md em views SQL. Lembrar:
   - excluir históricos com "APURA"/"ZERAMENTO";
   - Valor = (Débito − Crédito) × −1;
   - CC `3.0.1.503` → `3.0.1.502`;
   - CC DR `3015.03` → `3015.02`;
   - impostos sobre medição;
   - filtrar a versão vigente de Budget/Forecast.
3. **Camada ouro (`fin_ouro`)** e validação contra o retrato de 18/11 (diferença zero esperada).
4. **Relatórios como páginas:** portar `legacy/engine.js` e `app.js`. Uma função `finConsulta` devolve os
   dados no formato que o motor já lê (`cc`, `conta`, `fato`, `det`, `hist`, `prev`), **só com os CCs que o
   usuário pode ver**.
5. **Chat com IA** (`finChat`): Gemini (mesma chave paga do RDO, via gateway) consultando a ouro com o
   recorte por regional.
6. **Acesso:** área BI "Financeiro" + regional; papel de carga para a Controladoria.

## 8. Cuidados e armadilhas conhecidas

- **Dados financeiros nunca vão para o git.** `projeto_financeiro/` está no `.gitignore`. Para testar com
  arquivos reais, criar um teste temporário e apagá-lo antes do commit.
- **Não ler credenciais locais** (arquivo do Firebase CLI etc.); o acesso foi negado e não deve ser tentado.
  O BigQuery é acessado só pelas Cloud Functions, com a conta de serviço do projeto.
- **Regra do Storage não pode consultar o Firestore** (`firestore.get`): exige IAM entre serviços e deu 403.
  Por isso existe a custom claim `finCarga`.
- Enquanto depurava esse 403, o usuário deu um papel amplo ao agente de serviço do Firebase Storage no IAM.
  **Sugerir remover**, porque não é mais necessário.
- `functions/lib/` (saída do build) é versionada: commitar junto com cada mudança nas Functions. Diferenças
  só de fim de linha (LF/CRLF) aparecem depois de cada build e podem ser ignoradas.
- `npm test` tem 11 falhas antigas em `ssma/domain/calculateSSMAResults.test.ts` e
  `human-capital/domain/absenteeism.test.ts`, em código intocado desde julho e sem relação com o financeiro.
  A checagem de CHANGELOG passa.
- O TypeScript das Functions é mais antigo: genéricos que dependem de inferência pelo 2º argumento
  quebram lá (foi o caso de `localizarColunas`). Rodar `cd functions && npm run build` após mexer em `lib/`.
- Uma planilha de Budget/Forecast tem só um ano: a função recusa arquivo com mais de um ano.

## 9. Publicar uma mudança (lembrete)

1. Seguir o versionamento obrigatório (`npm run release:minor|patch` + entrada no `CHANGELOG.md`), depois
   juntar na `main` e enviar para o remoto `horas_extras`. O push publica o portal na Vercel.
2. Publicar as Functions:
   `npx firebase deploy --only functions:<nome> --project kanbancomercial-af561`
3. Publicar as regras do Firestore, **sempre a partir da `main` atualizada**:
   `npx firebase deploy --only firestore:rules --project kanbancomercial-af561`
4. Publicar as regras do Storage quando mudarem:
   `npx firebase deploy --only storage --project kanbancomercial-af561`

## 10. Histórico de versões do projeto

| Versão | Data | Entrega |
|---|---|---|
| — | 24/11 | Código do motor recuperado dos HTMLs (`legacy/`) e desenho do lakehouse |
| 1.7.0 | 24/11 | Carga do razão do Protheus na bronze; tela Cargas Financeiras |
| 1.7.1 | 25/11 | Envio liberado por custom claim (correção do 403 no Storage) |
| 1.8.0 | 25/11 | Budget, Forecast (3+9, 6+6, 9+3), Valores gerenciais e Dimensões por Excel; versões e vigente |
