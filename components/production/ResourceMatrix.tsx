import React, { useMemo } from 'react';
import { format, parse, isValid, compareAsc } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ResourceData {
    resourceName: string;
    date: string; // YYYY-MM-DD
    quantity: number;
}

interface Props {
    data: ResourceData[];
    title: string;
    resourceLabel: string; // 'Função' or 'Equipamento'
    colorTheme?: 'blue' | 'yellow' | 'green';
}

export const ResourceMatrix: React.FC<Props> = ({ data, title, resourceLabel, colorTheme = 'blue' }) => {

    // 1. Get Unique Dates (or Days) and Sort them
    const uniqueDates = useMemo(() => {
        const dates = Array.from(new Set(data.map(d => d.date)));
        return dates.sort((a, b) => {
            // Check if looks like a number (1-31)
            const nA = parseInt(a);
            const nB = parseInt(b);
            if (!isNaN(nA) && !isNaN(nB) && String(nA) === a && String(nB) === b) {
                return nA - nB;
            }
            // Fallback to string sort
            return a.localeCompare(b);
        });
    }, [data]);

    // 2. Get Unique Resources (Rows)
    const uniqueResources = useMemo(() => {
        const resources = Array.from(new Set(data.map(d => d.resourceName)));
        return resources.sort((a, b) => a.localeCompare(b));
    }, [data]);

    // 3. Build Matrix Map for O(1) Access
    const matrixMap = useMemo(() => {
        const map = new Map<string, number>();
        data.forEach(d => {
            const key = `${d.resourceName}::${d.date}`;
            // If there are duplicates (e.g. same role in same day from different RDOs), sum them
            const current = map.get(key) || 0;
            map.set(key, current + d.quantity);
        });
        return map;
    }, [data]);

    // Theme Colors
    const themeClasses = {
        blue: { header: 'bg-blue-50 text-blue-700', cell: 'bg-blue-100 text-blue-800' },
        yellow: { header: 'bg-yellow-50 text-yellow-700', cell: 'bg-yellow-100 text-yellow-800' },
        green: { header: 'bg-green-50 text-green-700', cell: 'bg-green-100 text-green-800' },
    }[colorTheme];

    const formatDate = (dateStr: string) => {
        // If it's a simple number 1-31, return as is
        const n = parseInt(dateStr);
        if (!isNaN(n) && String(n) === dateStr && n >= 1 && n <= 31) {
            return dateStr;
        }

        try {
            const date = parse(dateStr, 'yyyy-MM-dd', new Date());
            return isValid(date) ? format(date, 'dd/MM', { locale: ptBR }) : dateStr;
        } catch {
            return dateStr;
        }
    };

    if (data.length === 0) return <div className="p-4 text-center text-slate-500">Sem dados para exibir.</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-white sticky left-0 z-20">
                <h3 className="font-bold text-slate-800">{title}</h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-3 text-left border-b border-r border-slate-200 min-w-[200px] sticky left-0 bg-slate-50 z-10 font-bold text-slate-600">
                                {resourceLabel}
                            </th>
                            {uniqueDates.map(date => (
                                <th key={date} className="p-2 text-center border-b border-slate-200 min-w-[60px] font-medium text-slate-500 text-xs">
                                    {formatDate(date)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {uniqueResources.map(resource => (
                            <tr key={resource} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3 text-left border-r border-slate-200 font-medium text-slate-700 sticky left-0 bg-white whitespace-nowrap z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    {resource}
                                </td>
                                {uniqueDates.map(date => {
                                    const qty = matrixMap.get(`${resource}::${date}`) || 0;
                                    return (
                                        <td key={`${resource}-${date}`} className="p-2 text-center border-slate-100">
                                            {qty > 0 ? (
                                                <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold ${themeClasses.cell}`}>
                                                    {qty}
                                                </span>
                                            ) : (
                                                <span className="text-slate-200">-</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
