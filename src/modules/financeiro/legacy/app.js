(async function () {
'use strict';
const CFG = window.REPORT_CFG, CSS = window.REPORT_CSS;
const $ = (s, el = document) => el.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== null && v !== undefined) e.setAttribute(k, v); }
  for (const c of kids.flat()) if (c !== null && c !== undefined) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};

/* ---------- dados (gzip + base64) ---------- */
async function loadData() {
  const b64 = document.getElementById('report-data').textContent.trim();
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
let D;
try { D = await loadData(); } catch (e) { $('#loading').textContent = 'Não foi possível carregar os dados: ' + e.message + ' (use Chrome, Edge ou Firefox atualizados).'; return; }
const E = PBIEngine.createEngine(D, CFG);
const F = E.F;
$('#loading').remove();

/* ---------- opções dos slicers ---------- */
const uniq = a => [...new Set(a)];
function slicerOptions(page, s, state) {
  const vf = s.visualFilters || [];
  const pass = (obj, fmap) => vf.every(f => { const v = obj[fmap[f.col]]; if (fmap[f.col] === undefined) return true; const has = f.values.some(x => x === v || (x === null && v == null)); return f.op === 'in' ? has : !has; });
  const pagePass = (obj, fmap) => (page.filters || []).every(f => { if (fmap[f.col] === undefined) return true; const v = obj[fmap[f.col]]; const has = f.values.some(x => x === v || (x === null && v == null)); return f.op === 'in' ? has : !has; });
  const ccMap = { 'CC DR': 'ccdr', 'Tipo CC': 'tipo', 'Regional': 'reg' };
  const kMap = { 'Grupo': 'grupo', 'Conta': 'conta', 'Descrição': 'desc', 'Tipo Conta 2': 'tc2' };
  switch (s.key) {
    case 'ano': return s.values;
    case 'mes': return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    case 'indicador': return ['Custos/Despesas', 'Margem Bruta', 'Receita/Medições'];
    case 'tipo': return s.values;
    case 'etapa': return E.etapasDisponiveis();
    case 'tipoCC': case 'regional': case 'ccdr': {
      const fld = { tipoCC: 'tipo', regional: 'reg', ccdr: 'ccdr' }[s.key];
      const rows = E.CC.slice(0, -1).filter(c => pass(c, ccMap) && pagePass(c, ccMap)
        && (s.key === 'tipoCC' || !state.tipoCC.length || state.tipoCC.includes(c.tipo))
        && (s.key !== 'ccdr' || !state.regional.length || state.regional.includes(c.reg)));
      return uniq(rows.map(c => c[fld])).filter(v => v !== null && v !== undefined && v !== '').sort(E.cmpText);
    }
    case 'tc2': case 'desc': {
      const fld = { tc2: 'tc2', desc: 'desc' }[s.key];
      const rows = E.K.filter(k => pass(k, kMap) && pagePass(k, kMap) && (s.key !== 'desc' || !state.tc2.length || state.tc2.includes(k.tc2)));
      return uniq(rows.map(k => k[fld])).filter(v => v !== null && v !== undefined && v !== '').sort(E.cmpText);
    }
  }
  return [];
}
const optLabel = (key, v) => key === 'mes' ? E.MESES[v - 1] : String(v);

/* ---------- estado ---------- */
const KEYS = ['ano', 'mes', 'tipoCC', 'regional', 'ccdr', 'indicador', 'tipo', 'etapa', 'tc2', 'desc'];
const states = {};
function defaultState(page) { const st = {}; for (const k of KEYS) st[k] = []; Object.assign(st, JSON.parse(JSON.stringify(page.defaults || {}))); return st; }
for (const p of CFG.pages) states[p.id] = defaultState(p);

/* ---------- componentes de slicer ---------- */
let openDrop = null;
document.addEventListener('click', e => { if (openDrop && !openDrop.contains(e.target)) { openDrop.classList.remove('open'); openDrop = null; } });
function pills(page, s, st) {
  const opts = slicerOptions(page, s, st);
  return h('div', { class: 'slicer' }, h('div', { class: 'slicer-label' }, s.label),
    h('div', { class: 'pills' }, opts.map(v => h('button', {
      class: 'pill' + (st[s.key].includes(v) ? ' on' : ''), type: 'button', title: 'Clique para selecionar; Ctrl+clique para seleção múltipla',
      onclick: ev => {
        const cur = st[s.key];
        if (ev.ctrlKey || ev.metaKey) st[s.key] = cur.includes(v) ? cur.filter(x => x !== v) : cur.concat([v]);
        else st[s.key] = (cur.length === 1 && cur[0] === v) ? [] : [v];
        render();
      }
    }, optLabel(s.key, v)))));
}
function dropdown(page, s, st) {
  const opts = slicerOptions(page, s, st);
  const sel = st[s.key];
  const txt = !sel.length ? 'Todos' : sel.length === 1 ? optLabel(s.key, sel[0]) : 'Várias seleções';
  const wrap = h('div', { class: 'slicer dd' });
  const panel = h('div', { class: 'dd-panel' });
  const list = h('div', { class: 'dd-list' });
  const draw = (q = '') => {
    list.innerHTML = '';
    list.append(h('label', { class: 'dd-item all' }, h('input', { type: 'checkbox', ...(sel.length ? {} : { checked: '' }), onchange: () => { st[s.key] = []; render(); } }), 'Selecionar tudo'));
    for (const v of opts) {
      const lbl = optLabel(s.key, v); if (q && !lbl.toLowerCase().includes(q.toLowerCase())) continue;
      list.append(h('label', { class: 'dd-item' }, h('input', { type: 'checkbox', ...(sel.includes(v) ? { checked: '' } : {}), onchange: ev => { st[s.key] = ev.target.checked ? sel.concat([v]) : sel.filter(x => x !== v); render(); } }), lbl));
    }
  };
  if (opts.length > 12) panel.append(h('input', { class: 'dd-search', type: 'search', placeholder: 'Pesquisar', oninput: ev => draw(ev.target.value) }));
  panel.append(list); draw();
  wrap.append(h('div', { class: 'slicer-label' }, s.label),
    h('button', { class: 'dd-btn' + (sel.length ? ' active' : ''), type: 'button', onclick: ev => { ev.stopPropagation(); const o = wrap.classList.toggle('open'); if (openDrop && openDrop !== wrap) openDrop.classList.remove('open'); openDrop = o ? wrap : null; } }, h('span', {}, txt), h('span', { class: 'caret' }, '▾')),
    panel);
  return wrap;
}

/* ---------- visuais ---------- */
function shadowVisual(cssName, out, extraClass) {
  const host = h('div', { class: 'visual html-visual ' + (extraClass || '') });
  const root = host.attachShadow({ mode: 'open' });
  let css = CSS[cssName] || '';
  for (const [k, v] of Object.entries(out.cssVars || {})) css = css.split('" & ' + k + ' & "').join(v).split(k).join(v);
  root.innerHTML = `<style>:host{display:block}*{box-sizing:border-box}${css}</style>` + out.html;
  return host;
}
const VIS = {
  tabelaGerencial: C => shadowVisual('HTML Tabela Gerencial', E.tabelaGerencial(C)),
  cardsIndicador: C => shadowVisual('HTML Cards Indicador Gerencial', E.cardsIndicador(C)),
  tabelaMensal: C => shadowVisual('HTML Tabela Mensal Indicador', E.tabelaMensal(C)),
  cardsCC: C => shadowVisual('HTML Cards Indicador por CC DR', E.cardsCC(C)),
  tabelaCC: C => shadowVisual('HTML Tabela Dinamica CC DR', E.tabelaCC(C)),
  pareto: C => shadowVisual('HTML Tabela Pareto', E.pareto(C)),
  etapaRegional: C => shadowVisual('HTML Tabela Previsao por Etapa', E.etapa(C, 'regional')),
  etapaCC: C => shadowVisual('HTML Tabela Previsao por Etapa CC DR', E.etapa(C, 'cc')),
  paretoChart: C => paretoChart(E.paretoGrupo(C)),
  notas: C => notasTable(E.notas(C)),
  matrizConta: C => matriz(C, 'conta'),
  matrizCC: C => matriz(C, 'cc'),
};

function paretoChart(items) {
  const box = h('div', { class: 'visual card-visual' }, h('div', { class: 'v-title' }, 'Pareto Grupo Contábil'));
  if (!items.length) { box.append(h('div', { class: 'empty' }, 'Sem dados no contexto atual.')); return box; }
  const W = 860, H = 340, L = 70, R = 50, T = 20, B = 92;
  const max = Math.max(...items.map(i => i.val)) || 1;
  const bw = (W - L - R) / items.length;
  const y = v => T + (H - T - B) * (1 - v / max), y2 = p => T + (H - T - B) * (1 - Math.min(1.2, p || 0) / 1.2);
  const short = v => { const a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toFixed(1).replace('.', ',') + ' Mi' : a >= 1e3 ? (v / 1e3).toFixed(0) + ' Mil' : v.toFixed(0); };
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="pchart" role="img" aria-label="Pareto por grupo contábil">`;
  for (let i = 0; i <= 4; i++) { const v = max * i / 4, yy = y(v); svg += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" class="grid"/><text x="${L - 6}" y="${yy + 4}" class="ax" text-anchor="end">${short(v)}</text>`; }
  for (let i = 0; i <= 4; i++) { const p = 1.2 * i / 4; svg += `<text x="${W - R + 6}" y="${y2(p) + 4}" class="ax">${Math.round(p * 100)}%</text>`; }
  let pts = '';
  items.forEach((it, i) => {
    const x = L + i * bw, bh = (H - T - B) - (y(it.val) - T);
    svg += `<rect x="${x + bw * 0.15}" y="${y(it.val)}" width="${bw * 0.7}" height="${Math.max(0, bh)}" class="bar"><title>${it.key}\nPareto Valor: ${F.cur3(it.val)}\nPareto % Acumulado: ${it.acum == null ? '-' : F.pct2(it.acum)}</title></rect>`;
    const cx = x + bw / 2; pts += `${cx},${y2(it.acum)} `;
    const lbl = String(it.key).length > 16 ? String(it.key).slice(0, 15) + '…' : it.key;
    svg += `<text transform="translate(${cx},${H - B + 12}) rotate(-35)" class="ax cat" text-anchor="end">${lbl}</text>`;
  });
  svg += `<polyline points="${pts}" class="line"/>`;
  items.forEach((it, i) => { svg += `<circle cx="${L + i * bw + bw / 2}" cy="${y2(it.acum)}" r="3.5" class="dot"><title>${it.key}: ${it.acum == null ? '-' : F.pct2(it.acum)}</title></circle>`; });
  svg += `</svg>`;
  const legend = h('div', { class: 'legend' }, h('span', { class: 'lg bar' }), 'Pareto Valor', h('span', { class: 'lg line' }), 'Pareto % Acumulado');
  const c = h('div', { class: 'chart-wrap' }); c.innerHTML = svg;
  box.append(legend, c);
  return box;
}

