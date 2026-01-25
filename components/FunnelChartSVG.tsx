import React, { useMemo } from "react";

/**
 * FunnelChartSVG
 * - Funnel with elliptical "cap" at each level
 * - Separation between levels (gap)
 * - Consistent black outline
 * - Lines and dots to the right
 */

function clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
}

function trapezoidPath(x: number, y: number, wTop: number, wBottom: number, h: number, rx = 10) {
    // Trapezoid with slightly rounded corners
    const leftTop = x + (wTop - wBottom) / 2;
    const rightTop = leftTop + wTop;
    const leftBottom = x;
    const rightBottom = x + wBottom;

    const r = clamp(rx, 0, Math.min(wTop, wBottom, h) / 2);

    return [
        `M ${leftTop + r} ${y}`,
        `L ${rightTop - r} ${y}`,
        `Q ${rightTop} ${y} ${rightTop} ${y + r}`,
        `L ${rightBottom} ${y + h - r}`,
        `Q ${rightBottom} ${y + h} ${rightBottom - r} ${y + h}`,
        `L ${leftBottom + r} ${y + h}`,
        `Q ${leftBottom} ${y + h} ${leftBottom} ${y + h - r}`,
        `L ${leftTop} ${y + r}`,
        `Q ${leftTop} ${y} ${leftTop + r} ${y}`,
        "Z",
    ].join(" ");
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number) {
    // Ellipse in path
    return [
        `M ${cx - rx} ${cy}`,
        `a ${rx} ${ry} 0 1 0 ${2 * rx} 0`,
        `a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`,
    ].join(" ");
}

interface Level {
    label: string;
    color: string;
    topColor?: string;
}

interface FunnelChartSVGProps {
    levels: Level[];
    width?: number;
    height?: number;
    margin?: { top: number; right: number; bottom: number; left: number };
    topWidth?: number;
    bottomWidth?: number;
    levelHeight?: number;
    gap?: number;
    topEllipseRatio?: number;
    stroke?: string;
    strokeWidth?: number;
    circleRadius?: number;
    connectorStartOffset?: number;
    connectorKneeX?: number;
    fontFamily?: string;
    showLabels?: boolean;
}

export default function FunnelChartSVG({
    levels,
    width = 600,
    height = 500,
    margin = { top: 20, right: 100, bottom: 20, left: 40 },
    topWidth = 420,
    bottomWidth = 60,
    levelHeight = 90,
    gap = 12,
    topEllipseRatio = 0.22, // ellipse height = levelHeight * ratio
    stroke = "#334155", // slate-700
    strokeWidth = 2,
    circleRadius = 8,
    connectorStartOffset = 18,
    connectorKneeX = 28,
    fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    showLabels = false,
}: FunnelChartSVGProps) {
    const n = levels?.length ?? 0;

    const drawableW = width - margin.left - margin.right;
    const drawableH = height - margin.top - margin.bottom;

    // Auto-adjust height if needed
    const totalH = n * levelHeight + (n - 1) * gap;
    const scaleY = totalH > drawableH ? drawableH / totalH : 1;

    const hLvl = levelHeight * scaleY;
    const g = gap * scaleY;
    const eRy = (hLvl * topEllipseRatio) * 0.65;
    const eRxFactor = 0.52;

    const xCenter = margin.left + drawableW / 2;
    const yStart = margin.top + (drawableH - (n * hLvl + (n - 1) * g)) / 2;

    const geometry = useMemo(() => {
        if (!n) return [];

        const widths: number[] = [];
        for (let i = 0; i < n; i++) {
            const t = n === 1 ? 0 : i / (n - 1);
            const w = topWidth + (bottomWidth - topWidth) * t;
            widths.push(w);
        }

        const items = [];
        for (let i = 0; i < n; i++) {
            const y = yStart + i * (hLvl + g);
            const wTop = i === 0 ? widths[i] : widths[i - 1]; // top of module fits previous module
            const wBottom = widths[i];

            // To give the "stacked" look:
            // - the top of the module has the "cap" ellipse and below comes the trapezoidal body.
            const bodyY = y + eRy; // body starts after half of "cap"
            const bodyH = hLvl - eRy * 0.6;

            const cx = xCenter;
            const rx = (wTop * eRxFactor);
            const cy = y + eRy;

            // Body aligned by bottom width (wBottom) at center
            const xBottom = cx - wBottom / 2;

            items.push({
                i,
                y,
                cx,
                wTop,
                wBottom,
                bodyPath: trapezoidPath(xBottom, bodyY, wTop, wBottom, bodyH, 14),
                topEllipse: {
                    path: ellipsePath(cx, cy, rx, eRy),
                    cx,
                    cy,
                    rx,
                    ry: eRy,
                },
                connector: {
                    // exit point on the right side of the module (body middle)
                    x0: cx + Math.max(wTop, wBottom) * 0.5 - 6,
                    y0: bodyY + bodyH * 0.55,
                },
            });
        }
        return items;
    }, [n, topWidth, bottomWidth, hLvl, g, eRy, xCenter, yStart, eRxFactor]);

    // Connectors to the right
    const connectorEndX = width - margin.right + 40; // Adjusted for component width
    const circleX = width - margin.right + 60; // Adjusted for component width

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>

            {/* Funnel */}
            {geometry.map((it) => {
                const level = levels[it.i];
                if (!level) return null;
                const fill = level.color;
                const topFill = level.topColor || fill;

                return (
                    <g key={it.i}>
                        {/* Body */}
                        <path
                            d={it.bodyPath}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={strokeWidth}
                            strokeLinejoin="round"
                        />

                        {/* Cap (top ellipse of module) */}
                        <path
                            d={it.topEllipse.path}
                            fill={topFill}
                            stroke={stroke}
                            strokeWidth={strokeWidth}
                        />
                    </g>
                );
            })}

            {/* Connectors + dots */}
            {geometry.map((it) => {
                const level = levels[it.i];
                if (!level) return null;
                const dotColor = level.color;

                const x0 = it.connector.x0;
                const y0 = it.connector.y0;

                const x1 = x0 + connectorStartOffset;
                const x2 = x1 + connectorKneeX;

                return (
                    <g key={`c-${it.i}`}>
                        <path
                            d={`M ${x0} ${y0} L ${x1} ${y0} L ${x2} ${y0} L ${connectorEndX} ${y0}`}
                            fill="none"
                            stroke={stroke}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <circle
                            cx={circleX}
                            cy={y0}
                            r={circleRadius}
                            fill={dotColor}
                            stroke={stroke}
                            strokeWidth={strokeWidth}
                        />
                        {showLabels && (
                            <text
                                x={circleX + circleRadius + 10}
                                y={y0 + 6}
                                fontFamily={fontFamily}
                                fontSize={16}
                                fill={stroke}
                            >
                                {level.label ?? `Level ${it.i + 1}`}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}
