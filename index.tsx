import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Task, User, TaskStatus, HelpChainLevel, HistoryLog, Notification, TaskOutcome } from './types';
import { TaskCard } from './components/TaskCard';
import { TaskForm } from './components/TaskForm';
import { KanbanBoard } from './components/KanbanBoard';
import { EscalationSettings } from './components/EscalationSettings';
import { HistoryPanel } from './components/HistoryPanel';
import { Layout, LayoutDashboard, PlusCircle, Filter, Bell, Bot, Settings, LogOut, Columns, List, TrendingUp, AlertTriangle, CheckCircle, Calendar, DollarSign, Activity, Users, ChevronDown } from 'lucide-react';
import { draftEscalationEmail } from './services/geminiService';
import { isPast, format, startOfYear, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// FIREBASE
import { db } from './services/firebaseConfig';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query } from 'firebase/firestore';

// --- MOCK DATA ---
const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Antonio Augusto da Silva', role: 'Analista Comercial', email: 'antonio.silva@grupodr.com.br' },
  { id: 'u2', name: 'Cintia Ferreira', role: 'Engenheira Orçamentista', email: 'cintia.ferreira@grupodr.com.br' },
  { id: 'u3', name: 'Tatiana Guimarães', role: 'Engenheira Auxiliar', email: 'tatiana.guimaraes@grupodr.com.br' },
  { id: 'u4', name: 'Nilton Camilo', role: 'Gerente Comercial', email: 'nilton.camilo@grupodr.com.br' },
];

const INITIAL_CHAIN: HelpChainLevel[] = [
  { level: 1, roleName: 'Gerente Comercial', contactEmail: 'gerente@construtora.com', triggerDaysBefore: 1, triggerWhenLate: true },
  { level: 2, roleName: 'Diretor de Operações', contactEmail: 'diretor@construtora.com', triggerDaysBefore: 0, triggerWhenLate: true },
];

// Função utilitária para remover chaves undefined recursivamente
const stripUndefined = (obj: any): any => {
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) {
    return obj.map(v => stripUndefined(v));
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const value = obj[key];
      if (value !== undefined) {
        acc[key] = stripUndefined(value);
      }
      return acc;
    }, {} as any);
  }
  return obj;
};

