import React, { useCallback, useEffect, useRef, useState } from 'react';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import {
  deleteVenueMapTemplate,
  getVenueMapTemplate,
  listVenueMapTemplates,
  saveVenueMapTemplate,
} from '@services';
import type {
  EventSection,
  VenueMapDecoration,
  VenueMapDecorationType,
  VenueMapTemplateDocument,
  VenueMapTemplateZoneLayout,
  VenueMapVisualConfig,
  VenueMapZone,
} from '@services/types';
import DecorationPreview from './DecorationPreview';
import { compressImageForMapBackground } from '../../utils/imageCompression';
import { createDecoration, DECORATION_PALETTE, DEFAULT_VENUE_MAP_BACKGROUND } from './constants';
import { exportVenueMapToBlob } from './exportVenueMapPng';
import { adminZoneCanvasStyle } from './zoneColors';
import './index.scss';

type Selection =
  | { kind: 'dec'; id: string }
  | { kind: 'zone'; index: number }
  | null;

type DragState =
  | {
      mode: 'move-dec';
      id: string;
      startPx: number;
      startPy: number;
      origX: number;
      origY: number;
    }
  | {
      mode: 'resize-dec';
      id: string;
      startPx: number;
      startPy: number;
      origX: number;
      origY: number;
      origW: number;
      origH: number;
    }
  | {
      mode: 'move-zone';
      index: number;
      startPx: number;
      startPy: number;
      origX: number;
      origY: number;
    }
  | {
      mode: 'resize-zone';
      index: number;
      startPx: number;
      startPy: number;
      origX: number;
      origY: number;
      origW: number;
      origH: number;
    }
  | null;

function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

/** Prefijo de IDs de localidades creadas desde el mapa (se pueden limpiar al borrar la zona). */
export const MAP_SECTION_ID_PREFIX = 'sec_map_';

function isMapCreatedSectionId(id: string): boolean {
  return id.startsWith(MAP_SECTION_ID_PREFIX);
}

export interface VenueMapBuilderProps {
  sections: EventSection[];
  /** Al crear una zona se añade aquí la localidad (nombre, precio, cupo). */
  onSectionsChange: (sections: EventSection[]) => void;
  zones: VenueMapZone[];
  onZonesChange: (zones: VenueMapZone[]) => void;
  visual: VenueMapVisualConfig;
  onVisualChange: (v: VenueMapVisualConfig) => void;
  /** Precio inicial para nuevas localidades creadas con «+ Zona localidad» */
  defaultNewSectionPrice?: number;
  /** Cupo inicial (suele ser la capacidad del evento) */
  defaultNewSectionAvailable?: number;
  /** Sube PNG del mapa aplanado (exportación) */
  uploadMapPng: (file: File) => Promise<string>;
  /** Sube JPEG de fondo del lienzo (ya comprimido) */
  uploadBackgroundImage: (file: File) => Promise<string>;
  /** URL del PNG aplanado guardada en `visual.flatRenderUrl` */
  onFlatRenderExported: (url: string) => void;
  /** UID del organizador (plantillas por usuario) */
  organizerId?: string;
}

