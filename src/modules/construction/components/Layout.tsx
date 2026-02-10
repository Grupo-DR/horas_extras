
import React from 'react';
import {
  LayoutDashboard, Table, UploadCloud, HardHat,
  Coins, CalendarRange, Download, Trash2, Cloud, LogOut
} from 'lucide-react';
import { ViewType } from '../types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewType;
  setView: (view: ViewType) => void;
  hasData: boolean;
  onExportBackup: () => void;
  onClearData: () => void;
}

const Layout: React.FC<LayoutProps> = ({
  children, activeView, setView, hasData, onExportBackup, onClearData
}) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-amber-500 p-2 rounded-lg">
            <HardHat className="w-6 h-6 text-slate-900" />
          </div>
          <span className="font-bold text-lg tracking-tight">RDO Analytics</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {hasData && (
            <>
              <div className="px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">Operacional</div>
              <button
                onClick={() => setView('dashboard')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeView === 'dashboard' ? 'bg-amber-500 text-slate-900 font-semibold' : 'hover:bg-slate-800 text-slate-400'
                  }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setView('planning')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeView === 'planning' ? 'bg-amber-500 text-slate-900 font-semibold' : 'hover:bg-slate-800 text-slate-400'
                  }`}
              >
                <CalendarRange className="w-5 h-5" />
                <span>Planejamento</span>
              </button>
              <button
                onClick={() => setView('table')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeView === 'table' ? 'bg-amber-500 text-slate-900 font-semibold' : 'hover:bg-slate-800 text-slate-400'
                  }`}
              >
                <Table className="w-5 h-5" />
                <span>Registros Detalhados</span>
              </button>
            </>
          )}

          <div className="px-4 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Configurações</div>

          <button
            onClick={() => setView('services')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeView === 'services' ? 'bg-amber-500 text-slate-900 font-semibold' : 'hover:bg-slate-800 text-slate-400'
              }`}
          >
            <Coins className="w-5 h-5" />
            <span>Catálogo SAP</span>
          </button>

          <button
            onClick={() => setView('upload')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeView === 'upload' ? 'bg-amber-500 text-slate-900 font-semibold' : 'hover:bg-slate-800 text-slate-400'
              }`}
          >
            <UploadCloud className="w-5 h-5" />
            <span>Importar Dados</span>
          </button>
        </nav>

        {/* Persistence Actions */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          {/* ... existing buttons ... */}


          <button
            onClick={onExportBackup}
            className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
          >
            <Download className="w-3 h-3" /> Backup Local
          </button>
          <button
            onClick={onClearData}
            className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Limpar Sistema
          </button>

          <div className="h-px bg-slate-800 my-2" />

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
          >
            <LogOut className="w-3 h-3" /> Sair / Trocar Módulo
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50 relative">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-slate-800 capitalize">
            {activeView === 'upload' ? 'Importação de Dados' :
              activeView === 'dashboard' ? 'Painel de Indicadores' :
                activeView === 'services' ? 'Tabela de Preços SAP' :
                  activeView === 'planning' ? 'Planejamento de Frota' : 'Tabela de Operações'}
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                Database: Firestore
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
              <div className={`w-2 h-2 rounded-full ${hasData ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`}></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                {hasData ? 'Base Carregada' : 'Aguardando Import'}
              </span>
            </div>
          </div>
        </header>

        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
