import React, { useState, useEffect } from 'react';
import { OvertimeRecord } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDecimalHours } from '../utils/formatters';

interface DataGridProps {
  data: OvertimeRecord[];
}

const DataGrid: React.FC<DataGridProps> = ({ data }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset pagination when data changes (e.g., filters applied)
  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const paginatedData = data.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-800">Registros Detalhados</h3>
        <span className="text-sm text-gray-500">
           {data.length} registros encontrados
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-100 text-gray-800 font-semibold uppercase text-xs">
            <tr>
              <th className="px-6 py-3 whitespace-nowrap">Chapa</th>
              <th className="px-6 py-3 whitespace-nowrap">Colaborador</th>
              <th className="px-6 py-3 whitespace-nowrap">Função</th>
              <th className="px-6 py-3 whitespace-nowrap">Data</th>
              <th className="px-6 py-3 whitespace-nowrap">CC / Seção</th>
              <th className="px-6 py-3 whitespace-nowrap">Tipo</th>
              <th className="px-6 py-3 text-right whitespace-nowrap">Horas (HH:MM)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.length > 0 ? (
              paginatedData.map((record, index) => (
                <tr key={`${record.CHAPA}-${record.EVENTO}-${index}`} className="hover:bg-blue-50 transition-colors">
                  <td className="px-6 py-3 font-mono text-xs text-gray-500">{record.CHAPA}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">{record.NOME}</td>
                  <td className="px-6 py-3 text-xs text-gray-500 max-w-[150px] truncate" title={record.FUNCAO}>{record.FUNCAO}</td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    {record.DATA ? new Date(record.DATA).toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td className="px-6 py-3 max-w-[200px] text-xs">
                     <div className="font-medium text-gray-700 truncate" title={record.CODCCUSTO}>{record.CODCCUSTO}</div>
                     <div className="text-gray-400 truncate" title={record.SECAO}>{record.SECAO}</div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                      record.EVENTO.toUpperCase().includes('EXTRA') ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {record.EVENTO}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right font-bold text-gray-900 font-mono">
                    {formatDecimalHours(record.HORAS)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                  Nenhum registro encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
        <span className="text-xs text-gray-500">
          Mostrando {data.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} até {Math.min(currentPage * itemsPerPage, data.length)} de {data.length} registros
        </span>
        <div className="flex space-x-2">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(c => c - 1)}
            className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(c => c + 1)}
            className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataGrid;