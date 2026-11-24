# Lakehouse financeiro (BigQuery)

Substitui os dados embutidos nos HTMLs (foto de 18/11/2026) por uma base atualizada a cada carga,
que alimenta as páginas financeiras do portal e o chat com IA. Decisões de 24/11/2026:
**BigQuery** no projeto do portal, **razão contábil por upload do Excel no portal**, acesso pela
**área BI com recorte por regional**.

## 1. Visão geral

```
Portal (upload .xlsx)          Cloud Storage            Cloud Function             BigQuery (southamerica-east1)
Controladoria ──────────────▶  fin-cargas/<carga>  ──▶  finCarregarArquivo   ──▶  fin_bronze  (dado como chega)
                                                         • valida colunas            │
                                                         • grava bronze              ▼ SQL (regras da seção 4)
                                                         • roda prata/ouro         fin_prata  (regras aplicadas)
                                                         • registra a carga          │
                                                                                     ▼
Portal (páginas, chat) ◀──── finConsulta / finChat ◀──────────────────────────── fin_ouro   (tabelas do relatório)
                              • permissão por área BI + regional
```

- Só as Cloud Functions acessam o BigQuery (conta de serviço do projeto). O navegador nunca consulta a base direto.
- Região **southamerica-east1** (São Paulo): dados financeiros ficam no Brasil.
- Cada carga fica registrada no Firestore (`fin_cargas`): arquivo, quem enviou, período, linhas, avisos.

## 2. Fontes e frequência

| Fonte | Arquivo (hoje) | Chega por | Frequência |
|---|---|---|---|
| Razão contábil TOTVS | `Razão Contábil.xlsx` (sheet1) | upload no portal | a cada fechamento / sob demanda |
| Valores gerenciais | `Fato Medições Gerenciais.xlsx` (Fatos Fora Totvs) | upload | mensal |
| Medições de obra | `Tabelas Medições.xlsm` (Tbl_Medcao) | upload | mensal |
| Budget | `Fato Budget AAAA.xlsx` | upload | anual / revisões |
| Forecast | `Fato Forecast AAAA.xlsx` | upload | revisões |
| Dimensões | `Planilha Dimensão.xlsx` (Centro de Custo, Contas) | upload | quando mudar cadastro |
| Previsão semanal | `Tabelas Medições.xlsm` (Tbl_Semanal) | upload agora; **lançamento no portal** na Frente 2 | semanal |

**Regra de substituição (idempotência):** cada carga substitui só o que o arquivo cobre.
- Razão e valores gerenciais: substitui as **competências (meses) presentes no arquivo**, por filial.
- Medições: substitui os meses presentes.
- Budget / Forecast: substitui o **ano** do arquivo.
- Dimensões: substitui a tabela inteira.
- Previsão semanal: substitui as etapas presentes.

Reenviar o mesmo arquivo dá o mesmo resultado; enviar um mês corrigido troca só aquele mês.

## 3. Camada bronze (`fin_bronze`) — dado como chega

Toda tabela bronze tem as colunas de controle `_carga_id`, `_arquivo`, `_aba`, `_linha`, `_carregado_em`, `_carregado_por`.

| Tabela | Colunas de origem |
|---|---|
| `razao_totvs` | CUSTO, DESCCC, SALDO_ANTERIOR, CONTA, DESCCON, DATA, LOTE_SUB_DOC_LINHA, FL (filial), HISTORICO, XPARTIDA, ITEM_CONTA, COD_CL_VAL, DEBITO, CREDITO, SALDO_ATUAL *(a confirmar com um arquivo real)* |
| `valores_gerenciais` | as mesmas do razão + PADRAO, CODIGO, EMPRESA_PESSOA, DESCRICAO, PEDIDO, OBSERVACAO, ATIVO |
| `medicoes_obra` | ANO, MES, CUSTO, AREA, MEDICAO, GRUPO, CONTA, CC_TOTVS |
| `previsao_semanal` | ANO, MES, CUSTO, AREA, PROJECAO, GRUPO, ETAPA, CONTA, MES_REFERENCIA, REF_ETAPA |
| `budget`, `forecast` | MES, CC_DR, GRUPO, CONTA, DESCRICAO, TIPO, VALOR, CLASSE, ANO |
| `dim_centro_custo` | CC_TOTVS, IDENTIFICACAO, CC_DR, TIPO_CC, STATUS, REGIONAL |
| `dim_conta` | CONTA, DESCRICAO, GRUPO, TIPO_CONTA, TIPO_CONTA_2 |

A validação do upload recusa o arquivo se faltar coluna obrigatória e avisa (sem recusar) linhas sem data,
sem conta ou com valor não numérico, mostrando a linha da planilha.

