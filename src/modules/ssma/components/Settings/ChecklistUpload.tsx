import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SSMAChecklistItem } from '../../types';
import { ssmaChecklistService } from '../../services/ssmaChecklistService';
import { useSSMAStore } from '../../store/useSSMAStore';

export const ChecklistUpload: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const { fetchChecklist, checklistItems } = useSSMAStore();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            
            const sheetName = workbook.SheetNames.find(s => s.toLowerCase() === 'itens');
            if (!sheetName) {
                throw new Error("Aba 'itens' não encontrada na planilha.");
            }

            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            
            const headers = jsonData[0];
            if (!headers) throw new Error("Planilha vazia ou sem cabeçalhos.");

            const tipoIdx = headers.findIndex((h: string) => typeof h === 'string' && h.toLowerCase().includes('tipo inspeção'));
            const catIdx = headers.findIndex((h: string) => typeof h === 'string' && h.toLowerCase().includes('categoria'));
            const classIdx = headers.findIndex((h: string) => typeof h === 'string' && h.toLowerCase().includes('classificação da nc'));
            const descIdx = headers.findIndex((h: string) => typeof h === 'string' && h.toLowerCase().includes('descrição'));

            if (tipoIdx === -1 || descIdx === -1) {
                throw new Error("Colunas obrigatórias não encontradas. Verifique se existem as colunas 'Tipo Inspeção' e 'Descrição'.");
            }

            const itemsToSave: Omit<SSMAChecklistItem, 'id'>[] = [];

            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || !row[descIdx]) continue;

                itemsToSave.push({
                    inspectionType: row[tipoIdx]?.toString().trim() || 'GERAL',
                    category: catIdx !== -1 ? (row[catIdx]?.toString().trim() || 'Geral') : 'Geral',
                    ncClassification: classIdx !== -1 ? (row[classIdx]?.toString().trim() || 'N/A') : 'N/A',
                    description: row[descIdx].toString().trim()
                });
            }

            await ssmaChecklistService.saveAllItems(itemsToSave);
            toast.success(`${itemsToSave.length} itens de checklist importados com sucesso!`);
            await fetchChecklist();
        } catch (error: any) {
            console.error('Checklist Upload Error:', error);
            toast.error(error.message || 'Erro ao processar a planilha.');
        } finally {
            setLoading(false);
            if (e.target) e.target.value = '';
        }
    };

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-2">Checklist Dinâmico (Excel)</h3>
            <p className="text-sm text-slate-500 mb-6">
                Faça o upload do arquivo Excel com a aba <strong>itens</strong> para atualizar as perguntas e os tipos de inspeção de SSMA disponíveis para preenchimento.
            </p>

            <div className="flex items-center gap-4">
                <label className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                    ${loading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'}
                    transition-colors
                `}>
                    <Upload className="w-4 h-4" />
                    {loading ? 'Processando...' : 'Importar Planilha'}
                    <input 
                        type="file" 
                        accept=".xlsx,.xls" 
                        onChange={handleFileUpload}
                        disabled={loading}
                        className="hidden" 
                    />
                </label>

                {checklistItems.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                        <CheckCircle className="w-4 h-4" />
                        <span>{checklistItems.length} itens carregados</span>
                    </div>
                )}
            </div>
        </div>
    );
};
