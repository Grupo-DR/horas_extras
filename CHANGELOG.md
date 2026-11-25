# Changelog

Todas as mudanças relevantes do DR Nexus, da mais nova para a mais antiga.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versões em [SemVer](https://semver.org/lang/pt-BR/). Regra completa: README, seção "Versionamento".

## [1.8.0] - 2026-11-25

### Adicionado
- **Cargas Financeiras: Budget, Forecast, Valores gerenciais e Dimensões por Excel**, além do razão. A tela
  ganhou uma aba por fonte; cada arquivo é conferido no portal antes do envio (totais por mês, avisos).
- **Versões de Budget e Forecast:** o Budget é identificado por ano e nome da versão (reenviar com o mesmo
  nome substitui aquela versão); o Forecast por ano, tipo (1+11 a 11+1, ex.: 3+9, 6+6) e revisão numerada
  automaticamente. Todas as versões ficam guardadas e uma por ano fica marcada como **vigente**, escolhida
  no envio ou trocada depois na lista de versões.
- Budget/Forecast cujo nome do mês não bate com a data (coluna "Ano") são **recusados**, com o total de
  linhas divergentes e até 20 exemplos com o número da linha na planilha.
- Funções `finCarregarPlanilha` e `finDefinirVigente`; tabelas `budget`, `forecast`, `plano_versoes`,
  `dim_centro_custo`, `dim_conta` e `valores_gerenciais` na camada bronze; catálogo `fin_versoes` no Firestore.

### Alterado
- O histórico de cargas mostra o nome original do arquivo (com acentos) e a fonte de cada carga.

## [1.7.1] - 2026-11-25

### Corrigido
- Cargas Financeiras: o envio do arquivo era recusado pelo Storage ("User does not have permission").
  A regra consultava o perfil no Firestore, o que exige uma permissão de IAM entre serviços. Agora o
  portal pede à função `finAutorizarCarga` um carimbo no login (custom claim `finCarga`, só para super
  admin) e a regra do Storage confere apenas esse carimbo.

## [1.7.0] - 2026-11-24

### Adicionado
- **Lakehouse financeiro (BigQuery), primeira etapa:** tela **Cargas Financeiras** (só administrador,
  atalho na tela inicial) para enviar o **razão contábil cru exportado do Protheus**. O portal confere o
  arquivo antes de enviar (lançamentos, competências, filiais, avisos) e grava em `fin_bronze.razao_totvs`
  (região São Paulo), substituindo só as competências e filiais do arquivo.
- Leitura do razão no sistema, sem o script Python: junta as linhas de continuação do histórico e
  classifica cada lançamento (Nota Fiscal, Caixinha, Folha, Provisão, bem do ativo...) exatamente como o
  `protheus_parserV5.py` — conferido nos 79.891 lançamentos do razão de 23/11/2026, sem diferenças.
- Código do motor dos relatórios financeiros (Power BI → HTML) recuperado para o repositório e desenho do
  lakehouse em `src/modules/financeiro/LAKEHOUSE.md`.

## [1.6.0] - 2026-11-24

### Adicionado
- RDO Online › Planejamento › **Curva S** física e financeira por obra, no formato da planilha
  "Planejamento - Modelo": semanas de segunda a domingo (numeração ISO), previsto por linha de base
  (LB0 e revisões LB1, LB2...), realizado e tendência, todos digitados no sistema.
- Cálculo automático de acumulados, desvio contra a linha de base vigente e contra a LB0, semana de
  status, término da linha de base e término pela tendência (mesma regra da planilha). Conferido
  contra a planilha modelo: diferença zero em todas as linhas calculadas das duas curvas.
- Curva financeira digitada em R$, com o % calculado sobre o total da linha de base vigente.
- Colar uma coluna do Excel numa célula preenche as semanas seguintes (aceita %, frações e R$).
- Gráfico com previsto acumulado (LB0 e vigente), realizado acumulado, tendência e barras semanais.
- Visualizador só consulta; Gerente e Administrador editam (regra nova `construction_s_curves`).

### Alterado
- "Obras" (tela inicial e seletor de módulos) abre direto o RDO Online; saiu a tela de escolha entre
  painel VLI e RDO. O painel VLI fica em espera: fora dos atalhos, com dados e endereço preservados.

### Corrigido
- Seletor de módulos: "Gestão de Obras" só aparecia para super admin (testava um módulo inexistente);
  agora aparece para quem tem o RDO Online liberado.

## [1.5.5] - 2026-11-24

### Alterado
- RDO Online, aba Minhas Obras com visual de sistema corporativo: sem etiquetas coloridas nas
  tabelas, cabeçalhos em texto normal, linhas mais compactas e colunas ordenáveis (clique no título).
- Lista de obras com colunas separadas para centro de custo, contrato/descrição, cliente e regional;
  obra sem tabela de preços aparece como "não importada" na própria coluna.
- Saiu o alerta de dias sem RDO das obras e turmas; fica só a data do último RDO.
- Editar e excluir (obras, turmas e RDOs) ficam num menu "⋯" na linha, em vez de ícones soltos.
- RDOs da turma sem etiquetas: ocorrências como número e só "N a revisar" quando há o que conferir.

### Adicionado
- Campo Cliente no cadastro da obra (Vale, VLI, Rumo...). Se não for preenchido, o cliente é
  reconhecido pelo nome da obra ou pelo modelo de RDO.

### Corrigido
- Rótulos do cadastro de obra/turma estavam em cinza-claro, com pouco contraste.

## [1.5.4] - 2026-11-18

### Corrigido
- Inteligência Contratual: o filtro de turmas listava as turmas de todas as obras; agora mostra só as
  da obra aberta, em ordem alfabética. Ao trocar de obra, o filtro volta para "Todas as Turmas".
- RDO Vale: a área "Operável Parcialmente" (ou "Inoperável") virava ocorrência só quando a IA
  respondia o código pedido; se respondesse com o texto do documento, a condição se perdia e não
  entrava na análise de improdutividade. O mesmo ajuste vale para o clima ("Chuva", "Sol"...).
- IA: quando o Gemini trava sem responder (aconteceu em 19/11 com um RDO da Vale, que ficou 280 s
  esperando), cada tentativa agora tem limite de 110 s e o servidor tenta de novo sozinho; a mensagem
  final diz que o serviço não respondeu a tempo, em vez de "não foi possível falar com a IA".

## [1.5.3] - 2026-11-18

### Corrigido
- RDO Online: a importação de RDOs da Vale falhava em cerca de metade dos arquivos com "Expected
  property name or '}' in JSON". A IA gastava quase todo o limite de resposta raciocinando e o
  resultado chegava cortado. A leitura de documentos agora usa raciocínio reduzido: nos testes com os
  23 RDOs reais de outubro/2026 nenhuma resposta veio cortada e os números ficaram iguais.
- Se mesmo assim a resposta da IA vier incompleta, o servidor avisa e o usuário recebe uma mensagem
  clara para reenviar o arquivo, em vez do erro técnico.

### Alterado
- No envio de vários RDOs, um arquivo que a IA não consegue ler não interrompe mais o lote: os demais
  são importados e a tela mostra um resumo com importados, já existentes e falhas (com o motivo).
- Os avisos de importação de RDOs e da tabela de preços aparecem como notificações na tela, no lugar
  das janelas de alerta; o erro da tabela de preços mostra o motivo real.
- Obra no modelo Vale sem PQ é avisada antes de começar o envio, sem gastar leitura de IA.

## [1.5.2] - 2026-11-17

### Alterado
- RDO Online, aba Minhas Obras: os cartões grandes deram lugar a tabelas compactas. Obras, turmas e
  RDOs passam a caber numa tela, com busca, filtro por regional e ações (editar, excluir) sempre
  visíveis, inclusive no celular.
- Lista de obras mostra o que importa para acompanhar: turmas, RDOs, data do último RDO (com alerta
  quando passa de 7 dias sem RDO) e se a tabela de preços foi importada (sem ela a produção sai R$ 0).
- Turmas mostram período, último RDO e produção acumulada em R$; saiu a barra de progresso
  decorativa, que não representava nenhum dado.
- RDOs da turma em tabela com efetivo, ocorrências, produção e situação ("a revisar" quando a IA
  deixou atividades para conferir).
- Página da obra com cabeçalho (centro de custo, contrato, regional, modelo de RDO), abas Turmas e
  Tabela de preços com contagem, e busca na tabela de preços.
- Caminho de navegação simples (Obras / obra / turma / RDO) e tela de importação de RDOs mais
  objetiva, com progresso e orientação sobre tamanho e duplicidade.

### Corrigido
- Os filtros do Painel Geral e o calendário de período da Inteligência Contratual não passam mais
  por cima da barra lateral nem do cabeçalho da página.

### Removido
- Cópia antiga e sem uso do app do RDO (`App_fixed.tsx`).

## [1.5.1] - 2026-11-17

### Alterado
- RDO Online com a mesma aparência da tela inicial do portal: fundo claro, cartões brancos com
  borda fina e azul-marinho da marca nos destaques. Saiu o tema escuro.
- A barra lateral escura própria do RDO Online foi trocada pela barra lateral padrão do portal, a
  mesma do painel VLI, Capital Humano e SSMA (clara, recolhível, com seletor de módulos e conta).
- Tabelas, gráficos e etiquetas da Inteligência Contratual com cores ajustadas para fundo claro.

### Corrigido
- Os estilos do RDO Online (cartões, barra de rolagem) não afetam mais as outras telas depois que
  o módulo é aberto.

## [1.5.0] - 2026-11-08

### Adicionado
- RDO Online: modelo de RDO **Vale — Projeto Novas Ferrovias**, escolhido por obra no cadastro
  (Minhas Obras > editar obra > Modelo de RDO). A IA lê o RDO da Vale com atividades por lado e km,
  quantidade do "total", mão de obra e equipamentos por turno (em operação e fiscalizado),
  condição da área, clima, prazos, comentários e assinaturas.
- As atividades do RDO Vale, que não trazem código, são ligadas ao item da PQ da obra pela IA.
  Só códigos que existem na PQ são aceitos; os incertos ficam com status "Revisar".
- Importação da Planilha de Quantidades e Preços (PQ) da Vale na aba Serviços da obra, usando o
  CÓD. ATIVIDADE como código (o número do ITEM se repete na PQ).
- Na edição do RDO, o código da atividade é escolhido numa lista com os itens da tabela da obra.

### Alterado
- O envio de RDOs não grava de novo um RDO que a turma já tem com a mesma data e número; o
  sistema lista os arquivos ignorados.
- Quando a IA está sobrecarregada, o servidor tenta de novo automaticamente antes de avisar o usuário.

## [1.4.3] - 2026-11-04

### Corrigido
- RDO Online: o planejamento diário das equipes passa a ser gravado no banco. Antes ficava só no
  navegador de quem digitou: cada computador via um planejamento diferente e limpar o navegador
  apagava tudo.
- RDO Online: falhas ao salvar contratos, dimensões, composições, histogramas e edições de RDO
  aparecem na tela. Antes a tela mostrava "Salvo" e o dado ficava só no navegador (aconteceu com
  todo Visualizador e com todos os usuários entre 12/10 e 04/11/2026).
- RDO Online: as telas só mostram "Salvo" depois de o banco confirmar; em caso de erro, a edição
  continua na tela para tentar de novo.
- RDO Online: item excluído do histograma não volta mais ao recarregar a página.
- RDO Online: no envio de vários RDOs, os que já foram processados antes de uma falha aparecem na
  lista na hora, sem precisar recarregar.

### Adicionado
- RDO Online: ao abrir o módulo, dados que ficaram só no navegador são comparados com o banco.
  Se houver algo que o banco não tem, aparece um aviso para enviar (Gerente e Administrador),
  baixar em arquivo ou descartar. Cópias iguais às do banco são apagadas do navegador.

### Alterado
- RDO Online: os dados de contrato de todas as obras são carregados numa única consulta.

## [1.4.2] - 2026-11-04

### Segurança
- A chave do Gemini saiu do código publicado. Antes ela ia junto no JavaScript do site e qualquer
  pessoa podia copiá-la. Agora a IA do RDO Online (leitura de RDOs, composições e análises) e do
  Capital Humano (análise de horas extras) passa pela Cloud Function `aiGenerateContent`, que guarda
  a chave no Secret Manager e só atende quem tem o módulo liberado no perfil.

### Alterado
- Arquivos acima de 7 MB enviados à IA são recusados com aviso, em vez de falhar sem explicação.
- O upload de RDOs mostra o motivo real da falha (permissão, tamanho, limite de uso da IA).

## [1.4.1] - 2026-11-04

### Corrigido
- Obras e RDO Online voltam a exibir os dados (555 RDOs, 3.034 registros de produção, equipes,
  projetos e equipamentos). Desde 12/10/2026 as regras do Firestore não tinham regra para essas
  coleções e bloqueavam todo acesso; os dados nunca foram apagados.

### Segurança
- As coleções de Obras e RDO passam a exigir login e o módulo liberado no perfil (antes de 12/10
  ficavam abertas na internet, sem login). Visualizador só lê; Gerente e Administrador gravam,
  como descrito no IAM.
- Publicada a regra que só deixa super admin alterar liberações individuais (`features`).

## [1.4.0] - 2026-11-02

### Alterado
- Nova tela inicial ocupando a largura toda e cabendo na janela no computador: destaque com a
  foto da obra e saudação, áreas do portal numeradas e barra superior com usuário e sair.
  O carrossel de banners foi retirado.

### Adicionado
- Agenda de Eventos na tela inicial: 17 eventos (construção, ferrovias, tecnologia, gestão e agro)
  com data, local, comentário e link oficial, filtro por categoria e datas conferidas em 02/11/2026.
  A lista fica em `src/pages/CentroInteligencia/sectorEvents.ts`.
- Faixa rolante de indicadores na tela inicial (pausa ao passar o mouse; clique abre a página).
- Página Indicadores de Mercado (fase 1), aberta a todos os usuários, com atalho abaixo da agenda: INCC-M, INCC-DI, Selic,
  IPCA, IGP-M, dólar PTAX, PIB da construção e Boletim Focus, direto do Banco Central e do IBGE,
  com minigráfico, variação, fonte e cache local quando uma fonte sai do ar.

### Removido
- Banners do carrossel (`src/assets/carousel`).

## [1.3.0] - 2026-11-02

### Alterado
- Nova tela de login: capa institucional à esquerda e formulário claro à direita, com o logo
  DR, "19 Anos · Construindo História" e opção de mostrar a senha. No celular aparece só o formulário.
- Aba do navegador: título "Grupo DR - Centro de Inteligência" e ícone com o logo DR
  (também na tela inicial do celular).

### Removido
- Vídeo de fundo do login antigo (`login-bg.mp4`, 15 MB).

## [1.2.1] - 2026-10-31

### Segurança
- Gestão de usuários e Cloud Functions de contas só para super admin e admin do IAM, o mesmo
  critério das regras do Firestore. Administradores CH, Comercial e Obras deixam de ver a
  página (que já não funcionava para eles).
- Cloud Functions de contas passam a Node.js 22.

## [1.2.0] - 2026-10-31

### Adicionado
- IAM: caixa "Auditoria de Ponto (piloto)" no perfil, visível só para super admin, para
  liberar ou retirar o acesso sem mexer direto no banco.

### Segurança
- Regras do Firestore: só super admin altera liberações individuais (`features`) de um
  perfil; administradores do IAM continuam editando papéis e escopos.

### Documentação
- README: papéis do Capital Humano, formato dos centros de custo e liberações individuais.

## [1.1.1] - 2026-10-31

### Alterado
- Cloud Functions passam a rodar em Node.js 22: o Google desativou o Node.js 20 em
  30/10/2026 e nenhuma função podia mais ser publicada.

## [1.1.0] - 2026-10-31

### Adicionado
- Capital Humano: aba Auditoria de Ponto (Carol Clock In), em piloto. Importação da exportação
  da Carol, mapa e cercas por obra, linha do tempo e detalhe das batidas, cruzamento por CPF
  com o cadastro do RM.

### Segurança
- Auditoria de Ponto liberada individualmente (`features.clockinAudit` no perfil), na tela,
  nas regras do Firestore e na Cloud Function `hcFetchEmployees`. Super admin não tem acesso
  automático.

## [1.0.0] - 2026-10-31

Primeira versão numerada. Passa a ser exibida no canto inferior direito de todas as telas.

### Adicionado
- Selo com versão, commit e data de publicação no rodapé (clique copia para chamados).
- Capital Humano: botões "Salvar" e "Salvar e enviar ao diretor" para gerentes e Administrador CH.

### Alterado
- Capital Humano: papéis do fluxo de horas extras. Diretor/Presidente só aprova ou devolve;
  Administrador CH segue o fluxo do gerente e não aprova; só super admin altera horas aprovadas.
- IAM: centros de custo do escopo são gravados sem ponto (mesmo formato dos lançamentos).

### Corrigido
- Regras do Firestore: perfis sem o campo `isSuperAdmin` (38 de 53) não conseguiam gravar nem
  ler o planejamento de horas extras; super admins também eram bloqueados no Capital Humano.

### Segurança
- Lançamentos de horas extras só podem ser apagados por super admin.
