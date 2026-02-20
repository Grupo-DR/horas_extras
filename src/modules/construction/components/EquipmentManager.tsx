import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Search, Truck, Calendar, X, Save, Edit3, CheckCircle2, Upload } from 'lucide-react';
import { Equipment } from '../types';
import { constructionService } from '../services/firestore';
import { EQUIPMENT_CATEGORIES } from '../utils/constants';
import { parseEquipmentExcel } from '../utils/parsers';

const EquipmentManager: React.FC = () => {
    const [equipments, setEquipments] = useState<Equipment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchEquipments();
    }, []);

    const fetchEquipments = async () => {
        setIsLoading(true);
        try {
            const data = await constructionService.getEquipments();
            setEquipments(data);
        } catch (error) {
            console.error("Error fetching equipments", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const buffer = await file.arrayBuffer();
            const result = parseEquipmentExcel(buffer);

            if (result.errors.length > 0) {
                alert(`Erros na importação:\n${result.errors.join('\n')}`);
                return;
            }

            if (result.records.length === 0) {
                alert("Nenhum equipamento encontrado na planilha.");
                return;
            }

            await constructionService.batchSaveEquipments(result.records);
            await fetchEquipments();
            alert("Equipamentos importados com sucesso!");
        } catch (error) {
            console.error("Error importing equipments:", error);
            alert("Erro ao importar equipamentos. Verifique se o formato do arquivo está correto.");
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir este equipamento?")) {
            try {
                await constructionService.deleteEquipment(id);
                await fetchEquipments();
            } catch (error) {
                console.error("Error deleting equipment", error);
                alert("Erro ao excluir equipamento.");
            }
        }
    };

    const filteredEquipments = equipments.filter(eq =>
        eq.frota.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <Truck className="w-6 h-6 text-amber-500" /> Gestão de Equipamentos
                    </h2>
                    <p className="text-slate-500 font-medium text-sm mt-1">
                        Cadastre e gerencie a frota disponível importando a tabela base.
                    </p>
                </div>
                <div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".xlsx, .xls, .csv"
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg"
                        disabled={isLoading}
                    >
                        <Upload className="w-4 h-4" /> Importar Excel
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por frota ou tipo..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-sm font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Frota</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Início Vigência</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Fim Vigência</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr><td colSpan={6} className="text-center py-10 font-bold text-slate-400">Carregando...</td></tr>
                            ) : filteredEquipments.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-10 font-bold text-slate-400">Nenhum equipamento encontrado.</td></tr>
                            ) : (
                                filteredEquipments.map((eq) => (
                                    <tr key={eq.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-slate-100 p-2 rounded-lg text-slate-500">
                                                    <Truck className="w-4 h-4" />
                                                </div>
                                                <span className="font-black text-slate-900 text-sm">{eq.frota}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-slate-600 uppercase bg-slate-100 px-2 py-1 rounded">{eq.type}</span>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-medium text-slate-600">
                                            {new Date(eq.startDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-medium text-slate-600">
                                            {eq.endDate ? new Date(eq.endDate + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black uppercase ${eq.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {eq.active ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleDelete(eq.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors" title="Excluir Equipamento">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default EquipmentManager;