function notasTable({ rows, total }) {
  const box = h('div', { class: 'visual card-visual' }, h('div', { class: 'v-title' }, 'Tabela de Notas Emitidas'));
  const wrap = h('div', { class: 'tbl-wrap' });
  const tbl = h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, 'CC DR'), h('th', {}, 'Nome do Mês'), h('th', {}, 'HISTORICO'), h('th', { class: 'r' }, 'Soma de Valor'))));
  const tb = h('tbody'); tbl.append(tb);
  let shown = 0; const STEP = 400;
  const more = h('button', { class: 'more', type: 'button', onclick: () => draw() });
  function draw() {
    for (const r of rows.slice(shown, shown + STEP)) tb.append(h('tr', {}, h('td', {}, r.cc ?? ''), h('td', {}, r.mes ?? ''), h('td', { class: 'hist' }, r.h ?? ''), h('td', { class: 'r' + (r.v < 0 ? ' neg' : '') }, F.cur(r.v))));
    shown = Math.min(rows.length, shown + STEP);
    more.textContent = `Mostrar mais (${shown.toLocaleString('pt-BR')} de ${rows.length.toLocaleString('pt-BR')})`;
    more.style.display = shown < rows.length ? '' : 'none';
  }
  draw();
  tbl.append(h('tfoot', {}, h('tr', {}, h('td', {}, 'Total'), h('td'), h('td'), h('td', { class: 'r' }, total == null ? '' : F.cur(total)))));
  wrap.append(tbl);
  box.append(wrap, more);
  return box;
}

