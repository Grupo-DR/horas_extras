# Contract Intelligence – Plano Técnico do Módulo

## 1. Objetivo

O módulo **Contract Intelligence** tem como objetivo transformar os dados operacionais já capturados no sistema (RDOs, histograma, serviços contratuais, preços) em **análises analíticas estruturadas** que respondam às seguintes perguntas de negócio:

- O projeto está dentro do custo contratado?
- A produtividade das equipes está dentro do esperado?
- Há ociosidade de recursos relevante?
- Qual é o avanço físico-financeiro real vs. planejado?
- Os dados estão prontos para serem consumidos por um modelo Power BI?

---

## 2. Arquitetura Sem Backend

Este módulo opera **100% no frontend**, sem nenhuma API própria ou servidor intermediário. A estratégia é:

```
┌─────────────────────────────────────────────────────────────────┐
│  Fontes de Dados                                                │
│  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ DynamoDB  │  │  Excel   │  │ AI (Gemini)│  │  Formulários │  │
│  │ (existente)│  │  Upload  │  │ Extração  │  │  Manuais     │  │
│  └─────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│        └─────────────┴─────────────┴────────────────┘          │
│                             │                                   │
│                    src/analytics/parsers                        │
│                    (parse + normalizar)                         │
│                             │                                   │
│                    src/analytics/engines                        │
│                    (calcular métricas)                          │
│                             │                                   │
│                    src/analytics/core                           │
│                    (orquestrar fluxo)                           │
│                             │                                   │
│              ┌──────────────┴──────────────┐                   │
│              │                             │                    │
│   src/analytics/exporters      src/components/ContractIntelligence│
│   (Excel / JSON / PowerBI)     (UI de visualização)            │
└─────────────────────────────────────────────────────────────────┘
```

### Persistência
- **DynamoDB** (já configurado): armazena projetos, RDOs, histograma.
- **localStorage**: cache temporário de resultados analíticos computados.
- **Sem banco relacional próprio**: toda agregação ocorre em memória no browser.

---

## 3. Estrutura de Pastas

```
src/
├── analytics/
│   ├── core/          # Orquestração e contexto analítico central
│   ├── parsers/       # Parsers de fontes externas (Excel, JSON, texto IA)
│   ├── engines/       # Motores de cálculo (produtividade, medição, ociosidade)
│   ├── exporters/     # Serialização para Excel e PowerBI JSON
│   └── types/
│       └── analyticsTypes.ts   # ← tipos desta sprint
├── components/
│   └── ContractIntelligence/   # Componentes React do módulo
└── ...
docs/
└── CONTRACT_INTELLIGENCE_PLAN.md   ← este arquivo
```

---

## 4. Principais Entradas

| Entrada | Origem | Formato |
|---|---|---|
| Dados de projeto | DynamoDB (`Project`) | JSON |
| Serviços contratuais | DynamoDB (`ServiceItem[]`) | JSON |
| RDOs com apontamentos | DynamoDB (`RDOData[]`) | JSON |
| Histograma de recursos | DynamoDB (`HistogramItem[]`) | JSON |
| Composições analíticas | Upload Excel | .xlsx |
| Dimensões de insumos | Upload Excel / IA | .xlsx / texto |
| Medições periódicas | Formulário manual | JSON |

---

## 5. Principais Saídas

| Saída | Destino | Formato |
|---|---|---|
| Dashboard analítico | Tela `ContractIntelligence` | React UI |
| Exportação Power BI | Download navegador | JSON (PowerBIModel) |
| Exportação Excel analítico | Download navegador | .xlsx multi-abas |
| Relatório de validação | Tela / download | JSON / PDF futuro |
| Fatos agregados (cache) | localStorage | JSON |

### Modelo de Tabela Estrela (Power BI)

```
                  ┌──────────────┐
                  │  dimItems    │ ← DimensionItem[]
                  └──────┬───────┘
                         │
┌────────────────┐  ┌────┴────────────────┐  ┌──────────────────┐
│factMeasurements│  │  factMonthlyResources│  │ factProductivity │
└────────────────┘  └─────────────────────┘  └──────────────────┘
┌────────────────┐  ┌─────────────────────┐
│ factOccurrences│  │    factIdleness      │
└────────────────┘  └─────────────────────┘
```

