# Relatório da Camada de DTOs e Mapeadores (Sprint 04)

Este documento detalha o processo de introdução de **Data Transfer Objects (DTOs)** e **Mappers** nas fronteiras do sistema Gestão de Obras. A nova camada foi desenhada para blindar os modelos de domínio internos contra variações de formatos externos de entrada (Ex: planilhas Excel, exportações CSV, integrações de APIs corporativas do Portal DR Nexus).

---

## 1. DTOs Criados (`src/dtos/`)

Foram estruturadas 4 interfaces de DTO flexíveis para acomodar variações de nomenclatura em português (comumente usadas em planilhas) e propriedades corporativas em inglês (comum nas integrações do Nexus):

- **[ProjectDTO.ts](file:///c:/Users/Antonio%20Augusto/OneDrive%20-%20DR%20Construtora%20e%20Servi%C3%A7os%20Ltda/%C3%81rea%20de%20Trabalho/Projetos%20e%20An%C3%A1lises/Portal%20Gerenciador/module_Obras/src/dtos/ProjectDTO.ts):** Mapeia obras (`CC`, `REGIONAL`, `CLIENTE`, `VALOR_CONTRATO`, etc.) e itens de serviço (`ServiceItemDTO` / `codigo`, `escopo`, `unidade`, `valor`).
- **[TeamDTO.ts](file:///c:/Users/Antonio%20Augusto/OneDrive%20-%20DR%20Construtora%20e%20Servi%C3%A7os%20Ltda/%C3%81rea%20de%20Trabalho/Projetos%20e%20An%C3%A1lises/Portal%20Gerenciador/module_Obras/src/dtos/TeamDTO.ts):** Mapeia equipes, liderança, contagem de integrantes e alocações de orçamento (`PERCENTUAL_ORCADO`, `PERCENTUAL_PROJETADO`).
- **[RDODTO.ts](file:///c:/Users/Antonio%20Augusto/OneDrive%20-%20DR%20Construtora%20e%20Servi%C3%A7os%20Ltda/%C3%81rea%20de%20Trabalho/Projetos%20e%20An%C3%A1lises/Portal%20Gerenciador/module_Obras/src/dtos/RDODTO.ts):** Mapeia os dados do Diário de Obra (RDO) e suas listas de recursos (`mao_de_obra`, `equipamentos`, `atividades`, `ocorrencias`).
- **[ContractDTO.ts](file:///c:/Users/Antonio%20Augusto/OneDrive%20-%20DR%20Construtora%20e%20Servi%C3%A7os%20Ltda/%C3%81rea%20de%20Trabalho/Projetos%20e%20An%C3%A1lises/Portal%20Gerenciador/module_Obras/src/dtos/ContractDTO.ts):** Mapeia dados financeiros, medições mensais (`MonthlyBudgetEntryDTO` / `orcamento`, `provisao`, `medido`) e aditivos (`ContractAddendumDTO` / `dias_adicionados`, `valor_adicionado`).

---

## 2. Utilidades de Normalização e Mappers (`src/mappers/`)

Para garantir a coerência dos dados e prevenir erros de persistência ou cálculos no frontend, criamos funções utilitárias em **[mapperUtils.ts](file:///c:/Users/Antonio%20Augusto/OneDrive%20-%20DR%20Construtora%20e%20Servi%C3%A7os%20Ltda/%C3%81rea%20de%20Trabalho/Projetos%20e%20An%C3%A1lises/Portal%20Gerenciador/module_Obras/src/mappers/mapperUtils.ts)**:

- **Datas (`normalizeDate`):** Converte datas representadas como números ordinais do Excel (serial number), strings "DD/MM/AAAA", ISO strings ou instâncias nativas de `Date` no padrão do domínio: `"YYYY-MM-DD"`.
- **Valores Monetários (`normalizeCurrency`):** Converte formatos textuais monetários (Ex: `"R$ 1.500,50"`, `"1.500,00"`) ou valores inteiros/decimais diretamente em números do tipo `number` aceitos pelo JS/TS.
- **Percentuais (`normalizePercentage`):** Suporta representação em decimal (`0.45` -> `45`) ou percentual inteiro (`"45%"` ou `"45"` -> `45`).
- **Identificadores (`normalizeIdentifier`):** Sanitiza strings e previne falhas na geração de chaves primárias ao criar identificadores únicos (UUID v4) automáticos caso a fonte externa omita o ID.

### Mapeadores Concretos
- **[ProjectMapper.ts](file:///c:/Users/Antonio%20Augusto/OneDrive%20-%20DR%20Construtora%20e%20Servi%C3%A7os%20Ltda/%C3%81rea%20de%20Trabalho/Projetos%20e%20An%C3%A1lises/Portal%20Gerenciador/module_Obras/src/mappers/ProjectMapper.ts):** Traduz `ProjectDTO` ➔ `Project` (com conversão em lote da planilha de serviços) e vice-versa.
- **[TeamMapper.ts](file:///c:/Users/Antonio%20Augusto/OneDrive%20-%20DR%20Construtora%20e%20Servi%C3%A7os%20Ltda/%C3%81rea%20de%20Trabalho/Projetos%20e%20An%C3%A1lises/Portal%20Gerenciador/module_Obras/src/mappers/TeamMapper.ts):** Traduz dados de equipes cadastrais.
- **[RDOMapper.ts](file:///c:/Users/Antonio%20Augusto/OneDrive%20-%20DR%20Construtora%20e%20Servi%C3%A7os%20Ltda/%C3%81rea%20de%20Trabalho/Projetos%20e%20An%C3%A1lises/Portal%20Gerenciador/module_Obras/src/mappers/RDOMapper.ts):** Processa e formata detalhadamente listas de equipamentos, atividades, equipes e ocorrências.
- **[ContractMapper.ts](file:///c:/Users/Antonio%20Augusto/OneDrive%20-%20DR%20Construtora%20e%20Servi%C3%A7os%20Ltda/%C3%81rea%20de%20Trabalho/Projetos%20e%20An%C3%A1lises/Portal%20Gerenciador/module_Obras/src/mappers/ContractMapper.ts):** Converte a estrutura de contratos, aditivos de valor/tempo e medições periódicas.

---

## 3. Casos de Uso e Integrações Suportadas

A introdução desta camada viabiliza integrações limpas sem poluir as regras internas do sistema:

1. **Uploads de Arquivos (Excel e CSV):**
   - Em vez de realizar o parsing ad-hoc nos componentes (como o leitor de serviços na store), a planilha convertida em JSON pode ser passada diretamente ao `ProjectMapper.toDomain(jsonRow)`, que higieniza e normaliza automaticamente chaves e valores.
2. **Sincronização com o Portal DR Nexus:**
   - O portal corporativo DR Nexus pode enviar payloads REST com chaves diferentes. Os mappers convertem as respostas do endpoint diretamente em modelos de domínio em tempo de execução.
3. **APIs Externas e Webhooks:**
   - Webhooks ou integrações de terceiros podem enviar atualizações de equipes ou diários de obras em formato customizado. O Mapper age como uma "zona de amortecimento" (Anticorruption Layer / ACL) protegendo o domínio principal.

---

## 4. Validação e Compilação

- **Análise Estática (`npm run lint`):** O validador do TypeScript compilou todos os DTOs e Mappers sem registrar nenhum erro.
- **Build de Produção (`npm run build`):** O bundle do Vite empacotou a aplicação inteira com sucesso e manteve-se livre de falhas de compilação ou regressões funcionais.
