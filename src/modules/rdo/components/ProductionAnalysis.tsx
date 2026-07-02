import React, { useState } from 'react';
import { Project, RDOData, Team } from '../types';
import { HistogramAnalysis } from './HistogramAnalysis';
import { ProductionPriceTable } from './ProductionPriceTable';
import { BarChart3, Target } from 'lucide-react';

interface ProductionAnalysisProps {
  projects: Project[];
  rdos: RDOData[];
  teams: Team[];
  filterStartDate: string;
  setFilterStartDate: (date: string) => void;
  filterEndDate: string;
  setFilterEndDate: (date: string) => void;
  filterRegional: string;
  setFilterRegional: (reg: string) => void;
  filterProject: string;
  setFilterProject: (projId: string) => void;
  filterTeam: string;
  setFilterTeam: (teamId: string) => void;
  onOpenRdoDetail: (rdo: RDOData) => void;
}

type AnalysisTab = 'HISTOGRAM' | 'PRODUCTION';

export const ProductionAnalysis: React.FC<ProductionAnalysisProps> = ({
  projects, rdos, teams,
  filterStartDate, setFilterStartDate,
  filterEndDate, setFilterEndDate,
  filterRegional, setFilterRegional,
  filterProject, setFilterProject,
  filterTeam, setFilterTeam,
  onOpenRdoDetail
}) => {
  const [activeTab, setActiveTab] = useState<AnalysisTab>('PRODUCTION');
  
  const selectedProject = projects.find(p => p.id === filterProject) || null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex gap-2 p-1 bg-white/5 rounded-2xl w-fit mb-6">
        <button 
          onClick={() => setActiveTab('PRODUCTION')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'PRODUCTION' ? 'bg-gradient-premium text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <Target className="w-4 h-4" />
          Acompanhamento de Produção
        </button>
        <button 
          onClick={() => setActiveTab('HISTOGRAM')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'HISTOGRAM' ? 'bg-gradient-premium text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <BarChart3 className="w-4 h-4" />
          Histograma Real
        </button>
      </div>

      {activeTab === 'PRODUCTION' && (
        <ProductionPriceTable 
          projects={projects}
          rdos={rdos}
          teams={teams}
          filterRegional={filterRegional}
          setFilterRegional={setFilterRegional}
          filterProject={filterProject}
          setFilterProject={setFilterProject}
        />
      )}

      {activeTab === 'HISTOGRAM' && (
        <HistogramAnalysis 
          projects={projects}
          teams={teams}
          rdos={rdos}
          selectedProject={selectedProject}
          onSelectProject={(p) => setFilterProject(p ? p.id : 'all')}
        />
      )}
    </div>
  );
};
