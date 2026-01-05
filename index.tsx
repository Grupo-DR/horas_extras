import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

import { MainLayout } from './layout/MainLayout';
import { CommercialView } from './pages/CommercialView';
import { ContractsView } from './pages/ContractsView';
import { DataCenterView } from './pages/DataCenterView';
import { KPIView } from './pages/KPIView';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/comercial" replace />} />
          <Route path="comercial" element={<CommercialView />} />
          <Route path="contratos" element={<ContractsView />} />
          <Route path="dados" element={<DataCenterView />} />
          <Route path="kpis" element={<KPIView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);