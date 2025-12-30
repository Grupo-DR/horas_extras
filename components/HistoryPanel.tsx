import React from 'react';
import { HistoryLog, Notification } from '../types';
import { Mail, History, X } from 'lucide-react';

interface Props {
  logs: HistoryLog[];
  notifications: Notification[];
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryPanel: React.FC<Props> = ({ logs, notifications, isOpen, onClose }) => {
  const [tab, setTab] = React.useState<'LOGS' | 'EMAILS'>('LOGS');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200">
      <div className="p-4 border-b flex justify-between items-center bg-slate-50">
        <h2 className="font-bold text-slate-800">Histórico do Sistema</h2>
        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full">
          <X size={20} />
        </button>
      </div>

      <div className="flex border-b">
        <button
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${tab === 'LOGS' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          onClick={() => setTab('LOGS')}
        >
          <History size={16} /> Atividades
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${tab === 'EMAILS' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          onClick={() => setTab('EMAILS')}
        >
          <Mail size={16} /> Emails Disparados
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'LOGS' ? (
          logs.length === 0 ? <p className="text-center text-slate-400 mt-10">Nenhuma atividade registrada.</p> :
          logs.map((log) => (
            <div key={log.id} className="flex gap-3 text-sm">
              <div className="min-w-[4px] w-1 bg-slate-300 rounded-full"></div>
              <div>
                <p className="font-medium text-slate-800">{log.action}</p>
                <p className="text-slate-500 text-xs">{log.user} - {new Date(log.timestamp).toLocaleString()}</p>
                {log.details && <p className="text-slate-600 mt-1 text-xs bg-slate-50 p-2 rounded">{log.details}</p>}
              </div>
            </div>
          ))
        ) : (
          notifications.length === 0 ? <p className="text-center text-slate-400 mt-10">Nenhum email enviado ainda.</p> :
          notifications.map((notif) => (
            <div key={notif.id} className="border border-slate-200 rounded-lg p-3 text-sm bg-slate-50">
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  notif.type === 'ESCALATION' ? 'bg-red-100 text-red-700' :
                  notif.type === 'LATE_WARNING' ? 'bg-orange-100 text-orange-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {notif.type}
                </span>
                <span className="text-xs text-slate-400">{new Date(notif.sentAt).toLocaleTimeString()}</span>
              </div>
              <p className="font-bold text-slate-800 mb-1">{notif.subject}</p>
              <p className="text-slate-600 text-xs mb-2">Para: <span className="font-mono bg-white px-1 border rounded">{notif.recipient}</span></p>
              <p className="text-xs text-slate-500">Ref: {notif.taskTitle}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
