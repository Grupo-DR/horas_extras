import React, { useMemo } from 'react';
import { ExternalLink, ImageIcon, MapPin } from 'lucide-react';
import { getClockinCCName } from '../domain/carolCostCenters';
import { AuditedPunch, ClockinSite } from '../domain/clockinTypes';
import ClockinMap, { MapCircle, MapPoint } from './ClockinMap';
import {
    FENCE_BADGE,
    FENCE_LABEL,
    FENCE_SOURCE_LABEL,
    formatCpf,
    formatMeters,
    formatPunchDateTime,
    rmChapaLabel,
    MAP_COLORS,
    mapsUrl,
    SEVERITY_BADGE,
    SEVERITY_LABEL
} from './clockinFormat';
import { ALERT_META, EXPECTED_CC_SOURCE_LABEL } from '../domain/clockinAudit';

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div>
        <div className="text-[10px] text-gray-500 font-bold uppercase">{label}</div>
        <div className="text-xs text-gray-800 mt-0.5 break-words">{value ?? '-'}</div>
    </div>
);

const yesNo = (v: boolean) => (v ? 'Sim' : 'Não');

const punchColor = (p: AuditedPunch) => MAP_COLORS.punch[p.worstSeverity ?? 'none'];

const LegendItem: React.FC<{ color: string; label: string; dashed?: boolean; dot?: boolean }> = ({ color, label, dashed, dot }) => (
    <span className="inline-flex items-center gap-1.5">
        {dot
            ? <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            : <span className="w-4 h-0 border-t-2" style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }} />}
        {label}
    </span>
);

/** Onde a pessoa bateu, a precisão do GPS e as cercas (Carol e obra). */
const PunchMap: React.FC<{ punch: AuditedPunch; sites: ClockinSite[] }> = ({ punch: p, sites }) => {
    const points = useMemo<MapPoint[]>(() =>
        p.lat !== null && p.lon !== null
            ? [{ lat: p.lat, lon: p.lon, color: punchColor(p), highlight: true, label: `Batida ${formatPunchDateTime(p.punchedAt)}` }]
            : [],
    [p]);

    const circles = useMemo<MapCircle[]>(() => {
        const list: MapCircle[] = [];
        if (p.lat !== null && p.lon !== null && p.accuracyM) {
            list.push({ lat: p.lat, lon: p.lon, radius: p.accuracyM, color: MAP_COLORS.accuracy, dashed: true, label: `Precisão do GPS: ${formatMeters(p.accuracyM)}` });
        }
        if (p.fenceCheck) {
            list.push({
                lat: p.fenceCheck.centerLat,
                lon: p.fenceCheck.centerLon,
                radius: p.fenceCheck.radius,
                color: MAP_COLORS.carolFence,
                showCenter: true,
                // Raio 0 ou "ilimitado" é cerca com problema: pulsa rápido.
                pulse: p.fenceCheck.radius <= 0 || p.fenceCheck.radius > 200_000 ? 'alert' : 'normal',
                label: `Cerca da Carol (${p.locationName || 'local de cadastro'}) · raio ${formatMeters(p.fenceCheck.radius)}`
            });
        }
        sites.forEach(s => list.push({ lat: s.lat, lon: s.lon, radius: s.radius, color: MAP_COLORS.siteFence, showCenter: true, pulse: 'normal', label: `${s.name} · raio ${formatMeters(s.radius)}` }));
        return list;
    }, [p, sites]);

    if (points.length === 0 && circles.length === 0) {
        return <p className="text-xs text-gray-400">Batida sem coordenadas e sem cerca para mostrar no mapa.</p>;
    }

    const carolRadius = p.fenceCheck?.radius ?? 0;
    return (
        <div className="space-y-2">
            <ClockinMap points={points} circles={circles} height={300} railways />
            <div className="flex flex-wrap gap-4 text-[11px] text-gray-600">
                {points.length > 0 && <LegendItem dot color={punchColor(p)} label="Onde bateu" />}
                {p.accuracyM ? <LegendItem dashed color={MAP_COLORS.accuracy} label={`Precisão GPS (${formatMeters(p.accuracyM)})`} /> : null}
                {p.fenceCheck && <LegendItem color={MAP_COLORS.carolFence} label={`Cerca da Carol (${formatMeters(carolRadius)})`} />}
                {sites.length > 0 && <LegendItem color={MAP_COLORS.siteFence} label="Cerca da obra" />}
                {p.fenceCheck && (carolRadius <= 0 || carolRadius > 200_000) && (
                    <span className="text-orange-700">Raio da Carol {carolRadius <= 0 ? 'é 0 m' : 'é ilimitado'}: só o centro aparece.</span>
                )}
            </div>
        </div>
    );
};

