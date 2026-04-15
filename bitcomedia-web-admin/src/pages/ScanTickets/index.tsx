import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@services/firebase';
import { getTicketById, validateTicket } from '@services/ticketService';
import {
  logoutUser,
  getCurrentUser,
  hasAdminAccess,
  hasPanelAccess,
  isSuperAdmin,
  partnerCanValidateTicket,
} from '@services';
import { IconCamera, IconPause } from '@components/ScanIcons';
import {
  readValidationQueue,
  pushValidationQueue,
  removeFromValidationQueue
} from '@utils/scanOfflineQueue';
import type { Ticket, Event } from '@services/types';
import type { Timestamp } from 'firebase/firestore';
import './index.scss';

function extractTicketIdFromScan(decodedText: string): string | null {
  const trimmed = decodedText.trim();
  const match = trimmed.match(/validate-ticket\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : trimmed;
}

const LS_LAST_EVENT = 'tc_scan_last_event_v1';

type LastEventMeta = { eventId: string; eventName: string };

function readLastEvent(): LastEventMeta | null {
  try {
    const raw = localStorage.getItem(LS_LAST_EVENT);
    if (!raw) return null;
    const o = JSON.parse(raw) as LastEventMeta;
    if (o?.eventId) return o;
  } catch {
    /* ignore */
  }
  return null;
}

function writeLastEvent(meta: LastEventMeta) {
  localStorage.setItem(LS_LAST_EVENT, JSON.stringify(meta));
}

const ScanTicketsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [justValidated, setJustValidated] = useState(false);
  const [manualId, setManualId] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [canValidateEvent, setCanValidateEvent] = useState<boolean | null>(null);
  const [lastEventMeta, setLastEventMeta] = useState<LastEventMeta | null>(null);
  const [queueSize, setQueueSize] = useState(0);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = 'qr-reader';
  const manualInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLastEventMeta(readLastEvent());
    setQueueSize(readValidationQueue().length);
  }, []);

  useEffect(() => {
    const onOff = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', onOff);
    window.addEventListener('offline', onOff);
    return () => {
      window.removeEventListener('online', onOff);
      window.removeEventListener('offline', onOff);
    };
  }, []);

  const flushValidationQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const pending = readValidationQueue();
    if (pending.length === 0) return;
    const user = getCurrentUser();
    if (!user) return;
    const panel = await hasPanelAccess(user.uid);
    if (!panel) return;
    for (const { ticketId } of pending) {
      try {
        await validateTicket(ticketId);
        removeFromValidationQueue(ticketId);
      } catch {
        break;
      }
    }
    setQueueSize(readValidationQueue().length);
  }, []);

  useEffect(() => {
    if (isOnline) void flushValidationQueue();
  }, [isOnline, flushValidationQueue]);

  useEffect(() => {
    const check = async () => {
      const user = getCurrentUser();
      if (!user) {
        navigate('/login');
        setAuthChecking(false);
        return;
      }
      const panel = await hasPanelAccess(user.uid);
      if (!panel) {
        await logoutUser();
        navigate('/login');
        setAuthChecking(false);
        return;
      }
      setIsAdmin(true);
      setAuthChecking(false);
    };
    void check();
  }, [navigate]);

  const fetchTicket = useCallback(async (ticketId: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setJustValidated(false);
    setCanValidateEvent(null);
    setTicket(null);
    setEvent(null);
    try {
      const ticketData = await getTicketById(ticketId);
      if (!ticketData) {
        setError('Ticket no encontrado');
        setLoading(false);
        return;
      }
      setTicket(ticketData);
      if (ticketData.eventId) {
        try {
          const eventRef = doc(db, 'events', ticketData.eventId);
          const eventSnap = await getDoc(eventRef);
          if (eventSnap.exists()) {
            setEvent({ id: eventSnap.id, ...eventSnap.data() } as Event);
          } else {
            const recRef = doc(db, 'recurring_events', ticketData.eventId);
            const recSnap = await getDoc(recRef);
            if (recSnap.exists()) {
              setEvent({ id: recSnap.id, ...recSnap.data() } as Event);
            }
          }
        } catch {
          // ignore event fetch errors
        }
      }
    } catch (err) {
      setError((err as Error).message || 'Error al cargar el ticket');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ticket || !event || loading) {
      setCanValidateEvent(null);
      return;
    }
    const check = async () => {
      const user = getCurrentUser();
      if (!user) {
        setCanValidateEvent(false);
        return;
      }
      const superA = await isSuperAdmin(user.uid);
      if (superA) {
        setCanValidateEvent(true);
        return;
      }
      if (await hasAdminAccess(user.uid)) {
        setCanValidateEvent(true);
        return;
      }
      const ownerId = event?.organizer_id;
      if (ownerId && ownerId === user.uid) {
        setCanValidateEvent(true);
        return;
      }
      const eid = ticket?.eventId;
      if (eid && (await partnerCanValidateTicket(user.uid, eid))) {
        setCanValidateEvent(true);
        return;
      }
      setCanValidateEvent(false);
    };
    void check();
  }, [ticket, event, loading, ticket?.eventId]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // ignore
      }
      scannerRef.current = null;
      setScanning(false);
    }
  }, []);

  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      const ticketId = extractTicketIdFromScan(decodedText);
      if (ticketId) {
        void fetchTicket(ticketId);
        void stopScanner();
      }
    },
    [fetchTicket, stopScanner]
  );

  const startScanner = async () => {
    if (scannerRef.current?.isScanning) return;
    setTicket(null);
    setEvent(null);
    setError(null);
    setSuccess(null);
    const tryStart = async (constraints: MediaTrackConstraints) => {
      scannerRef.current = null;
      const html5QrCode = new Html5Qrcode(scannerDivId);
      await html5QrCode.start(
        constraints,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleScanSuccess,
        () => {}
      );
      scannerRef.current = html5QrCode;
      setScanning(true);
    };
    const getErrorMessage = (err: unknown) => {
      const e = err as { name?: string; message?: string };
      if (e?.name === 'NotAllowedError') return 'Permiso de cámara denegado. Verifica la configuración del navegador.';
      if (e?.name === 'NotFoundError') return 'No se encontró ninguna cámara.';
      if (e?.name === 'NotReadableError') return 'La cámara está en uso por otra aplicación.';
      if (e?.name === 'OverconstrainedError') return 'El dispositivo no soporta los requisitos de la cámara.';
      if (e?.name === 'SecurityError') return 'Se requiere HTTPS. Abre la app desde una conexión segura.';
      return e?.message || 'No se pudo acceder a la cámara. Verifica los permisos.';
    };
    let lastError: unknown;
    const configs: MediaTrackConstraints[] = [
      { facingMode: { ideal: 'environment' } },
      { facingMode: 'environment' },
      { video: true } as MediaTrackConstraints
    ];
    for (const config of configs) {
      try {
        await tryStart(config);
        return;
      } catch (err) {
        lastError = err;
      }
    }
    scannerRef.current = null;
    setError(getErrorMessage(lastError));
  };

  const handleTapToFocus = useCallback(async () => {
    if (!scannerRef.current?.isScanning) return;
    try {
      await scannerRef.current.applyVideoConstraints({
        focusMode: 'continuous'
      } as MediaTrackConstraints);
    } catch {
      try {
        await scannerRef.current.applyVideoConstraints({
          advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet]
        });
      } catch {
        // Algunas cámaras no soportan focusMode, ignorar
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  const handleValidate = useCallback(async () => {
    if (!ticket?.id || !isAdmin) return;
    const user = getCurrentUser();
    if (!user) return;
    const superA = await isSuperAdmin(user.uid);
    const roleAdmin = await hasAdminAccess(user.uid);
    const eventOwnerId = event?.organizer_id;
    const eid = ticket?.eventId;
    let mayValidate =
      superA ||
      roleAdmin ||
      (eventOwnerId && eventOwnerId === user.uid) ||
      (!!eid && (await partnerCanValidateTicket(user.uid, eid)));
    if (!mayValidate) {
      setError('No tienes permiso para validar boletos de este evento.');
      return;
    }
    setValidating(true);
    setError(null);
    try {
      if (!navigator.onLine) {
        pushValidationQueue(ticket.id);
        setQueueSize(readValidationQueue().length);
        setSuccess('Sin conexión: validación en cola. Se enviará al recuperar red.');
        setValidating(false);
        return;
      }
      await validateTicket(ticket.id);
      removeFromValidationQueue(ticket.id);
      setQueueSize(readValidationQueue().length);
      const updated = await getTicketById(ticket.id);
      if (updated) {
        setTicket(updated);
        setJustValidated(true);
      }
      if (event?.id && event?.name) {
        const meta = { eventId: event.id, eventName: event.name };
        writeLastEvent(meta);
        setLastEventMeta(meta);
      }
      setSuccess('✓ Validado con éxito');
    } catch (err) {
      setError((err as Error).message || 'Error al validar');
    } finally {
      setValidating(false);
    }
  }, [ticket, event, isAdmin]);

  const handleManualSubmit = () => {
    const id = manualId.trim();
    if (!id) return;
    void fetchTicket(id);
    setManualId('');
    setShowManualInput(false);
  };

  const handleScanAnother = useCallback(() => {
    setTicket(null);
    setEvent(null);
    setError(null);
    setSuccess(null);
    setJustValidated(false);
    setTimeout(() => void startScanner(), 150);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === 'v' && ticket && !ticket.validatedAt && !validating) {
        const blocked =
          ticket.ticketStatus === 'used' ||
          ticket.ticketStatus === 'cancelled' ||
          ticket.ticketStatus === 'disabled';
        if (!blocked && canValidateEvent !== false) {
          e.preventDefault();
          void handleValidate();
        }
      }
      if (k === 'n' && ticket) {
        e.preventDefault();
        handleScanAnother();
      }
      if (k === 'm') {
        e.preventDefault();
        setShowManualInput((v) => !v);
        setTimeout(() => manualInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ticket, validating, canValidateEvent, handleScanAnother, handleValidate]);

  const formatDate = (ts: Timestamp | Date | null | undefined) => {
    if (!ts) return '—';
    let d: Date;
    if (ts instanceof Date) d = ts;
    else if (ts && typeof ts === 'object' && 'toDate' in ts) d = (ts as Timestamp).toDate();
    else d = new Date(String(ts));
    return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const matchesLastEvent = Boolean(
    ticket?.eventId && lastEventMeta?.eventId && ticket.eventId === lastEventMeta.eventId
  );

  if (authChecking) {
    return (
      <div className="scan-tickets-screen">
        <div className="scan-loading-full">
          <div className="scan-spinner" />
          <p>Verificando acceso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="scan-tickets-screen">
      <header className="scan-header">
        <button type="button" className="scan-back" onClick={() => navigate('/dashboard')}>
          ←
        </button>
        <h1>Leer Boletos</h1>
        <button
          type="button"
          className="scan-logout"
          onClick={async () => {
            await logoutUser();
            navigate('/login');
          }}
        >
          Salir
        </button>
      </header>

      {!isOnline && (
        <div className="scan-banner scan-banner--offline" role="status">
          Sin conexión: las validaciones se encolan y se envían al volver en línea.
        </div>
      )}
      {queueSize > 0 && (
        <div className="scan-banner scan-banner--queue" role="status">
          Cola de sincronización: {queueSize} pendiente{queueSize === 1 ? '' : 's'}.
          {isOnline && (
            <button type="button" className="scan-banner-btn" onClick={() => void flushValidationQueue()}>
              Reintentar ahora
            </button>
          )}
        </div>
      )}
      {lastEventMeta && (
        <div className="scan-last-event" role="note">
          Último evento validado: <strong>{lastEventMeta.eventName}</strong>
        </div>
      )}
      <p className="scan-shortcuts-hint" aria-hidden="true">
        Atajos: <kbd>V</kbd> validar · <kbd>N</kbd> otro boleto · <kbd>M</kbd> ID manual
      </p>
      <p className="scan-pwa-hint">
        Puedes instalar esta app (taquilla) desde el menú del navegador “Instalar” o “Añadir a inicio” para uso en tablet o móvil.
      </p>

      <main className="scan-main">
        {!ticket ? (
          <>
            <div className="scan-scanner-section">
              <div
                className="scan-qr-wrapper"
                onClick={handleTapToFocus}
                role="button"
                title="Toca para enfocar"
              >
                <div id={scannerDivId} className="scan-qr-container" />
                {scanning && <span className="scan-focus-hint">Toca para enfocar</span>}
              </div>
              {!scanning && (
                <button type="button" className="scan-start-btn" onClick={() => void startScanner()}>
                  <IconCamera size={24} />
                  Activar cámara
                </button>
              )}
              {scanning && (
                <button type="button" className="scan-stop-btn" onClick={() => void stopScanner()}>
                  <IconPause size={20} />
                  Pausar escáner
                </button>
              )}
            </div>
            <button
              type="button"
              className="scan-manual-link"
              onClick={() => setShowManualInput(!showManualInput)}
            >
              {showManualInput ? 'Ocultar' : 'Ingresar ID manualmente'}
            </button>
            {showManualInput && (
              <div className="scan-manual-form">
                <input
                  ref={manualInputRef}
                  type="text"
                  placeholder="ID del ticket"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                />
                <button type="button" onClick={handleManualSubmit}>
                  Buscar
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="scan-result">
            {loading ? (
              <div className="scan-loading">
                <div className="scan-spinner" />
                <p>Cargando ticket...</p>
              </div>
            ) : (
              <>
                {error && <div className="scan-error">{error}</div>}
                {success && !ticket?.validatedAt && <div className="scan-success">{success}</div>}
                {matchesLastEvent && (
                  <div className="scan-match-last" role="status">
                    Este boleto corresponde al último evento que validaste.
                  </div>
                )}
                {ticket && !loading && (
                  <div
                    className={`scan-ticket-card ${ticket.validatedAt ? (justValidated ? 'scan-ticket-validated' : 'scan-ticket-already-validated') : ''}`}
                  >
                    {ticket.validatedAt ? (
                      justValidated ? (
                        <div className="scan-validated-header">
                          <span className="scan-validated-icon">✓</span>
                          <h2>Validado con éxito</h2>
                        </div>
                      ) : (
                        <div className="scan-already-validated-header">
                          <span className="scan-already-validated-icon">⚠</span>
                          <h2>El ticket ya fue validado anteriormente</h2>
                          <p className="scan-validated-at">Validado el {formatDate(ticket.validatedAt)}</p>
                        </div>
                      )
                    ) : (
                      <div className="scan-status-badge pending">Pendiente</div>
                    )}
                    <div className="scan-ticket-info">
                      <h3>{event?.name || 'Evento'}</h3>
                      <div className="scan-ticket-details">
                        <div className="scan-detail-row">
                          <span className="scan-detail-label">Cédula</span>
                          <span className="scan-detail-value">{ticket.buyerIdNumber || '—'}</span>
                        </div>
                        <div className="scan-detail-row">
                          <span className="scan-detail-label">Nombre</span>
                          <span className="scan-detail-value">
                            {ticket.buyerName || ticket.metadata?.userName || ticket.buyerEmail || '—'}
                          </span>
                        </div>
                        <div className="scan-detail-row">
                          <span className="scan-detail-label">Localidad</span>
                          <span className="scan-detail-value">{ticket.sectionName || 'General'}</span>
                        </div>
                        {ticket.buyerEmail && (
                          <div className="scan-detail-row">
                            <span className="scan-detail-label">Email</span>
                            <span className="scan-detail-value">{ticket.buyerEmail}</span>
                          </div>
                        )}
                        {ticket.buyerPhone && (
                          <div className="scan-detail-row">
                            <span className="scan-detail-label">Teléfono</span>
                            <span className="scan-detail-value">{ticket.buyerPhone}</span>
                          </div>
                        )}
                        <div className="scan-detail-row">
                          <span className="scan-detail-label">Fecha compra</span>
                          <span className="scan-detail-value">{formatDate(ticket.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    {!ticket.validatedAt && (
                      <>
                        {(ticket.ticketStatus === 'cancelled' || ticket.ticketStatus === 'disabled') && (
                          <div className="scan-disabled-label">La boleta fue deshabilitada</div>
                        )}
                        {canValidateEvent === false && (
                          <div className="scan-disabled-label">
                            No tienes permiso para validar boletos de este evento
                          </div>
                        )}
                        <button
                          type="button"
                          className="scan-validate-btn"
                          onClick={() => void handleValidate()}
                          disabled={
                            validating ||
                            canValidateEvent === false ||
                            ticket.ticketStatus === 'used' ||
                            ticket.ticketStatus === 'cancelled' ||
                            ticket.ticketStatus === 'disabled'
                          }
                        >
                          {validating ? 'Validando...' : '✓ Validar entrada'}
                        </button>
                      </>
                    )}
                    <button type="button" className="scan-another-btn" onClick={handleScanAnother}>
                      Escanear otro
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ScanTicketsScreen;
