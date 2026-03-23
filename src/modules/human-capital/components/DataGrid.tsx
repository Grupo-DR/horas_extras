
import React, { useState, useEffect, useMemo } from 'react';
import { OvertimeRecord } from '../types';
import { ChevronLeft, ChevronRight, ChevronFirst, ChevronLast, Search, Filter, ToggleLeft, ToggleRight, Eye } from 'lucide-react';
import { formatDecimalHours } from '../utils/formatters';

interface DataGridProps {
    /** Base ajustada (rateada pelo headcount) — exibida por padrão */
    data: OvertimeRecord[];
    /**
     * Base bruta original (TOTVS sem rateio) — quando fornecida,
     * ativa o toggle de auditoria no cabeçalho da tabela.
     */
    rawData?: OvertimeRecord[];
}

const DataGrid: React.FC<DataGridProps> = ({ data, rawData }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [nameFilter, setNameFilter] = useState('');
    const [eventFilter, setEventFilter] = useState('');
    /** true = exibindo dado ajustado; false = exibindo dado bruto */
    const [showAdjusted, setShowAdjusted] = useState(true);
    const itemsPerPage = 10;

    const hasRawToggle = Boolean(rawData && rawData.length > 0 && rawData !== data);

    /** Conjunto ativo: ajustado ou bruto */
    const activeData = useMemo(() => {
        if (!hasRawToggle || showAdjusted) return data;
        return rawData!;
    }, [data, rawData, showAdjusted, hasRawToggle]);

    // Computed filtered data
    const filteredData = useMemo(() => {
        return activeData.filter(record => {
            const matchesName = record.NOME.toLowerCase().includes(nameFilter.toLowerCase()) ||
                record.CHAPA.includes(nameFilter);
            const matchesEvent = eventFilter === '' || record.EVENTO === eventFilter;
            return matchesName && matchesEvent;
        });
    }, [activeData, nameFilter, eventFilter]);

    // Unique event types for the dropdown
    const uniqueEvents = useMemo(() => {
        const events = new Set<string>();
        activeData.forEach(r => events.add(r.EVENTO));
        return Array.from(events).sort();
    }, [activeData]);

    // Reset pagination when data or filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filteredData.length]);

    // Reset to adjusted view when headcount is removed
    useEffect(() => {
        if (!hasRawToggle) setShowAdjusted(true);
    }, [hasRawToggle]);

    const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
    const paginatedData = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    if (data.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 flex flex-col items-center justify-center text-center text-gray-400">
                <p className="font-medium">Nenhum registro encontrado no período.</p>
                <p className="text-sm mt-1">Tente ajustar as datas do filtro principal.</p>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            {/* Filtros Internos do Grid */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center rounded-t-2xl">
                <div className="flex items-center gap-3 flex-1">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou chapa..."
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                        />
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <select
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white cursor-pointer"
                            value={eventFilter}
                            onChange={(e) => setEventFilter(e.target.value)}
                        >
                            <option value="">Todos os Eventos</option>
                            {uniqueEvents.map(evt => (
                                <option key={evt} value={evt}>{evt}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Toggle de auditoria — visível apenas quando headcount está ativo */}
                {hasRawToggle && (
                    <div className="flex items-center gap-2 shrink-0 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                        <Eye size={13} className="text-slate-400 shrink-0" />
                        <span className="text-xs font-medium text-slate-500">Base:</span>
                        <button
                            onClick={() => setShowAdjusted(a => !a)}
                            className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg transition-all ${
                                showAdjusted
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                            }`}
                            title={showAdjusted ? 'Mostrando base ajustada pelo headcount. Clique para ver o bruto.' : 'Mostrando base bruta da TOTVS. Clique para ver o ajustado.'}
                        >
                            {showAdjusted ? (
                                <><ToggleRight size={13} /> Ajustado</>
                            ) : (
                                <><ToggleLeft size={13} /> Bruto TOTVS</>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Banner de contexto quando em modo bruto */}
            {hasRawToggle && !showAdjusted && (
                <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-700 flex items-center gap-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <span><strong>Modo auditoria:</strong> exibindo dado bruto da TOTVS — horas podem estar duplicadas por CC. Alterne para "Ajustado" para ver a base correta.</span>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4">Chapa</th>
                            <th className="px-6 py-4">Nome</th>
                            <th className="px-6 py-4">Função</th>
                            <th className="px-6 py-4">
                                CC
                                {hasRawToggle && (
                                    <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold ${showAdjusted ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {showAdjusted ? 'HC' : 'TOTVS'}
                                    </span>
                                )}
                            </th>
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

            {filteredData.length === 0 ? (
                <div className="p-12 text-center text-gray-400 bg-white">
                    <p className="font-medium">Nenhum registro encontrado para estes filtros.</p>
                </div>
            ) : (
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-4 justify-between items-center rounded-b-2xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Mostrando {filteredData.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} - {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="p-2 bg-white hover:bg-gray-100 border border-gray-200 shadow-sm rounded-lg disabled:opacity-30 disabled:hover:bg-white transition-all"
                        >
                            <ChevronFirst size={16} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 bg-white hover:bg-gray-100 border border-gray-200 shadow-sm rounded-lg disabled:opacity-30 disabled:hover:bg-white transition-all"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <div className="bg-white border border-gray-200 px-4 py-1 rounded-lg text-xs font-bold flex items-center shadow-sm">
                            {currentPage} <span className="text-gray-400 mx-1">/</span> {totalPages}
                        </div>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 bg-white hover:bg-gray-100 border border-gray-200 shadow-sm rounded-lg disabled:opacity-30 disabled:hover:bg-white transition-all"
                        >
                            <ChevronRight size={16} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-2 bg-white hover:bg-gray-100 border border-gray-200 shadow-sm rounded-lg disabled:opacity-30 disabled:hover:bg-white transition-all"
                        >
                            <ChevronLast size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataGrid;
