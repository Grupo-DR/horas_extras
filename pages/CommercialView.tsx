import React, { useState, useEffect, useMemo } from 'react';
import { DocumentImportModal } from '../components/DocumentImportModal';
import { Task, User, TaskStatus, HelpChainLevel, HistoryLog, Notification, TaskOutcome, Bid, PipelineStage } from '../types';
import { TaskForm } from '../components/TaskForm';
import { TaskCard } from '../components/TaskCard'; // Import TaskCard
import { OpportunityForm } from '../components/Pipeline/OpportunityForm'; // Import OpportunityForm

import { PipelineBoard } from '../components/Pipeline/PipelineBoard';
import { EscalationSettings } from '../components/EscalationSettings';
import { HistoryPanel } from '../components/HistoryPanel';
import { Layout, LayoutDashboard, PlusCircle, Filter, Bell, Bot, Settings, LogOut, Columns, List, TrendingUp, AlertTriangle, CheckCircle, Calendar, DollarSign, Activity, Users, ChevronDown, Link as LinkIcon, X, FileText, Target, Database, Upload } from 'lucide-react';
// import { draftEscalationEmail, draftWelcomeEmail } from '../services/geminiService'; // REMOVED
import { BidService } from '../services/bidService';
// OpportunityService removed as we use CrmContext/BidService now
import { UserService } from '../services/userService';
import { isPast, format, startOfYear, isWithinInterval, startOfMonth, endOfMonth, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line, FunnelChart, Funnel, LabelList } from 'recharts';
import { Toaster, toast } from 'sonner';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCrm } from '../contexts/CrmContext';
import { useAuth } from '../contexts/AuthContext';
import { migrateOpportunitiesToBidsOnce } from '../utils/migrationUtils';
import FunnelChartSVG from '../components/FunnelChartSVG';
import EvolutionChart from '../components/EvolutionChart';
import dashboardStats from '../pdf_dump.txt';

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

