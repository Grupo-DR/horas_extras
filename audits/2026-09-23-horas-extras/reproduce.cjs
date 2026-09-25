/* Auditoria local: executa trechos reais via AST/TypeScript, com I/O simulado.
 * Nao importa Firebase, nao usa credenciais e nao escreve em producao.
 * Os asserts CONFIRMAM os defeitos observados; nao sao testes de aceite.
 * Executar da raiz: node audits/2026-09-23-horas-extras/reproduce.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const componentPath = path.join(root, 'src/modules/human-capital/components/Planning.tsx');
const source = ts.createSourceFile(componentPath, fs.readFileSync(componentPath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function variable(name) {
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(found, `Declaracao ${name} nao encontrada`);
  return found;
}
function evaluate(expression, context = {}) {
  const code = ts.transpileModule(`const extracted = (${expression});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React }
  }).outputText;
  return vm.runInNewContext(code + '\nextracted;', { Date, console, ...context });
}
function fn(name, context) { return evaluate(variable(name).getText(source), context); }
function memo(name, context) { return evaluate(variable(name).arguments[0].getText(source), context)(); }
function projection(component) {
  let expression;
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === component) {
      const attribute = node.attributes.properties.find(p => p.name?.getText(source) === 'records');
      expression = attribute.initializer.expression.getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(expression);
  return expression;
}
function loadModule(relative, mocks = {}, globals = {}, cache = new Map()) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;
  const requireMock = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    assert.ok(name.startsWith('.'), `Import nao permitido nesta auditoria: ${name}`);
    const dependency = path.resolve(path.dirname(file), name + '.ts');
    return loadModule(dependency, mocks, globals, cache);
  };
  vm.runInNewContext(code, { module, exports: module.exports, require: requireMock, console, ...globals }, { filename: file });
  return module.exports;
}
const formatters = loadModule('src/modules/human-capital/utils/formatters.ts');
const months = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const dateKey = fn('formatDateKey');
const results = [];
async function check(name, task) {
  const evidence = await task();
  results.push({ name, evidence });
  console.log(`CONFIRMADO: ${name}: ${JSON.stringify(evidence)}`);
}
const user = { id:'audit', name:'Auditoria sintetica', email:'audit@example.invalid', role:'CH_MANAGER', scope:{type:'ALL'} };
const employee = { chapa:'SYN-1', nome:'Pessoa sintetica', cc:'CC-A', regional:'Regional sintetica' };
const date = '2026-09-10';
const key = `${employee.chapa}_${employee.cc}_${date}`;
const record = { id:`${employee.chapa}_${employee.cc}_DAILY_${date}`, chapa:employee.chapa, nome:employee.nome, costCenter:employee.cc, date, type:'DAILY', plannedHours:2, status:'draft' };
function baseContext(extra = {}) {
  return {
    user, periodStart:new Date(2026,7,21), periodEnd:new Date(2026,8,20),
    formatDateKey:dateKey, parseTimeToDecimal:formatters.parseTimeToDecimal,
    isAuthorizedCostCenter:()=>true, setSaving:()=>{}, setAlert:()=>{}, setPlanStatuses:()=>{},
    setIsEmailDraftOpen:()=>{}, setPlans:()=>{}, planStatuses:{}, plans:{},
    uniqueEmployees:[employee], displayCostCenters:[{costCenter:'CC-A', memberChapas:['SYN-1']}],
    getEmpObj:chapa => chapa===employee.chapa ? employee : undefined,
    submissionRange:{start:'2026-08-21',end:'2026-09-20'}, emailDraft:{}, ...extra
  };
}
function serviceHarness() {
  const store = new Map();
  const navigator = {onLine:true};
  let writes = 0;
  const backend = new Map();
  const firestore = {
    upsertPlanningRecords:async records => {writes++; records.forEach(r=>backend.set(r.id,{...r}));},
    getPlanningRecords:async (month,type) => [...backend.values()].filter(r=>r.date.startsWith(month)&&r.type===type)
  };
  const service = loadModule('src/modules/human-capital/services/planning.ts', {'./firestoreCH':firestore}, {
    navigator,
    localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
    console:{log:()=>{},warn:()=>{},error:()=>{}}
  });
  return {service,store,navigator,backend,firestore,writes:()=>writes};
}
(async () => {
  await check('Falha remota e ocultada por savePlanning',async()=>{
    const h=serviceHarness();
    h.firestore.upsertPlanningRecords=async()=>{throw new Error('permission-denied sintetico');};
    await h.service.savePlanning([record],user);
    assert.equal(h.backend.size,0);
    assert.equal(JSON.parse(h.store.get('hc_planning_records_v2')).length,1);
    return {promise:'resolvida sem erro',registrosRemotos:0,registrosLocais:1};
  });
  await check('Offline nao e sincronizado na leitura seguinte',async()=>{
    const h=serviceHarness();h.navigator.onLine=false;
    await h.service.savePlanning([record],user);
    h.navigator.onLine=true;
    const rows=await h.service.getPlanning(undefined,'2026-09','DAILY',user);
    assert.equal(h.writes(),0);assert.equal(rows.length,0);
    return {escritasRemotas:h.writes(),registrosNaReleitura:rows.length};
  });
  await check('Registro removido no remoto reaparece no fallback',async()=>{
    const h=serviceHarness();await h.service.savePlanning([record],user);h.backend.clear();
    assert.equal((await h.service.getPlanning(undefined,'2026-09','DAILY',user)).length,0);
    h.navigator.onLine=false;
    const rows=await h.service.getPlanning(undefined,'2026-09','DAILY',user);
    assert.equal(rows.length,1);
    return {online:0,offline:rows.length};
  });
  await check('Limpar rascunho nao altera as horas remotas',async()=>{
    const h=serviceHarness();await h.service.savePlanning([record],user);
    await fn('handleCostCenterPlanSave',baseContext({plans:{[key]:2},planStatuses:{[key]:'draft'},savePlanning:h.service.savePlanning}))('CC-A',{[key]:0});
    assert.equal(h.backend.get(record.id).plannedHours,2);
    return {digitado:0,persistido:h.backend.get(record.id).plannedHours};
  });
  for(const handler of ['handleApproveCC','handleRejectCC']) {
    await check(`${handler} inclui datas fora da folha`,async()=>{
      const dates=['2026-08-10','2026-08-25','2026-09-10','2026-09-25'];let saved=[];
      const all=dates.map(d=>({...record,id:d,date:d,status:'pending'}));
      await fn(handler,baseContext({getPlanning:async(_cc,month)=>all.filter(r=>r.date.startsWith(month)),savePlanning:async rows=>{saved=rows;}}))('CC-A');
      const outside=saved.filter(r=>r.date<'2026-08-21'||r.date>'2026-09-20').map(r=>r.date);
      assert.deepEqual(Array.from(outside),['2026-08-10','2026-09-25']);
      return {folha:'21/08 a 20/09',datasForaAlteradas:outside};
    });
  }
  await check('Envio submete CC oculto pelo filtro',async()=>{
    const other={...employee,chapa:'SYN-2',cc:'CC-B'};let saved=[];
    const ctx=baseContext({uniqueEmployees:[employee,other],ccFilter:'CC-A',plans:{[key]:2,[`SYN-2_CC-B_${date}`]:3},savePlanning:async rows=>{saved=rows;}});
    await fn('handleSave',ctx)(true);
    assert.deepEqual(Array.from(saved.map(r=>r.costCenter)),['CC-A','CC-B']);
    assert.ok(saved.every(r=>r.status==='pending'));
    return {filtroVisivel:'CC-A',centrosSubmetidos:saved.map(r=>r.costCenter)};
  });
  await check('Salvar estado antigo sobrescreve aprovacao mais recente',async()=>{
    const h=serviceHarness();h.backend.set(record.id,{...record,plannedHours:8,status:'approved'});
    await fn('handleSave',baseContext({plans:{[key]:2},planStatuses:{[key]:'draft'},savePlanning:h.service.savePlanning}))(false);
    assert.equal(h.backend.get(record.id).status,'draft');assert.equal(h.backend.get(record.id).plannedHours,2);
    return {antes:{status:'approved',horas:8},depois:{status:h.backend.get(record.id).status,horas:h.backend.get(record.id).plannedHours}};
  });
  await check('Edicao de aprovado conserva status aprovado',async()=>{
    let saved=[];
    await fn('handleCostCenterPlanSave',baseContext({plans:{[key]:2},planStatuses:{[key]:'approved'},savePlanning:async rows=>{saved=rows;}}))('CC-A',{[key]:8});
    assert.equal(saved[0].status,'approved');assert.equal(saved[0].plannedHours,8);
    return {antes:2,depois:8,status:saved[0].status,reaprovacao:false};
  });
  await check('Aprovacao mostra horas de outro CC para mesma chapa',async()=>{
    const emps=[employee,{...employee,cc:'CC-B'}];
    const ctx=baseContext({uniqueEmployees:emps,salaries:{'SYN-1':2200},memberFuncoes:{},selectedMonth:'2026-09',
      displayCostCenters:[{id:'CC-A',costCenter:'CC-A',memberChapas:['SYN-1']},{id:'CC-B',costCenter:'CC-B',memberChapas:['SYN-1']}],
      plans:{[key]:2,[`SYN-1_CC-B_${date}`]:5},planStatuses:{[key]:'pending',[`SYN-1_CC-B_${date}`]:'pending'}});
    ctx.getEmpObj=fn('getEmpObj',ctx);
    const projected=evaluate(`()=>(${projection('ApprovalPanel')})`,ctx)();
    assert.equal(projected[1].plannedHours,2);
    return {horasReaisCC_B:5,horasExibidasCC_B:projected[1].plannedHours};
  });
  await check('Budget soma o mesmo mes de anos diferentes',async()=>{
    const total=memo('currentBudget',{selectedMonth:'2026-09',MONTH_NAMES:months,ccFilter:'',regionalFilter:'',isAuthorizedCostCenter:()=>true,
      budgets:[{month:'Setembro',monthKey:'2025-09',costCenter:'CC-A',value:10000},{month:'Setembro',monthKey:'2026-09',costCenter:'CC-A',value:12000}]});
    assert.equal(total,22000);return {correto:12000,exibido:total};
  });
  await check('Salario ausente gera custo zero com horas positivas',async()=>{
    const stats=fn('calculateTotalStats',baseContext({filteredEmployeesForStats:[employee],plans:{[key]:8},salaries:{}}))();
    assert.equal(stats.totalHours,8);assert.equal(stats.totalValue,0);return stats;
  });
  await check('Conversor aceita horas impossiveis e texto parcial',async()=>{
    const values=Object.fromEntries(['25','1:90','2abc','1:xx','-01:30','Infinity'].map(v=>[v,String(formatters.parseTimeToDecimal(v))]));
    assert.equal(values['25'],'25');assert.equal(values['1:90'],'2.5');assert.equal(values['2abc'],'2');assert.equal(values['-01:30'],'-0.5');
    return values;
  });
  await check('Status ausente e rascunho no planejamento mas aprovado no dashboard',async()=>{
    const dashboardPath=path.join(root,'src/modules/human-capital/components/Dashboard.tsx');
    const text=fs.readFileSync(dashboardPath,'utf8');
    assert.ok(text.includes("(!p.status || p.status === 'approved')"));
    assert.ok(fs.readFileSync(componentPath,'utf8').includes("planStatuses[key] || 'draft'"));
    return {verificacao:'estatica dos predicados reais',planejamento:'draft',dashboard:'incluido como aprovado'};
  });
  await check('Planejamento salvo nao garante presenca na lista de pessoas',async()=>{
    const emps=memo('uniqueEmployees',baseContext({employees:[],manualEmployees:[],headcountRecords:[],
      globalEmployees:[{chapa:'SYN-1',nome:'Pessoa sintetica',funcao:'Funcao',costCenter:'CC-A'}],
      plans:{[key]:2},planRangeStart:'2026-08-21',planRangeEnd:'2026-09-20'}));
    assert.equal(emps.length,0);
    return {planejamentoExistente:true,cadastroGlobalExistente:true,pessoasVisiveis:emps.length};
  });
  await check('Pessoa manual inativa continua elegivel para planejar',async()=>{
    const emps=memo('uniqueEmployees',baseContext({employees:[],globalEmployees:[],headcountRecords:[],
      manualEmployees:[{id:'SYN-1',chapa:'SYN-1',name:'Pessoa sintetica',costCenter:'CC-A',status:'INACTIVE'}],
      getCCRegional:()=> 'Regional sintetica',planRangeStart:'2026-08-21',planRangeEnd:'2026-09-20'}));
    assert.equal(emps.length,1);return {status:'INACTIVE',pessoasElegiveis:emps.length};
  });
  await check('Fallback do headcount ignora escopo do usuario',async()=>{
    const h=serviceHarness();h.navigator.onLine=false;
    h.store.set('hc_headcount_v1',JSON.stringify([{chapa:'SYN-2',centroCusto:'CC-B',salario:2200,dataInicio:'2026-08-21',dataFim:'2026-09-20',distribuicao:1}]));
    const rows=await h.service.getHeadcount(undefined,{...user,scope:{type:'COST_CENTER',costCenters:['CC-A']}});
    assert.equal(rows[0].centroCusto,'CC-B');return {escopo:'CC-A',centroRetornado:rows[0].centroCusto,incluiSalario:true};
  });
  await check('Upload da folha de setembro apaga salarios de agosto tambem',async()=>{
    const h=serviceHarness();let deleted=[],inserted=[];
    h.firestore.replaceHeadcountRecords=async()=>{};
    h.firestore.deleteSalaryAllocationsByMonthKeys=async keys=>{deleted=keys;};
    h.firestore.upsertSalaryAllocations=async rows=>{inserted=rows;};
    await h.service.replaceHeadcount([{chapa:'SYN-1',centroCusto:'CC-A',salario:2200,dataInicio:'2026-08-21',dataFim:'2026-09-20',distribuicao:1}],{uploadId:'SYN-UPLOAD'},user);
    assert.ok(deleted.includes('2026-08'));
    assert.deepEqual(Array.from(new Set(inserted.map(r=>r.monthKey))),['2026-09']);
    return {competenciasApagadas:deleted,competenciasRecriadas:[...new Set(inserted.map(r=>r.monthKey))]};
  });
  const snapshotPath=path.join(root,'json_firebase/hc_planning_records_2026-06-12.json');
  if(fs.existsSync(snapshotPath)) {
    const rows=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
    const status={},over24Status={},over24Values={},keys=new Map(),pairs=new Map();
    let approvedZero=0,zero=0,approvedMissingMetadata=0;
    for(const r of rows) {
      status[r.status||'MISSING']=(status[r.status||'MISSING']||0)+1;
      if(r.plannedHours===0)zero++;
      if(r.status==='approved'&&r.plannedHours===0)approvedZero++;
      if(r.status==='approved'&&(!r.approvedBy||!r.approvedAt))approvedMissingMetadata++;
      if(r.plannedHours>24) {over24Status[r.status]=(over24Status[r.status]||0)+1;over24Values[r.plannedHours]=(over24Values[r.plannedHours]||0)+1;}
      const k=[r.chapa,r.costCenter,r.date,r.type].join('|');keys.set(k,(keys.get(k)||0)+1);
      if(r.plannedHours>0) {const c=pairs.get(r.chapa)||new Set();c.add(r.costCenter);pairs.set(r.chapa,c);}
    }
    console.log('SNAPSHOT_HISTORICO_AGREGADO: '+JSON.stringify({arquivo:'2026-06-12',rows:rows.length,status,zero,approvedZero,approvedMissingMetadata,over24Status,over24Values,duplicateBusinessKeys:[...keys.values()].filter(n=>n>1).length,peopleInMultipleCCs:[...pairs.values()].filter(s=>s.size>1).length}));
  }
  console.log(`\n${results.length} verificacoes concluidas. Nenhuma conexao externa realizada.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
