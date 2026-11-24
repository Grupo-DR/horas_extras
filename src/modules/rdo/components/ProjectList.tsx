import React, { useMemo, useState } from 'react';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Project, RDOData, Team } from '../types';
import { ProjectSummary, summarizeProjects } from '../utils/projectSummary';
import {
  Button, ClickableRow, EmptyState, PageHeader, RowMenu, SearchInput, Select, SortableTh,
  TableCard, Td, Th, compareValues, useSort,
} from './ui';

interface ProjectListProps {
  projects: Project[];
  teams: Team[];
  rdos: RDOData[];
  onSelectProject: (project: Project) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (id: string, e: React.MouseEvent) => void;
  onCreateProject: () => void;
}

type SortKey = 'code' | 'detail' | 'client' | 'regional' | 'teams' | 'services' | 'rdos' | 'last';

const SORT_VALUE: Record<SortKey, (s: ProjectSummary) => string | number | null> = {
  code: s => s.code,
  detail: s => s.detail,
  client: s => s.client,
  regional: s => s.project.regional ?? '',
  teams: s => s.teamCount,
  services: s => s.serviceCount,
  rdos: s => s.rdoCount,
  last: s => s.lastTime,
};

/** Colunas numéricas e de data começam do maior/mais recente. */
const DESC_FIRST: SortKey[] = ['teams', 'services', 'rdos', 'last'];

const ALL = 'all';
const plural = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;
const muted = <span className="text-slate-400">—</span>;

export const ProjectList: React.FC<ProjectListProps> = ({
  projects, teams, rdos, onSelectProject, onEditProject, onDeleteProject, onCreateProject
}) => {
  const [search, setSearch] = useState('');
  const [regional, setRegional] = useState(ALL);
  const { sort, onSort } = useSort<SortKey>({ key: 'code', dir: 'asc' });

  const summaries = useMemo(() => summarizeProjects(projects, teams, rdos), [projects, teams, rdos]);
  const regionals = useMemo(
    () => Array.from(new Set(projects.map(p => p.regional).filter(Boolean) as string[])).sort(),
    [projects]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return summaries
      .filter(s =>
        (regional === ALL || s.project.regional === regional) &&
        (!term || `${s.project.name} ${s.client} ${s.project.regional ?? ''}`.toLowerCase().includes(term))
      )
      .sort((a, b) => compareValues(SORT_VALUE[sort.key](a), SORT_VALUE[sort.key](b), sort.dir));
  }, [summaries, search, regional, sort]);

  const totals = useMemo(() => ({
    teams: summaries.reduce((n, s) => n + s.teamCount, 0),
    rdos: summaries.reduce((n, s) => n + s.rdoCount, 0),
  }), [summaries]);

  const sortBy = (key: SortKey) => onSort(key, DESC_FIRST.includes(key) ? 'desc' : 'asc');
  const th = (label: string, key: SortKey, align?: 'left' | 'right' | 'center') => (
    <SortableTh label={label} sortKey={key} sort={sort} onSort={sortBy} align={align} />
  );

  const newProjectButton = <Button variant="primary" icon={Plus} onClick={onCreateProject}>Nova obra</Button>;

  if (projects.length === 0) {
    return (
      <>
        <PageHeader title="Obras" />
        <EmptyState
          icon={Building2}
          title="Nenhuma obra cadastrada"
          description="Cadastre a obra, importe a tabela de preços e crie as turmas para começar a enviar RDOs."
          action={newProjectButton}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Obras"
        subtitle={`${plural(projects.length, 'obra', 'obras')} · ${plural(totals.teams, 'turma', 'turmas')} · ${plural(totals.rdos, 'RDO', 'RDOs')}`}
        actions={newProjectButton}
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar obra, contrato ou cliente" />
        {regionals.length > 1 && (
          <Select label="Filtrar por regional" value={regional} onChange={e => setRegional(e.target.value)}>
            <option value={ALL}>Todas as regionais</option>
            {regionals.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
        )}
      </div>

      <TableCard footer={visible.length !== summaries.length ? `Mostrando ${visible.length} de ${summaries.length} obras` : undefined}>
        <thead>
          <tr>
            {th('Centro de custo', 'code')}
            {th('Contrato / descrição', 'detail')}
            {th('Cliente', 'client')}
            {th('Regional', 'regional')}
            {th('Turmas', 'teams', 'right')}
            {th('Itens tab. preços', 'services', 'right')}
            {th('RDOs', 'rdos', 'right')}
            {th('Último RDO', 'last')}
            <Th align="right"><span className="sr-only">Ações</span></Th>
          </tr>
        </thead>
        <tbody>
          {visible.map(s => (
            <ClickableRow key={s.project.id} onOpen={() => onSelectProject(s.project)} label={`Abrir obra ${s.project.name}`}>
              <Td className="whitespace-nowrap font-medium text-slate-900">{s.code}</Td>
              <Td className="max-w-[320px] truncate" title={s.detail}>{s.detail || muted}</Td>
              <Td className="whitespace-nowrap">{s.client || muted}</Td>
              <Td className="whitespace-nowrap">{s.project.regional || muted}</Td>
              <Td align="right">{s.teamCount}</Td>
              <Td align="right">
                {s.serviceCount > 0
                  ? s.serviceCount.toLocaleString('pt-BR')
                  : <span className="text-rose-600" title="Sem tabela de preços a produção dos RDOs fica em R$ 0">não importada</span>}
              </Td>
              <Td align="right">{s.rdoCount.toLocaleString('pt-BR')}</Td>
              <Td className="whitespace-nowrap">{s.lastDate ?? muted}</Td>
              <Td align="right" className="w-10">
                <RowMenu
                  label={`Ações da obra ${s.code}`}
                  actions={[
                    { label: 'Editar obra', icon: Pencil, onSelect: () => onEditProject(s.project) },
                    { label: 'Excluir obra', icon: Trash2, tone: 'danger', onSelect: e => onDeleteProject(s.project.id, e) },
                  ]}
                />
              </Td>
            </ClickableRow>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                Nenhuma obra encontrada.{' '}
                <button type="button" className="font-medium text-[#0b1d4f] underline-offset-2 hover:underline" onClick={() => { setSearch(''); setRegional(ALL); }}>
                  Limpar filtros
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </TableCard>
    </>
  );
};