function matriz(C, by) {
  const { A, M, K } = E.matriz(C, by);
  const box = h('div', { class: 'visual card-visual' });
  const val = (keys, mo) => { const list = []; for (const k of keys) for (const m of (mo ? [mo] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])) { const t = A.get(k + '|' + m); if (t) list.push(t); } if (!list.length) return null; const T = new Float64Array(24); for (const t of list) for (let j = 0; j < 24; j++) T[j] += t[j]; return M(T).rTot; };
  const keysAll = uniq([...A.keys()].map(s => s.split('|')[0]));
  const meses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(m => keysAll.some(k => A.has(k + '|' + m)) && val(keysAll, m) !== null);
  const cell = v => h('td', { class: 'r' + (v != null && v < 0 ? ' neg' : '') }, v == null ? '' : F.cur(v).replace('R$ ', 'R$ '));
  const tbl = h('table', { class: 'tbl matrix' });
  tbl.append(h('thead', {}, h('tr', {}, h('th', {}, by === 'cc' ? 'CC DR' : 'Grupo'), meses.map(m => h('th', { class: 'r' }, String(m))), h('th', { class: 'r' }, 'Total'))));
  const tb = h('tbody'); tbl.append(tb);
  const row = (label, keys, level, hasKids, onToggle) => {
    const vals = meses.map(m => val(keys, m)), tot = val(keys);
    if (tot === null && vals.every(v => v === null)) return null;
    const tr = h('tr', { class: 'lvl' + level }, h('td', { style: `padding-left:${8 + level * 18}px` }, hasKids ? h('button', { class: 'tog', type: 'button', onclick: onToggle }, '+') : null, label), vals.map(cell), cell(tot));
    return tr;
  };
  if (by === 'cc') {
    for (const k of keysAll.slice().sort((a, b) => E.cmpText(a === '∅' ? '' : a, b === '∅' ? '' : b))) { const r = row(k === '∅' ? '(Em branco)' : k, [k], 0, false); if (r) tb.append(r); }
  } else {
    const ks = keysAll.map(Number);
    const grupos = uniq(ks.map(k => K[k].grupo)).sort(E.cmpText);
    for (const g of grupos) {
      const gk = ks.filter(k => K[k].grupo === g);
      const kids = [];
      const gr = row(g ?? '(Em branco)', gk, 0, true, ev => { const open = ev.target.textContent === '+'; ev.target.textContent = open ? '−' : '+'; kids.forEach(k => { k.tr.hidden = !open; if (!open) k.hide(); }); });
      if (!gr) continue; tb.append(gr);
      for (const d of uniq(gk.map(k => K[k].desc)).sort(E.cmpText)) {
        const dk = gk.filter(k => K[k].desc === d); const sub = [];
        const dr = row(d ?? '(Em branco)', dk, 1, true, ev => { const open = ev.target.textContent === '+'; ev.target.textContent = open ? '−' : '+'; sub.forEach(s => s.hidden = !open); });
        if (!dr) continue; dr.hidden = true; tb.append(dr);
        kids.push({ tr: dr, hide: () => { sub.forEach(s => s.hidden = true); const b = dr.querySelector('.tog'); if (b) b.textContent = '+'; } });
        for (const k of dk.sort((a, b) => E.cmpText(K[a].conta, K[b].conta))) { const cr = row(K[k].conta, [k], 2, false); if (cr) { cr.hidden = true; tb.append(cr); sub.push(cr); } }
      }
    }
  }
  const tf = h('tfoot', {}, h('tr', {}, h('td', {}, 'Total'), meses.map(m => cell(val(keysAll, m))), cell(val(keysAll))));
  tbl.append(tf);
  box.append(h('div', { class: 'tbl-wrap' }, tbl));
  return box;
}

