import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Task, User, TaskStatus, HistoryLog, Notification } from '../types';
import { TaskForm } from '../components/TaskForm';
import { KanbanBoard } from '../components/KanbanBoard';
import { HistoryPanel } from '../components/HistoryPanel';
import { LayoutDashboard, Filter, Bell, PlusCircle, CheckSquare, Search, Users, Activity, FileText, Database, Target, X } from 'lucide-react';
import { db } from '../services/firebaseConfig';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, Timestamp, deleteDoc } from 'firebase/firestore';
import { Toaster, toast } from 'sonner';

// MOCK USERS (Shared context would be better, but duplicating for safety as per pattern)
const MOCK_USERS: User[] = [
    { id: 'u1', name: 'Antonio Augusto da Silva', role: 'Analista Comercial', email: 'antonio.silva@grupodr.com.br' },
    { id: 'u2', name: 'Cintia Ferreira', role: 'Engenheira Orçamentista', email: 'cintia.ferreira@grupodr.com.br' },
    { id: 'u3', name: 'Tatiana Guimarães', role: 'Engenheira Auxiliar', email: 'tatiana.guimaraes@grupodr.com.br' },
    { id: 'u4', name: 'Nilton Camilo', role: 'Gerente Comercial', email: 'nilton.camilo@grupodr.com.br' },
];

const stripUndefined = (obj: any): any => {
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) return obj.map(v => stripUndefined(v));
    if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            const value = obj[key];
            if (value !== undefined) acc[key] = stripUndefined(value);
            return acc;
        }, {} as any);
    }
    return obj;
};

