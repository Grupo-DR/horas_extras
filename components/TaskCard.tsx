import React, { useMemo } from 'react';
import { Task, TaskStatus, User, TaskOutcome } from '../types';
import { Clock, AlertCircle, MoreHorizontal, User as UserIcon, Tag, Building, DollarSign, Target, Link, Award } from 'lucide-react';
import { isPast, differenceInDays } from 'date-fns';

interface Props {
  task: Task;
  assignee?: User;
  childTasks?: Task[]; // Children of this task
  onEdit: (task: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  simple?: boolean;
}

export const TaskCard: React.FC<Props> = ({ task, assignee, childTasks = [], onEdit, onStatusChange, simple = false }) => {

  const daysLeft = differenceInDays(new Date(task.endDate), new Date());
  const isOverdue = isPast(new Date(task.endDate)) && task.status !== TaskStatus.COMPLETED;
  const isMother = !task.parentId;

  // Helpers to get values from children
  const previaTask = isMother ? childTasks.find(t => t.category === 'Prévia') : null;
  const propostaTask = isMother ? childTasks.find(t => t.category === 'Proposta Comercial') : null;

  // Status Counts for Mother Card
  const childStats = useMemo(() => {
    if (!isMother) return null;
    return {
      pending: childTasks.filter(t => t.status === TaskStatus.PENDING).length,
      inProgress: childTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      late: childTasks.filter(t => t.status === TaskStatus.LATE).length,
      completed: childTasks.filter(t => t.status === TaskStatus.COMPLETED).length,
    }
  }, [childTasks, isMother]);

  const formatCurrency = (val?: number) => val ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-';

  const statusColor = useMemo(() => {
    switch (task.status) {
      case TaskStatus.COMPLETED: return 'bg-green-100 text-green-700 border-green-200';
      case TaskStatus.LATE: return 'bg-red-100 text-red-700 border-red-200';
      case TaskStatus.IN_PROGRESS: return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }, [task.status]);

  const outcomeDetails = useMemo(() => {
    switch (task.outcome) {
      case TaskOutcome.SUCCESS: return { label: 'Vencemos', color: 'bg-green-100 text-green-800 border-green-200' };
      case TaskOutcome.FAILURE: return { label: 'Perdemos', color: 'bg-red-100 text-red-800 border-red-200' };
      case TaskOutcome.STUDY: return { label: 'Estudo', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case TaskOutcome.WITHDRAWAL: return { label: 'Desistência', color: 'bg-gray-100 text-gray-800 border-gray-200' };
      default: return null;
    }
  }, [task.outcome]);

  const priorityColor = useMemo(() => {
    switch (task.priority) {
      case 'HIGH': return 'bg-red-50 text-red-600 border-red-100';
      case 'MEDIUM': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'LOW': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  }, [task.priority]);

  const statusLabel = useMemo(() => {
    switch (task.status) {
      case TaskStatus.COMPLETED: return 'Concluída';
      case TaskStatus.LATE: return 'Atrasada';
      case TaskStatus.IN_PROGRESS: return 'Andamento';
      default: return 'Pendente';
    }
  }, [task.status]);

  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border hover:shadow-md transition-all ${isOverdue ? 'border-red-300' : 'border-slate-200'}`}>

      {/* HEADER: Labels & Actions */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-wrap gap-1 items-center">
          {!simple && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
              {statusLabel}
            </span>
          )}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${priorityColor}`}>
            {task.priority === 'HIGH' ? 'Alta' : task.priority === 'MEDIUM' ? 'Média' : 'Baixa'}
          </span>
          {task.parentId && (
            <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-medium flex items-center gap-1">
              <Link size={10} /> Vinculada
            </span>
          )}
          {/* OUTCOME BADGE */}
          {outcomeDetails && task.status === TaskStatus.COMPLETED && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${outcomeDetails.color}`}>
              <Award size={10} /> {outcomeDetails.label}
            </span>
          )}
        </div>

        <div className="relative group">
          <button className="text-slate-400 hover:text-slate-600 p-1">
            <MoreHorizontal size={20} />
          </button>
          <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg hidden group-hover:block z-20">
            <button onClick={() => onEdit(task)} className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700">Editar Detalhes</button>
            {task.status !== TaskStatus.COMPLETED && (
              <button onClick={() => onStatusChange(task.id, TaskStatus.COMPLETED)} className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-green-600">Finalizar</button>
            )}
            {task.status === TaskStatus.COMPLETED && (
              <button onClick={() => onStatusChange(task.id, TaskStatus.IN_PROGRESS)} className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-blue-600">Reabrir</button>
            )}
          </div>
        </div>
      </div>

      {/* CORE INFO */}
      <div className="mb-3">
        {task.clientName && (
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5 flex items-center gap-1">
            <Building size={10} /> {task.clientName}
          </p>
        )}
        <h3 className="font-bold text-slate-800 text-sm leading-tight mb-1" title={task.title}>
          {task.title}
        </h3>
        {task.proposalName && (
          <p className="text-xs text-blue-600 mb-1">{task.proposalName}</p>
        )}
        {!simple && <p className="text-slate-500 text-xs line-clamp-2">{task.description}</p>}
      </div>

      {/* CHILD SUMMARY VISUALIZATION (For Mothers) */}
      {isMother && childStats && (childStats.pending > 0 || childStats.late > 0 || childStats.inProgress > 0) && (
        <div className="flex gap-2 mb-3 bg-slate-50 p-2 rounded border border-slate-100">
          {childStats.late > 0 && (
            <div className="text-[10px] font-bold text-red-600 border border-red-200 bg-red-50 px-1.5 py-0.5 rounded" title="Atrasadas">
              {childStats.late} Atrasadas
            </div>
          )}
          {childStats.inProgress > 0 && (
            <div className="text-[10px] font-bold text-blue-600 border border-blue-200 bg-blue-50 px-1.5 py-0.5 rounded" title="Em Andamento">
              {childStats.inProgress} Andamento
            </div>
          )}
          {childStats.pending > 0 && (
            <div className="text-[10px] font-medium text-slate-500 border border-slate-200 bg-white px-1.5 py-0.5 rounded" title="Pendentes">
              {childStats.pending} Pendentes
            </div>
          )}
        </div>
      )}

      {/* MOTHER METRICS */}
      {isMother && (previaTask || propostaTask) && (
        <div className="bg-slate-50 rounded-lg p-2 mb-3 border border-slate-100 grid grid-cols-2 gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-medium">Prévia</span>
            <span className="text-xs font-bold text-slate-700">{formatCurrency(previaTask?.value)}</span>
            {previaTask?.interestScore !== undefined && (
              <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                <Target size={8} /> Nota: {previaTask.interestScore}
              </span>
            )}
          </div>
          <div className="flex flex-col border-l pl-2 border-slate-200">
            <span className="text-[10px] text-slate-400 font-medium">Proposta</span>
            <span className="text-xs font-bold text-blue-700">{formatCurrency(propostaTask?.value)}</span>
          </div>
        </div>
      )}

      {/* CHILD METRICS */}
      {!isMother && (task.value !== undefined || task.category) && (
        <div className="bg-slate-50 rounded p-2 mb-3 flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-600">{task.category}</span>
          {task.value && <span className="font-bold text-green-600">{formatCurrency(task.value)}</span>}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600" title="Responsável">
            <UserIcon size={12} className="text-slate-400" />
            <span className="max-w-[80px] truncate">{assignee?.name.split(' ')[0] || 'N/A'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {isOverdue ? (
            <span className="flex items-center gap-1 text-red-600 font-bold" title="Atrasado">
              <AlertCircle size={14} /> {Math.abs(daysLeft)}d
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-500" title="Prazo">
              <Clock size={14} /> {daysLeft === 0 ? 'Hj' : `${daysLeft}d`}
            </span>
          )}
        </div>
      </div>

    </div>
  );
};