import React, { useState, useEffect } from 'react';
import { useSSMADashboard } from '../../hooks/useSSMADashboard';
import { ssmaInspectionService } from '../../services/ssmaInspectionService';
import { useAuth } from '@/contexts/AuthContext';
import { SSMAInspection, SSMACostCenter, SSMARegional, SSMAEmployee, SSMAInspecaoEvidencia } from '../../types';
import { Plus, Edit2, Trash2, Eye, EyeOff, Search, FileSpreadsheet, Check, X, ShieldAlert, Award, Camera, Lock, Unlock, Upload } from 'lucide-react';
import { calculateInspecoesFields } from '../../domain/calculateSSMAResults';

export const InspectionEventList: React.FC = () => {
  const { profile } = useAuth();
  const {
      inspections: inspecoes,
      costCenters,
      regionals,
      employees: colaboradores,
      refetch
  } = useSSMADashboard({ year: new Date().getFullYear() });

  const gestores = colaboradores.filter(e => e.functionGroup === 'MANAGER');
  const encarregados = colaboradores.filter(e => e.functionGroup === 'FOREMAN');
  const supervisores = colaboradores.filter(e => e.functionGroup === 'SUPERVISOR');
  const tsts = colaboradores.filter(e => e.functionGroup === 'TECHNICIAN');
  
  const anos = [2026, 2027, 2028];
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const mapRoleToDisplay = (role: string) => {
    switch (role) {
      case 'SSMA_MANAGER': return 'Gerente de SSMA';
      case 'SSMA_REGIONAL_MANAGER': return 'Gerente Regional';
      case 'SSMA_SITE_MANAGER': return 'Engenheiro de Obra';
      case 'SSMA_SUPERVISOR': return 'Supervisor de SSMA';
      case 'SSMA_TECHNICIAN': return 'Técnico de Segurança';
      case 'SSMA_FOREMAN': return 'Encarregado';
      case 'Gerente de SSMA':
      case 'Gerente Regional':
      case 'Engenheiro de Obra':
      case 'Supervisor de SSMA':
      case 'Técnico de Segurança':
      case 'Encarregado':
        return role;
      default: return 'Visualizador';
    }
  };

  const rawRole = profile?.modules?.ssma?.role || '';
  const loggedUser = {
      name: profile?.displayName || '',
      role: mapRoleToDisplay(rawRole),
  } as any;

  const onAdd = async (newRecord: any) => { await ssmaInspectionService.create(newRecord, profile as any); refetch(); };
  const onUpdate = async (updatedRecord: any) => { await ssmaInspectionService.update(updatedRecord.id, updatedRecord, profile as any); refetch(); };
  const onDelete = async (id: string) => { 
    await ssmaInspectionService.delete(id, profile as any);
    refetch(); 
  };


const PRESET_PHOTOS: any[] = [];
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SSMAInspection | null>(null);
  const [editingEvidence, setEditingEvidence] = useState<any | null>(null);
  const [viewingLaunch, setViewingLaunch] = useState<any | null>(null);
  const [detailedViewRecord, setDetailedViewRecord] = useState<SSMAInspection | null>(null);

  // Evidence Modal States
  const [evidenceRecord, setEvidenceRecord] = useState<SSMAInspection | null>(null);
  const [novoTipo, setNovoTipo] = useState<'IFS' | 'Alojamento'>('IFS');
  const [novoComentario, setNovoComentario] = useState<string>('');
  const [novaFotoUrl, setNovaFotoUrl] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');

  const isAllowedToEditMonthly = ['Engenheiro de Obra', 'Supervisor de SSMA', 'Técnico de Segurança', 'Encarregado', 'Gerente de SSMA', 'Gerente Regional'].includes(loggedUser.role);

  const openEvidenciasModal = (record: SSMAInspection) => {
    setEvidenceRecord(record);
    setNovoTipo('IFS');
    setNovoComentario('');
    setNovaFotoUrl('');
    setUploadError('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setUploadError('A imagem deve ter menos de 2MB para salvar localmente.');
        return;
      }
      setUploadError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setNovaFotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceRecord) return;
    if (!novoComentario.trim()) return;

    const novaEv: SSMAInspecaoEvidencia = {
      id: 'ev-' + Date.now(),
      tipo: novoTipo,
      data: new Date().toISOString().split('T')[0],
      executorRole: loggedUser.role as 'Engenheiro de Obra' | 'Supervisor de SSMA' | 'Técnico de Segurança' | 'Encarregado',
      executorNome: loggedUser.name,
      comentario: novoComentario,
      fotoUrl: novaFotoUrl || PRESET_PHOTOS[0].url
    };

    const updatedEvidencias = [...(evidenceRecord.evidencias || []), novaEv];

    // Auto-increment the corresponding fields in the monthly summary record!
    let {
      realizadoGestorIFS,
      realizadoGestorAlojamento,
      realizadoEncarregadoIFS,
      realizadoEncarregadoAlojamento,
      realizadoSupssmaIFS,
      realizadoSupssmaAlojamento,
      realizadoTstIFS,
      realizadoTstAlojamento
    } = evidenceRecord;

    if (loggedUser.role === 'Engenheiro de Obra') {
      if (novoTipo === 'IFS') realizadoGestorIFS += 1;
      else realizadoGestorAlojamento += 1;
    } else if (loggedUser.role === 'Supervisor de SSMA') {
      if (novoTipo === 'IFS') realizadoSupssmaIFS += 1;
      else realizadoSupssmaAlojamento += 1;
    } else if (loggedUser.role === 'Técnico de Segurança') {
      if (novoTipo === 'IFS') realizadoTstIFS += 1;
      else realizadoTstAlojamento += 1;
    } else if (loggedUser.role === 'Encarregado') {
      if (novoTipo === 'IFS') realizadoEncarregadoIFS += 1;
      else realizadoEncarregadoAlojamento += 1;
    }

    const updatedRecord = calculateInspecoesFields({
      ...evidenceRecord,
      realizadoGestorIFS,
      realizadoGestorAlojamento,
      realizadoEncarregadoIFS,
      realizadoEncarregadoAlojamento,
      realizadoSupssmaIFS,
      realizadoSupssmaAlojamento,
      realizadoTstIFS,
      realizadoTstAlojamento,
      evidencias: updatedEvidencias
    }, colaboradores);

    onUpdate(updatedRecord);
    setEvidenceRecord(updatedRecord);
    setNovoComentario('');
  };

  const handleDeleteEvidence = (evId: string) => {
    if (!evidenceRecord) return;
    if (!window.confirm('Deseja realmente remover esta evidência fotográfica?')) return;

    const targetEv = evidenceRecord.evidencias?.find(e => e.id === evId);
    if (!targetEv) return;

    const updatedEvidencias = (evidenceRecord.evidencias || []).filter(e => e.id !== evId);

    // Auto-decrement corresponding monthly field
    let {
      realizadoGestorIFS,
      realizadoGestorAlojamento,
      realizadoEncarregadoIFS,
      realizadoEncarregadoAlojamento,
      realizadoSupssmaIFS,
      realizadoSupssmaAlojamento,
      realizadoTstIFS,
      realizadoTstAlojamento
    } = evidenceRecord;

    if (targetEv.executorRole === 'Engenheiro de Obra') {
      if (targetEv.tipo === 'IFS') realizadoGestorIFS = Math.max(0, realizadoGestorIFS - 1);
      else realizadoGestorAlojamento = Math.max(0, realizadoGestorAlojamento - 1);
    } else if (targetEv.executorRole === 'Supervisor de SSMA') {
      if (targetEv.tipo === 'IFS') realizadoSupssmaIFS = Math.max(0, realizadoSupssmaIFS - 1);
      else realizadoSupssmaAlojamento = Math.max(0, realizadoSupssmaAlojamento - 1);
    } else if (targetEv.executorRole === 'Técnico de Segurança') {
      if (targetEv.tipo === 'IFS') realizadoTstIFS = Math.max(0, realizadoTstIFS - 1);
      else realizadoTstAlojamento = Math.max(0, realizadoTstAlojamento - 1);
    } else if (targetEv.executorRole === 'Encarregado') {
      if (targetEv.tipo === 'IFS') realizadoEncarregadoIFS = Math.max(0, realizadoEncarregadoIFS - 1);
      else realizadoEncarregadoAlojamento = Math.max(0, realizadoEncarregadoAlojamento - 1);
    }

    const updatedRecord = calculateInspecoesFields({
      ...evidenceRecord,
      realizadoGestorIFS,
      realizadoGestorAlojamento,
      realizadoEncarregadoIFS,
      realizadoEncarregadoAlojamento,
      realizadoSupssmaIFS,
      realizadoSupssmaAlojamento,
      realizadoTstIFS,
      realizadoTstAlojamento,
      evidencias: updatedEvidencias
    });

    onUpdate(updatedRecord);
    setEvidenceRecord(updatedRecord);
  };

  const getFlatLaunches = () => {
    const flatLaunches: any[] = [];
    inspecoes.forEach((item) => {
      if (item.evidencias && item.evidencias.length > 0) {
        item.evidencias.forEach((ev) => {
          flatLaunches.push({
            id: ev.id,
            parentInspecaoId: item.id,
            ano: item.ano,
            mes: item.mes,
            cc: item.cc,
            data: ev.data,
            tipo: ev.tipo,
            executorRole: ev.executorRole,
            executorNome: ev.executorNome,
            comentario: ev.comentario,
            fotoUrls: ev.fotoUrls || [ev.fotoUrl].filter(Boolean),
            isSynthesized: false,
          });
        });
      } else {
        // Synthesize virtual launches for historical items that lack explicit evidences
        let addedAny = false;
        
        // Gestor
        if (item.realizadoGestorIFS > 0 || item.realizadoGestorAlojamento > 0) {
          flatLaunches.push({
            id: `synth-gest-${item.id}`,
            parentInspecaoId: item.id,
            ano: item.ano,
            mes: item.mes,
            cc: item.cc,
            data: `${item.ano}-${item.mes === 'Janeiro' ? '01' : item.mes === 'Fevereiro' ? '02' : item.mes === 'Março' ? '03' : item.mes === 'Abril' ? '04' : item.mes === 'Maio' ? '05' : item.mes === 'Junho' ? '06' : item.mes === 'Julho' ? '07' : item.mes === 'Agosto' ? '08' : item.mes === 'Setembro' ? '09' : item.mes === 'Outubro' ? '10' : item.mes === 'Novembro' ? '11' : '12'}-10`,
            tipo: item.realizadoGestorIFS > 0 ? 'IFS' : 'Alojamento',
            executorRole: 'Engenheiro de Obra',
            executorNome: item.gestor,
            comentario: `Inspeção de rotina realizada pelo Engenheiro de Obra (${item.gestor}).`,
            fotoUrls: ['https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=600&auto=format&fit=crop'],
            isSynthesized: true,
            synthRole: 'Engenheiro de Obra',
          });
          addedAny = true;
        }

        // Supervisor SSMA
        if (item.realizadoSupssmaIFS > 0 || item.realizadoSupssmaAlojamento > 0) {
          flatLaunches.push({
            id: `synth-sup-${item.id}`,
            parentInspecaoId: item.id,
            ano: item.ano,
            mes: item.mes,
            cc: item.cc,
            data: `${item.ano}-${item.mes === 'Janeiro' ? '01' : item.mes === 'Fevereiro' ? '02' : item.mes === 'Março' ? '03' : item.mes === 'Abril' ? '04' : item.mes === 'Maio' ? '05' : item.mes === 'Junho' ? '06' : item.mes === 'Julho' ? '07' : item.mes === 'Agosto' ? '08' : item.mes === 'Setembro' ? '09' : item.mes === 'Outubro' ? '10' : item.mes === 'Novembro' ? '11' : '12'}-12`,
            tipo: item.realizadoSupssmaIFS > 0 ? 'IFS' : 'Alojamento',
            executorRole: 'Supervisor de SSMA',
            executorNome: item.supssma,
            comentario: `Vistoria de SSMA realizada pela supervisão de campo (${item.supssma}).`,
            fotoUrls: ['https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600&auto=format&fit=crop'],
            isSynthesized: true,
            synthRole: 'Supervisor de SSMA',
          });
          addedAny = true;
        }

        // TST
        if (item.realizadoTstIFS > 0 || item.realizadoTstAlojamento > 0) {
          flatLaunches.push({
            id: `synth-tst-${item.id}`,
            parentInspecaoId: item.id,
            ano: item.ano,
            mes: item.mes,
            cc: item.cc,
            data: `${item.ano}-${item.mes === 'Janeiro' ? '01' : item.mes === 'Fevereiro' ? '02' : item.mes === 'Março' ? '03' : item.mes === 'Abril' ? '04' : item.mes === 'Maio' ? '05' : item.mes === 'Junho' ? '06' : item.mes === 'Julho' ? '07' : item.mes === 'Agosto' ? '08' : item.mes === 'Setembro' ? '09' : item.mes === 'Outubro' ? '10' : item.mes === 'Novembro' ? '11' : '12'}-15`,
            tipo: item.realizadoTstIFS > 0 ? 'IFS' : 'Alojamento',
            executorRole: 'Técnico de Segurança',
            executorNome: item.tst,
            comentario: `Inspeção diária detalhada executada pelo TST (${item.tst}).`,
            fotoUrls: ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=600&auto=format&fit=crop'],
            isSynthesized: true,
            synthRole: 'Técnico de Segurança',
          });
          addedAny = true;
        }

        // Encarregado
        if (item.realizadoEncarregadoIFS > 0 || item.realizadoEncarregadoAlojamento > 0) {
          flatLaunches.push({
            id: `synth-enc-${item.id}`,
            parentInspecaoId: item.id,
            ano: item.ano,
            mes: item.mes,
            cc: item.cc,
            data: `${item.ano}-${item.mes === 'Janeiro' ? '01' : item.mes === 'Fevereiro' ? '02' : item.mes === 'Março' ? '03' : item.mes === 'Abril' ? '04' : item.mes === 'Maio' ? '05' : item.mes === 'Junho' ? '06' : item.mes === 'Julho' ? '07' : item.mes === 'Agosto' ? '08' : item.mes === 'Setembro' ? '09' : item.mes === 'Outubro' ? '10' : item.mes === 'Novembro' ? '11' : '12'}-20`,
            tipo: item.realizadoEncarregadoIFS > 0 ? 'IFS' : 'Alojamento',
            executorRole: 'Encarregado',
            executorNome: item.encarregado,
            comentario: `Controle periódico de campo realizado pelo Encarregado (${item.encarregado}).`,
            fotoUrls: ['https://images.unsplash.com/photo-1590186856401-00d99616c68a?q=80&w=600&auto=format&fit=crop'],
            isSynthesized: true,
            synthRole: 'Encarregado',
          });
          addedAny = true;
        }

        if (!addedAny) {
          flatLaunches.push({
            id: `synth-def-${item.id}`,
            parentInspecaoId: item.id,
            ano: item.ano,
            mes: item.mes,
            cc: item.cc,
            data: `${item.ano}-${item.mes === 'Janeiro' ? '01' : item.mes === 'Fevereiro' ? '02' : item.mes === 'Março' ? '03' : item.mes === 'Abril' ? '04' : item.mes === 'Maio' ? '05' : '06'}-15`,
            tipo: 'IFS',
            executorRole: 'Engenheiro de Obra',
            executorNome: item.gestor,
            comentario: `Inspeção de rotina registrada para o período de ${item.mes}/${item.ano}.`,
            fotoUrls: ['https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=600&auto=format&fit=crop'],
            isSynthesized: true,
            synthRole: 'Engenheiro de Obra',
          });
        }
      }
    });

    // Sort by date descending
    return flatLaunches.sort((a, b) => b.data.localeCompare(a.data));
  };

  // Form Fields State
  const [ano, setAno] = useState<number>(2026);
  const [mes, setMes] = useState<string>('Janeiro');
  const [cc, setCc] = useState<string>('');
  const [greg, setGreg] = useState<string>('');
  const [gestor, setGestor] = useState<string>('');
  const [encarregado, setEncarregado] = useState<string>('');
  const [supssma, setSupssma] = useState<string>('');
  const [tst, setTst] = useState<string>('');
  const [qtdeRdo, setQtdeRdo] = useState<number>(20);

  // Individual Launch State
  const [dataCadastro, setDataCadastro] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedRegional, setSelectedRegional] = useState<string>('');
  const [selectedObra, setSelectedObra] = useState<string>('');
  const [tipoLancamento, setTipoLancamento] = useState<'IFS' | 'Alojamento'>('IFS');
  const [comentario, setComentario] = useState<string>('');
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [simulatedRole, setSimulatedRole] = useState<'Gerente Regional' | 'Engenheiro de Obra' | 'Supervisor de SSMA' | 'Técnico de Segurança' | 'Encarregado'>('Engenheiro de Obra');

  // Dynamic derivations based on selected Cost Center (retained for fallback / compatibility if needed)
  const currentCC = costCenters.find((item) => item.code === cc);

  const filteredGestoresOptions = currentCC && currentCC.engenheiroId
    ? colaboradores.filter((c) => c.id === currentCC.engenheiroId)
    : gestores;

  const filteredSupervisoresOptions = currentCC && currentCC.supervisorId
    ? colaboradores.filter((c) => c.id === currentCC.supervisorId)
    : supervisores;

  const filteredTstOptions = currentCC && currentCC.tstIds && currentCC.tstIds.length > 0
    ? colaboradores.filter((c) => currentCC.tstIds?.includes(c.id))
    : tsts;

  const filteredEncarregadosOptions = currentCC && currentCC.encarregadoIds && currentCC.encarregadoIds.length > 0
    ? colaboradores.filter((c) => currentCC.encarregadoIds?.includes(c.id))
    : encarregados;

  const handleCcChange = (selectedCcCodigo: string) => {
    setCc(selectedCcCodigo);
    const selectedCC = costCenters.find((item) => item.code === selectedCcCodigo);
    if (selectedCC) {
      const reg = regionals.find((r) => r.id === selectedCC.regionalId);
      setGreg(reg ? reg.name : '');
      const eng = colaboradores.find((c) => c.id === selectedCC.engenheiroId);
      setGestor(eng ? eng.name : '');
      const sup = colaboradores.find((c) => c.id === selectedCC.supervisorId);
      setSupssma(sup ? sup.name : '');
      const assignedTstIds = selectedCC.tstIds || [];
      const assignedTsts = colaboradores.filter((c) => assignedTstIds.includes(c.id));
      setTst(assignedTsts.length > 0 ? assignedTsts[0].name : '');
      const assignedEncarregadoIds = selectedCC.encarregadoIds || [];
      const assignedEncarregados = colaboradores.filter((c) => assignedEncarregadoIds.includes(c.id));
      setEncarregado(assignedEncarregados.length > 0 ? assignedEncarregados[0].name : '');
    }
  };

  // Realizados (retained for compatibility if editing monthly consolidated logs is ever done)
  const [realGestorIFS, setRealGestorIFS] = useState<number>(0);
  const [realGestorAloj, setRealGestorAloj] = useState<number>(0);
  const [realEncarIFS, setRealEncarIFS] = useState<number>(0);
  const [realEncarAloj, setRealEncarAloj] = useState<number>(0);
  const [realSupIFS, setRealSupIFS] = useState<number>(0);
  const [realSupAloj, setRealSupAloj] = useState<number>(0);
  const [realTstIFS, setRealTstIFS] = useState<number>(0);
  const [realTstAloj, setRealTstAloj] = useState<number>(0);

  const resetForm = () => {
    setEditingRecord(null);
    setAno(anos[anos.length - 1] || 2026);
    setMes(meses[0] || 'Janeiro');
    setCc(costCenters[0]?.code || '');
    setGreg(regionals[0]?.name || '');
    setGestor(gestores[0]?.name || '');
    setEncarregado(encarregados[0]?.name || '');
    setSupssma(supervisores[0]?.name || '');
    setTst(tsts[0]?.name || '');
    setQtdeRdo(20);
    setRealGestorIFS(0);
    setRealGestorAloj(0);
    setRealEncarIFS(0);
    setRealEncarAloj(0);
    setRealSupIFS(0);
    setRealSupAloj(0);
    setRealTstIFS(0);
    setRealTstAloj(0);
  };

  const openAddForm = () => {
    resetForm();
    setDataCadastro(new Date().toISOString().split('T')[0]);
    
    // Default simulated role
    const defaultSimRole = ['Gerente Regional', 'Engenheiro de Obra', 'Supervisor de SSMA', 'Técnico de Segurança', 'Encarregado'].includes(loggedUser.role)
      ? loggedUser.role as any
      : 'Engenheiro de Obra';
    setSimulatedRole(defaultSimRole);
    
    // Set default regional based on logged user or first regional
    const userColab = colaboradores.find(c => c.name.toLowerCase().trim() === loggedUser.name.toLowerCase().trim());
    const regDefault = regionals.find(r => r.responsavelId === userColab?.id) || regionals[0];
    setSelectedRegional(regDefault?.name || '');
    
    // Set default obra based on first governed cost center
    setSelectedObra(costCenters[0]?.code || '');
    
    setTipoLancamento('IFS');
    setComentario('');
    setSelectedPhotos([]);
    setUploadError('');
    setIsFormOpen(true);
  };

  const openEditFormForLaunch = (launch: any) => {
    setEditingEvidence(launch);
    setEditingRecord(null);
    setDataCadastro(launch.data);
    setSelectedObra(launch.cc);
    setSelectedRegional(launch.greg);
    setTipoLancamento(launch.tipo);
    setComentario(launch.comentario);
    setSelectedPhotos(launch.fotoUrls || []);
    setSimulatedRole(launch.executorRole);
    setUploadError('');
    setIsFormOpen(true);
  };

  const handleDeleteLaunch = (launch: any) => {
    if (!window.confirm('Deseja realmente excluir este lançamento de inspeção?')) return;

    const parentRecord = inspecoes.find(item => item.id === launch.parentInspecaoId);
    if (!parentRecord) return;

    let {
      realizadoGestorIFS,
      realizadoGestorAlojamento,
      realizadoEncarregadoIFS,
      realizadoEncarregadoAlojamento,
      realizadoSupssmaIFS,
      realizadoSupssmaAlojamento,
      realizadoTstIFS,
      realizadoTstAlojamento
    } = parentRecord;

    const oldType = launch.tipo;
    const oldRole = launch.executorRole;

    if (oldRole === 'Engenheiro de Obra' || oldRole === 'Gerente Regional') {
      if (oldType === 'IFS') realizadoGestorIFS = Math.max(0, realizadoGestorIFS - 1);
      else realizadoGestorAlojamento = Math.max(0, realizadoGestorAlojamento - 1);
    } else if (oldRole === 'Supervisor de SSMA') {
      if (oldType === 'IFS') realizadoSupssmaIFS = Math.max(0, realizadoSupssmaIFS - 1);
      else realizadoSupssmaAlojamento = Math.max(0, realizadoSupssmaAlojamento - 1);
    } else if (oldRole === 'Técnico de Segurança') {
      if (oldType === 'IFS') realizadoTstIFS = Math.max(0, realizadoTstIFS - 1);
      else realizadoTstAlojamento = Math.max(0, realizadoTstAlojamento - 1);
    } else if (oldRole === 'Encarregado') {
      if (oldType === 'IFS') realizadoEncarregadoIFS = Math.max(0, realizadoEncarregadoIFS - 1);
      else realizadoEncarregadoAlojamento = Math.max(0, realizadoEncarregadoAlojamento - 1);
    }

    const updatedEvidencias = (parentRecord.evidencias || []).filter(e => e.id !== launch.id);

    const updatedRecord = calculateInspecoesFields({
      ...parentRecord,
      realizadoGestorIFS,
      realizadoGestorAlojamento,
      realizadoEncarregadoIFS,
      realizadoEncarregadoAlojamento,
      realizadoSupssmaIFS,
      realizadoSupssmaAlojamento,
      realizadoTstIFS,
      realizadoTstAlojamento,
      evidencias: updatedEvidencias
    }, colaboradores);

    onUpdate(updatedRecord);
  };

  const openEditForm = (record: SSMAInspection) => {
    setEditingRecord(record);
    setEditingEvidence(null);
    setAno(record.ano);
    setMes(record.mes);
    setCc(record.cc);
    setGreg(record.greg);
    setGestor(record.gestor);
    setEncarregado(record.encarregado);
    setSupssma(record.supssma);
    setTst(record.tst);
    setQtdeRdo(record.qtdeRdo);
    setRealGestorIFS(record.realizadoGestorIFS);
    setRealGestorAloj(record.realizadoGestorAlojamento);
    setRealEncarIFS(record.realizadoEncarregadoIFS);
    setRealEncarAloj(record.realizadoEncarregadoAlojamento);
    setRealSupIFS(record.realizadoSupssmaIFS);
    setRealSupAloj(record.realizadoSupssmaAlojamento);
    setRealTstIFS(record.realizadoTstIFS);
    setRealTstAloj(record.realizadoTstAlojamento);
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingEvidence) {
      const parentRecord = inspecoes.find(item => item.id === editingEvidence.parentInspecaoId);
      if (!parentRecord) return;

      const activeRole = ['Gerente Regional', 'Engenheiro de Obra', 'Supervisor de SSMA', 'Técnico de Segurança', 'Encarregado'].includes(loggedUser.role)
        ? loggedUser.role
        : simulatedRole;

      let {
        realizadoGestorIFS,
        realizadoGestorAlojamento,
        realizadoEncarregadoIFS,
        realizadoEncarregadoAlojamento,
        realizadoSupssmaIFS,
        realizadoSupssmaAlojamento,
        realizadoTstIFS,
        realizadoTstAlojamento
      } = parentRecord;

      // 1. Decrement old role contribution
      const oldType = editingEvidence.tipo;
      const oldRole = editingEvidence.executorRole;

      if (oldRole === 'Engenheiro de Obra' || oldRole === 'Gerente Regional') {
        if (oldType === 'IFS') realizadoGestorIFS = Math.max(0, realizadoGestorIFS - 1);
        else realizadoGestorAlojamento = Math.max(0, realizadoGestorAlojamento - 1);
      } else if (oldRole === 'Supervisor de SSMA') {
        if (oldType === 'IFS') realizadoSupssmaIFS = Math.max(0, realizadoSupssmaIFS - 1);
        else realizadoSupssmaAlojamento = Math.max(0, realizadoSupssmaAlojamento - 1);
      } else if (oldRole === 'Técnico de Segurança') {
        if (oldType === 'IFS') realizadoTstIFS = Math.max(0, realizadoTstIFS - 1);
        else realizadoTstAlojamento = Math.max(0, realizadoTstAlojamento - 1);
      } else if (oldRole === 'Encarregado') {
        if (oldType === 'IFS') realizadoEncarregadoIFS = Math.max(0, realizadoEncarregadoIFS - 1);
        else realizadoEncarregadoAlojamento = Math.max(0, realizadoEncarregadoAlojamento - 1);
      }

      // 2. Increment new role contribution
      const newType = tipoLancamento;
      const newRole = activeRole;

      if (newRole === 'Engenheiro de Obra' || newRole === 'Gerente Regional') {
        if (newType === 'IFS') realizadoGestorIFS += 1;
        else realizadoGestorAlojamento += 1;
      } else if (newRole === 'Supervisor de SSMA') {
        if (newType === 'IFS') realizadoSupssmaIFS += 1;
        else realizadoSupssmaAlojamento += 1;
      } else if (newRole === 'Técnico de Segurança') {
        if (newType === 'IFS') realizadoTstIFS += 1;
        else realizadoTstAlojamento += 1;
      } else if (newRole === 'Encarregado') {
        if (newType === 'IFS') realizadoEncarregadoIFS += 1;
        else realizadoEncarregadoAlojamento += 1;
      }

      // 3. Update or Add the evidence object
      const updatedEv = {
        id: editingEvidence.isSynthesized ? ('ev-' + Date.now()) : editingEvidence.id,
        tipo: newType,
        data: dataCadastro,
        executorRole: newRole as any,
        executorNome: editingEvidence.executorNome, // preserve original
        comentario: comentario,
        fotoUrl: selectedPhotos[0] || PRESET_PHOTOS[0].url,
        fotoUrls: selectedPhotos.length > 0 ? selectedPhotos : [PRESET_PHOTOS[0].url]
      };

      let updatedEvidencias = [...(parentRecord.evidencias || [])];
      if (editingEvidence.isSynthesized) {
        updatedEvidencias.push(updatedEv);
      } else {
        updatedEvidencias = updatedEvidencias.map(e => e.id === editingEvidence.id ? updatedEv : e);
      }

      const updatedRecord = calculateInspecoesFields({
        ...parentRecord,
        realizadoGestorIFS,
        realizadoGestorAlojamento,
        realizadoEncarregadoIFS,
        realizadoEncarregadoAlojamento,
        realizadoSupssmaIFS,
        realizadoSupssmaAlojamento,
        realizadoTstIFS,
        realizadoTstAlojamento,
        evidencias: updatedEvidencias
      });

      onUpdate(updatedRecord);
      setIsFormOpen(false);
      setEditingEvidence(null);
      resetForm();
      return;
    }

    if (editingRecord) {
      // Direct consolidated monthly edit
      const rawData = {
        id: editingRecord.id,
        ano,
        mes,
        cc,
        greg,
        gestor,
        encarregado,
        supssma,
        tst,
        qtdeRdo: Number(qtdeRdo),
        realizadoGestorIFS: Number(realGestorIFS),
        realizadoGestorAlojamento: Number(realGestorAloj),
        realizadoEncarregadoIFS: Number(realEncarIFS),
        realizadoEncarregadoAlojamento: Number(realEncarAloj),
        realizadoSupssmaIFS: Number(realSupIFS),
        realizadoSupssmaAlojamento: Number(realSupAloj),
        realizadoTstIFS: Number(realTstIFS),
        realizadoTstAlojamento: Number(realTstAloj),
        evidencias: editingRecord.evidencias
      };
      const calculated = calculateInspecoesFields(rawData, colaboradores);
      onUpdate(calculated);
      setIsFormOpen(false);
      resetForm();
      return;
    }

    // NEW INDIVIDUAL LAUNCH
    const activeRole = ['Gerente Regional', 'Engenheiro de Obra', 'Supervisor de SSMA', 'Técnico de Segurança', 'Encarregado'].includes(loggedUser.role)
      ? loggedUser.role
      : simulatedRole;

    const dateObj = new Date(dataCadastro + 'T12:00:00'); // Use noon to avoid timezone shift
    const year = isNaN(dateObj.getTime()) ? 2026 : dateObj.getFullYear();
    const monthIndex = isNaN(dateObj.getTime()) ? 0 : dateObj.getMonth();
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthName = monthNames[monthIndex] || 'Janeiro';

    let ccObj: SSMACostCenter | undefined;

    if (activeRole === 'Gerente Regional') {
      const reg = regionals.find(r => r.name === selectedRegional);
      if (reg) {
        ccObj = costCenters.find(cc => cc.regionalId === reg.id) || costCenters[0];
      } else {
        ccObj = costCenters[0];
      }
    } else {
      ccObj = costCenters.find(cc => cc.code === selectedObra);
    }

    if (!ccObj) {
      alert('Selecione uma obra ou regional válida.');
      return;
    }

    let record = inspecoes.find(
      (item) => item.ano === year && item.mes === monthName && item.cc === ccObj?.code
    );

    const newEv: SSMAInspecaoEvidencia = {
      id: 'ev-' + Date.now(),
      tipo: tipoLancamento,
      data: dataCadastro,
      executorRole: activeRole as any,
      executorNome: loggedUser.name,
      comentario: comentario,
      fotoUrl: selectedPhotos[0] || '',
      fotoUrls: selectedPhotos.length > 0 ? selectedPhotos : []
    };

    if (record) {
      const updatedEvidencias = [...(record.evidencias || []), newEv];

      let {
        realizadoGestorIFS,
        realizadoGestorAlojamento,
        realizadoEncarregadoIFS,
        realizadoEncarregadoAlojamento,
        realizadoSupssmaIFS,
        realizadoSupssmaAlojamento,
        realizadoTstIFS,
        realizadoTstAlojamento
      } = record;

      if (activeRole === 'Engenheiro de Obra') {
        if (tipoLancamento === 'IFS') realizadoGestorIFS += 1;
        else realizadoGestorAlojamento += 1;
      } else if (activeRole === 'Supervisor de SSMA') {
        if (tipoLancamento === 'IFS') realizadoSupssmaIFS += 1;
        else realizadoSupssmaAlojamento += 1;
      } else if (activeRole === 'Técnico de Segurança') {
        if (tipoLancamento === 'IFS') realizadoTstIFS += 1;
        else realizadoTstAlojamento += 1;
      } else if (activeRole === 'Encarregado') {
        if (tipoLancamento === 'IFS') realizadoEncarregadoIFS += 1;
        else realizadoEncarregadoAlojamento += 1;
      } else if (activeRole === 'Gerente Regional') {
        if (tipoLancamento === 'IFS') realizadoGestorIFS += 1;
        else realizadoGestorAlojamento += 1;
      }

      const updatedRecord = calculateInspecoesFields({
        ...record,
        realizadoGestorIFS,
        realizadoGestorAlojamento,
        realizadoEncarregadoIFS,
        realizadoEncarregadoAlojamento,
        realizadoSupssmaIFS,
        realizadoSupssmaAlojamento,
        realizadoTstIFS,
        realizadoTstAlojamento,
        evidencias: updatedEvidencias
      }, colaboradores);

      onUpdate(updatedRecord);
    } else {
      const regionalObj = regionals.find(r => r.id === ccObj?.regionalId);
      const engCol = colaboradores.find(c => c.id === ccObj?.engenheiroId || c.uid === ccObj?.engenheiroId);
      const supCol = colaboradores.find(c => c.id === ccObj?.supervisorId || c.uid === ccObj?.supervisorId);
      const tstCol = ccObj?.tstIds && ccObj.tstIds.length > 0 ? colaboradores.find(c => c.id === ccObj?.tstIds?.[0] || c.uid === ccObj?.tstIds?.[0]) : undefined;
      const encCol = ccObj?.encarregadoIds && ccObj.encarregadoIds.length > 0 ? colaboradores.find(c => c.id === ccObj?.encarregadoIds?.[0] || c.uid === ccObj?.encarregadoIds?.[0]) : undefined;

      const rawNew = {
        id: 'insp-' + Date.now(),
        ano: year,
        mes: monthName,
        cc: ccObj.code,
        greg: regionalObj?.name || 'GREG Norte',
        gestor: engCol?.name || 'Não atribuído',
        encarregado: encCol?.name || 'Não atribuído',
        supssma: supCol?.name || 'Não atribuído',
        tst: tstCol?.name || 'Não atribuído',
        qtdeRdo: 20,
        realizadoGestorIFS: 0,
        realizadoGestorAlojamento: 0,
        realizadoEncarregadoIFS: 0,
        realizadoEncarregadoAlojamento: 0,
        realizadoSupssmaIFS: 0,
        realizadoSupssmaAlojamento: 0,
        realizadoTstIFS: 0,
        realizadoTstAlojamento: 0,
        evidencias: [newEv]
      };

      // Override the name field for the executor's own role with their actual name
      if (activeRole === 'Engenheiro de Obra' || activeRole === 'Gerente Regional') {
        rawNew.gestor = loggedUser.name;
      } else if (activeRole === 'Supervisor de SSMA') {
        rawNew.supssma = loggedUser.name;
      } else if (activeRole === 'Técnico de Segurança') {
        rawNew.tst = loggedUser.name;
      } else if (activeRole === 'Encarregado') {
        rawNew.encarregado = loggedUser.name;
      }

      if (activeRole === 'Engenheiro de Obra') {
        if (tipoLancamento === 'IFS') rawNew.realizadoGestorIFS = 1;
        else rawNew.realizadoGestorAlojamento = 1;
      } else if (activeRole === 'Supervisor de SSMA') {
        if (tipoLancamento === 'IFS') rawNew.realizadoSupssmaIFS = 1;
        else rawNew.realizadoSupssmaAlojamento = 1;
      } else if (activeRole === 'Técnico de Segurança') {
        if (tipoLancamento === 'IFS') rawNew.realizadoTstIFS = 1;
        else rawNew.realizadoTstAlojamento = 1;
      } else if (activeRole === 'Encarregado') {
        if (tipoLancamento === 'IFS') rawNew.realizadoEncarregadoIFS = 1;
        else rawNew.realizadoEncarregadoAlojamento = 1;
      } else if (activeRole === 'Gerente Regional') {
        if (tipoLancamento === 'IFS') rawNew.realizadoGestorIFS = 1;
        else rawNew.realizadoGestorAlojamento = 1;
      }

      const calculated = calculateInspecoesFields(rawNew, colaboradores);
      onAdd(calculated);
    }

    setIsFormOpen(false);
  };

  return (
    <div className="space-y-6" id="inspecoes-tab">
      {/* Alerta de Permissão Simulado */}
      {!isAllowedToEditMonthly && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-2.5 shadow-xs animate-fade-in" id="permissao-warning">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 animate-pulse" />
          <div>
            <strong className="block font-black">Modo de Acesso: Apenas Visualização ({loggedUser.role})</strong>
            Lançamentos consolidados mensais de metas e realizados só podem ser incluídos ou alterados por perfis executores: <em className="underline font-bold text-brand-ink">Gerente de SSMA, Engenheiro de Obra, Supervisor de SSMA, Técnico de Segurança e Encarregado</em>.
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-brand-ink tracking-tight">Lançamentos de Inspeção</h3>
        </div>
        <button
          onClick={isAllowedToEditMonthly ? openAddForm : undefined}
          disabled={!isAllowedToEditMonthly}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 font-bold text-sm rounded-xl transition shadow-xs ${
            isAllowedToEditMonthly
              ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
          }`}
          id="btn-novo-lancamento"
        >
          {isAllowedToEditMonthly ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          Novo Lançamento
        </button>
      </div>

      {/* Tabela de Lançamentos */}
      <div className="bg-white rounded-2xl border border-brand-border shadow-xs overflow-hidden" id="tabela-inspecoes-container">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="tabela-inspecoes">
            <thead>
              <tr className="bg-brand-bg border-b border-brand-border text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-5">Período</th>
                <th className="py-4 px-5">Responsável pelo cadastro</th>
                <th className="py-4 px-5">Tipo do Lançamento</th>
                <th className="py-4 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border text-sm text-slate-700">
              {getFlatLaunches().length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 font-semibold">
                    Nenhum lançamento registrado ou correspondente aos filtros.
                  </td>
                </tr>
              ) : (
                getFlatLaunches().map((launch) => (
                  <tr key={launch.id} className="hover:bg-brand-bg/50 transition">
                    <td className="py-4 px-5">
                      <div className="font-extrabold text-brand-ink">{launch.ano} + {launch.mes}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{launch.cc}</div>
                    </td>
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-800">{launch.executorNome}</div>
                      <div className="text-xs text-slate-400 font-medium">{launch.executorRole}</div>
                    </td>
                    <td className="py-4 px-5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase ${
                        launch.tipo === 'IFS'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                      }`}>
                        {launch.tipo === 'IFS' ? 'Inspeção Frente de Serviço (IFS)' : 'Inspeção de Alojamento'}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right space-x-2">
                      <button
                        onClick={() => setViewingLaunch(launch)}
                        className="inline-flex p-1.5 hover:bg-brand-bg text-slate-500 hover:text-slate-800 rounded-lg transition cursor-pointer"
                        title="Visualizar Lançamento"
                      >
                        <Eye className="w-4.5 h-4.5" />
                      </button>

                      <button
                        onClick={() => {
                          if (isAllowedToEditMonthly) {
                            openEditFormForLaunch(launch);
                          } else {
                            alert(`Perfil de ${loggedUser.role} não possui permissão para editar lançamentos de inspeção. Altere a função simulada na barra lateral para "Técnico de Segurança", "Engenheiro de Obra", "Supervisor de SSMA" ou "Encarregado" para poder realizar edições.`);
                          }
                        }}
                        className="inline-flex p-1.5 hover:bg-brand-bg text-blue-500 hover:text-blue-800 rounded-lg transition cursor-pointer"
                        title="Editar Lançamento"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          if (isAllowedToEditMonthly) {
                            handleDeleteLaunch(launch);
                          } else {
                            alert(`Perfil de ${loggedUser.role} não possui permissão para apagar lançamentos de inspeção. Altere a função simulada na barra lateral para "Técnico de Segurança", "Engenheiro de Obra", "Supervisor de SSMA" ou "Encarregado" para poder realizar exclusões.`);
                          }
                        }}
                        className="inline-flex p-1.5 hover:bg-brand-bg text-rose-500 hover:text-rose-700 rounded-lg transition cursor-pointer"
                        title="Excluir Lançamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal / Overlay Formulário de Cadastro/Edição */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" id="modal-formulario-inspecoes">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-3xl flex flex-col max-h-[95vh] my-auto">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0 rounded-t-2xl">
              <h4 className="text-base font-bold text-slate-800">
                {editingRecord 
                  ? `Editar Lançamento Mensal: ${editingRecord.mes}/${editingRecord.ano}` 
                  : `Novo Lançamento de Inspeção`
                }
              </h4>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1 rounded-b-2xl">
              {editingRecord ? (
                /* Consolidated monthly record edit fallback */
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Ano</label>
                      <input type="number" value={ano} disabled className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Mês</label>
                      <input type="text" value={mes} disabled className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Obra (CC)</label>
                      <input type="text" value={cc} disabled className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm" />
                    </div>
                  </div>

                  {/* Seção 2: Responsáveis */}
                  <div>
                    <h5 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3">2. Responsáveis & Parâmetros</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Regional (GREG)</label>
                        <select
                          value={greg}
                          onChange={(e) => setGreg(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-emerald-500 text-sm bg-white"
                          required
                        >
                          <option value="">Selecione...</option>
                          {regionals.map((item) => (
                            <option key={item.id} value={item.name}>{item.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Gestor</label>
                        <select
                          value={gestor}
                          onChange={(e) => setGestor(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-emerald-500 text-sm bg-white"
                          required
                        >
                          <option value="">Selecione...</option>
                          {filteredGestoresOptions.map((item) => (
                            <option key={item.id} value={item.name}>{item.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Encarregado</label>
                        <select
                          value={encarregado}
                          onChange={(e) => setEncarregado(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-emerald-500 text-sm bg-white"
                          required
                        >
                          <option value="">Selecione...</option>
                          {filteredEncarregadosOptions.map((item) => (
                            <option key={item.id} value={item.name}>{item.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Supervisor SSMA</label>
                        <select
                          value={supssma}
                          onChange={(e) => setSupssma(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-emerald-500 text-sm bg-white"
                          required
                        >
                          <option value="">Selecione...</option>
                          {filteredSupervisoresOptions.map((item) => (
                            <option key={item.id} value={item.name}>{item.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Técnico de Segurança (TST)</label>
                        <select
                          value={tst}
                          onChange={(e) => setTst(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-emerald-500 text-sm bg-white"
                          required
                        >
                          <option value="">Selecione...</option>
                          {filteredTstOptions.map((item) => (
                            <option key={item.id} value={item.name}>{item.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                          <span>Dias Trabalhados (RDO)</span>
                          <span className="text-[10px] text-emerald-600 font-bold">*Meta Encarregado IFS</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={qtdeRdo}
                          onChange={(e) => setQtdeRdo(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-emerald-500 text-sm"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção 3: Medições de Realizado */}
                  <div>
                    <h5 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3">
                      3. Lançamento de Realizado (Quantidade de Inspeções Cumpridas)
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                      
                      {/* Gestor */}
                      <div className="border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 md:pr-4">
                        <span className="text-xs font-bold text-slate-800">GESTOR</span>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">IFS (Meta: 1)</label>
                            <input
                              type="number"
                              min={0}
                              value={realGestorIFS}
                              onChange={(e) => setRealGestorIFS(Number(e.target.value))}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">Alojamento (Meta: 1)</label>
                            <input
                              type="number"
                              min={0}
                              value={realGestorAloj}
                              onChange={(e) => setRealGestorAloj(Number(e.target.value))}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Encarregado */}
                      <div className="pb-3 md:pb-0">
                        <span className="text-xs font-bold text-slate-800">ENCARREGADO</span>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">IFS (Meta: {qtdeRdo})</label>
                            <input
                              type="number"
                              min={0}
                              value={realEncarIFS}
                              onChange={(e) => setRealEncarIFS(Number(e.target.value))}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">Alojamento (Meta: 1)</label>
                            <input
                              type="number"
                              min={0}
                              value={realEncarAloj}
                              onChange={(e) => setRealEncarAloj(Number(e.target.value))}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                            />
                          </div>
                        </div>
                      </div>

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60 mt-4">
                      
                      {/* Supervisor SSMA */}
                      <div className="border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 md:pr-4">
                        <span className="text-xs font-bold text-slate-800">SUPERVISOR SSMA</span>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">IFS (Meta: 1)</label>
                            <input
                              type="number"
                              min={0}
                              value={realSupIFS}
                              onChange={(e) => setRealSupIFS(Number(e.target.value))}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">Alojamento (Meta: 1)</label>
                            <input
                              type="number"
                              min={0}
                              value={realSupAloj}
                              onChange={(e) => setRealSupAloj(Number(e.target.value))}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* TST */}
                      <div className="pb-3 md:pb-0">
                        <span className="text-xs font-bold text-slate-800">TST</span>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">IFS (Meta: 1)</label>
                            <input
                              type="number"
                              min={0}
                              value={realTstIFS}
                              onChange={(e) => setRealTstIFS(Number(e.target.value))}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">Alojamento (Meta: 1)</label>
                            <input
                              type="number"
                              min={0}
                              value={realTstAloj}
                              onChange={(e) => setRealTstAloj(Number(e.target.value))}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                            />
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              ) : (
                /* NEW INDIVIDUAL ROLE-SPECIFIC TRANSITIONAL FORM */
                <div className="space-y-5">
                  {/* Cabeçalho do Lançamento */}
                  <div>
                    <h5 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3">1. Cabeçalho / Identificação</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Data de Cadastro</label>
                        <input
                          type="date"
                          value={dataCadastro}
                          onChange={(e) => setDataCadastro(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-emerald-500 text-sm bg-white"
                          required
                        />
                      </div>

                      {/* If the active role is Gerente Regional */}
                      {((['SSMA_REGIONAL_MANAGER', 'Gerente Regional'].includes(loggedUser.role)) ? 'Gerente Regional' : simulatedRole) === 'Gerente Regional' ? (
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Regional Atendida</label>
                          <select
                            value={selectedRegional}
                            onChange={(e) => setSelectedRegional(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-emerald-500 text-sm bg-white font-semibold"
                            required
                          >
                            <option value="">Selecione...</option>
                            {regionals.map((r) => (
                              <option key={r.id} value={r.name}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Obra / Centro de Custo</label>
                          <select
                            value={selectedObra}
                            onChange={(e) => setSelectedObra(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-emerald-500 text-sm bg-white font-semibold"
                            required
                          >
                            <option value="">Selecione...</option>
                            {costCenters.map((ccItem) => (
                              <option key={ccItem.id} value={ccItem.code}>
                                {ccItem.code} - {ccItem.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tipo de Inspeção e Comentário */}
                  <div>
                    <h5 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3">2. Escopo do Lançamento</h5>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tipo de Lançamento</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setTipoLancamento('IFS')}
                            className={`py-2.5 px-4 rounded-xl border text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              tipoLancamento === 'IFS'
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            Inspeção de Frente de Serviço (IFS)
                          </button>
                          <button
                            type="button"
                            onClick={() => setTipoLancamento('Alojamento')}
                            className={`py-2.5 px-4 rounded-xl border text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              tipoLancamento === 'Alojamento'
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            Inspeção de Alojamento
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Comentário / Relato Técnico</label>
                        <textarea
                          value={comentario}
                          onChange={(e) => setComentario(e.target.value)}
                          rows={3}
                          placeholder="Insira detalhes sobre as condições observadas, desvios apontados ou boas práticas identificadas..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-emerald-500 text-sm bg-white"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Evidências Fotográficas com Múltiplas Fotos */}
                  <div className="border-t border-slate-100 pt-4">
                    <div className="flex justify-between items-center mb-3">
                      <h5 className="text-xs font-bold text-emerald-700 uppercase tracking-wider">3. Fotos da Evidência ({selectedPhotos.length}/3)</h5>
                      <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full uppercase">Até 3 fotos</span>
                    </div>

                    {uploadError && (
                      <div className="mb-3 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2.5 animate-pulse">
                        {uploadError}
                      </div>
                    )}

                    {selectedPhotos.length > 0 && (
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        {selectedPhotos.map((pUrl, idx) => (
                          <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-50">
                            <img src={pUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <button
                              type="button"
                              onClick={() => setSelectedPhotos(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-1.5 right-1.5 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md transition cursor-pointer"
                              title="Remover Foto"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 py-0.5 px-2 text-center text-[10px] text-white truncate font-mono">
                              Foto {idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Drag & drop or Manual Selection */}
                      <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50/50 transition relative group flex flex-col items-center justify-center min-h-[110px]">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files) {
                              const remainingSlots = 3 - selectedPhotos.length;
                              if (remainingSlots <= 0) {
                                setUploadError('Você já atingiu o limite de 3 fotos.');
                                return;
                              }
                              setUploadError('');
                              const list = Array.from(files).slice(0, remainingSlots);
                              list.forEach((f: any) => {
                                if (f.size > 2 * 1024 * 1024) {
                                  setUploadError('Tamanho máximo excedido (2MB por foto).');
                                  return;
                                }
                                const r = new FileReader();
                                r.onloadend = () => {
                                  setSelectedPhotos(prev => [...prev, r.result as string].slice(0, 3));
                                };
                                r.readAsDataURL(f);
                              });
                            }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <Camera className="w-8 h-8 text-slate-400 group-hover:text-emerald-500 mb-1" />
                        <span className="text-xs font-bold text-slate-700">Selecione fotos</span>
                        <span className="text-[10px] text-slate-400">Até 3 imagens (Max 2MB cada)</span>
                      </div>

                      </div>
                    </div>
                </div>
              )}

              {/* Botões do Formulário */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Salvar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalhado de Verificação de Cálculos */}
      {detailedViewRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="modal-detalhes-calculo">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-2xl overflow-hidden my-8">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h4 className="text-base font-bold text-slate-800">Memória de Cálculo de SSMA</h4>
              </div>
              <button
                onClick={() => setDetailedViewRecord(null)}
                className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Identificação Rápida */}
              <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Período e Unidade</span>
                  <p className="text-base font-extrabold text-slate-800">{detailedViewRecord.mes} / {detailedViewRecord.ano}</p>
                  <p className="text-xs text-slate-500 font-mono">{detailedViewRecord.cc}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Resultado Global</span>
                  <p className="text-2xl font-extrabold text-slate-900">{detailedViewRecord.resultadoGeral}%</p>
                  <span className={`inline-flex items-center px-2 py-0.5 mt-0.5 rounded text-xs font-bold ${
                    detailedViewRecord.status === 'ATENDE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {detailedViewRecord.status}
                  </span>
                </div>
              </div>

              {/* Tabela de Funções */}
              <div className="space-y-4">
                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Detalhamento por Função</h5>
                
                {/* Gestor */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/40 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-500">GESTOR</span>
                    <p className="text-sm font-semibold text-slate-800">{detailedViewRecord.gestor}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      IFS: {detailedViewRecord.realizadoGestorIFS}/{detailedViewRecord.metaGestorIFS} | Aloj: {detailedViewRecord.realizadoGestorAlojamento}/{detailedViewRecord.metaGestorAlojamento}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400">Desempenho</span>
                    <p className="text-base font-bold text-slate-800">{detailedViewRecord.resultadoGestor}%</p>
                  </div>
                </div>

                {/* Encarregado */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/40 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500">ENCARREGADO</span>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 rounded">RDO = {detailedViewRecord.qtdeRdo}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{detailedViewRecord.encarregado}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      IFS: {detailedViewRecord.realizadoEncarregadoIFS}/{detailedViewRecord.metaEncarregadoIFS} | Aloj: {detailedViewRecord.realizadoEncarregadoAlojamento}/{detailedViewRecord.metaEncarregadoAlojamento}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400">Desempenho</span>
                    <p className="text-base font-bold text-slate-800">{detailedViewRecord.resultadoEncarregado}%</p>
                  </div>
                </div>

                {/* Supervisor SSMA */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/40 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-500">SUPERVISOR SSMA</span>
                    <p className="text-sm font-semibold text-slate-800">{detailedViewRecord.supssma}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      IFS: {detailedViewRecord.realizadoSupssmaIFS}/{detailedViewRecord.metaSupssmaIFS} | Aloj: {detailedViewRecord.realizadoSupssmaAlojamento}/{detailedViewRecord.metaSupssmaAlojamento}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400">Desempenho</span>
                    <p className="text-base font-bold text-slate-800">{detailedViewRecord.resultadoSupssma}%</p>
                  </div>
                </div>

                {/* TST */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/40 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-500">TÉCNICO DE SEGURANÇA (TST)</span>
                    <p className="text-sm font-semibold text-slate-800">{detailedViewRecord.tst}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      IFS: {detailedViewRecord.realizadoTstIFS}/{detailedViewRecord.metaTstIFS} | Aloj: {detailedViewRecord.realizadoTstAlojamento}/{detailedViewRecord.metaTstAlojamento}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400">Desempenho</span>
                    <p className="text-base font-bold text-slate-800">{detailedViewRecord.resultadoTst}%</p>
                  </div>
                </div>

              </div>

              {/* Nota Explicativa */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex gap-3 text-emerald-800">
                <Award className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
                <div className="text-xs space-y-1">
                  <p className="font-bold">Regra Geral de Avaliação</p>
                  <p>O resultado geral é a média aritmética simples dos quatro desempenhos de função.</p>
                  <p className="font-semibold">Exigência mínima do Dashboard: ≥ 95% para receber o selo "ATENDE".</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Painel de Evidências (Fotos e Comentários) */}
      {evidenceRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="modal-evidencias">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-4xl overflow-hidden my-8 animate-fade-in">
            {/* Header */}
            <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-700" />
                <div>
                  <h4 className="text-base font-black text-slate-800 uppercase tracking-tight">Evidências de Inspeção de Campo</h4>
                  <p className="text-[11px] text-emerald-800 font-medium">{evidenceRecord.mes} / {evidenceRecord.ano} • Centro de Custo: <strong className="font-mono">{evidenceRecord.cc}</strong></p>
                </div>
              </div>
              <button
                onClick={() => setEvidenceRecord(null)}
                className="p-1.5 hover:bg-emerald-100 rounded-lg text-emerald-700 hover:text-emerald-900 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-brand-border h-[calc(100vh-220px)] max-h-[700px] overflow-y-auto">
              {/* Left Column: Register New Evidence Form */}
              <div className="lg:col-span-5 p-6 overflow-y-auto space-y-4">
                <div className="flex items-center gap-1.5 pb-2 border-b border-brand-border">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider">Novo Registro Fotográfico</h5>
                </div>

                {isAllowedToEditMonthly ? (
                  <form onSubmit={handleAddEvidence} className="space-y-4">
                    {/* Active User Badge */}
                    <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-emerald-600 text-white flex items-center justify-center font-bold text-xs rounded-full">
                        {loggedUser.name.substring(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1 text-xs">
                        <span className="font-black text-slate-800 block truncate">{loggedUser.name}</span>
                        <span className="font-semibold text-emerald-700 block text-[10px] uppercase tracking-wider">Registrando como: {loggedUser.role}</span>
                      </div>
                    </div>

                    {/* Tipo de Lançamento */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tipo de Lançamento (SSMA)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNovoTipo('IFS')}
                          className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                            novoTipo === 'IFS'
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Frente de Serviço (IFS)
                        </button>
                        <button
                          type="button"
                          onClick={() => setNovoTipo('Alojamento')}
                          className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                            novoTipo === 'Alojamento'
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Alojamento / Hotel
                        </button>
                      </div>
                    </div>

                    {/* Image Selector: Preset vs File Upload */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Foto do Lançamento</label>
                      
                      {/* Current Preview */}
                      <div className="relative aspect-video rounded-xl bg-slate-100 border border-brand-border overflow-hidden mb-3">
                        {novaFotoUrl ? (
                          <img
                            src={novaFotoUrl}
                            alt="Previsão da Inspeção"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-1.5">
                            <Upload className="w-8 h-8" />
                            <span className="text-[10px] font-bold uppercase">Nenhuma foto selecionada</span>
                          </div>
                        )}
                      </div>

                      {/* File Upload Option */}
                      <div className="mb-3">
                        <label className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-dashed border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 hover:text-slate-800 cursor-pointer text-xs font-bold w-full transition">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Carregar foto do dispositivo...</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                        {uploadError && <p className="text-[10px] text-brand-danger font-bold mt-1">{uploadError}</p>}
                      </div>

                      {/* Stock Preset Selector (Removed) */}
                    </div>

                    {/* Comentários */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Comentários e Não Conformidades</label>
                      <textarea
                        rows={3}
                        value={novoComentario}
                        onChange={(e) => setNovoComentario(e.target.value)}
                        placeholder="Insira observações de conformidade ou falhas de segurança encontradas em campo..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-emerald-600 font-semibold"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!novoComentario.trim()}
                      className={`w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                        novoComentario.trim()
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Registrar Lançamento Individual
                    </button>

                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-[10px] font-semibold text-blue-800 space-y-1">
                      <p className="font-extrabold uppercase">📊 Impacto no Dashboard:</p>
                      <p>Ao registrar esta evidência, o sistema computará a inspeção do executor correspondente e atualizará imediatamente o percentual de conformidade mensal da unidade!</p>
                    </div>
                  </form>
                ) : (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs font-semibold text-amber-900 space-y-3">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Lock className="w-4 h-4 shrink-0" />
                      <strong className="font-black uppercase tracking-wider">Acesso Protegido</strong>
                    </div>
                    <p>Seu perfil ativo de <strong>{loggedUser.role}</strong> possui privilégios de visualizador neste módulo.</p>
                    <p className="bg-white/60 p-2.5 rounded border border-amber-200/50">
                      💡 <strong>Para Testar Lançamentos:</strong> Altere seu perfil na barra lateral esquerda para um dos cargos executores (ex: <em>Técnico de Segurança, Engenheiro de Obra, Supervisor de SSMA ou Encarregado</em>).
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Evidence Gallery */}
              <div className="lg:col-span-7 p-6 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between border-b border-brand-border pb-2">
                  <div className="flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-slate-500" />
                    <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider">Evidências Registradas</h5>
                  </div>
                  <span className="text-[10px] font-extrabold bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                    Total: {evidenceRecord.evidencias?.length || 0}
                  </span>
                </div>

                {!evidenceRecord.evidencias || evidenceRecord.evidencias.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                    <Camera className="w-12 h-12 stroke-1 text-slate-300" />
                    <p className="text-xs font-bold uppercase tracking-wider">Nenhum registro fotográfico nesta unidade.</p>
                    <p className="text-[11px] text-slate-400">Insira a primeira foto de evidência ao lado para registrar.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {evidenceRecord.evidencias.map((ev) => (
                      <div key={ev.id} className="bg-slate-50 rounded-xl border border-brand-border overflow-hidden hover:shadow-xs transition group">
                        <div className="relative aspect-video bg-slate-900">
                          <img
                            src={ev.fotoUrl}
                            alt="Evidência"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <span className={`absolute top-2 left-2 text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm ${
                            ev.tipo === 'IFS'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-indigo-600 text-white'
                          }`}>
                            {ev.tipo === 'IFS' ? 'IFS / Frente' : 'Alojamento'}
                          </span>

                          {/* Delete button (only for allowed or creators) */}
                          <button
                            onClick={() => handleDeleteEvidence(ev.id)}
                            className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition duration-200 cursor-pointer"
                            title="Remover Evidência"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="p-3.5 space-y-2">
                          <p className="text-xs font-bold text-slate-700 leading-relaxed italic">
                            "{ev.comentario}"
                          </p>
                          <div className="border-t border-slate-200/60 pt-2 flex items-center justify-between text-[10px] text-slate-400">
                            <div>
                              <span className="font-extrabold text-slate-600 block truncate max-w-[150px]" title={ev.executorNome}>{ev.executorNome}</span>
                              <span className="font-medium text-slate-400 block">{ev.executorRole}</span>
                            </div>
                            <span className="font-mono text-[9px] bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0">{ev.data}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-brand-border flex items-center justify-end">
              <button
                onClick={() => setEvidenceRecord(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-brand-border rounded-xl transition cursor-pointer"
              >
                Fechar Painel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização de Lançamento Detalhado */}
      {viewingLaunch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="modal-visualizacao-lancamento">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-2xl overflow-hidden my-8 animate-fade-in">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-brand-accent" />
                Ficha do Lançamento de Inspeção
              </h4>
              <button
                onClick={() => setViewingLaunch(null)}
                className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Header Info Grid */}
              <div className="grid grid-cols-2 gap-4 bg-brand-bg/50 p-4 rounded-xl border border-brand-border">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Período</span>
                  <span className="text-sm font-extrabold text-brand-ink">{viewingLaunch.mes} / {viewingLaunch.ano}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Obra / Centro de Custo</span>
                  <span className="text-sm font-bold text-brand-ink font-mono">{viewingLaunch.cc}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Data de Cadastro</span>
                  <span className="text-sm font-bold text-brand-ink">{viewingLaunch.data}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tipo de Lançamento</span>
                  <span className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase ${
                    viewingLaunch.tipo === 'IFS'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  }`}>
                    {viewingLaunch.tipo === 'IFS' ? 'IFS / Frente de Serviço' : 'Inspeção de Alojamento'}
                  </span>
                </div>
              </div>

              {/* Executor / Responsável Info */}
              <div className="space-y-2">
                <h5 className="text-xs font-black text-slate-500 uppercase tracking-wider">Responsável pelo Registro</h5>
                <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                  <div className="w-9 h-9 rounded-full bg-brand-accent/10 flex items-center justify-center text-brand-accent font-black text-sm uppercase">
                    {viewingLaunch.executorNome.charAt(0)}
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-800 block text-xs">{viewingLaunch.executorNome}</span>
                    <span className="font-semibold text-slate-400 block text-[10px] uppercase tracking-wider">{viewingLaunch.executorRole}</span>
                  </div>
                </div>
              </div>

              {/* Comentário / Relato Técnico */}
              <div className="space-y-2">
                <h5 className="text-xs font-black text-slate-500 uppercase tracking-wider">Relato Técnico / Comentário</h5>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  <p className="text-xs font-semibold text-slate-700 leading-relaxed italic">
                    "{viewingLaunch.comentario}"
                  </p>
                </div>
              </div>

              {/* Evidências Fotográficas */}
              <div className="space-y-2">
                <h5 className="text-xs font-black text-slate-500 uppercase tracking-wider">Registros Fotográficos (Até 3 fotos)</h5>
                {viewingLaunch.fotoUrls && viewingLaunch.fotoUrls.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {viewingLaunch.fotoUrls.map((url: string, index: number) => (
                      <div key={index} className="aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200/60 group relative">
                        <img
                          src={url}
                          alt={`Foto Evidência ${index + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider text-center rounded-xl border border-slate-100">
                    Nenhum registro fotográfico anexado.
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setViewingLaunch(null)}
                className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/95 text-white text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer shadow-xs"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
