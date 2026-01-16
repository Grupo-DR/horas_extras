import React, { useMemo } from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Bar,
    Area,
    Line,
    ReferenceLine,
    Label,
    Legend
} from 'recharts';
import { Contract } from '../types';
import { generateFinancialTimeline } from '../services/contractAnalytics';
import { Calendar, AlertCircle } from 'lucide-react';

interface Props {
    contract: Contract;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload; // Access full data point

        return (
            <div className="bg-white/95 backdrop-blur-md border border-slate-200 p-4 rounded-xl shadow-2xl skew-y-0 text-sm z-50">
                <p className="text-slate-500 font-bold mb-2 uppercase tracking-wide border-b border-slate-100 pb-1">
                    {label}
                </p>

                {/* Events Section */}
                {data.events && data.events.length > 0 && (
                    <div className="mb-3 bg-amber-50 p-2 rounded-lg border border-amber-100">
                        {data.events.map((e: any) => (
                            <div key={e.id} className="flex items-start gap-2 mb-1 last:mb-0 text-amber-700">
                                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                <div>
                                    <span className="font-bold text-xs block">{e.type.replace('ADITIVO_', 'ADIT. ')}</span>
                                    <span className="text-xs">
                                        {e.valueDelta !== 0 && `R$ ${e.valueDelta.toLocaleString('pt-BR')}`}
                                        {e.termDeltaDays !== 0 && ` +${e.termDeltaDays} dias`}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="space-y-1">
                    {payload.map((p: any, idx: number) => {
                        if (p.value === null || p.value === undefined) return null;

                        let name = p.name;
                        if (p.dataKey === 'accumulated') name = 'Realizado (Acum.)';
                        if (p.dataKey === 'contractValue') name = 'Valor Contrato (Teto)';
                        if (p.dataKey === 'measuredMonthly') name = 'No Mês';
                        if (p.dataKey === 'balance') name = 'Saldo Restante';

                        // Format Value
                        const val = typeof p.value === 'number'
                            ? p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : p.value;

                        return (
                            <div key={idx} className="flex items-center justify-between gap-4">
                                <span className="text-slate-500 font-medium flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
                                    {name}
                                </span>
                                <span className="font-mono font-bold text-slate-700">{val}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    return null;
};

export const ContractFinancialChart: React.FC<Props> = ({ contract }) => {
    const data = useMemo(() => generateFinancialTimeline(contract), [contract]);

    // Calculate Domains for Independent Scaling
    const { maxMonthly, maxTotal } = useMemo(() => {
        if (!data || data.length === 0) return { maxMonthly: 0, maxTotal: 0 };

        let mm = 0;
        let mt = 0;

        data.forEach(d => {
            if (d.measuredMonthly > mm) mm = d.measuredMonthly;
            if (d.contractValue > mt) mt = d.contractValue;
            if (d.accumulated > mt) mt = d.accumulated;
        });

        // Apply Coefficients
        return {
            maxMonthly: mm * 1.3 || 1000, // +30% breathing room
            maxTotal: mt * 1.05 || 1000   // +5% breathing room
        };
    }, [data]);

    if (!data || data.length === 0) return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
            <Calendar size={48} className="mb-2" />
            <p>Aguardando dados...</p>
        </div>
    );

    return (
        <div className="w-full h-full min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorAccum" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

                    <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        dy={10}
                        interval="preserveStartEnd"
                    />

                    {/* LEFT AXIS: TOTALS (Lines) */}
                    <YAxis
                        yAxisId="left"
                        orientation="left"
                        domain={[0, maxTotal]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`}
                        width={60}
                    />

                    {/* RIGHT AXIS: MONTHLY (Bars) */}
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, maxMonthly]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#93c5fd', fontSize: 11 }} // Light blue to match bars
                        tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`}
                        width={60}
                    />

                    <Tooltip content={<CustomTooltip />} />

                    {/* 1. Contract Ceiling (Step Line) -> LEFT */}
                    <Line
                        yAxisId="left"
                        type="stepAfter"
                        dataKey="contractValue"
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        dot={false}
                        activeDot={false}
                        name="Teto Contratual"
                    />

                    {/* 2. Monthly Bars -> RIGHT */}
                    <Bar
                        yAxisId="right"
                        dataKey="measuredMonthly"
                        fill="#93c5fd"
                        radius={[4, 4, 0, 0]}
                        opacity={0.8}
                        maxBarSize={50}
                        name="Medição Mensal"
                    />

                    {/* 3. Accumulated (Area) -> LEFT */}
                    <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="accumulated"
                        stroke="#2563eb"
                        fill="url(#colorAccum)"
                        strokeWidth={3}
                        name="Acumulado"
                    />

                    {/* 4. Balance -> LEFT */}
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="balance"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        opacity={0.5}
                        name="Saldo"
                    />

                    {/* 5. Event Markers -> LEFT (Relevant to Ceiling) */}
                    {data.map((entry, index) => {
                        if (entry.events && entry.events.length > 0) {
                            return (
                                <ReferenceLine
                                    yAxisId="left"
                                    key={`event-${index}`}
                                    x={entry.label}
                                    stroke="#f59e0b"
                                    strokeDasharray="3 3"
                                >
                                    <Label
                                        value="Aditivo"
                                        position="insideTop"
                                        fill="#b45309"
                                        fontSize={10}
                                        fontWeight="bold"
                                        offset={10}
                                    />
                                </ReferenceLine>
                            );
                        }
                        return null;
                    })}

                    <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};
