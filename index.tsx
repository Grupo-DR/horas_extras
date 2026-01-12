import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

import { MainLayout } from './layout/MainLayout';

// Lazy Load Pages
const CommercialView = React.lazy(() => import('./pages/CommercialView').then(module => ({ default: module.CommercialView })));
const ContractsView = React.lazy(() => import('./pages/ContractsView').then(module => ({ default: module.ContractsView })));
const DataCenterView = React.lazy(() => import('./pages/DataCenterView').then(module => ({ default: module.DataCenterView })));
const KPIView = React.lazy(() => import('./pages/KPIView').then(module => ({ default: module.KPIView })));
const ActionsView = React.lazy(() => import('./pages/ActionsView').then(module => ({ default: module.ActionsView })));

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
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/comercial" replace />} />
            <Route path="comercial" element={<CommercialView />} />
            <Route path="contratos" element={<ContractsView />} />
            <Route path="dados" element={<DataCenterView />} />
            <Route path="kpis" element={<KPIView />} />
            <Route path="acoes" element={<ActionsView />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);