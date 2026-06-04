import type { VenueMapZone } from '../services/types';

export function zonesForSectionId(zones: VenueMapZone[], sectionId: string): VenueMapZone[] {
  const sid = String(sectionId || '').trim();
  if (!sid) return [];
  return zones.filter((z) => String(z.sectionId ?? '').trim() === sid);
}

export function sectionRequiresMapZonePick(zones: VenueMapZone[], sectionId: string): boolean {
  const zs = zonesForSectionId(zones, sectionId);
  return zs.length > 1 || zs.some((z) => z.palco_index != null);
}

export function palcoCellsForSection(zones: VenueMapZone[], sectionId: string): VenueMapZone[] {
  const zs = zonesForSectionId(zones, sectionId);
  const withIndex = zs.filter((z) => z.palco_index != null);
  return withIndex.length > 0 ? withIndex : zs.length > 1 ? zs : [];
}

export function isMapZoneUnavailable(
  zone: VenueMapZone,
  occupancy: Record<string, number>
): boolean {
  if (zone.disabled === true) return true;
  return (occupancy[zone.id] ?? 0) >= 1;
}
