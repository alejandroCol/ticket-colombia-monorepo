import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopNavBar from '@containers/TopNavBar';
import PrimaryButton from '@components/PrimaryButton';
import SecondaryButton from '@components/SecondaryButton';
import CustomInput from '@components/CustomInput';
import EventSubNav from '@components/EventSubNav';
import { getDefaultPublicTicketOrigin } from '../../config/publicTicketApp';
import {
  getCurrentUser,
  getEventOrRecurringById,
  isSuperAdmin,
  logoutUser,
  resolveEventCollection,
} from '@services';
import type { Event } from '@services/types';
import './index.scss';

function eventSlug(ev: Event | null): string {
  if (!ev) return '';
  const raw = (ev as Record<string, unknown>).slug;
  return typeof raw === 'string' ? raw.trim() : '';
}

const EventWidgetEmbedScreen: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [baseUrl, setBaseUrl] = useState(() => getDefaultPublicTicketOrigin());
  const [copied, setCopied] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showOrganizerExtras, setShowOrganizerExtras] = useState(false);
  /** Marco del embed en sitios externos (solo afecta al script / shadow DOM, no a ticketcolombia.co). */
  const [embedFrame, setEmbedFrame] = useState<'solid' | 'glass'>('solid');

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setAccessDenied(false);
    try {
      const user = getCurrentUser();
      if (!user) {
        navigate('/login');
        return;
      }
      const [ev, coll, superA] = await Promise.all([
        getEventOrRecurringById(eventId),
        resolveEventCollection(eventId),
        isSuperAdmin(user.uid),
      ]);
      if (!ev || !coll) {
        setAccessDenied(true);
        return;
      }
      setIsRecurring(coll === 'recurring_events');
      setEventTitle(ev.name || 'Evento');
      setSlug(eventSlug(ev));
      const org = String(ev.organizer_id || '').trim();
      const canSee = superA || org === user.uid;
      setShowOrganizerExtras(canSee);
      if (!canSee) setAccessDenied(true);
    } finally {
      setLoading(false);
    }
  }, [eventId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const scriptSnippet = useMemo(() => {
    const b = baseUrl.replace(/\/+$/, '');
    const sl = slug.trim();
    if (!b || !sl) return '';
    const src = `${b}/embed/tc-embed-widget.js`;
    const frameLine =
      embedFrame === 'glass' ? '\n  data-tc-frame="glass"' : '';
    return `<script
  src="${src}"
  data-tc-base="${b}"
  data-tc-slug="${sl.replace(/"/g, '&quot;')}"
  data-tc-inline="1"${frameLine}
  defer
></script>`;
  }, [baseUrl, slug, embedFrame]);

  const postMessageHint = useMemo(() => {
    const b = baseUrl.replace(/\/+$/, '');
    if (!b) return '';
    return `window.addEventListener('message', function (ev) {
  if (ev.origin !== '${b}') return;
  var d = ev.data;
  if (!d || d.source !== 'ticket-colombia-embed') return;
  if (d.version !== 1) return;
  if (d.kind === 'purchase_finished') {
    console.log('Compra:', d.status);
  }
});`;
  }, [baseUrl]);

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      alert('No se pudo copiar. Selecciona el texto manualmente.');
    }
  };

  if (!eventId) return null;

  if (loading) {
    return (
      <div className="event-widget-screen">
        <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
        <p className="event-widget-muted">Cargando…</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="event-widget-screen">
        <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
        <div className="event-widget-panel">
          <p>No tienes permiso para ver el código de este evento.</p>
          <SecondaryButton onClick={() => navigate('/dashboard')}>Volver al inicio</SecondaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="event-widget-screen">
      <TopNavBar logoOnly showLogout onLogout={() => logoutUser()} />
      <EventSubNav
        eventId={eventId}
        eventTitle={eventTitle}
        isRecurring={isRecurring}
        active="widget"
        showOrganizerExtras={showOrganizerExtras}
      />
      <div className="event-widget-content">
        <section className="event-widget-panel">
          <h2 className="event-widget-h2">Venta embebida en tu web</h2>
          <p className="event-widget-lead">
            Pega el script antes de <code className="event-widget-code-inline">&lt;/body&gt;</code>. El embed usa alto{' '}
            completo (<code className="event-widget-code-inline">100dvh</code>) y solo estiliza el marco alrededor del
            iframe en <strong>tu</strong> web; la ficha en{' '}
            <code className="event-widget-code-inline">ticketcolombia.co/evento/…</code> sin este script no cambia. Modo
            modal opcional: <code className="event-widget-code-inline">data-tc-modal=&quot;1&quot;</code>.
          </p>

          <div className="event-widget-fields">
            <CustomInput
              name="tc_base"
              label="URL de la app pública (sin / final)"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://ticketcolombia.co"
            />
            <CustomInput
              name="tc_slug"
              label="Slug del evento (ruta /evento/... y /compra/...)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="mi-evento-2026"
            />
            <div className="event-widget-field">
              <label className="event-widget-field-label" htmlFor="tc_embed_frame">
                Marco del embed (solo sitio del organizador)
              </label>
              <select
                id="tc_embed_frame"
                className="event-widget-select"
                value={embedFrame}
                onChange={(e) => setEmbedFrame(e.target.value === 'glass' ? 'glass' : 'solid')}
              >
                <option value="solid">Sólido (borde Ticket Colombia)</option>
                <option value="glass">Cristal / vidrio (blur tipo iOS)</option>
              </select>
              <p className="event-widget-field-hint">
                Añade <code className="event-widget-code-inline">data-tc-frame=&quot;glass&quot;</code>: marco
                translúcido con blur respecto al fondo de tu web (el iframe sigue opaco; se ve una franja tipo iOS).
              </p>
            </div>
          </div>

          {!slug.trim() && (
            <p className="event-widget-warn">
              Este evento no tiene slug en Firestore. Cópialo desde el formulario de edición o escríbelo aquí si lo conoces.
            </p>
          )}

          <div className="event-widget-block">
            <div className="event-widget-block-head">
              <h3>Script para pegar</h3>
              <PrimaryButton
                type="button"
                size="small"
                disabled={!scriptSnippet}
                onClick={() => void copyText('script', scriptSnippet)}
              >
                {copied === 'script' ? 'Copiado' : 'Copiar script'}
              </PrimaryButton>
            </div>
            <pre className="event-widget-pre">{scriptSnippet || 'Completa URL base y slug.'}</pre>
          </div>

          <div className="event-widget-block">
            <div className="event-widget-block-head">
              <h3>Ejemplo: escuchar compra terminada</h3>
              <SecondaryButton
                type="button"
                size="small"
                disabled={!postMessageHint}
                onClick={() => void copyText('listener', postMessageHint)}
              >
                {copied === 'listener' ? 'Copiado' : 'Copiar JS'}
              </SecondaryButton>
            </div>
            <pre className="event-widget-pre">{postMessageHint || '—'}</pre>
          </div>

          <p className="event-widget-foot">
            Archivo: <code className="event-widget-code-inline">/embed/tc-embed-widget.js</code>. Iframe:{' '}
            <code className="event-widget-code-inline">/evento/{'{slug}'}?tc_embed=1</code>. Opcional:{' '}
            <code className="event-widget-code-inline">data-tc-iframe-height=&quot;85vh&quot;</code>.
          </p>
        </section>
      </div>
    </div>
  );
};

export default EventWidgetEmbedScreen;
