import React, { useId } from 'react';
import { SeriesPoint } from '../../modules/market/marketIndicators';

const WIDTH = 240;
const HEIGHT = 56;
const PADDING = 4;

/** Minigráfico de linha com área, em SVG puro (sem biblioteca de gráficos). */
export const Sparkline: React.FC<{ points: SeriesPoint[] }> = ({ points }) => {
    const gradientId = useId();
    if (points.length < 2) return <div className="h-14" aria-hidden="true" />;

    const values = points.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const x = (i: number) => PADDING + (i * (WIDTH - PADDING * 2)) / (points.length - 1);
    const y = (v: number) => HEIGHT - PADDING - ((v - min) / range) * (HEIGHT - PADDING * 2);

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const area = `${line} L${x(points.length - 1).toFixed(1)},${HEIGHT} L${x(0).toFixed(1)},${HEIGHT} Z`;
    const last = points[points.length - 1];

    return (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-14 w-full" aria-hidden="true">
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gradientId})`} />
            <path d={line} fill="none" stroke="#0b1d4f" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <circle cx={x(points.length - 1)} cy={y(last.value)} r="3" fill="#2563eb" />
        </svg>
    );
};
