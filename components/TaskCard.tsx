import React, { useMemo } from 'react';
import { Task, TaskStatus, User, TaskOutcome } from '../types';
import { Clock, AlertCircle, MoreHorizontal, User as UserIcon, Tag, Building, DollarSign, Target, Link, Award } from 'lucide-react';
import { isPast, differenceInDays, format, isValid } from 'date-fns';

interface Props {
  task: Task;
  assignee?: User;
  childTasks?: Task[]; // Children of this task
  onEdit: (task: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  simple?: boolean;
}

export const TaskCard: React.FC<Props> = ({ task, assignee, childTasks = [], onEdit, onStatusChange, simple = false }) => {

  // SAFE DATE CHECKS
  const safeEndDate = isValid(task.endDate) ? task.endDate : new Date();
  const daysLeft = differenceInDays(safeEndDate, new Date());
  const isOverdue = isPast(safeEndDate) && task.status !== TaskStatus.COMPLETED;
  const isMother = !task.parentId;

  // Helpers to get values from children
  // Helpers to get values from children
  // REMOVED CATEGORY LOOKUPS (previa, proposta)

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

  const formatBRL = (val?: number) => val ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';

  const displayResponsible = useMemo(() => {
    // FIX: Fallback to assigneeId (Name) if User lookup fails
    return assignee ? assignee.name : (typeof task.assigneeId === 'string' ? task.assigneeId : 'N/A');
  }, [assignee, task.assigneeId]);

  // FIX: Separate Logic for Client Contact
  const clientContactName = useMemo(() => {
    if (task.responsibleName && task.responsibleName.trim() !== '') {
      return task.responsibleName;
    }
    return null;
  }, [task.responsibleName]);

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
      case 'ALTO': return 'bg-red-50 text-red-600 border-red-100';
      case 'MEDIO': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'BAIXO': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
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
    <div
      onClick={() => onEdit && onEdit(task)} // NEW: Click to Edit
      className={`
      relative p-4 rounded-xl border border-slate-200 shadow-sm bg-white
      hover:shadow-md transition-all cursor-pointer group
      ${simple ? 'p-3' : ''}
      hover:shadow-xl hover:-translate-y-1 relative overflow-hidden ${isOverdue ? 'border-red-200 shadow-red-100' : 'border-slate-100 hover:border-slate-200'}
    `}>

      {/* DECORATIVE GRADIENT BAR */}
      <div className={`absolute top-0 left-0 w-1 h-full ${task.status === TaskStatus.COMPLETED ? 'bg-green-500' :
        isOverdue ? 'bg-red-500' :
          task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500' : 'bg-slate-300'
        }`} />

      {/* HEADER: Labels & Actions */}
      <div className="flex justify-between items-start mb-3 pl-2">
        <div className="flex flex-wrap gap-1.5 items-center">
          {!simple && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
              {statusLabel}
            </span>
          )}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${priorityColor}`}>
            {task.priority === 'ALTO' ? 'Alta' : task.priority === 'MEDIO' ? 'Média' : 'Baixa'}
          </span>
          {task.parentId && (
            <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-100 font-medium flex items-center gap-1">
              <Link size={10} /> Vinculada
            </span>
          )}
          {outcomeDetails && task.status === TaskStatus.COMPLETED && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${outcomeDetails.color}`}>
              <Award size={10} /> {outcomeDetails.label}
            </span>
          )}
        </div>
      </div>

      {/* CORE INFO */}
      <div className="mb-4 pl-2">
        {/* STRATEGIC HIGHLIGHT (MOTHERS) */}
        {isMother && (
          <div className="mb-2">
            {/* CLIENT NAME - HIERARCHY TOP */}
            {typeof task.clientName === 'string' && task.clientName && (
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Building size={10} /> {String(task.clientName)}
              </p>
            )}
            {/* PROPOSAL NAME */}
            {typeof task.proposalName === 'string' && task.proposalName && (
              <p className="text-xs font-bold text-blue-600 mb-1">{String(task.proposalName)}</p>
            )}
          </div>
        )}

        {/* FOR CHILDREN */}
        {!isMother && typeof task.clientName === 'string' && task.clientName && (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Building size={10} /> {String(task.clientName)}
          </p>
        )}

        {/* MAIN TITLE */}
        <h3 className="font-bold text-slate-800 text-base leading-snug mb-2 group-hover:text-blue-700 transition-colors" title={String(task.title || '')}>
          {String(task.title || 'Sem Título')}
        </h3>

        {!isMother && (typeof task.proposalName === 'string' && task.proposalName) && (
          <p className="text-xs text-blue-500 mb-2 font-medium">{String(task.proposalName)}</p>
        )}

        {!simple && <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed">{task.description}</p>}
      </div>

      {/* EXECUTIVES STATS (MOTHERS) */}
      {isMother && childStats && (childStats.pending > 0 || childStats.late > 0 || childStats.inProgress > 0) && (
        <div className="flex gap-2 mb-4 pl-2">
          {childStats.late > 0 && (
            <div className="flex flex-col items-center bg-red-50 border border-red-100 rounded p-1.5 min-w-[50px]">
              <span className="text-xs font-black text-red-600">{childStats.late}</span>
              <span className="text-[8px] uppercase font-bold text-red-400">Atraso</span>
            </div>
          )}
          {childStats.inProgress > 0 && (
            <div className="flex flex-col items-center bg-blue-50 border border-blue-100 rounded p-1.5 min-w-[50px]">
              <span className="text-xs font-black text-blue-600">{childStats.inProgress}</span>
              <span className="text-[8px] uppercase font-bold text-blue-400">Andam.</span>
            </div>
          )}
          {childStats.pending > 0 && (
            <div className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded p-1.5 min-w-[50px]">
              <span className="text-xs font-black text-slate-500">{childStats.pending}</span>
              <span className="text-[8px] uppercase font-bold text-slate-400">Pend.</span>
            </div>
          )}
        </div>
      )}

      {/* METRICS & FOOTER */}
      <div className="mt-auto pt-3 border-t border-slate-100 pl-2">
        {/* VALUES ROW */}
        {(task.value !== undefined && task.value > 0) && (
          <div className="flex items-center gap-3 mb-3">
            <div className="text-xs"><span className="text-slate-400 text-[10px] block">Valor</span> <span className="font-bold text-slate-700">{formatBRL(task.value)}</span></div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-white shadow-sm ring-1 ring-slate-200">
              {displayResponsible.charAt(0)}
            </div>
            <span className="text-xs font-medium text-slate-500 max-w-[80px] truncate">{displayResponsible.split(' ')[0]}</span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {isOverdue ? (
              <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-bold border border-red-100" title="Atrasado">
                <AlertCircle size={12} /> {Math.abs(daysLeft)}d
              </span>
            ) : (
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${daysLeft <= 3 ? 'text-orange-600 bg-orange-50 border-orange-100' : 'text-slate-400 bg-slate-50 border-slate-100'}`} title="Prazo">
                <Clock size={12} /> {daysLeft === 0 ? 'Hj' : `${daysLeft}d`}
              </span>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};