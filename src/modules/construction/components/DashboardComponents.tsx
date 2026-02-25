import React from 'react';
import { formatCurrencyWithZero, getEquipmentCategory } from '../utils/calculations';
import { X, MapPin } from 'lucide-react';
import { EQUIPMENT_CATEGORIES, CITY_COORDINATES } from '../utils/constants';
import { motion, AnimatePresence } from 'framer-motion';

// Custom Tooltip para o gráfico de evolução diária
export const CustomDailyTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0].payload;
    const equipments = data.equipments || [];
    const totalReal = data.real || 0;
    const totalPlan = data.plan || 0;
    const difference = totalReal - totalPlan;

    return (
        <div className="bg-white p-4 rounded-xl shadow-2xl border-2 border-slate-200 min-w-[300px]">
            <p className="font-black text-sm text-slate-900 mb-3 border-b pb-2">{data.name}</p>

            <div className="space-y-2 mb-3">
                <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Planejado:</span>
                    <span className="text-sm font-bold text-slate-700">{formatCurrencyWithZero(totalPlan)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Realizado:</span>
                    <span className="text-sm font-bold text-indigo-600">{formatCurrencyWithZero(totalReal)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-xs font-bold text-slate-700">Diferença:</span>
                    <span className={`text-sm font-bold ${difference >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {difference >= 0 ? '+' : ''}{formatCurrencyWithZero(difference)}
                    </span>
                </div>
            </div>

            {equipments.length > 0 && (
                <div className="border-t pt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Equipamentos ({equipments.length})</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                        {equipments.map((eq: any, i: number) => (
                            <div key={i} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded">
                                <span className="font-bold text-slate-700">{eq.frota}</span>
                                <div className="flex gap-2">
                                    <span className="text-slate-500">{formatCurrencyWithZero(eq.value)}</span>
                                    {eq.planned > 0 && (
                                        <span className="text-slate-400">({formatCurrencyWithZero(eq.planned)})</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Modal para detalhes de categoria (Pareto)
interface CategoryDetailModalProps {
    category: any;
    onClose: () => void;
    type: 'revenue' | 'idle';
}

export const CategoryDetailModal: React.FC<CategoryDetailModalProps> = ({ category, onClose, type }) => {
    if (!category) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">{category.name || category.category}</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            {type === 'revenue' ? 'Faturamento por Equipamento' : 'Horas Improdutivas por Equipamento'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl mb-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Planejado</p>
                            <p className="text-lg font-black text-slate-700">{formatCurrencyWithZero(category.planned || 0)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{type === 'idle' ? 'Improdutivo' : 'Realizado'}</p>
                            <p className="text-lg font-black text-indigo-600">{formatCurrencyWithZero(category.actual || category.idle || 0)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Diferença</p>
                            <p className={`text-lg font-black ${((category.actual || category.idle || 0) - (category.planned || 0)) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {((category.actual || category.idle || 0) - (category.planned || 0)) >= 0 ? '+' : ''}{formatCurrencyWithZero((category.actual || category.idle || 0) - (category.planned || 0))}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-3">Equipamentos</p>
                    {category.equipmentDetails && category.equipmentDetails.length > 0 ? (
                        <div className="space-y-2">
                            {category.equipmentDetails.map((eq: any, i: number) => (
                                <div key={i} className="bg-white border border-slate-200 p-4 rounded-xl hover:shadow-md transition-shadow">
                                    {type === 'idle' ? (
                                        <>
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-slate-900">{eq.frota}</span>
                                                <span className="text-sm font-bold text-red-600">{formatCurrencyWithZero(eq.idle)}</span>
                                            </div>
                                            <div className="mt-2">
                                                <p className="text-[9px] text-slate-400 uppercase">Valor Improdutivo</p>
                                                <p className="text-sm font-bold text-red-600">{formatCurrencyWithZero(eq.idle)}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-slate-900">{eq.frota}</span>
                                                <span className={`text-sm font-bold ${eq.difference >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {eq.difference >= 0 ? '+' : ''}{formatCurrencyWithZero(eq.difference)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 mt-2">
                                                <div>
                                                    <p className="text-[9px] text-slate-400 uppercase">Planejado</p>
                                                    <p className="text-sm font-bold text-slate-600">{formatCurrencyWithZero(eq.planned)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] text-slate-400 uppercase">Realizado</p>
                                                    <p className="text-sm font-bold text-indigo-600">{formatCurrencyWithZero(eq.actual)}</p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 italic">Nenhum equipamento encontrado</p>
                    )}
                </div>
            </div>
        </div>
    );
};

// Modal para detalhes de um dia específico
interface DayDetailModalProps {
    day: any;
    onClose: () => void;
}

export const DayDetailModal: React.FC<DayDetailModalProps> = ({ day, onClose }) => {
    if (!day) return null;

    const records = day.records || [];
    const totalReal = day.real || 0;
    const totalPlan = day.plan || 0;
    const difference = totalReal - totalPlan;

    // Build a lookup map: frota -> planned value (from Dashboard.tsx pre-calculation)
    const plannedByFrota: Record<string, number> = {};
    (day.equipments || []).forEach((eq: any) => {
        plannedByFrota[eq.frota] = (plannedByFrota[eq.frota] || 0) + (eq.planned || 0);
    });

    // Group records by equipment category
    const recordsByCategory: Record<string, any[]> = {};
    const categorySummaries: Record<string, { total: number; planned: number; difference: number }> = {};

    records.forEach((record: any) => {
        const category = getEquipmentCategory(record.frota);
        if (!recordsByCategory[category]) {
            recordsByCategory[category] = [];
            categorySummaries[category] = { total: 0, planned: 0, difference: 0 };
        }
        recordsByCategory[category].push(record);
        categorySummaries[category].total += record.financials?.total || 0;
        categorySummaries[category].planned += plannedByFrota[record.frota] || 0;
        categorySummaries[category].difference = categorySummaries[category].total - categorySummaries[category].planned;
    });

    const sortedCategories = Object.keys(recordsByCategory).sort();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">{day.name}</h3>
                        <p className="text-sm text-slate-500 mt-1">Registros de RDO do Dia</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-slate-50 p-3 rounded-xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Planejado</p>
                        <p className="text-lg font-black text-slate-700">{formatCurrencyWithZero(totalPlan)}</p>
                    </div>
                    <div className="bg-indigo-50 p-3 rounded-xl">
                        <p className="text-[10px] font-bold text-indigo-400 uppercase">Realizado</p>
                        <p className="text-lg font-black text-indigo-600">{formatCurrencyWithZero(totalReal)}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${difference >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <p className="text-[10px] font-bold uppercase" style={{ color: difference >= 0 ? '#10b981' : '#ef4444' }}>Diferença</p>
                        <p className={`text-lg font-black ${difference >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {difference >= 0 ? '+' : ''}{formatCurrencyWithZero(difference)}
                        </p>
                    </div>
                </div>

                {/* RDO Records Table - Grouped by Category */}
                <div className="flex-1 overflow-auto">
                    {records.length > 0 ? (
                        <div className="space-y-6">
                            {sortedCategories.map((categoryKey) => {
                                const categoryRecords = recordsByCategory[categoryKey];
                                const categoryName = EQUIPMENT_CATEGORIES[categoryKey] || categoryKey;

                                return (
                                    <div key={categoryKey} className="border border-slate-200 rounded-xl overflow-hidden">
                                        {/* Category Header */}
                                        <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                                            <div className="flex justify-between items-center">
                                                <h4 className="text-xs font-black text-slate-700 uppercase">{categoryName}</h4>
                                                <span className="text-[10px] text-slate-500 font-bold">{categoryRecords.length} registro{categoryRecords.length !== 1 ? 's' : ''}</span>
                                            </div>
                                        </div>

                                        {/* Category Table */}
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-50">
                                                <tr className="border-b border-slate-200">
                                                    <th className="px-4 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider">Frota</th>
                                                    <th className="px-4 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider">Localização</th>
                                                    <th className="px-4 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider">Descrição do Serviço</th>
                                                    <th className="px-4 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider text-center">Unidade</th>
                                                    <th className="px-4 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider text-right">Produção</th>
                                                    <th className="px-4 py-2 text-[9px] font-bold text-amber-700 uppercase tracking-wider text-right bg-amber-50/50">Total</th>
                                                    <th className="px-4 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider text-right">Planejado</th>
                                                    <th className="px-4 py-2 text-[9px] font-bold text-slate-700 uppercase tracking-wider text-right">Diferença</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {categoryRecords.map((record: any, idx: number) => {
                                                    const plannedValue = plannedByFrota[record.frota] || 0;
                                                    const recordDifference = (record.financials?.total || 0) - plannedValue;

                                                    return (
                                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-2">
                                                                <span className="text-[10px] font-bold text-slate-900">{record.frota}</span>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-bold text-slate-700">{record.geo?.cidade || '-'}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-[8px] font-medium text-slate-400 uppercase">{record.geo?.trecho || ''}</span>
                                                                        {record.trechoFinal && record.geo?.trecho && <span className="text-[8px] text-slate-300">|</span>}
                                                                        <span className="text-[8px] text-slate-400 font-mono">{record.trechoFinal || ''}</span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <span className="text-[10px] text-slate-700 font-medium">{record.financials?.descricao || record.item}</span>
                                                            </td>
                                                            <td className="px-4 py-2 text-center">
                                                                <span className="text-[9px] font-bold text-slate-600 uppercase">{record.financials?.unidade || '-'}</span>
                                                            </td>
                                                            <td className="px-4 py-2 text-[10px] font-bold text-slate-900 text-right">
                                                                {record.producao?.toLocaleString() || '0'}
                                                            </td>
                                                            <td className="px-4 py-2 text-[10px] font-bold text-amber-600 text-right bg-amber-50/20">
                                                                {formatCurrencyWithZero(record.financials?.total || 0)}
                                                            </td>
                                                            <td className="px-4 py-2 text-[10px] font-bold text-slate-600 text-right">
                                                                {formatCurrencyWithZero(plannedValue)}
                                                            </td>
                                                            <td className="px-4 py-2 text-[10px] font-bold text-right">
                                                                <span className={recordDifference >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                                                    {recordDifference >= 0 ? '+' : ''}{formatCurrencyWithZero(recordDifference)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <p className="text-sm italic">Nenhum registro de RDO encontrado para este dia</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

// HeatmapChart: Visualização geográfica com pontos de calor
interface HeatmapChartProps {
    data: any[]; // Array of { city: string, hp: number, hi: number, km: number }
    metric: 'hp' | 'hi' | 'km';
}

export const HeatmapChart: React.FC<HeatmapChartProps> = ({ data, metric }) => {
    // 1. Filtrar cidades para projeção (ignorar outliers sem dados para focar no corredor)
    const citiesWithData = data.filter(d => d[metric] > 0).map(d => d.city);

    // Lista de cidades para focar a câmera (Corredor Principal MA/TO)
    // Se São Luís tiver dados, ele entra. Se não, mantemos o foco no corredor principal.
    const corridorCities = Object.keys(CITY_COORDINATES).filter(c =>
        (c !== "São Luís" && c !== "Araguaína") || citiesWithData.includes(c)
    );

    const coordsToBound = corridorCities.map(c => CITY_COORDINATES[c]);
    const minLat = Math.min(...coordsToBound.map(c => c.lat));
    const maxLat = Math.max(...coordsToBound.map(c => c.lat));
    const minLng = Math.min(...coordsToBound.map(c => c.lng));
    const maxLng = Math.max(...coordsToBound.map(c => c.lng));

    // Padding para o mapa não bater nas bordas (mais generoso no topo/base)
    const latPadding = (maxLat - minLat) * 0.15;
    const lngPadding = (maxLng - minLng) * 0.2;

    const bounds = {
        minLat: minLat - latPadding,
        maxLat: maxLat + latPadding,
        minLng: minLng - lngPadding,
        maxLng: maxLng + lngPadding
    };

    // 2. Função de projeção linear
    const project = (lat: number, lng: number) => {
        const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
        const y = 100 - (((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100);
        return { x, y };
    };

    // 3. Encontrar o valor máximo da métrica para escala de calor
    const maxValue = Math.max(...data.map(d => d[metric]), 1);

    return (
        <div className="relative w-full h-[600px] bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl group">
            {/* Grid Patterns de Fundo */}
            <div className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

            {/* SVG Content */}
            <svg viewBox="-5 -5 110 110" className="w-full h-full p-8 preserve-3d">
                <defs>
                    <radialGradient id="hpGradient">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="hiGradient">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="kmGradient">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </radialGradient>
                </defs>

                {/* Marcadores de Estado (Contexto Geográfico) */}
                <text x="5" y="10" fill="#475569" fontSize="6" fontWeight="black" className="opacity-20 uppercase tracking-tighter pointer-events-none">Maranhão</text>
                <text x="5" y="85" fill="#475569" fontSize="6" fontWeight="black" className="opacity-20 uppercase tracking-tighter pointer-events-none">Tocantins</text>

                {/* Linhas de conexão (Track) - Mais visível */}
                <polyline
                    points={Object.keys(CITY_COORDINATES)
                        .filter(c => c !== "São Luís") // Não ligar a capital à trilha principal
                        .sort((a, b) => CITY_COORDINATES[b].lat - CITY_COORDINATES[a].lat) // Norte para Sul
                        .map(city => {
                            const { x, y } = project(CITY_COORDINATES[city].lat, CITY_COORDINATES[city].lng);
                            return `${x},${y}`;
                        }).join(' ')}
                    fill="none"
                    stroke="#475569"
                    strokeWidth="0.8"
                    strokeDasharray="1 1"
                    className="opacity-40"
                    style={{ filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.1))' }}
                />

                <AnimatePresence>
                    {data.map((d, i) => {
                        const coords = CITY_COORDINATES[d.city];
                        if (!coords) return null;
                        const { x, y } = project(coords.lat, coords.lng);
                        const intensity = (d[metric] / maxValue);
                        const hasData = d[metric] > 0;
                        const radius = 3 + (intensity * 18); // Aumentado para melhor visibilidade

                        return (
                            <motion.g
                                key={`${d.city}-${metric}`}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0 }}
                                transition={{ delay: i * 0.05, type: 'spring' }}
                            >
                                {/* Ponto de Calor (Glow) */}
                                {hasData && (
                                    <circle
                                        cx={x}
                                        cy={y}
                                        r={radius * 1.8}
                                        fill={`url(#${metric}Gradient)`}
                                        className="animate-pulse"
                                    />
                                )}

                                {/* Ponto da Cidade - Maior se tiver dado */}
                                <circle
                                    cx={x}
                                    cy={y}
                                    r={hasData ? 1.2 : 0.6}
                                    fill={hasData ? 'white' : '#1e293b'}
                                    className="filter drop-shadow-sm transition-all"
                                />

                                {/* Label da Cidade - Sempre visível se tiver dados relevantes */}
                                <text
                                    x={x + 2}
                                    y={y + 0.5}
                                    fill={hasData ? 'white' : '#475569'}
                                    fontSize={hasData ? "2.5" : "1.8"}
                                    fontWeight={hasData ? "black" : "bold"}
                                    className={`pointer-events-none select-none transition-all ${hasData ? 'opacity-100' : 'opacity-40'}`}
                                >
                                    {d.city}
                                </text>

                                {hasData && (
                                    <text
                                        x={x + 2}
                                        y={y + 3.5}
                                        fill="rgba(255,255,255,0.7)"
                                        fontSize="1.5"
                                        fontWeight="black"
                                        className="pointer-events-none select-none"
                                    >
                                        {d[metric].toLocaleString()} {metric.toUpperCase()}
                                    </text>
                                )}
                            </motion.g>
                        );
                    })}
                </AnimatePresence>
            </svg>

            {/* Legenda Flutuante */}
            <div className="absolute top-6 left-6 flex flex-col gap-2">
                <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 p-4 rounded-2xl shadow-xl">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Concentração Geográfica</h4>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                            <span className="text-[10px] font-bold text-white uppercase">Alta Produtividade</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]" />
                            <span className="text-[10px] font-bold text-white uppercase">Interrupção Crítica</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hint Tooltip */}
            <div className="absolute bottom-6 right-6 flex items-center gap-2 text-slate-400 bg-slate-800/50 px-4 py-2 rounded-full backdrop-blur-sm">
                <MapPin className="w-3 h-3" />
                <span className="text-[8px] font-bold uppercase tracking-widest">Passe o mouse para nomes</span>
            </div>
        </div>
    );
};
