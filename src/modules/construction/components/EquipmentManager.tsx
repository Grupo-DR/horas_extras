import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Truck, Calendar, X, Save, Edit3, CheckCircle2 } from 'lucide-react';
import { Equipment } from '../types';
import { constructionService } from '../services/firestore';
import { EQUIPMENT_CATEGORIES } from '../utils/constants';

const EquipmentManager: React.FC = () => {
    const [equipments, setEquipments] = useState<Equipment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);

    const [formData, setFormData] = useState<Partial<Equipment>>({
        frota: '',
        type: '',
        startDate: '',
        endDate: '',
        active: true
    });

    const equipmentTypes = Object.values(EQUIPMENT_CATEGORIES);

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

    const handleOpenModal = (equipment?: Equipment) => {
        if (equipment) {
            setEditingEquipment(equipment);
            setFormData(equipment);
        } else {
            setEditingEquipment(null);
            setFormData({
                frota: '',
                type: '',
                startDate: new Date().toISOString().split('T')[0],
                endDate: '',
                active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingEquipment(null);
    };

    const handleSave = async () => {
        if (!formData.frota || !formData.type || !formData.startDate) {
            alert("Preencha os campos obrigatórios: Frota, Tipo e Data Início.");
            return;
        }

        try {
            if (editingEquipment) {
                await constructionService.updateEquipment(editingEquipment.id, formData);
            } else {
                await constructionService.addEquipment(formData as Omit<Equipment, 'id'>);
            }
            await fetchEquipments();
            handleCloseModal();
        } catch (error) {
            console.error("Error saving equipment", error);
            alert("Erro ao salvar equipamento.");
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
                        Cadastre e gerencie a frota disponível para planejamento.
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg"
                >
                    <Plus className="w-4 h-4" /> Novo Equipamento
                </button>
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
                                                <button onClick={() => handleOpenModal(eq)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(eq.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
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

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">
                                {editingEquipment ? 'Editar Equipamento' : 'Novo Equipamento'}
                            </h3>
                            <button onClick={handleCloseModal} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Frota (ID)</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                    placeholder="Ex: CAM-01"
                                    value={formData.frota}
                                    onChange={(e) => setFormData({ ...formData, frota: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-1">Tipo de Equipamento</label>
                                <input
                                    list="equipment-types"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                    placeholder="Selecione ou digite..."
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                />
                                <datalist id="equipment-types">
                                    {equipmentTypes.map(t => <option key={t} value={t} />)}
                                </datalist>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase mb-1">Data Início</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase mb-1">Data Fim (Opcional)</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl">
                                <input
                                    type="checkbox"
                                    id="active"
                                    className="w-5 h-5 text-amber-500 rounded focus:ring-amber-500 border-gray-300"
                                    checked={formData.active}
                                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                />
                                <label htmlFor="active" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                                    Equipamento Ativo
                                </label>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-900 flex justify-end">
                            <button
                                onClick={handleSave}
                                className="bg-amber-500 text-slate-900 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-400 transition-all shadow-lg flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" /> Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EquipmentManager;
