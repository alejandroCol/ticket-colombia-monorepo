/**
 * Ticket Colombia – widget embebible (vanilla JS, Shadow DOM).
 *
 * INSTALACIÓN (pegar antes de </body>):
 *
 * <script
 *   src="https://TU_DOMINIO_TICKET/embed/tc-embed-widget.js"
 *   data-tc-base="https://TU_DOMINIO_TICKET"
 *   data-tc-slug="slug-del-evento"
 *   data-tc-label="Comprar entradas"
 *   defer
 * ></script>
 *
 * data-tc-slug: slug público del evento (misma ruta que /compra/{slug}).
 * data-event-id: alias de data-tc-slug (mismo valor).
 * data-tc-base: origen de la app (sin slash final). Por defecto: origen de este script.
 * data-tc-label: texto del botón (opcional).
 *
 * El sitio padre debe escuchar postMessage (origen = data-tc-base):
 *
 * window.addEventListener('message', function (ev) {
 *   if (ev.origin !== 'https://TU_DOMINIO_TICKET') return;
 *   var d = ev.data;
 *   if (!d || d.source !== 'ticket-colombia-embed') return;
 *   if (d.kind === 'purchase_finished') { ... } // d.status: approved|pending|rejected|unknown
 * });
 */
(function () {
  'use strict';

  var SOURCE = 'ticket-colombia-embed';
  var VERSION = 1;

  function normalizeBase(url) {
    if (!url) return '';
    return String(url).replace(/\/+$/, '');
  }

  function getScriptEl() {
    return (
      document.currentScript ||
      document.querySelector('script[src*="tc-embed-widget"]') ||
      document.querySelector('script[data-tc-slug],script[data-event-id]')
    );
  }

  var el = getScriptEl();
  if (!el) return;

  var base =
    normalizeBase(el.getAttribute('data-tc-base')) ||
    (function () {
      try {
        var src = el.src;
        if (!src) return '';
        var u = new URL(src, location.href);
        return u.origin;
      } catch (e) {
        return '';
      }
    })();

  if (!base) {
    console.warn('[TicketColombia] data-tc-base o src del script inválido.');
    return;
  }

  var slug = (el.getAttribute('data-tc-slug') || el.getAttribute('data-event-id') || '')
    .trim();
  if (!slug) {
    console.warn('[TicketColombia] Indica data-tc-slug o data-event-id (slug del evento).');
    return;
  }

  var label = (el.getAttribute('data-tc-label') || 'Comprar entradas').trim();
  var iframeSrc =
    base + '/compra/' + encodeURIComponent(slug) + '?tc_embed=1';

  var host = document.createElement('div');
  host.setAttribute('data-ticket-colombia-embed', '');
  el.insertAdjacentElement('afterend', host);

  var root = host.attachShadow({ mode: 'open' });

  var css = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .wrap { font-family: system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.9rem 1.35rem;
      border: none;
      border-radius: 999px;
      cursor: pointer;
      font-size: 0.92rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #051014;
      background: linear-gradient(135deg, #00e5c3 0%, #00c6ff 100%);
      box-shadow:
        0 0 0 1px rgba(0, 229, 195, 0.35),
        0 12px 32px rgba(0, 198, 255, 0.22);
      transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
    }
    .btn:hover {
      transform: translateY(-1px);
      filter: brightness(1.04);
      box-shadow:
        0 0 0 1px rgba(0, 229, 195, 0.5),
        0 16px 40px rgba(0, 198, 255, 0.28);
    }
    .btn:active { transform: translateY(0); }
    .btn:focus-visible {
      outline: 2px solid #00e5c3;
      outline-offset: 3px;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      background: rgba(3, 12, 18, 0.72);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: tcFade 0.25s ease;
    }
    .backdrop.open { display: flex; }
    @keyframes tcFade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .sheet {
      position: relative;
      width: min(1040px, 100%);
      height: min(90vh, 900px);
      border-radius: 20px;
      overflow: hidden;
      background: #050f14;
      border: 1px solid rgba(0, 229, 195, 0.22);
      box-shadow:
        0 24px 80px rgba(0, 0, 0, 0.55),
        0 0 0 1px rgba(255, 255, 255, 0.04) inset;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
    }
    .close {
      position: absolute;
      top: 0.65rem;
      right: 0.65rem;
      z-index: 2;
      width: 2.5rem;
      height: 2.5rem;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      color: #b8d4de;
      background: rgba(5, 20, 24, 0.85);
      border: 1px solid rgba(0, 229, 195, 0.25);
      font-size: 1.35rem;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .close:hover {
      color: #fff;
      background: rgba(0, 229, 195, 0.12);
    }
    .hint {
      margin-top: 0.65rem;
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.42);
      letter-spacing: 0.04em;
    }
  `;

  root.innerHTML =
    '<style>' +
    css +
    '</style>' +
    '<div class="wrap">' +
    '<button type="button" class="btn" part="trigger">' +
    escapeHtml(label) +
    '</button>' +
    '<p class="hint">Compra segura con Ticket Colombia</p>' +
    '<div class="backdrop" part="backdrop" aria-hidden="true">' +
    '<div class="sheet" role="dialog" aria-modal="true" aria-label="Checkout">' +
    '<button type="button" class="close" part="close" aria-label="Cerrar">&times;</button>' +
    '<iframe part="frame" title="Compra de entradas" src="' +
    escapeAttr(iframeSrc) +
    '" allow="payment *"></iframe>' +
    '</div></div></div>';

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  var btn = root.querySelector('.btn');
  var backdrop = root.querySelector('.backdrop');
  var closeBtn = root.querySelector('.close');
  var frame = root.querySelector('iframe');

  function openModal() {
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
  }

  btn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', function (e) {
    if (e.target === backdrop) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && backdrop.classList.contains('open')) closeModal();
  });

  window.addEventListener('message', function (ev) {
    if (normalizeBase(ev.origin) !== base) return;
    var d = ev.data;
    if (!d || d.source !== SOURCE) return;
    if (d.version !== VERSION) return;
    if (d.kind === 'purchase_finished' || d.kind === 'embed_close') {
      closeModal();
    }
  });
})();
