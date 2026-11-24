import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Download, FileSpreadsheet, Trash2, Upload } from 'lucide-react';
import { exportRDOsToExcel } from '../utils/excelExportUtils';
import * as db from '../services/firestoreService';
import { HistogramItem, RDOData, Team, Project } from '../types';
import { formatMoney, calculateRDOTotal, parseDate } from '../utils';
import { headcount, pendingReviewCount } from '../utils/projectSummary';
import { Button, ClickableRow, EmptyState, PageHeader, RowMenu, SearchInput, TableCard, Td, Th } from './ui';

interface RDOListProps {
  rdos: RDOData[];
  selectedTeam: Team | null;
  selectedProject: Project | null;
  onSelectRDO: (rdo: RDOData) => void;
  onExportCSV: (rdo: RDOData) => void;
  onDeleteRDO: (id: string, e: React.MouseEvent) => void;
  onUploadNew: () => void;
}

const weatherOf = (rdo: RDOData) =>
  [rdo.weatherMorning, rdo.weatherAfternoon].filter(Boolean).join(' / ') || rdo.weather || '—';

export const RDOList: React.FC<RDOListProps> = ({
  rdos, selectedTeam, selectedProject, onSelectRDO, onExportCSV, onDeleteRDO, onUploadNew
}) => {
  const [search, setSearch] = useState('');
  const [histograms, setHistograms] = useState<HistogramItem[]>([]);

  // RDOs da turma, do mais recente para o mais antigo, já com a produção calculada.
  const teamRdos = useMemo(() => rdos
    .filter(r => r.teamId === selectedTeam?.id)
    .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())
    .map(rdo => ({ rdo, total: calculateRDOTotal(rdo, selectedProject || undefined), review: pendingReviewCount(rdo) })),
  [rdos, selectedTeam, selectedProject]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? teamRdos.filter(({ rdo }) => `${rdo.reportNumber ?? ''} ${rdo.date}`.toLowerCase().includes(term)) : teamRdos;
  }, [teamRdos, search]);

  const totalProduction = useMemo(() => teamRdos.reduce((sum, r) => sum + r.total, 0), [teamRdos]);
  const toReview = useMemo(() => teamRdos.filter(r => r.review > 0).length, [teamRdos]);

  useEffect(() => {
    if (!selectedProject?.id) return;
    db.getHistograms(selectedProject.id)
      .then(setHistograms)
      .catch(err => console.error('Erro ao carregar histogramas', err));
  }, [selectedProject?.id]);

  const handleExportExcel = () => {
    if (!selectedTeam || !selectedProject) return;
    const fileName = `Diario_RDO_Equipe_${selectedTeam.name.replace(/\s+/g, '_')}_${selectedProject.name.replace(/\s+/g, '_')}.xlsx`;
    exportRDOsToExcel(teamRdos.map(r => r.rdo), selectedProject.name, histograms, fileName);
  };

  const uploadButton = <Button variant="primary" icon={Upload} onClick={onUploadNew}>Importar RDOs</Button>;

  if (teamRdos.length === 0) {
    return (
      <>
        <PageHeader title={`RDOs · ${selectedTeam?.name ?? ''}`} />
        <EmptyState
          icon={ClipboardList}
          title="Nenhum RDO nesta turma"
          description="Envie os RDOs em PDF ou imagem: a IA lê o documento e preenche mão de obra, equipamentos e atividades."
          action={uploadButton}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`RDOs · ${selectedTeam?.name ?? ''}`}
        subtitle={`${teamRdos.length.toLocaleString('pt-BR')} relatórios · produção ${formatMoney(totalProduction)}${toReview ? ` · ${toReview} com itens a revisar` : ''}`}
        actions={<>
          <Button icon={FileSpreadsheet} onClick={handleExportExcel} title="Apontamento diário da turma em Excel">Exportar Excel</Button>
          {uploadButton}
        </>}
      />

      <div className="mb-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por número ou data (ex.: 10/2026)" />
      </div>

      <TableCard footer={visible.length !== teamRdos.length ? `Mostrando ${visible.length} de ${teamRdos.length} RDOs` : undefined}>
        <thead>
          <tr>
            <Th>RDO</Th>
            <Th>Data</Th>
            <Th>Clima</Th>
            <Th align="right">Efetivo</Th>
            <Th align="right">Ocorrências</Th>
            <Th>Conferência</Th>
            <Th align="right">Produção</Th>
            <Th align="right"><span className="sr-only">Ações</span></Th>
          </tr>
        </thead>
        <tbody>
          {visible.map(({ rdo, total, review }) => (
            <ClickableRow key={rdo.id} onOpen={() => onSelectRDO(rdo)} label={`Abrir RDO ${rdo.reportNumber ?? ''} de ${rdo.date}`}>
              <Td className="whitespace-nowrap font-medium text-slate-900">nº {rdo.reportNumber || '—'}</Td>
              <Td className="whitespace-nowrap">{rdo.date}</Td>
              <Td className="whitespace-nowrap text-slate-500">{weatherOf(rdo)}</Td>
              <Td align="right">{headcount(rdo)}</Td>
              <Td align="right">{rdo.occurrences?.length ?? 0}</Td>
              <Td className="whitespace-nowrap">
                {review > 0
                  ? <span className="text-amber-700" title="Atividades com código ou quantidade a conferir">{review} a revisar</span>
                  : <span className="text-slate-400">—</span>}
              </Td>
              <Td align="right" className="whitespace-nowrap text-slate-900">{formatMoney(total)}</Td>
              <Td align="right" className="w-10">
                <RowMenu
                  label={`Ações do RDO ${rdo.reportNumber ?? ''}`}
                  actions={[
                    { label: 'Baixar CSV', icon: Download, onSelect: () => onExportCSV(rdo) },
                    { label: 'Excluir RDO', icon: Trash2, tone: 'danger', onSelect: e => onDeleteRDO(rdo.id, e) },
                  ]}
                />
              </Td>
            </ClickableRow>
          ))}
          {visible.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">Nenhum RDO encontrado.</td></tr>
          )}
        </tbody>
      </TableCard>
    </>
  );
};
