# Changelog

Todas as mudanças relevantes do DR Nexus, da mais nova para a mais antiga.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versões em [SemVer](https://semver.org/lang/pt-BR/). Regra completa: README, seção "Versionamento".

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