/** Todos os dados de uma batida, agrupados por tema. */
const ClockinPunchDetail: React.FC<{ punch: AuditedPunch; sites?: ClockinSite[] }> = ({ punch: p, sites = [] }) => (
    <div className="bg-slate-50/70 border-t border-gray-100 px-6 py-5 space-y-5">
        {p.alerts.length > 0 && (
            <div className="flex flex-wrap gap-2">
                {p.alerts.map((a, i) => (
                    <span key={i} className={`text-xs px-2 py-1 rounded-lg border ${SEVERITY_BADGE[a.severity]}`} title={ALERT_META[a.code].description}>
                        <b>{SEVERITY_LABEL[a.severity]} · {ALERT_META[a.code].label}:</b> {a.detail}
                    </span>
                ))}
            </div>
        )}

        <div className="flex flex-wrap gap-3">
            {p.imageUrl && (
                <a href={p.imageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-blue-700 hover:bg-blue-50">
                    <ImageIcon size={14} /> Ver foto na Carol <ExternalLink size={12} />
                </a>
            )}
            {p.lat !== null && p.lon !== null && (
                <a href={mapsUrl(p.lat, p.lon)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-blue-700 hover:bg-blue-50">
                    <MapPin size={14} /> Onde bateu <ExternalLink size={12} />
                </a>
            )}
            {p.fenceCheck && (
                <a href={mapsUrl(p.fenceCheck.centerLat, p.fenceCheck.centerLon)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50">
                    <MapPin size={14} /> Centro da cerca da Carol <ExternalLink size={12} />
                </a>
            )}
        </div>

        <PunchMap punch={p} sites={sites} />

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
            <Field label="Colaborador" value={p.name} />
            <Field label="CPF" value={formatCpf(p.cpf)} />
            <Field label="PIS" value={p.pis} />
            <Field label="E-mail" value={p.email} />
            <Field label="Telefone" value={p.phone} />
            <Field
                label="Centro de custo"
                value={`${p.costCenter} · ${getClockinCCName(p.costCenter)}${p.carolCostCenter && p.carolCostCenter !== p.costCenter ? ` (na Carol: ${p.carolCostCenter})` : ''}`}
            />
            <Field
                label="Chapa (RM)"
                value={`${rmChapaLabel(p)}${p.rm?.by ? ` · achado pelo ${p.rm.by === 'CPF' ? 'CPF' : 'nome'}` : ''}`}
            />
            <Field label="Função (RM)" value={p.rm?.employee?.funcao} />
            <Field
                label="CC esperado na data"
                value={p.expectedCostCenters
                    ? (
                        <>
                            {p.expectedCostCenters.allocations.map(a => (
                                <div key={a.costCenter}>
                                    {a.costCenter} · {getClockinCCName(a.costCenter)}
                                    {p.expectedCostCenters!.allocations.length > 1 ? ` (${Math.round(a.share * 100)}%)` : ''}
                                </div>
                            ))}
                            <div className="text-[10px] text-gray-400">{EXPECTED_CC_SOURCE_LABEL[p.expectedCostCenters.source]}</div>
                        </>
                    )
                    : undefined}
            />
            {p.rm?.employee?.source === 'RM' && p.rm.employee.costCenter && (
                <Field label="CC atual no RM" value={`${p.rm.employee.costCenter} · ${getClockinCCName(p.rm.employee.costCenter)}`} />
            )}
            {p.rm?.employee?.dataDemissao && (
                <Field label="Demissão (RM)" value={p.rm.employee.dataDemissao.split('-').reverse().join('/')} />
            )}
            <Field label="Seção" value={p.section} />
            <Field label="Regional" value={p.regional} />
            <Field label="Local de cadastro" value={`${p.locationCode ? `${p.locationCode} · ` : ''}${p.locationName || '-'}`} />
            <Field label="Supervisor" value={p.supervisorName} />
            <Field label="Aparelho" value={`${p.deviceDescription || '-'} (${p.deviceId})`} />
            <Field label="Marcou no próprio celular" value={yesNo(p.selfPunch)} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
            <Field label="Modo" value={p.mode === 'FACIAL' ? 'Reconhecimento facial' : 'Foto aprovada'} />
            <Field label="Score facial" value={p.mode === 'FACIAL' ? p.faceScore : '-'} />
            <Field label="Coordenadas" value={p.lat !== null ? `${p.lat}, ${p.lon}` : 'Não encontradas'} />
            <Field label="Precisão GPS" value={formatMeters(p.accuracyM)} />
            <Field
                label="Cerca considerada"
                value={<span className={`inline-block px-1.5 py-0.5 rounded border text-[11px] font-bold ${FENCE_BADGE[p.effectiveFence]}`}>{FENCE_LABEL[p.effectiveFence]}</span>}
            />
            <Field label="Fonte da cerca" value={`${FENCE_SOURCE_LABEL[p.fenceSource]}${p.effectiveDistance !== null ? ` · ${formatMeters(p.effectiveDistance)}` : ''}`} />
            <Field label="Status na Carol" value={FENCE_LABEL[p.fenceStatus]} />
            <Field label="Raio da cerca Carol" value={p.fenceCheck ? formatMeters(p.fenceCheck.radius) : '-'} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
            <Field label="Data/hora" value={`${formatPunchDateTime(p.punchedAt)} (GMT ${p.gmt})`} />
            <Field label="Sincronizada em" value={p.syncedAtMs ? new Date(p.syncedAtMs).toLocaleString('pt-BR') : '-'} />
            <Field label="Atraso 1ª sincronização" value={p.firstSyncDelayMin !== null ? `${p.firstSyncDelayMin} min` : '-'} />
            <Field label="Hora automática" value={yesNo(p.autoDateTime)} />
            <Field label="Hora ≠ GPS" value={yesNo(p.dateDiffersFromGps)} />
            <Field label="Fuso automático" value={p.timezoneMode === 'ENABLED' ? 'Habilitado' : p.timezoneMode === 'DISABLED' ? 'Desabilitado' : 'Inexistente'} />
            <Field label="Fonte da hora" value={p.timeProvider} />
            <Field label="NSR" value={p.nsr} />
            <Field label="Processada em" value={formatPunchDateTime(p.nsrProcessedAt)} />
            <Field label="Recibo" value={p.receiptSentAt ? `${formatPunchDateTime(p.receiptSentAt)} · ${p.receiptMethod || '-'}` : 'Não enviado'} />
        </div>
    </div>
);

export default ClockinPunchDetail;
