import React, { useMemo, useState } from 'react';
import { Building2, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { Project, RDOData, Team } from '../types';
import { rdoModelLabel } from '../services/rdoModels';
import { STALE_AFTER_DAYS, summarizeProjects } from '../utils/projectSummary';
import { Badge, Button, ClickableRow, EmptyState, IconButton, PageHeader, SearchInput, Select, TableCard, Td, Th } from './ui';

interface ProjectListProps {
  projects: Project[];
  teams: Team[];
  rdos: RDOData[];
  onSelectProject: (project: Project) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (id: string, e: React.MouseEvent) => void;
  onCreateProject: () => void;
}

const ALL = 'all';
const plural = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;

export const ProjectList: React.FC<ProjectListProps> = ({
  projects, teams, rdos, onSelectProject, onEditProject, onDeleteProject, onCreateProject
}) => {
  const [search, setSearch] = useState('');
  const [regional, setRegional] = useState(ALL);

  const summaries = useMemo(() => summarizeProjects(projects, teams, rdos), [projects, teams, rdos]);
  const regionals = useMemo(
    () => Array.from(new Set(projects.map(p => p.regional).filter(Boolean) as string[])).sort(),
    [projects]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return summaries.filter(s =>
      (regional === ALL || s.project.regional === regional) &&
      (!term || `${s.project.name} ${s.project.regional ?? ''}`.toLowerCase().includes(term))
    );
  }, [summaries, search, regional]);

  const totals = useMemo(() => ({
    teams: summaries.reduce((n, s) => n + s.teamCount, 0),
    rdos: summaries.reduce((n, s) => n + s.rdoCount, 0),
  }), [summaries]);

  const newProjectButton = (
    <Button variant="primary" icon={Plus} onClick={onCreateProject}>Nova obra</Button>
  );

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
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por centro de custo ou contrato" />
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
            <Th>Obra</Th>
            <Th>Regional</Th>
            <Th align="center">Turmas</Th>
            <Th>Tabela de preços</Th>
            <Th align="right">RDOs</Th>
            <Th>Último RDO</Th>
            <Th align="right"><span className="sr-only">Ações</span></Th>
          </tr>
        </thead>
        <tbody>
          {visible.map(s => (
            <ClickableRow key={s.project.id} onOpen={() => onSelectProject(s.project)} label={`Abrir obra ${s.project.name}`}>
              <Td>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{s.code}</span>
                  {s.project.rdoModel && s.project.rdoModel !== 'PADRAO' && (
                    <Badge tone="info" title="Modelo de RDO lido pela IA">{rdoModelLabel(s.project.rdoModel)}</Badge>
                  )}
                </div>
                {s.detail && <div className="mt-0.5 text-xs text-slate-500">{s.detail}</div>}
              </Td>
              <Td className="whitespace-nowrap">{s.project.regional || <span className="text-slate-400">—</span>}</Td>
              <Td align="center">{s.teamCount}</Td>
              <Td>
                {s.serviceCount > 0
                  ? <span className="whitespace-nowrap">{plural(s.serviceCount, 'item', 'itens')}</span>
                  : <Badge tone="warning" title="Sem tabela de preços a produção dos RDOs fica em R$ 0">Não importada</Badge>}
              </Td>
              <Td align="right">{s.rdoCount.toLocaleString('pt-BR')}</Td>
              <Td className="whitespace-nowrap">
                {s.lastDate ? (
                  <div className="flex items-center gap-2">
                    <span>{s.lastDate}</span>
                    {s.daysSince !== null && s.daysSince > STALE_AFTER_DAYS && (
                      <Badge tone="warning" title="Sem RDO recente">há {s.daysSince} dias</Badge>
                    )}
                  </div>
                ) : <span className="text-slate-400">Nenhum</span>}
              </Td>
              <Td align="right" className="whitespace-nowrap">
                <div className="flex items-center justify-end gap-0.5">
                  <IconButton icon={Pencil} label="Editar obra" onClick={() => onEditProject(s.project)} />
                  <IconButton icon={Trash2} label="Excluir obra" tone="danger" onClick={e => onDeleteProject(s.project.id, e)} />
                  <ChevronRight className="ml-1 h-4 w-4 text-slate-300 transition group-hover:text-slate-500" aria-hidden="true" />
                </div>
              </Td>
            </ClickableRow>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
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
