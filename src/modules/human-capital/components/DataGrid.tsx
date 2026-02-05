
import React, { useState, useEffect } from 'react';
import { OvertimeRecord } from '../types';
import { ChevronLeft, ChevronRight, ChevronFirst, ChevronLast } from 'lucide-react';
import { formatDecimalHours } from '../utils/formatters';

interface DataGridProps {
    data: OvertimeRecord[];
}

const DataGrid: React.FC<DataGridProps> = ({ data }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Reset pagination when data changes
    useEffect(() => {
        setCurrentPage(1);
    }, [data.length]);

    const totalPages = Math.ceil(data.length / itemsPerPage);
    const paginatedData = data.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    if (data.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 flex flex-col items-center justify-center text-center text-gray-400">
                <p className="font-medium">Nenhum registro encontrado.</p>
                <p className="text-sm mt-1">Tente ajustar seus filtros de busca.</p>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4">Chapa</th>
                            <th className="px-6 py-4">Nome</th>
                            <th className="px-6 py-4">Função</th>
                            <th className="px-6 py-4">CC</th>
                            <th className="px-6 py-4">Evento</th>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4 text-right">Horas</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {paginatedData.map((record, index) => (
                            <tr key={index} className="hover:bg-blue-50/50 transition-colors group">
                                <td className="px-6 py-3 font-mono text-xs text-gray-400 group-hover:text-blue-600">{record.CHAPA}</td>
                                <td className="px-6 py-3 font-medium text-gray-900">{record.NOME}</td>
                                <td className="px-6 py-3 text-xs">{record.FUNCAO}</td>
                                <td className="px-6 py-3 text-xs font-mono text-gray-500">{record.CODCCUSTO}</td>
                                <td className="px-6 py-3">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-tight
                    ${record.EVENTO.includes('EXTRA') ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}
                  `}>
                                        {record.EVENTO}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-xs text-gray-500">
                                    {new Date(record.DATA).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="px-6 py-3 text-right font-mono font-bold text-gray-800">
                                    {formatDecimalHours(record.HORAS)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, data.length)} de {data.length}
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-2 hover:bg-white rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                    >
                        <ChevronFirst size={16} />
                    </button>
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 hover:bg-white rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <div className="bg-white border border-gray-200 px-4 py-1 rounded-lg text-xs font-bold flex items-center shadow-sm">
                        {currentPage} <span className="text-gray-400 mx-1">/</span> {totalPages}
                    </div>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 hover:bg-white rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                    >
                        <ChevronRight size={16} />
                    </button>
                    <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="p-2 hover:bg-white rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                    >
                        <ChevronLast size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataGrid;
