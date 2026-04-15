/**
 * Ticket Colombia – widget embebible (vanilla JS, Shadow DOM).
 *
 * Solo afecta al contenedor del embed en sitios de terceros. La web normal de Ticket Colombia
 * (sin este script) no cambia.
 *
 * Vista incrustada (recomendado):
 *
 * <script
 *   src="https://TU_DOMINIO_TICKET/embed/tc-embed-widget.js"
 *   data-tc-base="https://TU_DOMINIO_TICKET"
 *   data-tc-slug="slug-del-evento"
 *   data-tc-inline="1"
 *   data-tc-frame="glass"
 *   defer
 * ></script>
 *
 * data-tc-frame="solid" | "glass" — marco del iframe. glass = franja translúcida + blur del fondo de TU página.
 *   Con glass, la app en iframe usa fondo transparente (tc_embed=1 + tc_ui=glass) para que el wallpaper del host
 *   se vea tras los paneles con backdrop-filter; el marco con padding sigue marcando el borde “cristal”.
 * Por defecto: solid. Opcional en modal también.
 *
 * data-tc-iframe-height — alto: ej. 80vh, 900px, o "auto" (crece con el contenido si el iframe es mismo
 *   origen que la página; si no, se usa min. 100dvh). Por defecto en inline: 100dvh.
 *
 * postMessage: ver comentarios al final del bloque anterior en versión estándar.
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

  var inline =
    el.getAttribute('data-tc-inline') === '1' ||
    el.getAttribute('data-tc-inline') === 'true';
  var useInline = inline;
  var useModal = !useInline;

  var frameRaw = (el.getAttribute('data-tc-frame') || 'solid').trim().toLowerCase();
  var useGlass =
    frameRaw === 'glass' ||
    frameRaw === 'ios' ||
    frameRaw === 'frosted' ||
    frameRaw === 'transparent';

  var iframeSrc =
    base +
    '/evento/' +
    encodeURIComponent(slug) +
    '?tc_embed=1' +
    (useGlass ? '&tc_ui=glass' : '');

  var heightRawAttr = (el.getAttribute('data-tc-iframe-height') || '').trim();
  var heightRawLower = heightRawAttr.toLowerCase();
  var useAutoHeight =
    heightRawLower === 'auto' ||
    heightRawLower === 'content' ||
    el.getAttribute('data-tc-auto-height') === '1';
  var iframeHeightCss = useAutoHeight
    ? 'auto'
    : heightRawAttr
      ? /^\d+$/.test(heightRawAttr)
        ? heightRawAttr + 'px'
        : heightRawAttr
      : useInline
        ? '100dvh'
        : 'min(88vh, 920px)';

  var host = document.createElement('div');
  host.setAttribute('data-ticket-colombia-embed', '');
  if (useInline) host.setAttribute('data-ticket-colombia-embed-inline', '');
  if (useGlass) host.setAttribute('data-ticket-colombia-embed-glass', '');
  el.insertAdjacentElement('afterend', host);

  var root = host.attachShadow({ mode: 'open' });

  var cssGlassHint = `
    .hint--glass {
      color: rgba(255, 255, 255, 0.5);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
    }
  `;

  var cssShared = `
    :host {
      display: block;
      width: 100%;
      max-width: none;
      box-sizing: border-box;
    }
    * { box-sizing: border-box; }
    .wrap {
      font-family: system-ui, -apple-system, "SF Pro Text", "Segoe UI", Roboto, Ubuntu, sans-serif;
      width: 100%;
      max-width: none;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
      background: #050f14;
    }
    .hint {
      margin-top: 0.65rem;
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.42);
      letter-spacing: 0.04em;
    }
  ` + cssGlassHint;

  var cssInlineShellSolid = `
    .inline-shell {
      width: 100%;
      max-width: none;
      border-radius: 20px;
      overflow: hidden;
      background: #050f14;
      border: 1px solid rgba(0, 229, 195, 0.22);
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
    }
  `;

  var cssInlineShellGlass = `
    /* Marco visible: padding deja una franja donde el blur actúa; el iframe opaco no tapa todo el vidrio */
    .inline-shell {
      width: 100%;
      max-width: none;
      border-radius: 26px;
      overflow: hidden;
      padding: 14px;
      box-sizing: border-box;
      background: rgba(255, 255, 255, 0.11);
      backdrop-filter: saturate(200%) blur(42px);
      -webkit-backdrop-filter: saturate(200%) blur(42px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow:
        0 12px 48px rgba(0, 0, 0, 0.22),
        0 0 0 1px rgba(255, 255, 255, 0.09) inset,
        inset 0 1px 0 rgba(255, 255, 255, 0.22);
    }
    .inline-shell .inline-frame {
      border-radius: 18px;
      overflow: hidden;
      box-shadow:
        0 2px 16px rgba(0, 0, 0, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.12) inset;
    }
    .inline-shell .inline-frame iframe,
    .inline-shell iframe {
      background: transparent !important;
    }
  `;

  var cssInlineFrame = useAutoHeight
    ? `
    .inline-frame.inline-frame--auto {
      width: 100%;
      max-width: none;
      height: auto;
      min-height: 0;
    }
    /* Sin min 100dvh: el padre mide scrollHeight y asigna height en px (mismo origen) */
    .inline-frame.inline-frame--auto iframe {
      width: 100%;
      min-height: 0;
      height: 380px;
      transition: height 0.18s ease;
    }
  `
    : `
    .inline-frame {
      width: 100%;
      max-width: none;
      height: IFRAME_HEIGHT;
      min-height: 70dvh;
    }
  `.replace('IFRAME_HEIGHT', iframeHeightCss);

  var cssModal = `
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
      border-radius: 22px;
      overflow: hidden;
      background: #050f14;
      border: 1px solid rgba(0, 229, 195, 0.22);
      box-shadow:
        0 24px 80px rgba(0, 0, 0, 0.55),
        0 0 0 1px rgba(255, 255, 255, 0.04) inset;
    }
    .sheet--glass {
      display: flex;
      flex-direction: column;
      padding: 14px;
      box-sizing: border-box;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: saturate(200%) blur(42px);
      -webkit-backdrop-filter: saturate(200%) blur(42px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow:
        0 28px 88px rgba(0, 0, 0, 0.28),
        0 0 0 1px rgba(255, 255, 255, 0.1) inset,
        inset 0 1px 0 rgba(255, 255, 255, 0.18);
    }
    .sheet--glass .sheet-frame {
      flex: 1;
      min-height: 0;
      border-radius: 16px;
      overflow: hidden;
      background: transparent;
      box-shadow:
        0 2px 20px rgba(0, 0, 0, 0.45),
        0 0 0 1px rgba(0, 0, 0, 0.35) inset;
    }
    .sheet--glass .sheet-frame iframe {
      width: 100%;
      height: 100%;
      display: block;
      background: transparent !important;
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
    .sheet--glass .close {
      top: 1.1rem;
      right: 1.1rem;
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.2);
      color: #fff;
    }
    .close:hover {
      color: #fff;
      background: rgba(0, 229, 195, 0.12);
    }
    .sheet--glass .close:hover {
      background: rgba(255, 255, 255, 0.22);
    }
  `;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  var hintClass = 'hint' + (useGlass ? ' hint--glass' : '');
  var wrapClass = 'wrap';

  var innerHtml;
  if (useInline) {
    innerHtml =
      '<style>' +
      cssShared +
      (useGlass ? cssInlineShellGlass : cssInlineShellSolid) +
      cssInlineFrame +
      '</style>' +
      '<div class="' +
      wrapClass +
      '">' +
      '<div class="inline-shell">' +
      '<div class="inline-frame' +
      (useAutoHeight ? ' inline-frame--auto' : '') +
      '">' +
      '<iframe part="frame" title="Evento y entradas" src="' +
      escapeAttr(iframeSrc) +
      '" allow="payment *"></iframe>' +
      '</div></div>' +
      '<p class="' +
      hintClass +
      '">Compra segura con Ticket Colombia</p>' +
      '</div>';
  } else {
    var sheetClass = 'sheet' + (useGlass ? ' sheet--glass' : '');
    innerHtml =
      '<style>' +
      cssShared +
      cssModal +
      '</style>' +
      '<div class="' +
      wrapClass +
      '">' +
      '<button type="button" class="btn" part="trigger">' +
      escapeHtml(label) +
      '</button>' +
      '<p class="' +
      hintClass +
      '">Compra segura con Ticket Colombia</p>' +
      '<div class="backdrop" part="backdrop" aria-hidden="true">' +
      '<div class="' +
      sheetClass +
      '" role="dialog" aria-modal="true" aria-label="Entradas">' +
      '<button type="button" class="close" part="close" aria-label="Cerrar">&times;</button>' +
      (useGlass
        ? '<div class="sheet-frame">'
        : '') +
      '<iframe part="frame" title="Evento y entradas" src="' +
      escapeAttr(iframeSrc) +
      '" allow="payment *"></iframe>' +
      (useGlass ? '</div>' : '') +
      '</div></div></div>';
  }

  root.innerHTML = innerHtml;

  if (useInline && useAutoHeight) {
    var iframeEl = root.querySelector('iframe');
    if (iframeEl) {
      function tcMeasureIframeHeight() {
        try {
          var doc = iframeEl.contentDocument;
          if (!doc || !doc.documentElement) return;
          var h = Math.max(
            doc.documentElement.scrollHeight,
            doc.body ? doc.body.scrollHeight : 0,
            doc.documentElement.offsetHeight
          );
          var pad = 12;
          var px = Math.max(Math.ceil(h + pad), 180);
          iframeEl.style.height = px + 'px';
          iframeEl.style.minHeight = '0';
        } catch (err) {
          /* cross-origin: mantener alto por defecto del CSS */
        }
      }
      iframeEl.addEventListener('load', function () {
        tcMeasureIframeHeight();
        try {
          var idoc = iframeEl.contentDocument;
          if (idoc && typeof ResizeObserver !== 'undefined') {
            var ro = new ResizeObserver(function () {
              tcMeasureIframeHeight();
            });
            ro.observe(idoc.documentElement);
            if (idoc.body) ro.observe(idoc.body);
          }
        } catch (e2) {}
      });
      window.setInterval(tcMeasureIframeHeight, 2200);
    }
  }

  var closeModal = function () {};

  if (useModal) {
    var btn = root.querySelector('.btn');
    var backdrop = root.querySelector('.backdrop');
    var closeBtn = root.querySelector('.close');

    function openModal() {
      backdrop.classList.add('open');
      backdrop.setAttribute('aria-hidden', 'false');
    }

    closeModal = function () {
      backdrop.classList.remove('open');
      backdrop.setAttribute('aria-hidden', 'true');
    };

    btn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && backdrop.classList.contains('open')) closeModal();
    });
  }

  window.addEventListener('message', function (ev) {
    if (normalizeBase(ev.origin) !== base) return;
    var d = ev.data;
    if (!d || d.source !== SOURCE) return;
    if (d.version !== VERSION) return;
    if (useModal && (d.kind === 'purchase_finished' || d.kind === 'embed_close')) {
      closeModal();
    }
  });
})();
