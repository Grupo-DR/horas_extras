import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Activity, Calendar, BarChart2 } from 'lucide-react';
import { powerBiReports, PowerBiReport } from '../../data/powerbiReports';
import { CorporateSidebar, SidebarItem } from '../../components/navigation/CorporateSidebar';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'sonner';

export const PowerBiView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, logout, hasModuleAccess } = useAuth();
  const area = searchParams.get('area');

  const [availableReports, setAvailableReports] = useState<PowerBiReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<PowerBiReport | null>(null);

  useEffect(() => {
    if (area) {
      if (!hasModuleAccess('bi_reports', area)) {
          toast.error('Você não tem acesso a este painel BI.');
          navigate('/');
          return;
      }

      const filtered = powerBiReports.filter(
        (r) => r.area.toLowerCase() === area.toLowerCase()
      );
      setAvailableReports(filtered);
      if (filtered.length > 0) {
        setSelectedReport(filtered[0]);
      }
    }
  }, [area, hasModuleAccess, navigate]);

  const sidebarItems: SidebarItem[] = availableReports.map((report) => ({
    key: report.id,
    label: report.title,
    icon: BarChart2,
    onClick: () => setSelectedReport(report),
    isActive: selectedReport?.id === report.id,
  }));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-50 w-full overflow-hidden">
      {/* Nexus Standard Sidebar */}
      <CorporateSidebar
        brand={{
            topLogoSrc: "/assets/dr-logo.png",
            title: area === 'Financeiro' ? 'BUSINESS ANALYTICS' : (area || "Centro de Inteligência"),
            subtitle: "Relatórios BI"
        }}
        items={sidebarItems}
        userDisplay={{
            name: user?.name || 'Usuário',
            role: user?.role || 'Membro',
            avatarUrl: user?.avatarUrl
        }}
        onLogout={handleLogout}
        accountLinkTo="/config/account"
        storageKey={`drnexus.sidebar.collapsed.powerbi.${area}`}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100 p-2 lg:p-3 relative">
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
          {selectedReport ? (
            <>
              {/* Header do Relatório */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white flex-shrink-0">
                <h2 className="text-lg font-bold text-slate-800">
                  {selectedReport.title}
                </h2>
              </div>

              {/* Área do iframe */}
              <div className="flex-1 relative w-full bg-slate-50">
                <iframe
                  title={selectedReport.title}
                  src={selectedReport.url}
                  className="absolute inset-0 w-full h-full border-0"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <Activity className="w-16 h-16 mb-4 text-slate-200" />
              <p className="text-lg font-medium text-slate-600">Selecione um relatório</p>
              <p className="text-sm mt-1">Escolha um dos painéis no menu lateral para visualizar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
