import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar
} from 'recharts';
import { RDOData, WorkerGroup, Equipment, Activity } from '../types';

interface Props {
  data: RDOData;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const DashboardCharts: React.FC<Props> = ({ data }) => {
  
  // Prepare Workforce Data
  const workforceData = data.workforce.map((w: WorkerGroup) => ({
    name: w.role.length > 15 ? w.role.substring(0, 15) + '...' : w.role,
    hours: w.totalHours,
    count: w.count
  })).sort((a, b) => b.hours - a.hours);

  // Prepare Equipment Data
  const equipmentData = data.equipment.map((e: Equipment) => ({
    name: e.name.length > 15 ? e.name.substring(0, 15) + '...' : e.name,
    hours: e.hoursOperated
  }));

  // Prepare Activity Progress
  const activityData = data.activities.map((a: Activity) => ({
    name: a.description.length > 20 ? a.description.substring(0, 20) + '...' : a.description,
    progress: a.progress,
    fill: a.progress === 100 ? '#00C49F' : '#8884d8'
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      
      {/* Workforce Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Horas por Função (Mão de Obra)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={workforceData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
              <Tooltip formatter={(value) => [`${value}h`, 'Horas Trabalhadas']} />
              <Bar dataKey="hours" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Equipment Usage */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Uso de Equipamentos (Horas)</h3>
        {equipmentData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={equipmentData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}h`, 'Operação']} />
                <Bar dataKey="hours" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400">
            Nenhum equipamento registrado
          </div>
        )}
      </div>

      {/* Activity Progress */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Progresso das Atividades</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activityData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis dataKey="name" type="category" width={200} tick={{fontSize: 12}} />
              <Tooltip formatter={(value) => [`${value}%`, 'Concluído']} />
              <Bar dataKey="progress" radius={[0, 4, 4, 0]}>
                {activityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};