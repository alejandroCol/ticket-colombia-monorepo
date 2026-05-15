import React, { useState, useCallback, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { httpsCallable } from 'firebase/functions';
import { functions, getEventOrRecurringById, getEventAvailability } from '@services';
import type { Event, VenueMapZone } from '@services/types';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import CustomSelector from '@components/CustomSelector';
import Loader from '@components/Loader';
import './index.scss';

interface BulkUploadCortesiasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Llamado al cerrar desde el modal de éxito (permite cerrar también el modal padre) */
  onSuccessClose?: () => void;
  eventId: string;
  eventName: string;
  /**
   * Datos de localidades ya cargados (p. ej. desde Crear ticket). Si no se pasa, el modal consulta el evento.
   */
  prefetchedEventSections?: Pick<Event, 'sections' | 'venue_map'>;
}

interface CortesiaRow {
  email: string;
  nombre: string;
  telefono?: string;
  cedula?: string;
  cortesia_del_evento: string;
  regalado_por?: string;
  /** Obligatorio si el evento tiene `sections` */
  sectionId?: string;
  sectionName?: string;
  mapZoneId?: string;
  /** 1, o `seats_per_unit` si hay celda de mapa (exige el backend) */
  quantity: number;
  /** Fila 1-based en Excel (útil en errores de API) */
  sourceExcelRow: number;
}

function zonesForSection(eventPick: Pick<Event, 'venue_map'>, sectionId: string): VenueMapZone[] {
  const sid = String(sectionId).trim();
  return (eventPick.venue_map?.zones ?? []).filter((z) => String(z.sectionId ?? '').trim() === sid);
}

