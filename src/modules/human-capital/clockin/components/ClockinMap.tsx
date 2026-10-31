import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './clockinMap.css';

export interface MapPoint {
    lat: number;
    lon: number;
    color: string;
    label?: string;
    /** Destaque (ex.: a batida aberta): ponto maior com borda. */
    highlight?: boolean;
}

export interface MapCircle {
    lat: number;
    lon: number;
    /** metros */
    radius: number;
    color: string;
    label?: string;
    dashed?: boolean;
    /** Marca o centro com um ponto pequeno. */
    showCenter?: boolean;
    /** Cerca pulsando (onda de radar); 'alert' pulsa mais rápido. */
    pulse?: 'normal' | 'alert';
}

interface Props {
    points?: MapPoint[];
    circles?: MapCircle[];
    height?: number;
    /** Clique no mapa (ex.: posicionar uma cerca). */
    onMapClick?: (lat: number, lon: number) => void;
    /** Reenquadra nesses pontos sempre que `key` muda (ex.: local escolhido na tabela). */
    focus?: { key: string; bounds: Array<[number, number]> };
    /** Sobrepõe as ferrovias do OpenRailwayMap. */
    railways?: boolean;
}

/** Camada pública de ferrovias (dados OpenStreetMap, CC-BY-SA), PNG transparente sobre o mapa base. */
const RAILWAY_TILES = 'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png';

/** Raio acima disso não é desenhado (cerca "ilimitada" da Carol cobriria o planeta). */
const MAX_DRAWN_RADIUS = 200_000;

const escapeHtml = (text: string) =>
    text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Pane das cercas, acima do canvas das batidas (overlayPane = 400). */
const FENCE_PANE = 'clockinFences';

/**
 * Mapa OpenStreetMap (Leaflet) com pontos de batida e círculos de cerca.
 * Usa só circleMarker/circle — sem ícones de marcador, que exigem assets no bundle.
 * Batidas vão no canvas (milhares de pontos); cercas em SVG, que aceita a animação CSS do pulso.
 */
const ClockinMap: React.FC<Props> = ({ points = [], circles = [], height = 320, onMapClick, focus, railways = false }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layerRef = useRef<L.LayerGroup | null>(null);
    const svgRef = useRef<L.Renderer | null>(null);
    const railwayRef = useRef<L.TileLayer | null>(null);
    const clickRef = useRef(onMapClick);
    clickRef.current = onMapClick;
    // Enquadra só na primeira carga: ao editar uma cerca o mapa não pode pular de lugar.
    const fittedRef = useRef(false);

    useEffect(() => {
        if (!containerRef.current) return;
        // Vista inicial (Brasil) logo na criação: sem ela o Leaflet adia o add das camadas
        // até o primeiro setView e as camadas ficam sem `_map`.
        const map = L.map(containerRef.current, { preferCanvas: true, scrollWheelZoom: false, center: [-15.8, -47.9], zoom: 4 });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
        }).addTo(map);
        map.on('click', (e: L.LeafletMouseEvent) => clickRef.current?.(e.latlng.lat, e.latlng.lng));
        map.createPane(FENCE_PANE).style.zIndex = '450';
        svgRef.current = L.svg({ pane: FENCE_PANE });
        railwayRef.current = L.tileLayer(RAILWAY_TILES, {
            maxZoom: 19,
            opacity: 0.85,
            className: 'clockin-railways',
            attribution: '<a href="https://www.openrailwaymap.org/" target="_blank" rel="noreferrer">OpenRailwayMap</a>'
        });
        mapRef.current = map;
        layerRef.current = L.layerGroup().addTo(map);
        // O container pode nascer dentro de uma linha recém-expandida, ainda sem tamanho final.
        const timer = setTimeout(() => map.invalidateSize(), 100);
        return () => {
            clearTimeout(timer);
            map.remove();
            mapRef.current = null;
            layerRef.current = null;
            svgRef.current = null;
            railwayRef.current = null;
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        const railway = railwayRef.current;
        if (!map || !railway) return;
        if (railways) railway.addTo(map);
        else railway.remove();
    }, [railways]);

    useEffect(() => {
        const map = mapRef.current;
        const layer = layerRef.current;
        const svg = svgRef.current;
        if (!map || !layer || !svg) return;
        layer.clearLayers();
        const bounds = L.latLngBounds([]);

        circles.forEach(c => {
            const alert = c.pulse === 'alert' ? '--alert' : '';
            const drawRadius = c.radius > 0 && c.radius <= MAX_DRAWN_RADIUS;
            if (drawRadius) {
                if (c.pulse) {
                    L.circle([c.lat, c.lon], {
                        renderer: svg,
                        radius: c.radius,
                        color: c.color,
                        weight: 3,
                        fill: false,
                        interactive: false,
                        className: `clockin-ripple clockin-ripple${alert}`
                    }).addTo(layer);
                }
                const circle = L.circle([c.lat, c.lon], {
                    renderer: svg,
                    radius: c.radius,
                    color: c.color,
                    weight: 2,
                    fillOpacity: 0.08,
                    dashArray: c.dashed ? '6 6' : undefined,
                    className: 'clockin-fence'
                }).addTo(layer);
                if (c.label) circle.bindTooltip(escapeHtml(c.label));
                // circle.getBounds() depende do mapa já projetado; calcula pela geometria.
                bounds.extend(L.latLng(c.lat, c.lon).toBounds(c.radius * 2));
            }
            if (c.showCenter || !drawRadius) {
                if (c.pulse) {
                    L.circleMarker([c.lat, c.lon], {
                        renderer: svg,
                        radius: 5,
                        color: c.color,
                        weight: 2,
                        fillColor: c.color,
                        fillOpacity: 0.4,
                        interactive: false,
                        className: `clockin-center-ripple clockin-center-ripple${alert}`
                    }).addTo(layer);
                }
                const center = L.circleMarker([c.lat, c.lon], { renderer: svg, radius: 4, color: c.color, weight: 2, fillOpacity: 1 }).addTo(layer);
                if (c.label) center.bindTooltip(escapeHtml(c.label));
                bounds.extend([c.lat, c.lon]);
            }
        });

        points.forEach(p => {
            const marker = L.circleMarker([p.lat, p.lon], {
                radius: p.highlight ? 8 : 4,
                color: p.highlight ? '#0f172a' : p.color,
                weight: p.highlight ? 3 : 1,
                fillColor: p.color,
                fillOpacity: p.highlight ? 1 : 0.7
            }).addTo(layer);
            if (p.label) marker.bindTooltip(escapeHtml(p.label));
            if (p.highlight) marker.bringToFront();
            bounds.extend([p.lat, p.lon]);
        });

        if (fittedRef.current) return;
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
            fittedRef.current = true;
        } else {
            map.setView([-15.8, -47.9], 4);
        }
    }, [points, circles]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !focus || focus.bounds.length === 0) return;
        map.fitBounds(L.latLngBounds(focus.bounds), { padding: [24, 24], maxZoom: 15 });
        fittedRef.current = true;
    }, [focus?.key]);

    return (
        <div
            ref={containerRef}
            style={{ height }}
            className={`w-full rounded-xl border border-gray-200 overflow-hidden z-0 ${onMapClick ? 'cursor-crosshair' : ''}`}
        />
    );
};

export default ClockinMap;
