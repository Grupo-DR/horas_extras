/**
 * @deprecated ATENÇÃO: Este arquivo é um backup de uma refatoração passada.
 * O ponto de entrada real da aplicação (index.tsx) utiliza o App.tsx.
 * Por favor, não modifique este arquivo. Faça alterações diretamente no App.tsx.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Upload, FileText, Loader2, BarChart2, CheckCircle2, 
  Trash2, Download, Menu, X, ChevronRight, Folder, 
  Users, Home, Plus, ArrowLeft, Building2, HardHat, Truck,
  ClipboardList, AlertTriangle, MessageSquare, DollarSign, 
  FileSpreadsheet, LayoutDashboard, LogOut, TrendingUp, TrendingDown, Calendar, Target, Activity,
  Filter, Edit, Save, Layers, Brain
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Legend, LineChart, Line 
} from 'recharts';
import { read, utils } from 'xlsx';
import { extractRDOData, fileToBase64 } from './services/geminiService';
import { RDOData, Project, Team, ServiceItem } from './types';
import { InfoCards } from './components/InfoCards';
import { FinancialTable } from './components/FinancialTable';
import { ProjectList } from './components/ProjectList';
import { TeamList } from './components/TeamList';
import { RDOList } from './components/RDOList';
import { Breadcrumbs } from './components/Breadcrumbs';
import { ProjectServices } from './components/ProjectServices';
import { RDODetail } from './components/RDODetail';
import { ProductionPriceTable } from './components/ProductionPriceTable';
import ContractIntelligencePage from './components/ContractIntelligence/ContractIntelligencePage';
import { formatMoney, parseDate, getServiceByCode, calculateRDOTotal, generateUUID } from './utils';
import * as db from './services/firestoreService';

// --- Local Storage Keys ---
const STORAGE_PROJECT_SYNCED = 'rdo_projects_synced';

type MainMenu = 'DASHBOARD' | 'PROJECTS' | 'ANALYSIS' | 'CONTRACT_INTELLIGENCE';
type ViewState = 'PROJECT_LIST' | 'TEAMS_LIST' | 'RDO_LIST' | 'UPLOAD_ANALYSIS';
type ProjectTab = 'TEAMS' | 'SERVICES';

function App() {
  // --- Global Data State ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [rdos, setRdos] = useState<RDOData[]>([]);

  // --- Navigation/Selection State ---
  const [activeMenu, setActiveMenu] = useState<MainMenu>('DASHBOARD');
  
  // Project Drill-down State
  const [currentView, setCurrentView] = useState<ViewState>('PROJECT_LIST');
  const [projectTab, setProjectTab] = useState<ProjectTab>('TEAMS');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // --- Analysis State ---
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [currentRDO, setCurrentRDO] = useState<RDOData | null>(null);

  // --- UI State & CRUD ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); 
  const [editingItemId, setEditingItemId] = useState<string | null>(null); 
  
  // Form States
  const [newItemName, setNewItemName] = useState('');
  const [newItemRegional, setNewItemRegional] = useState(''); 
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- Dashboard Filter State ---
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterRegional, setFilterRegional] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [filterTeam, setFilterTeam] = useState('all');

  // Load Data on Mount & Firestore Sync
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        // 1. Check if we need to migrate local data to Firestore
        const isSynced = localStorage.getItem(STORAGE_PROJECT_SYNCED);
        
        let currentProjects = await db.getProjects();
        let currentTeams = await db.getTeams();
        let currentRdos = await db.getRdos();

        // 2. Initial Migration or Seed
        if (!isSynced && currentProjects.length === 0) {
          const localProjects = JSON.parse(localStorage.getItem('rdo_projects') || '[]');
          const localTeams = JSON.parse(localStorage.getItem('rdo_teams') || '[]');
          const localRdos = JSON.parse(localStorage.getItem('rdo_history') || '[]');

          if (localProjects.length > 0) {
             console.log("Migrating local data to Firestore...");
             for (const p of localProjects) await db.saveProject(p);
             for (const t of localTeams) await db.saveTeam(t);
             for (const r of localRdos) await db.saveRdo(r);
             
             currentProjects = localProjects;
             currentTeams = localTeams;
             currentRdos = localRdos;
             // If no local data and no firestore data, initialize empty
             console.log("No data found. Initializing empty state.");
             currentProjects = [];
             currentTeams = [];
             currentRdos = [];
          }
          localStorage.setItem(STORAGE_PROJECT_SYNCED, 'true');
        }

        setProjects(currentProjects);
        setTeams(currentTeams);
        setRdos(currentRdos);
      } catch (e) {
        console.error("Error loading Firestore data", e);
        setError("Erro ao carregar dados da nuvem. Verifique a configuração do Firestore.");
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // --- Calculations ---

  // --- CRUD Operations (Project & Team) ---

  const openCreateModal = () => {
    setIsEditMode(false);
    setNewItemName('');
    setNewItemRegional('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: Project | Team, type: 'PROJECT' | 'TEAM') => {
    setIsEditMode(true);
    setEditingItemId(item.id);
    setNewItemName(item.name);
    if (type === 'PROJECT') {
      setNewItemRegional((item as Project).regional || '');
    }
    setIsModalOpen(true);
  };

  const handleSaveProject = async () => {
    if (!newItemName.trim()) return;

    try {
      if (isEditMode && editingItemId) {
        const updatedProjects = projects.map(p => 
          p.id === editingItemId ? { ...p, name: newItemName, regional: newItemRegional } : p
        );
        const projectToUpdate = updatedProjects.find(p => p.id === editingItemId);
        if (projectToUpdate) await db.saveProject(projectToUpdate);
        setProjects(updatedProjects);
      } else {
        const newProject: Project = {
          id: generateUUID(),
          name: newItemName,
          regional: newItemRegional,
          createdAt: new Date().toISOString(),
          services: []
        };
        await db.saveProject(newProject);
        setProjects([newProject, ...projects]);
      }
      setIsModalOpen(false);
    } catch (e) {
      alert("Erro ao salvar projeto no Firestore.");
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Tem certeza? Isso apagará todas as turmas e RDOs associados.")) return;

    try {
      await db.deleteProject(id);
      
      const updatedProjects = projects.filter(p => p.id !== id);
      setProjects(updatedProjects);

      const relatedTeams = teams.filter(t => t.projectId === id);
      const relatedTeamIds = relatedTeams.map(t => t.id);
      
      for (const teamId of relatedTeamIds) {
        await db.deleteTeam(teamId);
      }

      const updatedTeams = teams.filter(t => t.projectId !== id);
      setTeams(updatedTeams);

      const rdosToDelete = rdos.filter(r => relatedTeamIds.includes(r.teamId));
      for (const r of rdosToDelete) {
        await db.deleteRdo(r.id);
      }

      const updatedRdos = rdos.filter(r => !relatedTeamIds.includes(r.teamId));
      setRdos(updatedRdos);
    } catch (e) {
      alert("Erro ao excluir dados do Firestore.");
    }
  };

  const handleSaveTeam = async () => {
    if (!newItemName.trim() || !selectedProject) return;

    try {
      if (isEditMode && editingItemId) {
        const updatedTeams = teams.map(t => 
          t.id === editingItemId ? { ...t, name: newItemName } : t
        );
        const teamToUpdate = updatedTeams.find(t => t.id === editingItemId);
        if (teamToUpdate) await db.saveTeam(teamToUpdate);
        setTeams(updatedTeams);
      } else {
        const newTeam: Team = {
          id: generateUUID(),
          projectId: selectedProject.id,
          name: newItemName,
          createdAt: new Date().toISOString()
        };
        await db.saveTeam(newTeam);
        setTeams([newTeam, ...teams]);
      }
      setIsModalOpen(false);
    } catch (e) {
      alert("Erro ao salvar equipe no Firestore.");
    }
  };

  const handleDeleteTeam = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Tem certeza? Isso apagará todos os RDOs desta turma.")) return;

    try {
      await db.deleteTeam(id);
      const updatedTeams = teams.filter(t => t.id !== id);
      setTeams(updatedTeams);

      const rdosToDelete = rdos.filter(r => r.teamId === id);
      for (const r of rdosToDelete) {
        await db.deleteRdo(r.id);
      }
      
      const updatedRdos = rdos.filter(r => r.teamId !== id);
      setRdos(updatedRdos);
    } catch (e) {
      alert("Erro ao excluir equipe no Firestore.");
    }
  };

  const deleteRDO = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(!confirm("Tem certeza que deseja excluir este relatório?")) return;
    
    try {
      await db.deleteRdo(id);
      const updated = rdos.filter(r => r.id !== id);
      setRdos(updated);
      if (currentRDO?.id === id) setCurrentRDO(null);
    } catch (e) {
      alert("Erro ao excluir RDO no Firestore.");
    }
  };

  const handleServicesUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedProject) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json(worksheet, { header: 1 });

      const services: ServiceItem[] = [];
      
      jsonData.forEach((row: any) => {
        if (row.length >= 4) {
           const code = String(row[0]);
           if (code && !['código', 'code', 'item'].includes(code.toLowerCase())) {
             const val = row[3];
             let numVal = 0;
             if (typeof val === 'number') numVal = val;
             else if (typeof val === 'string') {
               numVal = parseFloat(val.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
             }

             services.push({
               code: code,
               scope: String(row[1]),
               unit: String(row[2]),
               value: numVal || 0
             });
           }
        }
      });

      const updatedProject = { ...selectedProject, services };
      const updatedProjects = projects.map(p => p.id === selectedProject.id ? updatedProject : p);
      
      await db.saveProject(updatedProject);
      setProjects(updatedProjects);
      setSelectedProject(updatedProject);
      alert(`${services.length} serviços importados com sucesso!`);

    } catch (e) {
      console.error("Error parsing excel", e);
      alert("Erro ao ler arquivo Excel. Verifique o formato.");
    }
  };

  // --- Navigation Handlers ---

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setProjectTab('TEAMS'); 
    setCurrentView('TEAMS_LIST');
    setCurrentRDO(null);
  };

  const handleSelectTeam = (team: Team) => {
    setSelectedTeam(team);
    setCurrentView('RDO_LIST');
    setCurrentRDO(null);
  };

  const handleOpenRdoFromAnalysis = (rdo: RDOData) => {
    const team = teams.find((t) => t.id === rdo.teamId);
    if (!team) return;

    const project = projects.find((p) => p.id === team.projectId) || null;

    setActiveMenu('PROJECTS');
    setSelectedProject(project);
    setSelectedTeam(team);
    setCurrentView('RDO_LIST');
    setCurrentRDO(rdo);
  };

  const navigateToDashboard = () => {
    setActiveMenu('DASHBOARD');
    setCurrentRDO(null);
  };

  const navigateToProjects = () => {
    setActiveMenu('PROJECTS');
    if (currentView === 'UPLOAD_ANALYSIS') setCurrentView('RDO_LIST');
  };

  const navigateToAnalysis = () => {
    setActiveMenu('ANALYSIS');
    setSelectedProject(null); // Como solicitado: sempre abrir tela limpa
    setCurrentRDO(null);
  };

  // --- Analysis & Upload Handlers ---

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !selectedTeam) return;

    setLoading(true);
    setUploadProgress({ current: 0, total: files.length });
    setError(null);

    const newRdos: RDOData[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(prev => ({ ...prev, current: i + 1 }));
        const file = files[i];
        
        const base64 = await fileToBase64(file);
        const data = await extractRDOData(base64, file.type);
        
        data.teamId = selectedTeam.id;
        await db.saveRdo(data);
        newRdos.push(data);
      }
      
      const updatedRdos = [...newRdos, ...rdos];
      setRdos(updatedRdos);
      
      // If only one file, show it. Otherwise, go back to list.
      if (newRdos.length === 1) {
        setCurrentRDO(newRdos[0]);
      } else {
        alert(`${newRdos.length} relatórios processados com sucesso!`);
        setCurrentView('RDO_LIST');
      }
    } catch (err) {
      console.error(err);
      setError("Falha ao processar um ou mais RDOs. Verifique se as imagens estão nítidas.");
    } finally {
      setLoading(false);
      setUploadProgress({ current: 0, total: 0 });
    }
  };

  const exportToCSV = (data: RDOData) => {
    const headers = ["Categoria", "Item", "Valor/Qtd", "Detalhe"];
    const rows = [
      ["Meta", "Obra", selectedProject?.name || "", ""],
      ["Meta", "Turma", selectedTeam?.name || "", ""],
      ["Meta", "Relatório", data.reportNumber, ""],
      ["Meta", "Data", data.date, ""],
      ...data.workforce.map(w => ["Mão de Obra", w.role, w.count, `${w.totalHours}h`]),
      ...data.equipment.map(e => ["Equipamento", e.name, e.count, `${e.hoursOperated}h`]),
      ...data.activities.map(a => ["Atividade", a.description, `${a.progress}%`, a.status]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `RDO_${data.reportNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Render Components ---

  const Sidebar = () => (
    <div className={`
      fixed inset-y-0 left-0 z-40 w-72 glass-panel text-white transform transition-transform duration-300 ease-in-out
      ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:inset-0
      border-r border-white/5
    `}>
      <div className="flex flex-col h-full">
        <div className="p-8 border-b border-white/5 flex items-center gap-4">
          <div className="bg-gradient-premium p-2.5 rounded-2xl shadow-lg shadow-blue-500/20 animate-float">
            <BarChart2 className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-white leading-none">RDO Pro</h1>
            <span className="text-[10px] uppercase tracking-widest text-blue-400 font-bold mt-1">Analytics Dashboard</span>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-3">
          <button
            onClick={navigateToDashboard}
            className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 ${
              activeMenu === 'DASHBOARD' 
                ? 'bg-gradient-premium text-white shadow-xl shadow-blue-600/20 scale-[1.02]' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-semibold text-sm">Painel Geral</span>
          </button>

          <button
            onClick={navigateToProjects}
            className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 ${
              activeMenu === 'PROJECTS' 
                ? 'bg-gradient-premium text-white shadow-xl shadow-blue-600/20 scale-[1.02]' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Building2 className="w-5 h-5" />
            <span className="font-semibold text-sm">Minhas Obras</span>
          </button>

          <button
            onClick={navigateToAnalysis}
            className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 ${
              activeMenu === 'ANALYSIS' 
                ? 'bg-gradient-premium text-white shadow-xl shadow-blue-600/20 scale-[1.02]' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <BarChart2 className="w-5 h-5" />
            <span className="font-semibold text-sm">Análise de Produção</span>
          </button>

          <button
            onClick={() => { setActiveMenu('CONTRACT_INTELLIGENCE'); setSelectedProject(null); setCurrentRDO(null); }}
            className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 ${
              activeMenu === 'CONTRACT_INTELLIGENCE' 
                ? 'bg-gradient-premium text-white shadow-xl shadow-blue-600/20 scale-[1.02]' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Brain className="w-5 h-5" />
            <span className="font-semibold text-sm">Contract Intelligence</span>
          </button>
        </nav>

        <div className="p-6">
           <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 text-slate-400 text-xs mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                Gemini Intelligence Active
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                Analysis powered by Google Gemini 1.5 Flash for maximum precision.
              </p>
           </div>
        </div>
      </div>
    </div>
  );

  const FinancialDashboard = () => {
    
    const filteredRdos = useMemo(() => {
      let result = rdos;

      if (filterStartDate) {
        result = result.filter(r => {
          const rDate = parseDate(r.date);
          const start = new Date(filterStartDate + 'T00:00:00');
          return rDate >= start;
        });
      }
      if (filterEndDate) {
        result = result.filter(r => {
          const rDate = parseDate(r.date);
          const end = new Date(filterEndDate + 'T23:59:59');
          return rDate <= end;
        });
      }

      if (filterRegional !== 'all' || filterProject !== 'all' || filterTeam !== 'all') {
         result = result.filter(r => {
            const team = teams.find(t => t.id === r.teamId);
            if (!team) return false;
            const project = projects.find(p => p.id === team.projectId);
            if (!project) return false;

            const matchesRegional = filterRegional === 'all' || project.regional === filterRegional;
            const matchesProject = filterProject === 'all' || project.id === filterProject;
            const matchesTeam = filterTeam === 'all' || r.teamId === filterTeam;

            return matchesRegional && matchesProject && matchesTeam;
         });
      }

      return result;
    }, [rdos, filterStartDate, filterEndDate, filterRegional, filterProject, filterTeam, teams, projects]);

    const latestRdo = [...filteredRdos].sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())[0];
    
    let totalRevenueRealized = 0;
    let avgDailyRevenue = 0;
    let trendValue = 0;
    let totalForecast = 0;
    let periodLabel = 'Todo o Período';

    if (latestRdo) {
      totalRevenueRealized = filteredRdos.reduce((acc, r) => {
         const team = teams.find(t => t.id === r.teamId);
         const project = team ? projects.find(p => p.id === team.projectId) : undefined;
         return acc + calculateRDOTotal(r, project);
      }, 0);

      const latestDate = parseDate(latestRdo.date);
      let daysPassed = 0;
      let daysRemaining = 0;

      if (filterStartDate && filterEndDate) {
         periodLabel = `Período Filtrado`;
         const start = new Date(filterStartDate);
         const end = new Date(filterEndDate);
         const totalDaysInRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
         const timeDiff = latestDate.getTime() - start.getTime();
         daysPassed = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1);
         daysRemaining = Math.max(0, totalDaysInRange - daysPassed);
      } else {
         const currentMonth = latestDate.getMonth();
         const currentYear = latestDate.getFullYear();
         periodLabel = latestDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
         daysPassed = latestDate.getDate();
         const lastDayOfObj = new Date(currentYear, currentMonth + 1, 0);
         daysRemaining = lastDayOfObj.getDate() - daysPassed;
         
         if (!filterStartDate && !filterEndDate) {
             const monthRdos = filteredRdos.filter(r => {
                const d = parseDate(r.date);
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
             });
             totalRevenueRealized = monthRdos.reduce((acc, r) => {
                const team = teams.find(t => t.id === r.teamId);
                const project = team ? projects.find(p => p.id === team.projectId) : undefined;
                return acc + calculateRDOTotal(r, project);
             }, 0);
         }
      }

      avgDailyRevenue = daysPassed > 0 ? totalRevenueRealized / daysPassed : 0;
      trendValue = avgDailyRevenue * daysRemaining;
      totalForecast = totalRevenueRealized + trendValue;
    }

    const chartData = Object.entries(filteredRdos.reduce((acc, rdo) => {
       const team = teams.find(t => t.id === rdo.teamId);
       const project = team ? projects.find(p => p.id === team.projectId) : undefined;
       const val = calculateRDOTotal(rdo, project);
       acc[rdo.date] = (acc[rdo.date] || 0) + val;
       return acc;
    }, {} as Record<string, number>)).map(([date, val]) => ({
       date, faturamento: val
    })).sort((a, b) => {
        const [da, ma, ya] = a.date.split('/').map(Number);
        const [db, mb, yb] = b.date.split('/').map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });

    const availableRegionals = Array.from(new Set(projects.map(p => p.regional || 'Sem Regional').filter(Boolean)));
    const availableProjects = projects.filter(p => filterRegional === 'all' || (p.regional || 'Sem Regional') === filterRegional);

    return (
      <div className="animate-fade-in space-y-8">
        <div className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row gap-6 items-end md:items-center justify-between shadow-2xl shadow-blue-900/10">
           <div className="flex flex-col md:flex-row gap-6 w-full">
              <div className="flex flex-col gap-2 w-full md:w-auto">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">De</label>
                 <input 
                   type="date" 
                   value={filterStartDate} 
                   onChange={e => setFilterStartDate(e.target.value)}
                   className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-slate-500"
                 />
              </div>
              <div className="flex flex-col gap-2 w-full md:w-auto">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Até</label>
                 <input 
                   type="date" 
                   value={filterEndDate} 
                   onChange={e => setFilterEndDate(e.target.value)}
                   className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-slate-500"
                 />
              </div>
              <div className="flex flex-col gap-2 w-full md:w-52">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Regional</label>
                 <select 
                   value={filterRegional} 
                   onChange={e => { setFilterRegional(e.target.value); setFilterProject('all'); setFilterTeam('all'); }}
                   className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all appearance-none cursor-pointer"
                 >
                   <option value="all" className="bg-slate-900">Todas</option>
                   {availableRegionals.map(r => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                 </select>
              </div>
              <div className="flex flex-col gap-2 w-full md:w-52">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Obra</label>
                  <select 
                    value={filterProject} 
                    onChange={e => { setFilterProject(e.target.value); setFilterTeam('all'); }}
                    className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="all" className="bg-slate-900">Todas</option>
                    {availableProjects.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
                  </select>
               </div>
               <div className="flex flex-col gap-2 w-full md:w-52">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Equipe</label>
                  <select 
                    value={filterTeam} 
                    onChange={e => setFilterTeam(e.target.value)}
                    className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="all" className="bg-slate-900">Todas</option>
                    {teams
                      .filter(t => filterProject === 'all' || t.projectId === filterProject)
                      .map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.name}</option>)
                    }
                  </select>
               </div>
           </div>
           
           <div className="flex gap-2">
              <button 
                 onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setFilterRegional('all'); setFilterProject('all'); setFilterTeam('all'); }}
                 className="p-3 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all duration-300"
                 title="Limpar Filtros"
              >
                 <Trash2 className="w-5 h-5" />
              </button>
           </div>
        </div>

        <div className="flex flex-col gap-1.5 ml-1">
          <h2 className="text-3xl font-bold text-white tracking-tight">Visão Geral Financeira</h2>
          <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            Compilado referente a <span className="text-blue-400 capitalize">{periodLabel}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-8 rounded-3xl relative overflow-hidden group revenue-card">
             <div className="absolute -right-4 -top-4 p-8 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all duration-500">
               <DollarSign className="w-24 h-24 text-blue-500" />
             </div>
             <div className="relative z-10">
               <p className="text-[11px] font-bold text-blue-400 uppercase tracking-[0.2em]">Total Faturado</p>
               <p className="text-4xl font-bold text-white mt-3 font-mono tracking-tight tabular-nums shimmer">
                 {formatMoney(totalRevenueRealized)}
               </p>
               <div className="mt-6 flex items-center gap-2">
                  <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-[70%] rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">REALIZADO</span>
               </div>
             </div>
          </div>

          <div className="glass-card p-8 rounded-3xl relative overflow-hidden group">
             <div className="absolute -right-4 -top-4 p-8 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all duration-500">
               <Activity className="w-24 h-24 text-emerald-500" />
             </div>
             <div className="relative z-10">
               <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Ticket Médio Diário</p>
               <p className="text-4xl font-bold text-white mt-3 font-mono tracking-tight tabular-nums">
                 {formatMoney(avgDailyRevenue)}
               </p>
               <p className="text-[10px] text-slate-500 mt-6 font-bold flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  ESTIMATIVA DE PERFORMANCE DIÁRIA
               </p>
             </div>
          </div>

          <div className="glass-card p-8 rounded-3xl relative overflow-hidden group border-gradient">
             <div className="absolute -right-4 -top-4 p-8 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all duration-500">
               <TrendingUp className="w-24 h-24 text-purple-500" />
             </div>
             <div className="relative z-10">
               <p className="text-[11px] font-bold text-purple-400 uppercase tracking-[0.2em]">Projeção Final</p>
               <p className="text-4xl font-bold text-white mt-3 font-mono tracking-tight tabular-nums">
                 {formatMoney(totalForecast)}
               </p>
               <div className="mt-6 flex items-center justify-between">
                 <span className="text-[10px] font-bold text-slate-500">RITMO ATUAL</span>
                 <span className="text-[10px] font-bold text-purple-400 px-2 py-0.5 bg-purple-500/10 rounded-full">
                   {formatMoney(trendValue)} residuais
                 </span>
               </div>
             </div>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-3xl border border-white/5">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold text-white flex items-center gap-3">
              <div className="bg-emerald-500/10 p-2 rounded-xl">
                <BarChart2 className="w-5 h-5 text-emerald-500" />
              </div>
              Fluxo de Produção
            </h3>
            <div className="px-4 py-1.5 bg-white/5 rounded-full border border-white/5">
               <span className="text-xs text-slate-400 font-medium">Acumulado: </span>
               <span className="text-xs font-bold text-white font-mono">{formatMoney(totalRevenueRealized)}</span>
            </div>
          </div>
          
          {chartData.length > 0 ? (
            <div className="h-80 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} 
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}}
                    tickFormatter={(val) => `R$${val/1000}k`} 
                  />
                  <RechartsTooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)', radius: 8}}
                    contentStyle={{
                      backgroundColor: '#1e293b', 
                      borderRadius: '16px', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.3)',
                      padding: '12px'
                    }}
                    itemStyle={{color: '#fff', fontSize: '12px', fontWeight: 'bold'}}
                    labelStyle={{color: '#94a3b8', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase'}}
                    formatter={(value: number) => [formatMoney(value), "Faturamento"]}
                  />
                  <Bar 
                    dataKey="faturamento" 
                    fill="url(#barGradient)" 
                    radius={[6, 6, 0, 0]} 
                    barSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.02]">
               <BarChart2 className="w-12 h-12 mb-4 text-white/5" />
               <p className="text-sm font-medium">Os filtros selecionados não retornaram dados financeiros.</p>
            </div>
          )}
        </div>

        <FinancialTable filteredRdos={filteredRdos} projects={projects} teams={teams} />
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50 font-inter overflow-hidden selection:bg-blue-500/30">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-blue-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="md:hidden glass-panel border-b border-white/5 p-4 flex items-center justify-between relative z-10">
           <div className="flex items-center gap-2">
             <div className="bg-gradient-premium p-1.5 rounded-lg">
                <BarChart2 className="w-5 h-5 text-white" />
             </div>
             <span className="font-bold text-white tracking-tight">RDO Pro</span>
           </div>
           <button 
             onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
             className="p-2 hover:bg-white/5 rounded-lg transition-colors"
           >
             {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
           </button>
        </div>
        <main className="flex-1 overflow-y-auto p-4 sm:p-10 relative z-10 custom-scrollbar">
           {activeMenu === 'DASHBOARD' && <FinancialDashboard />}
           {activeMenu === 'PROJECTS' && (
             <>
               <Breadcrumbs 
                 activeMenu={activeMenu}
                 currentView={currentView}
                 selectedProject={selectedProject}
                 selectedTeam={selectedTeam}
                 currentRDO={currentRDO}
                 onNavigateToProjects={() => { setCurrentView('PROJECT_LIST'); setSelectedProject(null); setSelectedTeam(null); setCurrentRDO(null); }}
                 onNavigateToTeams={() => { setCurrentView('TEAMS_LIST'); setSelectedTeam(null); setCurrentRDO(null); }}
                 onNavigateToRDOs={() => { setCurrentView('RDO_LIST'); setCurrentRDO(null); }}
               />

               {currentRDO ? (
                 <RDODetail 
                   currentRDO={currentRDO}
                   selectedProject={selectedProject}
                   selectedTeam={selectedTeam}
                   onClose={() => setCurrentRDO(null)}
                   onExportCSV={exportToCSV}
                   onDeleteRDO={deleteRDO}
                   onSaveUpdatedRdo={async () => {}}
                 />
               ) : (
                 <>
                   {currentView === 'PROJECT_LIST' && (
                     <ProjectList 
                       projects={projects}
                       teams={teams}
                       onSelectProject={handleSelectProject}
                       onEditProject={(p) => openEditModal(p, 'PROJECT')}
                       onDeleteProject={handleDeleteProject}
                       onCreateProject={openCreateModal}
                     />
                   )}

                   {currentView === 'TEAMS_LIST' && (
                     <>
                       <ProjectServices 
                         selectedProject={selectedProject}
                         projectTab={projectTab}
                         onSetTab={setProjectTab}
                         onServicesUpload={handleServicesUpload}
                       />
                       {projectTab === 'TEAMS' && (
                         <TeamList 
                           teams={teams}
                           rdos={rdos}
                           selectedProject={selectedProject}
                           onSelectTeam={handleSelectTeam}
                           onEditTeam={(t) => openEditModal(t, 'TEAM')}
                           onDeleteTeam={handleDeleteTeam}
                           onCreateTeam={openCreateModal}
                         />
                       )}
                      </>
                    )}

                   {currentView === 'RDO_LIST' && (
                     <RDOList 
                       rdos={rdos}
                       selectedTeam={selectedTeam}
                       selectedProject={selectedProject}
                       onSelectRDO={setCurrentRDO}
                       onExportCSV={exportToCSV}
                       onDeleteRDO={deleteRDO}
                       onUploadNew={() => setCurrentView('UPLOAD_ANALYSIS')}
                     />
                   )}

                   {currentView === 'UPLOAD_ANALYSIS' && (
                     <div className="max-w-2xl mx-auto mt-8 animate-fade-in text-center">
                       <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Análise Inteligente</h2>
                       <p className="text-slate-400 mb-8 font-medium">
                         Importando novos RDOs para <span className="text-blue-400">{selectedTeam?.name}</span>
                       </p>

                       <div className="relative group">
                         <input
                           type="file"
                           accept="image/*,application/pdf"
                           onChange={handleFileUpload}
                           disabled={loading}
                           multiple
                           className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                         />
                         <div className={`glass-panel border-2 border-dashed rounded-[40px] p-16 transition-all duration-500 ${loading ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/10 hover:border-blue-500/50 hover:bg-white/5 shadow-2xl'}`}>
                           <div className="flex flex-col items-center justify-center gap-6">
                             {loading ? (
                               <>
                                 <div className="relative">
                                   <div className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                   <div className="absolute inset-0 flex items-center justify-center">
                                      <Loader2 className="w-8 h-8 text-blue-500 animate-pulse" />
                                   </div>
                                 </div>
                                 <div className="flex flex-col gap-2 items-center">
                                    <div className="text-white font-black text-xl tracking-tight">Extraindo Dados...</div>
                                    <div className="text-blue-400 font-bold text-sm tracking-widest uppercase">{uploadProgress.current} DE {uploadProgress.total} COMPLETOS</div>
                                    <div className="w-64 h-2 bg-white/5 rounded-full mt-4 overflow-hidden border border-white/5 shadow-inner">
                                       <div 
                                         className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]" 
                                         style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                       />
                                    </div>
                                 </div>
                               </>
                             ) : (
                               <>
                                 <div className="p-8 bg-blue-500/10 rounded-full border border-blue-500/20 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-500 shadow-2xl">
                                   <Layers className="w-12 h-12 text-blue-400" />
                                 </div>
                                 <div>
                                   <p className="text-xl font-bold text-white tracking-tight">Arraste seus relatórios aqui</p>
                                   <p className="text-slate-500 font-medium mt-2">Suporta PDF e imagens em alta resolução</p>
                                   <div className="mt-8 px-6 py-2 bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] rounded-full border border-blue-500/10 inline-block">
                                      Processamento Seguro via Gemini AI
                                   </div>
                                 </div>
                               </>
                             )}
                           </div>
                         </div>
                       </div>
                       {error && (
                         <div className="mt-8 p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-3xl text-sm font-bold flex items-center gap-4 animate-shake">
                           <AlertTriangle className="w-6 h-6 shrink-0" />
                           {error}
                         </div>
                       )}
                     </div>
                   )}
                 </>
               )}
             </>
            )}
            {activeMenu === 'ANALYSIS' && (
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
            {activeMenu === 'CONTRACT_INTELLIGENCE' && (
              <ContractIntelligencePage 
                projects={projects}
                teams={teams}
                rdos={rdos}
                selectedProject={selectedProject}
                onSelectProject={setSelectedProject}
                onNavigateToRDO={(rdoId, teamId) => {
                  const rdo = rdos.find(r => r.id === rdoId);
                  const team = teams.find(t => t.id === teamId);
                  if (rdo && team && selectedProject) {
                    setActiveMenu('PROJECTS');
                    setSelectedTeam(team);
                    setCurrentRDO(rdo);
                  }
                }}
              />
            )}
        </main>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6">
              {isEditMode ? 'Editar' : 'Criar'} {currentView === 'PROJECT_LIST' ? 'Obra' : 'Equipe'}
            </h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                <input autoFocus type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900" />
              </div>
              {currentView === 'PROJECT_LIST' && (
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Regional</label><input type="text" value={newItemRegional} onChange={(e) => setNewItemRegional(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800" /></div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button onClick={() => currentView === 'PROJECT_LIST' ? handleSaveProject() : handleSaveTeam()} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">{isEditMode ? 'Salvar' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
