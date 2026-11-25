import React, { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { read, utils } from 'xlsx';
import { AlertTriangle, CheckCircle2, Database, FileSpreadsheet, Loader2, Lock, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { app, auth, db, storage } from '../../../../services/firebaseConfig';
import { useAuth } from '../../../../contexts/AuthContext';
import { PortalTopBar } from '../../../pages/CentroInteligencia/PortalTopBar';
import { LeituraRazao, lerRazaoProtheus } from '../lib/razaoProtheus';
import { abaDoPlano, DivergenciaMesError, LeituraPlano, lerPlanilhaPlano, TIPOS_FORECAST } from '../lib/budgetForecast';
import { LeituraDimensoes, lerDimensoes } from '../lib/dimensoes';
import { abaDosGerenciais, LeituraGerenciais, lerValoresGerenciais } from '../lib/valoresGerenciais';
import { Linhas } from '../lib/planilha';

type Fonte = 'razao' | 'budget' | 'forecast' | 'gerenciais' | 'dimensoes';

const FONTES: { id: Fonte; label: string; arquivo: string; regra: string }[] = [
  { id: 'razao', label: 'Razão contábil', arquivo: 'o razão exportado do Protheus', regra: 'Substitui só as competências e filiais do arquivo.' },
  { id: 'budget', label: 'Budget', arquivo: 'a planilha de Budget do ano', regra: 'Cada envio é uma versão do ano; reenviar com o mesmo nome substitui aquela versão.' },
  { id: 'forecast', label: 'Forecast', arquivo: 'a planilha de Forecast do ano', regra: 'Cada envio vira uma nova revisão do tipo escolhido (3+9, 6+6...).' },
  { id: 'gerenciais', label: 'Valores gerenciais', arquivo: 'a planilha de valores fora do TOTVS', regra: 'Substitui só as competências do arquivo.' },
  { id: 'dimensoes', label: 'Dimensões', arquivo: 'a Planilha Dimensão (centros de custo e contas)', regra: 'Substitui as duas dimensões inteiras.' },
];

type Leitura =
  | { fonte: 'razao'; dados: LeituraRazao }
  | { fonte: 'budget' | 'forecast'; dados: LeituraPlano }
  | { fonte: 'gerenciais'; dados: LeituraGerenciais }
  | { fonte: 'dimensoes'; dados: LeituraDimensoes };

interface CargaDoc {
  id: string;
  tipo: string;
  arquivo: string;
  enviadoPor: string;
  iniciadoEm: string;
  status: 'processando' | 'concluida' | 'erro';
  erro?: string;
  resumo?: {
    lancamentos?: number; linhas?: number; centros?: number; contas?: number;
    competencias?: string[]; nomeVersao?: string; ano?: number; totalAvisos?: number;
  };
}

interface VersaoDoc {
  versaoId: string;
  tipo: 'budget' | 'forecast';
  ano: number;
  nome: string;
  tipoForecast: string | null;
  revisao: number;
  vigente: boolean;
  arquivo: string;
  criadoEm: string;
  criadoPor: string;
  linhas: number;
  total: number;
}

const FILIAIS: Record<string, string> = { '0101': 'Construtora', '0201': 'Rental' };
const ROTULO_TIPO: Record<string, string> = { razao: 'Razão', budget: 'Budget', forecast: 'Forecast', gerenciais: 'Gerenciais', dimensoes: 'Dimensões' };
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const int = (n: number) => n.toLocaleString('pt-BR');
const competenciaBr = (c: string) => `${c.slice(5, 7)}/${c.slice(0, 4)}`;
const dataBr = (d: string) => d.split('-').reverse().join('/');
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type Etapa = 'escolher' | 'lendo' | 'conferir' | 'recusado' | 'enviando' | 'processando';

const lerAbas = async (file: File): Promise<Record<string, Linhas>> => {
  const wb = read(await file.arrayBuffer(), { dense: true });
  return Object.fromEntries(wb.SheetNames.map(n => [n, utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: null, blankrows: true })]));
};

