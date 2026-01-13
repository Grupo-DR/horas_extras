import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, DollarSign, Plus, Trash2, TrendingUp, FileText, Upload } from 'lucide-react';
import { Contract, ContractMeasurement } from '../types';
import * as XLSX from 'xlsx';
import { parseBM, ContractService } from '../services/contractService';
import { toast } from 'sonner';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Area,
    AreaChart,
    ComposedChart
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContractDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    contract: Contract | null;
    onAddMeasurement: (contractId: string, measurement: any) => Promise<void>;
    onRemoveMeasurement: (contractId: string, measurementId: string) => Promise<void>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        // Detect if hovering over projection
        const isProjection = payload[0]?.payload?.isProjection;

        return (
            <div className="bg-white/90 backdrop-blur-md border border-slate-200 p-3 rounded-xl shadow-xl">
                <p className="text-slate-500 text-xs font-bold mb-1 uppercase">
                    {label} {isProjection && '(Projeção)'}
                </p>
                <div className="space-y-1">
                    {payload.map((p: any, idx: number) => {
                        // Skip rendering null values
                        if (p.value === null || p.value === undefined) return null;

                        let name = p.name;
                        if (p.dataKey === 'accumulatedProjected') name = 'Projeção Acumulado';
                        if (p.dataKey === 'balanceProjected') name = 'Projeção Saldo';

                        return (
                            <p key={idx} style={{ color: p.color }} className="font-bold text-sm">
                                {name}: {p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        );
                    })}
                </div>
            </div>
        );
    }
    return null;
};