export const ActionsView: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // FILTERS STATE
    const contractIdParam = searchParams.get('contractId');
    const solutionIdParam = searchParams.get('solutionId');
    const kpiIdParam = searchParams.get('kpiId');

    const [filterUser, setFilterUser] = useState<string>('');
    const [filterModule, setFilterModule] = useState<'ALL' | 'COMMERCIAL' | 'CONTRACT' | 'DATA' | 'KPI'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // Pre-select module based on URL params
    useEffect(() => {
        if (contractIdParam) setFilterModule('CONTRACT');
        else if (solutionIdParam) setFilterModule('DATA');
        else if (kpiIdParam) setFilterModule('KPI');
        else setFilterModule('ALL');
    }, [contractIdParam, solutionIdParam, kpiIdParam]);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [logs, setLogs] = useState<HistoryLog[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    // FIREBASE SYNC
    useEffect(() => {
        const q = query(collection(db, 'tasks'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loaded: Task[] = snapshot.docs.map(doc => {
                const data = doc.data();
                const convertDate = (val: any) => {
                    if (!val) return new Date();
                    if (typeof val.toDate === 'function') return val.toDate();
                    if (val instanceof Date) return val;
                    const d = new Date(val);
                    return isNaN(d.getTime()) ? new Date() : d;
                };

                return {
                    id: doc.id,
                    ...data,
                    startDate: convertDate(data.startDate),
                    endDate: convertDate(data.endDate),
                } as Task;
            });
            setTasks(loaded);
        });
        return () => unsubscribe();
    }, []);

    const addLog = (taskId: string, action: string, details?: string) => {
        const newLog: HistoryLog = {
            id: Math.random().toString(36).substr(2, 9),
            taskId, action, details, timestamp: new Date(), user: 'Sistema'
        };
        setLogs(prev => [newLog, ...prev]);
    };

    const handleSaveTask = async (taskData: Partial<Task>) => {
        try {
            const cleanData = stripUndefined(taskData);
            if (cleanData.startDate instanceof Date) cleanData.startDate = Timestamp.fromDate(cleanData.startDate);
            if (cleanData.endDate instanceof Date) cleanData.endDate = Timestamp.fromDate(cleanData.endDate);

            if (editingTask) {
                await updateDoc(doc(db, 'tasks', editingTask.id), cleanData);
                addLog(editingTask.id, 'Atualização', 'Tarefa editada via Gestão de Ações');
                toast.success('Tarefa atualizada!');
            } else {
                const newTask = {
                    ...cleanData,
                    status: TaskStatus.PENDING,
                    progress: 0,
                    outcome: null
                };
                const docRef = await addDoc(collection(db, 'tasks'), stripUndefined(newTask));
                addLog(docRef.id, 'Criação', 'Tarefa criada via Gestão de Ações');
                toast.success('Tarefa criada!');
            }
            setIsTaskModalOpen(false);
            setEditingTask(undefined);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar tarefa');
        }
    };

    const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
        try {
            await updateDoc(doc(db, 'tasks', taskId), { status: newStatus });
            toast.success('Status atualizado');
        } catch (error) {
            toast.error('Erro ao mover tarefa');
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (window.confirm("ATENÇÃO: Tem certeza que deseja excluir esta ação permanentemente?")) {
            try {
                await deleteDoc(doc(db, 'tasks', taskId));
                toast.success('Tarefa excluída');
            } catch (error) {
                console.error(error);
                toast.error('Erro ao excluir tarefa');
            }
        }
    };



    // FILTER LOGIC
    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            // 1. Module Filter (Hybrid Approach: ID OR Category)
            if (filterModule === 'COMMERCIAL' && (!t.opportunityId && t.moduleCategory !== 'COMERCIAL')) return false;
            if (filterModule === 'CONTRACT' && (!t.contractId && t.moduleCategory !== 'CONTRATOS')) return false;
            if (filterModule === 'DATA' && (!t.solutionId && t.moduleCategory !== 'DADOS')) return false;
            if (filterModule === 'KPI' && (!t.kpiId && t.moduleCategory !== 'KPI')) return false;

            // 1.1 Strict Context URL Filter (Overrides Module generic filter if present)
            if (contractIdParam && t.contractId !== contractIdParam) return false;
            if (solutionIdParam && t.solutionId !== solutionIdParam) return false;
            if (kpiIdParam && t.kpiId !== kpiIdParam) return false;

            // 2. User Filter
            if (filterUser && t.assigneeId !== filterUser) return false;

            // 3. Search Term
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                if (!t.title.toLowerCase().includes(term) && !t.clientName?.toLowerCase().includes(term)) return false;
            }

            return true;
        });
    }, [tasks, filterModule, filterUser, searchTerm, contractIdParam, solutionIdParam, kpiIdParam]);

    // ANALYTICS (Performance Table Logic)
    const performanceStats = useMemo(() => {
        // Calculate based on FILTERED view (Contextual Performance)
        return MOCK_USERS.map(user => {
            const userTasks = filteredTasks.filter(t => t.assigneeId === user.id);
            const total = userTasks.length;
            const completed = userTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
            const late = userTasks.filter(t => t.status === TaskStatus.LATE).length;
            const inProgress = userTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
            const productivity = total > 0 ? Math.round((completed / total) * 100) : 0;

            return { user, total, completed, late, inProgress, productivity };
        }).sort((a, b) => b.productivity - a.productivity); // Sort by best performance
    }, [filteredTasks]);

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <CheckSquare className="text-blue-600" /> Gestão de Ações
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Central de tarefas operacionais e acompanhamento.</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* SEARCH */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar ação..."
                            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none w-64 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={() => setIsHistoryOpen(true)}
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors relative"
                    >
                        <Bell size={20} />
                        {notifications.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
                    </button>

                    <button
                        onClick={() => { setEditingTask(undefined); setIsTaskModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                    >
                        <PlusCircle size={18} /> Nova Ação
                    </button>
                </div>
            </div>

            {/* FILTER BAR */}
            <div className="px-8 py-4 bg-white/50 backdrop-blur border-b border-slate-200 flex items-center gap-4 overflow-x-auto">
                <div className="flex items-center gap-2 text-slate-600 font-bold text-sm">
                    <Filter size={16} /> Filtros:
                </div>

                {/* MODULE FILTER */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                    {[
                        { id: 'ALL', label: 'Todos', icon: LayoutDashboard },
                        { id: 'COMMERCIAL', label: 'Comercial', icon: Activity },
                        { id: 'CONTRACT', label: 'Contratos', icon: FileText },
                        { id: 'DATA', label: 'Dados', icon: Database },
                        { id: 'KPI', label: 'KPIs', icon: Target },
                    ].map(mod => (
                        <button
                            key={mod.id}
                            onClick={() => {
                                setFilterModule(mod.id as any);
                                // Clear URL params if switching manual filter to allow broad view
                                if (contractIdParam || solutionIdParam || kpiIdParam) {
                                    navigate('/acoes');
                                }
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterModule === mod.id ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <mod.icon size={14} /> {mod.label}
                        </button>
                    ))}
                </div>

                <div className="w-px h-6 bg-slate-200 mx-2"></div>

                {/* USER FILTER */}
                <select
                    className="bg-white border border-slate-200 text-slate-600 text-sm rounded-lg px-3 py-1.5 outline-none focus:border-blue-500"
                    value={filterUser}
                    onChange={(e) => setFilterUser(e.target.value)}
                >
                    <option value="">Todos os Colaboradores</option>
                    {MOCK_USERS.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>

                {(contractIdParam || solutionIdParam || kpiIdParam) && (
                    <button
                        onClick={() => navigate('/acoes')}
                        className="ml-auto text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100"
                    >
                        <X size={14} /> Limpar Contexto Ativo
                    </button>
                )}
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-auto p-6 space-y-8">

                {/* KANBAN */}
                <div className="h-[600px] overflow-hidden bg-slate-100/50 rounded-xl border border-slate-200">
                    <KanbanBoard
                        tasks={filteredTasks}
                        users={MOCK_USERS}
                        onStatusChange={handleStatusChange}
                        onEdit={(t) => { setEditingTask(t); setIsTaskModalOpen(true); }}
                        onDelete={handleDeleteTask}
                    />
                </div>

                {/* PERFORMANCE TABLE (Migrated) */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                        <Users size={18} className="text-slate-500" />
                        <h3 className="font-bold text-slate-700">Desempenho por Colaborador (Filtrado)</h3>
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
                            {performanceStats.map((col) => (
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

            {/* MODALS */}
            <TaskForm
                isOpen={isTaskModalOpen}
                initialData={editingTask || (
                    contractIdParam ? { contractId: contractIdParam } :
                        solutionIdParam ? { solutionId: solutionIdParam } :
                            kpiIdParam ? { kpiId: kpiIdParam } : undefined
                )}
                users={MOCK_USERS}
                availableParents={[]} // No parents selection for now in ActionsView quick add, or maybe yes? Leaving empty for simplicity as per requirements (mostly children tasks)
                onClose={() => { setIsTaskModalOpen(false); setEditingTask(undefined); }}
                onSave={handleSaveTask}
            />

            <HistoryPanel
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                logs={logs}
                notifications={notifications}
            />
            <Toaster position="top-right" richColors />
        </div>
    );
};
