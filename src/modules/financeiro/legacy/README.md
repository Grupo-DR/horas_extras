# Relatórios financeiros — código recuperado dos HTMLs

Código extraído em 24/11/2026 dos três HTMLs gerados a partir do Power BI
(`Projeto Financeiro/HTML/Dashboard - Gerencial|Financeiro|Semanal.html`, conversão de 18/11/2026).
O pipeline original (`build.py`, consultas DAX, validação) ficou numa pasta temporária e se perdeu;
este é o único código-fonte do motor que sobrou.

| Arquivo | Conteúdo |
|---|---|
| `engine.js` | motor de cálculo: transcrição das medidas DAX (idêntico nos três relatórios) |
| `app.js` | interface: páginas, filtros, visuais em Shadow DOM (idêntico nos três) |
| `config/gerencial.js`, `financeiro.js`, `semanal.js` | `REPORT_CFG` (páginas, filtros, regras do relatório) e `REPORT_CSS` (CSS original das medidas) |
| `template.html` | casca da página, sem dados, sem scripts e sem as imagens |

**Não editar.** Serve de referência para portar o motor ao portal e de gabarito: os HTMLs foram validados
contra o Power BI (21 de 21 visuais idênticos), então o portal precisa produzir o mesmo resultado.

**Dados não ficam no repositório.** O retrato dos dados de 18/11/2026 (mesmo formato que o motor lê:
`cc`, `conta`, `fato`, `det`, `hist`, `prev`) foi descompactado em
`Projeto Financeiro/_pipeline/snapshot-2026-11-18/` (pasta da empresa no OneDrive), para validar o lakehouse.

Documentação completa da conversão: `Projeto Financeiro/HTML/DOCUMENTACAO.md`.
Desenho do lakehouse que vai substituir os dados embutidos: [`../LAKEHOUSE.md`](../LAKEHOUSE.md).
