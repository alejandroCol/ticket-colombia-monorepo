import type { VenueMapDecoration, VenueMapDecorationType } from '@services/types';

export const DEFAULT_VENUE_MAP_BACKGROUND = '#1a1a28';

export const DECORATION_PALETTE: { type: VenueMapDecorationType; label: string; hint: string }[] = [
  { type: 'stage', label: 'Tarima', hint: 'Escenario / frente al público' },
  { type: 'palco_tier', label: 'Palcos', hint: 'Filas elevadas tipo palco' },
  { type: 'dance_floor', label: 'Pista', hint: 'Pista de baile o discoteca' },
  { type: 'bar_counter', label: 'Barra', hint: 'Barra de bebidas' },
  { type: 'dj_booth', label: 'Cabina DJ', hint: 'Mesas y cabina' },
  { type: 'theater_fan', label: 'Teatro', hint: 'Platea en abanico' },
  { type: 'vip_box', label: 'VIP / Palco', hint: 'Zona exclusiva' },
  { type: 'lounge_sofa', label: 'Lounge', hint: 'Sofás / zona chill' },
  { type: 'high_table', label: 'Mesas altas', hint: 'Tipo bar / cocktail' },
  { type: 'entrance_arch', label: 'Entrada', hint: 'Arco de acceso' },
  { type: 'stairs', label: 'Escaleras', hint: 'Escalones' },
  { type: 'balcony', label: 'Balcón', hint: 'Pasillo elevado' },
  { type: 'pillar', label: 'Columna', hint: 'Estructural' },
  { type: 'light_rig', label: 'Luces', hint: 'Truss / iluminación' },
  { type: 'pool_ring', label: 'Ring / central', hint: 'Área central circular' },
];

const defaultColor = (type: VenueMapDecorationType): string => {
  switch (type) {
    case 'stage':
      return '#4a4e6e';
    case 'palco_tier':
      return '#6b5b7a';
    case 'dance_floor':
      return '#2d3a52';
    case 'bar_counter':
      return '#5c4033';
    case 'dj_booth':
      return '#3d4456';
    case 'theater_fan':
      return '#3a4a5c';
    case 'vip_box':
      return '#8b7355';
    case 'lounge_sofa':
      return '#4a5568';
    case 'high_table':
      return '#374151';
    case 'entrance_arch':
      return '#4b5563';
    case 'stairs':
      return '#52525b';
    case 'balcony':
      return '#5c5c6e';
    case 'pillar':
      return '#3f3f46';
    case 'light_rig':
      return '#312e81';
    case 'pool_ring':
      return '#1e3a5f';
    default:
      return '#4a4a5c';
  }
};

export function createDecoration(type: VenueMapDecorationType): VenueMapDecoration {
  const id = `d_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const color = defaultColor(type);
  const base = {
    id,
    type,
    rotation: 0,
    zIndex: 5,
    color,
  };

  const presets: Record<VenueMapDecorationType, Omit<VenueMapDecoration, 'id' | 'type' | 'rotation' | 'zIndex' | 'color'> & { label?: string }> = {
    stage: { x: 32, y: 68, w: 36, h: 16, label: 'Tarima' },
    palco_tier: { x: 8, y: 18, w: 22, h: 38, label: 'Palcos' },
    dance_floor: { x: 28, y: 38, w: 44, h: 28, label: 'Pista' },
    bar_counter: { x: 2, y: 42, w: 10, h: 32, label: 'Bar' },
    dj_booth: { x: 78, y: 62, w: 18, h: 14, label: 'DJ' },
    theater_fan: { x: 18, y: 22, w: 64, h: 48, label: 'Platea' },
    vip_box: { x: 72, y: 12, w: 22, h: 18, label: 'VIP' },
    lounge_sofa: { x: 6, y: 62, w: 28, h: 14, label: 'Lounge' },
    high_table: { x: 40, y: 48, w: 12, h: 10, label: 'Mesa' },
    entrance_arch: { x: 42, y: 2, w: 16, h: 12, label: 'Entrada' },
    stairs: { x: 88, y: 40, w: 8, h: 28, label: '' },
    balcony: { x: 4, y: 6, w: 88, h: 8, label: 'Balcón' },
    pillar: { x: 48, y: 50, w: 4, h: 18, label: '' },
    light_rig: { x: 20, y: 4, w: 60, h: 8, label: 'Luces' },
    pool_ring: { x: 30, y: 36, w: 40, h: 32, label: 'Centro' },
  };

  const p = presets[type];
  return {
    ...base,
    x: p.x,
    y: p.y,
    w: p.w,
    h: p.h,
    label: p.label,
  };
}