// --- MOCK DATA REMOVED (or kept minimum if needed for chain defaults, but user handling should be real) ---
// We'll keep INITIAL_CHAIN for now as it's config.

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
// HELPER: Strict Number (Enhanced)
const n = (v: any) => {
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    if (typeof v === 'string') {
        const parsed = parseFloat(v.replace(/[^\d.-]/g, '')); // Strip currency symbols if present
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};

export const CommercialView: React.FC = () => {
    // --- STATE ---
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const contractIdFilter = searchParams.get('contractId');
    const solutionIdFilter = searchParams.get('solutionId');
    const kpiIdFilter = searchParams.get('kpiId');

    // CRM Context Integration
    const { bids: opportunities = [], clients = [], refresh } = useCrm(); // Aliasing bids to opportunities to minimize refactor
    const { user: currentUser } = useAuth(); // REAL USER

    // --- NEW IMPORT MODAL STATE ---
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // ACTION FILTERS
    const [actionPriorityFilter, setActionPriorityFilter] = useState('');
    const [actionUserFilter, setActionUserFilter] = useState('');
    const [actionClientFilter, setActionClientFilter] = useState('');
    const [showCompleted, setShowCompleted] = useState(false);

    const handleImportData = (data: any) => {
        console.log("Imported Data:", data);
        if (data.documentType === 'BM') {
            // Logic to create Contract Measurement or update Contract
            // For now, simpler alerting as full integration is separate task
            toast.success(`Medição do Contrato ${data.contractId || '?'} recebida!`, { description: `Valor: ${data.value}` });
        } else if (data.documentType === 'RDO') {
            // Logic to create RDO
            toast.success(`RDO Importado! Data: ${data.date}`, { description: `Obra: ${data.siteName}` });
        }
        setIsImportModalOpen(false);
    };

    // VIEW STATE
    const [view, setView] = useState<'DASHBOARD' | 'STRATEGIC' | 'SETTINGS'>('DASHBOARD');
    const [tasks, setTasks] = useState<Task[]>([]);

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
    const [editingOpportunity, setEditingOpportunity] = useState<Bid | undefined>(undefined);

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    // view state lifted to top
    // viewMode is no longer toggleable by user, but defined by the View
    const [viewMode, setViewMode] = useState<'GRID' | 'KANBAN'>('KANBAN');

    // Filters
    // FIX: Initial filter includes Last Month (Dec 2025) for Dashboard visibility in Jan
    const [timeFilterType, setTimeFilterType] = useState<'MONTH' | 'YTD' | 'CUSTOM'>('CUSTOM');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

    // Funnel Interaction State
    const [hoveredFunnelIndex, setHoveredFunnelIndex] = useState<number | null>(null);

    // Initial Data Fetch defaults to Last Month + Current Month
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
            user: currentUser?.name || 'Sistema'
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

                // --- GEMINI WELCOME EMAIL REMOVED ---
                /* 
                const assigneeName = users.find(u => u.id === finalDocData.assigneeId)?.name || 'Colaborador';
                // ... logic removed as per user request
                */

                toast.success("Tarefa criada com sucesso!");

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
        if (!sourceTasks) return [];
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

    const timeFilteredTasks = getFilteredTasks(tasks || []);

    // NEW: Filter by Contract ID if present
    const childTasks = (tasks || []).filter(t => {
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
    const motherTasks = (tasks || []).filter(t => !t.parentId && !t.opportunityId);

    // View Filtering for Kanban/List
    const hierarchyScan = useMemo(() => {
        return {
            mothers: motherTasks,
            children: childTasks
        };
    }, [tasks]);

    // --- STATISTICS ENGINE ---
    const calculateMetrics = (taskList: Task[]) => {
        if (!taskList) return { total: 0, pending: 0, inProgress: 0, late: 0, completed: 0, productivity: 0, riskRate: 0 };
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
        const relevantTasks = getFilteredTasks(tasks || []);

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

        const relevantOpportunities = (opportunities || []).filter(op => {
            const opDate = new Date(op.updatedAt || op.createdAt);
            return opDate >= start && opDate <= end;
        });

        // Calculate Strategic Metrics (Pipeline Only)
        // Legacy Mothers (Tasks) are excluded to match the visual Pipeline Board which only shows Bids.
        const strategicPipeline = {
            pending: relevantOpportunities.filter(op => {
                const isCompleted = op.pipelineStage === PipelineStage.RESULTADO || op.status === 'GANHA' || op.status === 'PERDIDA';
                return !isCompleted && op.pipelineStage === PipelineStage.LEAD_RECEBIDO;
            }).length,
            inProgress: relevantOpportunities.filter(op => {
                const isCompleted = op.pipelineStage === PipelineStage.RESULTADO || op.status === 'GANHA' || op.status === 'PERDIDA';
                const isPending = op.pipelineStage === PipelineStage.LEAD_RECEBIDO;
                const isLate = op.deadline ? isPast(new Date(op.deadline)) : false;
                return !isCompleted && !isPending && !isLate;
            }).length,
            late: relevantOpportunities.filter(op => {
                const isCompleted = op.pipelineStage === PipelineStage.RESULTADO || op.status === 'GANHA' || op.status === 'PERDIDA';
                const isPending = op.pipelineStage === PipelineStage.LEAD_RECEBIDO;
                const isDeadlinePast = op.deadline ? isPast(new Date(op.deadline)) : false;
                return !isCompleted && !isPending && isDeadlinePast;
            }).length,
            completed: relevantOpportunities.filter(op => op.status === 'GANHA' || op.status === 'PERDIDA' || op.pipelineStage === PipelineStage.RESULTADO).length,
            total: relevantOpportunities.length
        };

        // Strategic Stats = Pipeline Only
        const strategic = {
            pending: strategicPipeline.pending,
            inProgress: strategicPipeline.inProgress,
            late: strategicPipeline.late,
            completed: strategicPipeline.completed,
            productivity: 0,
            riskRate: 0
        };
        const totalStrategic = strategic.pending + strategic.inProgress + strategic.late + strategic.completed;
        strategic.productivity = totalStrategic > 0 ? Math.round((strategic.completed / totalStrategic) * 100) : 0;
        strategic.riskRate = totalStrategic > 0 ? Math.round((strategic.late / totalStrategic) * 100) : 0;

        // 4. Financials - Pipeline Only
        const outcomes = { success: 0, failure: 0, study: 0, withdrawal: 0, inProgress: 0 };
        const pipelineOutcomes = (opportunities || []); // CHECK ALL

        pipelineOutcomes.forEach(op => {
            const val = op.estimatedValue || 0;
            if (op.pipelineStage === PipelineStage.RESULTADO) {
                if (op.result === TaskOutcome.SUCCESS) outcomes.success += val;
                if (op.result === TaskOutcome.FAILURE) outcomes.failure += val;
                if (op.result === TaskOutcome.STUDY) outcomes.study += val;
                if (op.result === TaskOutcome.WITHDRAWAL) outcomes.withdrawal += val;
            } else {
                // If NOT in RESULTADO, it is "Em Andamento"
                outcomes.inProgress += val;
            }
        });

        // 5. Results by Client (Pipeline Only) - REFACTORED for Detailed Table
        const clientResults = relevantOpportunities.reduce((acc, op) => {
            // RESOLVE CLIENT NAME: Try to find by ID or Name matching
            let displayName = s(op.clientName) || 'Não identificado';
            const matchedClient = clients.find(c => c.id === op.clientId || c.corporateName === op.clientName || c.tradeName === op.clientName);
            if (matchedClient?.tradeName) displayName = matchedClient.tradeName;

            if (!acc[displayName]) {
                acc[displayName] = {
                    name: displayName,
                    success: { count: 0, value: 0 },
                    failure: { count: 0, value: 0 },
                    study: { count: 0, value: 0 },
                    withdrawal: { count: 0, value: 0 },
                    inProgress: { count: 0, value: 0 },
                    total: { count: 0, value: 0 }
                };
            }
            const val = n(op.estimatedValue);

            if (op.pipelineStage === PipelineStage.RESULTADO) {
                if (op.result === TaskOutcome.SUCCESS) { acc[displayName].success.count++; acc[displayName].success.value += val; }
                if (op.result === TaskOutcome.FAILURE) { acc[displayName].failure.count++; acc[displayName].failure.value += val; }
                if (op.result === TaskOutcome.STUDY) { acc[displayName].study.count++; acc[displayName].study.value += val; }
                if (op.result === TaskOutcome.WITHDRAWAL) { acc[displayName].withdrawal.count++; acc[displayName].withdrawal.value += val; }
            } else {
                // IN PROGRESS
                acc[displayName].inProgress.count++;
                acc[displayName].inProgress.value += val;
            }

            // ADD TO TOTAL (Active + Closed)
            acc[displayName].total.count++;
            acc[displayName].total.value += val;

            return acc;
        }, {} as Record<string, {
            name: string;
            success: { count: number; value: number };
            failure: { count: number; value: number };
            study: { count: number; value: number };
            withdrawal: { count: number; value: number };
            inProgress: { count: number; value: number };
            total: { count: number; value: number };
        }>);

        const clientsAnalysisData = (Object.values(clientResults) as any[]).sort((a, b) => b.total.value - a.total.value); // Sort by TOTAL value now

        // 6. Results by ESTIMATOR (Internal Responsible)
        const estimatorResults = relevantOpportunities.reduce((acc, op) => {
            const estimator = s(op.ownerName) || 'Não Definido';

            if (!acc[estimator]) {
                acc[estimator] = {
                    name: estimator,
                    success: { count: 0, value: 0 },
                    failure: { count: 0, value: 0 },
                    study: { count: 0, value: 0 },
                    withdrawal: { count: 0, value: 0 },
                    inProgress: { count: 0, value: 0 },
                    total: { count: 0, value: 0 }
                };
            }
            const val = n(op.estimatedValue);

            if (op.pipelineStage === PipelineStage.RESULTADO) {
                if (op.result === TaskOutcome.SUCCESS) { acc[estimator].success.count++; acc[estimator].success.value += val; }
                if (op.result === TaskOutcome.FAILURE) { acc[estimator].failure.count++; acc[estimator].failure.value += val; }
                if (op.result === TaskOutcome.STUDY) { acc[estimator].study.count++; acc[estimator].study.value += val; }
                if (op.result === TaskOutcome.WITHDRAWAL) { acc[estimator].withdrawal.count++; acc[estimator].withdrawal.value += val; }
            } else {
                // IN PROGRESS
                acc[estimator].inProgress.count++;
                acc[estimator].inProgress.value += val;
            }

            // ADD TO TOTAL (Active + Closed)
            acc[estimator].total.count++;
            acc[estimator].total.value += val;

            return acc;
        }, {} as Record<string, {
            name: string;
            success: { count: number; value: number };
            failure: { count: number; value: number };
            study: { count: number; value: number };
            withdrawal: { count: number; value: number };
            inProgress: { count: number; value: number };
            total: { count: number; value: number };
        }>);

        const estimatorAnalysisData = (Object.values(estimatorResults) as any[]).sort((a, b) => b.total.value - a.total.value);


        // 6. Conversion Rate & Pipeline Totals
        // Conversion Rate = (Success Count / Total Opportunities) * 100
        const totalOpsCount = relevantOpportunities.length;
        const totalSuccessCount = relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.SUCCESS).length;

        const conversionRate = totalOpsCount > 0 ? (totalSuccessCount / totalOpsCount) * 100 : 0;

        // VGV
        const totalPipelineValue = relevantOpportunities.reduce((sum, op) => sum + n(op.estimatedValue), 0);

        return { strategic, outcomes, clientsAnalysisData, estimatorAnalysisData, conversionRate, totalOpsCount, totalPipelineValue, relevantOpportunities };
    }, [tasks, opportunities, clients, timeFilterType, selectedDate, customRange]);

    const { relevantOpportunities } = dashboardStats;




    // NEW: Delete Opportunity (Using BidService / OpportunityService)
    const handleDeleteOpportunity = async (id: string) => {
        if (window.confirm("ATENÇÃO: Tem certeza que deseja excluir esta oportunidade permanentemente?")) {
            try {
                // Use BidService directly
                await BidService.delete(id);
                toast.success("Oportunidade excluída com sucesso.");
                // Refresh list using context
                refresh();
            } catch (error) {
                console.error("Erro ao excluir oportunidade:", error);
                toast.error("Erro ao excluir oportunidade.");
            }
        }
    };

    // NEW: Delete Task (for TaskForm)
    const handleDeleteTask = async (taskId: string) => {
        if (window.confirm("ATENÇÃO: Tem certeza que deseja excluir esta ação permanentemente?")) {
            try {
                await deleteDoc(doc(db, 'tasks', taskId));
                toast.success('Tarefa excluída');
                setIsTaskModalOpen(false);
                setEditingTask(undefined);
            } catch (error) {
                console.error(error);
                toast.error('Erro ao excluir tarefa');
            }
        }
    };

    // NEW: Migration Handler
    const handleMigration = async () => {
        if (!window.confirm("ATENÇÃO: Isso irá migrar oportunidades antigas para o novo formato 'Bids'.\nRecomendado executar apenas uma vez.\n\nDeseja continuar?")) return;

        const toastId = toast.loading("Migrando dados...");
        try {
            const result = await migrateOpportunitiesToBidsOnce();
            toast.success(`Migração concluída!\nMigrados: ${result.migratedCount}\nPulados: ${result.skippedCount}\nErros: ${result.errorsCount}`, {
                id: toastId,
                duration: 5000
            });
            refresh(); // Refresh context
        } catch (error) {
            console.error(error);
            toast.error("Falha na migração. Verifique o console.", { id: toastId });
        }
    };

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
                    {/* IMPORT BUTTON */}
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-full transition-colors"
                        title="Importar Medição ou RDO (PDF)"
                    >
                        <Upload size={20} />
                    </button>

                    {/* MIGRATION BUTTON - TEMP */}
                    <button
                        onClick={handleMigration}
                        className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-full transition-colors"
                        title="Migrar Dados Legacy (Admin)"
                    >
                        <Database size={20} />
                    </button>

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

            <DocumentImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImportData}
            />

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-y-auto p-6 relative">
                {view === 'DASHBOARD' && (
                    <div
                        className="max-w-7xl mx-auto space-y-8"
                    >
                        {/* 0. INDICATORS ROW (Restored) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                <p className="text-slate-500 font-bold text-xs uppercase tracking-wide flex items-center gap-1">
                                    <FileText size={14} /> Total em Propostas
                                </p>
                                <p className="text-2xl font-bold text-indigo-900 mt-2">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(dashboardStats.totalPipelineValue)}
                                </p>
                                <span className="text-xs text-indigo-400 mt-1 font-medium">{dashboardStats.totalOpsCount} oportunidades</span>
                            </div>

                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                <p className="text-slate-500 font-bold text-xs uppercase tracking-wide flex items-center gap-1">
                                    <CheckCircle size={14} /> Sucesso (Fechado)
                                </p>
                                <p className="text-2xl font-bold text-emerald-900 mt-2">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(dashboardStats.outcomes.success)}
                                </p>
                            </div>

                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                <p className="text-slate-500 font-bold text-xs uppercase tracking-wide flex items-center gap-1 text-blue-800">
                                    <Bot size={14} /> Valor em Estudo
                                </p>
                                <p className="text-2xl font-bold text-blue-900 mt-2">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(dashboardStats.outcomes.study)}
                                </p>
                            </div>

                            {/* Conversion Rate Card (NEW) */}
                            <div className="bg-gradient-to-br from-violet-500 to-purple-600 text-white p-4 rounded-xl shadow-md flex flex-col justify-between transform hover:scale-105 transition-transform">
                                <p className="text-white/80 font-bold text-xs uppercase tracking-wide flex items-center gap-1">
                                    <Target size={14} /> Taxa de Conversão
                                </p>
                                <div className="flex items-end gap-2 mt-2">
                                    <p className="text-3xl font-extrabold text-white">
                                        {dashboardStats.conversionRate.toFixed(1)}%
                                    </p>
                                    <span className="text-xs text-white/70 mb-1 font-medium">de sucesso</span>
                                </div>
                            </div>

                            <div className="bg-red-50 border border-red-100 p-4 rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                <p className="text-slate-500 font-bold text-xs uppercase tracking-wide flex items-center gap-1">
                                    <AlertTriangle size={14} /> Insucesso / Perda
                                </p>
                                <p className="text-2xl font-bold text-red-900 mt-2">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(dashboardStats.outcomes.failure)}
                                </p>
                            </div>
                        </div>

                        {/* 1. QUANTITATIVE SUMMARY TABLE (REFORMED) */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <Activity size={20} className="text-blue-600" />
                                Resumo Quantitativo do Pipeline
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-3 rounded-tl-lg">Categoria</th>
                                            <th className="px-6 py-3 text-center">Quantidade</th>
                                            <th className="px-6 py-3 text-center">% Qtd</th>
                                            <th className="px-6 py-3 text-right">Valor (R$)</th>
                                            <th className="px-6 py-3 text-right rounded-tr-lg">% Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                        {/* IN PROGRESS */}
                                        <tr className="hover:bg-purple-50/30 transition-colors group">
                                            <td className="px-6 py-4 text-purple-700 flex items-center gap-2">
                                                <div className="p-1.5 bg-purple-100 rounded text-purple-600 group-hover:bg-purple-200 transition-colors"><Activity size={14} /></div>
                                                Em Andamento
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-700">
                                                {relevantOpportunities.filter(op => op.pipelineStage !== PipelineStage.RESULTADO).length}
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-500 text-xs">
                                                {dashboardStats.totalOpsCount > 0 ?
                                                    (relevantOpportunities.filter(op => op.pipelineStage !== PipelineStage.RESULTADO).length / dashboardStats.totalOpsCount * 100).toFixed(1) + '%'
                                                    : '0%'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-purple-700">
                                                R$ {dashboardStats.outcomes.inProgress.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-500 text-xs">
                                                {dashboardStats.totalPipelineValue > 0 ? (dashboardStats.outcomes.inProgress / dashboardStats.totalPipelineValue * 100).toFixed(1) + '%' : '0%'}
                                            </td>
                                        </tr>
                                        {/* SUCCESS */}
                                        <tr className="hover:bg-emerald-50/30 transition-colors group">
                                            <td className="px-6 py-4 text-emerald-700 flex items-center gap-2">
                                                <div className="p-1.5 bg-emerald-100 rounded text-emerald-600 group-hover:bg-emerald-200 transition-colors"><CheckCircle size={14} /></div>
                                                Sucesso
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-700">
                                                {relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.SUCCESS).length}
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-500 text-xs">
                                                {dashboardStats.totalOpsCount > 0 ?
                                                    (relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.SUCCESS).length / dashboardStats.totalOpsCount * 100).toFixed(1) + '%'
                                                    : '0%'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-emerald-700">
                                                R$ {dashboardStats.outcomes.success.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-500 text-xs">
                                                {dashboardStats.totalPipelineValue > 0 ? (dashboardStats.outcomes.success / dashboardStats.totalPipelineValue * 100).toFixed(1) + '%' : '0%'}
                                            </td>
                                        </tr>
                                        {/* FAILURE */}
                                        <tr className="hover:bg-red-50/30 transition-colors group">
                                            <td className="px-6 py-4 text-red-700 flex items-center gap-2">
                                                <div className="p-1.5 bg-red-100 rounded text-red-600 group-hover:bg-red-200 transition-colors"><AlertTriangle size={14} /></div>
                                                Insucesso
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-700">
                                                {relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.FAILURE).length}
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-500 text-xs">
                                                {dashboardStats.totalOpsCount > 0 ?
                                                    (relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.FAILURE).length / dashboardStats.totalOpsCount * 100).toFixed(1) + '%'
                                                    : '0%'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-red-700">
                                                R$ {dashboardStats.outcomes.failure.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-500 text-xs">
                                                {dashboardStats.totalPipelineValue > 0 ? (dashboardStats.outcomes.failure / dashboardStats.totalPipelineValue * 100).toFixed(1) + '%' : '0%'}
                                            </td>
                                        </tr>
                                        {/* STUDY */}
                                        <tr className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="px-6 py-4 text-blue-700 flex items-center gap-2">
                                                <div className="p-1.5 bg-blue-100 rounded text-blue-600 group-hover:bg-blue-200 transition-colors"><Bot size={14} /></div>
                                                Em Estudo
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-700">
                                                {relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.STUDY).length}
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-500 text-xs">
                                                {dashboardStats.totalOpsCount > 0 ?
                                                    (relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.STUDY).length / dashboardStats.totalOpsCount * 100).toFixed(1) + '%'
                                                    : '0%'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-blue-700">
                                                R$ {dashboardStats.outcomes.study.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-500 text-xs">
                                                {dashboardStats.totalPipelineValue > 0 ? (dashboardStats.outcomes.study / dashboardStats.totalPipelineValue * 100).toFixed(1) + '%' : '0%'}
                                            </td>
                                        </tr>
                                        {/* WITHDRAWAL */}
                                        <tr className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4 text-slate-600 flex items-center gap-2">
                                                <div className="p-1.5 bg-slate-100 rounded text-slate-500 group-hover:bg-slate-200 transition-colors"><LogOut size={14} /></div>
                                                Desistência
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-700">
                                                {relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.WITHDRAWAL).length}
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-500 text-xs">
                                                {dashboardStats.totalOpsCount > 0 ?
                                                    (relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.WITHDRAWAL).length / dashboardStats.totalOpsCount * 100).toFixed(1) + '%'
                                                    : '0%'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-600">
                                                R$ {dashboardStats.outcomes.withdrawal.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-500 text-xs">
                                                {dashboardStats.totalPipelineValue > 0 ? (dashboardStats.outcomes.withdrawal / dashboardStats.totalPipelineValue * 100).toFixed(1) + '%' : '0%'}
                                            </td>
                                        </tr>
                                        {/* TOTAL */}
                                        <tr className="bg-slate-50 border-t-2 border-slate-100 font-bold">
                                            <td className="px-6 py-4 text-slate-800">TOTAL</td>
                                            <td className="px-6 py-4 text-center text-slate-800">{dashboardStats.totalOpsCount}</td>
                                            <td className="px-6 py-4 text-center text-slate-800">100%</td>
                                            <td className="px-6 py-4 text-right text-slate-800">R$ {dashboardStats.totalPipelineValue.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right text-slate-800">100%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 0.5. EVOLUTION CHART (NEW) */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <TrendingUp size={20} className="text-amber-500" />
                                Evolução de Propostas (Acumulado x Mensal)
                            </h3>
                            <div className="flex-1 min-h-0">
                                <EvolutionChart
                                    data={(() => {
                                        // Aggregate Data
                                        const groups = new Map<string, { month: string, date: number, entered: number, won: number }>();

                                        // Sort opportunities by date first to ensure correct accumulation
                                        const sortedOps = [...relevantOpportunities].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                                        sortedOps.forEach(op => {
                                            const d = new Date(op.date);
                                            if (isNaN(d.getTime())) return;
                                            const key = format(d, 'MMM/yy', { locale: ptBR });

                                            if (!groups.has(key)) {
                                                groups.set(key, { month: key.charAt(0).toUpperCase() + key.slice(1), date: d.getTime(), entered: 0, won: 0 });
                                            }
                                            const g = groups.get(key)!;
                                            g.entered += 1;
                                            if (op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.SUCCESS) {
                                                g.won += 1;
                                            }
                                        });

                                        const sorted = Array.from(groups.values()).sort((a, b) => a.date - b.date);
                                        let acc = 0;
                                        return sorted.map(item => {
                                            acc += item.entered;
                                            return { ...item, accumulated: acc };
                                        });
                                    })()}
                                />
                            </div>
                        </div>

                        {/* DETAILED PIVOT TABLE (NEW) */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <List size={20} className="text-slate-600" />
                                Visão Detalhada por Cliente (Performance)
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left whitespace-nowrap">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th rowSpan={2} className="px-4 py-3 border-r">Cliente</th>
                                            <th colSpan={4} className="px-4 py-1 text-center border-r text-purple-600 bg-purple-50/50">Em Andamento</th>
                                            <th colSpan={4} className="px-4 py-1 text-center border-r text-emerald-600 bg-emerald-50/50">Sucesso</th>
                                            <th colSpan={4} className="px-4 py-1 text-center border-r text-red-600 bg-red-50/50">Insucesso</th>
                                            <th colSpan={4} className="px-4 py-1 text-center border-r text-amber-600 bg-amber-50/50">Desistência</th>
                                            <th colSpan={4} className="px-4 py-1 text-center border-r text-blue-600 bg-blue-50/50">Em Estudo</th>
                                            <th colSpan={4} className="px-4 py-1 text-center border-r text-slate-600 bg-slate-100">Total</th>
                                            <th rowSpan={2} className="px-4 py-3 text-center border-l bg-slate-50">Conv.</th>
                                        </tr>
                                        <tr>
                                            {/* EM ANDAMENTO */}
                                            <th className="px-2 py-2 text-center bg-purple-50/50">Qtd</th>
                                            <th className="px-2 py-2 text-center bg-purple-50/50">%</th>
                                            <th className="px-2 py-2 text-right bg-purple-50/50">Valor</th>
                                            <th className="px-2 py-2 text-right border-r bg-purple-50/50">%</th>
                                            {/* SUCESSO */}
                                            <th className="px-2 py-2 text-center bg-emerald-50/50">Qtd</th>
                                            <th className="px-2 py-2 text-center bg-emerald-50/50">%</th>
                                            <th className="px-2 py-2 text-right bg-emerald-50/50">Valor</th>
                                            <th className="px-2 py-2 text-right border-r bg-emerald-50/50">%</th>
                                            {/* INSUCESSO */}
                                            <th className="px-2 py-2 text-center bg-red-50/50">Qtd</th>
                                            <th className="px-2 py-2 text-center bg-red-50/50">%</th>
                                            <th className="px-2 py-2 text-right bg-red-50/50">Valor</th>
                                            <th className="px-2 py-2 text-right border-r bg-red-50/50">%</th>
                                            {/* DESISTÊNCIA */}
                                            <th className="px-2 py-2 text-center bg-amber-50/50">Qtd</th>
                                            <th className="px-2 py-2 text-center bg-amber-50/50">%</th>
                                            <th className="px-2 py-2 text-right bg-amber-50/50">Valor</th>
                                            <th className="px-2 py-2 text-right border-r bg-amber-50/50">%</th>
                                            {/* ESTUDO */}
                                            <th className="px-2 py-2 text-center bg-blue-50/50">Qtd</th>
                                            <th className="px-2 py-2 text-center bg-blue-50/50">%</th>
                                            <th className="px-2 py-2 text-right bg-blue-50/50">Valor</th>
                                            <th className="px-2 py-2 text-right border-r bg-blue-50/50">%</th>
                                            {/* TOTAL */}
                                            <th className="px-2 py-2 text-center bg-slate-100">Qtd</th>
                                            <th className="px-2 py-2 text-center bg-slate-100">%</th>
                                            <th className="px-2 py-2 text-right bg-slate-100">Valor</th>
                                            <th className="px-2 py-2 text-right bg-slate-100">%</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {dashboardStats.clientsAnalysisData.map((client, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-slate-700 border-r">{client.name}</td>

                                                {/* IN PROGRESS */}
                                                <td className="px-2 py-3 text-center text-purple-700 font-bold bg-purple-50/10">{client.inProgress.count}</td>
                                                <td className="px-2 py-3 text-center text-slate-500 bg-purple-50/10">{client.total.count > 0 ? ((client.inProgress.count / client.total.count) * 100).toFixed(0) + '%' : '-'}</td>
                                                <td className="px-2 py-3 text-right text-purple-700 bg-purple-50/10">
                                                    {client.inProgress.value > 0 ? parseFloat((client.inProgress.value / 1000).toFixed(1)).toLocaleString() + 'k' : '-'}
                                                </td>
                                                <td className="px-2 py-3 text-right text-slate-500 border-r bg-purple-50/10">{client.total.value > 0 ? ((client.inProgress.value / client.total.value) * 100).toFixed(0) + '%' : '-'}</td>

                                                {/* SUCCESS */}
                                                <td className="px-2 py-3 text-center text-emerald-700 font-bold bg-emerald-50/10">{client.success.count}</td>
                                                <td className="px-2 py-3 text-center text-slate-500 bg-emerald-50/10">{client.total.count > 0 ? ((client.success.count / client.total.count) * 100).toFixed(0) + '%' : '-'}</td>
                                                <td className="px-2 py-3 text-right text-emerald-700 bg-emerald-50/10">
                                                    {client.success.value > 0 ? parseFloat((client.success.value / 1000).toFixed(1)).toLocaleString() + 'k' : '-'}
                                                </td>
                                                <td className="px-2 py-3 text-right text-slate-500 border-r bg-emerald-50/10">{client.total.value > 0 ? ((client.success.value / client.total.value) * 100).toFixed(0) + '%' : '-'}</td>

                                                {/* FAILURE */}
                                                <td className="px-2 py-3 text-center text-red-700 bg-red-50/10">{client.failure.count}</td>
                                                <td className="px-2 py-3 text-center text-slate-500 bg-red-50/10">{client.total.count > 0 ? ((client.failure.count / client.total.count) * 100).toFixed(0) + '%' : '-'}</td>
                                                <td className="px-2 py-3 text-right text-red-700 bg-red-50/10">
                                                    {client.failure.value > 0 ? parseFloat((client.failure.value / 1000).toFixed(1)).toLocaleString() + 'k' : '-'}
                                                </td>
                                                <td className="px-2 py-3 text-right text-slate-500 border-r bg-red-50/10">{client.total.value > 0 ? ((client.failure.value / client.total.value) * 100).toFixed(0) + '%' : '-'}</td>

                                                {/* WITHDRAWAL */}
                                                <td className="px-2 py-3 text-center text-amber-700 bg-amber-50/10">{client.withdrawal.count}</td>
                                                <td className="px-2 py-3 text-center text-slate-500 bg-amber-50/10">{client.total.count > 0 ? ((client.withdrawal.count / client.total.count) * 100).toFixed(0) + '%' : '-'}</td>
                                                <td className="px-2 py-3 text-right text-amber-700 bg-amber-50/10">
                                                    {client.withdrawal.value > 0 ? parseFloat((client.withdrawal.value / 1000).toFixed(1)).toLocaleString() + 'k' : '-'}
                                                </td>
                                                <td className="px-2 py-3 text-right text-slate-500 border-r bg-amber-50/10">{client.total.value > 0 ? ((client.withdrawal.value / client.total.value) * 100).toFixed(0) + '%' : '-'}</td>

                                                {/* STUDY */}
                                                <td className="px-2 py-3 text-center text-blue-700 bg-blue-50/10">{client.study.count}</td>
                                                <td className="px-2 py-3 text-center text-slate-500 bg-blue-50/10">{client.total.count > 0 ? ((client.study.count / client.total.count) * 100).toFixed(0) + '%' : '-'}</td>
                                                <td className="px-2 py-3 text-right text-blue-700 bg-blue-50/10">
                                                    {client.study.value > 0 ? parseFloat((client.study.value / 1000).toFixed(1)).toLocaleString() + 'k' : '-'}
                                                </td>
                                                <td className="px-2 py-3 text-right text-slate-500 border-r bg-blue-50/10">{client.total.value > 0 ? ((client.study.value / client.total.value) * 100).toFixed(0) + '%' : '-'}</td>

                                                {/* TOTAL */}
                                                <td className="px-2 py-3 text-center font-bold text-slate-800 bg-slate-50/30">{client.total.count}</td>
                                                <td className="px-2 py-3 text-center text-slate-500 bg-slate-50/30">100%</td>
                                                <td className="px-2 py-3 text-right font-bold text-slate-800 bg-slate-50/30">
                                                    {client.total.value > 0 ? parseFloat((client.total.value / 1000).toFixed(1)).toLocaleString() + 'k' : '-'}
                                                </td>
                                                <td className="px-2 py-3 text-right text-slate-500 bg-slate-50/30">100%</td>

                                                {/* CONVERSION RATE */}
                                                <td className="px-4 py-3 text-center font-bold text-slate-700 border-l bg-slate-50/50">
                                                    {client.total.count > 0 ? ((client.success.count / client.total.count) * 100).toFixed(0) + '%' : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* ESTIMATOR PIVOT TABLE (NEW - DR) */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <Users size={20} className="text-slate-600" />
                                Desempenho por Responsável Técnico (DR)
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left whitespace-nowrap">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th rowSpan={2} className="px-4 py-3 border-r">Responsável</th>
                                            <th colSpan={4} className="px-4 py-1 text-center border-r text-purple-600 bg-purple-50/50">Em Andamento</th>
                                            <th colSpan={4} className="px-4 py-1 text-center border-r text-emerald-600 bg-emerald-50/50">Sucesso</th>
                                            <th colSpan={4} className="px-4 py-1 text-center border-r text-red-600 bg-red-50/50">Insucesso</th>
                                            <th colSpan={4} className="px-4 py-1 text-center border-r text-amber-600 bg-amber-50/50">Desistência</th>
                                            <th colSpan={4} className="px-4 py-1 text-center border-r text-blue-600 bg-blue-50/50">Em Estudo</th>
                                            <th colSpan={4} className="px-4 py-1 text-center border-r text-slate-600 bg-slate-100">Total</th>
                                            <th rowSpan={2} className="px-4 py-3 text-center border-l bg-slate-50">Conv.</th>
                                        </tr>
                                        <tr>
                                            {/* EM ANDAMENTO */}
                                            <th className="px-2 py-2 text-center bg-purple-50/50">Qtd</th>
                                            <th className="px-2 py-2 text-center bg-purple-50/50">%</th>
                                            <th className="px-2 py-2 text-right bg-purple-50/50">Valor</th>
                                            <th className="px-2 py-2 text-right border-r bg-purple-50/50">%</th>
                                            {/* SUCESSO */}
                                            <th className="px-2 py-2 text-center bg-emerald-50/50">Qtd</th>
                                            <th className="px-2 py-2 text-center bg-emerald-50/50">%</th>
                                            <th className="px-2 py-2 text-right bg-emerald-50/50">Valor</th>
                                            <th className="px-2 py-2 text-right border-r bg-emerald-50/50">%</th>
                                            {/* INSUCESSO */}
                                            <th className="px-2 py-2 text-center bg-red-50/50">Qtd</th>
                                            <th className="px-2 py-2 text-center bg-red-50/50">%</th>
                                            <th className="px-2 py-2 text-right bg-red-50/50">Valor</th>
                                            <th className="px-2 py-2 text-right border-r bg-red-50/50">%</th>
                                            {/* DESISTÊNCIA */}
                                            <th className="px-2 py-2 text-center bg-amber-50/50">Qtd</th>
                                            <th className="px-2 py-2 text-center bg-amber-50/50">%</th>
                                            <th className="px-2 py-2 text-right bg-amber-50/50">Valor</th>
                                            <th className="px-2 py-2 text-right border-r bg-amber-50/50">%</th>
                                            {/* ESTUDO */}
                                            <th className="px-2 py-2 text-center bg-blue-50/50">Qtd</th>
                                            <th className="px-2 py-2 text-center bg-blue-50/50">%</th>
                                            <th className="px-2 py-2 text-right bg-blue-50/50">Valor</th>
                                            <th className="px-2 py-2 text-right border-r bg-blue-50/50">%</th>
                                            {/* TOTAL */}
                                            <th className="px-2 py-2 text-center bg-slate-100">Qtd</th>
                                            <th className="px-2 py-2 text-center bg-slate-100">%</th>
                                            <th className="px-2 py-2 text-right bg-slate-100">Valor</th>
                                            <th className="px-2 py-2 text-right bg-slate-100">%</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(dashboardStats.estimatorAnalysisData || [])
                                            .filter(est => est.total.count > 0) // Hide inactive users
                                            .map((est, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-slate-700 border-r">{est.name}</td>

                                                    {/* IN PROGRESS */}
                                                    <td className="px-2 py-3 text-center text-purple-700 font-bold bg-purple-50/10">{est.inProgress.count}</td>
                                                    <td className="px-2 py-3 text-center text-slate-500 bg-purple-50/10">{est.total.count > 0 ? ((est.inProgress.count / est.total.count) * 100).toFixed(0) + '%' : '-'}</td>
                                                    <td className="px-2 py-3 text-right text-purple-700 bg-purple-50/10">
                                                        {est.inProgress.value > 0 ? parseFloat((est.inProgress.value / 1000).toFixed(1)).toLocaleString() + 'k' : '-'}
                                                    </td>
                                                    <td className="px-2 py-3 text-right text-slate-500 border-r bg-purple-50/10">{est.total.value > 0 ? ((est.inProgress.value / est.total.value) * 100).toFixed(0) + '%' : '-'}</td>

                                                    {/* SUCCESS */}
                                                    <td className="px-2 py-3 text-center text-emerald-700 font-bold bg-emerald-50/10">{est.success.count}</td>
                                                    <td className="px-2 py-3 text-center text-slate-500 bg-emerald-50/10">{est.total.count > 0 ? ((est.success.count / est.total.count) * 100).toFixed(0) + '%' : '-'}</td>
                                                    <td className="px-2 py-3 text-right text-emerald-700 bg-emerald-50/10">
                                                        {est.success.value > 0 ? parseFloat((est.success.value / 1000).toFixed(1)).toLocaleString() + 'k' : '-'}
                                                    </td>
                                                    <td className="px-2 py-3 text-right text-slate-500 border-r bg-emerald-50/10">{est.total.value > 0 ? ((est.success.value / est.total.value) * 100).toFixed(0) + '%' : '-'}</td>

                                                    {/* FAILURE */}
                                                    <td className="px-2 py-3 text-center text-red-700 bg-red-50/10">{est.failure.count}</td>
                                                    <td className="px-2 py-3 text-center text-slate-500 bg-red-50/10">{est.total.count > 0 ? ((est.failure.count / est.total.count) * 100).toFixed(0) + '%' : '-'}</td>
                                                    <td className="px-2 py-3 text-right text-red-700 bg-red-50/10">
                                                        {est.failure.value > 0 ? parseFloat((est.failure.value / 1000).toFixed(1)).toLocaleString() + 'k' : '-'}
                                                    </td>
                                                    <td className="px-2 py-3 text-right text-slate-500 border-r bg-red-50/10">{est.total.value > 0 ? ((est.failure.value / est.total.value) * 100).toFixed(0) + '%' : '-'}</td>

                                                    {/* WITHDRAWAL */}
                                                    <td className="px-2 py-3 text-center text-amber-700 bg-amber-50/10">{est.withdrawal.count}</td>
                                                    <td className="px-2 py-3 text-center text-slate-500 bg-amber-50/10">{est.total.count > 0 ? ((est.withdrawal.count / est.total.count) * 100).toFixed(0) + '%' : '-'}</td>
                                                    <td className="px-2 py-3 text-right text-amber-700 bg-amber-50/10">
                                                        {est.withdrawal.value > 0 ? parseFloat((est.withdrawal.value / 1000).toFixed(1)).toLocaleString() + 'k' : '-'}
                                                    </td>
                                                    <td className="px-2 py-3 text-right text-slate-500 border-r bg-amber-50/10">{est.total.value > 0 ? ((est.withdrawal.value / est.total.value) * 100).toFixed(0) + '%' : '-'}</td>

                                                    {/* STUDY */}
                                                    <td className="px-2 py-3 text-center text-blue-700 bg-blue-50/10">{est.study.count}</td>
                                                    <td className="px-2 py-3 text-center text-slate-500 bg-blue-50/10">{est.total.count > 0 ? ((est.study.count / est.total.count) * 100).toFixed(0) + '%' : '-'}</td>
                                                    <td className="px-2 py-3 text-right text-blue-700 bg-blue-50/10">
                                                        {est.study.value > 0 ? parseFloat((est.study.value / 1000).toFixed(1)).toLocaleString() + 'k' : '-'}
                                                    </td>
                                                    <td className="px-2 py-3 text-right text-slate-500 border-r bg-blue-50/10">{est.total.value > 0 ? ((est.study.value / est.total.value) * 100).toFixed(0) + '%' : '-'}</td>

                                                    {/* TOTAL */}
                                                    <td className="px-2 py-3 text-center font-bold text-slate-800 bg-slate-50/30">{est.total.count}</td>
                                                    <td className="px-2 py-3 text-center text-slate-500 bg-slate-50/30">100%</td>
                                                    <td className="px-2 py-3 text-right font-bold text-slate-800 bg-slate-50/30">
                                                        {est.total.value > 0 ? parseFloat((est.total.value / 1000).toFixed(1)).toLocaleString() + 'k' : '-'}
                                                    </td>
                                                    <td className="px-2 py-3 text-right text-slate-500 bg-slate-50/30">100%</td>

                                                    {/* CONVERSION RATE */}
                                                    <td className="px-4 py-3 text-center font-bold text-slate-700 border-l bg-slate-50/50">
                                                        {est.total.count > 0 ? ((est.success.count / est.total.count) * 100).toFixed(0) + '%' : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>



                        {/* FUNNEL CHART - Sales Funnel (Substitutes Client Analysis) - FULL WIDTH CONTAINER */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <Filter size={20} className="text-slate-600" />
                                Funil de Vendas (Conversão)
                            </h3>
                            <div className="flex-1 min-h-[420px] flex flex-row items-center justify-center gap-3 py-8">
                                <div className="w-full max-w-[500px] flex justify-center">
                                    <FunnelChartSVG
                                        width={500}
                                        height={500}
                                        levels={[
                                            {
                                                label: "Total",
                                                subLabel: "(100%)",
                                                color: "#fbbf24",
                                                topColor: "#d97706"
                                            },
                                            {
                                                label: "Desistência",
                                                subLabel: dashboardStats.totalOpsCount > 0 ? `${(relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.WITHDRAWAL).length / dashboardStats.totalOpsCount * 100).toFixed(0)}%` : "0%",
                                                color: "#f97316",
                                                topColor: "#c2410c"
                                            },
                                            {
                                                label: "Em Estudo",
                                                subLabel: dashboardStats.totalOpsCount > 0 ? `${(relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.STUDY).length / dashboardStats.totalOpsCount * 100).toFixed(0)}%` : "0%",
                                                color: "#ec4899",
                                                topColor: "#be185d"
                                            },
                                            {
                                                label: "Perdida",
                                                subLabel: dashboardStats.totalOpsCount > 0 ? `${(relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.FAILURE).length / dashboardStats.totalOpsCount * 100).toFixed(0)}%` : "0%",
                                                color: "#9333ea",
                                                topColor: "#7e22ce"
                                            },
                                            {
                                                label: "Venda",
                                                subLabel: dashboardStats.totalOpsCount > 0 ? `${(relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.SUCCESS).length / dashboardStats.totalOpsCount * 100).toFixed(0)}%` : "0%",
                                                color: "#10b981",
                                                topColor: "#047857"
                                            },
                                        ]}
                                        margin={{ top: 20, right: 0, bottom: 20, left: 20 }} // Zero right margin to touch edge
                                        topWidth={360}
                                        bottomWidth={50}
                                        stroke="#475569"
                                        hoveredIndex={hoveredFunnelIndex}
                                        onHover={setHoveredFunnelIndex}
                                        renderLabelsInside={true}
                                        extendConnectors={true}
                                        gap={12} // Explicit gap matching CSS gap-3 (12px)
                                        levelHeight={90} // Explicit height matching CSS h-[90px]
                                    />
                                </div>

                                {/* STATS PANEL (RIGHT SIDE) */}
                                <div className="flex flex-col gap-3 min-w-[300px] pl-4">
                                    {/* LEVEL 1: TOTAL */}
                                    <div
                                        className={`h-[90px] bg-white p-3 rounded-r-lg border-l-4 border-amber-400 shadow-sm text-xs transition-all duration-300 cursor-pointer flex flex-col justify-center ${hoveredFunnelIndex === 0 ? 'scale-105 shadow-md bg-amber-50' : hoveredFunnelIndex !== null ? 'opacity-50' : 'hover:bg-slate-50'}`}
                                        onMouseEnter={() => setHoveredFunnelIndex(0)}
                                        onMouseLeave={() => setHoveredFunnelIndex(null)}
                                    >
                                        <div className="grid grid-cols-2 gap-2 items-center">
                                            <div>
                                                <span className="block text-slate-400 text-[10px] uppercase">QTD</span>
                                                <span className="font-bold text-slate-700 text-xl">{dashboardStats.totalOpsCount}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="block text-slate-400 text-[10px] uppercase">VALOR</span>
                                                <span className="font-bold text-amber-600 text-lg">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(dashboardStats.totalPipelineValue)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* LEVEL 2: WITHDRAWAL */}
                                    <div
                                        className={`h-[90px] bg-white p-3 rounded-r-lg border-l-4 border-orange-500 shadow-sm text-xs transition-all duration-300 cursor-pointer flex flex-col justify-center ${hoveredFunnelIndex === 1 ? 'scale-105 shadow-md bg-orange-50' : hoveredFunnelIndex !== null ? 'opacity-50' : 'hover:bg-slate-50'}`}
                                        onMouseEnter={() => setHoveredFunnelIndex(1)}
                                        onMouseLeave={() => setHoveredFunnelIndex(null)}
                                    >
                                        <div className="grid grid-cols-2 gap-2 items-center">
                                            <div>
                                                <span className="block text-slate-400 text-[10px] uppercase">QTD</span>
                                                <span className="font-bold text-slate-700 text-xl">{relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.WITHDRAWAL).length}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="block text-slate-400 text-[10px] uppercase">VALOR</span>
                                                <span className="font-bold text-orange-600 text-lg">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(dashboardStats.outcomes.withdrawal)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* LEVEL 3: STUDY */}
                                    <div
                                        className={`h-[90px] bg-white p-3 rounded-r-lg border-l-4 border-pink-500 shadow-sm text-xs transition-all duration-300 cursor-pointer flex flex-col justify-center ${hoveredFunnelIndex === 2 ? 'scale-105 shadow-md bg-pink-50' : hoveredFunnelIndex !== null ? 'opacity-50' : 'hover:bg-slate-50'}`}
                                        onMouseEnter={() => setHoveredFunnelIndex(2)}
                                        onMouseLeave={() => setHoveredFunnelIndex(null)}
                                    >
                                        <div className="grid grid-cols-2 gap-2 items-center">
                                            <div>
                                                <span className="block text-slate-400 text-[10px] uppercase">QTD</span>
                                                <span className="font-bold text-slate-700 text-xl">{relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.STUDY).length}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="block text-slate-400 text-[10px] uppercase">VALOR</span>
                                                <span className="font-bold text-pink-600 text-lg">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(dashboardStats.outcomes.study)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* LEVEL 4: FAILURE */}
                                    <div
                                        className={`h-[90px] bg-white p-3 rounded-r-lg border-l-4 border-purple-600 shadow-sm text-xs transition-all duration-300 cursor-pointer flex flex-col justify-center ${hoveredFunnelIndex === 3 ? 'scale-105 shadow-md bg-purple-50' : hoveredFunnelIndex !== null ? 'opacity-50' : 'hover:bg-slate-50'}`}
                                        onMouseEnter={() => setHoveredFunnelIndex(3)}
                                        onMouseLeave={() => setHoveredFunnelIndex(null)}
                                    >
                                        <div className="grid grid-cols-2 gap-2 items-center">
                                            <div>
                                                <span className="block text-slate-400 text-[10px] uppercase">QTD</span>
                                                <span className="font-bold text-slate-700 text-xl">{relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.FAILURE).length}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="block text-slate-400 text-[10px] uppercase">VALOR</span>
                                                <span className="font-bold text-purple-600 text-lg">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(dashboardStats.outcomes.failure)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* LEVEL 5: SUCCESS */}
                                    <div
                                        className={`h-[90px] bg-white p-3 rounded-r-lg border-l-4 border-emerald-500 shadow-sm text-xs transition-all duration-300 cursor-pointer flex flex-col justify-center ${hoveredFunnelIndex === 4 ? 'scale-105 shadow-md bg-emerald-50' : hoveredFunnelIndex !== null ? 'opacity-50' : 'hover:bg-slate-50'}`}
                                        onMouseEnter={() => setHoveredFunnelIndex(4)}
                                        onMouseLeave={() => setHoveredFunnelIndex(null)}
                                    >
                                        <div className="grid grid-cols-2 gap-2 items-center">
                                            <div>
                                                <span className="block text-slate-400 text-[10px] uppercase">QTD</span>
                                                <span className="font-bold text-slate-700 text-xl">{relevantOpportunities.filter(op => op.pipelineStage === PipelineStage.RESULTADO && op.result === TaskOutcome.SUCCESS).length}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="block text-slate-400 text-[10px] uppercase">VALOR</span>
                                                <span className="font-bold text-emerald-600 text-lg">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(dashboardStats.outcomes.success)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. GESTÃO DE AÇÕES OPERACIONAIS (NEW SECTION) */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <h3 className="font-bold text-slate-700 text-lg flex items-center gap-2">
                                    <Target size={24} className="text-red-600" />
                                    Gestão de Ações
                                </h3>

                                {/* ACTION FILTERS */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Priority Filter */}
                                    <select
                                        className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-600 focus:outline-none focus:border-blue-400"
                                        value={actionPriorityFilter}
                                        onChange={(e) => setActionPriorityFilter(e.target.value)}
                                    >
                                        <option value="">Prioridade: Todas</option>
                                        <option value="ALTO">Alta</option>
                                        <option value="MEDIO">Média</option>
                                        <option value="BAIXO">Baixa</option>
                                    </select>

                                    {/* User Filter (Sanitized) */}
                                    <select
                                        className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-600 focus:outline-none focus:border-blue-400 max-w-[150px]"
                                        value={actionUserFilter}
                                        onChange={(e) => setActionUserFilter(e.target.value)}
                                    >
                                        <option value="">Responsável: Todos</option>
                                        {users
                                            .filter(u => {
                                                if (u.name === 'Sistema') return false;
                                                // Sanitation: Active if has tasks or is current user
                                                const hasTasks = tasks.some(t => t.assigneeId === u.id);
                                                const hasOps = (opportunities || []).some(o => o.ownerId === u.id);
                                                const isSelf = currentUser && u.email === currentUser.email; // Proxy for ID
                                                return hasTasks || hasOps || isSelf;
                                            })
                                            .sort((a, b) => a.name.localeCompare(b.name))
                                            .map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))
                                        }
                                    </select>

                                    {/* Client Filter */}
                                    <select
                                        className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-600 focus:outline-none focus:border-blue-400 max-w-[150px]"
                                        value={actionClientFilter}
                                        onChange={(e) => setActionClientFilter(e.target.value)}
                                    >
                                        <option value="">Cliente: Todos</option>
                                        {Array.from(new Set(tasks.map(t => t.clientName).filter(Boolean))).sort().map(c => (
                                            <option key={String(c)} value={String(c)}>{String(c)}</option>
                                        ))}
                                    </select>

                                    {/* SHOW COMPLETED TOGGLE */}
                                    <button
                                        onClick={() => setShowCompleted(!showCompleted)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${showCompleted
                                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                            }`}
                                    >
                                        {showCompleted ? <CheckCircle size={14} /> : <div className="w-3.5 h-3.5 border-2 border-slate-300 rounded flex items-center justify-center" />}
                                        Mostrar Concluídas
                                    </button>

                                    {/* Clear Filters */}
                                    {(actionPriorityFilter || actionUserFilter || actionClientFilter) && (
                                        <button
                                            onClick={() => { setActionPriorityFilter(''); setActionUserFilter(''); setActionClientFilter(''); }}
                                            className="text-xs text-red-500 font-bold hover:underline"
                                        >
                                            <X size={12} className="inline mr-1" /> Limpar
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* TASKS GRID */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {(() => {
                                    // Filter Logic
                                    const filteredActions = getFilteredTasks(tasks || []).filter(task => { // Use date filter base
                                        // 0. Completed Filter
                                        if (!showCompleted && task.status === TaskStatus.COMPLETED) return false;
                                        // 1. Priority
                                        if (actionPriorityFilter && task.priority !== actionPriorityFilter) return false;
                                        // 2. User
                                        if (actionUserFilter && task.assigneeId !== actionUserFilter) return false;
                                        // 3. Client
                                        if (actionClientFilter && task.clientName !== actionClientFilter) return false;

                                        return true;
                                    });

                                    if (filteredActions.length === 0) {
                                        return (
                                            <div className="col-span-full py-10 flex flex-col items-center justify-center text-slate-400">
                                                <Target size={40} className="mb-2 opacity-50" />
                                                <p>Nenhuma ação encontrada para os filtros selecionados.</p>
                                            </div>
                                        );
                                    }

                                    return filteredActions.map(task => (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            assignee={users.find(u => u.id === task.assigneeId)}
                                            onEdit={(t) => { setEditingTask(t); setIsTaskModalOpen(true); }}
                                            onStatusChange={() => { }} // Handle internal status change via edit
                                            onDelete={handleDeleteTask}
                                            simple={false}
                                        />
                                    ))
                                })()}
                            </div>
                        </div>

                    </div>
                )}

                {/* STRATEGIC VIEW (PIPELINE) */}
                {
                    view === 'STRATEGIC' && (
                        <div
                            className="flex-1 flex flex-col gap-6 overflow-hidden min-h-0"
                        >
                            {/* NEW PIPELINE BOARD - Task 4: Fixed Height */}
                            <div className="h-full bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-hidden flex flex-col">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4 text-xl flex-shrink-0">
                                    <Activity size={24} className="text-purple-600" /> Pipeline de Vendas
                                </h3>
                                <div className="flex-1 overflow-hidden">
                                    <PipelineBoard
                                        bids={(opportunities || [])} // Corrected prop name from 'opportunities' to 'bids'
                                        refreshBids={refresh}
                                        onEditBid={(op) => { setEditingOpportunity(op); setIsOpportunityModalOpen(true); }}
                                        onDeleteBid={handleDeleteOpportunity}
                                        onTaskCreated={(newTask) => {
                                            setTasks(prev => [...prev, newTask]);
                                            toast.success("Ação criada a partir do pipeline!");
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )
                }


                {/* SETTINGS VIEW */}
                {
                    view === 'SETTINGS' && (
                        <div
                            className="max-w-4xl mx-auto space-y-8"
                        >
                            <EscalationSettings chain={helpChain} onSave={setHelpChain} />

                            {/* MIGRATION TOOL (Admin) */}
                            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                                    <AlertTriangle className="text-yellow-500" /> Ferramentas de Migração
                                </h3>
                                <p className="text-sm text-slate-500 mb-4">
                                    Use esta ferramenta para migrar dados legados ("Opportunities") para a nova estrutura unificada ("Bids").
                                    A operação é segura e não duplica dados já migrados.
                                </p>
                                <button
                                    onClick={async () => {
                                        if (confirm("Deseja iniciar a migração de dados? Isso pode levar alguns instantes.")) {
                                            try {
                                                const result = await migrateOpportunitiesToBidsOnce();
                                                alert(`Migração Concluída!\nMigrados: ${result.migratedCount}\nPulados: ${result.skippedCount}\nErros: ${result.errorsCount}`);
                                                refresh(); // Refresh context
                                            } catch (e) {
                                                alert("Erro na migração: " + e);
                                            }
                                        }
                                    }}
                                    className="px-4 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition-colors"
                                >
                                    Executar Migração (Opportunities -&gt; Bids)
                                </button>
                            </div>
                        </div>
                    )
                }
            </div >

            {/* MODAL OVERLAYS */}
            {
                isOpportunityModalOpen && (
                    <OpportunityForm
                        initialData={editingOpportunity}
                        linkedTasks={(tasks || []).filter(t => t.opportunityId === editingOpportunity?.id)}
                        onClose={() => { setIsOpportunityModalOpen(false); setEditingOpportunity(undefined); }}
                        onSuccess={refresh}
                    />
                )
            }
            <TaskForm
                isOpen={isTaskModalOpen}
                initialData={editingTask || (
                    contractIdFilter ? { contractId: contractIdFilter } :
                        solutionIdFilter ? { solutionId: solutionIdFilter } :
                            kpiIdFilter ? { kpiId: kpiIdFilter } : undefined
                )}
                users={users}
                availableParents={[
                    ...(tasks || []).filter(t => !t.parentId && !t.opportunityId).map(t => ({ ...t, id: String(t.id), title: String(t.title), clientName: String(t.clientName || '') })),
                    ...(opportunities || []).map(op => {
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
                            assigneeId: op.ownerId || '',
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
                onDelete={handleDeleteTask}
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
