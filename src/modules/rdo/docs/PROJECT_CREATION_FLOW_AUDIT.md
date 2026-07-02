# Auditoria de Fluxo: Falha na Criação de Obra

## 1. Fluxo de Execução

Passo a passo desde o clique do usuário até a falha no Firestore:

1. O usuário clica no botão "Nova Obra" no componente `<ProjectList />`.
2. O evento dispara a função `openCreateModal` (no arquivo `App.tsx`, linha 153).
3. A função inicializa o estado do formulário:
   - `newItemName = ''`
   - `newItemRegional = ''`
   - `newItemBudget = ''`
   - `newItemForecast = ''`
4. O usuário preenche os dados básicos e clica em salvar no modal de criação.
5. O botão do modal aciona a função `handleSaveProject` (`App.tsx`, linha 177).
6. O objeto `newProject` é construído utilizando ternários para os valores financeiros que, se vazios, atribuem o valor explícito `undefined`.
7. O objeto é repassado para `db.saveProject(newProject)`.
8. Em `firestoreService.ts`, a função `saveProject` executa `setDoc(doc(db, COLLECTIONS.PROJECTS, project.id), project)`.
9. **FALHA:** A biblioteca cliente do Firestore (`firebase/firestore`) realiza uma validação estrutural do payload antes do envio à rede. Ela identifica a presença da propriedade `undefined` e lança uma exceção assíncrona.
10. O bloco `catch (e)` em `handleSaveProject` captura essa exceção e silencia o erro real, exibindo apenas um alerta genérico: `alert("Erro ao salvar projeto no Firestore.");`

## 2. Componentes Envolvidos

- **`<App />`** (`App.tsx`): Contém o estado global, a função `handleSaveProject` e a estruturação do modal.
- **`<ProjectList />`** (`components/ProjectList.tsx`): Responsável por exibir o botão de criar obra e disparar a *prop* `onCreateProject`.
- **`saveProject`** (`services/firestoreService.ts`): Serviço que tenta persistir o dado no banco de dados com `setDoc`.

## 3. Objeto Project Gerado

O payload exato que está sendo submetido ao Firestore (caso os campos orçamentários sejam deixados em branco, o que é o comportamento comum na criação) é:

```javascript
{
  "id": "uuid-gerado-1234",
  "name": "Nome da Obra Digitado",
  "regional": "Regional Digitada", // ou "" se em branco
  "budgetValue": undefined,        // CAUSA DA FALHA
  "forecastValue": undefined,      // CAUSA DA FALHA
  "createdAt": "2026-06-24T10:00:00.000Z",
  "services": []
}
```

## 4. Campos Obrigatórios

De acordo com a interface `Project` em `types.ts`:

| Campo | Obrigatório (Interface) | Está sendo enviado? | Valor Atribuído |
|---|---|---|---|
| `id` | Sim | Sim | UUID válido |
| `name` | Sim | Sim | String |
| `createdAt` | Sim | Sim | String ISO Date |
| `services` | Sim | Sim | Array Vazio `[]` |
| `budgetValue` | Opcional (`?`) | **Sim (como undefined)** | `undefined` |
| `forecastValue` | Opcional (`?`) | **Sim (como undefined)** | `undefined` |

> *Nota: Os campos obrigatórios do TypeScript estão sendo enviados corretamente, porém os campos opcionais estão quebrando o salvamento devido à injeção da flag `undefined` em tempo de execução.*

## 5. Causa Raiz

A raiz do problema é uma **incompatibilidade entre o JavaScript/TypeScript padrão e a API do SDK Modular do Firebase Firestore**.

Diferente do AWS DynamoDB ou bancos SQL que costumam aceitar e ignorar valores `undefined`, **o Firestore rejeita explicitamente `undefined` dentro de payloads do `setDoc` ou `addDoc`**. Ao receber uma propriedade com o valor de memória `undefined`, o SDK do Firebase impede a operação localmente lançando a exceção:

```
FirebaseError: Function setDoc() called with invalid data. Unsupported field value: undefined
```

Como o código em `App.tsx` força a presença de `undefined`:
```typescript
budgetValue: newItemBudget ? Number(newItemBudget) : undefined,
forecastValue: newItemForecast ? Number(newItemForecast) : undefined,
```
o objeto montado inclui chaves formalmente mapeadas para `undefined`, o que trava a transação imediatamente. O `catch (e)` na função `handleSaveProject` esconde este erro no console/UI, impedindo um diagnóstico claro sem auditoria de código.

## 6. Correção Recomendada

O código não deve enviar chaves `undefined` para o Firestore. É necessário alterar o objeto utilizando a técnica do próprio Javascript para não definir a chave, ou enviar o valor `null`.

**Opção de Correção para `App.tsx` (removendo a chave condicionalmente):**

```typescript
const newProject: Project = {
  id: generateUUID(),
  name: newItemName,
  regional: newItemRegional,
  createdAt: new Date().toISOString(),
  services: []
};

// Apenas atrelar propriedades se tiverem valor (evitando undefined)
if (newItemBudget) newProject.budgetValue = Number(newItemBudget);
if (newItemForecast) newProject.forecastValue = Number(newItemForecast);

await db.saveProject(newProject);
```

*Alternativamente*, se o projeto exigir o envio das propriedades ociosas, os valores devem ser substituídos de `undefined` por `null`, mas o TypeScript de `Project` precisará permitir `null`. A opção recomendada acima é muito mais alinhada com as melhores práticas de banco de dados NoSQL por omitir as chaves. 

Isso deve ser aplicado tanto no fluxo de criação (`newProject`) quanto no de edição (`updatedProjects.map(...)`). A mesma causa ocorre ao tentar atualizar propriedades removendo os números do orçamento. 

## 7. Nível de Confiança

**Confiança:** 100%

O comportamento do Firestore frente a valores `undefined` é amplamente documentado (exige `null` ou remoção da chave do payload). A presença do *try/catch* engolindo a exceção confirma por que o erro aparece sem fornecer um rastreamento (*stack trace*) no console. Todos os outros critérios exigidos para persistência estão preenchidos de forma perfeitamente íntegra.