const App: React.FC = () => {
  // --- STATE ---
  const [tasks, setTasks] = useState<Task[]>([]);

  // FIREBASE SYNC
  useEffect(() => {
    const q = query(collection(db, 'tasks'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedTasks: Task[] = snapshot.docs.map(doc => {
        const data = doc.data();

        // FIX: Robust Date Conversion to prevent NaNd
        const convertDate = (val: any) => {
          if (!val) return new Date();
          if (typeof val.toDate === 'function') {
            return val.toDate(); // Firestore Timestamp
          }
          if (val instanceof Date) {
            return val;
          }
          // RESILIENCE CHECK: Handle empty objects {} caused by recursion bug
          if (typeof val === 'object' && Object.keys(val).length === 0) {
            return new Date();
          }
          const parsed = new Date(val);
          // FIX: Fallback to Year 2000 to make errors visible
          return isNaN(parsed.getTime()) ? new Date(2000, 0, 1) : parsed;
        };

        return {
          id: doc.id,
          ...data,
          startDate: convertDate(data.startDate),
          endDate: convertDate(data.endDate),
        } as Task;
      });
      setTasks(loadedTasks);
    });
    return () => unsubscribe();
  }, []);
  const [helpChain, setHelpChain] = useState<HelpChainLevel[]>(INITIAL_CHAIN);
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0]);
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // UI State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [view, setView] = useState<'DASHBOARD' | 'STRATEGIC' | 'OPERATIONAL' | 'SETTINGS'>('DASHBOARD');
  // viewMode is no longer toggleable by user, but defined by the View
  const [viewMode, setViewMode] = useState<'GRID' | 'KANBAN'>('KANBAN');

  // Filters
  // FIX: Initial filter includes Last Month (Dec 2025) for Dashboard visibility in Jan
  const [timeFilterType, setTimeFilterType] = useState<'MONTH' | 'YTD' | 'CUSTOM'>('CUSTOM');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Custom range defaults to Last Month + Current Month
  const [customRange, setCustomRange] = useState<{ start: Date, end: Date }>({
    start: startOfMonth(new Date(new Date().setMonth(new Date().getMonth() - 1))), // Previous Month Start
    end: endOfMonth(new Date())
  });
  const [geminiLoading, setGeminiLoading] = useState(false);


  // --- ACTIONS ---
  const addLog = (taskId: string, action: string, details?: string) => {
    const newLog: HistoryLog = {
      id: Math.random().toString(36).substr(2, 9),
      taskId,
      action,
      details,
      timestamp: new Date(),
      user: currentUser.name
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const addNotification = (notif: Omit<Notification, 'id' | 'sentAt'>) => {
    const newNotif: Notification = {
      ...notif,
      id: Math.random().toString(36).substr(2, 9),
      sentAt: new Date(),
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    try {
      // Remove qualquer campo undefined remanescente antes de enviar
      const cleanData = stripUndefined(taskData);

      if (editingTask) {
        const taskRef = doc(db, 'tasks', editingTask.id);
        await updateDoc(taskRef, { ...cleanData });
        addLog(editingTask.id, 'Tarefa Atualizada', `Status: ${cleanData.status}`);
      } else {
        const newTaskData = {
          ...cleanData,
          status: TaskStatus.PENDING,
          progress: 0,
          outcome: null // null é aceito pelo Firestore, undefined não
        };

        // Garante limpeza final no objeto completo
        const finalDocData = stripUndefined(newTaskData);

        const docRef = await addDoc(collection(db, 'tasks'), finalDocData);

        addLog(docRef.id, 'Tarefa Criada');
        addNotification({
          taskId: docRef.id,
          taskTitle: finalDocData.title as string,
          type: 'START',
          recipient: MOCK_USERS.find(u => u.id === finalDocData.assigneeId)?.email || 'admin',
          subject: `Nova Tarefa Atribuída: ${finalDocData.title}`
        });
      }
      setEditingTask(undefined);
    } catch (error) {
      console.error("Error saving task:", error);
      alert("Erro ao salvar tarefa. Verifique o console para mais detalhes.");
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const updates: any = { status: newStatus };

      // Business Rule: If Mother Task moves from COMPLETED to another status, reset outcome
      if (task.status === TaskStatus.COMPLETED && newStatus !== TaskStatus.COMPLETED && !task.parentId) {
        updates.outcome = null;
      }

      // Check for completion logic
      if (newStatus === TaskStatus.COMPLETED) {
        if (!task.parentId && !task.outcome) {
          // Need outcome for Mother tasks when completing
          setTimeout(() => {
            setEditingTask({ ...task, status: newStatus });
            setIsTaskModalOpen(true);
          }, 100);
          return;
        }

        updates.progress = 100;
        addNotification({
          taskId: task.id,
          taskTitle: task.title,
          type: 'END',
          recipient: 'equipe@construtora.com',
          subject: `Tarefa Concluída: ${task.title}`
        });
        addLog(taskId, 'Tarefa Finalizada');
      }

      await updateDoc(doc(db, 'tasks', taskId), updates);

    } catch (e) {
      console.error(e);
      alert("Erro ao atualizar status.");
    }
  };

  const handleGeminiAnalysis = async () => {
    setGeminiLoading(true);
    // Simulating Analysis
    setTimeout(() => {
      setGeminiLoading(false);
      alert('Análise da IA completa. Verifique o painel de Histórico/Emails.');
    }, 2000);
  };

  // --- FILTER LOGIC ---
  const getFilteredTasks = (sourceTasks: Task[]) => {
    const start = timeFilterType === 'MONTH' ? startOfMonth(selectedDate) :
      timeFilterType === 'YTD' ? startOfYear(selectedDate) : customRange.start;
    const end = timeFilterType === 'MONTH' ? endOfMonth(selectedDate) :
      timeFilterType === 'YTD' ? new Date() : customRange.end;

    return sourceTasks.filter(t => isWithinInterval(new Date(t.startDate), { start, end }));
  };

  const timeFilteredTasks = getFilteredTasks(tasks);
  const motherTasks = tasks.filter(t => !t.parentId); // All mothers
  const childTasks = tasks.filter(t => !!t.parentId); // All children

  // View Filtering for Kanban/List
  const hierarchyScan = useMemo(() => {
    return {
      mothers: motherTasks,
      children: childTasks
    };
  }, [tasks]);

  // --- STATISTICS ENGINE ---
  const calculateMetrics = (taskList: Task[]) => {
    const total = taskList.length;
    const pending = taskList.filter(t => t.status === TaskStatus.PENDING).length;
    const inProgress = taskList.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const late = taskList.filter(t => t.status === TaskStatus.LATE).length;
    const completed = taskList.filter(t => t.status === TaskStatus.COMPLETED).length;

    const productivity = total > 0 ? Math.round((completed / total) * 100) : 0;
    // Risk: Late + tasks with warnings (simulated as 10% of in progress)
    const riskCount = late;
    const riskRate = total > 0 ? Math.round((riskCount / total) * 100) : 0;

    return { total, pending, inProgress, late, completed, productivity, riskRate };
  };

  const dashboardStats = useMemo(() => {
    // 1. Single Pass Filter by Time
    const relevantTasks = getFilteredTasks(tasks);

    // 2. Separate Mothers/Children from ALREADY filtered list
    const relevantMothers = relevantTasks.filter(t => !t.parentId);
    const relevantChildren = relevantTasks.filter(t => !!t.parentId);

    // 3. Calculate Metrics (Reused function)
    const strategic = calculateMetrics(relevantMothers);
    const operational = calculateMetrics(relevantChildren);

    // 4. Financials - Optimized Single Reduce
    const outcomes = relevantMothers.reduce((acc, mother) => {
      // Sum value of CHILDREN that are 'Proposta Comercial' for this mother
      const motherValue = tasks // checking against ALL tasks to find children
        .filter(child => child.parentId === mother.id && child.category === 'Proposta Comercial')
        .reduce((sum, child) => sum + (child.value || 0), 0);

      if (mother.outcome === TaskOutcome.SUCCESS) acc.success += motherValue;
      if (mother.outcome === TaskOutcome.FAILURE) acc.failure += motherValue;
      if (mother.outcome === TaskOutcome.STUDY) acc.study += motherValue;
      if (mother.outcome === TaskOutcome.WITHDRAWAL) acc.withdrawal += motherValue;

      return acc;
    }, { success: 0, failure: 0, study: 0, withdrawal: 0 });

    // 5. Collaborators - Optimized Single Reduce Logic
    const collaborators = MOCK_USERS.map(user => {
      // Logic: Iterate through RELEVANT tasks (time filtered) ONCE
      const userTasks = relevantTasks.filter(t => t.assigneeId === user.id);
      const metrics = calculateMetrics(userTasks);
      return { user, ...metrics };
    });

    return { strategic, operational, outcomes, collaborators };
  }, [tasks, timeFilterType, selectedDate, customRange]);


  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800 font-sans">

      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0 hidden md:flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold tracking-tight">Kanban <span className="text-blue-400">DR Construtora</span></h1>
          <p className="text-xs text-slate-400 mt-1">Gestão Comercial</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setView('DASHBOARD')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors ${view === 'DASHBOARD' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <TrendingUp size={20} /> Dashboard
          </button>
          <button
            onClick={() => setView('STRATEGIC')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors ${view === 'STRATEGIC' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Activity size={20} /> Estratégico (Mães)
          </button>
          <button
            onClick={() => setView('OPERATIONAL')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors ${view === 'OPERATIONAL' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <List size={20} /> Operacional (Filhas)
          </button>
          <button
            onClick={() => setView('SETTINGS')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors ${view === 'SETTINGS' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Settings size={20} /> Cadeia de Ajuda
          </button>
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium">{currentUser.name}</p>
              <p className="text-xs text-slate-400">{currentUser.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center gap-4">
            {/* VIEW TITLE */}
            <h2 className="text-lg font-bold text-slate-700 mr-4">
              {view === 'DASHBOARD' ? 'Visão Executiva' :
                view === 'STRATEGIC' ? 'Estratégico (Mães)' :
                  view === 'OPERATIONAL' ? 'Operacional (Filhas)' : 'Configurações'}
            </h2>

            {/* TIME FILTERS */}
            {view === 'DASHBOARD' && (
              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => setTimeFilterType('MONTH')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${timeFilterType === 'MONTH' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Mês
                </button>
                <button
                  onClick={() => setTimeFilterType('YTD')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${timeFilterType === 'YTD' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Ano (YTD)
                </button>
                <button
                  onClick={() => setTimeFilterType('CUSTOM')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${timeFilterType === 'CUSTOM' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Intervalo
                </button>
              </div>
            )}

            {/* DATE PICKER */}
            {view === 'DASHBOARD' && timeFilterType === 'MONTH' && (
              <input
                type="month"
                className="bg-white border border-slate-200 rounded-md text-sm p-1"
                value={format(selectedDate, 'yyyy-MM')}
                onChange={(e) => setSelectedDate(new Date(e.target.value + '-01T00:00:00'))}
              />
            )}
            {/* Simplified custom range for demo */}
            {view === 'DASHBOARD' && timeFilterType === 'CUSTOM' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="bg-white border border-slate-200 rounded-md text-sm p-1"
                  value={format(customRange.start, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    if (!isNaN(date.getTime())) setCustomRange(prev => ({ ...prev, start: date }));
                  }}
                />
                <span className="text-slate-400">-</span>
                <input
                  type="date"
                  className="bg-white border border-slate-200 rounded-md text-sm p-1"
                  value={format(customRange.end, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    if (!isNaN(date.getTime())) setCustomRange(prev => ({ ...prev, end: date }));
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex actions gap-3">
            <button
              onClick={() => { setEditingTask(undefined); setIsTaskModalOpen(true); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold shadow hover:bg-blue-700 transition-colors"
            >
              <PlusCircle size={16} /> Nova Tarefa
            </button>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">

          {view === 'DASHBOARD' && (
            <div className="max-w-7xl mx-auto space-y-6">

              {/* SPLIT DASHBOARD LAYOUT */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* LEFT COLUMN: STRATEGIC (MOTHERS) */}
                <div className="space-y-4 border border-slate-300 bg-white rounded-xl p-4 shadow-sm">
                  <h3 className="flex items-center gap-2 font-bold text-slate-800 text-lg border-b pb-2">
                    <Activity className="text-blue-600" size={20} /> Estratégico (Ações Mãe)
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl shadow-sm border-l-4 border-l-slate-400">
                      <span className="text-slate-500 text-xs font-bold uppercase">Pendentes</span>
                      <p className="text-2xl font-bold">{dashboardStats.strategic.pending}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl shadow-sm border-l-4 border-l-blue-500">
                      <span className="text-slate-500 text-xs font-bold uppercase">Em Andamento</span>
                      <p className="text-2xl font-bold text-blue-600">{dashboardStats.strategic.inProgress}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl shadow-sm border-l-4 border-l-red-500">
                      <span className="text-slate-500 text-xs font-bold uppercase">Atrasadas / Críticas</span>
                      <p className="text-2xl font-bold text-red-600">{dashboardStats.strategic.late}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl shadow-sm border-l-4 border-l-green-500">
                      <span className="text-slate-500 text-xs font-bold uppercase">Concluídas</span>
                      <p className="text-2xl font-bold text-green-600">{dashboardStats.strategic.completed}</p>
                    </div>
                  </div>

                  {/* METRICS CARDS */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Produtividade</p>
                        <p className="text-xl font-bold text-slate-800">{dashboardStats.strategic.productivity}%</p>
                      </div>
                      <TrendingUp size={24} className="text-green-500" />
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Risco Global</p>
                        <p className="text-xl font-bold text-red-600">{dashboardStats.strategic.riskRate}%</p>
                      </div>
                      <AlertTriangle size={24} className="text-red-500" />
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: OPERATIONAL (CHILDREN) */}
                <div className="space-y-4 border border-slate-300 bg-white rounded-xl p-4 shadow-sm">
                  <h3 className="flex items-center gap-2 font-bold text-slate-800 text-lg border-b pb-2">
                    <List className="text-emerald-600" size={20} /> Operacional (Ações Filhas)
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl shadow-sm border-l-4 border-l-slate-400">
                      <span className="text-slate-500 text-xs font-bold uppercase">Pendentes</span>
                      <p className="text-2xl font-bold">{dashboardStats.operational.pending}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl shadow-sm border-l-4 border-l-blue-500">
                      <span className="text-slate-500 text-xs font-bold uppercase">Em Andamento</span>
                      <p className="text-2xl font-bold text-blue-600">{dashboardStats.operational.inProgress}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl shadow-sm border-l-4 border-l-red-500">
                      <span className="text-slate-500 text-xs font-bold uppercase">Atrasadas</span>
                      <p className="text-2xl font-bold text-red-600">{dashboardStats.operational.late}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl shadow-sm border-l-4 border-l-green-500">
                      <span className="text-slate-500 text-xs font-bold uppercase">Concluídas</span>
                      <p className="text-2xl font-bold text-green-600">{dashboardStats.operational.completed}</p>
                    </div>
                  </div>

                  {/* METRICS CARDS */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Produtividade</p>
                        <p className="text-xl font-bold text-slate-800">{dashboardStats.operational.productivity}%</p>
                      </div>
                      <TrendingUp size={24} className="text-green-500" />
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Gargalos</p>
                        <p className="text-xl font-bold text-orange-600">{dashboardStats.operational.riskRate}%</p>
                      </div>
                      <AlertTriangle size={24} className="text-orange-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* FINANCIAL OUTCOME SECTION */}
              <div className="bg-slate-200 h-px w-full my-6"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                  <div className="flex items-center gap-2 mb-2 text-green-800">
                    <CheckCircle size={18} /> <span className="font-bold text-sm">Sucesso (Vencemos)</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700">R$ {dashboardStats.outcomes.success.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
                  <div className="flex items-center gap-2 mb-2 text-red-800">
                    <AlertTriangle size={18} /> <span className="font-bold text-sm">Insucesso (Perdemos)</span>
                  </div>
                  <p className="text-2xl font-bold text-red-700">R$ {dashboardStats.outcomes.failure.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-2 mb-2 text-blue-800">
                    <Bot size={18} /> <span className="font-bold text-sm">Estudo (Análise)</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">R$ {dashboardStats.outcomes.study.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 mb-2 text-slate-800">
                    <LogOut size={18} /> <span className="font-bold text-sm">Desistência</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-700">R$ {dashboardStats.outcomes.withdrawal.toLocaleString()}</p>
                </div>
              </div>

              {/* COLLABORATOR TABLE */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                  <Users size={18} className="text-slate-500" />
                  <h3 className="font-bold text-slate-700">Desempenho por Colaborador</h3>
                </div>
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                    <tr>
                      <th className="px-6 py-3">Colaborador</th>
                      <th className="px-6 py-3 text-center">Total Ações</th>
                      <th className="px-6 py-3 text-center text-blue-600">Em Andamento</th>
                      <th className="px-6 py-3 text-center text-red-600">Atrasadas</th>
                      <th className="px-6 py-3 text-center text-green-600">Concluídas</th>
                      <th className="px-6 py-3 text-center">Produtividade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardStats.collaborators.map((col, idx) => (
                      <tr key={col.user.id} className="border-b hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800">{col.user.name}</td>
                        <td className="px-6 py-4 text-center font-bold">{col.total}</td>
                        <td className="px-6 py-4 text-center">{col.inProgress}</td>
                        <td className="px-6 py-4 text-center font-bold text-red-600">{col.late}</td>
                        <td className="px-6 py-4 text-center font-bold text-green-600">{col.completed}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="w-full bg-slate-200 rounded-full h-1.5 dark:bg-gray-700 max-w-[100px] mx-auto">
                            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${col.productivity}%` }}></div>
                          </div>
                          <span className="text-xs text-slate-500 mt-1 block">{col.productivity}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STRATEGIC VIEW (MOTHERS) */}
          {view === 'STRATEGIC' && (
            <div className="p-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4">
                  <Activity size={18} className="text-purple-600" /> Ações Mãe (Estratégico)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hierarchyScan.mothers.map(t => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      assignee={MOCK_USERS.find(u => u.id === t.assigneeId)}
                      childTasks={hierarchyScan.children.filter(c => c.parentId === t.id)}
                      onEdit={(x) => { setEditingTask(x); setIsTaskModalOpen(true); }}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                  {hierarchyScan.mothers.length === 0 && (
                    <p className="col-span-3 text-center text-slate-400 py-8">Nenhuma ação mãe encontrada.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* OPERATIONAL VIEW (CHILDREN) */}
          {view === 'OPERATIONAL' && (
            <div className="flex-1 overflow-hidden p-6 bg-slate-50 h-full">
              <div className="h-full bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <List size={18} className="text-blue-600" /> Ações Filhas (Operacional)
                  </h3>
                </div>
                <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 bg-slate-50/50">
                  <KanbanBoard
                    tasks={hierarchyScan.children}
                    users={MOCK_USERS}
                    onStatusChange={handleStatusChange}
                    onEdit={(t) => { setEditingTask(t); setIsTaskModalOpen(true); }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS VIEW */}
          {view === 'SETTINGS' && (
            <div className="max-w-4xl mx-auto">
              <EscalationSettings chain={helpChain} onSave={setHelpChain} />
            </div>
          )}
        </div>

      </main>

      {/* MODALS */}
      <TaskForm
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        users={MOCK_USERS}
        availableParents={motherTasks}
        initialData={editingTask}
      />

    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);