---

## 6. Tipos TypeScript Definidos (Sprint Atual)

Arquivo: `src/analytics/types/analyticsTypes.ts`

| Tipo | Propósito |
|---|---|
| `AnalyticsProjectContext` | Contexto enriquecido do projeto para análises |
| `DimensionItem` | Item de dimensão (insumo/serviço) importado |
| `DimensionImportResult` | Resultado de importação de dimensões |
| `CompositionItem` | Insumo dentro de uma composição analítica |
| `CompositionImportResult` | Resultado de importação de composições |
| `ContractAnalyticsResult` | Resultado consolidado da análise contratual |
| `ValidationIssue` | Problema de validação (erro, aviso, info) |
| `MonthlyResourceFact` | Fato de recurso mensal (histograma real vs. planejado) |
| `MeasurementFact` | Fato de medição periódica de serviço |
| `ProductivityFact` | Fato de produtividade (produção / horas) |
| `OccurrenceFact` | Fato de ocorrência agregada por período |
| `IdlenessFact` | Fato de ociosidade de recurso |
| `PowerBIModel` | Modelo completo de exportação para Power BI |

---

## 7. Compatibilidade com Entidades Existentes

| Tipo Analytics | Referencia Entidade Existente | Campo(s) |
|---|---|---|
| `AnalyticsProjectContext` | `Project` | `id`, `name`, `contractValue`, `budgetValue`, `status`, `startDate`, `endDate` |
| `DimensionItem` | `ServiceItem` | `code`, `unit` |
| `CompositionItem` | `ServiceItem` | `code`, `unit` |
| `MonthlyResourceFact` | `HistogramItem` | `normalizedName`, `monthlyPlan`, `category` |
| `MeasurementFact` | `ServiceItem` | `code`, `unit`, `value` |
| `ProductivityFact` | `Team`, `RDOData` | `id`, `workforce`, `activities` |
| `OccurrenceFact` | `RDOData.occurrences` | `type`, `impact`, `impactTimeMinutes` |
| `IdlenessFact` | `RDOData`, `HistogramItem` | `workforce`, `equipment` |

---

## 8. Limitações Conhecidas

| Limitação | Impacto | Mitigação Planejada |
|---|---|---|
| Sem backend próprio | Toda agregação em memória; datasets grandes podem travar o browser | Paginação + Web Workers (sprint futura) |
| DynamoDB via SDK no browser | Expõe credenciais AWS (já presente no projeto) | Usar variáveis de ambiente + Cognito Identity Pool (longo prazo) |
| Sem banco relacional | Consultas complexas (JOIN, GROUP BY) são feitas em JS | Usar `Array.reduce` + estruturas de índice em memória |
| Sem histórico de versões de análise | Resultados não são versionados | Salvar snapshots em DynamoDB (sprint futura) |
| Excel upload limitado ao navegador | Arquivos > 50 MB podem travar | Alertar usuário sobre tamanho máximo recomendado |
| Sem autenticação de usuário | Qualquer um com acesso à app pode exportar dados | Autenticação via Cognito (roadmap) |

---

## 9. Roadmap de Sprints

```
Sprint atual  → Estrutura técnica + tipos (esta sprint)
Sprint 2      → Parser de Excel (dimensões e composições)
Sprint 3      → Engine de produtividade (dados dos RDOs)
Sprint 4      → Engine de medição (avanço físico-financeiro)
Sprint 5      → Exportador Power BI (PowerBIModel → JSON/xlsx)
Sprint 6      → Dashboard ContractIntelligence (UI React)
Sprint 7      → Engine de ociosidade e ocorrências
Sprint 8      → Validação e relatório de conformidade contratual
```

---

## 10. Decisões de Design

- **Sem importações circulares**: `analyticsTypes.ts` não importa de `types.ts`; a compatibilidade é garantida por forma (structural typing do TypeScript).
- **Sem dependências novas**: todos os tipos são plain interfaces TS; nenhum pacote adicional é necessário.
- **Sem alteração de arquivos existentes**: a estrutura `src/analytics/` é aditiva.
- **Nomenclatura em inglês**: os tipos usam inglês para consistência com o restante do código; comentários em português para facilitar revisão pelo time.

---

*Gerado em: 2026-05-28 | Versão do plano: 1.0.0*
