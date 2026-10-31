import React, { useMemo, useState } from 'react';
import { ExternalLink, Loader2, MapPin, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import { getClockinCCName } from '../domain/carolCostCenters';
import { UserProfile } from '../../types';
import { evaluateSites, FENCE_PROBLEM_LABELS, suggestSitesFromPunches } from '../domain/clockinAudit';
import { parseCoordinates } from '../domain/clockinParser';
import { AuditedPunch, CarolFenceHealth, ClockinCostCenterFences, ClockinSite } from '../domain/clockinTypes';
import { saveSiteFences } from '../services/clockinStore';
import { formatInt, formatMeters, formatPercent, formatPunchDateTime, MAP_COLORS, mapsUrl } from './clockinFormat';
import ClockinMap, { MapCircle, MapPoint } from './ClockinMap';
import ClockinFencesMap from './ClockinFencesMap';

/** Máximo de pontos desenhados no mapa do editor (amostra uniforme acima disso). */
const MAX_MAP_POINTS = 3_000;

interface Props {
    user: UserProfile;
    canEdit: boolean;
    audited: AuditedPunch[];
    fenceHealth: CarolFenceHealth[];
    siteFences: ClockinCostCenterFences[];
    onFencesChange: (fences: ClockinCostCenterFences[]) => void;
}

interface DraftSite {
    name: string;
    coordinates: string;
    radius: string;
}

const toDraft = (site: ClockinSite): DraftSite => ({ name: site.name, coordinates: `${site.lat}, ${site.lon}`, radius: String(site.radius) });

const inputClass = 'px-2 py-1.5 rounded-lg border border-gray-200 text-xs w-full';

const SiteEditor: React.FC<{
    costCenter: string;
    punches: AuditedPunch[];
    initial: ClockinSite[];
    onCancel: () => void;
    onSave: (sites: ClockinSite[]) => Promise<void>;
}> = ({ costCenter, punches, initial, onCancel, onSave }) => {
    const [drafts, setDrafts] = useState<DraftSite[]>(initial.length ? initial.map(toDraft) : [{ name: '', coordinates: '', radius: '100' }]);
    const [active, setActive] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const update = (index: number, patch: Partial<DraftSite>) =>
        setDrafts(prev => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));

    // Cercas válidas do rascunho, para o mapa e a cobertura ao vivo.
    const validDrafts = useMemo(() => drafts.flatMap((d, index) => {
        const coords = parseCoordinates(d.coordinates);
        const radius = Number(d.radius);
        return coords && radius > 0
            ? [{ index, site: { name: d.name.trim() || `Cerca ${index + 1}`, lat: coords[0], lon: coords[1], radius } as ClockinSite }]
            : [];
    }), [drafts]);
    const validSites = useMemo(() => validDrafts.map(v => v.site), [validDrafts]);

    // Amostra para o mapa não pesar em CCs com milhares de batidas.
    const gpsPunches = useMemo(() => {
        const withGps = punches.filter(p => p.lat !== null && p.lon !== null);
        const step = Math.max(1, Math.ceil(withGps.length / MAX_MAP_POINTS));
        return withGps.filter((_, i) => i % step === 0);
    }, [punches]);

    const coverage = useMemo(() => {
        const results = punches.map(p => evaluateSites(p, validSites)).filter((r): r is NonNullable<typeof r> => r !== null);
        return results.length ? results.filter(r => r.inside).length / results.length : null;
    }, [punches, validSites]);

    const mapPoints = useMemo<MapPoint[]>(() => gpsPunches.map(p => {
        const inside = validSites.length ? evaluateSites(p, validSites)?.inside : undefined;
        return {
            lat: p.lat as number,
            lon: p.lon as number,
            color: inside === undefined ? '#64748b' : inside ? MAP_COLORS.punch.none : MAP_COLORS.punch.high,
            label: `${p.name} · ${formatPunchDateTime(p.punchedAt)}`
        };
    }), [gpsPunches, validSites]);

    const mapCircles = useMemo<MapCircle[]>(() => validDrafts.map(({ index, site }) => ({
        lat: site.lat,
        lon: site.lon,
        radius: site.radius,
        color: index === active ? '#1e3a8a' : MAP_COLORS.siteFence,
        showCenter: true,
        pulse: 'normal',
        label: `${site.name} · raio ${formatMeters(site.radius)}`
    })), [validDrafts, active]);

    const handleMapClick = (lat: number, lon: number) => {
        const coordinates = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        if (active < drafts.length) update(active, { coordinates });
        else {
            setDrafts(prev => [...prev, { name: '', coordinates, radius: '100' }]);
            setActive(drafts.length);
        }
    };

    const suggest = () => {
        const sites = suggestSitesFromPunches(punches);
        if (sites.length === 0) {
            setError('Poucas batidas com GPS confiável neste CC para sugerir uma cerca.');
            return;
        }
        setError(null);
        setActive(0);
        setDrafts(sites.map((s, i) => ({
            name: `${getClockinCCName(costCenter)} — ponto ${i + 1} (${s.sample} batidas)`,
            coordinates: `${s.lat.toFixed(6)}, ${s.lon.toFixed(6)}`,
            radius: String(s.radius)
        })));
    };

    const handleSave = async () => {
        const sites: ClockinSite[] = [];
        for (const [i, d] of drafts.entries()) {
            if (!d.coordinates.trim() && !d.name.trim()) continue;
            const coords = parseCoordinates(d.coordinates);
            const radius = Number(d.radius);
            if (!coords) return setError(`Cerca ${i + 1}: coordenadas inválidas. Use "latitude, longitude".`);
            if (!Number.isFinite(radius) || radius <= 0 || radius > 50_000) return setError(`Cerca ${i + 1}: raio deve ser entre 1 e 50.000 m.`);
            sites.push({ name: d.name.trim() || `Cerca ${i + 1}`, lat: coords[0], lon: coords[1], radius });
        }
        setSaving(true);
        setError(null);
        try {
            await onSave(sites);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Falha ao salvar.');
            setSaving(false);
        }
    };

    return (
        <div className="bg-slate-50/70 border-t border-gray-100 px-5 py-4 space-y-3">
            <p className="text-[11px] text-gray-500">
                <b>Clique no mapa</b> para posicionar a cerca selecionada, ou cole as coordenadas como no Google Maps ("-23.5737, -47.0558").
                A batida conta como dentro se estiver em qualquer uma das cercas, com folga da precisão do GPS (até 100 m).
            </p>

            <div className="space-y-2">
                <ClockinMap points={mapPoints} circles={mapCircles} height={380} onMapClick={handleMapClick} railways />
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-600">
                    <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: MAP_COLORS.punch.none }} /> Batida dentro</span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: MAP_COLORS.punch.high }} /> Batida fora</span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2" style={{ borderColor: '#1e3a8a' }} /> Cerca selecionada</span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2" style={{ borderColor: MAP_COLORS.siteFence }} /> Outras cercas</span>
                    {gpsPunches.length < punches.filter(p => p.lat !== null).length && (
                        <span className="text-gray-400">Amostra de {formatInt(gpsPunches.length)} batidas no mapa</span>
                    )}
                    <span className="ml-auto font-bold text-gray-800">
                        {coverage === null ? 'Defina uma cerca para ver a cobertura' : `${formatPercent(coverage)} das batidas com GPS ficariam dentro`}
                    </span>
                </div>
            </div>

            {drafts.map((d, i) => (
                <div
                    key={i}
                    onClick={() => setActive(i)}
                    className={`grid grid-cols-12 gap-2 items-center rounded-lg p-1 ${i === active ? 'ring-2 ring-[#1e3a8a]/40 bg-white' : ''}`}
                >
                    <input className={`${inputClass} col-span-12 md:col-span-5`} placeholder="Nome (ex.: Canteiro km 120)" value={d.name} onFocus={() => setActive(i)} onChange={e => update(i, { name: e.target.value })} />
                    <input className={`${inputClass} col-span-7 md:col-span-4`} placeholder="latitude, longitude" value={d.coordinates} onFocus={() => setActive(i)} onChange={e => update(i, { coordinates: e.target.value })} />
                    <input className={`${inputClass} col-span-3 md:col-span-2`} placeholder="Raio (m)" value={d.radius} onFocus={() => setActive(i)} onChange={e => update(i, { radius: e.target.value })} />
                    <button
                        onClick={e => {
                            e.stopPropagation();
                            setDrafts(prev => prev.filter((_, j) => j !== i));
                            setActive(a => (a > i ? a - 1 : a === i ? 0 : a));
                        }}
                        className="col-span-2 md:col-span-1 p-1.5 text-gray-400 hover:text-rose-600 justify-self-center"
                        title="Remover"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            ))}
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex flex-wrap gap-2">
                <button onClick={() => { setDrafts(prev => [...prev, { name: '', coordinates: '', radius: '100' }]); setActive(drafts.length); }} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50">
                    <Plus size={14} /> Adicionar cerca
                </button>
                <button onClick={suggest} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-indigo-200 bg-white text-xs font-bold text-indigo-700 hover:bg-indigo-50">
                    <Sparkles size={14} /> Sugerir pelas batidas
                </button>
                <div className="ml-auto flex gap-2">
                    <button onClick={onCancel} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-600">
                        <X size={14} /> Cancelar
                    </button>
                    <button onClick={() => void handleSave()} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1e3a8a] text-white text-xs font-bold disabled:opacity-50">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar cercas
                    </button>
                </div>
            </div>
        </div>
    );
};

