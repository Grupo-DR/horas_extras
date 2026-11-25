import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { ContractsProvider } from './contexts/ContractsContext';
import { CrmProvider } from './contexts/CrmContext';
import { PrivateRoute } from './components/PrivateRoute';
import { Sidebar } from './layout/Sidebar';
import { Toaster } from 'sonner';
import { AppVersionBadge } from './components/AppVersionBadge';

// Páginas do Comercial
import { CommercialView } from './pages/CommercialView';
import { ProspectingView } from './pages/ProspectingView';
import { ContractsView } from './pages/ContractsView';
import { ContractDashboardView } from './pages/ContractDashboardView';
import { ConstructionSiteView } from './pages/ConstructionSiteView';
import { ActionsView } from './pages/ActionsView';
import { LoginPage } from './pages/LoginPage';
import { ClientsView } from './pages/crm/ClientsView';
import { ClientDetailsView } from './pages/crm/ClientDetailsView';
import { AccountSettings } from './pages/config/AccountSettings';

// Módulo Capital Humano
// Note: HumanCapitalDashboard is in src/modules/human-capital because index.tsx is in root
import HumanCapitalDashboard from './src/modules/human-capital/HumanCapitalDashboard';
import ConstructionDashboard from './src/modules/construction/ConstructionDashboard';
import ProfileManager from './src/modules/iam/components/ProfileManager';

// Centro de Inteligência
import { CentroInteligenciaView } from './src/pages/CentroInteligencia/CentroInteligenciaView';
import { PowerBiView } from './src/pages/CentroInteligencia/PowerBiView';
import { MarketIndicatorsView } from './src/pages/Indicadores/MarketIndicatorsView';
import RdoApp from './src/modules/rdo/RdoApp';
import { CargasFinanceirasPage } from './src/modules/financeiro/pages/CargasFinanceirasPage';
import SSMAApp from './src/modules/ssma/SSMAApp';

import { useNavigate } from 'react-router-dom';

const AccountLayout = () => {
  const navigate = useNavigate();
  return (
    <div className="h-screen w-full bg-gray-50 overflow-y-auto flex flex-col">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center shrink-0">
        <button onClick={() => navigate(-1)} className="flex items-center text-slate-500 hover:text-blue-600 transition-colors font-medium">
          ← Voltar
        </button>
      </div>
      <div className="flex-1">
        <AccountSettings />
      </div>
    </div>
  );
};

const App = () => {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative bg-gray-50/30 transition-all duration-300">
        <div className="flex-1 overflow-y-auto scroll-smooth">
          <Routes>
            <Route index element={<CommercialView />} />
            <Route path="prospecting" element={<ProspectingView />} />
            <Route path="crm/clients" element={<ClientsView />} />
            <Route path="crm/clients/:id" element={<ClientDetailsView />} />
            <Route path="contracts" element={<ContractsView />} />
            <Route path="contracts/dashboard" element={<ContractDashboardView />} />
            <Route path="production" element={<ConstructionSiteView />} />
            <Route path="actions" element={<ActionsView />} />
            <Route path="*" element={<Navigate to="/commercial" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <AuthProvider>
      <ContractsProvider>
        <CrmProvider>
          <BrowserRouter>
            <Toaster position="top-right" richColors />
            <AppVersionBadge />
            <Routes>
              {/* Rota Pública */}
              <Route path="/login" element={<LoginPage />} />

              {/* MÓDULO CAPITAL HUMANO (Layout Independente) */}
              <Route
                path="/human-capital/*"
                element={
                  <PrivateRoute requiredModule="human_capital">
                    <HumanCapitalDashboard />
                  </PrivateRoute>
                }
              />

              {/* PAINEL VLI — em espera desde 24/11/2026: fora dos atalhos, acessível só pelo endereço */}
              <Route
                path="/construction/*"
                element={
                  <PrivateRoute requiredModule="construction_vli">
                    <ConstructionDashboard />
                  </PrivateRoute>
                }
              />

              {/* Antiga escolha entre painel VLI e RDO: Obras agora abre direto o RDO Online */}
              <Route path="/construction-selection" element={<Navigate to="/rdo" replace />} />

              {/* MÓDULO RDO ONLINE */}
              <Route
                path="/rdo/*"
                element={
                  <PrivateRoute requiredModule="construction_rdo">
                    <RdoApp />
                  </PrivateRoute>
                }
              />

              {/* MÓDULO SSMA */}
              <Route
                path="/ssma/*"
                element={
                  <PrivateRoute requiredModule="ssma">
                    <SSMAApp />
                  </PrivateRoute>
                }
              />

              {/* CENTRO DE INTELIGÊNCIA (Nova Home) */}
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <CentroInteligenciaView />
                  </PrivateRoute>
                }
              />

              {/* INDICADORES DE MERCADO (todos os usuários logados) */}
              <Route
                path="/indicadores"
                element={
                  <PrivateRoute>
                    <MarketIndicatorsView />
                  </PrivateRoute>
                }
              />

              {/* VISUALIZADOR DE RELATÓRIOS (PowerBI) */}
              <Route
                path="/powerbi-viewer"
                element={
                  <PrivateRoute>
                    <PowerBiView />
                  </PrivateRoute>
                }
              />

              {/* LAKEHOUSE FINANCEIRO: cargas (razão Protheus...) — só super admin */}
              <Route
                path="/financeiro/cargas"
                element={
                  <PrivateRoute>
                    <CargasFinanceirasPage />
                  </PrivateRoute>
                }
              />

              {/* GESTÃO GLOBAL DE USUÁRIOS (IAM) */}
              <Route
                path="/admin/users"
                element={
                  <PrivateRoute>
                    <div className="p-4 lg:p-8 h-screen overflow-y-auto bg-gray-50"><ProfileManager /></div>
                  </PrivateRoute>
                }
              />

              {/* CONFIGURAÇÕES DE CONTA (Global) */}
              <Route
                path="/config/account"
                element={
                  <PrivateRoute>
                    <AccountLayout />
                  </PrivateRoute>
                }
              />

              {/* MÓDULO COMERCIAL (Layout Padrão com Sidebar) */}
              <Route path="/comercial/*" element={<Navigate to="/commercial" replace />} />
              <Route
                path="/commercial/*"
                element={
                  <PrivateRoute requiredModule="commercial">
                    <App />
                  </PrivateRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </CrmProvider>
      </ContractsProvider>
    </AuthProvider>
  </React.StrictMode>
);