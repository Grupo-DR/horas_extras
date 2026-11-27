import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Cloud, CloudRain, Sun } from 'lucide-react';
import { Project, RDOData, Team } from '../types';
import { formatMoney } from '../utils';
import { getDimensions } from '../services/firestoreService';
import type { DimensionItem } from '../src/analytics/types/analyticsTypes';
import { Clima, DiaCalendario, mesMaisRecente, montarMes } from '../utils/rdoCalendar';

interface ProjectCalendarProps {
  project: Project | null;
  teams: Team[];
  rdos: RDOData[];
  onOpenRdo: (rdo: RDOData, team: Team) => void;
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const ICONE_CLIMA: Record<Exclude<Clima, ''>, { icon: typeof Sun; label: string; cls: string }> = {
  ENSOLARADO: { icon: Sun, label: 'Ensolarado', cls: 'text-amber-500' },
  NUBLADO: { icon: Cloud, label: 'Nublado', cls: 'text-slate-400' },
  CHUVOSO: { icon: CloudRain, label: 'Chuvoso', cls: 'text-sky-600' },
};

const int = (n: number) => n.toLocaleString('pt-BR');
const dataBr = (iso: string) => iso.split('-').reverse().join('/');

export const ProjectCalendar: React.FC<ProjectCalendarProps> = ({ project, teams, rdos, onOpenRdo }) => {
  const projectTeams = useMemo(() => teams.filter(t => t.projectId === project?.id), [teams, project]);
  const [teamId, setTeamId] = useState<string>('ALL');
  const [dimensoes, setDimensoes] = useState<DimensionItem[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const rdosObra = useMemo(() => {
    const ids = new Set(projectTeams.map(t => t.id));
    return rdos.filter(r => ids.has(r.teamId) && (teamId === 'ALL' || r.teamId === teamId));
  }, [rdos, projectTeams, teamId]);

  const [mesAtual, setMesAtual] = useState(() => mesMaisRecente(rdosObra));
  // Ao trocar de obra, abre no mês do RDO mais recente.
  useEffect(() => { setMesAtual(mesMaisRecente(rdosObra)); setSelecionado(null); setTeamId('ALL'); }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tabela de dimensões da obra (Inteligência Contratual) para separar MOD e MOI; sem ela, classifica pelo nome da função.
  useEffect(() => {
    let ativo = true;
    setDimensoes([]);
    if (project?.id) {
      getDimensions(project.id)
        .then(r => { if (ativo) setDimensoes(r?.items ?? []); })
        .catch(() => undefined);
    }
    return () => { ativo = false; };
  }, [project?.id]);

  const mes = useMemo(() => montarMes(mesAtual.ano, mesAtual.mes, rdosObra, project, dimensoes), [mesAtual, rdosObra, project, dimensoes]);
  const hasPrices = (project?.services?.length ?? 0) > 0;
  const teamName = (id: string) => projectTeams.find(t => t.id === id)?.name ?? '—';

  const mudarMes = (delta: number) => {
    const total = mesAtual.ano * 12 + (mesAtual.mes - 1) + delta;
    setMesAtual({ ano: Math.floor(total / 12), mes: (total % 12) + 1 });
    setSelecionado(null);
  };

  const abrirDia = (d: DiaCalendario) => {
    if (d.rdos.length === 0) return;
    if (d.rdos.length === 1) {
      const team = projectTeams.find(t => t.id === d.rdos[0].teamId);
      if (team) onOpenRdo(d.rdos[0], team);
      return;
    }
    setSelecionado(s => (s === d.iso ? null : d.iso));
  };

  const diaSelecionado = selecionado ? mes.semanas.flat().find(d => d.iso === selecionado) : undefined;

  return (
    <section className="rounded-xl border border-slate-200 bg-white" aria-label="Calendário de RDOs">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => mudarMes(-1)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="min-w-[120px] text-center text-sm font-semibold text-slate-900">{MESES[mes.mes - 1]} {mes.ano}</h2>
          <button type="button" onClick={() => mudarMes(1)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </button>
          <input
            type="month"
            value={`${mes.ano}-${String(mes.mes).padStart(2, '0')}`}
            onChange={e => { const [a, m] = e.target.value.split('-').map(Number); if (a && m) { setMesAtual({ ano: a, mes: m }); setSelecionado(null); } }}
            className="ml-2 h-8 rounded-md border border-slate-300 px-2 text-xs text-slate-700 focus:border-[#0b1d4f] focus:outline-none"
            aria-label="Escolher mês"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span><strong className="text-slate-900">{int(mes.totais.rdos)}</strong> RDOs em {int(mes.totais.dias)} dias</span>
          {hasPrices && <span>Produção <strong className="text-slate-900">{formatMoney(mes.totais.producao)}</strong></span>}
          {mes.totais.diasComOcorrencia > 0 && <span className="text-amber-700">{mes.totais.diasComOcorrencia} dia(s) com ocorrência</span>}
          <select value={teamId} onChange={e => { setTeamId(e.target.value); setSelecionado(null); }}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 focus:border-[#0b1d4f] focus:outline-none" aria-label="Turma">
            <option value="ALL">Todas as turmas</option>
            {projectTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </header>

      <div className="overflow-x-auto">
        <div className="grid min-w-[520px] grid-cols-7">
          {DIAS.map((d, i) => (
            <div key={d} className="border-b border-slate-200 bg-slate-50 px-1 py-1 text-center text-[11px] font-medium text-slate-500">
              <span title={d}>{DIAS_CURTOS[i]}</span>
            </div>
          ))}
          {mes.semanas.flat().map((d, i) => {
            const tem = d.rdos.length > 0;
            const clima = d.clima ? ICONE_CLIMA[d.clima] : null;
            const titulo = tem ? `${dataBr(d.iso)} — ${d.rdos.map(r => teamName(r.teamId)).join(', ')}` : undefined;
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => abrirDia(d)}
                disabled={!tem}
                title={titulo}
                className={`relative min-h-[78px] border-b border-slate-100 px-1.5 py-1 text-left text-[11px] leading-tight transition ${i % 7 !== 6 ? 'border-r' : ''} ${
                  !d.doMes ? 'bg-slate-50/60 text-slate-300' : tem ? 'hover:bg-slate-50' : 'text-slate-400'
                } ${selecionado === d.iso ? 'ring-2 ring-inset ring-[#0b1d4f]' : ''} disabled:cursor-default`}
              >
                <div className="flex items-start justify-between">
                  <span className={`font-medium ${tem ? 'text-slate-900' : ''}`}>{d.dia}</span>
                  <span className="flex items-center gap-1">
                    {clima && <clima.icon className={`h-3.5 w-3.5 ${clima.cls}`} aria-label={clima.label} />}
                    {d.ocorrencias > 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-label={`${d.ocorrencias} ocorrência(s)`} />}
                  </span>
                </div>
                {tem && (
                  <dl className="mt-0.5 tabular-nums text-slate-700">
                    {hasPrices && <div className="font-medium text-slate-900">{formatMoney(d.producao)}</div>}
                    <div className="flex justify-between"><dt className="text-slate-500">MOD</dt><dd>{int(d.mod)}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">MOI</dt><dd>{int(d.moi)}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">EQUIP</dt><dd>{int(d.equip)}</dd></div>
                    {d.rdos.length > 1 && <div className="text-[10px] text-slate-400">{d.rdos.length} RDOs</div>}
                  </dl>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {diaSelecionado && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-2.5 text-xs">
          <span className="text-slate-500">RDOs de {dataBr(diaSelecionado.iso)}:</span>
          {diaSelecionado.rdos.map(r => {
            const team = projectTeams.find(t => t.id === r.teamId);
            return (
              <button key={r.id} type="button" onClick={() => team && onOpenRdo(r, team)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-[#0b1d4f] hover:bg-slate-50">
                {team?.name ?? '—'}
              </button>
            );
          })}
        </div>
      )}

      <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 px-4 py-2 text-[11px] text-slate-500">
        <span>Clique no dia para abrir o RDO.</span>
        <span className="flex items-center gap-1"><Sun className="h-3.5 w-3.5 text-amber-500" /> <Cloud className="h-3.5 w-3.5 text-slate-400" /> <CloudRain className="h-3.5 w-3.5 text-sky-600" /> clima (pior do dia)</span>
        <span className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> houve ocorrência</span>
        <span>MOD/MOI: {dimensoes.length ? 'pela tabela de dimensões da obra' : 'pelo nome da função (obra sem tabela de dimensões)'}</span>
      </footer>
    </section>
  );
};
