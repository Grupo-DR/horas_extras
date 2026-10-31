# Instruções para assistentes de código

Leia o README.md antes de alterar o projeto. Regras que valem para toda alteração:

## Versionamento (obrigatório em toda entrega)
- A versão fica no `package.json` e aparece no rodapé de todas as telas.
- Toda entrega que vai para a `main` atualiza a versão com `npm run release:patch`
  (correção), `release:minor` (funcionalidade nova) ou `release:major` (mudança que quebra
  uso ou dados) e adiciona a entrada correspondente no topo do `CHANGELOG.md`.
- `npm test` falha se a versão do `package.json` não tiver entrada no `CHANGELOG.md`.
- Detalhes: README, seção "Versionamento".

## Deploy
- Front-end: push na `main` publica na Vercel automaticamente.
- Regras do Firestore: `firebase deploy --only firestore:rules --project kanbancomercial-af561`,
  sempre a partir da `main` atualizada (nunca de um branch com regras em desenvolvimento).
