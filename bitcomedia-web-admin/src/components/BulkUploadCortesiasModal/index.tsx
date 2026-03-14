import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@services';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
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
}

interface CortesiaRow {
  email: string;
  nombre: string;
  telefono?: string;
  cedula?: string;
  cortesia_del_evento: string;
  regalado_por?: string;
}

const TEMPLATE_HEADERS = ['email', 'nombre', 'telefono', 'cedula', 'cortesia_del_evento', 'regalado_por'];
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
  eventName
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<CortesiaRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [failedRows, setFailedRows] = useState<{ row: number; email: string; error: string }[]>([]);

  const downloadTemplate = useCallback(() => {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ['(obligatorio)', '(obligatorio)', '(opcional)', '(opcional)', 'Sí o No', '(si No arriba)'],
      ...TEMPLATE_SAMPLE
    ]);
    ws['!cols'] = [
      { wch: 25 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 25 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cortesías');
    XLSX.writeFile(wb, 'plantilla-cortesias.xlsx');
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    setParsedRows([]);
    setFile(null);

    if (!selectedFile) return;

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    const isValid = validTypes.includes(selectedFile.type) ||
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

        if (!json || json.length < 2) {
          setError('El archivo debe tener al menos una fila de datos (además del encabezado)');
          return;
        }

        const headers = (json[0] as unknown[])?.map((h: unknown) => String(h || '').toLowerCase().trim()) || [];
        const emailIdx = headers.findIndex(h => h === 'email' || h === 'correo');
        const nombreIdx = headers.findIndex(h => h === 'nombre');
        const telefonoIdx = headers.findIndex(h => h === 'telefono' || h === 'teléfono');
        const cedulaIdx = headers.findIndex(h => h === 'cedula' || h === 'cédula');
        const cortesiaIdx = headers.findIndex(h => h === 'cortesia_del_evento' || h === 'cortesía_del_evento');
        const regaladoIdx = headers.findIndex(h => h === 'regalado_por');

        if (emailIdx < 0 || nombreIdx < 0) {
          setError('El archivo debe tener columnas "email" y "nombre"');
          return;
        }

        const rows: CortesiaRow[] = [];
        // Empezar desde fila 3 (índice 2): fila 1 = encabezados, fila 2 = hints (obligatorio/opcional)
        const dataStartRow = 2;
        for (let i = dataStartRow; i < json.length; i++) {
          const row = json[i];
          if (!row || !Array.isArray(row)) continue;

          const email = String(row[emailIdx] ?? '').trim();
          const nombre = String(row[nombreIdx] ?? '').trim();
          if (!email || !nombre) continue;
          // Ignorar filas que no tienen email válido (ej. fila de hints con "obligatorio")
          if (!email.includes('@')) continue;

          const cortesiaVal = String(row[cortesiaIdx] ?? 'Sí').trim().toLowerCase();
          const isGeneral = cortesiaVal === 'sí' || cortesiaVal === 'si' || cortesiaVal === 's' || cortesiaVal === '1';

          rows.push({
            email,
            nombre,
            telefono: row[telefonoIdx] ? String(row[telefonoIdx]).trim() : undefined,
            cedula: row[cedulaIdx] ? String(row[cedulaIdx]).trim() : undefined,
            cortesia_del_evento: isGeneral ? 'Sí' : 'No',
            regalado_por: row[regaladoIdx] ? String(row[regaladoIdx]).trim() : undefined
          });
        }

        if (rows.length === 0) {
          setError('No se encontraron filas válidas (email y nombre obligatorios)');
          return;
        }

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
          quantity: 1,
          isCourtesy: true,
          isGeneralCourtesy: row.cortesia_del_evento === 'Sí',
          giftedBy: row.cortesia_del_evento === 'No' ? row.regalado_por : undefined
        });
        success++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        failed.push({ row: i + 2, email: row.email, error: String(msg) });
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

          <div className="template-section">
            <h3>1. Descarga la plantilla</h3>
            <SecondaryButton onClick={downloadTemplate}>
              📥 Descargar plantilla Excel
            </SecondaryButton>
            <p className="hint">Rellena el archivo con los datos de cada cortesía. Cada fila = 1 boleto. Se enviará un correo por persona.</p>
          </div>

          <div className="upload-section">
            <h3>2. Sube el archivo</h3>
            <label className="file-input-label">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <span className="file-input-text">
                {file ? `${file.name} (${parsedRows.length} filas)` : 'Seleccionar archivo .xlsx'}
              </span>
            </label>
          </div>

          {error && (
            <div className="error-message">⚠️ {error}</div>
          )}

          {parsedRows.length > 0 && !uploading && (
            <div className="preview-section">
              <h3>Vista previa ({parsedRows.length} cortesías)</h3>
              <div className="preview-table-wrap">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Nombre</th>
                      <th>Cortesía evento</th>
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
            <PrimaryButton onClick={handleUpload} disabled={uploading}>
              Crear {parsedRows.length} cortesía(s)
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkUploadCortesiasModal;
