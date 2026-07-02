import React from 'react';
import { Users, Truck, Clock, CloudRain, AlertTriangle } from 'lucide-react';
import { RDOData } from '../types';

interface Props {
  data: RDOData;
}

export const InfoCards: React.FC<Props> = ({ data }) => {
  const totalWorkers = data.workforce.reduce((acc, curr) => acc + curr.count, 0);
  const totalManHours = data.workforce.reduce((acc, curr) => acc + curr.totalHours, 0);
  const totalOccurrences = data.occurrences.length;
  const totalLostTime = data.occurrences.reduce((acc, curr) => acc + curr.impactTimeMinutes, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      
      {/* Workforce Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Mão de Obra Total</p>
          <h4 className="text-2xl font-bold text-gray-800 mt-1">{totalWorkers}</h4>
          <p className="text-xs text-gray-400 mt-1">{totalManHours.toFixed(1)} Horas Homem</p>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg">
          <Users className="w-6 h-6 text-blue-600" />
        </div>
      </div>

      {/* Weather Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Condição Climática</p>
          <h4 className="text-xl font-bold text-gray-800 mt-1 truncate">{data.weatherMorning}</h4>
          <p className="text-xs text-gray-400 mt-1">Pluviometria: {data.rainIndexMm}mm</p>
        </div>
        <div className="p-3 bg-sky-50 rounded-lg">
          <CloudRain className="w-6 h-6 text-sky-500" />
        </div>
      </div>

      {/* Occurrences Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Ocorrências</p>
          <h4 className="text-2xl font-bold text-gray-800 mt-1">{totalOccurrences}</h4>
          <p className="text-xs text-red-400 mt-1">Impacto: {totalLostTime} min</p>
        </div>
        <div className={`p-3 rounded-lg ${totalOccurrences > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
          <AlertTriangle className={`w-6 h-6 ${totalOccurrences > 0 ? 'text-red-500' : 'text-green-500'}`} />
        </div>
      </div>

      {/* Contract Info */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Contrato / RDO</p>
          <h4 className="text-xl font-bold text-gray-800 mt-1">#{data.reportNumber}</h4>
          <p className="text-xs text-gray-400 mt-1">{data.contractNumber}</p>
        </div>
        <div className="p-3 bg-indigo-50 rounded-lg">
          <Clock className="w-6 h-6 text-indigo-500" />
        </div>
      </div>
    </div>
  );
};