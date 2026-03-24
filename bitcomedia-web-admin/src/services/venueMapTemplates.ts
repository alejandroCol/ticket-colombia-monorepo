import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from './firestore';
import type {
  VenueMapTemplateDocument,
  VenueMapTemplateZoneLayout,
  VenueMapVisualConfig,
} from './types';

const COLLECTION = 'venue_map_templates';

export async function saveVenueMapTemplate(params: {
  name: string;
  organizer_id: string;
  visual: VenueMapVisualConfig;
  zone_layouts: VenueMapTemplateZoneLayout[];
}): Promise<string> {
  const name = params.name.trim();
  if (!name) throw new Error('Indica un nombre para la plantilla');
  if (!params.organizer_id) throw new Error('Usuario no identificado');
  const ref = await addDoc(collection(db, COLLECTION), {
    name,
    organizer_id: params.organizer_id,
    created_at: Timestamp.now(),
    visual: JSON.parse(JSON.stringify(params.visual)) as VenueMapVisualConfig,
    zone_layouts: params.zone_layouts.map((z) => ({ ...z })),
  });
  return ref.id;
}

export async function listVenueMapTemplates(
  organizerId: string
): Promise<VenueMapTemplateDocument[]> {
  if (!organizerId) return [];
  const q = query(collection(db, COLLECTION), where('organizer_id', '==', organizerId));
  const snap = await getDocs(q);
  const paired = snap.docs.map((d) => ({ d, data: d.data() }));
  paired.sort((a, b) => {
    const ma = (a.data.created_at as Timestamp | undefined)?.toMillis?.() ?? 0;
    const mb = (b.data.created_at as Timestamp | undefined)?.toMillis?.() ?? 0;
    return mb - ma;
  });
  return paired.map(({ d, data }) => ({
    id: d.id,
    name: String(data.name || ''),
    organizer_id: String(data.organizer_id || ''),
    visual: (data.visual || {
      background: '#1a1a28',
      decorations: [],
    }) as VenueMapVisualConfig,
    zone_layouts: Array.isArray(data.zone_layouts)
      ? (data.zone_layouts as VenueMapTemplateZoneLayout[])
      : [],
  }));
}

export async function getVenueMapTemplate(
  templateId: string,
  organizerId: string
): Promise<VenueMapTemplateDocument | null> {
  if (!templateId || !organizerId) return null;
  const ref = doc(db, COLLECTION, templateId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.organizer_id !== organizerId) return null;
  return {
    id: snap.id,
    name: String(data.name || ''),
    organizer_id: String(data.organizer_id || ''),
    visual: (data.visual || { background: '#1a1a28', decorations: [] }) as VenueMapVisualConfig,
    zone_layouts: Array.isArray(data.zone_layouts)
      ? (data.zone_layouts as VenueMapTemplateZoneLayout[])
      : [],
  };
}

export async function deleteVenueMapTemplate(
  templateId: string,
  organizerId: string
): Promise<void> {
  if (!templateId || !organizerId) throw new Error('Datos inválidos');
  const ref = doc(db, COLLECTION, templateId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Plantilla no encontrada');
  if (snap.data().organizer_id !== organizerId) throw new Error('No tienes permiso para borrar esta plantilla');
  await deleteDoc(ref);
}
