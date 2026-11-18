import React, { useMemo } from 'react';
import { ChevronRight, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { Team, RDOData, Project } from '../types';
import { formatMoney } from '../utils';
import { STALE_AFTER_DAYS, summarizeTeams } from '../utils/projectSummary';
import { Badge, Button, ClickableRow, EmptyState, IconButton, PageHeader, TableCard, Td, Th } from './ui';

interface TeamListProps {
  teams: Team[];
  rdos: RDOData[];
  selectedProject: Project | null;
  onSelectTeam: (team: Team) => void;
  onEditTeam: (team: Team) => void;
  onDeleteTeam: (id: string, e: React.MouseEvent) => void;
  onCreateTeam: () => void;
}

export const TeamList: React.FC<TeamListProps> = ({
  teams, rdos, selectedProject, onSelectTeam, onEditTeam, onDeleteTeam, onCreateTeam
}) => {
  const summaries = useMemo(() => summarizeTeams(selectedProject, teams, rdos), [selectedProject, teams, rdos]);
  const totalProduction = useMemo(() => summaries.reduce((sum, s) => sum + s.production, 0), [summaries]);
  const hasPrices = (selectedProject?.services?.length ?? 0) > 0;

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
            <Th>Turma</Th>
            <Th align="right">RDOs</Th>
            <Th>Período</Th>
            <Th>Último RDO</Th>
            <Th align="right">Produção</Th>
            <Th align="right"><span className="sr-only">Ações</span></Th>
          </tr>
        </thead>
        <tbody>
          {summaries.map(s => (
            <ClickableRow key={s.team.id} onOpen={() => onSelectTeam(s.team)} label={`Abrir RDOs da turma ${s.team.name}`}>
              <Td className="font-semibold text-slate-900">{s.team.name}</Td>
              <Td align="right">{s.rdoCount.toLocaleString('pt-BR')}</Td>
              <Td className="whitespace-nowrap text-slate-500">
                {s.firstDate && s.lastDate ? `${s.firstDate} a ${s.lastDate}` : '—'}
              </Td>
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
              <Td align="right" className="whitespace-nowrap font-medium text-slate-900">
                {hasPrices ? formatMoney(s.production) : <span className="font-normal text-slate-400">—</span>}
              </Td>
              <Td align="right" className="whitespace-nowrap">
                <div className="flex items-center justify-end gap-0.5">
                  <IconButton icon={Pencil} label="Renomear turma" onClick={() => onEditTeam(s.team)} />
                  <IconButton icon={Trash2} label="Excluir turma" tone="danger" onClick={e => onDeleteTeam(s.team.id, e)} />
                  <ChevronRight className="ml-1 h-4 w-4 text-slate-300 transition group-hover:text-slate-500" aria-hidden="true" />
                </div>
              </Td>
            </ClickableRow>
          ))}
        </tbody>
      </TableCard>
    </>
  );
};