const VenueMapBuilder: React.FC<VenueMapBuilderProps> = ({
  sections,
  onSectionsChange,
  zones,
  onZonesChange,
  visual,
  onVisualChange,
  defaultNewSectionPrice = 0,
  defaultNewSectionAvailable = 100,
  uploadMapPng,
  uploadBackgroundImage,
  onFlatRenderExported,
  organizerId = '',
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const visualRef = useRef(visual);
  const zonesRef = useRef(zones);
  const sectionsRef = useRef(sections);
  visualRef.current = visual;
  zonesRef.current = zones;
  sectionsRef.current = sections;

  const [selection, setSelection] = useState<Selection>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [exporting, setExporting] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);

  const [templateNameInput, setTemplateNameInput] = useState('');
  const [templates, setTemplates] = useState<VenueMapTemplateDocument[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);

  const refreshTemplates = useCallback(async () => {
    if (!organizerId) {
      setTemplates([]);
      return;
    }
    setTemplatesLoading(true);
    try {
      const list = await listVenueMapTemplates(organizerId);
      setTemplates(list);
      setSelectedTemplateId((prev) => {
        if (prev && list.some((t) => t.id === prev)) return prev;
        return list[0]?.id ?? '';
      });
    } catch (e) {
      console.error(e);
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, [organizerId]);

  useEffect(() => {
    void refreshTemplates();
  }, [refreshTemplates]);

  /** Con piezas encima de las zonas, Alt/Option deja pasar el clic a la zona azul debajo. */
  const [altForZones, setAltForZones] = useState(false);
  useEffect(() => {
    const sync = (e: KeyboardEvent) => setAltForZones(e.altKey);
    const reset = () => setAltForZones(false);
    window.addEventListener('keydown', sync);
    window.addEventListener('keyup', sync);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', sync);
      window.removeEventListener('keyup', sync);
      window.removeEventListener('blur', reset);
    };
  }, []);

  const buildZoneLayoutsFromState = useCallback((): VenueMapTemplateZoneLayout[] => {
    return zones.map((z) => {
      const sec = sections.find((s) => s.id === z.sectionId);
      return {
        label: sec?.name || z.label || 'Localidad',
        x: z.x,
        y: z.y,
        w: z.w,
        h: z.h,
        defaultPrice: sec?.price ?? defaultNewSectionPrice,
        defaultAvailable: sec?.available ?? defaultNewSectionAvailable,
        ...(z.color?.trim() ? { color: z.color.trim() } : {}),
      };
    });
  }, [zones, sections, defaultNewSectionPrice, defaultNewSectionAvailable]);

  const clientToPct = useCallback((clientX: number, clientY: number) => {
    const el = canvasRef.current;
    if (!el) return { px: 0, py: 0 };
    const r = el.getBoundingClientRect();
    return {
      px: ((clientX - r.left) / r.width) * 100,
      py: ((clientY - r.top) / r.height) * 100,
    };
  }, []);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const { px, py } = clientToPct(e.clientX, e.clientY);
      const vNow = visualRef.current;
      const zNow = zonesRef.current;
      if (drag.mode === 'move-dec') {
        const d = vNow.decorations.find((x) => x.id === drag.id);
        if (!d) return;
        const dx = px - drag.startPx;
        const dy = py - drag.startPy;
        const nx = clamp(drag.origX + dx, 0, 100 - d.w);
        const ny = clamp(drag.origY + dy, 0, 100 - d.h);
        onVisualChange({
          ...vNow,
          decorations: vNow.decorations.map((d) =>
            d.id === drag.id ? { ...d, x: nx, y: ny } : d
          ),
        });
      } else if (drag.mode === 'resize-dec') {
        const dx = px - drag.startPx;
        const dy = py - drag.startPy;
        const nw = clamp(drag.origW + dx, 4, 100 - drag.origX);
        const nh = clamp(drag.origH + dy, 4, 100 - drag.origY);
        onVisualChange({
          ...vNow,
          decorations: vNow.decorations.map((d) =>
            d.id === drag.id ? { ...d, w: nw, h: nh } : d
          ),
        });
      } else if (drag.mode === 'move-zone') {
        const dx = px - drag.startPx;
        const dy = py - drag.startPy;
        const z = zNow[drag.index];
        if (!z) return;
        const nw = z.w;
        const nh = z.h;
        const nx = clamp(drag.origX + dx, 0, 100 - nw);
        const ny = clamp(drag.origY + dy, 0, 100 - nh);
        const next = [...zNow];
        next[drag.index] = { ...z, x: nx, y: ny };
        onZonesChange(next);
      } else if (drag.mode === 'resize-zone') {
        const dx = px - drag.startPx;
        const dy = py - drag.startPy;
        const z = zNow[drag.index];
        if (!z) return;
        const nw = clamp(drag.origW + dx, 4, 100 - drag.origX);
        const nh = clamp(drag.origH + dy, 4, 100 - drag.origY);
        const next = [...zNow];
        next[drag.index] = { ...z, w: nw, h: nh };
        onZonesChange(next);
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, clientToPct, onVisualChange, onZonesChange]);

  const removeZoneByIndex = useCallback(
    (index: number) => {
      const zList = zonesRef.current;
      const sList = sectionsRef.current;
      const z = zList[index];
      if (!z) return;
      const newZones = zList.filter((_, i) => i !== index);
      onZonesChange(newZones);
      const sid = z.sectionId;
      if (
        sid &&
        isMapCreatedSectionId(sid) &&
        !newZones.some((zz) => zz.sectionId === sid)
      ) {
        onSectionsChange(sList.filter((s) => s.id !== sid));
      }
    },
    [onZonesChange, onSectionsChange]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
      if (!selection) return;
      e.preventDefault();
      if (selection.kind === 'dec') {
        const vNow = visualRef.current;
        onVisualChange({
          ...vNow,
          decorations: vNow.decorations.filter((d) => d.id !== selection.id),
        });
        setSelection(null);
      } else {
        removeZoneByIndex(selection.index);
        setSelection(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, onVisualChange, removeZoneByIndex]);

  const addWidget = (type: VenueMapDecorationType) => {
    const dec = createDecoration(type);
    onVisualChange({
      ...visual,
      decorations: [...visual.decorations, dec],
    });
    setSelection({ kind: 'dec', id: dec.id });
  };

  const addZone = () => {
    const mapCreated = sections.filter((s) => isMapCreatedSectionId(s.id));
    const defaultName = mapCreated.length === 0 ? 'General' : `Localidad ${mapCreated.length + 1}`;
    const sectionId = `${MAP_SECTION_ID_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const price = Number(defaultNewSectionPrice) || 0;
    const available = Math.max(0, Math.floor(Number(defaultNewSectionAvailable) || 0)) || 100;

    const newSection: EventSection = {
      id: sectionId,
      name: defaultName,
      available,
      price,
    };
    onSectionsChange([...sections, newSection]);

    const z: VenueMapZone = {
      id: `z_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: defaultName,
      sectionId,
      x: 40,
      y: 40,
      w: 18,
      h: 14,
    };
    onZonesChange([...zones, z]);
    setSelection({ kind: 'zone', index: zones.length });
  };

  const selectedDec =
    selection?.kind === 'dec' ? visual.decorations.find((d) => d.id === selection.id) : undefined;
  const selectedZone = selection?.kind === 'zone' ? zones[selection.index] : undefined;

  const updateSelectedDec = (patch: Partial<VenueMapDecoration>) => {
    if (!selectedDec) return;
    onVisualChange({
      ...visual,
      decorations: visual.decorations.map((d) => (d.id === selectedDec.id ? { ...d, ...patch } : d)),
    });
  };

  const updateSelectedZone = (patch: Partial<VenueMapZone>) => {
    if (selection?.kind !== 'zone') return;
    const next = [...zones];
    const cur = next[selection.index];
    if (!cur) return;
    next[selection.index] = { ...cur, ...patch };
    onZonesChange(next);
  };

  const updateLinkedSection = (sectionId: string, patch: Partial<EventSection>) => {
    onSectionsChange(sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)));
  };

  const onDecPointerDown = (e: React.PointerEvent, id: string) => {
    setSelection({ kind: 'dec', id });
    const d = visual.decorations.find((x) => x.id === id);
    if (!d) return;
    const { px, py } = clientToPct(e.clientX, e.clientY);
    setDrag({ mode: 'move-dec', id, startPx: px, startPy: py, origX: d.x, origY: d.y });
  };

  const onDecResizePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const d = visual.decorations.find((x) => x.id === id);
    if (!d) return;
    const { px, py } = clientToPct(e.clientX, e.clientY);
    setDrag({
      mode: 'resize-dec',
      id,
      startPx: px,
      startPy: py,
      origX: d.x,
      origY: d.y,
      origW: d.w,
      origH: d.h,
    });
  };

  const onZonePointerDown = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    setSelection({ kind: 'zone', index });
    const z = zones[index];
    if (!z) return;
    const { px, py } = clientToPct(e.clientX, e.clientY);
    setDrag({
      mode: 'move-zone',
      index,
      startPx: px,
      startPy: py,
      origX: z.x,
      origY: z.y,
    });
  };

  const onZoneResizePointerDown = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    const z = zones[index];
    if (!z) return;
    const { px, py } = clientToPct(e.clientX, e.clientY);
    setDrag({
      mode: 'resize-zone',
      index,
      startPx: px,
      startPy: py,
      origX: z.x,
      origY: z.y,
      origW: z.w,
      origH: z.h,
    });
  };

  const handleBackgroundFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) {
      if (file) alert('Elige un archivo de imagen (JPG, PNG, WebP…).');
      return;
    }
    setBgUploading(true);
    try {
      const compressed = await compressImageForMapBackground(file);
      const url = await uploadBackgroundImage(compressed);
      onVisualChange({ ...visual, backgroundImageUrl: url });
    } catch (err) {
      console.error(err);
      alert(`Error al subir el fondo: ${(err as Error).message}`);
    } finally {
      setBgUploading(false);
    }
  };

  const handleExportPng = async () => {
    if (visual.decorations.length === 0 && !visual.backgroundImageUrl?.trim()) {
      alert('Agrega piezas al mapa o una imagen de fondo antes de guardar.');
      return;
    }
    setExporting(true);
    try {
      const blob = await exportVenueMapToBlob(visual);
      if (!blob) throw new Error('No se pudo generar la imagen');
      const file = new File([blob], `venue_map_${Date.now()}.png`, { type: 'image/png' });
      const url = await uploadMapPng(file);
      onFlatRenderExported(url);
      alert(
        'PNG subido. En la tienda se mostrará este mapa aplanado (prioridad sobre el diseño editable). Guarda el evento.'
      );
    } catch (err) {
      console.error(err);
      alert(`Error al guardar: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!organizerId) return;
    const name = templateNameInput.trim();
    if (!name) {
      alert('Escribe un nombre para la plantilla (ej: Sala principal — planta baja).');
      return;
    }
    setTemplateBusy(true);
    try {
      await saveVenueMapTemplate({
        name,
        organizer_id: organizerId,
        visual,
        zone_layouts: buildZoneLayoutsFromState(),
      });
      setTemplateNameInput('');
      await refreshTemplates();
      alert('Plantilla guardada. Ábrela en otro evento y solo cambia precios o nombres si quieres.');
    } catch (err) {
      console.error(err);
      alert(`No se pudo guardar la plantilla: ${(err as Error).message}`);
    } finally {
      setTemplateBusy(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!organizerId || !selectedTemplateId) {
      alert('Selecciona una plantilla de la lista.');
      return;
    }
    if (
      !window.confirm(
        'Se reemplazarán el diseño del mapa y todas las zonas del lienzo. Las localidades creadas desde el mapa (prefijo sec_map_) se sustituyen por las de la plantilla; las que solo añadiste en la lista de localidades (sin mapa) se conservan. ¿Continuar?'
      )
    ) {
      return;
    }
    setTemplateBusy(true);
    try {
      const t = await getVenueMapTemplate(selectedTemplateId, organizerId);
      if (!t) {
        alert('No se pudo cargar la plantilla.');
        return;
      }
      const priceDefault = Number(defaultNewSectionPrice) || 0;
      const availDefault = Math.max(1, Number(defaultNewSectionAvailable) || 0) || 100;

      const baseSections = sections.filter((s) => !isMapCreatedSectionId(s.id));

      const ts = Date.now();
      const newSections: EventSection[] = t.zone_layouts.map((zl, i) => ({
        id: `${MAP_SECTION_ID_PREFIX}${ts}_${i}_${Math.random().toString(36).slice(2, 9)}`,
        name: (zl.label || '').trim() || `Localidad ${i + 1}`,
        price: zl.defaultPrice ?? priceDefault,
        available: zl.defaultAvailable ?? availDefault,
      }));

      const newZones: VenueMapZone[] = t.zone_layouts.map((zl, i) => ({
        id: `z_${ts}_${i}_${Math.random().toString(36).slice(2, 9)}`,
        label: newSections[i].name,
        sectionId: newSections[i].id,
        x: clamp(zl.x, 0, 100),
        y: clamp(zl.y, 0, 100),
        w: clamp(zl.w, 4, 100),
        h: clamp(zl.h, 4, 100),
        ...(zl.color?.trim() ? { color: zl.color.trim() } : {}),
      }));

      onSectionsChange([...baseSections, ...newSections]);
      onZonesChange(newZones);
      onVisualChange({
        background: t.visual.background || DEFAULT_VENUE_MAP_BACKGROUND,
        backgroundImageUrl: t.visual.backgroundImageUrl || '',
        flatRenderUrl: '',
        decorations: Array.isArray(t.visual.decorations)
          ? t.visual.decorations.map((d) => ({ ...d }))
          : [],
      });
      setSelection(null);
      alert(
        'Plantilla aplicada. Revisa precios y cupos en el panel de la zona o en «Localidades», luego guarda el evento.'
      );
    } catch (err) {
      console.error(err);
      alert(`Error al aplicar: ${(err as Error).message}`);
    } finally {
      setTemplateBusy(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!organizerId || !selectedTemplateId) return;
    const tMeta = templates.find((x) => x.id === selectedTemplateId);
    if (
      !window.confirm(
        `¿Eliminar la plantilla «${tMeta?.name || selectedTemplateId}»? No afecta eventos ya guardados.`
      )
    ) {
      return;
    }
    setTemplateBusy(true);
    try {
      await deleteVenueMapTemplate(selectedTemplateId, organizerId);
      setSelectedTemplateId('');
      await refreshTemplates();
    } catch (err) {
      console.error(err);
      alert(`No se pudo eliminar: ${(err as Error).message}`);
    } finally {
      setTemplateBusy(false);
    }
  };

  const sortedDecorations = [...visual.decorations].sort(
    (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)
  );

  return (
    <div className="vmb">
      <p className="vmb__intro">
        Diseña el plano con piezas arrastrables. Puedes subir una <strong>imagen de fondo</strong> (se comprime al
        subir). Cada <strong>zona azul</strong> crea o enlaza una <strong>localidad</strong>: en la tienda el comprador
        elige al tocar la zona. <strong>Generar PNG</strong> sube un mapa aplanado con prioridad en la app; si no, se
        usa el diseño editable. Pulsa <strong>Guardar</strong> en el evento para persistir.
      </p>

      <div>
        <span className="vmb__toolbar-label">Fondo del lienzo</span>
        <div className="vmb__toolbar">
          <label>
            <span className="vmb__hint" style={{ marginRight: 8 }}>
              Color
            </span>
            <input
              type="color"
              value={visual.background || DEFAULT_VENUE_MAP_BACKGROUND}
              onChange={(e) => onVisualChange({ ...visual, background: e.target.value })}
            />
          </label>
          <SecondaryButton
            type="button"
            size="small"
            onClick={() => onVisualChange({ ...visual, background: DEFAULT_VENUE_MAP_BACKGROUND })}
          >
            Reset color
          </SecondaryButton>
          <input
            ref={bgFileRef}
            type="file"
            accept="image/*"
            className="vmb__hidden-file"
            aria-hidden
            onChange={(e) => void handleBackgroundFile(e)}
          />
          <SecondaryButton
            type="button"
            size="small"
            onClick={() => bgFileRef.current?.click()}
            disabled={bgUploading}
          >
            {bgUploading ? 'Subiendo…' : 'Subir imagen de fondo'}
          </SecondaryButton>
          {visual.backgroundImageUrl?.trim() ? (
            <SecondaryButton
              type="button"
              size="small"
              onClick={() => onVisualChange({ ...visual, backgroundImageUrl: '' })}
            >
              Quitar imagen de fondo
            </SecondaryButton>
          ) : null}
        </div>
        {visual.flatRenderUrl?.trim() ? (
          <p className="vmb__hint vmb__hint--block">
            Hay un <strong>mapa aplanado (PNG)</strong> guardado: en la tienda se muestra esa imagen sobre el diseño
            editable.{' '}
            <button
              type="button"
              className="vmb__linkish"
              onClick={() => onVisualChange({ ...visual, flatRenderUrl: '' })}
            >
              Quitar mapa aplanado
            </button>
          </p>
        ) : null}
      </div>

      <div>
        <span className="vmb__toolbar-label">Agregar elemento</span>
        <div className="vmb__toolbar">
          {DECORATION_PALETTE.map((p) => (
            <button
              key={p.type}
              type="button"
              className="vmb__chip"
              title={p.hint}
              onClick={() => addWidget(p.type)}
            >
              + {p.label}
            </button>
          ))}
          <SecondaryButton type="button" size="small" onClick={addZone}>
            + Zona localidad (crea localidad en el formulario)
          </SecondaryButton>
        </div>
      </div>

      <div className="vmb__templates">
        <span className="vmb__toolbar-label">Plantillas (mismo lugar, varios eventos)</span>
        {!organizerId ? (
          <p className="vmb__hint">Inicia sesión para guardar y cargar plantillas.</p>
        ) : (
          <>
            <p className="vmb__hint">
              Guarda el dibujo y las posiciones de zonas con sus precios/cupo actuales. En otro evento, aplica la
              plantilla y solo ajusta nombres o precios.
            </p>
            <div className="vmb__templates-row">
              <input
                type="text"
                className="vmb__templates-input"
                placeholder="Nombre de la plantilla…"
                value={templateNameInput}
                onChange={(e) => setTemplateNameInput(e.target.value)}
                disabled={templateBusy}
              />
              <SecondaryButton
                type="button"
                size="small"
                onClick={() => void handleSaveTemplate()}
                disabled={templateBusy || templatesLoading}
              >
                Guardar como plantilla
              </SecondaryButton>
            </div>
            <div className="vmb__templates-row">
              <select
                className="vmb__templates-select"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                disabled={templatesLoading || templateBusy || templates.length === 0}
              >
                {templates.length === 0 ? (
                  <option value="">{templatesLoading ? 'Cargando…' : 'Sin plantillas guardadas'}</option>
                ) : (
                  <>
                    <option value="">— Elegir plantilla —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.zone_layouts.length} zona{t.zone_layouts.length === 1 ? '' : 's'})
                      </option>
                    ))}
                  </>
                )}
              </select>
              <SecondaryButton
                type="button"
                size="small"
                onClick={() => void handleApplyTemplate()}
                disabled={templateBusy || !selectedTemplateId || templatesLoading}
              >
                Aplicar plantilla
              </SecondaryButton>
              <SecondaryButton
                type="button"
                size="small"
                onClick={() => void handleDeleteTemplate()}
                disabled={templateBusy || !selectedTemplateId || templatesLoading}
              >
                Eliminar plantilla
              </SecondaryButton>
            </div>
          </>
        )}
      </div>

      <div className="vmb__row">
        <div className="vmb__canvas-wrap">
          <div
            ref={canvasRef}
            className={`vmb__canvas${drag ? ' vmb__canvas--dragging' : ''}`}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSelection(null);
            }}
            role="application"
            aria-label="Lienzo del mapa del venue"
          >
            <div className="vmb__bg" style={{ background: visual.background || DEFAULT_VENUE_MAP_BACKGROUND }} />
            {visual.backgroundImageUrl?.trim() ? (
              <img
                className="vmb__bg-img"
                src={visual.backgroundImageUrl.trim()}
                alt=""
                aria-hidden
              />
            ) : null}
            <div className="vmb__zones-layer">
              {zones.map((z, index) => {
                const zSelected = selection?.kind === 'zone' && selection.index === index;
                const customStyle = adminZoneCanvasStyle(z.color, zSelected);
                const hasCustomColor = Object.keys(customStyle).length > 0;
                return (
                <div
                  key={z.id}
                  role="button"
                  tabIndex={0}
                  className={`vmb-zone${zSelected ? ' vmb-zone--selected' : ''}${hasCustomColor ? ' vmb-zone--custom' : ''}`}
                  style={{
                    left: `${z.x}%`,
                    top: `${z.y}%`,
                    width: `${z.w}%`,
                    height: `${z.h}%`,
                    ...customStyle,
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onZonePointerDown(e as unknown as React.PointerEvent, index);
                  }}
                >
                  <span className="vmb-zone__tag">
                    {sections.find((s) => s.id === z.sectionId)?.name || z.label || 'Zona'}
                  </span>
                  <button
                    type="button"
                    className="vmb-zone__resize"
                    aria-label="Redimensionar zona"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onZoneResizePointerDown(e as unknown as React.PointerEvent, index);
                    }}
                  />
                </div>
              );
              })}
            </div>
            <div
              className={`vmb__decorations-layer${altForZones ? ' vmb__decorations-layer--zones-priority' : ''}`}
            >
              {sortedDecorations.map((d) => (
                <DecorationPreview
                  key={d.id}
                  d={d}
                  selected={selection?.kind === 'dec' && selection.id === d.id}
                  onPointerDown={onDecPointerDown}
                  onResizePointerDown={onDecResizePointerDown}
                />
              ))}
            </div>
          </div>
          <p className="vmb__hint">
            Arrastra piezas y zonas; esquina inferior derecha para redimensionar. Las piezas quedan encima al hacer
            clic; mantén <strong>Alt</strong> (Mac: Option) para pulsar una <strong>zona</strong> tapada por una
            pieza. Suprimir elimina lo seleccionado.
          </p>
        </div>

        <aside className="vmb__inspector">
          {selectedDec ? (
            <>
              <h4>Elemento seleccionado</h4>
              <label>
                Etiqueta
                <input
                  type="text"
                  value={selectedDec.label || ''}
                  onChange={(e) => updateSelectedDec({ label: e.target.value })}
                />
              </label>
              <label>
                Rotación (°)
                <input
                  type="number"
                  value={selectedDec.rotation ?? 0}
                  onChange={(e) =>
                    updateSelectedDec({ rotation: Number(e.target.value.replace(/,/g, '.')) || 0 })
                  }
                />
              </label>
              <label>
                Color
                <input
                  type="color"
                  value={selectedDec.color || '#4a4a5c'}
                  onChange={(e) => updateSelectedDec({ color: e.target.value })}
                />
              </label>
              <label>
                Capa (z-index)
                <input
                  type="number"
                  value={selectedDec.zIndex ?? 5}
                  onChange={(e) =>
                    updateSelectedDec({ zIndex: Math.round(Number(e.target.value) || 0) })
                  }
                />
              </label>
              <SecondaryButton
                type="button"
                size="small"
                onClick={() => {
                  onVisualChange({
                    ...visual,
                    decorations: visual.decorations.filter((d) => d.id !== selectedDec.id),
                  });
                  setSelection(null);
                }}
              >
                Eliminar elemento
              </SecondaryButton>
            </>
          ) : selectedZone ? (
            <>
              <h4>Zona → localidad (app pública)</h4>
              <p className="vmb__hint" style={{ marginTop: 0 }}>
                Lo que edites aquí actualiza la lista de localidades del evento. Al tocar esta zona en la app se
                selecciona la misma entrada que en las tarjetas de abajo.
              </p>
              <label>
                Nombre en mapa y venta
                <input
                  type="text"
                  value={
                    sections.find((s) => s.id === selectedZone.sectionId)?.name ??
                    selectedZone.label
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (selectedZone.sectionId) {
                      updateLinkedSection(selectedZone.sectionId, { name: v });
                    }
                    updateSelectedZone({ label: v });
                  }}
                  placeholder="Ej: General, Palco norte"
                />
              </label>
              <label>
                Precio (COP)
                <input
                  type="text"
                  inputMode="numeric"
                  value={String(
                    sections.find((s) => s.id === selectedZone.sectionId)?.price ?? 0
                  )}
                  onChange={(e) => {
                    const n = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                    if (selectedZone.sectionId) {
                      updateLinkedSection(selectedZone.sectionId, { price: n });
                    }
                  }}
                />
              </label>
              <label>
                Cupo (entradas)
                <input
                  type="text"
                  inputMode="numeric"
                  value={String(
                    sections.find((s) => s.id === selectedZone.sectionId)?.available ?? 0
                  )}
                  onChange={(e) => {
                    const n = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                    if (selectedZone.sectionId) {
                      updateLinkedSection(selectedZone.sectionId, { available: n });
                    }
                  }}
                />
              </label>
              <label>
                Enlazar a otra localidad ya creada
                <select
                  value={selectedZone.sectionId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    const sec = sections.find((s) => s.id === newId);
                    updateSelectedZone({
                      sectionId: newId,
                      label: sec?.name || selectedZone.label,
                    });
                  }}
                >
                  <option value="">— Seleccionar —</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.id} — {new Intl.NumberFormat('es-CO').format(s.price)} COP
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Color en el mapa
                <input
                  type="color"
                  value={
                    selectedZone.color && /^#[0-9a-fA-F]{6}$/.test(selectedZone.color)
                      ? selectedZone.color
                      : '#00c8ff'
                  }
                  onChange={(e) => updateSelectedZone({ color: e.target.value })}
                />
              </label>
              <SecondaryButton
                type="button"
                size="small"
                onClick={() => updateSelectedZone({ color: '' })}
              >
                Color por defecto (cyan)
              </SecondaryButton>
              <SecondaryButton
                type="button"
                size="small"
                onClick={() => {
                  if (selection?.kind !== 'zone') return;
                  removeZoneByIndex(selection.index);
                  setSelection(null);
                }}
              >
                Eliminar zona del mapa
              </SecondaryButton>
            </>
          ) : (
            <p className="vmb__hint">Selecciona un elemento o una zona en el lienzo para editarla.</p>
          )}
        </aside>
      </div>

      <div className="vmb__actions">
        <PrimaryButton type="button" onClick={() => void handleExportPng()} disabled={exporting}>
          {exporting ? 'Guardando…' : 'Guardar'}
        </PrimaryButton>
        <p className="vmb__hint vmb__hint--export">
          Al guardar se genera un <strong>PNG</strong> (instantánea del lienzo: fondo + piezas) y se sube a Storage. En la
          tienda, las <strong>zonas de localidad siguen siendo botones por encima</strong>: el comprador elige
          localidad al tocarlas; el PNG solo es la imagen de fondo. Si no guardas, la tienda dibuja el mapa editable
          (vectorial) igual de interactivo.
        </p>
      </div>
    </div>
  );
};

export default VenueMapBuilder;
export { DEFAULT_VENUE_MAP_BACKGROUND };
