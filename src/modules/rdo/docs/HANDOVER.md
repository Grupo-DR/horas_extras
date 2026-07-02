# Guia de Transferência (Handover) — Portal Gerenciador Module Obras

> **Destinatário:** Equipe técnica interna — DR Construtora e Serviços Ltda.
> **Data:** 2026-06-24
> **Versão do sistema:** 2.0 (Firestore)
> **Confidencialidade:** Uso interno — não distribuir externamente

---

## Pré-requisitos

Antes de começar, garanta que você tem instalado:

- **Node.js** v18 ou superior (`node --version`)
- **npm** v9 ou superior (incluso com Node.js)
- **Git** (para clonar e versionar)
- Acesso ao **Firebase Console** do projeto
- Acesso ao **Google AI Studio** (para chave Gemini)

---

## 1. Como Instalar

```bash
# 1. Navegue até a pasta do projeto
cd "OneDrive - DR Construtora e Serviços Ltda/Área de Trabalho/Projetos e Análises/Portal Gerenciador/module_Obras"

# 2. Instale as dependências
npm install

# Verificar: deve aparecer algo como "added 280 packages"
```

Se aparecer erros de `ERESOLVE`, tente:

```bash
npm install --legacy-peer-deps
```

---

## 2. Como Configurar

### 2.1 Arquivo .env

O arquivo `.env` na raiz do projeto é onde ficam todas as chaves de acesso.
**Este arquivo nunca deve ser commitado no Git.**

```bash
# Abra o arquivo .env e preencha:
# (No Windows, use o Bloco de Notas ou VS Code)
notepad .env
```

Conteúdo esperado do `.env`:

```bash
# ─── Google Gemini AI ────────────────────────────────────────────
VITE_GEMINI_API_KEY=AIzaSy...sua_chave_aqui...
GEMINI_API_KEY=AIzaSy...sua_chave_aqui...

# ─── Firebase / Firestore ────────────────────────────────────────
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto-id
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 2.2 Onde obter as chaves Firebase

1. Acesse [https://console.firebase.google.com](https://console.firebase.google.com)
2. Clique no projeto existente (ou crie um novo)
3. Clique em ⚙️ **Configurações do Projeto** (engrenagem no menu lateral)
4. Role até **"Seus apps"** → clique no app web
5. Copie os valores do objeto `firebaseConfig` exibido

### 2.3 Onde obter a chave Gemini

1. Acesse [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Clique em **"Create API key"**
3. Copie a chave gerada

---

## 3. Como Executar Localmente

```bash
# Inicia o servidor de desenvolvimento na porta 3000
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

### Troubleshooting de inicialização

| Sintoma | Causa | Solução |
|---|---|---|
| Tela branca sem dados | Variáveis Firebase vazias | Preencher `.env` com valores reais |
| Erro "Cannot find module" | `npm install` não rodou | Executar `npm install` |
| Porta 3000 em uso | Outra aplicação na porta | Encerrar o processo ou trocar porta no `vite.config.ts` |
| Aviso no console sobre Firebase | Variáveis VITE_FIREBASE_* vazias | Preencher `.env` |
| Dados não carregam | Firestore não configurado | Ver seção 2.2 |

---

## 4. Como Publicar (Deploy)

### 4.1 Gerar o Build de Produção

```bash
npm run build
# Saída: pasta dist/ na raiz do projeto
```

### 4.2 Opção A — Firebase Hosting (recomendado)

```bash
# Instalar Firebase CLI (uma vez por máquina)
npm install -g firebase-tools

# Login
firebase login

# Inicializar hosting no projeto (uma vez)
firebase init hosting
# Responder:
#   Public directory: dist
#   Single-page app: Yes
#   Overwrite index.html: No

# Publicar
firebase deploy --only hosting
```

### 4.3 Opção B — Servidor Nginx

1. Executar `npm run build`
2. Copiar o conteúdo de `dist/` para o webroot do servidor
3. Configurar o Nginx para redirecionar todas as rotas para `index.html`:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

### 4.4 Opção C — Netlify / Vercel

Conectar o repositório e configurar:
- **Build command:** `npm run build`
- **Publish/Output directory:** `dist`
- **Environment variables:** adicionar todas as variáveis do `.env` no painel da plataforma

---

## 5. Como Trocar Chaves Firebase

Quando for necessário migrar para um novo projeto Firebase ou renovar as chaves:

### Passo a Passo

1. **Acesse o Firebase Console** do novo projeto
2. **Obtenha os novos valores** de `firebaseConfig` (ver seção 2.2)
3. **Atualize o `.env`** com os novos valores:

```bash
VITE_FIREBASE_API_KEY=<novo_valor>
VITE_FIREBASE_AUTH_DOMAIN=<novo_valor>
VITE_FIREBASE_PROJECT_ID=<novo_valor>
VITE_FIREBASE_STORAGE_BUCKET=<novo_valor>
VITE_FIREBASE_MESSAGING_SENDER_ID=<novo_valor>
VITE_FIREBASE_APP_ID=<novo_valor>
```

4. **Reinicie o servidor de desenvolvimento:** `Ctrl+C` → `npm run dev`
5. **Para produção:** Gere novo build com `npm run build` e republique

### Arquivos que contêm referências Firebase

Todos os valores são lidos exclusivamente do `.env` via `services/firebase.ts`.
**Não há valores hardcoded em código-fonte.**

---

## 6. Como Trocar a Chave Gemini

