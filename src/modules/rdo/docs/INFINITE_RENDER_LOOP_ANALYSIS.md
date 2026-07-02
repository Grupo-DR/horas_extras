# Análise do Ciclo Infinito de Renderização (Infinite Render Loop)

## Objetivo
Localizar com precisão o motivo das falhas:
1. `The result of getSnapshot should be cached to avoid an infinite loop`
2. `Maximum update depth exceeded`
com stack trace apontando para `uiStore.ts:127` em `DashboardPage`.

## Descobertas e Causa Raiz

A raiz do problema encontra-se nas definições dos selectors do `uiStore.ts`.

Em `src/stores/uiStore.ts`, as seguintes linhas criam novos objetos dinamicamente a cada execução do selector:

**Linha 127:**
```typescript
export const useUiState = () => useUiStore((state) => ({
  activeMenu: state.activeMenu,
  currentView: state.currentView,
  // ...
}));
```

**Linha 141:**
```typescript
export const useUiFilters = () => useUiStore((state) => ({
  filterMes: state.filterMes,
  filterStartDate: state.filterStartDate,
  // ...
}));
```

### Por que isso causa o ciclo infinito?
Zustand (que utiliza `useSyncExternalStore` no React 18) exige que as funções de leitura de snapshot (`getSnapshot`) retornem a **mesma referência de memória** se o estado subjacente não tiver sofrido alterações. 

Quando retornamos um objeto literal `({ ... })` em um selector do Zustand sem utilizar um comparador de igualdade customizado (como `useShallow` do Zustand):
1. O Zustand chama o selector e este devolve uma *nova referência* (novo objeto).
2. O React detecta que a referência do snapshot mudou (`prevSnapshot !== nextSnapshot`).
3. O React assume que o estado foi alterado e agenda uma nova renderização.
4. Na nova renderização, o ciclo se repete, causando o `Maximum update depth exceeded` ou disparando o aviso de segurança `The result of getSnapshot should be cached to avoid an infinite loop`.

Como o hook `useDashboard` (utilizado por `DashboardPage`) invoca `useUiFilters()`, a página entra neste ciclo infinito no momento em que é montada.

## Verificação de Outros Possíveis Infratores

Seguindo as tarefas descritas, foram analisados outros fluxos e stores do sistema:

1. **DashboardPage & useDashboard (`src/modules/dashboard/pages/DashboardPage.tsx` e `hooks/useDashboard.ts`)**
   - Não foram encontrados `setState` sendo executados durante a renderização.
   - Todos os dados derivados em `useDashboard` estão propriamente envolvidos em `useMemo` com arrays de dependência coerentes (ex: `filteredRdos`, `chartData`, `revenueMetrics`).

2. **Outras Stores (`planningStore.ts`, `projectStore.ts`, `teamStore.ts`, `rdoStore.ts`)**
   - Estão exportando os atributos diretos do estado ou arrays que já são referências persistidas no próprio state.
   - Exemplo em `planningStore`: `export const useDailyPlans = () => usePlanningStore((state) => state.dailyPlans);`
   - Isso é perfeitamente seguro e cacheável, isentando essas stores de qualquer problema de loops.

3. **Repositórios no Render**
   - Nenhum `.get()` (ex: `repository.getAll()`) está sendo invocado solto na fase de renderização dos componentes.
   - Todos os carregamentos de dados assíncronos (`loadData`) estão ocorrendo fora do render cycle.

4. **Secundário: `FirestoreContractRepository.ts:24`**
   - A linha 24 contém um `console.warn` de *fallback*: `console.warn(Firestore Contract get failed for project...);` que ocorre quando a chamada ao Firestore falha (seja por permissão, ausência de doc ou problemas de rede) e cai para a busca no `localStorage`.
   - Isso pode encher o console de alertas laranjas dependendo do estado do backend, mas **não causa render loops ou crashes** na tela.

## Conclusão e Próximo Passo

O erro `Infinite Loop` no `DashboardPage` provém inteiramente da forma como o Zustand extrai múltiplos valores através de objetos literais dinâmicos (`{ ...state }`) nos selectors de `uiStore.ts`. 

Para resolver o problema, é necessário aplicar memoização nesses retornos, seja utilizando a função `useShallow` nativa do Zustand, seja separando a extração dos estados propriedade a propriedade.