## 4. Camada prata (`fin_prata`) — regras de negócio

Transcrição em SQL das consultas `slv_*` do Power Query (DOCUMENTACAO.md, seções 5 e 6):

| Visão | Regra |
|---|---|
| `dim_centro_custo` | sem duplicidade de CC Totvs |
| `real_rental` | razão com FL = 201, CUSTO ≠ 999; Valor = (Débito − Crédito) × −1 |
| `real_construtora` | razão com FL = 101, CUSTO ≠ 999; Valor = (Débito − Crédito) × −1; CC `3.0.1.503` → `3.0.1.502` |
| `valores_gerenciais` | Valor = (Débito − Crédito) × −1 (nulos = 0); exige CONTA |
| `real_custos_despesas` | Rental + Construtora + Gerenciais, sem contas de Tipo Faturamento e Impostos |
| `medicao_mensal` | medições tipadas |
| `budget_mensal`, `forecast_mensal` | CC DR `3015.03` (Classe Construtora) → `3015.02`; CC DR → CC Totvs pela dimensão |
| `aliquotas_impostos` | alíquota mensal por CC = −Impostos ÷ Faturamento do razão (Construtora → Obras; Rental → Rental) |
| `impostos_sobre_medicao` | PIS/COFINS/ISS sobre medições (regra 6.2, inclusive a exceção do CC 3.0.4.301 e os padrões 8,113% / 3,65%) |
| `previsao_etapa` | Mês = início do mês; sem linhas sem Projeção/Etapa; CC DR → CC Totvs |
| `aud_contas_nao_mapeadas`, `aud_cc_nao_mapeados` | auditoria: o que chegou sem cadastro na dimensão |

Em todas: lançamentos com histórico contendo **"APURA"** ou **"ZERAMENTO"** são excluídos.

## 5. Camada ouro (`fin_ouro`) — tabelas que o portal lê

| Tabela | Granularidade | Composição |
|---|---|---|
| `fato_resultado_mensal` | relatório × mês × conta × CC × cenário × origem | seção 5.3 da documentação; coluna `relatorio` (G, F, S) porque Gerencial/Semanal usam medições e Financeiro usa o razão |
| `fato_real_detalhe` | relatório × data × conta × CC × histórico | seção 5.4 |
| `fato_previsao` | mês × etapa × conta × CC | seção 5.5 (Semanal) |
| `dim_centro_custo`, `dim_conta`, `dim_data` | — | dimensões finais |

O formato de saída para o portal é o mesmo que o motor recuperado (`legacy/engine.js`) já lê
(`cc`, `conta`, `fato`, `det`, `hist`, `prev`), gerado pela função `finConsulta` **só com os CCs que o
usuário pode ver**. Assim o motor validado é reaproveitado quase sem mudança.

## 6. Acesso

| Quem | Vê |
|---|---|
| Super admin, diretoria (área BI "Financeiro", escopo Todas) | tudo |
| Gestor de regional (área BI "Financeiro", escopo Regional X) | só CCs da regional X (Regional da `dim_centro_custo`) |
| Controladoria (papel de carga) | envia arquivos e vê o histórico de cargas e a auditoria |

O recorte é aplicado no servidor (`finConsulta`, `finChat`), nunca só na tela.

## 7. Validação

1. Carregar as mesmas fontes de 18/11/2026 e comparar `fato_resultado_mensal` e `fato_real_detalhe` com o
   retrato `Projeto Financeiro/_pipeline/snapshot-2026-11-18/*.json` (soma por mês × conta × CC × cenário):
   diferença deve ser zero.
2. Rodar o motor (`engine.js`) sobre os dados do lakehouse e comparar o HTML de cada visual com o dos
   HTMLs originais, nos mesmos cenários da seção 11 da documentação.

## 8. Custos estimados

Volume atual: ~250 mil linhas mensais + ~160 mil lançamentos detalhados por ano (dezenas de MB).
Armazenamento e consultas nesse porte ficam dentro da faixa gratuita do BigQuery ou em poucos reais por mês.
O custo relevante será o do chat (Gemini, por pergunta).

## 9. Pendências para começar

- [ ] Um arquivo real do **Razão Contábil.xlsx** (de preferência o usado em 18/11) para confirmar colunas e validar.
- [ ] Autorização para criar no projeto `kanbancomercial-af561`: API do BigQuery, datasets `fin_bronze`/`fin_prata`/`fin_ouro`, bucket `fin-cargas` e as Cloud Functions de carga.
- [ ] Definir quem envia os arquivos (papel "carga financeira" no IAM).
