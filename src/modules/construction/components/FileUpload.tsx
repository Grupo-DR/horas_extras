import * as React from 'react';
import { useState, useRef, useMemo } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Clock, History, Trash2, CloudUpload } from 'lucide-react';
import { csvToRecords, excelToRecords } from '../utils/parsers';
import { ConstructionRecord } from '../types';
import { getCycleKey } from '../utils/calculations';
import { constructionService } from '../services/firestore';

interface FileUploadProps {
  onImportSuccess: () => void;
  // Removed existingData as history should come from API or be managed via Dashboard refresh
}

const FileUpload: React.FC<FileUploadProps> = ({ onImportSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // In Phase 1, we don't display local history here, maybe fetching from API /cycles could be cool but let's stick to upload first

  const processFile = async (file: File) => {
    setError(null);
    setIsProcessing(true);
    setStatusMessage("Lendo arquivo...");

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isCsv = file.name.endsWith('.csv') || file.name.endsWith('.txt');

    if (!isExcel && !isCsv) {
      setError("Selecione um arquivo Excel (.xlsx) ou CSV.");
      setIsProcessing(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let records: ConstructionRecord[] = isExcel
          ? excelToRecords(e.target?.result as ArrayBuffer)
          : csvToRecords(e.target?.result as string);

        if (records.length === 0) {
          setError("Arquivo vazio ou formato inválido.");
          setIsProcessing(false);
          return;
        }

        // Helper to convert DD/MM/YYYY to YYYY-MM-DD
        const toISODate = (brDate: string): string => {
          if (!brDate) return '';
          const parts = brDate.split('/');
          if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
          return brDate; // Fallback if already ISO or unexpected
        };

        // Group records by Cycle
        const recordsByCycle: Record<string, any[]> = {};
        let validationErrors = 0;

        records.forEach(r => {
          const isoDate = toISODate(r.data);

          // Basic Client-Side Validation
          if (!isoDate || !r.frota) {
            console.warn('Skipping invalid row:', r);
            validationErrors++;
            return;
          }

          const cycle = getCycleKey(r.data); // Use DD/MM/YYYY for calculation as expected by utils
          // Utils.getCycleKey (frontend) might expect Date object or string. 
          // In 'utils/calculations.ts', let's assume it handles string or Date. 
          // If it mimics the backend one I wrote, it handles both.

          if (!recordsByCycle[cycle]) recordsByCycle[cycle] = [];

          recordsByCycle[cycle].push({
            date: isoDate, // Send YYYY-MM-DD to Backend
            equipmentCode: r.frota,
            operator: r.operador || '',
            startTime: r.horaInicio || '',
            endTime: r.horaTermino || '',
            codeSAP: r.codSapMobra || r.codSapRental || '',
            description: r.item || '',
            quantity: r.producao || 0
          });
        });

        if (validationErrors > 0) {
          console.warn(`Skipped ${validationErrors} rows due to missing Date or Equipment Code.`);
        }

        // Send to API
        setStatusMessage(`Enviando ${records.length - validationErrors} registros para a nuvem...`);
        const cycles = Object.keys(recordsByCycle);

        for (const cycle of cycles) {
          console.log(`Sending payload for cycle ${cycle}:`, recordsByCycle[cycle]); // Debug Log
          setStatusMessage(`Enviando ${records.length - validationErrors} registros para o ciclo ${cycle}...`);
          await constructionService.saveRecords(cycle, recordsByCycle[cycle]);
        }

        setStatusMessage("Sucesso!");
        setTimeout(() => {
          onImportSuccess();
          setIsProcessing(false);
          setStatusMessage("");
        }, 1000);

      } catch (err: any) {
        console.error(err);
        setError("Erro ao processar/enviar: " + (err.message || "Erro desconhecido"));
        setIsProcessing(false);
      }
    };

    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="text-center">
        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Central de Importação</h2>
        <p className="mt-2 text-slate-500 font-medium">Os dados são processados e armazenados diretamente na nuvem (Google Sheets).</p>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all ${isDragging ? 'border-amber-500 bg-amber-50/50 scale-[1.01]' : 'border-slate-300 bg-white hover:border-slate-400'
          } ${isProcessing ? 'opacity-50 cursor-wait' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) processFile(file);
        }}
      >
        <div className="flex flex-col items-center">
          <div className="bg-slate-100 p-4 rounded-2xl mb-4">
            {isProcessing ? (
              <CloudUpload className="w-8 h-8 animate-bounce text-amber-500" />
            ) : (
              <Upload className="w-8 h-8 text-slate-400" />
            )}
          </div>
          <p className="text-lg font-black text-slate-800 mb-1 uppercase tracking-tight">
            {isProcessing ? statusMessage : 'Arraste seu RDO aqui'}
          </p>
          <p className="text-slate-400 text-xs font-bold uppercase mb-6">Suporta .xlsx e .csv</p>

          <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} accept=".xlsx,.xls,.csv" className="hidden" />
          <button disabled={isProcessing} onClick={() => fileInputRef.current?.click()} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all disabled:bg-slate-400 shadow-lg">
            {isProcessing ? 'Processando...' : 'Selecionar Arquivo'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-xs font-black uppercase tracking-widest">{error}</p>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