const lerArquivo = async (fonte: Fonte, file: File): Promise<Leitura> => {
  const abas = await lerAbas(file);
  if (fonte === 'razao') {
    const dados = lerRazaoProtheus(Object.values(abas)[0] ?? []);
    if (dados.lancamentos.length === 0) throw new Error('Nenhum lançamento encontrado no arquivo.');
    return { fonte, dados };
  }
  if (fonte === 'budget' || fonte === 'forecast') {
    const aba = abaDoPlano(abas);
    if (!aba) throw new Error('Nenhuma aba com as colunas Mês, CC DR, Conta, Valor e Ano.');
    return { fonte, dados: lerPlanilhaPlano(abas[aba]) };
  }
  if (fonte === 'gerenciais') {
    const aba = abaDosGerenciais(abas);
    if (!aba) throw new Error('Nenhuma aba com as colunas CUSTO, CONTA, DATA, HISTORICO, DEBITO e CREDITO.');
    return { fonte, dados: lerValoresGerenciais(abas[aba]) };
  }
  return { fonte, dados: lerDimensoes(abas) };
};

const Indicadores: React.FC<{ itens: [string, string][] }> = ({ itens }) => (
  <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-4">
    {itens.map(([label, value]) => (
      <div key={label} className="bg-white px-3 py-2">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="truncate text-sm font-medium text-slate-900" title={value}>{value}</div>
      </div>
    ))}
  </div>
);

