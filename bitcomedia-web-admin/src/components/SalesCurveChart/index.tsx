import React, { useMemo } from 'react';
import type { DailySalesPoint } from '@utils/salesTimeSeries';
import './index.scss';

type Props = {
  points: DailySalesPoint[];
  formatCOP: (n: number) => string;
};

const W = 720;
const H = 260;
const PAD_L = 56;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 44;
const INNER_W = W - PAD_L - PAD_R;
const INNER_H = H - PAD_T - PAD_B;

function formatAxisCop(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(Math.round(n));
}

const SalesCurveChart: React.FC<Props> = ({ points, formatCOP }) => {
  const chartGeom = useMemo(() => {
    if (points.length === 0) {
      return {
        linePath: '',
        areaPath: '',
        yTicks: [] as number[],
        maxY: 1,
        xs: [] as number[],
        ys: [] as number[],
      };
    }

    const maxRev = Math.max(...points.map((p) => p.revenue), 1);
    const exp = Math.floor(Math.log10(maxRev));
    const pow = 10 ** exp;
    const niceMax = Math.max(Math.ceil(maxRev / pow) * pow, 1);

    const yTicks: number[] = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      yTicks.push(Math.round((niceMax * i) / steps));
    }

    const n = points.length;
    const xs = points.map((_, i) =>
      n <= 1 ? PAD_L + INNER_W / 2 : PAD_L + (i * INNER_W) / (n - 1)
    );
    const ys = points.map((p) => PAD_T + INNER_H - (p.revenue / niceMax) * INNER_H);

    const lineD = points
      .map((_, i) => `${i === 0 ? 'M' : 'L'} ${xs[i].toFixed(2)} ${ys[i].toFixed(2)}`)
      .join(' ');

    const baseY = PAD_T + INNER_H;
    const areaD = `M ${xs[0].toFixed(2)} ${baseY} L ${points
      .map((_, i) => `${xs[i].toFixed(2)} ${ys[i].toFixed(2)}`)
      .join(' L ')} L ${xs[xs.length - 1].toFixed(2)} ${baseY} Z`;

    return {
      linePath: lineD,
      areaPath: areaD,
      yTicks,
      maxY: niceMax,
      xs,
      ys,
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="sales-curve-chart sales-curve-chart--empty">
        <p>No hay datos en el rango seleccionado.</p>
      </div>
    );
  }

  const { linePath, areaPath, yTicks, maxY, xs, ys } = chartGeom;
  const tickEvery = points.length > 14 ? Math.ceil(points.length / 7) : 1;

  return (
    <div className="sales-curve-chart">
      <svg
        className="sales-curve-chart__svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <defs>
          <linearGradient id="salesCurveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(46, 204, 113, 0.35)" />
            <stop offset="100%" stopColor="rgba(46, 204, 113, 0.02)" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = PAD_T + INNER_H - (tick / maxY) * INNER_H;
          return (
            <g key={tick}>
              <line
                x1={PAD_L}
                y1={y}
                x2={W - PAD_R}
                y2={y}
                className="sales-curve-chart__grid"
              />
              <text x={PAD_L - 6} y={y + 4} className="sales-curve-chart__y-label" textAnchor="end">
                {tick === 0 ? '0' : formatAxisCop(tick)}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#salesCurveFill)" />
        <path d={linePath} fill="none" className="sales-curve-chart__line" strokeWidth={2.5} />

        {points.map((p, i) => (
          <circle key={p.dayKey} cx={xs[i]} cy={ys[i]} r={3.5} className="sales-curve-chart__dot">
            <title>
              {p.dayKey}: {formatCOP(p.revenue)} · {p.ticketUnits} entradas
            </title>
          </circle>
        ))}

        {points.map((p, i) =>
          i % tickEvery === 0 || i === points.length - 1 ? (
            <text
              key={`xl-${p.dayKey}`}
              x={xs[i]}
              y={H - 12}
              className="sales-curve-chart__x-label"
              textAnchor="middle"
            >
              {p.labelShort}
            </text>
          ) : null
        )}
      </svg>
      <p className="sales-curve-chart__legend">
        Eje vertical: monto cobrado (COP) por día de creación del boleto. Pasa el cursor por los puntos para ver el
        detalle.
      </p>
    </div>
  );
};

export default SalesCurveChart;
