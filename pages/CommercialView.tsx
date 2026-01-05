import React, { useState, useEffect, useMemo } from 'react';
import { Task, User, TaskStatus, HelpChainLevel, HistoryLog, Notification, TaskOutcome, Opportunity, PipelineStage } from '../types';
import { TaskForm } from '../components/TaskForm';
import { OpportunityForm } from '../components/Pipeline/OpportunityForm';

import { PipelineBoard } from '../components/Pipeline/PipelineBoard';
import { EscalationSettings } from '../components/EscalationSettings';
import { HistoryPanel } from '../components/HistoryPanel';
import { Layout, LayoutDashboard, PlusCircle, Filter, Bell, Bot, Settings, LogOut, Columns, List, TrendingUp, AlertTriangle, CheckCircle, Calendar, DollarSign, Activity, Users, ChevronDown, Link as LinkIcon, X } from 'lucide-react';
import { draftEscalationEmail, draftWelcomeEmail } from '../services/geminiService';
import { OpportunityService } from '../services/opportunityService';
import { UserService } from '../services/userService';
import { isPast, format, startOfYear, isWithinInterval, startOfMonth, endOfMonth, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line } from 'recharts';
import { Toaster, toast } from 'sonner';
import { useSearchParams, useNavigate } from 'react-router-dom';

// THEME COLORS
const COLORS = {
    success: '#22c55e', // green-500
    failure: '#ef4444', // red-500
    study: '#3b82f6',   // blue-500
    withdrawal: '#64748b' // slate-500
};

// FIREBASE
import { db } from '../services/firebaseConfig';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, Timestamp } from 'firebase/firestore';

// --- MOCK DATA ---
const MOCK_USERS: User[] = [
    { id: 'u1', name: 'Antonio Augusto da Silva', role: 'Analista Comercial', email: 'antonio.silva@grupodr.com.br' },
    { id: 'u2', name: 'Cintia Ferreira', role: 'Engenheira Orçamentista', email: 'cintia.ferreira@grupodr.com.br' },
    { id: 'u3', name: 'Tatiana Guimarães', role: 'Engenheira Auxiliar', email: 'tatiana.guimaraes@grupodr.com.br' },
    { id: 'u4', name: 'Nilton Camilo', role: 'Gerente Comercial', email: 'nilton.camilo@grupodr.com.br' },
    { id: 'u5', name: 'Maria Tereza', role: 'Engenheiro Trainee', email: 'maria.tereza@grupodr.com.br' },
    { id: 'u6', name: 'Isabela Costa', role: 'Assistente Comercial', email: 'isabela.costa@grupodr.com.br' },
    { id: 'u7', name: 'Fabiana Fernandes', role: 'Analista Comercial Jr', email: 'fabiana.fernandes@grupodr.com.br' },
    { id: 'u8', name: 'Clara Santos', role: 'Jovem Aprendiz', email: 'clara.santos@grupodr.com.br' },
];

const INITIAL_CHAIN: HelpChainLevel[] = [
    { level: 1, roleName: 'Gerente Comercial', contactEmail: 'gerente@construtora.com', triggerDaysBefore: 1, triggerWhenLate: true },
    { level: 2, roleName: 'Diretor de Operações', contactEmail: 'diretor@construtora.com', triggerDaysBefore: 0, triggerWhenLate: true },
];

// Helper to remove undefined keys recursively
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

// NEW: Ingestion Shielding Helper
const safeData = (v: any) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object' && Object.keys(v).length === 0) return '';
    return v;
};

// HELPER: Strict String
const s = (v: any) => typeof v === 'string' ? v : '';
// HELPER: Strict Number
const n = (v: any) => typeof v === 'number' ? v : 0;