const ClockinFences: React.FC<Props> = ({ user, canEdit, audited, fenceHealth, siteFences, onFencesChange }) => {
    const [editing, setEditing] = useState<string | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

    const fencesByCc = useMemo(() => new Map(siteFences.map(f => [f.costCenter, f])), [siteFences]);

    const costCenters = useMemo(() => {
        const map = new Map<string, { costCenter: string; punches: AuditedPunch[] }>();
        audited.forEach(p => {
            const row = map.get(p.costCenter) || { costCenter: p.costCenter, punches: [] };
            row.punches.push(p);
            map.set(p.costCenter, row);
        });
        siteFences.forEach(f => { if (!map.has(f.costCenter)) map.set(f.costCenter, { costCenter: f.costCenter, punches: [] }); });
        return Array.from(map.values()).sort((a, b) => b.punches.length - a.punches.length);
    }, [audited, siteFences]);

    const handleSave = async (costCenter: string, sites: ClockinSite[]) => {
        const saved = await saveSiteFences(costCenter, sites, user);
        const others = siteFences.filter(f => f.costCenter !== costCenter);
        onFencesChange(saved.sites.length ? [...others, saved] : others);
        setEditing(null);
    };

    return (
        <div className="space-y-6">
            <ClockinFencesMap
                audited={audited}
                fenceHealth={fenceHealth}
                siteFences={siteFences}
                selectedKey={selectedLocation}
                onClearSelection={() => setSelectedLocation(null)}
            />

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-[#1e3a8a] uppercase">Cercas da Carol (local de cadastro)</h3>
                    <p className="text-[11px] text-gray-500">
                        A Carol compara cada batida com a cerca do local onde o colaborador está cadastrado — não com a obra. Locais com problema
                        não geram alerta de "fora da cerca"; corrija na Carol ou cadastre a cerca da obra abaixo. Clique em um local para vê-lo no mapa.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                            <tr>
                                <th className="text-left px-4 py-2">Local</th>
                                <th className="text-right px-3 py-2">Batidas</th>
                                <th className="text-left px-3 py-2">Centro</th>
                                <th className="text-right px-3 py-2">Raio</th>
                                <th className="text-right px-3 py-2">Distância mediana</th>
                                <th className="text-right px-3 py-2">Dentro</th>
                                <th className="text-left px-4 py-2">Diagnóstico</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fenceHealth.map(h => (
                                <tr
                                    key={h.key}
                                    onClick={() => setSelectedLocation(selectedLocation === h.key ? null : h.key)}
                                    className={`border-t border-gray-50 cursor-pointer ${selectedLocation === h.key ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                >
                                    <td className="px-4 py-2 font-semibold text-gray-800">{h.locationCode ? `${h.locationCode} · ` : ''}{h.locationName}</td>
                                    <td className="px-3 py-2 text-right text-gray-600">{formatInt(h.punchCount)}</td>
                                    <td className="px-3 py-2">
                                        {h.centerLat !== null && h.centerLon !== null ? (
                                            <a href={mapsUrl(h.centerLat, h.centerLon)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                                                <MapPin size={12} /> {h.centerLat.toFixed(4)}, {h.centerLon.toFixed(4)} <ExternalLink size={10} />
                                            </a>
                                        ) : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-gray-700">{formatMeters(h.radius)}</td>
                                    <td className="px-3 py-2 text-right text-gray-700">{formatMeters(h.medianDistance)}</td>
                                    <td className="px-3 py-2 text-right text-gray-700">{formatPercent(h.insideRate)}</td>
                                    <td className="px-4 py-2">
                                        {h.problems.length === 0
                                            ? <span className="text-emerald-600 font-semibold">OK</span>
                                            : (
                                                <div className="flex flex-wrap gap-1">
                                                    {h.problems.map(problem => (
                                                        <span key={problem} className="px-1.5 py-0.5 rounded border border-orange-200 bg-orange-50 text-orange-700 text-[10px] font-semibold">
                                                            {FENCE_PROBLEM_LABELS[problem]}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-[#1e3a8a] uppercase">Cercas das obras (por centro de custo)</h3>
                    <p className="text-[11px] text-gray-500">
                        Quando cadastrada, a cerca da obra substitui a da Carol e a distância é recalculada pelo GPS de cada batida.
                        Um CC pode ter várias cercas (ex.: trechos de via). "Sugerir pelas batidas" propõe os pontos onde as pessoas mais batem.
                    </p>
                </div>
                <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                        <tr>
                            <th className="text-left px-4 py-2">Centro de custo</th>
                            <th className="text-right px-3 py-2">Batidas</th>
                            <th className="text-left px-3 py-2">Cercas cadastradas</th>
                            <th className="text-right px-3 py-2">Dentro</th>
                            <th className="px-4 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {costCenters.map(({ costCenter, punches }) => {
                            const fences = fencesByCc.get(costCenter);
                            const evaluated = punches.filter(p => p.fenceSource === 'SITE' && p.effectiveFence !== 'NOT_EVALUATED');
                            const inside = evaluated.filter(p => p.effectiveFence === 'INSIDE').length;
                            return (
                                <React.Fragment key={costCenter}>
                                    <tr className="border-t border-gray-50">
                                        <td className="px-4 py-2">
                                            <div className="font-semibold text-gray-800">{costCenter || 'Sem CC'}</div>
                                            <div className="text-[10px] text-gray-400">{getClockinCCName(costCenter)}</div>
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-600">{formatInt(punches.length)}</td>
                                        <td className="px-3 py-2">
                                            {fences?.sites.length
                                                ? fences.sites.map((s, i) => (
                                                    <a key={i} href={mapsUrl(s.lat, s.lon)} target="_blank" rel="noreferrer" className="block text-blue-700 hover:underline truncate max-w-[320px]">
                                                        {s.name} · {formatMeters(s.radius)}
                                                    </a>
                                                ))
                                                : <span className="text-gray-400">Nenhuma — usa a cerca da Carol</span>}
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-700">{evaluated.length ? formatPercent(inside / evaluated.length) : '-'}</td>
                                        <td className="px-4 py-2 text-right">
                                            {canEdit && editing !== costCenter && costCenter && (
                                                <button onClick={() => setEditing(costCenter)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50">
                                                    {fences?.sites.length ? 'Editar' : 'Cadastrar'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {editing === costCenter && (
                                        <tr>
                                            <td colSpan={5} className="p-0">
                                                <SiteEditor
                                                    costCenter={costCenter}
                                                    punches={punches}
                                                    initial={fences?.sites || []}
                                                    onCancel={() => setEditing(null)}
                                                    onSave={sites => handleSave(costCenter, sites)}
                                                />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ClockinFences;
