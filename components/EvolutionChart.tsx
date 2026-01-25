import React from 'react';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area
} from 'recharts';

interface EvolutionChartProps {
    data: {
        month: string;
        entered: number;
        won: number;
        accumulated: number;
    }[];
}

export default function EvolutionChart({ data }: EvolutionChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
                Sem dados para o período selecionado
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
                data={data}
                margin={{
                    top: 20,
                    right: 20,
                    bottom: 20,
                    left: 0,
                }}
            >
                <CartesianGrid stroke="#f1f5f9" vertical={false} strokeDasharray="3 3" />
                <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    dy={10}
                />
                <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    hide // Hide second axis labels to keep it clean, or show if needed
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: '#fff',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    labelStyle={{ color: '#0f172a', fontWeight: 'bold', marginBottom: '8px' }}
                />
                <Legend
                    verticalAlign="top"
                    height={36}
                    iconType="circle"
                />

                {/* Bars */}
                <Bar
                    yAxisId="left"
                    dataKey="entered"
                    name="Propostas (Entrada)"
                    barSize={24}
                    fill="#3b82f6" // Blue-500
                    radius={[4, 4, 0, 0]}
                    fillOpacity={0.9}
                />
                <Bar
                    yAxisId="left"
                    dataKey="won"
                    name="Propostas (Venda)"
                    barSize={24}
                    fill="#10b981" // Emerald-500
                    radius={[4, 4, 0, 0]}
                />

                {/* Line */}
                <Line
                    yAxisId="left" // Use left axis to scale with bars (or right if scale is vastly different) 
                    // Usually "Accumulated" is much larger, maybe it deserves right axis?
                    // User said "Linha contando o acumulado". If monthly is 5 and total is 100, bars will be tiny.
                    // Let's us RIGHT axis for Accum.
                    type="monotone"
                    dataKey="accumulated"
                    name="Total Acumulado"
                    stroke="#f59e0b" // Amber-500
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6 }}
                />
            </ComposedChart>
        </ResponsiveContainer>
    );
}