function normalizeHeader(h: string): string {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

const TEMPLATE_HEADERS = ['email', 'nombre', 'telefono', 'cedula', 'cortesia_del_evento', 'regalado_por'];
const TEMPLATE_HINTS = [
  '(obligatorio)',
  '(obligatorio)',
  '(opcional)',
  '(opcional)',
  'Sí o No',
  '(si «No» arriba)',
];
const TEMPLATE_SAMPLE = [
  ['juan@ejemplo.com', 'Juan Pérez', '3001234567', '1234567890', 'Sí', ''],
  ['maria@ejemplo.com', 'María García', '3109876543', '9876543210', 'No', 'Patrocinador XYZ'],
];

const BulkUploadCortesiasModal: React.FC<BulkUploadCortesiasModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSuccessClose,
  eventId,
  eventName,
  prefetchedEventSections,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<CortesiaRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [failedRows, setFailedRows] = useState<{ row: number; email: string; error: string }[]>([]);
  const [eventPick, setEventPick] = useState<Pick<Event, 'sections' | 'venue_map'> | null>(null);
  const [eventMetaStatus, setEventMetaStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [bulkSectionId, setBulkSectionId] = useState('');
  const [bulkMapZoneId, setBulkMapZoneId] = useState('');
  const [bulkMapAvailLoading, setBulkMapAvailLoading] = useState(false);
  const [bulkMapZoneOccupancy, setBulkMapZoneOccupancy] = useState<Record<string, number> | null>(null);
  const [bulkAvailLoadFailed, setBulkAvailLoadFailed] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setBulkSectionId('');
      setBulkMapZoneId('');
      setBulkMapZoneOccupancy(null);
      setBulkMapAvailLoading(false);
      setBulkAvailLoadFailed(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !eventId) return;

    if (prefetchedEventSections) {
      setEventPick(prefetchedEventSections);
      setEventMetaStatus('ok');
      return;
    }

    let cancelled = false;
    setEventMetaStatus('loading');
    void getEventOrRecurringById(eventId)
      .then((ev) => {
        if (cancelled) return;
        if (!ev) {
          setEventPick(null);
          setEventMetaStatus('err');
          return;
        }
        const pick = { sections: ev.sections, venue_map: ev.venue_map };
        setEventPick(pick);
        setEventMetaStatus('ok');
      })
      .catch(() => {
        if (!cancelled) {
          setEventPick(null);
          setEventMetaStatus('err');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, eventId, prefetchedEventSections]);

  const sectionsList = useMemo(() => eventPick?.sections ?? [], [eventPick?.sections]);

  useEffect(() => {
    if (!isOpen || eventMetaStatus !== 'ok') return;
    if (sectionsList.length === 1) {
      setBulkSectionId((prev) => prev || sectionsList[0].id);
    }
  }, [isOpen, eventMetaStatus, sectionsList]);

  const selectedSectionRow = useMemo(
    () => sectionsList.find((s) => s.id === bulkSectionId),
    [sectionsList, bulkSectionId]
  );

  const sectionZonesSorted = useMemo(() => {
    if (!bulkSectionId.trim()) return [];
    return zonesForSection(eventPick ?? {}, bulkSectionId).sort(
      (a, b) => (Number(a.palco_index) || 0) - (Number(b.palco_index) || 0)
    );
  }, [eventPick, bulkSectionId]);

  const needsMapZonePick = sectionZonesSorted.length > 1;
  const seatsPerUnit = Math.max(1, Number(selectedSectionRow?.seats_per_unit) || 1);

  useEffect(() => {
    if (!needsMapZonePick || !eventId?.trim()) {
      setBulkMapZoneOccupancy(null);
      setBulkMapAvailLoading(false);
      setBulkAvailLoadFailed(false);
      return;
    }
    let cancelled = false;
    setBulkMapAvailLoading(true);
    setBulkMapZoneOccupancy(null);
    setBulkAvailLoadFailed(false);
    void getEventAvailability(eventId)
      .then((a) => {
        if (!cancelled) setBulkMapZoneOccupancy(a.byMapZone || {});
      })
      .catch(() => {
        if (!cancelled) {
          setBulkMapZoneOccupancy(null);
          setBulkAvailLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setBulkMapAvailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsMapZonePick, eventId, bulkSectionId]);

  const availableSectionZones = useMemo(() => {
    if (!needsMapZonePick || bulkMapAvailLoading || bulkAvailLoadFailed || bulkMapZoneOccupancy === null) {
      return [];
    }
    return sectionZonesSorted.filter((z) => (bulkMapZoneOccupancy[z.id] ?? 0) < 1);
  }, [needsMapZonePick, sectionZonesSorted, bulkMapAvailLoading, bulkAvailLoadFailed, bulkMapZoneOccupancy]);

  useEffect(() => {
    if (!bulkMapZoneId || bulkMapAvailLoading || bulkMapZoneOccupancy === null) return;
    const ok = availableSectionZones.some((z) => z.id === bulkMapZoneId);
    if (!ok) setBulkMapZoneId('');
  }, [bulkMapZoneId, availableSectionZones, bulkMapAvailLoading, bulkMapZoneOccupancy]);

  useEffect(() => {
    setFile(null);
    setParsedRows([]);
    setError(null);
  }, [bulkSectionId, bulkMapZoneId]);

  const hasSections = sectionsList.length > 0;

  const placementReady = useMemo(() => {
    if (eventMetaStatus !== 'ok') return false;
    if (!hasSections) return true;
    if (!bulkSectionId.trim()) return false;
    if (!needsMapZonePick) return true;
    return (
      !!bulkMapZoneId.trim() &&
      !bulkMapAvailLoading &&
      !bulkAvailLoadFailed &&
      bulkMapZoneOccupancy !== null &&
      availableSectionZones.some((z) => z.id === bulkMapZoneId)
    );
  }, [
    eventMetaStatus,
    hasSections,
    bulkSectionId,
    needsMapZonePick,
    bulkMapZoneId,
    bulkMapAvailLoading,
    bulkAvailLoadFailed,
    bulkMapZoneOccupancy,
    availableSectionZones,
  ]);

  const selectedMapZoneLabel = useMemo(() => {
    if (!bulkMapZoneId) return '';
    const z = sectionZonesSorted.find((zz) => zz.id === bulkMapZoneId);
    return (
      (z?.label && z.label.trim()) ||
      (z?.palco_index !== undefined ? `Número ${z.palco_index}` : bulkMapZoneId.slice(0, 12))
    );
  }, [bulkMapZoneId, sectionZonesSorted]);

  const downloadTemplate = useCallback(() => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_HINTS, ...TEMPLATE_SAMPLE]);
    ws['!cols'] = [
      { wch: 28 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
      { wch: 22 },
      { wch: 22 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cortesías');
    XLSX.writeFile(wb, 'plantilla-cortesias.xlsx');
  }, []);

  const parseWorkbookToRows = useCallback(
    (json: unknown[][]): CortesiaRow[] | null => {
      if (!json || json.length < 2) {
        setError('El archivo debe tener al menos una fila de datos (además del encabezado)');
        return null;
      }

      const headers =
        (json[0] as unknown[])?.map((h: unknown) => normalizeHeader(String(h || '').replace(/^\uFEFF/, ''))) ||
        [];

      const emailIdx = headers.findIndex((h) => h === 'email' || h === 'correo');
      const nombreIdx = headers.findIndex((h) => h === 'nombre');
      const telefonoIdx = headers.findIndex((h) => h === 'telefono');
      const cedulaIdx = headers.findIndex((h) => h === 'cedula');
      const cortesiaIdx = headers.findIndex((h) => h === 'cortesia_del_evento');
      const regaladoIdx = headers.findIndex((h) => h === 'regalado_por');

      if (emailIdx < 0 || nombreIdx < 0) {
        setError('El archivo debe tener columnas "email" y "nombre"');
        return null;
      }

      let sectionId: string | undefined;
      let sectionName: string | undefined;
      let mapZoneId: string | undefined;
      let quantity = 1;

      if (hasSections) {
        if (!bulkSectionId.trim() || !selectedSectionRow) {
          setError('Selecciona una localidad en el modal antes de cargar el archivo.');
          return null;
        }
        sectionId = bulkSectionId;
        sectionName = selectedSectionRow.name;
        if (needsMapZonePick) {
          if (!bulkMapZoneId.trim()) {
            setError('Selecciona la mesa o palco en el mapa antes de cargar el archivo.');
            return null;
          }
          mapZoneId = bulkMapZoneId;
          quantity = seatsPerUnit;
        }
      }

      const rows: CortesiaRow[] = [];
      const rowAfterHeader = json[1] as unknown[] | undefined;
      const emailColGuess =
        rowAfterHeader && emailIdx >= 0 ? String(rowAfterHeader[emailIdx] ?? '').trim() : '';
      const dataStartRow = emailColGuess.includes('@') ? 1 : 2;

      for (let i = dataStartRow; i < json.length; i++) {
        const row = json[i];
        if (!row || !Array.isArray(row)) continue;

        const email = String(row[emailIdx] ?? '').trim();
        const nombre = String(row[nombreIdx] ?? '').trim();
        if (!email || !nombre) continue;
        if (!email.includes('@')) continue;

        const excelRowNum = i + 1;

        const cortesiaRaw = cortesiaIdx >= 0 ? row[cortesiaIdx] : 'Sí';
        const cortesiaVal = String(cortesiaRaw ?? 'Sí').trim().toLowerCase();
        const isGeneral =
          cortesiaVal === 'sí' || cortesiaVal === 'si' || cortesiaVal === 's' || cortesiaVal === '1';

        rows.push({
          email,
          nombre,
          telefono: row[telefonoIdx] ? String(row[telefonoIdx]).trim() : undefined,
          cedula: row[cedulaIdx] ? String(row[cedulaIdx]).trim() : undefined,
          cortesia_del_evento: isGeneral ? 'Sí' : 'No',
          regalado_por: row[regaladoIdx] ? String(row[regaladoIdx]).trim() : undefined,
          sectionId,
          sectionName,
          mapZoneId,
          quantity,
          sourceExcelRow: excelRowNum,
        });
      }

      if (rows.length === 0) {
        setError('No se encontraron filas válidas (email y nombre obligatorios)');
        return null;
      }

      if (needsMapZonePick && rows.length > 1) {
        setError(
          'Esta localidad usa una celda del mapa por cortesía: el Excel solo puede tener una fila por subida. Para más invitados en otras celdas, vuelve a cargar el archivo eligiendo otra mesa/palco.'
        );
        return null;
      }

      return rows;
    },
    [
      hasSections,
      bulkSectionId,
      selectedSectionRow,
      needsMapZonePick,
      bulkMapZoneId,
      seatsPerUnit,
    ]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    setParsedRows([]);
    setFile(null);

    if (!selectedFile) return;

    if (!placementReady || !eventPick) {
      setError('Completa localidad y celda del mapa (si aplica) antes de elegir el archivo.');
      return;
    }

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    const isValid =
      validTypes.includes(selectedFile.type) ||
      selectedFile.name.endsWith('.xlsx') ||
      selectedFile.name.endsWith('.xls') ||
      selectedFile.name.endsWith('.csv');

    if (!isValid) {
      setError('Formato no válido. Usa .xlsx, .xls o .csv');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        if (!data) return;

        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as unknown[][];

        const rows = parseWorkbookToRows(json);
        if (!rows) return;

        setParsedRows(rows);
        setFile(selectedFile);
      } catch (err) {
        console.error('Error parsing Excel:', err);
        setError('Error al leer el archivo. Verifica el formato.');
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleUpload = async () => {
    if (parsedRows.length === 0) return;

    if (needsMapZonePick && parsedRows.length > 1) {
      setError(
        'Esta localidad solo permite una cortesía por celda del mapa por subida. Reduce el Excel a una fila o cambia de localidad.'
      );
      return;
    }

    if (!placementReady) {
      setError('Completa la selección de localidad antes de crear las cortesías.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessCount(0);
    setFailedRows([]);
    setProgress({ current: 0, total: parsedRows.length });

    const createManualTicket = httpsCallable(functions, 'createManualTicket');
    let success = 0;
    const failed: { row: number; email: string; error: string }[] = [];

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      setProgress({ current: i + 1, total: parsedRows.length });

      try {
        await createManualTicket({
          eventId,
          buyerName: row.nombre,
          buyerEmail: row.email,
          buyerPhone: row.telefono || '',
          buyerIdNumber: row.cedula || '',
          quantity: row.quantity,
          sectionId: row.sectionId,
          sectionName: row.sectionName,
          mapZoneId: row.mapZoneId,
          isCourtesy: true,
          isGeneralCourtesy: row.cortesia_del_evento === 'Sí',
          giftedBy: row.cortesia_del_evento === 'No' ? row.regalado_por : undefined,
        });
        success++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        failed.push({ row: row.sourceExcelRow ?? i + 3, email: row.email, error: String(msg) });
      }
    }

    setSuccessCount(success);
    setFailedRows(failed);
    setUploading(false);

    if (success > 0) {
      onSuccess();
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedRows([]);
    setError(null);
    setSuccessCount(0);
    setFailedRows([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="bulk-upload-modal-overlay" onClick={handleClose}>
      <div className="bulk-upload-modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📤 Cargar cortesías desde Excel</h2>
          <button className="close-button" onClick={handleClose}>✕</button>
        </div>

        <div className="modal-body">
          <p className="event-context">Evento: <strong>{eventName}</strong></p>

          {eventMetaStatus === 'loading' && (
            <p className="hint bulk-upload-meta">
              <Loader size="small" /> Cargando datos del evento…
            </p>
          )}
          {eventMetaStatus === 'err' && (
            <div className="error-message">⚠️ No se pudieron cargar los datos del evento. Cierra el modal e inténtalo de nuevo.</div>
          )}

          {eventMetaStatus === 'ok' && hasSections && (
            <div className="bulk-upload-placement">
              <h3>1. Localidad del lote</h3>
              <p className="hint">Elige la misma localidad para todas las filas del Excel (no hace falta poner ids en la plantilla).</p>
              <CustomSelector
                label="Localidad *"
                value={bulkSectionId}
                onChange={(e) => {
                  setBulkSectionId(e.target.value);
                  setBulkMapZoneId('');
                }}
                options={[
                  { value: '', label: 'Selecciona una localidad' },
                  ...sectionsList.map((section) => ({
                    value: section.id,
                    label: `${section.name} — ${section.available} disponibles`,
                  })),
                ]}
                required
              />

              {bulkSectionId && needsMapZonePick && bulkAvailLoadFailed && (
                <p className="bulk-upload-inline-warning" role="alert">
                  No se pudo consultar ocupación del mapa. Reintenta más tarde o recarga la página.
                </p>
              )}

              {bulkSectionId && needsMapZonePick && bulkMapAvailLoading && (
                <p className="hint bulk-upload-meta">
                  <Loader size="small" /> Consultando mesas/palcos disponibles…
                </p>
              )}

              {bulkSectionId &&
                needsMapZonePick &&
                !bulkMapAvailLoading &&
                !bulkAvailLoadFailed &&
                bulkMapZoneOccupancy !== null &&
                !availableSectionZones.length && (
                  <p className="bulk-upload-inline-warning" role="alert">
                    No hay celdas libres en esta localidad por ahora (misma regla que la tienda).
                  </p>
                )}

              {bulkSectionId &&
                needsMapZonePick &&
                !bulkMapAvailLoading &&
                !bulkAvailLoadFailed &&
                !!availableSectionZones.length && (
                  <CustomSelector
                    label="Mesa / palco en el mapa *"
                    value={bulkMapZoneId}
                    onChange={(e) => setBulkMapZoneId(e.target.value)}
                    options={[
                      { value: '', label: 'Selecciona una celda disponible' },
                      ...availableSectionZones.map((z) => ({
                        value: z.id,
                        label:
                          (z.label && z.label.trim()) ||
                          (z.palco_index !== undefined ? `Número ${z.palco_index}` : z.id.slice(0, 10)),
                      })),
                    ]}
                    required
                  />
                )}

              {needsMapZonePick && placementReady && (
                <p className="hint bulk-upload-map-limit">
                  Esta localidad reserva <strong>una celda</strong> por cortesía: el archivo solo puede tener <strong>una fila</strong> por vez.
                  Para más invitados, repite la carga eligiendo otra mesa/palco.
                </p>
              )}
            </div>
          )}

          <div className="template-section">
            <h3>{hasSections ? '2. Plantilla' : '1. Plantilla'}</h3>
            <SecondaryButton onClick={downloadTemplate}>
              📥 Descargar plantilla Excel
            </SecondaryButton>
            <p className="hint">
              Solo datos del invitado (email, nombre, etc.). La localidad ya la elegiste arriba.
            </p>
          </div>

          <div className="upload-section">
            <h3>{hasSections ? '3. Sube el archivo' : '2. Sube el archivo'}</h3>
            <label
              className={`file-input-label ${!placementReady || uploading ? 'is-disabled' : ''}`}
            >
              <span className="file-input-text">
                {file ? `${file.name} (${parsedRows.length} filas)` : 'Seleccionar archivo .xlsx'}
              </span>
              <input
                className="file-input-native"
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={handleFileChange}
                disabled={uploading || !placementReady}
              />
            </label>
            {!placementReady && eventMetaStatus === 'ok' && hasSections && (
              <p className="hint bulk-upload-file-hint">
                Completa la localidad (y la celda del mapa si aplica) para habilitar la carga del archivo.
              </p>
            )}
          </div>

          {error && (
            <div className="error-message">⚠️ {error}</div>
          )}

          {parsedRows.length > 0 && !uploading && (
            <div className="preview-section">
              <h3>Vista previa ({parsedRows.length} cortesías)</h3>
              {hasSections && (
                <p className="preview-batch-summary">
                  Lote en <strong>{parsedRows[0]?.sectionName || '—'}</strong>
                  {needsMapZonePick && bulkMapZoneId ? (
                    <>
                      {' '}
                      · Celda: <strong>{selectedMapZoneLabel}</strong>
                    </>
                  ) : null}
                  {' '}
                  · {parsedRows[0]?.quantity === 1 ? '1 entrada por fila' : `${parsedRows[0]?.quantity} entradas por fila (palco/mesa)`}
                </p>
              )}
              <div className="preview-table-wrap">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Nombre</th>
                      <th>Cortesía ev.</th>
                      <th>Regalado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td>{r.email}</td>
                        <td>{r.nombre}</td>
                        <td>{r.cortesia_del_evento}</td>
                        <td>{r.regalado_por || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 5 && (
                  <p className="preview-more">... y {parsedRows.length - 5} más</p>
                )}
              </div>
            </div>
          )}

          {uploading && (
            <div className="progress-section">
              <Loader size="small" />
              <p>Creando cortesías {progress.current}/{progress.total}...</p>
            </div>
          )}

          {successCount > 0 && !uploading && (
            <div className="success-modal-overlay">
              <div className="success-modal">
                <div className="success-modal-icon">✅</div>
                <h3>¡Cortesías creadas!</h3>
                <p className="success-count">{successCount} cortesía(s) creada(s) correctamente.</p>
                {failedRows.length > 0 && (
                  <div className="failed-section">
                    <p>❌ {failedRows.length} fallaron:</p>
                    <ul>
                      {failedRows.map((f, i) => (
                        <li key={i}>Fila {f.row} ({f.email}): {f.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <PrimaryButton onClick={() => {
                  handleClose();
                  onSuccessClose?.();
                }}>
                  Cerrar
                </PrimaryButton>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <SecondaryButton onClick={handleClose} disabled={uploading}>
            {successCount > 0 ? 'Cerrar' : 'Cancelar'}
          </SecondaryButton>
          {parsedRows.length > 0 && successCount === 0 && (
            <PrimaryButton onClick={handleUpload} disabled={uploading || !placementReady}>
              Crear {parsedRows.length} cortesía(s)
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkUploadCortesiasModal;
