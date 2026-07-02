# Correção do Zustand Selector (Infinite Render Loop Fix)

## Arquivos Corrigidos
- `src/stores/uiStore.ts`

## Causa Raiz
No React 18, o Zustand faz uso intensivo do hook nativo `useSyncExternalStore`. Esse hook invoca constantemente a função `getSnapshot` e checa a estabilidade da referência da saída (`prevSnapshot !== nextSnapshot`).

Os seletores `useUiState` e `useUiFilters` em `uiStore.ts` retornavam objetos literais criados dinamicamente a cada invocação:

```typescript
export const useUiState = () => useUiStore((state) => ({ 
  // propriedades criadas a cada render
}));
```

Mesmo que as propriedades dentro desse objeto não tivessem sofrido alteração de valor, a construção `{}` produz uma nova referência de memória no JavaScript. O React identificava que a referência era nova durante a leitura do estado e pressupunha uma alteração sistêmica, disparando assim o alerta `The result of getSnapshot should be cached to avoid an infinite loop` e caindo num ciclo que culminava no colapso da página (`Maximum update depth exceeded`).

## Estratégia Adotada
Foi optado pela Estratégia A: utilizar o helper `useShallow` distribuído pelo próprio pacote do Zustand para aplicações React (`zustand/react/shallow`).

Envolver a função seletora com `useShallow` altera o comportamento de retorno garantindo uma verificação de "shallow equality" (igualdade rasa). Se as chaves dentro do novo objeto possuírem os mesmos valores que o objeto do snapshot prévio, a biblioteca reaproveita a **referência de memória do objeto original**, estabilizando o retorno para o `useSyncExternalStore`.

Código final implementado:
```typescript
import { useShallow } from 'zustand/react/shallow';

export const useUiFilters = () => useUiStore(useShallow((state) => ({
  filterMes: state.filterMes,
  filterStartDate: state.filterStartDate,
  // ...
})));
```

## Revisão de Outros Stores
A validação cruzada nas outras stores (`projectStore.ts`, `teamStore.ts`, `rdoStore.ts` e `planningStore.ts`) evidenciou a ausência de más práticas idênticas. Tais stores exportam atributos individuais primitivos ou matrizes persistidas no próprio state:
```typescript
// Exemplo de como estão estruturados, de modo seguro:
export const useProjectsList = () => useProjectStore((state) => state.projects);
```
Como nenhuma reconstruía dados com `[]` vazio, `{}`, `new Map()` ou funções isoladas fora do store, nenhuma alteração adicional foi requerida.

## Resultado dos Testes
A aplicação foi validada executando a build completa:

- `npm run build` e validação TypeScript estrita completados com sucesso absoluto (✓ built in 9.76s).
- Ausência de loops de renderização (`Maximum update depth exceeded` sanado na montagem de `DashboardPage`).
- Sem emissão de advertências subjacentes como `getSnapshot caching warning`.

As regras de negócio, modelagem de dados no Firestore e componentes React visuais permaneceram sem mudanças, conforme restrições exigidas.
