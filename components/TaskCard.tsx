import React, { useMemo } from 'react';
import { Task, TaskStatus, User, TaskOutcome } from '../types';
import { Clock, AlertCircle, MoreHorizontal, User as UserIcon, Tag, Building, DollarSign, Target, Link, Award, Trash2 } from 'lucide-react';
import { isPast, differenceInDays, format, isValid } from 'date-fns';

import { useEntityLookup } from '../hooks/useEntityLookup';
import { UserAvatar } from './ui/UserAvatar';

interface Props {
  task: Task;
  assignee?: User; // Can be kept for compatibility but preferred is lookup
  childTasks?: Task[];
  onEdit: (task: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete?: (id: string) => void;
  simple?: boolean;
}

export const TaskCard: React.FC<Props> = ({ task, childTasks = [], onEdit, onStatusChange, onDelete, simple = false }) => {
  const { getInternalUser } = useEntityLookup();

  // Resolve Internal Responsible
  const responsibleUser = getInternalUser(task.assigneeId);

  // SAFE DATE CHECKS
  const safeEndDate = isValid(task.endDate) ? task.endDate : new Date();
  const daysLeft = differenceInDays(safeEndDate, new Date());
  const isOverdue = isPast(safeEndDate) && task.status !== TaskStatus.COMPLETED;
  const isMother = !task.parentId;

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

  // PRIORITY COLORS (NEON)
  const priorityColor = useMemo(() => {
    switch (task.priority) {
      case 'ALTO': return 'bg-red-50 text-red-600 border border-red-200 shadow-[0_0_10px_rgba(239,68,68,0.2)] animate-pulse-slow';
      case 'MEDIO': return 'bg-blue-50 text-blue-600 border border-blue-200 shadow-[0_0_8px_rgba(59,130,246,0.2)]';
      case 'BAIXO': return 'bg-slate-50 text-slate-500 border border-slate-200 shadow-[0_0_5px_rgba(100,116,139,0.1)]';
      default: return 'bg-slate-50 text-slate-500 border border-slate-100';
    }
  }, [task.priority]);

  // STATUS CARD STYLES (Late Pulse vs On Time)
  const cardStatusStyle = useMemo(() => {
    if (task.status === TaskStatus.COMPLETED) return 'border-green-200 bg-green-50/30';
    if (isOverdue) return 'border-red-300 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse';
    // On Time (and Active)
    return 'border-emerald-200 shadow-sm hover:shadow-emerald-100 hover:border-emerald-300';
  }, [task.status, isOverdue]);

  // Format Dates
  const dateRange = useMemo(() => {
    const start = task.startDate ? format(new Date(task.startDate), 'dd/MM') : '';
    const end = task.endDate ? format(new Date(task.endDate), 'dd/MM') : '';
    return start && end ? `${start} até ${end}` : end;
  }, [task.startDate, task.endDate]);


  return (
    <div
      onClick={() => onEdit && onEdit(task)}
      className={`
      relative p-2 rounded-xl border bg-white cursor-pointer group
      transition-all duration-300
      ${cardStatusStyle}
      hover:-translate-y-1 overflow-hidden
    `}>

      {/* HEADER: Labels & Actions */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-wrap gap-1.5 items-center">
          {/* PRIORITY TAG */}
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${priorityColor}`}>
            {task.priority === 'ALTO' ? 'Alta' : task.priority === 'MEDIO' ? 'Média' : 'Baixa'}
          </span>

          {/* LINK TAG */}
          {task.parentId && (
            <span className="text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full border border-purple-100 font-medium flex items-center gap-1">
              <Link size={8} /> Vinculada
            </span>
          )}
        </div>

        {/* DELETE ACTION */}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            className="text-slate-300 hover:text-red-500 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* CORE INFO */}
      <div className="mb-2">
        {/* CONTEXT (CLIENT/PROPOSAL) */}
        {(task.clientName || task.proposalName) && (
          <div className="mb-1 flex flex-col">
            {task.clientName && (
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Building size={8} /> {String(task.clientName)}
              </span>
            )}
          </div>
        )}
        {/* TITLE */}
        <h3 className="font-bold text-slate-800 text-xs leading-tight mb-1 group-hover:text-blue-700 transition-colors">
          {String(task.title || 'Sem Título')}
        </h3>
        {/* DATES */}
        <p className="text-[9px] text-slate-500 font-medium flex items-center gap-1">
          <Clock size={9} className={isOverdue ? 'text-red-500' : 'text-emerald-500'} />
          {dateRange}
          {isOverdue && <span className="text-red-600 font-bold ml-1">(Atrasado)</span>}
        </p>

      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-auto">
        <div className="flex items-center gap-1">
          <UserAvatar user={responsibleUser} size="xs" />
          <span className="text-[9px] text-slate-600 font-medium truncate max-w-[80px]">
            {responsibleUser ? responsibleUser.name.split(' ')[0] : 'N/A'}
          </span>
        </div>

        {/* DEADLINE COUNTDOWN */}
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${isOverdue ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
          {daysLeft < 0 ? `${Math.abs(daysLeft)}d atr.` : `${daysLeft}d rest.`}
        </span>
      </div>

    </div >
  );
};