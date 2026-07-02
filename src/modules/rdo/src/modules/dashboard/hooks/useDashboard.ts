import { useMemo } from 'react';
import { useProjectStore } from '../../../stores/projectStore';
import { useTeamStore } from '../../../stores/teamStore';
import { useRdoStore } from '../../../stores/rdoStore';
import { usePlanningStore } from '../../../stores/planningStore';
import { useUiStore, useUiFilters, useUiActions } from '../../../stores/uiStore';
import { parseDate, calculateRDOTotal } from '../../../../utils';

export const useDashboard = () => {
  const projects = useProjectStore((state) => state.projects);
  const teams = useTeamStore((state) => state.teams);
  const rdos = useRdoStore((state) => state.rdos);
  const latestRdoInStore = useRdoStore((state) => state.currentRDO);
  const dailyPlans = usePlanningStore((state) => state.dailyPlans);
  const contractDataMap = usePlanningStore((state) => state.contractDataMap);

  const {
    filterMes,
    filterStartDate,
    filterEndDate,
    filterRegional,
    filterProject,
    filterTeam
  } = useUiFilters();

  const {
    setFilterMes,
    setFilterStartDate,
    setFilterEndDate,
    setFilterRegional,
    setFilterProject,
    setFilterTeam,
    clearFilters
  } = useUiActions();

  const filteredRdos = useMemo(() => {
    let result = rdos;

    if (filterMes !== 'all') {
      result = result.filter(r => {
        const team = teams.find(t => t.id === r.teamId);
        if (!team) return false;
        const cData = contractDataMap[team.projectId];
        if (!cData || !cData.monthlyEntries) return false;

        const entry = cData.monthlyEntries.find(e => e.name === filterMes);
        if (!entry) return false;

        const rDate = parseDate(r.date);
        const start = new Date(entry.startDate + 'T00:00:00');
        const end = new Date(entry.endDate + 'T23:59:59');
        return rDate >= start && rDate <= end;
      });
    }

    if (filterStartDate) {
      result = result.filter(r => {
        const rDate = parseDate(r.date);
        const start = new Date(filterStartDate + 'T00:00:00');
        return rDate >= start;
      });
    }
    if (filterEndDate) {
      result = result.filter(r => {
        const rDate = parseDate(r.date);
        const end = new Date(filterEndDate + 'T23:59:59');
        return rDate <= end;
      });
    }

    if (filterRegional !== 'all' || filterProject !== 'all' || filterTeam !== 'all') {
      result = result.filter(r => {
        const team = teams.find(t => t.id === r.teamId);
        if (!team) return false;
        const project = projects.find(p => p.id === team.projectId);
        if (!project) return false;

        const matchesRegional = filterRegional === 'all' || project.regional === filterRegional;
        const matchesProject = filterProject === 'all' || project.id === filterProject;
        const matchesTeam = filterTeam === 'all' || r.teamId === filterTeam;

        return matchesRegional && matchesProject && matchesTeam;
      });
    }

    return result;
  }, [rdos, filterMes, filterStartDate, filterEndDate, filterRegional, filterProject, filterTeam, teams, projects, contractDataMap]);

  const latestRdo = useMemo(() => {
    return [...filteredRdos].sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())[0];
  }, [filteredRdos]);

  const revenueMetrics = useMemo(() => {
    let totalRevenueRealized = 0;
    let avgDailyRevenue = 0;
    let trendValue = 0;
    let totalForecast = 0;
    let periodLabel = 'Todo o Período';

    if (latestRdo) {
      totalRevenueRealized = filteredRdos.reduce((acc, r) => {
        const team = teams.find(t => t.id === r.teamId);
        const project = team ? projects.find(p => p.id === team.projectId) : undefined;
        return acc + calculateRDOTotal(r, project);
      }, 0);

      const latestDate = parseDate(latestRdo.date);
      let daysPassed = 0;
      let daysRemaining = 0;

      if (filterStartDate && filterEndDate) {
        periodLabel = `Período Filtrado`;
        const start = new Date(filterStartDate);
        const end = new Date(filterEndDate);
        const totalDaysInRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const timeDiff = latestDate.getTime() - start.getTime();
        daysPassed = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1);
        daysRemaining = Math.max(0, totalDaysInRange - daysPassed);
      } else if (filterMes !== 'all') {
        periodLabel = filterMes;
        const currentMonth = latestDate.getMonth();
        const currentYear = latestDate.getFullYear();
        daysPassed = latestDate.getDate();
        const lastDayOfObj = new Date(currentYear, currentMonth + 1, 0);
        daysRemaining = lastDayOfObj.getDate() - daysPassed;
      } else {
        periodLabel = 'Todo o Período';
        // When no filter is applied, do not restrict totalRevenueRealized to a single month
        // totalRevenueRealized is already the sum of all filteredRdos (calculated on line 101)
        
        // Calculate daysPassed as the difference between the earliest RDO and the latest RDO
        if (filteredRdos.length > 0) {
           const sortedRdos = [...filteredRdos].sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
           const earliestDate = parseDate(sortedRdos[0].date);
           daysPassed = Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 3600 * 24)) + 1;
        } else {
           daysPassed = 1;
        }
      }

      avgDailyRevenue = daysPassed > 0 ? totalRevenueRealized / daysPassed : 0;
      trendValue = avgDailyRevenue * daysRemaining;
      totalForecast = totalRevenueRealized + trendValue;
    }

    return {
      totalRevenueRealized,
      avgDailyRevenue,
      trendValue,
      totalForecast,
      periodLabel
    };
  }, [filteredRdos, latestRdo, filterStartDate, filterEndDate, teams, projects]);

  const chartData = useMemo(() => {
    return Object.entries(filteredRdos.reduce((acc, rdo) => {
      const team = teams.find(t => t.id === rdo.teamId);
      const project = team ? projects.find(p => p.id === team.projectId) : undefined;
      const val = calculateRDOTotal(rdo, project);
      acc[rdo.date] = (acc[rdo.date] || 0) + val;
      return acc;
    }, {} as Record<string, number>)).map(([date, val]) => ({
      date, faturamento: val
    })).sort((a, b) => {
      const [da, ma, ya] = a.date.split('/').map(Number);
      const [db, mb, yb] = b.date.split('/').map(Number);
      return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });
  }, [filteredRdos, teams, projects]);

  const filterOptions = useMemo(() => {
    const availableRegionals = Array.from(new Set(projects.map(p => p.regional || 'Sem Regional').filter(Boolean)));
    const availableProjects = projects.filter(p => filterRegional === 'all' || (p.regional || 'Sem Regional') === filterRegional);
    const filteredProjectsToPass = availableProjects.filter(p => filterProject === 'all' || p.id === filterProject);

    const nameStartDates = new Map<string, string>();
    Object.values(contractDataMap).forEach(cd => {
      cd.monthlyEntries?.forEach(entry => {
        if (!nameStartDates.has(entry.name) || entry.startDate < nameStartDates.get(entry.name)!) {
          nameStartDates.set(entry.name, entry.startDate);
        }
      });
    });
    const availableMeses = Array.from(nameStartDates.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(e => e[0]);

    return {
      availableRegionals,
      availableProjects,
      filteredProjectsToPass,
      availableMeses
    };
  }, [projects, filterRegional, filterProject, contractDataMap]);

  return {
    filterMes,
    setFilterMes,
    filterStartDate,
    setFilterStartDate,
    filterEndDate,
    setFilterEndDate,
    filterRegional,
    setFilterRegional,
    filterProject,
    setFilterProject,
    filterTeam,
    setFilterTeam,
    teams,
    dailyPlans,
    contractDataMap,
    handleClearFilters: clearFilters,

    filteredRdos,
    latestRdo,
    chartData,
    ...revenueMetrics,
    ...filterOptions
  };
};