1. Acesse [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Gere uma nova chave ou rogue a existente
3. Atualize o `.env`:

```bash
VITE_GEMINI_API_KEY=<nova_chave>
GEMINI_API_KEY=<nova_chave>
```

4. Reinicie o servidor ou gere novo build

> **Nota:** A chave Gemini é lida de duas variáveis por compatibilidade com
> o Google AI Studio. Sempre atualize **ambas**.

---

## 7. Como Diagnosticar Erros

### 7.1 Ferramentas de Diagnóstico

Abra o DevTools do browser (F12) e verifique:
- **Console:** erros JavaScript e avisos do Firebase
- **Network:** requisições ao Firestore (domínio `firestore.googleapis.com`)
- **Application → Local Storage:** dados em cache local

### 7.2 Erros Comuns e Soluções

| Erro no Console | Causa | Solução |
|---|---|---|
| `[firebase.ts] Variáveis de ambiente Firebase não encontradas` | `.env` não preenchido | Preencher e reiniciar |
| `FirebaseError: Missing or insufficient permissions` | Security Rules bloqueando | Ajustar regras no Firebase Console |
| `FirebaseError: quota-exceeded` | Cota Firestore atingida | Aguardar reset (24h) ou fazer upgrade |
| `Failed to fetch` no Gemini | Chave Gemini inválida ou sem cota | Renovar chave no AI Studio |
| Tela branca após deploy | Variáveis não configuradas em produção | Adicionar env vars na plataforma de hosting |
| `Cannot find module 'firebase/firestore'` | `npm install` não executado | Executar `npm install` |

### 7.3 Verificar Estado do Firestore

1. Acesse o [Firebase Console](https://console.firebase.google.com)
2. No menu lateral: **Firestore Database**
3. Verifique se as coleções `projects`, `teams`, `rdos`, etc. existem
4. Se o banco está vazio, a aplicação popula automaticamente com dados mock na primeira execução

### 7.4 Logs de Debug

Adicione temporariamente ao início do `App.tsx`:

```typescript
import { db } from './services/firebase';
console.log('[DEBUG] Firebase project:', db.app.options.projectId);
```

---

## 8. Como Restaurar Dados

### 8.1 Backup via Firebase Console

1. Acesse **Firestore Database** no Firebase Console
2. Clique em **Export data** (no menu ⋮)
3. Selecione **Google Cloud Storage** como destino
4. Configure periodicidade no Cloud Scheduler (recomendado: diário)

### 8.2 Backup via CLI

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Exportar todas as coleções
firebase firestore:export gs://seu-bucket/backups/$(date +%Y-%m-%d)
```

### 8.3 Restaurar um Backup

```bash
firebase firestore:import gs://seu-bucket/backups/2026-06-24
```

### 8.4 Fallback localStorage

Em caso de falha total do Firestore, os dados de histogramas, dimensões e
composições ficam preservados no `localStorage` do browser do usuário.

Para exportar o localStorage:

```javascript
// No console do browser (F12):
const backup = {};
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  backup[key] = localStorage.getItem(key);
}
console.log(JSON.stringify(backup));
```

---

## 9. Como Criar Novas Funcionalidades

### 9.1 Padrão para Nova Entidade de Dados

**Exemplo: Adicionar entidade `Material`**

**Passo 1 — Definir o tipo em `types.ts`:**

```typescript
export interface Material {
  id: string;
  projectId: string;
  name: string;
  quantity: number;
  unit: string;
  createdAt: string;
}
```

**Passo 2 — Adicionar a coleção no `firestoreService.ts`:**

```typescript
// Adicionar em COLLECTIONS:
MATERIALS: "materials",

// Adicionar as funções:
export const getMaterials = async (projectId: string): Promise<Material[]> => {
  const q = query(collection(db, COLLECTIONS.MATERIALS), where('projectId', '==', projectId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data() as Material);
};

export const saveMaterial = async (material: Material): Promise<void> => {
  await setDoc(doc(db, COLLECTIONS.MATERIALS, material.id), material);
};

export const deleteMaterial = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTIONS.MATERIALS, id));
};
```

**Passo 3 — Criar o componente em `components/MaterialList.tsx`:**

```typescript
import * as db from '../services/firestoreService';
// usar db.getMaterials(), db.saveMaterial(), db.deleteMaterial()
```

**Passo 4 — Integrar em `App.tsx`:**

```typescript
import MaterialList from './components/MaterialList';
// Adicionar estado, handler e roteamento
```

### 9.2 Padrão para Nova Integração IA

Crie um novo serviço em `services/` ou `src/services/` seguindo o padrão de
`geminiService.ts`: recebe input, chama Gemini, retorna resultado tipado.

### 9.3 Convenções de Código

- **UUIDs:** sempre usar `generateUUID()` de `utils.ts`
- **Datas:** sempre `new Date().toISOString()` para `createdAt` e `updatedAt`
- **Imports de serviço:** sempre via `import * as db from '../services/firestoreService'`
- **Tipos:** nunca usar `any` — sempre definir interface em `types.ts`

---

## 10. Contatos e Recursos

| Recurso | URL |
|---|---|
| Firebase Console | https://console.firebase.google.com |
| Google AI Studio (Gemini) | https://aistudio.google.com |
| Documentação Firestore | https://firebase.google.com/docs/firestore |
| Documentação Firebase SDK v10 | https://firebase.google.com/docs/web/modular-upgrade |
| Vite Documentation | https://vitejs.dev |
| React 19 Docs | https://react.dev |
