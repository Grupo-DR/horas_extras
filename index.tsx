import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

import { MainLayout } from './layout/MainLayout';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { CrmProvider } from './contexts/CrmContext';
import { PrivateRoute } from './components/PrivateRoute';
import { RequireAdmin } from './components/RequireAdmin';
import RequireModuleAccess from './components/auth/RequireModuleAccess';
import { LoginPage } from './pages/LoginPage';

// Lazy Load Pages
const CommercialView = React.lazy(() => import('./pages/CommercialView').then(module => ({ default: module.CommercialView })));
const ContractsView = React.lazy(() => import('./pages/ContractsView').then(module => ({ default: module.ContractsView })));
const DataCenterView = React.lazy(() => import('./pages/DataCenterView').then(module => ({ default: module.DataCenterView })));
const KPIView = React.lazy(() => import('./pages/KPIView').then(module => ({ default: module.KPIView })));
const ActionsView = React.lazy(() => import('./pages/ActionsView').then(module => ({ default: module.ActionsView })));

// CRM Pages
const RelationshipDashboard = React.lazy(() => import('./pages/crm/RelationshipDashboard').then(module => ({ default: module.RelationshipDashboard })));
const ClientsView = React.lazy(() => import('./pages/crm/ClientsView').then(module => ({ default: module.ClientsView })));
const ClientDetailsView = React.lazy(() => import('./pages/crm/ClientDetailsView').then(module => ({ default: module.ClientDetailsView })));
const ContactsView = React.lazy(() => import('./pages/crm/ContactsView').then(module => ({ default: module.ContactsView })));
const ContactDetailsView = React.lazy(() => import('./pages/crm/ContactDetailsView').then(module => ({ default: module.ContactDetailsView })));

// Config Pages
const TeamSettings = React.lazy(() => import('./pages/config/TeamSettings').then(module => ({ default: module.TeamSettings })));
const AccountSettings = React.lazy(() => import('./pages/config/AccountSettings').then(module => ({ default: module.AccountSettings })));

const LoadingFallback = () => (
  <div className="flex h-screen w-full items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-2">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      <span className="text-sm font-medium text-slate-600">Carregando módulo...</span>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <AuthProvider>
        <CrmProvider>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* PUBLIC */}
              <Route path="/login" element={<LoginPage />} />

              {/* PRIVATE */}
              <Route element={<PrivateRoute />}>
                <Route path="/" element={<MainLayout />}>
                  import RequireModuleAccess from './components/auth/RequireModuleAccess'; // Import

                  // ... inside Routes ...

                  <Route index element={<Navigate to="/comercial" replace />} />

                  <Route element={<RequireModuleAccess module="commercial_dashboard" />}>
                    <Route path="comercial" element={<CommercialView />} />
                  </Route>

                  <Route element={<RequireModuleAccess module="financial" />}>
                    <Route path="contratos" element={<ContractsView />} />
                  </Route>

                  <Route element={<RequireModuleAccess module="strategic_planning" />}>
                    <Route path="dados" element={<DataCenterView />} />
                    <Route path="kpis" element={<KPIView />} />
                  </Route>

                  <Route element={<RequireModuleAccess module="operational_planning" />}>
                    <Route path="acoes" element={<ActionsView />} />
                  </Route>

                  {/* CRM Module */}
                  <Route element={<RequireModuleAccess module="crm" />}>
                    <Route path="crm" element={<Navigate to="/crm/dashboard" replace />} />
                    <Route path="crm/dashboard" element={<RelationshipDashboard />} />
                    <Route path="crm/clients" element={<ClientsView />} />
                    <Route path="crm/clients/:id" element={<ClientDetailsView />} />
                    <Route path="crm/contacts" element={<ContactsView />} />
                    <Route path="crm/contacts/:id" element={<ContactDetailsView />} />
                  </Route>

                  {/* Account Settings */}
                  <Route path="config/conta" element={<AccountSettings />} />

                  {/* Config Module (Admin Only - kept as RequireAdmin for extra safety or use users module) */}
                  <Route
                    path="config/equipe"
                    element={
                      <RequireAdmin>
                        <TeamSettings />
                      </RequireAdmin>
                    }
                  />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </CrmProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);