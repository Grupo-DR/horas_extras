import React, { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Pencil, Upload } from 'lucide-react';
import { Project } from '../types';
import { formatMoney } from '../utils';
import { rdoModelLabel } from '../services/rdoModels';
import { splitProjectName } from '../utils/projectSummary';
import { Badge, Button, EmptyState, PageHeader, SearchInput, TableCard, Td, Th } from './ui';

interface ProjectServicesProps {
  selectedProject: Project | null;
  projectTab: 'TEAMS' | 'SERVICES';
  teamCount: number;
  onSetTab: (tab: 'TEAMS' | 'SERVICES') => void;
  onServicesUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onEditProject: (project: Project) => void;
}

const isoToBr = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '');

/** Cabeçalho da obra com as abas Turmas / Tabela de preços; a aba de preços é renderizada aqui. */
export const ProjectServices: React.FC<ProjectServicesProps> = ({
  selectedProject, projectTab, teamCount, onSetTab, onServicesUpload, onEditProject
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const services = selectedProject?.services ?? [];

  const visibleServices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? services.filter(s => `${s.code} ${s.scope}`.toLowerCase().includes(term)) : services;
  }, [services, search]);

  if (!selectedProject) return null;
  const { code, detail } = splitProjectName(selectedProject.name);

  const tabs = [
    { id: 'TEAMS' as const, label: 'Turmas', count: teamCount },
    { id: 'SERVICES' as const, label: 'Tabela de preços', count: services.length },
  ];

  const importButton = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={e => { onServicesUpload(e); e.target.value = ''; }}
      />
      <Button variant={services.length ? 'secondary' : 'primary'} icon={Upload} onClick={() => fileInput.current?.click()}>
        {services.length ? 'Atualizar tabela' : 'Importar tabela'}
      </Button>
    </>
  );

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">{code}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {detail && <span>{detail}</span>}
            {selectedProject.regional && <Badge>{selectedProject.regional}</Badge>}
            <Badge tone={selectedProject.rdoModel && selectedProject.rdoModel !== 'PADRAO' ? 'info' : 'neutral'}>
              RDO {rdoModelLabel(selectedProject.rdoModel)}
            </Badge>
          </div>
        </div>
        <Button icon={Pencil} onClick={() => onEditProject(selectedProject)}>Editar obra</Button>
      </div>

      <div className="mb-5 flex gap-1 border-b border-slate-200" role="tablist">
        {tabs.map(tab => {
          const active = projectTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSetTab(tab.id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition ${
                active ? 'border-[#0b1d4f] font-semibold text-[#0b1d4f]' : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? 'bg-[#0b1d4f] text-white' : 'bg-slate-100 text-slate-500'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {projectTab === 'SERVICES' && (
        services.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="Tabela de preços não importada"
            description={selectedProject.rdoModel === 'VALE_NOVAS_FERROVIAS'
              ? 'Importe a PQ da Vale (.xlsx). Sem ela a IA não identifica os serviços dos RDOs e a produção fica em R$ 0.'
              : 'Importe a planilha com código, descrição, unidade, preço e vigência. Sem ela a produção dos RDOs fica em R$ 0.'}
            action={importButton}
          />
        ) : (
          <>
            <PageHeader
              title="Tabela de preços"
              subtitle={`${services.length} itens · usados para valorizar a produção dos RDOs`}
              actions={importButton}
            />
            <div className="mb-3">
              <SearchInput value={search} onChange={setSearch} placeholder="Buscar por código ou descrição" />
            </div>
            <TableCard footer={visibleServices.length !== services.length ? `Mostrando ${visibleServices.length} de ${services.length} itens` : undefined}>
              <thead>
                <tr>
                  <Th>Código</Th>
                  <Th>Descrição</Th>
                  <Th align="center">Unid.</Th>
                  <Th>Vigência</Th>
                  <Th align="right">Preço unitário</Th>
                </tr>
              </thead>
              <tbody>
                {visibleServices.map((service, idx) => (
                  <tr key={`${service.code}_${service.startDate ?? ''}_${idx}`} className="hover:bg-slate-50">
                    <Td className="whitespace-nowrap font-mono text-xs text-slate-600">{service.code}</Td>
                    <Td className="text-slate-900">{service.scope}</Td>
                    <Td align="center">{service.unit}</Td>
                    <Td className="whitespace-nowrap text-slate-500">
                      {service.startDate || service.endDate
                        ? `${isoToBr(service.startDate) || 'início'} a ${isoToBr(service.endDate) || 'fim'}`
                        : 'Contrato todo'}
                    </Td>
                    <Td align="right" className="whitespace-nowrap font-medium text-slate-900">{formatMoney(service.value)}</Td>
                  </tr>
                ))}
                {visibleServices.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">Nenhum item encontrado.</td></tr>
                )}
              </tbody>
            </TableCard>
          </>
        )
      )}
    </>
  );
};
