import React, { useMemo } from 'react';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { Team, RDOData, Project } from '../types';
import { formatMoney } from '../utils';
import { TeamSummary, summarizeTeams } from '../utils/projectSummary';
import { Button, ClickableRow, EmptyState, PageHeader, RowMenu, SortableTh, TableCard, Td, Th, compareValues, useSort } from './ui';

interface TeamListProps {
  teams: Team[];
  rdos: RDOData[];
  selectedProject: Project | null;
  onSelectTeam: (team: Team) => void;
  onEditTeam: (team: Team) => void;
  onDeleteTeam: (id: string, e: React.MouseEvent) => void;
  onCreateTeam: () => void;
  /** Versão estreita, ao lado do calendário: sem a coluna Período (e sem Produção se a obra não tem preços). */
  compact?: boolean;
}

type SortKey = 'name' | 'rdos' | 'last' | 'production';

const SORT_VALUE: Record<SortKey, (s: TeamSummary) => string | number | null> = {
  name: s => s.team.name,
  rdos: s => s.rdoCount,
  last: s => s.lastTime,
  production: s => s.production,
};

const muted = <span className="text-slate-400">—</span>;

export const TeamList: React.FC<TeamListProps> = ({
  teams, rdos, selectedProject, onSelectTeam, onEditTeam, onDeleteTeam, onCreateTeam, compact = false
}) => {
  const { sort, onSort } = useSort<SortKey>({ key: 'name', dir: 'asc' });
  const summaries = useMemo(() => summarizeTeams(selectedProject, teams, rdos), [selectedProject, teams, rdos]);
  const sorted = useMemo(
    () => [...summaries].sort((a, b) => compareValues(SORT_VALUE[sort.key](a), SORT_VALUE[sort.key](b), sort.dir)),
    [summaries, sort]
  );
  const totalProduction = useMemo(() => summaries.reduce((sum, s) => sum + s.production, 0), [summaries]);
  const hasPrices = (selectedProject?.services?.length ?? 0) > 0;
  const showPeriod = !compact;
  const showProduction = !compact || hasPrices;

  const sortBy = (key: SortKey) => onSort(key, key === 'name' ? 'asc' : 'desc');
  const newTeamButton = <Button variant="primary" icon={Plus} onClick={onCreateTeam}>Nova turma</Button>;

  if (summaries.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhuma turma nesta obra"
        description="Cada turma (frente de trabalho) recebe os seus RDOs. Cadastre a primeira para começar."
        action={newTeamButton}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Turmas"
        subtitle={hasPrices ? `Produção acumulada da obra: ${formatMoney(totalProduction)}` : 'Importe a tabela de preços para calcular a produção em R$.'}
        actions={newTeamButton}
      />

      <TableCard>
        <thead>
          <tr>
            <SortableTh label="Turma" sortKey="name" sort={sort} onSort={sortBy} />
            <SortableTh label="RDOs" sortKey="rdos" sort={sort} onSort={sortBy} align="right" />
            {showPeriod && <Th>Período</Th>}
            <SortableTh label="Último RDO" sortKey="last" sort={sort} onSort={sortBy} />
            {showProduction && <SortableTh label="Produção" sortKey="production" sort={sort} onSort={sortBy} align="right" />}
            <Th align="right"><span className="sr-only">Ações</span></Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(s => (
            <ClickableRow key={s.team.id} onOpen={() => onSelectTeam(s.team)} label={`Abrir RDOs da turma ${s.team.name}`}>
              <Td className="font-medium text-slate-900">{s.team.name}</Td>
              <Td align="right">{s.rdoCount.toLocaleString('pt-BR')}</Td>
              {showPeriod && (
                <Td className="whitespace-nowrap text-slate-500">
                  {s.firstDate && s.lastDate ? `${s.firstDate} a ${s.lastDate}` : muted}
                </Td>
              )}
              <Td className="whitespace-nowrap">{s.lastDate ?? muted}</Td>
              {showProduction && (
                <Td align="right" className="whitespace-nowrap text-slate-900">
                  {hasPrices ? formatMoney(s.production) : muted}
                </Td>
              )}
              <Td align="right" className="w-10">
                <RowMenu
                  label={`Ações da turma ${s.team.name}`}
                  actions={[
                    { label: 'Renomear turma', icon: Pencil, onSelect: () => onEditTeam(s.team) },
                    { label: 'Excluir turma', icon: Trash2, tone: 'danger', onSelect: e => onDeleteTeam(s.team.id, e) },
                  ]}
                />
              </Td>
            </ClickableRow>
          ))}
        </tbody>
      </TableCard>
    </>
  );
};
