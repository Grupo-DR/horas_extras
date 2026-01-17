import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

import { MainLayout } from './layout/MainLayout';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
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
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* PUBLIC */}
            <Route path="/login" element={<LoginPage />} />

            {/* PRIVATE */}
            <Route element={<PrivateRoute />}>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Navigate to="/comercial" replace />} />
                <Route path="comercial" element={<CommercialView />} />
                <Route path="contratos" element={<ContractsView />} />
                <Route path="dados" element={<DataCenterView />} />
                <Route path="kpis" element={<KPIView />} />
                <Route path="acoes" element={<ActionsView />} />

                {/* CRM Module */}
                <Route path="crm" element={<Navigate to="/crm/dashboard" replace />} />
                <Route path="crm/dashboard" element={<RelationshipDashboard />} />
                <Route path="crm/clients" element={<ClientsView />} />
                <Route path="crm/clients/:id" element={<ClientDetailsView />} />
                <Route path="crm/contacts" element={<ContactsView />} />
                <Route path="crm/contacts/:id" element={<ContactDetailsView />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);