export const CommercialView: React.FC = () => {
    // --- STATE ---
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const contractIdFilter = searchParams.get('contractId');
    const solutionIdFilter = searchParams.get('solutionId');
    const kpiIdFilter = searchParams.get('kpiId');

    // MOCK LOGIN for now
    const currentUser = MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)];

    // VIEW STATE
    const [view, setView] = useState<'DASHBOARD' | 'STRATEGIC' | 'SETTINGS'>('DASHBOARD');
    const [tasks, setTasks] = useState<Task[]>([]);
    // NEW: Lifted Opportunities State
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

    // FIREBASE SYNC TASKS
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
                    if (val && typeof val.seconds === 'number') {
                        return new Date(val.seconds * 1000); // Raw Firestore Timestamp object
                    }
                    if (val instanceof Date) {
                        return val;
                    }
                    // RESILIENCE CHECK: Handle empty objects {} caused by recursion bug
                    if (typeof val === 'object' && Object.keys(val).length === 0) {
                        return new Date();
                    }
                    // Handle invalid types passed as dates
                    if (typeof val !== 'string' && typeof val !== 'number' && !(val instanceof Date) && typeof val.toDate !== 'function') {
                        return new Date();
                    }

                    const parsed = new Date(val);
                    // FIX: Fallback to Year 2000 to make errors visible
                    return isNaN(parsed.getTime()) ? new Date(2000, 0, 1) : parsed;
                };

                // HELPER: Strict String
                const s = (v: any) => typeof v === 'string' ? v : '';
                // HELPER: Strict Number
                const n = (v: any) => typeof v === 'number' ? v : 0;

                return {
                    id: String(doc.id),
                    ...data,
                    // DATA SHIELDING
                    title: s(data.title),
                    description: s(data.description),
                    clientName: s(data.clientName),
                    proposalName: s(data.proposalName),
                    category: '', // REMOVED CATEGORY FEATURE: Force empty
                    observations: s(data.observations),
                    assigneeId: s(data.assigneeId),
                    responsibleName: s(data.responsibleName),
                    opportunityId: s(data.opportunityId),

                    value: n(data.value),

                    startDate: convertDate(data.startDate),
                    endDate: convertDate(data.endDate),
                } as Task;
            });
            setTasks(loadedTasks);
        });
        return () => unsubscribe();
    }, []);

    // NEW: FETCH OPPORTUNITIES
    const fetchOpportunities = async () => {
        try {
            const data = await OpportunityService.getAll();

            // DOUBLE CHECK: Extra Layer of Sanitation before State
            // Helper s() duplicated here for safety in this scope or define globally
            const s = (v: any) => typeof v === 'string' ? v : '';

            const sanitizedData = data.map(op => ({
                ...op,
                title: s(op.title),
                clientName: s(op.clientName),
            }));

            setOpportunities(sanitizedData);
        } catch (e) {
            console.error("Error fetching opportunities", e);
            toast.error("Erro ao carregar pipeline.");
        }
    };

    // NEW: User State
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        const loadUsers = async () => {
            try {
                const data = await UserService.getAll();
                setUsers(data);
            } catch (e) {
                console.error("Error loading users", e);
            }
        };
        loadUsers();
    }, []);

    useEffect(() => {
        const load = async () => {
            await fetchOpportunities();
        };
        load();
    }, []);

    const [helpChain, setHelpChain] = useState<HelpChainLevel[]>(INITIAL_CHAIN);
    // currentUser state lifted to top
    const [logs, setLogs] = useState<HistoryLog[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // UI State
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
    const [taskFormMode, setTaskFormMode] = useState<'FULL' | 'QUICK_EDIT'>('FULL'); // NEW State
    // NEW OPPORTUNITY STATE
    const [isOpportunityModalOpen, setIsOpportunityModalOpen] = useState(false);
    const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | undefined>(undefined);

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    // view state lifted to top
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

            // FIX: Ensure Dates are converted to Firestore Timestamps for consistency
            if (cleanData.startDate instanceof Date) cleanData.startDate = Timestamp.fromDate(cleanData.startDate);
            if (cleanData.endDate instanceof Date) cleanData.endDate = Timestamp.fromDate(cleanData.endDate);

            if (editingTask) {
                const taskRef = doc(db, 'tasks', editingTask.id);
                await updateDoc(taskRef, { ...cleanData });
                addLog(editingTask.id, 'Tarefa Atualizada', `Status: ${cleanData.status}`);
                toast.success("Tarefa atualizada com sucesso!");
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

                // --- GEMINI WELCOME EMAIL TRIGGER ---
                const assigneeName = MOCK_USERS.find(u => u.id === finalDocData.assigneeId)?.name || 'Colaborador';
                const assigneeEmail = MOCK_USERS.find(u => u.id === finalDocData.assigneeId)?.email || 'admin';

                // Create full Task object for the function
                const taskForEmail = { ...finalDocData, id: docRef.id } as Task;

                // Async call - does not block UI
                draftWelcomeEmail(taskForEmail, assigneeName).then(emailContent => {
                    addNotification({
                        taskId: docRef.id,
                        taskTitle: finalDocData.title as string,
                        type: 'START',
                        recipient: assigneeEmail,
                        subject: `Nova Tarefa Atribuída: ${finalDocData.title}`,
                        content: emailContent
                    });
                    toast.info("Rascunho de e-mail gerado com sucesso!", { description: "Verifique o painel de notificações." });
                });

                toast.success("Tarefa criada com sucesso!");
            }
            setEditingTask(undefined);
        } catch (error) {
            console.error("Error saving task:", error);
            toast.error("Erro ao salvar tarefa.", { description: "Verifique sua conexão." });
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

        return sourceTasks.filter(t => {
            const taskStart = new Date(t.startDate);
            const taskEnd = new Date(t.endDate);

            if (isNaN(taskStart.getTime())) return false;

            // FIX: Check for OVERLAP instead of just Start Date to include active long-running tasks
            // Overlap formula: (StartA <= EndB) and (EndA >= StartB)
            return taskStart <= end && taskEnd >= start;
        });
    };

    const timeFilteredTasks = getFilteredTasks(tasks);

    // NEW: Filter by Contract ID if present
    const childTasks = tasks.filter(t => {
        if (contractIdFilter) {
            // Strict Contract Filter
            return t.contractId === contractIdFilter;
        }
        if (solutionIdFilter) {
            // Strict Solution Filter
            return t.solutionId === solutionIdFilter;
        }
        if (kpiIdFilter) {
            // Strict KPI Filter
            return t.kpiId === kpiIdFilter;
        }
        // Default Operational View: Children OR Pipeline Actions
        return !!t.parentId || !!t.opportunityId || (!!t.solutionId && !t.parentId && !t.opportunityId) || (!!t.kpiId && !t.parentId && !t.opportunityId);
        // Note: Solutions might have standalone tasks, so including !t.solutionId logic in standard view
    });

    // FIX: Strategic View only includes Legacy Mothers (No parent, No opportunity)
    const motherTasks = tasks.filter(t => !t.parentId && !t.opportunityId);

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
        // 1. Single Pass Filter by Time for Tasks
        const relevantTasks = getFilteredTasks(tasks);

        // 2. Separate Mothers/Children from ALREADY filtered list
        const relevantChildren = relevantTasks.filter(t => !!t.parentId || !!t.opportunityId);

        // NEW: Strategic Stats now include Pipeline Opportunities
        // Strategic = Legacy Mothers + Pipeline Opportunities
        // For Ops, we use relevantMothers from Tasks (Legacy) + All Opportunities (Pipeline)
        // Pipeline Opportunities usually don't have "Start/End" in the same way, but we can filter by UpdatedAt or similar if needed. 
        // For now, let's include ALL Opportunities or filter them similarly? 
        // The prompt implies we want to see Pipeline Stats in "Estratégico".

        const relevantMothers = relevantTasks.filter(t => !t.parentId && !t.opportunityId);

        // Filter Opportunities by Time (using UpdatedAt or CreatedAt as proxy for activity)
        // Or just use all acceptable as "Active" pipeline
        const start = timeFilterType === 'MONTH' ? startOfMonth(selectedDate) :
            timeFilterType === 'YTD' ? startOfYear(selectedDate) : customRange.start;
        const end = timeFilterType === 'MONTH' ? endOfMonth(selectedDate) :
            timeFilterType === 'YTD' ? new Date() : customRange.end;

        const relevantOpportunities = opportunities.filter(op => {
            const opDate = new Date(op.updatedAt || op.createdAt);
            return opDate >= start && opDate <= end;
        });

        // Calculate Strategic Metrics (Legacy + Opportunities)
        const strategicLegacy = calculateMetrics(relevantMothers);
        const strategicPipeline = {
            pending: relevantOpportunities.filter(op => {
                const isCompleted = op.pipelineStage === PipelineStage.RESULTADO || op.status === 'GANHA' || op.status === 'PERDIDA';
                return !isCompleted && op.pipelineStage === PipelineStage.LEAD_RECEBIDO;
            }).length,
            inProgress: relevantOpportunities.filter(op => {
                const isCompleted = op.pipelineStage === PipelineStage.RESULTADO || op.status === 'GANHA' || op.status === 'PERDIDA';
                const isPending = op.pipelineStage === PipelineStage.LEAD_RECEBIDO;
                const isLate = isPast(new Date(op.deadline));
                return !isCompleted && !isPending && !isLate;
            }).length,
            late: relevantOpportunities.filter(op => {
                const isCompleted = op.pipelineStage === PipelineStage.RESULTADO || op.status === 'GANHA' || op.status === 'PERDIDA';
                const isPending = op.pipelineStage === PipelineStage.LEAD_RECEBIDO;
                return !isCompleted && !isPending && isPast(new Date(op.deadline));
            }).length,
            completed: relevantOpportunities.filter(op => op.status === 'GANHA' || op.status === 'PERDIDA' || op.pipelineStage === PipelineStage.RESULTADO).length,
            total: relevantOpportunities.length
        };

        // Combine Strategic
        const strategic = {
            pending: strategicLegacy.pending + strategicPipeline.pending,
            inProgress: strategicLegacy.inProgress + strategicPipeline.inProgress,
            late: strategicLegacy.late + strategicPipeline.late,
            completed: strategicLegacy.completed + strategicPipeline.completed,
            productivity: 0, // Recalc below
            riskRate: 0 // Recalc below
        };
        const totalStrategic = strategic.pending + strategic.inProgress + strategic.late + strategic.completed;
        strategic.productivity = totalStrategic > 0 ? Math.round((strategic.completed / totalStrategic) * 100) : 0;
        strategic.riskRate = totalStrategic > 0 ? Math.round((strategic.late / totalStrategic) * 100) : 0;

        const operational = calculateMetrics(relevantChildren);

        // 4. Financials - Optimized Single Reduce (Legacy Only for now, maybe add Pipeline values?)
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

        // NEW: ADD PIPELINE OPPORTUNITIES TO FINANCIAL TOTALS
        // Filter opportunities in 'RESULTADO' stage (which are "closed")
        // Use 'result' field to categorize
        const pipelineOutcomes = opportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO);

        pipelineOutcomes.forEach(op => {
            const val = op.estimatedValue || 0;
            if (op.result === TaskOutcome.SUCCESS) outcomes.success += val;
            if (op.result === TaskOutcome.FAILURE) outcomes.failure += val;
            if (op.result === TaskOutcome.STUDY) outcomes.study += val;
            if (op.result === TaskOutcome.WITHDRAWAL) outcomes.withdrawal += val;
        });

        // 5. Results by Client (Aggregation)
        const clientResults = relevantOpportunities.reduce((acc, op) => {
            const client = s(op.clientName) || 'Não idenficado';
            if (!acc[client]) acc[client] = 0;
            acc[client] += n(op.estimatedValue);
            return acc;
        }, {} as Record<string, number>);

        const clientsChartData = Object.entries(clientResults)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => (b.value as number) - (a.value as number))
            .slice(0, 5); // Top 5 Clients

        return { strategic, outcomes, clientsChartData };
    }, [tasks, opportunities, timeFilterType, selectedDate, customRange]);


    return (
        <div className="flex h-full w-full flex-col overflow-hidden">
            {/* HEADER */}
            <header className="bg-white border-b border-slate-200 px-8 py-5 sticky top-0 z-30 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <LayoutDashboard className="text-blue-600" /> Gestão Comercial
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Pipeline e Ações Operacionais</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* VIEW SWITCHER */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg mr-4">
                        <button
                            onClick={() => setView('DASHBOARD')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${view === 'DASHBOARD' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <LayoutDashboard size={16} /> Visão Executiva
                        </button>
                        <button
                            onClick={() => setView('STRATEGIC')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${view === 'STRATEGIC' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <TrendingUp size={16} /> Pipeline
                        </button>
                    </div>

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
                            value={isValid(selectedDate) ? format(selectedDate, 'yyyy-MM') : ''}
                            onChange={(e) => {
                                if (!e.target.value) return;
                                const d = new Date(e.target.value + '-01T00:00:00');
                                if (!isNaN(d.getTime())) setSelectedDate(d);
                            }}
                        />
                    )}
                    {/* Simplified custom range for demo */}
                    {view === 'DASHBOARD' && timeFilterType === 'CUSTOM' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                className="bg-white border border-slate-200 rounded-md text-sm p-1"
                                value={isValid(customRange.start) ? format(customRange.start, 'yyyy-MM-dd') : ''}
                                onChange={(e) => {
                                    const date = new Date(e.target.value);
                                    if (!isNaN(date.getTime())) setCustomRange(prev => ({ ...prev, start: date }));
                                }}
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="date"
                                className="bg-white border border-slate-200 rounded-md text-sm p-1"
                                value={isValid(customRange.end) ? format(customRange.end, 'yyyy-MM-dd') : ''}
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
                        onClick={() => setIsHistoryOpen(true)}
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors relative"
                        title="Histórico e E-mails"
                    >
                        <Bell size={20} />
                        {notifications.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
                    </button>

                    {/* DYNAMIC ACTION BUTTON */}
                    {view === 'STRATEGIC' ? (
                        <button
                            onClick={() => { setEditingOpportunity(undefined); setIsOpportunityModalOpen(true); }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-bold shadow hover:bg-purple-700 transition-colors"
                        >
                            <PlusCircle size={16} /> Nova Oportunidade
                        </button>
                    ) : null}
                </div>
            </header>

            {(contractIdFilter || solutionIdFilter || kpiIdFilter) && (
                <div className="bg-white border-b border-indigo-100 px-6 py-2 flex items-center shadow-inner">
                    <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-bold animate-fadeIn">
                        <LinkIcon size={12} />
                        <span>
                            Filtro Ativo: {contractIdFilter ? 'Contrato' : solutionIdFilter ? 'Solução' : 'KPI'}
                        </span>
                        <div className="h-3 w-px bg-indigo-200 mx-1"></div>
                        <button
                            onClick={() => navigate('/comercial')}
                            className="hover:bg-indigo-100 p-0.5 rounded transition-colors text-indigo-500 hover:text-indigo-800 flex items-center gap-1"
                        >
                            <X size={14} />
                            Limpar
                        </button>
                    </div>
                </div>
            )}

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-y-auto p-6 relative">
                {view === 'DASHBOARD' && (
                    <div
                        className="max-w-7xl mx-auto space-y-6"
                    >
                        {/* 1. QUANTITATIVE SUMMARY TABLE (NEW) */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <Activity size={20} className="text-blue-600" />
                                Resumo Quantitativo do Pipeline
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-4 py-3">Métrica</th>
                                            <th className="px-4 py-3 text-right">Quantidade</th>
                                            <th className="px-4 py-3 text-right">Volume (R$)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-700">Total de Oportunidades</td>
                                            <td className="px-4 py-3 text-right font-bold">{dashboardStats.strategic.total}</td>
                                            <td className="px-4 py-3 text-right font-medium text-slate-500">-</td>
                                        </tr>
                                        <tr className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-green-700 flex items-center gap-2"><CheckCircle size={14} /> Sucesso</td>
                                            <td className="px-4 py-3 text-right font-bold text-green-700">
                                                {/* Calculate Count from Outcomes if possible or approximate */}
                                                {opportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.SUCCESS).length +
                                                    tasks.filter(t => !t.parentId && !t.opportunityId && t.outcome === TaskOutcome.SUCCESS).length}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-green-700">R$ {dashboardStats.outcomes.success.toLocaleString()}</td>
                                        </tr>
                                        <tr className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-red-700 flex items-center gap-2"><AlertTriangle size={14} /> Insucesso</td>
                                            <td className="px-4 py-3 text-right font-bold text-red-700">
                                                {opportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.FAILURE).length +
                                                    tasks.filter(t => !t.parentId && !t.opportunityId && t.outcome === TaskOutcome.FAILURE).length}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-red-700">R$ {dashboardStats.outcomes.failure.toLocaleString()}</td>
                                        </tr>
                                        <tr className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-blue-700 flex items-center gap-2"><Bot size={14} /> Estudo</td>
                                            <td className="px-4 py-3 text-right font-bold text-blue-700">
                                                {opportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.STUDY).length +
                                                    tasks.filter(t => !t.parentId && !t.opportunityId && t.outcome === TaskOutcome.STUDY).length}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-blue-700">R$ {dashboardStats.outcomes.study.toLocaleString()}</td>
                                        </tr>
                                        <tr className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-600 flex items-center gap-2"><LogOut size={14} /> Desistência</td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-600">
                                                {opportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.WITHDRAWAL).length +
                                                    tasks.filter(t => !t.parentId && !t.opportunityId && t.outcome === TaskOutcome.WITHDRAWAL).length}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-600">R$ {dashboardStats.outcomes.withdrawal.toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>


                        {/* CHARTS ROW */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* BAR CHART - OUTCOMES distribution (REPLACED PIE) */}
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                                <h3 className="font-bold text-slate-700 mb-4">Distribuição de Resultados (Financeiro)</h3>
                                <div className="flex-1 min-h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={[
                                                { name: 'Sucesso', value: dashboardStats.outcomes.success, fill: COLORS.success },
                                                { name: 'Insucesso', value: dashboardStats.outcomes.failure, fill: COLORS.failure },
                                                { name: 'Estudo', value: dashboardStats.outcomes.study, fill: COLORS.study },
                                                { name: 'Desistência', value: dashboardStats.outcomes.withdrawal, fill: COLORS.withdrawal }
                                            ]}
                                            layout="vertical"
                                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                            <RechartsTooltip formatter={(value: number) => `R$ ${value.toLocaleString()}`} cursor={{ fill: 'transparent' }} />
                                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                                                {
                                                    [
                                                        { name: 'Sucesso', value: dashboardStats.outcomes.success, fill: COLORS.success },
                                                        { name: 'Insucesso', value: dashboardStats.outcomes.failure, fill: COLORS.failure },
                                                        { name: 'Estudo', value: dashboardStats.outcomes.study, fill: COLORS.study },
                                                        { name: 'Desistência', value: dashboardStats.outcomes.withdrawal, fill: COLORS.withdrawal }
                                                    ].map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                                    ))
                                                }
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* TABLE - CLIENT RESULTS (REPLACED CHART) */}
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                                <h3 className="font-bold text-slate-700 mb-4">Top Clientes (Volume)</h3>
                                <div className="flex-1 overflow-auto max-h-[300px]">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2">Cliente</th>
                                                <th className="px-4 py-2 text-right">Volume (R$)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {dashboardStats.clientsChartData.map((client, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2 font-medium text-slate-700 truncate max-w-[150px]" title={client.name}>
                                                        {client.name}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-bold text-slate-600">
                                                        R$ {Number(client.value).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {/* STRATEGIC VIEW (PIPELINE) */}
                {view === 'STRATEGIC' && (
                    <div
                        className="h-full flex flex-col gap-6"
                    >
                        {/* NEW PIPELINE BOARD - Task 4: Fixed Height */}
                        <div className="h-[calc(100vh-200px)] bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-hidden flex flex-col">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4 text-xl flex-shrink-0">
                                <Activity size={24} className="text-purple-600" /> Pipeline de Vendas
                            </h3>
                            <div className="flex-1 overflow-hidden">
                                <PipelineBoard
                                    opportunities={opportunities} // NEW: Pass down
                                    refreshOpportunities={fetchOpportunities} // NEW: Pass down refresh
                                    onEditOpportunity={(op) => { setEditingOpportunity(op); setIsOpportunityModalOpen(true); }}
                                    onDeleteOpportunity={handleDeleteOpportunity}
                                    onTaskCreated={(task) => {
                                        setEditingTask(task);
                                        setTaskFormMode('QUICK_EDIT');
                                        setIsTaskModalOpen(true);
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* SETTINGS VIEW */}
                {view === 'SETTINGS' && (
                    <div
                        className="max-w-4xl mx-auto"
                    >
                        <EscalationSettings chain={helpChain} onSave={setHelpChain} />
                    </div>
                )}
            </div >

            {/* MODAL OVERLAYS */}
            {isOpportunityModalOpen && (
                <OpportunityForm
                    initialData={editingOpportunity}
                    linkedTasks={tasks.filter(t => t.opportunityId === editingOpportunity?.id)}
                    onClose={() => { setIsOpportunityModalOpen(false); setEditingOpportunity(undefined); }}
                    onSave={fetchOpportunities}
                    onDelete={handleDeleteOpportunity}
                />
            )}
            <TaskForm
                isOpen={isTaskModalOpen}
                initialData={editingTask || (
                    contractIdFilter ? { contractId: contractIdFilter } :
                        solutionIdFilter ? { solutionId: solutionIdFilter } :
                            kpiIdFilter ? { kpiId: kpiIdFilter } : undefined
                )}
                users={MOCK_USERS}
                availableParents={[
                    ...tasks.filter(t => !t.parentId && !t.opportunityId).map(t => ({ ...t, id: String(t.id), title: String(t.title), clientName: String(t.clientName || '') })),
                    ...opportunities.map(op => {
                        // Safe conversion inside map to prevent crash
                        const opId = typeof op.id === 'string' ? op.id : 'invalid-id';
                        const opTitle = typeof op.title === 'string' ? op.title : 'Sem Título';
                        const opClient = typeof op.clientName === 'string' ? op.clientName : '';

                        return {
                            id: String(opId),
                            title: `[Oportunidade] ${String(opTitle)}`,
                            clientName: String(opClient),
                            // spread other required fields with defaults to satisfy Task type
                            description: '',
                            assigneeId: op.responsibleId || '',
                            status: TaskStatus.PENDING,
                            priority: 'MEDIO',
                            category: 'Oportunidade',
                            startDate: new Date(),
                            endDate: op.deadline || new Date(),
                        } as unknown as Task;
                    })
                ]}
                onClose={() => {
                    setIsTaskModalOpen(false);
                    setEditingTask(undefined);
                    setTaskFormMode('FULL'); // Reset
                }}
                mode={taskFormMode}
                onSave={handleSaveTask}
            />

            <HistoryPanel
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                logs={logs}
                notifications={notifications}
            />
            <Toaster position="top-right" richColors />
        </div >
    );
};
