import React, { useId, useMemo } from 'react';
import './index.scss';

export type SectionRadarDatum = {
  name: string;
  /** 0–100 */
  percentSold: number;
  sold: number;
  capacity: number;
};

type Props = {
  sections: SectionRadarDatum[];
};

const VIEW = 420;
const CX = VIEW / 2;
const CY = VIEW / 2;
/** Radio máximo del polígono (sin etiquetas) */
const R = 128;
const LABEL_R = R + 36;

function truncate(name: string, max = 18): string {
  const t = name.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

const SectionRadarChart: React.FC<Props> = ({ sections }) => {
  const gradId = useId().replace(/:/g, '');

  const chart = useMemo(() => {
    const list = sections.filter((s) => s.name);
    if (list.length === 0) {
      return { kind: 'empty' as const };
    }

    const capped = [...list].sort((a, b) => b.sold - a.sold).slice(0, 12);

    if (capped.length === 1) {
      return { kind: 'single' as const, s: capped[0] };
    }

    const n = capped.length;
    const pts: { x: number; y: number }[] = [];
    const labels: { x: number; y: number; name: string; pct: number }[] = [];

    for (let i = 0; i < n; i++) {
      const t = Math.max(0, Math.min(100, capped[i].percentSold)) / 100;
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
      const x = CX + R * t * Math.cos(angle);
      const y = CY + R * t * Math.sin(angle);
      pts.push({ x, y });

      const lx = CX + LABEL_R * Math.cos(angle);
      const ly = CY + LABEL_R * Math.sin(angle);
      labels.push({
        x: lx,
        y: ly,
        name: truncate(capped[i].name),
        pct: capped[i].percentSold,
      });
    }

    const d =
      pts.length === 0
        ? ''
        : pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + ' Z';

    const grids: string[] = [0.35, 0.65, 1].map((scale) => {
      const ring: { x: number; y: number }[] = [];
      for (let i = 0; i < n; i++) {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
        ring.push({
          x: CX + R * scale * Math.cos(angle),
          y: CY + R * scale * Math.sin(angle),
        });
      }
      return ring.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + ' Z';
    });

    return { kind: 'multi' as const, n, pathD: d, points: pts, gridPaths: grids, labelAnchors: labels };
  }, [sections]);

  if (chart.kind === 'empty') {
    return (
      <div className="section-radar-chart section-radar-chart--empty">
        <p>No hay secciones para graficar.</p>
      </div>
    );
  }

  if (chart.kind === 'single') {
    const pct = Math.max(0, Math.min(100, chart.s.percentSold));
    const ringR = 100;
    const c = 2 * Math.PI * ringR;
    const dash = (pct / 100) * c;
    const name = truncate(chart.s.name, 28);
    return (
      <div className="section-radar-chart section-radar-chart--single">
        <svg
          className="section-radar-chart__svg"
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          role="img"
          aria-label={`Ocupación ${name}: ${pct.toFixed(0)} por ciento`}
        >
          <defs>
            <linearGradient id={`${gradId}-ring`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00d4ff" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <circle className="section-radar-chart__ring-track" cx={CX} cy={CY} r={ringR} fill="none" />
          <circle
            className="section-radar-chart__ring-progress"
            cx={CX}
            cy={CY}
            r={ringR}
            fill="none"
            stroke={`url(#${gradId}-ring)`}
            strokeDasharray={`${dash} ${c}`}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
          <text className="section-radar-chart__single-pct" x={CX} y={CY - 6} textAnchor="middle">
            {pct.toFixed(0)}%
          </text>
          <text className="section-radar-chart__single-name" x={CX} y={CY + 22} textAnchor="middle">
            {name}
          </text>
          <text className="section-radar-chart__single-sub" x={CX} y={CY + 42} textAnchor="middle">
            {chart.s.sold} vendidas
            {chart.s.capacity > 0 ? ` · aforo ${chart.s.capacity}` : ''}
          </text>
        </svg>
        <p className="section-radar-chart__caption">
          Ocupación de la única localidad configurada; con varias tribunas el gráfico pasa a forma de polígono.
        </p>
      </div>
    );
  }

  const { n, pathD, points, gridPaths, labelAnchors } = chart;

  return (
    <div className="section-radar-chart">
      <svg
        className="section-radar-chart__svg"
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        role="img"
        aria-label="Gráfico radial de ocupación por localidad o tribuna"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(0, 212, 255, 0.45)" />
            <stop offset="55%" stopColor="rgba(34, 197, 94, 0.28)" />
            <stop offset="100%" stopColor="rgba(139, 92, 246, 0.22)" />
          </linearGradient>
        </defs>

        {gridPaths.map((gp, idx) => (
          <path key={idx} className="section-radar-chart__grid" d={gp} />
        ))}

        {labelAnchors.map((_, i) => {
          const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
          const x1 = CX;
          const y1 = CY;
          const x2 = CX + R * Math.cos(angle);
          const y2 = CY + R * Math.sin(angle);
          return (
            <line
              key={`spoke-${i}`}
              className="section-radar-chart__spoke"
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            />
          );
        })}

        <path className="section-radar-chart__fill" d={pathD} fill={`url(#${gradId})`} />
        <path className="section-radar-chart__stroke" d={pathD} fill="none" />

        {points.map((p, i) => (
          <circle key={`dot-${i}`} className="section-radar-chart__vertex" cx={p.x} cy={p.y} r={4.5} />
        ))}

        {labelAnchors.map((L, i) => {
          const anchor =
            Math.abs(L.x - CX) < 8 ? 'middle' : L.x < CX ? 'end' : 'start';
          const dy = L.y < CY - 20 ? '0.35em' : L.y > CY + 20 ? '-0.2em' : '0.3em';
          return (
            <text
              key={`lbl-${i}`}
              className="section-radar-chart__label"
              x={L.x}
              y={L.y}
              textAnchor={anchor as 'start' | 'middle' | 'end'}
              dy={dy}
            >
              <tspan x={L.x} dy="0">
                {L.name}
              </tspan>
              <tspan x={L.x} dy="1.15em" className="section-radar-chart__label-pct">
                {L.pct.toFixed(0)}% ocup.
              </tspan>
            </text>
          );
        })}
      </svg>
      <p className="section-radar-chart__caption">
        Cada vértice es una localidad; la distancia al centro es el % vendido sobre aforo (capacidad de la sección).
      </p>
    </div>
  );
};

export default SectionRadarChart;
