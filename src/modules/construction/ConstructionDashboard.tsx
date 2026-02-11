import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { ConstructionRecord, ViewType, ServicePrice, PlanningAssignment } from './types';
import Layout from './components/Layout';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import DataTable from './components/DataTable';
import PriceList from './components/PriceList';
import Planning from './components/Planning';
import { UploadHistory } from './components/UploadHistory';
import { DEFAULT_SERVICE_PRICES } from './utils/constants';
import { constructionService } from './services/firestore';
import { Loader2 } from 'lucide-react';
import ProfileManager from '../iam/components/ProfileManager';

const App: React.FC = () => {
  const STORAGE_KEYS = {
    PRICES: 'rdo_analytics_prices_v2',
  };

  const [data, setData] = useState<ConstructionRecord[]>([]);
  const [cycles, setCycles] = useState<string[]>([]);
  const [currentCycle, setCurrentCycle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const [servicePrices, setServicePrices] = useState<ServicePrice[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRICES);
    return saved ? JSON.parse(saved) : DEFAULT_SERVICE_PRICES;
  });

  const [assignments, setAssignments] = useState<PlanningAssignment[]>([]);

  const [view, setView] = useState<ViewType>('upload'); // Start at upload or dashboard?

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRICES, JSON.stringify(servicePrices));
  }, [servicePrices]);

  // Initial Fetch: Cycles
  const fetchCycles = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedCycles = await constructionService.getCycles();
      const sortedCycles = fetchedCycles.sort(); // YYYY-MM format sorts naturally
      setCycles(sortedCycles);
      if (sortedCycles.length > 0 && !currentCycle) {
        // getCycles returns desc order, so first item is latest
        const latest = sortedCycles[0];
        setCurrentCycle(latest);
      }
    } catch (e) {
      console.error("Failed to fetch cycles", e);
    } finally {
      setIsLoading(false);
    }
  }, [currentCycle]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  // Fetch Data when Cycle Changes
  const fetchDataForCycle = useCallback(async (cycle: string) => {
    if (!cycle) return;
    try {
      setIsLoading(true);
      const workId = 'OBRA-01'; // Default Context
      const [records, planData] = await Promise.all([
        constructionService.getRecords(cycle, workId),
        constructionService.getPlanning(cycle, workId)
      ]);

      // No mapping needed if we store as ConstructionRecord
      // But we might need to cast or validate
      setData(records);

      // Map Planning
      // planData is now PlanningAssignment[] thanks to our service update
      setAssignments(planData);

    } catch (e) {
      console.error("Failed to fetch data", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentCycle) {
      fetchDataForCycle(currentCycle);
      if (view === 'upload') setView('dashboard');
    }
  }, [currentCycle]); // Removed 'view' dependency to avoid loops

  // Handle successful import - refresh cycles and select latest
  const handleImportSuccess = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedCycles = await constructionService.getCycles();
      const sortedCycles = fetchedCycles.sort();
      setCycles(sortedCycles);

      // Select latest cycle (first in desc order)
      if (sortedCycles.length > 0) {
        const latest = sortedCycles[0];
        setCurrentCycle(latest);
        // Fetch data for the latest cycle
        await fetchDataForCycle(latest);
      }

      // Switch to dashboard view
      setView('dashboard');
    } catch (e) {
      console.error("Failed to refresh after import", e);
    } finally {
      setIsLoading(false);
    }
  }, [fetchDataForCycle]);





  return (
    <Layout
      activeView={view} setView={setView} hasData={data.length > 0}
      onExportBackup={() => { }} onClearData={() => setData([])}
    >
      {isLoading && (
        <div className="fixed inset-0 z-[100] bg-white/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <p className="font-bold text-xs uppercase tracking-widest">Sincronizando Nuvem({currentCycle})...</p>
          </div>
        </div>
      )}

      {view === 'upload' && <FileUpload onImportSuccess={handleImportSuccess} />}
      {view === 'services' && <PriceList prices={servicePrices} />}

      {/* Dashboard needs to filter valid data. It handles 'selectedCycle' internally but receives 'data'.
          Since we fetch data FOR a cycle, we pass that data. 
          Dashboard's internal cycle selector might be confused if we only pass 1 cycle of data.
          We might need to modify Dashboard to handle the external 'currentCycle' or just let it be.
      */}
      {view === 'dashboard' && (
        <Dashboard
          data={data}
          servicePrices={servicePrices}
          assignments={assignments}
          availableCycles={cycles}
          selectedCycle={currentCycle}
          onCycleChange={(cycle) => setCurrentCycle(cycle)}
        />
      )}

      {view === 'planning' && (
        <Planning
          data={data} assignments={assignments} servicePrices={servicePrices}
          onAddAssignment={async (a) => {
            try {
              const next = [...assignments, a];
              setAssignments(next);
              await constructionService.updatePlanning(currentCycle, next, 'OBRA-01');
            } catch (error) {
              console.error('Erro ao adicionar planejamento:', error);
              alert('Erro ao salvar planejamento. Tente novamente.');
            }
          }}
          onRemoveAssignment={async (id) => {
            try {
              const next = assignments.filter(x => x.id !== id);
              setAssignments(next);
              await constructionService.updatePlanning(currentCycle, next, 'OBRA-01');
            } catch (error) {
              console.error('Erro ao remover planejamento:', error);
              alert('Erro ao remover planejamento. Tente novamente.');
            }
          }}
          onUpdateAssignment={async (u) => {
            try {
              const next = assignments.map(x => x.id === u.id ? u : x);
              setAssignments(next);
              await constructionService.updatePlanning(currentCycle, next, 'OBRA-01');
            } catch (error) {
              console.error('Erro ao atualizar planejamento:', error);
              alert('Erro ao atualizar planejamento. Tente novamente.');
            }
          }}
        />
      )}
      {view === 'table' && <DataTable data={data} servicePrices={servicePrices} />}
      {view === 'history' && <UploadHistory workId="OBRA-01" />}
      {view === 'iam' && <ProfileManager />}
    </Layout>
  );
};

export default App;
