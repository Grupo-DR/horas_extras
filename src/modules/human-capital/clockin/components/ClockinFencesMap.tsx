import React, { useMemo, useState } from 'react';
import { locationKey } from '../domain/clockinAudit';
import { AuditedPunch, CarolFenceHealth, ClockinCostCenterFences, ClockinFenceStatus } from '../domain/clockinTypes';
import { FENCE_LABEL, formatInt, formatMeters, formatPunchDateTime, MAP_COLORS } from './clockinFormat';
import ClockinMap, { MapCircle, MapPoint } from './ClockinMap';

/** Acima disso o mapa mostra uma amostra uniforme (canvas aguenta, mas a tela fica poluída). */
const MAX_POINTS = 5_000;

const PROBLEM_COLOR = '#ea580c';

const STATUS_COLOR: Record<ClockinFenceStatus, string> = {
    INSIDE: MAP_COLORS.punch.none,
    OUTSIDE: MAP_COLORS.punch.high,
    NOT_EVALUATED: '#94a3b8'
};

type ColorMode = 'audit' | 'carol';

interface Props {
    audited: AuditedPunch[];
    fenceHealth: CarolFenceHealth[];
    siteFences: ClockinCostCenterFences[];
    /** Local de cadastro escolhido na tabela (CarolFenceHealth.key), ou null para o Brasil todo. */
    selectedKey: string | null;
    onClearSelection: () => void;
}

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }> = ({ checked, onChange, label }) => (
    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-[#1e3a8a]" />
        {label}
    </label>
);

const Swatch: React.FC<{ color: string; ring?: boolean }> = ({ color, ring }) => (
    <span className="w-2.5 h-2.5 rounded-full inline-block" style={ring ? { border: `2px solid ${color}` } : { background: color }} />
);

/**
 * Mapa do Brasil com as cercas da Carol, as cercas das obras e onde as pessoas
 * realmente bateram — mostra de relance quando a cerca está num lugar e a equipe em outro.
 */
const ClockinFencesMap: React.FC<Props> = ({ audited, fenceHealth, siteFences, selectedKey, onClearSelection }) => {
    const [showPunches, setShowPunches] = useState(true);
    const [showCarol, setShowCarol] = useState(true);
    const [showSites, setShowSites] = useState(true);
    const [showRailways, setShowRailways] = useState(true);
    const [colorMode, setColorMode] = useState<ColorMode>('audit');

    const selected = fenceHealth.find(h => h.key === selectedKey) || null;

    const scopePunches = useMemo(
        () => audited.filter(p => p.lat !== null && p.lon !== null && (!selectedKey || locationKey(p) === selectedKey)),
        [audited, selectedKey]
    );

    const points = useMemo<MapPoint[]>(() => {
        if (!showPunches) return [];
        const step = Math.max(1, Math.ceil(scopePunches.length / MAX_POINTS));
        return scopePunches
            .filter((_, i) => i % step === 0)
            .map(p => {
                const status = colorMode === 'audit' ? p.effectiveFence : p.fenceStatus;
                return {
                    lat: p.lat as number,
                    lon: p.lon as number,
                    color: STATUS_COLOR[status],
                    label: `${p.name} · ${formatPunchDateTime(p.punchedAt)} · ${p.locationName || 'sem local'} · ${FENCE_LABEL[status]}`
                };
            });
    }, [scopePunches, showPunches, colorMode]);

    const circles = useMemo<MapCircle[]>(() => {
        const list: MapCircle[] = [];
        if (showCarol) {
            fenceHealth
                .filter(h => h.centerLat !== null && h.centerLon !== null && (!selectedKey || h.key === selectedKey))
                .forEach(h => list.push({
                    lat: h.centerLat as number,
                    lon: h.centerLon as number,
                    radius: h.radius ?? 0,
                    color: h.problems.length ? PROBLEM_COLOR : MAP_COLORS.carolFence,
                    showCenter: true,
                    pulse: h.problems.length ? 'alert' : 'normal',
                    label: `Cerca da Carol · ${h.locationCode ? `${h.locationCode} · ` : ''}${h.locationName} · raio ${formatMeters(h.radius)} · ${formatInt(h.punchCount)} batidas${h.problems.length ? ' · com problema' : ''}`
                }));
        }
        if (showSites) {
            const ccsInScope = selectedKey ? new Set(scopePunches.map(p => p.costCenter)) : null;
            siteFences
                .filter(f => !ccsInScope || ccsInScope.has(f.costCenter))
                .forEach(f => f.sites.forEach(s => list.push({
                    lat: s.lat,
                    lon: s.lon,
                    radius: s.radius,
                    color: MAP_COLORS.siteFence,
                    showCenter: true,
                    pulse: 'normal',
                    label: `Cerca da obra · ${f.costCenter} · ${s.name} · raio ${formatMeters(s.radius)}`
                })));
        }
        return list;
    }, [fenceHealth, siteFences, showCarol, showSites, selectedKey, scopePunches]);

    // Ao escolher um local, enquadra nas batidas dele + centro da cerca; sem seleção, no Brasil todo.
    // O mapa só reenquadra quando a chave muda.
    const focus = useMemo(() => {
        const bounds: Array<[number, number]> = scopePunches.map(p => [p.lat as number, p.lon as number]);
        fenceHealth
            .filter(h => !selectedKey || h.key === selectedKey)
            .forEach(h => { if (h.centerLat !== null && h.centerLon !== null) bounds.push([h.centerLat, h.centerLon]); });
        return { key: selectedKey ?? 'ALL', bounds };
    }, [selectedKey, scopePunches, fenceHealth]);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-bold text-[#1e3a8a] uppercase">Mapa das cercas e batidas</h3>
                    <p className="text-[11px] text-gray-500">
                        {selected
                            ? `Mostrando ${selected.locationCode ? `${selected.locationCode} · ` : ''}${selected.locationName}: ${formatInt(scopePunches.length)} batidas com GPS.`
                            : 'Clique em um local na tabela para aproximar. Passe o mouse sobre pontos e cercas para ver o detalhe.'}
                    </p>
                </div>
                {selected && (
                    <button onClick={onClearSelection} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50">
                        Ver Brasil todo
                    </button>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-600">
                <Toggle checked={showPunches} onChange={setShowPunches} label="Batidas" />
                <Toggle checked={showCarol} onChange={setShowCarol} label="Cercas da Carol" />
                <Toggle checked={showSites} onChange={setShowSites} label="Cercas das obras" />
                <Toggle checked={showRailways} onChange={setShowRailways} label="Ferrovias" />
                <span className="text-gray-300">|</span>
                <span>Cor das batidas:</span>
                <select value={colorMode} onChange={e => setColorMode(e.target.value as ColorMode)} className="px-2 py-1 rounded-lg border border-gray-200 bg-white text-[11px]">
                    <option value="audit">Resultado da auditoria</option>
                    <option value="carol">Status bruto da Carol</option>
                </select>
            </div>

            <ClockinMap points={points} circles={circles} height={520} focus={focus} railways={showRailways} />

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-600">
                <span className="inline-flex items-center gap-1.5"><Swatch color={STATUS_COLOR.INSIDE} /> Dentro</span>
                <span className="inline-flex items-center gap-1.5"><Swatch color={STATUS_COLOR.OUTSIDE} /> Fora</span>
                <span className="inline-flex items-center gap-1.5"><Swatch color={STATUS_COLOR.NOT_EVALUATED} /> Não avaliada{colorMode === 'audit' ? ' (inclui cerca da Carol com problema)' : ''}</span>
                <span className="inline-flex items-center gap-1.5"><Swatch ring color={MAP_COLORS.carolFence} /> Cerca Carol OK</span>
                <span className="inline-flex items-center gap-1.5"><Swatch ring color={PROBLEM_COLOR} /> Cerca Carol com problema</span>
                <span className="inline-flex items-center gap-1.5"><Swatch ring color={MAP_COLORS.siteFence} /> Cerca da obra</span>
                {showRailways && (
                    <span className="inline-flex items-center gap-1.5">
                        <span className="w-4 border-t-2" style={{ borderColor: '#2563eb' }} /> Ferrovias (siglas = códigos de estação/pátio)
                    </span>
                )}
                {points.length < scopePunches.length && showPunches && (
                    <span className="text-gray-400 ml-auto">Amostra de {formatInt(points.length)} de {formatInt(scopePunches.length)} batidas</span>
                )}
            </div>
        </div>
    );
};

export default ClockinFencesMap;
