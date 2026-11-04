# Changelog

Todas as mudanças relevantes do DR Nexus, da mais nova para a mais antiga.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versões em [SemVer](https://semver.org/lang/pt-BR/). Regra completa: README, seção "Versionamento".

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
