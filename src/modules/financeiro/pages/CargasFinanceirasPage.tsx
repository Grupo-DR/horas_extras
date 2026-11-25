import React, { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { read, utils } from 'xlsx';
import { Database, FileSpreadsheet, Loader2, Lock, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { app, auth, db, storage } from '../../../../services/firebaseConfig';
import { useAuth } from '../../../../contexts/AuthContext';
import { PortalTopBar } from '../../../pages/CentroInteligencia/PortalTopBar';
import { LeituraRazao, lerRazaoProtheus } from '../lib/razaoProtheus';

interface CargaDoc {
  id: string;
  tipo: string;
  arquivo: string;
  enviadoPor: string;
  iniciadoEm: string;
  status: 'processando' | 'concluida' | 'erro';
  erro?: string;
  resumo?: { lancamentos: number; competencias: string[]; filiais: string[]; totalAvisos: number };
}

const FILIAIS: Record<string, string> = { '0101': 'Construtora', '0201': 'Rental' };
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const competenciaBr = (c: string) => `${c.slice(5, 7)}/${c.slice(0, 4)}`;
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

type Etapa = 'escolher' | 'lendo' | 'conferir' | 'enviando' | 'processando';

/** Resumo por competência × filial, para conferir antes de enviar. */
const resumir = (leitura: LeituraRazao) => {
  const mapa = new Map<string, { competencia: string; filial: string; lancamentos: number; debito: number; credito: number }>();
  for (const l of leitura.lancamentos) {
    const k = `${l.competencia}|${l.filial}`;
    const item = mapa.get(k) ?? { competencia: l.competencia, filial: l.filial, lancamentos: 0, debito: 0, credito: 0 };
    item.lancamentos++;
    item.debito += l.debito;
    item.credito += l.credito;
    mapa.set(k, item);
  }
  return [...mapa.values()].sort((a, b) => a.competencia.localeCompare(b.competencia) || a.filial.localeCompare(b.filial));
};

export const CargasFinanceirasPage: React.FC = () => {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.isSuperAdmin === true;
  const [etapa, setEtapa] = useState<Etapa>('escolher');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [leitura, setLeitura] = useState<LeituraRazao | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [cargas, setCargas] = useState<CargaDoc[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const q = query(collection(db, 'fin_cargas'), orderBy('iniciadoEm', 'desc'), limit(20));
    return onSnapshot(q,
      snap => setCargas(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<CargaDoc, 'id'>) }))),
      err => console.error('[financeiro] histórico de cargas', err));
  }, [isSuperAdmin]);

  const linhas = useMemo(() => (leitura ? resumir(leitura) : []), [leitura]);

  const reiniciar = () => { setEtapa('escolher'); setArquivo(null); setLeitura(null); setProgresso(0); };

  const escolher = async (file: File | undefined) => {
    if (!file) return;
    setArquivo(file);
    setEtapa('lendo');
    try {
      const wb = read(await file.arrayBuffer(), { dense: true });
      const rows = utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, blankrows: true });
      const resultado = lerRazaoProtheus(rows);
      if (resultado.lancamentos.length === 0) throw new Error('Nenhum lançamento encontrado no arquivo.');
      setLeitura(resultado);
      setEtapa('conferir');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível ler o arquivo.');
      reiniciar();
    }
  };

  const enviar = async () => {
    if (!arquivo || !leitura) return;
    const cargaId = `${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
    const path = `fin-cargas/razao/${cargaId}/${arquivo.name.replace(/[^\w.\- ()]/g, '_')}`;
    setEtapa('enviando');
    try {
      // Libera o envio no Storage (claim finCarga) e renova o token para a regra enxergar a claim.
      const autorizar = httpsCallable<void, { alterado: boolean }>(getFunctions(app, 'us-central1'), 'finAutorizarCarga');
      const { data: autorizacao } = await autorizar();
      const token = await auth.currentUser?.getIdTokenResult(autorizacao.alterado);
      if (token?.claims.finCarga !== true) await auth.currentUser?.getIdToken(true);

      await new Promise<void>((resolve, reject) => {
        const task = uploadBytesResumable(ref(storage, path), arquivo, {
          contentType: arquivo.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        task.on('state_changed', s => setProgresso(Math.round((s.bytesTransferred / s.totalBytes) * 100)), reject, () => resolve());
      });
      setEtapa('processando');
      const carregar = httpsCallable<{ path: string }, { lancamentos: number; competencias: string[] }>(
        getFunctions(app, 'us-central1'), 'finCarregarRazao', { timeout: 560_000 });
      const { data } = await carregar({ path });
      toast.success(`Razão carregado: ${data.lancamentos.toLocaleString('pt-BR')} lançamentos (${data.competencias.map(competenciaBr).join(', ')}).`);
      reiniciar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar o razão.');
      setEtapa('conferir');
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

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f5f9]">
      <PortalTopBar />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-5 lg:p-8">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cargas financeiras</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Alimenta o lakehouse financeiro (BigQuery). Cada carga substitui só as competências e filiais do arquivo.
          </p>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[#0b1d4f]" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold text-slate-900">Razão contábil (Protheus)</h2>
          </div>

          {etapa === 'escolher' && (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 px-6 py-10 text-center transition hover:border-[#0b1d4f] hover:bg-slate-50">
              <input type="file" accept=".xlsx,.xls,.xlsm" className="sr-only" onChange={e => { escolher(e.target.files?.[0]); e.target.value = ''; }} />
              <Upload className="mb-2 h-5 w-5 text-[#0b1d4f]" />
              <span className="text-sm font-medium text-slate-900">Selecione o razão exportado do Protheus (.xlsx)</span>
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

          {etapa === 'conferir' && leitura && arquivo && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-4">
                {[
                  ['Arquivo', arquivo.name],
                  ['Lançamentos', leitura.lancamentos.length.toLocaleString('pt-BR')],
                  ['Linhas de continuação juntadas', leitura.linhasContinuacao.toLocaleString('pt-BR')],
                  ['Avisos', leitura.avisos.length.toLocaleString('pt-BR')],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white px-3 py-2">
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="truncate text-sm font-medium text-slate-900" title={value}>{value}</div>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr><th className="px-3 py-2 font-medium">Competência</th><th className="px-3 py-2 font-medium">Filial</th><th className="px-3 py-2 text-right font-medium">Lançamentos</th><th className="px-3 py-2 text-right font-medium">Débito</th><th className="px-3 py-2 text-right font-medium">Crédito</th></tr>
                  </thead>
                  <tbody>
                    {linhas.map(l => (
                      <tr key={`${l.competencia}${l.filial}`} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">{competenciaBr(l.competencia)}</td>
                        <td className="px-3 py-1.5">{l.filial} · {FILIAIS[l.filial] ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{l.lancamentos.toLocaleString('pt-BR')}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{brl(l.debito)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{brl(l.credito)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {leitura.avisos.length > 0 && (
                <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <summary className="cursor-pointer font-medium">{leitura.avisos.length} aviso(s) — lançamentos ignorados ou incompletos</summary>
                  <ul className="mt-2 list-disc space-y-0.5 pl-5">{leitura.avisos.slice(0, 50).map(a => <li key={a}>{a}</li>)}</ul>
                </details>
              )}

              <p className="text-xs text-slate-500">
                Ao confirmar, os lançamentos de <strong>{leitura.competencias.map(competenciaBr).join(', ')}</strong> das filiais{' '}
                <strong>{leitura.filiais.map(f => `${f} (${FILIAIS[f] ?? '?'})`).join(', ')}</strong> que já estiverem no lakehouse
                serão substituídos por este arquivo. Outros meses e filiais não mudam.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={enviar} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0b1d4f] px-3.5 text-sm font-medium text-white hover:bg-[#13296b]">
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
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">Últimas cargas</h2>
          {cargas.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhuma carga ainda.</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr><th className="px-5 py-2 font-medium">Quando</th><th className="px-3 py-2 font-medium">Arquivo</th><th className="px-3 py-2 font-medium">Competências</th><th className="px-3 py-2 text-right font-medium">Lançamentos</th><th className="px-5 py-2 font-medium">Situação</th></tr>
              </thead>
              <tbody>
                {cargas.map(c => (
                  <tr key={c.id} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap px-5 py-2">{quando(c.iniciadoEm)}</td>
                    <td className="max-w-[260px] truncate px-3 py-2" title={c.arquivo}>{c.arquivo}</td>
                    <td className="px-3 py-2">{c.resumo ? `${competenciaBr(c.resumo.competencias[0])} a ${competenciaBr(c.resumo.competencias[c.resumo.competencias.length - 1])}` : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.resumo?.lancamentos.toLocaleString('pt-BR') ?? '—'}</td>
                    <td className="px-5 py-2">
                      {c.status === 'concluida' && <span className="text-emerald-700">Concluída</span>}
                      {c.status === 'processando' && <span className="text-slate-500">Processando…</span>}
                      {c.status === 'erro' && <span className="text-rose-600" title={c.erro}>Erro: {c.erro?.slice(0, 80)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
};
