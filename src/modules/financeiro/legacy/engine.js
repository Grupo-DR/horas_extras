/* Motor de cálculo — transcrição das medidas DAX dos relatórios Power BI. */
(function (root) {
'use strict';

/* ---------- formatação pt-BR (equivalente ao FORMAT do DAX) ---------- */
function rnd(x, d) { const p = Math.pow(10, d); return Math.sign(x) * Math.round(Number((Math.abs(x) * p).toPrecision(14))) / p; }
function num(x, d, nogroup) {
  const r = rnd(Math.abs(x), d);
  let [i, f] = r.toFixed(d).split('.');
  if (!nogroup) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return f ? i + ',' + f : i;
}
const F = {
  cur: x => (x < 0 ? '-R$ ' : 'R$ ') + num(x, 2),                       // "R$ #,##0.00"
  cur3: x => x === 0 ? 'R$ 0,00' : (x < 0 ? 'R$ -' : 'R$ ') + num(x, 2), // "R$ #,##0.00;R$ -#,##0.00;R$ 0.00"
  pct1: x => (rnd(x * 100, 1) < 0 ? '-' : '') + num(x * 100, 1, 1) + '%',
  pct2: x => (rnd(x * 100, 2) < 0 ? '-' : '') + num(x * 100, 2, 1) + '%',
  pct0: x => (rnd(x * 100, 0) < 0 ? '-' : '') + num(x * 100, 0, 1) + '%',
  sgn1: x => x > 0 ? '+' + num(x, 1, 1) : x < 0 ? '-' + num(x, 1, 1) : '0,0',   // "+0.0;-0.0;0.0"
  sgnPct1: x => x > 0 ? '+' + num(x * 100, 1, 1) + '%' : x < 0 ? '-' + num(x * 100, 1, 1) + '%' : '0,0%',
  int: x => String(Math.round(x)),
};

/* ---------- semântica de BLANK ---------- */
const isB = v => v === null || v === undefined;
const add = (...a) => { let s = null; for (const v of a) if (!isB(v)) s = (s || 0) + v; return s; };
const neg = v => isB(v) ? null : -v;
const abs = v => isB(v) ? null : Math.abs(v);
const snap1 = r => Math.abs(r - 1) < 1e-9 ? 1 : r;
const div = (a, b) => (isB(b) || b === 0 || isB(a)) ? null : snap1(a / b);
const sub = (a, b) => (isB(a) && isB(b)) ? null : (a || 0) - (b || 0);
const z = v => isB(v) ? 0 : v;                 // comparação: BLANK = 0
const clamp01 = v => Math.min(1, Math.max(0, z(v)));
const esc = s => String(s);

const UPPER = s => (s == null ? '' : String(s)).toUpperCase();
const cmpText = (a, b) => String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), 'pt-BR', { sensitivity: 'accent' });
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function createEngine(D, CFG) {
  const NCC = D.cc.length, NK = D.conta.length;
  const CC = D.cc.map(r => ({ cct: r[0], ccdr: r[1], tipo: r[2], reg: r[3] }));
  CC.push({ cct: null, ccdr: null, tipo: null, reg: null }); // linha em branco (CC sem correspondência)
  const K = D.conta.map(r => ({ conta: r[0], desc: r[1], grupo: r[2], tc: r[3], tc2: r[4] }));
  const TCI = { 'Faturamento': 0, 'Impostos': 1, 'Despesa': 2, 'Medição': 3 };
  const TC = K.map(k => k.tc in TCI ? TCI[k.tc] : -1);
  const REAL_REC_TC = CFG.realReceita === 'Faturamento' ? 0 : 3;
  const REAL_IMP_SIGN = CFG.realImpostosSinal;
  const fa = D.fato, fN = fa.v.length;
  const fc = fa.c.map(c => c < 0 ? NCC : c);
  const REG_ORDER = ['Regional 01', 'Regional 02', 'Sede'];
  const regKey = CC.map(c => { const i = REG_ORDER.indexOf(c.reg); return i < 0 ? 3 : i; });
  const pv = D.prev || null;
  const pc = pv ? pv.c.map(c => c < 0 ? NCC : c) : null;

  /* ---------- contexto de filtro ---------- */
  function inList(v, f) { const has = f.values.some(x => x === v || (x === null && v == null)); return f.op === 'in' ? has : !has; }
  function ctx(state, pageCfg) {
    const pf = pageCfg.filters || [];
    const ccOK = new Uint8Array(NCC + 1), kOK = new Uint8Array(NK);
    const fld = { 'CC DR': 'ccdr', 'Tipo CC': 'tipo', 'Regional': 'reg' };
    for (let i = 0; i <= NCC; i++) {
      const c = CC[i]; let ok = true;
      for (const f of pf) if (fld[f.col] && !inList(c[fld[f.col]], f)) { ok = false; break; }
      if (ok && state.tipoCC && state.tipoCC.length && !state.tipoCC.includes(c.tipo)) ok = false;
      if (ok && state.regional && state.regional.length && !state.regional.includes(c.reg)) ok = false;
      if (ok && state.ccdr && state.ccdr.length && !state.ccdr.includes(c.ccdr)) ok = false;
      ccOK[i] = ok ? 1 : 0;
    }
    const kfld = { 'Grupo': 'grupo', 'Conta': 'conta', 'Descrição': 'desc', 'Tipo Conta 2': 'tc2' };
    for (let i = 0; i < NK; i++) {
      const k = K[i]; let ok = true;
      for (const f of pf) if (kfld[f.col] && !inList(k[kfld[f.col]], f)) { ok = false; break; }
      if (ok && state.desc && state.desc.length && !state.desc.includes(k.desc)) ok = false;
      if (ok && state.tc2 && state.tc2.length && !state.tc2.includes(k.tc2)) ok = false;
      kOK[i] = ok ? 1 : 0;
    }
    const anos = state.ano && state.ano.length ? state.ano : null, meses = state.mes && state.mes.length ? state.mes : null;
    const mOK = m => {
      const y = Math.floor(m / 100), mo = m % 100;
      if (y < 2024 || y > 2026) return !anos && !meses;
      return (!anos || anos.includes(y)) && (!meses || meses.includes(mo));
    };
    const mCache = new Map();
    const mOKc = m => { let v = mCache.get(m); if (v === undefined) { v = mOK(m); mCache.set(m, v); } return v; };
    const one = a => (a && a.length === 1) ? a[0] : null;
    const ccdrFiltered = pf.some(f => f.col === 'CC DR') || !!(state.ccdr && state.ccdr.length);
    // meses visíveis em DimData no contexto (para tabela mensal)
    const mesesVis = [];
    for (let mo = 1; mo <= 12; mo++) {
      const ok = (!meses || meses.includes(mo)) && (!anos || anos.some(y => y >= 2024 && y <= 2026));
      if (ok) mesesVis.push(mo);
    }
    return {
      state, ccOK, kOK, mOK: mOKc, mesesVis, ccdrFiltered,
      tipo: one(state.tipo) || 'Budget',
      etapas: state.etapa && state.etapa.length ? state.etapa : null,
      indicador: one(state.indicador),
    };
  }

  /* ---------- agregação ---------- */
  // T: Float64Array(24) = [cen(0 Real,1 Budget,2 Forecast)][tc(0..3)][soma, contagem]
  function aggregate(C, groupFn, opts) {
    const useK = !(opts && opts.ignoreConta);
    const map = new Map();
    for (let i = 0; i < fN; i++) {
      const c = fc[i]; if (!C.ccOK[c]) continue;
      const k = fa.k[i]; if (useK && !C.kOK[k]) continue;
      if (!C.mOK(fa.m[i])) continue;
      const key = groupFn(i, k, c); if (key === null) continue;
      let T = map.get(key); if (!T) { T = new Float64Array(24); map.set(key, T); }
      const tc = TC[k]; if (tc < 0) { T.any = 1; continue; }
      const o = fa.s[i] * 8 + tc * 2; T[o] += fa.v[i]; T[o + 1] += 1;
    }
    return map;
  }
  function sumT(list) { const T = new Float64Array(24); for (const t of list) if (t) for (let j = 0; j < 24; j++) T[j] += t[j]; return T; }
  const g = (T, cen, tc) => (T && T[cen * 8 + tc * 2 + 1] > 0) ? T[cen * 8 + tc * 2] : null;
  function M(T) {
    const bRec = g(T, 1, 0), bImp = g(T, 1, 1), bCus = g(T, 1, 2);
    const fRec = g(T, 2, 0), fImp = g(T, 2, 1), fCus = g(T, 2, 2);
    const rRec = g(T, 0, REAL_REC_TC), rImp0 = g(T, 0, 1), rCus = g(T, 0, 2);
    const rImp = isB(rImp0) ? null : rImp0 * REAL_IMP_SIGN;
    const bTot = add(bRec, bImp, bCus), fTot = add(fRec, fImp, fCus), rTot = add(rRec, rImp, rCus);
    return { bRec, bImp, bCus, bTot, fRec, fImp, fCus, fTot, rRec, rImp, rCus, rTot,
      bML: div(bTot, add(bRec, bImp)), fML: div(fTot, add(fRec, fImp)), rML: div(rTot, add(rRec, rImp)) };
  }

  /* ---------- Previsão (FatoPrevisao, última etapa no contexto) ---------- */
  function prevRows(C, ignoreConta) {
    if (!pv) return [];
    const out = [];
    for (let i = 0; i < pv.v.length; i++) {
      const c = pc[i]; if (!C.ccOK[c]) continue;
      const k = pv.k[i]; if (!ignoreConta && !C.kOK[k]) continue;
      if (!C.mOK(pv.m[i])) continue;
      if (C.etapas && !C.etapas.includes(pv.e[i])) continue;
      out.push(i);
    }
    return out;
  }
  function prevM(rows, pred, etapaFix) {
    let E = -Infinity, has = false;
    if (etapaFix !== undefined) {
      if (etapaFix === null) return { pRec: null, pImp: null, pCus: null, pTot: null, pML: null };
      for (const i of rows) if (pv.e[i] === etapaFix && pred(i)) { has = true; break; }
      E = has ? etapaFix : -Infinity;
    } else for (const i of rows) if (pred(i)) { has = true; if (pv.e[i] > E) E = pv.e[i]; }
    if (!has) return { pRec: null, pImp: null, pCus: null, pTot: null, pML: null };
    const s = [0, 0, 0], n = [0, 0, 0];
    for (const i of rows) if (pv.e[i] === E && pred(i)) { const tc = TC[pv.k[i]]; if (tc >= 0 && tc <= 2) { s[tc] += pv.v[i]; n[tc]++; } }
    const pRec = n[0] ? s[0] : null, pImp = n[1] ? -s[1] : null, pCus = n[2] ? s[2] : null;
    const pTot = add(pRec, pImp, pCus);
    return { pRec, pImp, pCus, pTot, pML: div(pTot, add(pRec, pImp)) };
  }
  function lastEtapa(rows, pred) { let E = null; for (const i of rows) if (!pred || pred(i)) { if (E === null || pv.e[i] > E) E = pv.e[i]; } return E; }

  function valorComparativo(m, tipo, p) {
    if (tipo === 'Forecast') return m.fTot;
    if (CFG.semanal && tipo === 'Previsão') return p ? p.pTot : null;
    if (CFG.semanal && tipo === 'Real') return m.rTot;
    return m.bTot;
  }

  /* ---------- helpers de status ---------- */
  function clsStd(r, ehCusto, P) {
    if (isB(r)) return P + 'empty';
    if (ehCusto) return r > 1 ? P + 'red' : r >= 0.95 ? P + 'green' : r >= 0.90 ? P + 'yellow' : P + 'blue';
    return r > 1 ? P + 'blue' : r >= 0.95 ? P + 'green' : r >= 0.90 ? P + 'yellow' : P + 'red';
  }
  function clsFin(r, P) { return isB(r) ? P + 'empty' : r > 0 ? P + 'green' : r < 0 ? P + 'red' : P + 'yellow'; }
  const dash = (v, f) => isB(v) ? '-' : f(v);
  const isMed = s => { const u = UPPER(s); return u.includes('MEDIÇÃO') || u.includes('MEDICAO'); };
  const isRB = s => UPPER(s).includes('RECEITA BRUTA');
  const isMedFiltro = s => isMed(s) || (CFG.medicaoInclReceita && (isRB(s) || UPPER(s).includes('FATURAMENTO')));
  const grupoExcl = s => isMed(s) || isRB(s);

  /* ---------- estrutura hierárquica Grupo/Descrição/Conta ---------- */
  function hierarchy(keys) {
    const grupos = new Map();
    for (const k of keys) {
      const c = K[k];
      if (!grupos.has(c.grupo)) grupos.set(c.grupo, new Map());
      const d = grupos.get(c.grupo); if (!d.has(c.desc)) d.set(c.desc, []); d.get(c.desc).push(k);
    }
    return [...grupos.entries()].sort((a, b) => cmpText(a[0], b[0])).map(([gname, dm]) => ({
      grupo: gname,
      descs: [...dm.entries()].sort((a, b) => cmpText(a[0], b[0])).map(([dn, ks]) => ({ desc: dn, contas: ks.sort((a, b) => cmpText(K[a].conta, K[b].conta)) })),
    }));
  }

  /* ===================== VISUAIS ===================== */

  /* HTML Tabela Gerencial (por Regional) e HTML Tabela Dinamica CC DR — mesma lógica de colunas */
  function tabelaHier(C, mode) {
    const isCC = mode === 'cc', P = isCC ? 'cc-' : 'gt-';
    const tipo = C.tipo;
    let cols; // {key, titulo, total}
    let qtdSel = 0;
    if (isCC) {
      let ccs = [];
      if (C.ccdrFiltered) {
        const set = new Set(); for (let i = 0; i < NCC; i++) if (C.ccOK[i] && !isB(CC[i].ccdr)) set.add(CC[i].ccdr);
        ccs = [...set].sort(cmpText);
      }
      qtdSel = ccs.length;
      cols = ccs.slice(0, 3).map(c => ({ key: c, titulo: c })).concat([{ key: '__TOTAL__', titulo: 'Total', total: true }]);
    } else {
      cols = [{ key: 0, titulo: 'Regional 01' }, { key: 1, titulo: 'Regional 02' }, { key: 2, titulo: 'Sede' }, { key: '__TOTAL__', titulo: 'Total', total: true }];
    }
    const colKeys = cols.filter(c => !c.total).map(c => c.key);
    const ckOf = isCC ? (c => { const i = colKeys.indexOf(CC[c].ccdr); return i < 0 ? 9 : i; }) : (c => regKey[c]);
    // agregação por (conta, coluna) — sem filtros de DimConta (aplicados depois)
    const A = aggregate(C, (i, k, c) => k * 10 + ckOf(c), { ignoreConta: true });
    const Tof = (keys, colIdx /* null = total */) => {
      const list = [];
      for (const k of keys) {
        if (colIdx === null) { for (let j = 0; j < 10; j++) { const t = A.get(k * 10 + j); if (t) list.push(t); } }
        else { const t = A.get(k * 10 + colIdx); if (t) list.push(t); }
      }
      return list.length ? sumT(list) : null;
    };
    // previsão
    const PR = CFG.semanal ? prevRows(C, true) : null;
    const prevOf = (keySet, colIdx) => {
      if (!PR) return null;
      return prevM(PR, i => keySet.has(pv.k[i]) && (colIdx === null || ckOf(pc[i]) === colIdx));
    };
    const keysOK = []; for (let k = 0; k < NK; k++) if (C.kOK[k]) keysOK.push(k);
    const colIdx = col => col.total ? null : colKeys.indexOf(col.key);

    // LinhasConta
    const linhas = [];
    for (const k of keysOK) {
      const m = M(Tof([k], null));
      if (CFG.semanal) {
        const p = prevOf(new Set([k]), null);
        if (!isB(p.pTot) || !isB(valorComparativo(m, tipo, prevOf(new Set([k]), null)))) linhas.push(k);
      } else if (!isB(valorComparativo(m, tipo)) || !isB(m.rTot)) linhas.push(k);
    }
    const H = hierarchy(linhas).filter(gp => !(grupoExcl(gp.grupo) || (isCC && CFG.ccExclFaturamento && UPPER(gp.grupo).includes('FATURAMENTO'))));

    const fmtc = v => dash(v, F.cur3);
    function cells(keys, rowTotalAll) {
      const kset = new Set(keys);
      return cols.map(col => {
        const ci = colIdx(col);
        const m = M(Tof(keys, ci));
        const tot = (col.total || rowTotalAll) ? ` ${P}total-cell` : '';
        if (CFG.semanal) {
          const p = prevOf(kset, ci);
          const vc = valorComparativo(m, tipo, p), vp = p.pTot;
          const r = (isB(vc) || isB(vp)) ? null : vc - vp;
          return `<span class='${P}td ${P}num${tot}'>${fmtc(vc)}</span><span class='${P}td ${P}num${tot}'>${fmtc(vp)}</span><span class='${P}td ${P}result${tot}'><span class='${P}pill ${clsFin(r, P)}'>${dash(r, F.cur3)}</span></span>`;
        }
        const vc = valorComparativo(m, tipo), vr = m.rTot, r = div(vr, vc);
        const eh = z(vc) < 0 || z(vr) < 0;
        return `<span class='${P}td ${P}num${tot}'>${fmtc(vc)}</span><span class='${P}td ${P}num${tot}'>${fmtc(vr)}</span><span class='${P}td ${P}result${tot}'><span class='${P}pill ${clsStd(r, eh, P)}'>${dash(r, F.pct2)}</span></span>`;
      }).join('');
    }
    // KPI (Receita Bruta / Medição | NOTAS FATURADAS)
    const allK = []; for (let k = 0; k < NK; k++) allK.push(k);
    const kRB = allK.filter(k => isRB(K[k].grupo)), kMed = allK.filter(k => isMedFiltro(K[k].grupo));
    let kpiLabel, kpiCells;
    if (CFG.kpiNotasFaturadas && (isCC || CFG.kpiNotasFaturadasGerencial)) {
      kpiLabel = 'NOTAS FATURADAS';
    } else kpiLabel = 'Receita Bruta / Medição';
    kpiCells = cols.map(col => {
      const ci = colIdx(col);
      const tot = col.total ? ` ${P}total-cell` : '';
      let a, b, r, cls, rtxt;
      if (CFG.semanal) {
        const vp = prevM(PR, i => isRB(K[pv.k[i]].grupo) && (ci === null || ckOf(pc[i]) === ci)).pTot;
        const keysC = tipo === 'Real' ? kMed : kRB;
        const kc = new Set(keysC);
        const vc = valorComparativo(M(Tof(keysC, ci)), tipo, prevM(PR, i => kc.has(pv.k[i]) && (ci === null || ckOf(pc[i]) === ci)));
        a = vc; b = vp; r = (isB(vc) || isB(vp)) ? null : vc - vp; cls = clsFin(r, P); rtxt = dash(r, F.cur3);
      } else if (isCC && CFG.kpiNotasFaturadas) {
        const m = M(Tof(keysOK, ci));
        a = tipo === 'Forecast' ? abs(m.fRec) : abs(m.bRec); b = abs(m.rRec);
        r = (isB(a) || a === 0) ? null : div(b, a);
        cls = isB(r) ? P + 'empty' : r > 1 ? P + 'blue' : r >= 0.95 ? P + 'green' : r >= 0.90 ? P + 'yellow' : P + 'red'; rtxt = dash(r, F.pct2);
      } else {
        a = valorComparativo(M(Tof(kRB, ci)), tipo); b = M(Tof(kMed, ci)).rTot; r = div(b, a);
        cls = isB(r) ? P + 'empty' : r > 1 ? P + 'blue' : r >= 0.95 ? P + 'green' : r >= 0.90 ? P + 'yellow' : P + 'red'; rtxt = dash(r, F.pct2);
      }
      return `<span class='${P}td ${P}num${tot}'>${fmtc(a)}</span><span class='${P}td ${P}num${tot}'>${fmtc(b)}</span><span class='${P}td ${P}result${tot}'><span class='${P}pill ${cls}'>${rtxt}</span></span>`;
    }).join('');
    const kpiRow = `<div class='${P}row ${P}kpi-row'><span class='${P}td ${P}label'>${kpiLabel}</span>${kpiCells}</div>`;

    let corpo = '';
    for (const gp of H) {
      const gKeys = keysOK.filter(k => K[k].grupo === gp.grupo);
      let descHtml = '';
      for (const d of gp.descs) {
        const dKeys = keysOK.filter(k => K[k].grupo === gp.grupo && K[k].desc === d.desc);
        let contas = '';
        for (const k of d.contas) {
          const lbl = isB(K[k].conta) || K[k].conta === '' ? '(Conta não informada)' : K[k].conta;
          contas += `<div class='${P}row ${P}account-row'><span class='${P}td ${P}label ${P}account-label'><span class='${P}account-dot'></span>${esc(lbl)}</span>${cells([k])}</div>`;
        }
        descHtml += `<details class='${P}subgroup'><summary class='${P}row ${P}description-row'><span class='${P}td ${P}label ${P}description-label'><span class='${P}subchev'></span>${esc(isB(d.desc) ? '(Sem descrição)' : d.desc)}</span>${cells(dKeys)}</summary>${contas}</details>`;
      }
      corpo += `<details class='${P}group'><summary class='${P}row ${P}group-row'><span class='${P}td ${P}label'><span class='${P}chev'></span>${esc(isB(gp.grupo) ? '(Sem grupo)' : gp.grupo)}</span>${cells(gKeys)}</summary>${descHtml}</details>`;
    }
    const totalRow = `<div class='${P}row ${P}total-row'><span class='${P}td ${P}label'>Total</span>${cells(keysOK, true)}</div>`;
    const sub2 = CFG.semanal ? 'Previsão' : 'Real', sub3 = CFG.semanal ? 'Resultado R$' : 'Resultado';

    if (isCC) {
      const qtdSub = cols.length * 3, larg = 340 + qtdSub * 96;
      const header = `<div class='cc-header'><span class='cc-th cc-th-main'>Grupo / Descrição / Conta</span>` +
        cols.map(c => `<span class='cc-th cc-th-cc'>${esc(c.titulo)}</span>`).join('') +
        cols.map(() => `<span class='cc-th cc-th-sub'>${tipo}</span><span class='cc-th cc-th-sub'>${sub2}</span><span class='cc-th cc-th-sub'>${sub3}</span>`).join('') + `</div>`;
      const rod = (!C.ccdrFiltered || qtdSel === 0) ? `Nenhum CC DR selecionado. A tabela exibe apenas o Total. Comparativo selecionado: ${tipo}.`
        : qtdSel > 3 ? `Foram selecionados ${qtdSel} CCs. A tabela exibe somente os 3 primeiros CCs e o Total. Comparativo selecionado: ${tipo}.`
        : `Cabeçalho dinâmico por CC DR selecionado. Comparativo selecionado: ${tipo}.`;
      return { cssVars: { LarguraMinima: larg, QtdSubColunas: qtdSub },
        html: `<div class='cc-wrap'><div class='cc-title'>Resultado Gerencial por CC DR</div><div class='cc-subtitle'>Visão executiva por Grupo, Descrição, Conta e Centro de Custo.</div><div class='cc-card'><div class='cc-inner'>${header}${kpiRow}${corpo}${totalRow}<div class='cc-footer-note'>${rod}</div></div></div></div>` };
    }
    const header = `<div class='gt-header'><span class='gt-th gt-th-main' style='grid-column:1;'>Grupo / Descrição / Conta</span>` +
      cols.map((c, i) => `<span class='gt-th gt-th-region' style='grid-column:${2 + i * 3} / span 3;'>${c.titulo}</span>`).join('') +
      cols.map((c, i) => `<span class='gt-th gt-th-sub' style='grid-column:${2 + i * 3};'>${tipo}</span><span class='gt-th gt-th-sub' style='grid-column:${3 + i * 3};'>${sub2}</span><span class='gt-th gt-th-sub' style='grid-column:${4 + i * 3};'>${sub3}</span>`).join('') + `</div>`;
    const foot = CFG.semanal ? `Comparativo selecionado: ${tipo}.` : `Comparativo selecionado: ${tipo}. Quando nenhum filtro é aplicado, o padrão é Budget.`;
    if (CFG.semanal) return { html: `<div class='gt-wrap'><div class='gt-title'>Resultado Gerencial por Regional</div><div class='gt-subtitle'>Visão executiva por Grupo, Descrição, Conta e Regional</div><div class='gt-card'><div class='gt-inner'>${header}${kpiRow}${corpo}${totalRow}<div class='gt-footer-note'>${foot}</div></div></div></div>` };
    return { html: `<div class='gt-wrap'><div class='gt-title'>Resultado Gerencial por Regional</div><div class='gt-subtitle'>Visão executiva por Grupo, Descrição, Conta e Regional</div><div class='gt-card'>${header}<div class='gt-body-scroll'>${kpiRow}${corpo}${totalRow}</div><div class='gt-footer-note'>${foot}</div></div></div>` };
  }

  /* valores de indicador (Receita / Custos / Margem) */
  function indVals(m, ind, tipo, mlName) {
    const isRec = ind === 'Receita/Medições', isCus = ind === 'Custos/Despesas';
    const real = isRec ? abs(m.rRec) : isCus ? abs(m.rCus) : m.rML;
    let comp;
    if (isRec) comp = tipo === 'Forecast' ? abs(m.fRec) : abs(m.bRec);
    else if (isCus) comp = tipo === 'Forecast' ? abs(m.fCus) : abs(m.bCus);
    else comp = tipo === 'Forecast' ? m.fML : m.bML;
    return { real, comp };
  }
  function statusOf(r, ehC) {
    if (isB(r)) return ['#e5e7eb', 'gray', 'Sem dados'];
    if (ehC) return r > 1 ? ['#dc2626', 'red', 'Acima do previsto'] : r >= 0.95 ? ['#16a34a', 'green', 'Dentro do plano'] : r >= 0.90 ? ['#f59e0b', 'yellow', 'Atenção'] : ['#2563eb', 'blue', 'Economia'];
    return r > 1 ? ['#2563eb', 'blue', 'Acima do plano'] : r >= 0.95 ? ['#16a34a', 'green', 'Dentro do plano'] : r >= 0.90 ? ['#f59e0b', 'yellow', 'Atenção'] : ['#dc2626', 'red', 'Crítico'];
  }
  const resultado = (real, comp) => CFG.desvioRelativo ? ((isB(comp) || comp === 0) ? null : snap1(1 + z(div(sub(real, comp), Math.abs(comp))))) : div(real, comp);
  const resultadoVisualCusto = (real, comp) => CFG.desvioRelativo ? ((isB(real) || real === 0) ? null : div(comp, real)) : div(comp, real);

  /* HTML Cards Indicador Gerencial */
  function cardsIndicador(C) {
    const tipo = C.tipo, ind = C.indicador || 'Margem Bruta';
    const ehM = ind === 'Margem Bruta', ehC = ind === 'Custos/Despesas';
    const A = aggregate(C, (i, k, c) => regKey[c]);
    const all = M(sumT([...A.values()]));
    const labelReal = ind === 'Receita/Medições' ? 'Real Receita/Medição' : ehC ? 'Real Custos/Despesas' : 'Margem Real';
    const labelComp = ind === 'Receita/Medições' ? tipo + ' Receita/Medição' : ehC ? tipo + ' Custos/Despesas' : 'Margem ' + tipo;
    const fv = v => ehM ? F.pct1(v) : F.cur(v);
    const fd = v => ehM ? F.sgn1(v * 100) + ' p.p.' : F.cur3(v);
    const v0 = indVals(all, ind, tipo);
    const r0 = resultado(v0.real, v0.comp), rv0 = ehC ? resultadoVisualCusto(v0.real, v0.comp) : r0, d0 = sub(v0.real, v0.comp);
    const [cor0, cl0, st0] = statusOf(r0, ehC);
    let html = `<div class='ig-card ig-card-main'><div class='ig-kicker'>MAIN KPI</div><div class='ig-title-main'>${ind} DR</div><div class='ig-subtitle'>Comparativo gerencial entre Real e ${tipo}. O número central representa o atingimento do indicador selecionado.</div><div class='ig-main-body'><div class='ig-ring' style='--p:${F.pct0(clamp01(rv0))}; --c:${cor0};'><span class='ig-ring-value'>${dash(r0, F.pct1)}</span></div><div class='ig-side'><div class='ig-metric-label'>Atingimento vs ${tipo}</div><div class='ig-metric-value'>${dash(r0, F.pct1)}</div><span class='ig-badge ig-${cl0}'>${st0}</span><div class='ig-meta'>Comparativo vs ${tipo}</div><div class='ig-details'><div class='ig-detail-row'><span>${labelReal}</span><strong>${dash(v0.real, fv)}</strong></div><div class='ig-detail-row'><span>${labelComp}</span><strong>${dash(v0.comp, fv)}</strong></div><div class='ig-detail-row'><span>Delta</span><strong>${dash(d0, fd)}</strong></div></div></div></div></div>`;
    for (const [ri, tit] of [[0, 'Regional 01'], [1, 'Regional 02']]) {
      const v = indVals(M(A.get(ri) || null), ind, tipo);
      const r = resultado(v.real, v.comp), rv = ehC ? resultadoVisualCusto(v.real, v.comp) : r, d = sub(v.real, v.comp);
      const [cor, cl, st] = statusOf(r, ehC);
      html += `<div class='ig-card ig-card-small'><div class='ig-title-small'>${ind}<br>${tit}</div><div class='ig-ring ig-ring-small' style='--p:${F.pct0(clamp01(rv))}; --c:${cor};'><span class='ig-ring-value'>${dash(r, F.pct1)}</span></div><div><span class='ig-badge ig-badge-small ig-${cl}'>${st}</span></div><div class='ig-meta'>Comparativo vs ${tipo}</div><div class='ig-details'><div class='ig-detail-row'><span>Atingimento</span><strong>${dash(r, F.pct1)}</strong></div><div class='ig-detail-row'><span>Real</span><strong>${dash(v.real, fv)}</strong></div><div class='ig-detail-row'><span>${tipo}</span><strong>${dash(v.comp, fv)}</strong></div><div class='ig-detail-row'><span>Delta</span><strong>${dash(d, fd)}</strong></div></div></div>`;
    }
    return { html: `<div class='ig-wrap'><div class='ig-grid'>${html}</div></div>` };
  }

  /* HTML Tabela Mensal Indicador */
  function tabelaMensal(C) {
    const ind = C.indicador || CFG.defaultIndMensal;
    const ehM = ind === CFG.margemNomeMensal, ehC = ind === 'Custos/Despesas';
    const isRec = ind === 'Receita/Medições';
    const A = aggregate(C, (i) => fa.m[i] % 100);
    const vals = m => ({
      b: isRec ? abs(m.bRec) : ehC ? abs(m.bCus) : m.bML,
      f: isRec ? abs(m.fRec) : ehC ? abs(m.fCus) : m.fML,
      r: isRec ? abs(m.rRec) : ehC ? abs(m.rCus) : m.rML,
    });
    const PR = CFG.semanal ? prevRows(C) : null;
    const ultima = PR ? lastEtapa(PR) : null;
    const pvals = (pred) => { const p = prevM(PR, pred, ultima); return isRec ? abs(p.pRec) : ehC ? abs(p.pCus) : p.pML; };
    const fmtV = v => ehM ? F.pct1(v) : F.cur3(v);
    let rows = '';
    const tot = vals(M(sumT([...A.values()])));
    const months = C.mesesVis.filter(mo => {
      const v = vals(M(A.get(mo) || null));
      return !isB(v.b) || !isB(v.f) || !isB(v.r) || (PR && !isB(pvals(i => pv.m[i] % 100 === mo)));
    });
    if (CFG.semanal) {
      const fD = v => ehM ? F.sgnPct1(v) : F.cur3(v);
      const dv = (p, x) => (isB(p) || isB(x)) ? null : p - x;
      const row = (label, v, p, cls) => {
        const db = dv(p, v.b), df = dv(p, v.f), dr = dv(p, v.r);
        return `<tr${cls}><td class='tm-month'>${label}</td><td class='tm-num'>${dash(v.b, fmtV)}</td><td class='tm-num'>${dash(v.f, fmtV)}</td><td class='tm-num'>${dash(v.r, fmtV)}</td><td class='tm-num td-prev'>${dash(p, fmtV)}</td><td class='tm-result'><span class='tm-pill ${clsFin(db, 'tm-')}'>${dash(db, fD)}</span></td><td class='tm-result'><span class='tm-pill ${clsFin(df, 'tm-')}'>${dash(df, fD)}</span></td><td class='tm-result'><span class='tm-pill ${clsFin(dr, 'tm-')}'>${dash(dr, fD)}</span></td></tr>`;
      };
      for (const mo of months) rows += row(MESES[mo - 1], vals(M(A.get(mo) || null)), pvals(i => pv.m[i] % 100 === mo), '');
      rows += row('Total', tot, pvals(() => true), " class='tm-total'");
      const rs = ehM ? '' : ' R$';
      return { html: `<div class='tm-wrap'><div class='tm-title'>Evolução Mensal - ${ind}</div><div class='tm-subtitle'>Comparativo mensal: Budget, Forecast, Real e Previsão com desvios em ${ehM ? '%' : 'R$'}.</div><div class='tm-card'><div class='tm-scroll'><table class='tm-table'><thead><tr><th style='width:10%;'>Mês</th><th>Budget</th><th>Forecast</th><th>Real</th><th class='th-prev'>Previsão</th><th>Desv. Budget${rs}</th><th>Desv. Forecast${rs}</th><th>Desv. Real${rs}</th></tr></thead><tbody>${rows}</tbody></table></div><div class='tm-footer'>Indicador: ${ind}</div></div></div>` };
    }
    const row = (label, v, cls) => {
      const db = resultado(v.r, v.b), df = resultado(v.r, v.f);
      return `<tr${cls}><td class='tm-month'>${label}</td><td class='tm-num'>${dash(v.b, fmtV)}</td><td class='tm-num'>${dash(v.f, fmtV)}</td><td class='tm-num'>${dash(v.r, fmtV)}</td><td class='tm-result'><span class='tm-pill ${clsStd(db, ehC, 'tm-')}'>${dash(db, F.pct1)}</span></td><td class='tm-result'><span class='tm-pill ${clsStd(df, ehC, 'tm-')}'>${dash(df, F.pct1)}</span></td></tr>`;
    };
    for (const mo of months) rows += row(MESES[mo - 1], vals(M(A.get(mo) || null)), '');
    rows += row('Total', tot, " class='tm-total'");
    return { html: `<div class='tm-wrap'><div class='tm-title'>Evolução Mensal - ${ind}</div><div class='tm-subtitle'>Comparativo mensal entre Budget, Forecast e Real com desvio por cenário.</div><div class='tm-card'><div class='tm-scroll'><table class='tm-table'><thead><tr><th style='width: 18%;'>Mês</th><th>Budget</th><th>Forecast</th><th>Real</th><th>Desvio Budget</th><th>Desvio Forecast</th></tr></thead><tbody>${rows}</tbody></table></div><div class='tm-footer'>Indicador selecionado: ${ind}.</div></div></div>` };
  }

  /* HTML Cards Indicador por CC DR */
  function cardsCC(C) {
    const tipo = C.tipo, ind = C.indicador || CFG.defaultIndCardsCC;
    const ehM = ind === CFG.margemNomeCardsCC, ehC = ind === 'Custos/Despesas';
    const labelReal = ind === 'Receita/Medições' ? 'Real Receita/Medição' : ehC ? 'Real Custos/Despesas' : 'Margem Real';
    const labelComp = ind === 'Receita/Medições' ? tipo + ' Receita/Medição' : ehC ? tipo + ' Custos/Despesas' : 'Margem ' + tipo;
    const A = aggregate(C, (i, k, c) => CC[c].ccdr == null ? null : CC[c].ccdr);
    const set = new Set(); for (let i = 0; i < NCC; i++) if (C.ccOK[i] && !isB(CC[i].ccdr)) set.add(CC[i].ccdr);
    const fv = v => ehM ? F.pct1(v) : F.cur(v), fd = v => ehM ? F.sgn1(v * 100) + ' p.p.' : F.cur3(v);
    const list = [];
    for (const cc of [...set].sort(cmpText)) {
      const v = indVals(M(A.get(cc) || null), ind, tipo);
      if (isB(v.real) && isB(v.comp)) continue;
      const r = div(v.real, v.comp), d = sub(v.real, v.comp);
      const sev = isB(r) ? 9 : ehC ? (r > 1 ? 1 : r >= 0.95 ? 3 : r >= 0.90 ? 2 : 4) : (r < 0.90 ? 1 : r < 0.95 ? 2 : r <= 1 ? 3 : 4);
      list.push({ cc, v, r, d, sev });
    }
    const ord = new Map((D.ccOrder || []).map((c, i) => [c, i]));
    list.sort((a, b) => a.sev - b.sev || (ord.get(a.cc) ?? 1e9) - (ord.get(b.cc) ?? 1e9));
    const cards = list.map(({ cc, v, r, d }) => {
      const [cor, cl, st] = statusOf(r, ehC);
      return `<div class='cck-card' style='border-top:4px solid ${cor};'><div class='cck-top'><div class='cck-left'><div class='cck-name' title='${esc(cc)}'>${esc(cc)}</div><div class='cck-indicator'>${ind}</div></div><div class='cck-right'><div class='cck-score-label'>Atingimento</div><div class='cck-score-value'>${dash(r, F.pct1)}</div><span class='cck-badge cck-${cl}'>${st}</span></div></div><div class='cck-meta'>Comparativo vs ${tipo}</div><div class='cck-details'><div class='cck-row'><span>${labelReal}</span><strong>${dash(v.real, fv)}</strong></div><div class='cck-row'><span>${labelComp}</span><strong>${dash(v.comp, fv)}</strong></div><div class='cck-row'><span>Delta</span><strong>${dash(d, fd)}</strong></div></div></div>`;
    }).join('');
    return { html: `<div class='cck-wrap'><div class='cck-title'>Indicador Gerencial por Centro de Custo</div><div class='cck-subtitle'>Cards por CC DR considerando o indicador selecionado e o comparativo Budget/Forecast. Os cards críticos aparecem primeiro.</div>${list.length === 0 ? "<div class='cck-empty-state'>Nenhum centro de custo com dados para o indicador selecionado.</div>" : "<div class='cck-grid'>" + cards + "</div>"}</div>` };
  }

  /* Pareto (Real, ABS) — base por coluna da DimConta */
  function paretoBase(C, field) {
    const A = aggregate(C, (i, k) => fa.s[i] === 0 ? k : null);
    const signed = new Map(), cnt = new Map();
    const visible = new Set();
    for (let k = 0; k < NK; k++) if (C.kOK[k]) visible.add(K[k][field]);
    for (const [k, T] of A) {
      const key = K[k][field];
      let s = 0, n = 0; for (let tc = 0; tc < 4; tc++) { s += T[tc * 2]; n += T[tc * 2 + 1]; }
      if (!n && !T.any) continue;
      signed.set(key, (signed.get(key) || 0) + s); cnt.set(key, (cnt.get(key) || 0) + Math.max(n, 1));
    }
    // linhas com tipo conta fora do mapa também somam no Pareto
    if ([...A.values()].some(t => t.any)) {
      for (let i = 0; i < fN; i++) {
        if (fa.s[i] !== 0) continue; const k = fa.k[i]; if (TC[k] >= 0 || !C.kOK[k] || !C.ccOK[fc[i]] || !C.mOK(fa.m[i])) continue;
        const key = K[k][field]; signed.set(key, (signed.get(key) || 0) + fa.v[i]); cnt.set(key, (cnt.get(key) || 0) + 1);
      }
    }
    let totalSigned = 0, any = false;
    const items = [];
    for (const key of visible) {
      if (!cnt.get(key)) continue;
      const s = signed.get(key); totalSigned += s; any = true;
      items.push({ key, s, val: Math.abs(s) });
    }
    const total = any ? Math.abs(totalSigned) : null;
    const vals = [...new Set(items.map(x => x.val))].sort((a, b) => b - a);
    for (const it of items) {
      it.rank = vals.indexOf(it.val) + 1;
      let acc = 0;
      for (const o of items) if (o.val > it.val || (o.val === it.val && cmpText(o.key, it.key) >= 0)) acc += o.s;
      it.unit = div(it.val, total); it.acum = div(Math.abs(acc), total);
      it.tipo = z(it.acum) <= 0.80 ? 'A' : z(it.acum) <= 0.95 ? 'B' : 'C';
    }
    items.sort((a, b) => a.rank - b.rank || cmpText(a.key, b.key));
    return { items, total };
  }
  function pareto(C) {
    const { items: all, total } = paretoBase(C, 'desc');
    const items = all.filter(x => x.val !== 0);
    if (!items.length) return { html: `<div class='pt-wrap'><div class='pt-title'>Pareto por Descrição</div><div class='pt-subtitle'>Visão executiva da representatividade por descrição contábil.</div><div class='pt-empty-state'>Nenhum dado encontrado para o Pareto no contexto atual.</div></div>` };
    const sumT_ = t => { const l = items.filter(x => x.tipo === t); return l.length ? l.reduce((a, x) => a + x.val, 0) : null; };
    const vA = sumT_('A'), vB = sumT_('B'), vC = sumT_('C');
    const fc3 = v => isB(v) ? '' : F.cur3(v), fp = v => isB(v) ? '' : F.pct2(v);
    const cor = { A: '#2563eb', B: '#f59e0b', C: '#9ca3af' };
    const linhas = items.map(it => `<tr><td class='pt-desc' title='${esc(it.key)}'>${esc(it.key)}</td><td class='pt-num'>${F.cur3(it.val)}</td><td class='pt-center'><span class='pt-percent-pill'>${fp(it.unit)}</span></td><td><div class='pt-acc-wrap'><div class='pt-bar-bg'><div class='pt-bar-fill' style='width:${F.pct0(clamp01(it.acum))}; background:${cor[it.tipo]};'></div></div><div class='pt-acc-text'>${fp(it.acum)}</div></div></td><td class='pt-center'><span class='pt-type pt-type-${it.tipo.toLowerCase()}'>${it.tipo}</span></td></tr>`).join('');
    const totalRow = `<tr class='pt-total'><td class='pt-desc'>Total</td><td class='pt-num'>${fc3(total)}</td><td class='pt-center'><span class='pt-percent-pill'>100,00%</span></td><td><div class='pt-acc-wrap'><div class='pt-bar-bg'><div class='pt-bar-fill' style='width:100%; background:#111827;'></div></div><div class='pt-acc-text'>100,00%</div></div></td><td class='pt-center'><span class='pt-type pt-type-empty'>-</span></td></tr>`;
    const tabela = `<div class='pt-card'><div class='pt-scroll'><table class='pt-table'><thead><tr><th style='width: 44%;'>Descrição</th><th style='width: 18%;'>Pareto Valor</th><th style='width: 13%;'>Pareto % Unitário</th><th style='width: 18%;'>Pareto % Acumulado</th><th style='width: 7%;'>Tipo</th></tr></thead><tbody>${linhas}${totalRow}</tbody></table></div><div class='pt-footer'>Pareto calculado conforme os filtros ativos do relatório.</div></div>`;
    const card = (L, v) => { const p = div(v, total); return `<div class='pt-class-card pt-class-card-${L.toLowerCase()}'><div class='pt-class-head'><div class='pt-class-title'>Classe ${L}</div><span class='pt-class-tag pt-class-tag-${L.toLowerCase()}'>${L}</span></div><div class='pt-class-value'>${fc3(v)}</div><div class='pt-class-percent'><span>Participação</span><strong>${fp(p)}</strong></div><div class='pt-class-bar-bg'><div class='pt-class-bar-fill pt-class-bar-${L.toLowerCase()}' style='width:${F.pct0(clamp01(p))};'></div></div></div>`; };
    return { html: `<div class='pt-wrap'><div class='pt-title'>Pareto por Descrição</div><div class='pt-subtitle'>Visão executiva da representatividade por descrição contábil.</div><div class='pt-layout'>${tabela}<div class='pt-side'>${card('A', vA)}${card('B', vB)}${card('C', vC)}</div></div></div>` };
  }
  function paretoGrupo(C) { return paretoBase(C, 'grupo').items.filter(x => x.val !== 0 || true).sort((a, b) => b.val - a.val); }

  /* Tabela de Notas Emitidas (FatoRealDetalhe) */
  function notas(C) {
    const d = D.det, map = new Map();
    for (let i = 0; i < d.v.length; i++) {
      const c = d.c[i] < 0 ? NCC : d.c[i]; if (!C.ccOK[c]) continue;
      if (!C.kOK[d.k[i]]) continue; if (!C.mOK(d.m[i])) continue;
      const mo = d.m[i] % 100, y = Math.floor(d.m[i] / 100);
      const mn = (y >= 2024 && y <= 2026) ? MESES[mo - 1] : null;
      const key = CC[c].ccdr + '\u0001' + mn + '\u0001' + d.h[i];
      const o = map.get(key); if (o) o.v += d.v[i]; else map.set(key, { cc: CC[c].ccdr, mes: mn, h: D.hist[d.h[i]], v: d.v[i] });
    }
    const rows = [...map.values()].sort((a, b) => a.v - b.v);
    return { rows, total: rows.length ? rows.reduce((a, r) => a + r.v, 0) : null };
  }

  /* Matriz Real Total (Semanal - página Análise) */
  function matriz(C, by) {
    const A = aggregate(C, (i, k, c) => (by === 'cc' ? (CC[c].ccdr == null ? '∅' : CC[c].ccdr) : k) + '|' + (fa.m[i] % 100));
    return { A, M, K, CC };
  }

  /* HTML Tabela Previsao por Etapa (Regional | CC DR) */
  function etapa(C, by) {
    const ind = C.indicador || 'Margem Líquida';
    const fmt = ind === 'Margem Líquida' ? F.pct1 : F.cur3;
    const rows = prevRows(C);
    const rowKey = i => by === 'cc' ? CC[pc[i]].ccdr : CC[pc[i]].reg;
    const val = pred => {
      let s = [0, 0, 0, 0], n = [0, 0, 0, 0], all = 0, nall = 0;
      for (const i of rows) if (pred(i)) { const tc = TC[pv.k[i]]; all += pv.v[i]; nall++; if (tc >= 0) { s[tc] += pv.v[i]; n[tc]++; } }
      if (ind === 'Receita/Medições') return n[0] ? s[0] : null;
      if (ind === 'Custos/Despesas') return n[2] ? s[2] : null;
      return { all: nall ? all : null, rev: n[0] ? s[0] : null, imp: n[1] ? -s[1] : null, cus: n[2] ? s[2] : null };
    };
    const base = pred => { const v = val(pred); return (v && typeof v === 'object') ? v.all : v; };
    const cellV = pred => { const v = val(pred); if (v === null || typeof v !== 'object') return v; const tot = add(v.rev, v.imp, v.cus); return div(tot, add(v.rev, v.imp)); };
    const etapas = [...new Set(rows.map(i => pv.e[i]))].filter(e => !isB(e) && !isB(base(i => pv.e[i] === e))).sort((a, b) => a - b);
    const set = new Set(); for (let i = 0; i < NCC; i++) if (C.ccOK[i]) set.add(by === 'cc' ? CC[i].ccdr : CC[i].reg);
    if (rows.some(i => pc[i] === NCC)) set.add(null);
    const linhasK = [...set].filter(r => !isB(r) && !isB(base(i => rowKey(i) === r))).sort(cmpText);
    const qtd = etapas.length, larg = (by === 'cc' ? 230 : 190) + qtd * 110;
    const title = by === 'cc' ? ['Previsões por Etapa - CC DR', 'Visão dos lançamentos de previsão por Centro de Custo e Etapa.', 'CC DR'] : ['Previsões por Etapa', 'Visão dos lançamentos de previsão por Regional e Etapa.', 'Regional'];
    if (!qtd || !linhasK.length) return { cssVars: { VAR_QTD_COLUNAS: qtd, VAR_LARGURA_MINIMA: larg }, html: `<div class='pe-wrap'><div class='pe-title'>${title[0]}</div><div class='pe-subtitle'>${title[1]}</div><div class='pe-empty-state'>Nenhum lançamento de previsão encontrado no contexto atual.</div></div>` };
    const header = `<div class='pe-header'><span class='pe-th pe-th-main'>${title[2]}</span>${etapas.map(e => `<span class='pe-th'>${e}</span>`).join('')}</div>`;
    const linhas = linhasK.map(r => `<div class='pe-row'><span class='pe-td pe-label' title='${esc(r)}'>${esc(r)}</span>${etapas.map(e => `<span class='pe-td pe-num'>${dash(cellV(i => rowKey(i) === r && pv.e[i] === e), fmt)}</span>`).join('')}</div>`).join('');
    const total = `<div class='pe-row pe-total-row'><span class='pe-td pe-label'>Total</span>${etapas.map(e => `<span class='pe-td pe-num pe-total-cell'>${dash(cellV(i => pv.e[i] === e), fmt)}</span>`).join('')}</div>`;
    return { cssVars: { VAR_QTD_COLUNAS: qtd, VAR_LARGURA_MINIMA: larg }, html: `<div class='pe-wrap'><div class='pe-title'>${title[0]}</div><div class='pe-subtitle'>${title[1]}</div><div class='pe-card'><div class='pe-inner'>${header}<div class='pe-scroll'>${linhas}${total}</div></div></div></div>` };
  }

  return {
    ctx, F, MESES, CC, K, cmpText,
    tabelaGerencial: C => tabelaHier(C, 'regional'),
    tabelaCC: C => tabelaHier(C, 'cc'),
    cardsIndicador, tabelaMensal, cardsCC, pareto, paretoGrupo, notas, matriz, etapa,
    etapasDisponiveis: () => pv ? [...new Set(pv.e)].sort((a, b) => a - b) : [],
  };
}

root.PBIEngine = { createEngine, F, MESES };
if (typeof module !== 'undefined') module.exports = root.PBIEngine;
})(typeof window !== 'undefined' ? window : globalThis);
