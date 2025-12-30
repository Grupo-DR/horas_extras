import React from 'react';
import { Task, TaskStatus, User } from '../types';
import { TaskCard } from './TaskCard';

interface Props {
  tasks: Task[];
  users: User[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
}

const COLUMNS = [
  { id: TaskStatus.PENDING, title: 'Pendente', color: 'bg-slate-100/50 border-slate-200' },
  { id: TaskStatus.IN_PROGRESS, title: 'Em Andamento', color: 'bg-blue-50/50 border-blue-100' },
  { id: TaskStatus.LATE, title: 'Atrasado / Crítico', color: 'bg-red-50/50 border-red-100' },
  { id: TaskStatus.COMPLETED, title: 'Concluído', color: 'bg-green-50/50 border-green-100' },
];

export const KanbanBoard: React.FC<Props> = ({ tasks, users, onStatusChange, onEdit }) => {
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      onStatusChange(taskId, status);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-200px)] min-h-[500px] overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const columnTasks = tasks.filter(t => t.status === col.id);
        return (
          <div
            key={col.id}
            className={`flex-shrink-0 w-full md:w-80 rounded-xl border p-4 flex flex-col ${col.color}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-700">{col.title}</h3>
              <span className="bg-white px-2 py-0.5 rounded-full text-xs border text-slate-500 font-bold shadow-sm">
                {columnTasks.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar max-h-[calc(100vh-250px)]">
              {columnTasks.length === 0 && (
                <div className="h-24 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 text-xs">
                  Arraste tarefas aqui
                </div>
              )}
              {columnTasks.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  className="cursor-move opacity-100 hover:opacity-90 active:opacity-50 transition-opacity"
                >
                  <TaskCard
                    task={task}
                    assignee={users.find(u => u.id === task.assigneeId)}
                    onEdit={onEdit}
                    onStatusChange={onStatusChange}
                    simple={true}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};