export const ContractDetailsModal: React.FC<ContractDetailsModalProps> = ({
    isOpen,
    onClose,
    contract,
    onAddMeasurement,
    onRemoveMeasurement
}) => {

    // View Mode State
    const [viewMode, setViewMode] = useState<'CONSOLIDATED' | 'RENTAL' | 'CONSTRUTORA'>('CONSOLIDATED');
    const [auditMonth, setAuditMonth] = useState(new Date().toISOString().split('T')[0].substring(0, 7)); // YYYY-MM

    // Measurement Form State
    const [newValue, setNewValue] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [newDesc, setNewDesc] = useState('');
    const [loading, setLoading] = useState(false);
    const [parsedItems, setParsedItems] = useState<any[]>([]); // New State for Audit Preview
    const [history, setHistory] = useState<ContractMeasurement[]>([]);

    // Load History on Open
    React.useEffect(() => {
        if (isOpen && contract) {
            ContractService.getMeasurementHistory(contract.id).then(setHistory);
        }
    }, [isOpen, contract]);

    // Active Matrix Data: Preview OR Selected Month History OR Empty
    const activeAuditData = useMemo(() => {
        if (parsedItems.length > 0) return parsedItems; // Preview takes precedence

        // Find history for selected month
        const hist = history.find(h => h.period === auditMonth);
        if (hist && hist.scopeMatrix) {
            // Map ScopeAuditItem to generic structure for display
            return hist.scopeMatrix.map(s => ({
                code: s.item,
                description: s.descricao,
                monthValue: s.doMes,
                unitPrice: 0,
                totalQuantity: 0
            }));
        }
        return [];
    }, [parsedItems, history, auditMonth]);

    // Filter Measurements based on Entity
    const filteredMeasurements = useMemo(() => {
        if (!contract || !contract.measurements) return [];
        if (viewMode === 'CONSOLIDATED') return contract.measurements;
        return contract.measurements.filter(m => m.entity === viewMode);
    }, [contract, viewMode]);

    // Prepare Chart Data
    const chartData = useMemo(() => {
        if (!contract) return [];

        const measurements = filteredMeasurements;
        const totalValue = contract.totalValue || 0;
        const startDate = new Date(contract.startDate);
        const endDate = new Date(contract.endDate);
        const sorted = [...measurements].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const points = [
            {
                date: startDate,
                shortDate: format(startDate, 'dd/MM/yy'),
                monthYear: format(startDate, 'MMM/yy', { locale: ptBR }),
                value: 0,
                accumulated: 0,
                balance: totalValue,
                accumulatedProjected: null,
                balanceProjected: null,
                isProjection: false,
                description: 'Início do Contrato'
            }
        ];

        let accumulated = 0;
        let lastDate = startDate;
        let validMonthsCount = 0;
        let totalMeasured = 0;

        sorted.forEach(m => {
            const mDate = new Date(m.date);
            accumulated += m.value;
            lastDate = mDate;
            validMonthsCount++;
            totalMeasured += m.value;

            points.push({
                date: mDate,
                shortDate: format(mDate, 'dd/MM/yy'),
                monthYear: format(mDate, 'MMM/yy', { locale: ptBR }), // Format: Jan/25
                value: m.value,
                accumulated: accumulated,
                balance: totalValue - accumulated,
                accumulatedProjected: null,
                balanceProjected: null,
                isProjection: false,
                description: m.description
            });
        });

        // Projection: Simple Average Trend
        if (sorted.length > 0 && totalValue > 0) {
            const avgMonthly = totalMeasured / validMonthsCount; // Average of Col 18 equivalent

            const lastPoint = points[points.length - 1];
            lastPoint.accumulatedProjected = lastPoint.accumulated;
            lastPoint.balanceProjected = lastPoint.balance;

            let projectionAccumulated = accumulated;
            let projectionBalance = totalValue - accumulated;

            let currentDate = new Date(lastDate);
            currentDate.setMonth(currentDate.getMonth() + 1); // Jump monthly

            while (currentDate <= endDate) {
                projectionAccumulated += avgMonthly;
                projectionBalance -= avgMonthly;

                // Cap at Total Value / 0 Balance
                if (projectionBalance < 0) projectionBalance = 0;
                if (projectionAccumulated > totalValue) projectionAccumulated = totalValue;

                points.push({
                    date: new Date(currentDate),
                    shortDate: format(currentDate, 'dd/MM/yy'),
                    monthYear: format(currentDate, 'MMM/yy', { locale: ptBR }),
                    value: 0,
                    accumulated: null,
                    balance: null,
                    accumulatedProjected: projectionAccumulated,
                    balanceProjected: projectionBalance,
                    isProjection: true,
                    description: 'Projeção (Média)'
                });

                if (projectionBalance <= 0) break; // Stop if completed
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        }

        return points.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [contract, filteredMeasurements]);

    // Financial Stats
    const totalValue = contract?.totalValue || 0;
    // Get last "Real" point for stats
    const realPoints = chartData.filter((d: any) => !d.isProjection);
    const executedValue = realPoints.length > 0 ? realPoints[realPoints.length - 1].accumulated : 0;
    const balance = totalValue - executedValue;
    const progress = totalValue > 0 ? (executedValue / totalValue) * 100 : 0;

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contract) return;
        if (!newValue || !newDate) return;

        setLoading(true);
        try {
            const period = newDate.substring(0, 7); // YYYY-MM

            // Construct full measurement object for history
            const measurementData = {
                date: new Date(newDate),
                period: period,
                measurementValue: parseFloat(newValue.replace(',', '.')),
                description: newDesc,
                entity: viewMode === 'CONSOLIDATED' ? undefined : viewMode,

                // If we have parsed items from the import, use them
                scopeMatrix: parsedItems.length > 0 ? parsedItems.map(p => ({
                    item: p.code,
                    codigoVLI: null,
                    descricao: p.description,
                    acumuladoAnterior: 0, // Would need calculation from previous
                    doMes: p.monthValue,
                    totalAcumulado: p.balance ? (contract.totalValue - p.balance) : 0, // Approximate
                    previstoContrato: 0,
                    saldo: p.balance
                })) : [],

                accumulatedValue: (contract.measurements?.reduce((acc, m) => acc + m.measurementValue, 0) || 0) + parseFloat(newValue.replace(',', '.')),
                contractBalance: contract.totalValue - ((contract.measurements?.reduce((acc, m) => acc + m.measurementValue, 0) || 0) + parseFloat(newValue.replace(',', '.')))
            };

            await ContractService.addMeasurementHistory(contract.id, measurementData);

            toast.success("Medição salva com sucesso!", {
                description: `Período: ${period}`
            });

            // Reset form
            setNewValue('');
            setNewDesc('');
            setParsedItems([]); // Clear preview

            // Refresh History (Optional: separate load logic)
            // loadHistory(); 

        } catch (error: any) {
            console.error(error);
            toast.error("Erro ao salvar medição: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // File Upload Handler
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            console.group("[BM] Upload");
            console.log("File:", file.name, file.size, file.type);

            const data = await new Promise<any[][]>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        const bstr = evt.target?.result;
                        const wb = XLSX.read(bstr, { type: 'binary' });

                        console.log("Sheets:", wb.SheetNames);
                        const wsname = wb.SheetNames[0];
                        console.log("Using sheet:", wsname);

                        const ws = wb.Sheets[wsname];
                        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                        console.log("Grid size:", jsonData.length, "rows");
                        console.log("Row[0..5]:", jsonData.slice(0, 6));
                        console.log("Row[20..30]:", jsonData.slice(20, 31));

                        resolve(jsonData);
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = (err) => reject(err);
                reader.readAsBinaryString(file);
            });

            console.groupEnd();

            // PARSER UPDATE: Now Async & Robust
            const parsed = await parseBM(data);
            const { entity, items, periodDate, warnings, confidence, usedAI } = parsed;

            console.group("[BM] Parsed Result");
            console.log("entity:", entity);
            console.log("periodDate:", periodDate);
            console.log("confidence:", confidence);
            console.log("warnings:", warnings);
            console.log("items count:", items?.length ?? 0);
            console.table((items ?? []).slice(0, 10)); // Top 10
            console.groupEnd();

            // UX: Handle Warnings
            if (warnings && warnings.length > 0) {
                const msg = `Importado com ${warnings.length} avisos:\n` + warnings.join('\n');

                // If confidence is extremely low, likely garbage
                if (confidence < 0.5) {
                    toast.error("Atenção: Leitura com baixa confiança.", {
                        description: "Verifique se o arquivo segue o padrão ou se os dados foram extraídos corretamente.\n" + warnings.join('\n'),
                        duration: 8000
                    });
                } else {
                    toast.warning("Importação concluída com avisos", {
                        description: warnings.join('\n'),
                        duration: 5000
                    });
                }
            } else {
                toast.success("Importação realizada com sucesso!");
            }

            if (usedAI) {
                toast.info("Importação via IA Inteligente", {
                    description: "O sistema detectou um layout incomum e utilizou IA para extrair os dados. Verifique a precisão."
                });
            }

            setParsedItems(items); // Store for Audit Matrix Preview

            const totalMonthValue = items.reduce((acc: number, item: any) => acc + (item.monthValue || 0), 0);

            setNewValue(totalMonthValue.toFixed(2).replace('.', ','));

            // Auto-fill Description
            setNewDesc(`Boletim Importado ${entity ? `(${entity})` : ''}`);

            // Auto-fill Date if found
            if (periodDate) {
                // Format to YYYY-MM-DD for input[type="date"]
                const yyyy = periodDate.getFullYear();
                const mm = String(periodDate.getMonth() + 1).padStart(2, '0');
                const dd = String(periodDate.getDate()).padStart(2, '0');
                setNewDate(`${yyyy}-${mm}-${dd}`);
            } else {
                // Warn about date
            }

            if (entity && viewMode !== 'CONSOLIDATED' && viewMode !== entity) {
                // Non-blocking toast ideal here
                const confirmSwitch = window.confirm(`O arquivo parece ser da ${entity}, mas você está na aba ${viewMode}. Deseja trocar?`);
                if (confirmSwitch) setViewMode(entity as any);
            } else if (entity && viewMode === 'CONSOLIDATED') {
                setViewMode(entity as any);
            }

        } catch (error: any) {
            console.error(error);
            toast.error(`Falha na importação: ${error.message}`);
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    if (!isOpen || !contract) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 md:p-6 text-slate-800">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden relative"
                >
                    {/* HEADER */}
                    <div className="flex justify-between items-start p-6 border-b border-slate-100 bg-slate-50/50">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                    {contract.status === 'ACTIVE' ? 'Em Andamento' : 'Concluído'}
                                </span>
                                <span className="text-slate-500 text-sm font-medium">
                                    {contract.siteName}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800">{contract.name}</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* TABS */}
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                {['CONSOLIDATED', 'RENTAL', 'CONSTRUTORA'].map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => setViewMode(mode as any)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === mode
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        {mode === 'CONSOLIDATED' ? 'Consolidado' : mode === 'RENTAL' ? 'DR Rental' : 'DR Construtora'}
                                    </button>
                                ))}
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">

                        {/* STATS GRID */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-2xl flex flex-col justify-between">
                                <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">Valor Contratual</span>
                                <span className="text-2xl font-bold text-blue-900 mt-2">
                                    {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                            <div className="p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex flex-col justify-between">
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Executado ({viewMode === 'CONSOLIDATED' ? 'Total' : viewMode})</span>
                                <span className="text-2xl font-bold text-emerald-900 mt-2">
                                    {executedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                            <div className="p-5 bg-amber-50/50 border border-amber-100 rounded-2xl flex flex-col justify-between">
                                <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">Saldo a Executar</span>
                                <span className="text-2xl font-bold text-amber-900 mt-2">
                                    {balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                            <div className="p-5 bg-slate-50/50 border border-slate-100 rounded-2xl flex flex-col justify-between relative overflow-hidden">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Progresso Físico</span>
                                <span className="text-2xl font-bold text-slate-800 mt-2">
                                    {progress.toFixed(1)}%
                                </span>
                                <div className="absolute bottom-0 left-0 w-full h-1.5 bg-slate-200">
                                    <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
                            {/* CHART AREA */}
                            <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[400px]">
                                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <TrendingUp size={20} className="text-blue-600" />
                                    Curva de Evolução Financeira
                                </h3>
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorAccumulated" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis
                                                dataKey="monthYear"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                                dy={10}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                                tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <ReferenceLine y={totalValue} stroke="#ef4444" strokeDasharray="4 4" />
                                            <Area
                                                type="monotone"
                                                dataKey="accumulated"
                                                stroke="#2563eb"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorAccumulated)"
                                            />
                                            <Line type="monotone" dataKey="balance" stroke="#f59e0b" strokeWidth={3} dot={false} />
                                            <Line type="monotone" dataKey="accumulatedProjected" stroke="#2563eb" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                            <Line type="monotone" dataKey="balanceProjected" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* ADD MEASUREMENT FORM */}
                            <div className="space-y-6">
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <Plus size={20} className="text-green-600" />
                                        Registrar Medição ({viewMode})
                                    </h3>

                                    <div className="mb-6 border-2 border-dashed border-blue-300 bg-blue-50/30 rounded-xl p-6 flex flex-col items-center justify-center hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer relative group shadow-sm">
                                        <input
                                            type="file"
                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                            onChange={handleFileUpload}
                                            accept=".csv, .xls, .xlsx"
                                            disabled={loading}
                                        />
                                        {loading ? (
                                            <div className="flex flex-col items-center animate-pulse">
                                                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                                                <span className="text-sm font-bold text-blue-600">Processando planilha...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="p-3 bg-white shadow-md rounded-full mb-3 group-hover:scale-110 transition-transform">
                                                    <Upload size={24} className="text-blue-600" />
                                                </div>
                                                <span className="text-sm font-bold text-slate-700">Clique para Importar Boletim</span>
                                                <span className="text-xs text-slate-500 mt-1 text-center max-w-[200px]">Suporta Excel (.xlsx) no padrão DR Construtora</span>
                                            </>
                                        )}
                                    </div>
                                    <form onSubmit={handleAdd} className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Valor (R$)</label>
                                            <input
                                                type="text"
                                                placeholder="0,00"
                                                value={newValue}
                                                onChange={e => setNewValue(e.target.value)}
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Data</label>
                                            <input
                                                type="date"
                                                value={newDate}
                                                onChange={e => setNewDate(e.target.value)}
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
                                        >
                                            {loading ? 'Salvando...' : 'Adicionar'}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>

                        {/* AUDIT MATRIX */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <FileText size={20} className="text-purple-600" />
                                    Matriz de Auditoria de Escopo
                                </h3>
                                <input
                                    type="month"
                                    value={auditMonth}
                                    onChange={(e) => setAuditMonth(e.target.value)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 outline-none"
                                />
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 sticky top-0 z-10">
                                        <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            <th className="p-3 border-b border-slate-100">Código</th>
                                            <th className="p-3 border-b border-slate-100">Descrição</th>
                                            <th className="p-3 border-b border-slate-100 text-right">Unitário</th>
                                            <th className="p-3 border-b border-slate-100 text-right">Qtd Total</th>
                                            <th className="p-3 border-b border-slate-100 text-right">
                                                Medição {parsedItems.length > 0 ? '(Preview)' : `(${format(new Date(auditMonth + '-01'), 'MMM/yy', { locale: ptBR })})`}
                                            </th>
                                            <th className="p-3 border-b border-slate-100 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {contract.scopeItems?.map((item, idx) => {
                                            // Determine data source: Parsed Items (Preview) OR Historical Measurements
                                            let displayValue = 0;
                                            let hasActivity = false;

                                            // Look up in active data (Preview or History)
                                            // Logic: Find item with matching code
                                            const match = activeAuditData.find((p: any) => p.code === item.code || (item.code && p.code && String(p.code).trim() === String(item.code).trim()));

                                            if (match) {
                                                displayValue = match.monthValue || match.doMes || 0;
                                                hasActivity = displayValue > 0;
                                            }

                                            // Styling for "Missing" or "Zero" items
                                            const isZero = displayValue === 0;
                                            const rowClass = isZero ? 'bg-slate-50 opacity-60 grayscale' : 'bg-white font-medium text-slate-700';

                                            return (
                                                <tr key={idx} className={`border-b border-slate-100 transition-colors ${rowClass}`}>
                                                    <td className="p-3 font-mono text-xs text-slate-500">{item.code}</td>
                                                    <td className="p-3">{item.description}</td>
                                                    <td className="p-3 text-right text-slate-500">{item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                    <td className="p-3 text-right text-slate-500">{item.totalQuantity} {item.unit}</td>
                                                    <td className="p-3 text-right relative group">
                                                        <span className={isZero ? 'text-slate-400' : 'text-emerald-600 font-bold'}>
                                                            {displayValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </span>
                                                        {/* Tooltip for Pending Items */}
                                                        {isZero && (
                                                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-48 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-xl z-50">
                                                                Item pendente de avanço físico
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className={`inline-block w-2.5 h-2.5 rounded-full ${hasActivity ? 'bg-emerald-500 shadow-sm shadow-emerald-200' : 'bg-slate-300'}`}></div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {(!contract.scopeItems || contract.scopeItems.length === 0) && (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                                                    Nenhum item de escopo cadastrado ou Lista Mestra não importada.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