const Tabela: React.FC<{ cabecalho: string[]; direita?: number[]; linhas: (string | number)[][] }> = ({ cabecalho, direita = [], linhas }) => (
  <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
    <table className="w-full text-left text-[13px]">
      <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
        <tr>{cabecalho.map((c, i) => <th key={c} className={`px-3 py-2 font-medium ${direita.includes(i) ? 'text-right' : ''}`}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {linhas.map((l, j) => (
          <tr key={j} className="border-t border-slate-100">
            {l.map((v, i) => <td key={i} className={`px-3 py-1.5 ${direita.includes(i) ? 'text-right tabular-nums' : ''}`}>{v}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Avisos: React.FC<{ avisos: string[] }> = ({ avisos }) => avisos.length === 0 ? null : (
  <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
    <summary className="cursor-pointer font-medium">{avisos.length} aviso(s) — linhas ignoradas ou incompletas</summary>
    <ul className="mt-2 list-disc space-y-0.5 pl-5">{avisos.slice(0, 50).map((a, i) => <li key={i}>{a}</li>)}</ul>
  </details>
);

/** Prévia do que vai ser gravado, por fonte. */
const Previa: React.FC<{ leitura: Leitura; arquivo: File }> = ({ leitura, arquivo }) => {
  if (leitura.fonte === 'razao') {
    const d = leitura.dados;
    const mapa = new Map<string, { competencia: string; filial: string; n: number; debito: number; credito: number }>();
    for (const l of d.lancamentos) {
      const k = `${l.competencia}|${l.filial}`;
      const it = mapa.get(k) ?? { competencia: l.competencia, filial: l.filial, n: 0, debito: 0, credito: 0 };
      it.n++; it.debito += l.debito; it.credito += l.credito;
      mapa.set(k, it);
    }
    const grupos = [...mapa.values()].sort((a, b) => a.competencia.localeCompare(b.competencia) || a.filial.localeCompare(b.filial));
    return (
      <>
        <Indicadores itens={[['Arquivo', arquivo.name], ['Lançamentos', int(d.lancamentos.length)], ['Continuações juntadas', int(d.linhasContinuacao)], ['Avisos', int(d.avisos.length)]]} />
        <Tabela cabecalho={['Competência', 'Filial', 'Lançamentos', 'Débito', 'Crédito']} direita={[2, 3, 4]}
          linhas={grupos.map(g => [competenciaBr(g.competencia), `${g.filial} · ${FILIAIS[g.filial] ?? '—'}`, int(g.n), brl(g.debito), brl(g.credito)])} />
        <Avisos avisos={d.avisos} />
      </>
    );
  }
  if (leitura.fonte === 'budget' || leitura.fonte === 'forecast') {
    const d = leitura.dados;
    return (
      <>
        <Indicadores itens={[['Arquivo', arquivo.name], ['Ano', String(d.ano)], ['Linhas', int(d.linhas.length)], ['Total do ano', brl(d.total)]]} />
        <Tabela cabecalho={['Competência', 'Valor']} direita={[1]}
          linhas={Object.entries(d.porMes).sort(([a], [b]) => a.localeCompare(b)).map(([c, v]) => [competenciaBr(c), brl(v)])} />
        <Avisos avisos={d.avisos} />
      </>
    );
  }
  if (leitura.fonte === 'gerenciais') {
    const d = leitura.dados;
    const mapa = new Map<string, { n: number; valor: number }>();
    for (const l of d.lancamentos) {
      const it = mapa.get(l.competencia) ?? { n: 0, valor: 0 };
      it.n++; it.valor += l.credito - l.debito;
      mapa.set(l.competencia, it);
    }
    return (
      <>
        <Indicadores itens={[['Arquivo', arquivo.name], ['Lançamentos', int(d.lancamentos.length)], ['Competências', String(d.competencias.length)], ['Avisos', int(d.avisos.length)]]} />
        <Tabela cabecalho={['Competência', 'Lançamentos', 'Valor (crédito − débito)']} direita={[1, 2]}
          linhas={[...mapa.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([c, v]) => [competenciaBr(c), int(v.n), brl(v.valor)])} />
        <Avisos avisos={d.avisos} />
      </>
    );
  }
  if (leitura.fonte !== 'dimensoes') return null;
  const d = leitura.dados;
  const porTipo = new Map<string, number>();
  for (const c of d.contas) porTipo.set(c.tipoConta || '(vazio)', (porTipo.get(c.tipoConta || '(vazio)') ?? 0) + 1);
  const porRegional = new Map<string, number>();
  for (const c of d.centros) porRegional.set(c.regional || '(vazio)', (porRegional.get(c.regional || '(vazio)') ?? 0) + 1);
  return (
    <>
      <Indicadores itens={[['Arquivo', arquivo.name], ['Centros de custo', int(d.centros.length)], ['Contas', int(d.contas.length)], ['Avisos', int(d.avisos.length)]]} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Tabela cabecalho={['Regional', 'Centros de custo']} direita={[1]} linhas={[...porRegional.entries()].sort().map(([k, v]) => [k, int(v)])} />
        <Tabela cabecalho={['Tipo de conta', 'Contas']} direita={[1]} linhas={[...porTipo.entries()].sort().map(([k, v]) => [k, int(v)])} />
      </div>
      <Avisos avisos={d.avisos} />
    </>
  );
};

const textoSubstituicao = (leitura: Leitura): React.ReactNode => {
  if (leitura.fonte === 'razao') {
    return <>Os lançamentos de <strong>{leitura.dados.competencias.map(competenciaBr).join(', ')}</strong> das filiais{' '}
      <strong>{leitura.dados.filiais.map(f => `${f} (${FILIAIS[f] ?? '?'})`).join(', ')}</strong> que já estiverem no lakehouse
      serão substituídos por este arquivo. Outros meses e filiais não mudam.</>;
  }
  if (leitura.fonte === 'gerenciais') {
    return <>Os valores gerenciais de <strong>{leitura.dados.competencias.map(competenciaBr).join(', ')}</strong> serão substituídos por este arquivo. Outros meses não mudam.</>;
  }
  if (leitura.fonte === 'dimensoes') return <>As dimensões de centros de custo e de contas serão substituídas inteiras por este arquivo.</>;
  return null;
};

export const CargasFinanceirasPage: React.FC = () => {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.isSuperAdmin === true;
  const [fonte, setFonte] = useState<Fonte>('razao');
  const [etapa, setEtapa] = useState<Etapa>('escolher');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [recusa, setRecusa] = useState<DivergenciaMesError | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [cargas, setCargas] = useState<CargaDoc[]>([]);
  const [versoes, setVersoes] = useState<VersaoDoc[]>([]);
  const [nomeBudget, setNomeBudget] = useState('');
  const [tipoForecast, setTipoForecast] = useState('');
  const [vigente, setVigente] = useState(true);
  const [trocandoVigente, setTrocandoVigente] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const q = query(collection(db, 'fin_cargas'), orderBy('iniciadoEm', 'desc'), limit(20));
    return onSnapshot(q,
      snap => setCargas(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<CargaDoc, 'id'>) }))),
      err => console.error('[financeiro] histórico de cargas', err));
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    return onSnapshot(collection(db, 'fin_versoes'),
      snap => setVersoes(snap.docs.map(d => d.data() as VersaoDoc)),
      err => console.error('[financeiro] versões', err));
  }, [isSuperAdmin]);

  const config = FONTES.find(f => f.id === fonte)!;
  const ehPlano = fonte === 'budget' || fonte === 'forecast';
  const anoDoArquivo = leitura && (leitura.fonte === 'budget' || leitura.fonte === 'forecast') ? leitura.dados.ano : null;

  const versoesDoAno = useMemo(
    () => versoes.filter(v => v.tipo === fonte && v.ano === anoDoArquivo),
    [versoes, fonte, anoDoArquivo]);
  const proximaRevisao = 1 + Math.max(0, ...versoesDoAno.filter(v => v.tipoForecast === tipoForecast).map(v => v.revisao));
  const budgetExistente = fonte === 'budget' && nomeBudget.trim()
    ? versoesDoAno.find(v => v.versaoId === `budget-${anoDoArquivo}-${slug(nomeBudget)}`) : undefined;
  const primeiraDoAno = versoesDoAno.length === 0;
  const versaoValida = fonte === 'budget' ? nomeBudget.trim().length > 0 && nomeBudget.trim().length <= 40
    : fonte === 'forecast' ? TIPOS_FORECAST.includes(tipoForecast) : true;

  const reiniciar = () => {
    setEtapa('escolher'); setArquivo(null); setLeitura(null); setRecusa(null); setProgresso(0);
    setNomeBudget(''); setTipoForecast(''); setVigente(true);
  };

  const trocarFonte = (f: Fonte) => { if (etapa === 'enviando' || etapa === 'processando') return; setFonte(f); reiniciar(); };

  const escolher = async (file: File | undefined) => {
    if (!file) return;
    setArquivo(file);
    setEtapa('lendo');
    try {
      setLeitura(await lerArquivo(fonte, file));
      setEtapa('conferir');
    } catch (err) {
      if (err instanceof DivergenciaMesError) { setRecusa(err); setEtapa('recusado'); return; }
      toast.error(err instanceof Error ? err.message : 'Não foi possível ler o arquivo.');
      reiniciar();
    }
  };

  const enviar = async () => {
    if (!arquivo || !leitura || !versaoValida) return;
    const cargaId = `${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
    const path = `fin-cargas/${fonte}/${cargaId}/${arquivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\- ()]/g, '_')}`;
    setEtapa('enviando');
    try {
      // Libera o envio no Storage (claim finCarga) e renova o token para a regra enxergar a claim.
      const funcoes = getFunctions(app, 'us-central1');
      const { data: autorizacao } = await httpsCallable<void, { alterado: boolean }>(funcoes, 'finAutorizarCarga')();
      const token = await auth.currentUser?.getIdTokenResult(autorizacao.alterado);
      if (token?.claims.finCarga !== true) await auth.currentUser?.getIdToken(true);

      await new Promise<void>((resolve, reject) => {
        const task = uploadBytesResumable(ref(storage, path), arquivo, {
          contentType: arquivo.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        task.on('state_changed', s => setProgresso(Math.round((s.bytesTransferred / s.totalBytes) * 100)), reject, () => resolve());
      });
      setEtapa('processando');

      if (fonte === 'razao') {
        const carregar = httpsCallable<{ path: string }, { lancamentos: number; competencias: string[] }>(funcoes, 'finCarregarRazao', { timeout: 560_000 });
        const { data } = await carregar({ path });
        toast.success(`Razão carregado: ${int(data.lancamentos)} lançamentos (${data.competencias.map(competenciaBr).join(', ')}).`);
      } else {
        const carregar = httpsCallable<Record<string, unknown>, Record<string, unknown>>(funcoes, 'finCarregarPlanilha', { timeout: 560_000 });
        const { data } = await carregar({
          tipo: fonte, path, arquivoOriginal: arquivo.name, vigente,
          ...(fonte === 'budget' ? { nome: nomeBudget.trim() } : {}),
          ...(fonte === 'forecast' ? { tipoForecast } : {}),
        });
        toast.success(ehPlano
          ? `${config.label} ${data.ano} — versão "${data.nomeVersao}" carregada${data.vigente ? ' e marcada como vigente' : ''}.`
          : `${config.label} carregado(s) no lakehouse.`);
      }
      reiniciar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar o arquivo.');
      setEtapa('conferir');
    }
  };

  const tornarVigente = async (v: VersaoDoc) => {
    setTrocandoVigente(v.versaoId);
    try {
      await httpsCallable<{ versaoId: string }, unknown>(getFunctions(app, 'us-central1'), 'finDefinirVigente')({ versaoId: v.versaoId });
      toast.success(`${ROTULO_TIPO[v.tipo]} ${v.ano}: "${v.nome}" agora é a versão vigente.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível trocar a versão vigente.');
    } finally {
      setTrocandoVigente(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f3f5f9]">
        <PortalTopBar />
        <div className="m-auto flex flex-col items-center gap-2 text-slate-500">
          <Lock className="h-8 w-8" />
          <p className="text-sm">Somente o administrador envia cargas financeiras.</p>
        </div>
      </div>
    );
  }

  const ocupado = etapa === 'lendo' || etapa === 'enviando' || etapa === 'processando';
  const versoesOrdenadas = [...versoes].sort((a, b) =>
    b.ano - a.ano || a.tipo.localeCompare(b.tipo) || b.criadoEm.localeCompare(a.criadoEm));

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f5f9]">
      <PortalTopBar />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-5 lg:p-8">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cargas financeiras</h1>
          <p className="mt-0.5 text-sm text-slate-500">Alimenta o lakehouse financeiro (BigQuery). Cada arquivo é conferido aqui antes de ser enviado.</p>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1" role="tablist">
            {FONTES.map(f => (
              <button key={f.id} type="button" role="tab" aria-selected={fonte === f.id} onClick={() => trocarFonte(f.id)}
                disabled={etapa === 'enviando' || etapa === 'processando'}
                className={`rounded-md px-3 py-1.5 text-sm transition ${fonte === f.id ? 'bg-white font-medium text-[#0b1d4f] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="mb-4 flex items-start gap-2">
            <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-[#0b1d4f]" strokeWidth={1.75} />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{config.label}</h2>
              <p className="text-xs text-slate-500">{config.regra}</p>
            </div>
          </div>

          {etapa === 'escolher' && (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 px-6 py-10 text-center transition hover:border-[#0b1d4f] hover:bg-slate-50">
              <input type="file" accept=".xlsx,.xls,.xlsm" className="sr-only" onChange={e => { escolher(e.target.files?.[0]); e.target.value = ''; }} />
              <Upload className="mb-2 h-5 w-5 text-[#0b1d4f]" />
              <span className="text-sm font-medium text-slate-900">Selecione {config.arquivo} (.xlsx)</span>
              <span className="mt-1 text-xs text-slate-500">O arquivo é conferido aqui antes de ser enviado.</span>
            </label>
          )}

          {ocupado && (
            <div className="flex items-center gap-3 py-6 text-sm text-slate-600" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-[#0b1d4f]" />
              {etapa === 'lendo' && 'Lendo e conferindo o arquivo…'}
              {etapa === 'enviando' && `Enviando arquivo… ${progresso}%`}
              {etapa === 'processando' && 'Gravando no lakehouse… (pode levar alguns minutos)'}
            </div>
          )}

          {etapa === 'recusado' && recusa && arquivo && (
            <div className="space-y-3">
              <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Arquivo recusado: {int(recusa.total)} linha(s) com o nome do mês diferente da data.</p>
                  <p className="mt-0.5 text-xs">
                    Em <strong>{arquivo.name}</strong>, a coluna "Mês" não bate com a data da coluna "Ano" nessas linhas.
                    Corrija a planilha e envie de novo. {recusa.total > recusa.exemplos.length && `Abaixo, as ${recusa.exemplos.length} primeiras.`}
                  </p>
                </div>
              </div>
              <Tabela cabecalho={['Linha da planilha', 'Mês informado', 'Data (coluna "Ano")']} direita={[0]}
                linhas={recusa.exemplos.map(e => [e.linha, e.mesInformado, dataBr(e.dataInformada)])} />
              <button type="button" onClick={reiniciar} className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-700 hover:bg-slate-50">
                Escolher outro arquivo
              </button>
            </div>
          )}

          {etapa === 'conferir' && leitura && arquivo && (
            <div className="space-y-4">
              <Previa leitura={leitura} arquivo={arquivo} />

              {ehPlano && anoDoArquivo && (
                <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
                  <legend className="px-1 text-xs font-medium text-slate-700">Versão do {config.label} {anoDoArquivo}</legend>
                  {fonte === 'budget' ? (
                    <label className="block text-sm">
                      <span className="text-xs text-slate-600">Nome da versão</span>
                      <input value={nomeBudget} onChange={e => setNomeBudget(e.target.value)} maxLength={40} placeholder="Ex.: Original, Revisado março"
                        className="mt-1 block h-9 w-full max-w-sm rounded-lg border border-slate-300 px-3 text-sm focus:border-[#0b1d4f] focus:outline-none" />
                      {budgetExistente && (
                        <span className="mt-1 block text-xs text-amber-700">Já existe a versão "{budgetExistente.nome}" de {anoDoArquivo}: ela será substituída por este arquivo.</span>
                      )}
                    </label>
                  ) : (
                    <label className="block text-sm">
                      <span className="text-xs text-slate-600">Tipo (meses realizados + projetados)</span>
                      <select value={tipoForecast} onChange={e => setTipoForecast(e.target.value)}
                        className="mt-1 block h-9 w-40 rounded-lg border border-slate-300 bg-white px-2 text-sm focus:border-[#0b1d4f] focus:outline-none">
                        <option value="">Selecione…</option>
                        {TIPOS_FORECAST.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {tipoForecast && <span className="mt-1 block text-xs text-slate-500">Será gravado como <strong>{tipoForecast} rev. {proximaRevisao}</strong>.</span>}
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={vigente || primeiraDoAno} disabled={primeiraDoAno} onChange={e => setVigente(e.target.checked)} className="h-4 w-4 accent-[#0b1d4f]" />
                    Marcar como versão vigente de {anoDoArquivo}
                    {primeiraDoAno && <span className="text-xs text-slate-500">(primeira versão do ano: entra como vigente)</span>}
                  </label>
                </fieldset>
              )}

              {!ehPlano && <p className="text-xs text-slate-500">Ao confirmar: {textoSubstituicao(leitura)}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={enviar} disabled={!versaoValida}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0b1d4f] px-3.5 text-sm font-medium text-white hover:bg-[#13296b] disabled:cursor-not-allowed disabled:opacity-50">
                  <Database className="h-4 w-4" /> Confirmar e carregar
                </button>
                <button type="button" onClick={reiniciar} className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-700 hover:bg-slate-50">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">Versões de Budget e Forecast</h2>
          {versoesOrdenadas.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhuma versão carregada ainda.</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr><th className="px-5 py-2 font-medium">Ano</th><th className="px-3 py-2 font-medium">Tipo</th><th className="px-3 py-2 font-medium">Versão</th><th className="px-3 py-2 text-right font-medium">Total</th><th className="px-3 py-2 font-medium">Carregada em</th><th className="px-5 py-2 font-medium" /></tr>
              </thead>
              <tbody>
                {versoesOrdenadas.map(v => (
                  <tr key={v.versaoId} className="border-t border-slate-100">
                    <td className="px-5 py-2 tabular-nums">{v.ano}</td>
                    <td className="px-3 py-2">{ROTULO_TIPO[v.tipo]}</td>
                    <td className="px-3 py-2" title={v.arquivo}>{v.nome}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(v.total)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{quando(v.criadoEm)}</td>
                    <td className="px-5 py-2 text-right">
                      {v.vigente ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Vigente</span>
                      ) : (
                        <button type="button" onClick={() => tornarVigente(v)} disabled={trocandoVigente !== null}
                          className="text-xs font-medium text-[#0b1d4f] hover:underline disabled:opacity-50">
                          {trocandoVigente === v.versaoId ? 'Trocando…' : 'Tornar vigente'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">Últimas cargas</h2>
          {cargas.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhuma carga ainda.</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr><th className="px-5 py-2 font-medium">Quando</th><th className="px-3 py-2 font-medium">Fonte</th><th className="px-3 py-2 font-medium">Arquivo</th><th className="px-3 py-2 font-medium">Conteúdo</th><th className="px-5 py-2 font-medium">Situação</th></tr>
              </thead>
              <tbody>
                {cargas.map(c => {
                  const r = c.resumo;
                  const conteudo = !r ? '—'
                    : r.nomeVersao ? `${r.ano} · ${r.nomeVersao} · ${int(r.linhas ?? 0)} linhas`
                    : r.centros !== undefined ? `${int(r.centros)} CCs · ${int(r.contas ?? 0)} contas`
                    : r.competencias?.length ? `${competenciaBr(r.competencias[0])} a ${competenciaBr(r.competencias[r.competencias.length - 1])} · ${int(r.lancamentos ?? 0)} lanç.`
                    : '—';
                  return (
                    <tr key={c.id} className="border-t border-slate-100 align-top">
                      <td className="whitespace-nowrap px-5 py-2">{quando(c.iniciadoEm)}</td>
                      <td className="px-3 py-2">{ROTULO_TIPO[c.tipo] ?? c.tipo}</td>
                      <td className="max-w-[220px] truncate px-3 py-2" title={c.arquivo}>{c.arquivo}</td>
                      <td className="px-3 py-2">{conteudo}</td>
                      <td className="px-5 py-2">
                        {c.status === 'concluida' && <span className="text-emerald-700">Concluída</span>}
                        {c.status === 'processando' && <span className="text-slate-500">Processando…</span>}
                        {c.status === 'erro' && <span className="text-rose-600" title={c.erro}>Erro: {c.erro?.slice(0, 80)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
};
