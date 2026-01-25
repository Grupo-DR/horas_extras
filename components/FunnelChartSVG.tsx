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

function trapezoidPath(cx: number, y: number, wTop: number, wBottom: number, h: number, rx = 10) {
    // Trapezoid with slightly rounded corners, centered at cx
    const halfTop = wTop / 2;
    const halfBottom = wBottom / 2;

    const leftTop = cx - halfTop;
    const rightTop = cx + halfTop;
    const leftBottom = cx - halfBottom;
    const rightBottom = cx + halfBottom;

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
    const eRxFactor = 0.48;

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



            // Connector start point calculation
            // We need to find the X coordinate of the right wall at the vertical position y0.
            // Wall is a line from (cx + wTop/2, bodyY) to (cx + wBottom/2, bodyY + bodyH).
            // y0 = bodyY + bodyH * 0.55;
            // The interpolation factor 't' is 0.55.
            const t = 0.55;

            const xRightTop = cx + wTop / 2;
            const xRightBottom = cx + wBottom / 2;

            const wallXAtT = xRightTop + (xRightBottom - xRightTop) * t;

            items.push({
                i,
                y,
                cx,
                wTop,
                wBottom,
                bodyPath: trapezoidPath(cx, bodyY, wTop, wBottom, bodyH, 14),
                topEllipse: {
                    path: ellipsePath(cx, cy, rx, eRy),
                    cx,
                    cy,
                    rx,
                    ry: eRy,
                },
                connector: {
                    // Start exactly at the wall edge, no manual offset needed, maybe -2px for overlap cleanliness
                    x0: wallXAtT,
                    y0: bodyY + bodyH * t,
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
            <defs>
                {levels.map((level, i) => {
                    const baseColor = level.color;
                    const gradId = `funnel-grad-${i}`;
                    const capGradId = `funnel-cap-${i}`;

                    // Simple logic to darken/lighten simply by relying on opacity or overlay, 
                    // but here we assume 'baseColor' is a Hex. 
                    // To do proper gradients without color manipulation lib, we'll try a generic overlay approach 
                    // OR just use the baseColor as the "mid" and assume the user passed a good color.
                    // Let's us standard SVG filters or multiple stops if we can't compute "darker" hex easily without a lib.
                    // Strategy: Use the base color but add a black/white overlay gradient, 
                    // OR rely on the fact that we can't easily darken the hex string without a helper.
                    // Improved Strategy: Just use the base color for the center, and use shadow for sides via a mask? 
                    // No, let's keep it simple: 
                    // We will use the provided `color` as the MAIN color.
                    // We will define a gradient that goes: Color (Darker) -> Color (Normal) -> Color (Darker).
                    // Since we don't have a color manipulator, we will use a trick:
                    // Solid fill with the color, PLUS an overlay gradient of black with low opacity.

                    return (
                        <React.Fragment key={i}>
                            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="black" stopOpacity="0.3" />
                                <stop offset="20%" stopColor="black" stopOpacity="0.1" />
                                <stop offset="45%" stopColor="white" stopOpacity="0.1" />
                                <stop offset="55%" stopColor="white" stopOpacity="0.1" />
                                <stop offset="80%" stopColor="black" stopOpacity="0.1" />
                                <stop offset="100%" stopColor="black" stopOpacity="0.3" />
                            </linearGradient>

                            <linearGradient id={capGradId} x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="white" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="black" stopOpacity="0.1" />
                            </linearGradient>
                        </React.Fragment>
                    );
                })}
            </defs>

            {/* Funnel */}
            {geometry.map((it) => {
                const level = levels[it.i];
                if (!level) return null;
                const fill = level.color;
                const topFill = level.topColor || fill;

                // We render the shape TWICE. 
                // 1. The solid base color.
                // 2. The gradient overlay for volume.

                return (
                    <g key={it.i}>
                        {/* Body - Base */}
                        <path
                            d={it.bodyPath}
                            fill={fill}
                            stroke="none"
                        />
                        {/* Body - Gradient Overlay */}
                        <path
                            d={it.bodyPath}
                            fill={`url(#funnel-grad-${it.i})`}
                            stroke={stroke}
                            strokeWidth={strokeWidth}
                            strokeLinejoin="round"
                        />

                        {/* Cap - Base */}
                        <path
                            d={it.topEllipse.path}
                            fill={topFill}
                            stroke="none"
                        />
                        {/* Cap - Gradient Overlay */}
                        <path
                            d={it.topEllipse.path}
                            fill={`url(#funnel-cap-${it.i})`}
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