/* ---------- navegação e renderização ---------- */
let current = 'capa';
const nav = $('#nav');
for (const p of CFG.pages) nav.append(h('button', { class: 'nav-item', 'data-id': p.id, type: 'button', onclick: () => go(p.id) }, h('img', { src: CFG.icons[p.icon], alt: '' }), h('span', {}, p.title)));
$('#btn-limpar').addEventListener('click', () => { const p = CFG.pages.find(x => x.id === current); if (p) { states[p.id] = defaultState(p); render(); } });
$('#btn-acessar').addEventListener('click', () => go(CFG.pages[0].id));
$('#brand').addEventListener('click', () => go('capa'));
function go(id) { current = id; try { history.replaceState(null, '', '#' + id); } catch (e) {} render(); window.scrollTo(0, 0); }

function render() {
  document.body.classList.toggle('on-capa', current === 'capa');
  for (const b of nav.children) b.classList.toggle('active', b.dataset.id === current);
  if (current === 'capa') return;
  const page = CFG.pages.find(p => p.id === current), st = states[page.id];
  $('#page-title').textContent = page.title;
  const bar = $('#filters'); bar.innerHTML = '';
  for (const s of page.slicers) bar.append(s.mode === 'pills' ? pills(page, s, st) : dropdown(page, s, st));
  const grid = $('#grid'); grid.innerHTML = '';
  const C = E.ctx(st, page);
  for (const row of page.layout) {
    const r = h('div', { class: 'grid-row', style: `grid-template-columns:${row.cols}` });
    for (const v of row.visuals) {
      let el;
      try { el = VIS[v](C); } catch (err) { console.error(err); el = h('div', { class: 'visual card-visual error' }, 'Erro ao calcular visual: ' + err.message); }
      r.append(el);
    }
    grid.append(r);
  }
  fit();
}
/* Ajusta a área de visuais à largura da janela, como o "Ajustar à página" do Power BI (página desenhada a 1860 px). */
const DESIGN_W = 1860;
function fit() {
  const g = $('#grid'); if (!g) return;
  g.style.zoom = ''; g.style.width = '';
  if (window.innerWidth < 900) return;
  const avail = g.parentElement.clientWidth;
  if (avail >= DESIGN_W) return;
  g.style.width = DESIGN_W + 'px'; g.style.zoom = String(avail / DESIGN_W);
}
let rT; window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(fit, 120); });
const start = (location.hash || '').slice(1);
go(CFG.pages.some(p => p.id === start) ? start : 'capa');
})();
