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
import { TeamSettings } from './pages/config/TeamSettings';
import { AccountSettings } from './pages/config/AccountSettings';

// Módulo Capital Humano
// Note: HumanCapitalDashboard is in src/modules/human-capital because index.tsx is in root
import HumanCapitalDashboard from './src/modules/human-capital/HumanCapitalDashboard';
import ConstructionDashboard from './src/modules/construction/ConstructionDashboard';
import ProfileManager from './src/modules/iam/components/ProfileManager';

const App = () => {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative bg-gray-50/30 transition-all duration-300">
        <div className="flex-1 overflow-y-auto pt-2 pb-4 px-4 lg:pt-3 lg:pb-8 lg:px-8 scroll-smooth">
          <Routes>
            <Route path="/" element={<CommercialView />} />
            <Route path="/prospecting" element={<ProspectingView />} />
            <Route path="/crm/clients" element={<ClientsView />} />
            <Route path="/crm/clients/:id" element={<ClientDetailsView />} />
            <Route path="/contracts" element={<ContractsView />} />
            <Route path="/contracts/dashboard" element={<ContractDashboardView />} />
            <Route path="/production" element={<ConstructionSiteView />} />
            <Route path="/actions" element={<ActionsView />} />
            <Route path="/config/team" element={<TeamSettings />} />
            <Route path="/config/account" element={<AccountSettings />} />
            <Route path="/users" element={<ProfileManager />} />
            <Route path="*" element={<Navigate to="/" replace />} />
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
            <Routes>
              {/* Rota Pública */}
              <Route path="/login" element={<LoginPage />} />

              {/* MÓDULO CAPITAL HUMANO (Layout Independente) */}
              <Route
                path="/human-capital/*"
                element={
                  <PrivateRoute>
                    <HumanCapitalDashboard />
                  </PrivateRoute>
                }
              />

              {/* MÓDULO OBRA (Layout Independente) */}
              <Route
                path="/construction/*"
                element={
                  <PrivateRoute>
                    <ConstructionDashboard />
                  </PrivateRoute>
                }
              />

              {/* MÓDULO COMERCIAL (Layout Padrão com Sidebar) */}
              <Route
                path="/*"
                element={
                  <PrivateRoute>
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