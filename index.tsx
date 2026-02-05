import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { ContractsProvider } from './contexts/ContractsContext';
import { CrmProvider } from './contexts/CrmContext';
import PrivateRoute from './components/PrivateRoute';
import Sidebar from './layout/Sidebar';
import { Toaster } from 'sonner';

// Páginas do Comercial
import CommercialView from './pages/CommercialView';
import ProspectingView from './pages/ProspectingView';
import ContractsView from './pages/ContractsView';
import ContractDashboardView from './pages/ContractDashboardView';
import ConstructionSiteView from './pages/ConstructionSiteView';
import ActionsView from './pages/ActionsView';
import LoginPage from './pages/LoginPage';
import ClientsView from './pages/crm/ClientsView';
import ClientDetailsView from './pages/crm/ClientDetailsView';
import TeamSettings from './pages/config/TeamSettings';
import AccountSettings from './pages/config/AccountSettings';

// Módulo Capital Humano
// Note: HumanCapitalDashboard is in src/modules/human-capital because index.tsx is in root
import HumanCapitalDashboard from './src/modules/human-capital/HumanCapitalDashboard';

const App = () => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64 p-8 overflow-y-auto">
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
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