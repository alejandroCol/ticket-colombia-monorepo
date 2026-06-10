import { jsPDF } from 'jspdf';
import logoUrl from '@assets/brand/ticket-colombia-proposal-logo.png';

const BRAND_BLUE: [number, number, number] = [0, 102, 204];
const BRAND_DARK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [90, 98, 110];
const ACCENT_GREEN: [number, number, number] = [16, 120, 72];

const MARGIN = 18;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

let logoDataUrl: string | null = null;

async function getLogoDataUrl(): Promise<string> {
  if (logoDataUrl) return logoDataUrl;
  const res = await fetch(logoUrl);
  const blob = await res.blob();
  logoDataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  return logoDataUrl;
}

function formatCOP(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);
}

function addFooters(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  const h = doc.internal.pageSize.getHeight();
  const gen = new Date().toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(110, 118, 128);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ticket Colombia · Propuesta comercial · ${gen}`, MARGIN, h - 8);
    doc.text(`Página ${i} de ${total}`, PAGE_W - MARGIN, h - 8, { align: 'right' });
  }
}

type PdfCursor = { doc: jsPDF; y: number };

function ensureSpace(cursor: PdfCursor, needed: number): void {
  const pageH = cursor.doc.internal.pageSize.getHeight();
  if (cursor.y + needed > pageH - 16) {
    cursor.doc.addPage();
    cursor.y = MARGIN;
  }
}

function drawSectionTitle(cursor: PdfCursor, title: string): void {
  ensureSpace(cursor, 14);
  const { doc } = cursor;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(BRAND_BLUE[0], BRAND_BLUE[1], BRAND_BLUE[2]);
  doc.text(title, MARGIN, cursor.y);
  cursor.y += 2;
  doc.setDrawColor(BRAND_BLUE[0], BRAND_BLUE[1], BRAND_BLUE[2]);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, cursor.y, MARGIN + 42, cursor.y);
  cursor.y += 7;
}

function drawParagraph(cursor: PdfCursor, text: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }): void {
  const { doc } = cursor;
  const size = opts?.size ?? 9.5;
  const color = opts?.color ?? MUTED;
  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  for (const line of lines) {
    ensureSpace(cursor, 5);
    doc.text(line, MARGIN, cursor.y);
    cursor.y += size * 0.42 + 1.2;
  }
  cursor.y += 2;
}

function drawBulletList(cursor: PdfCursor, items: string[], opts?: { size?: number }): void {
  const size = opts?.size ?? 9;
  const { doc } = cursor;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
  for (const item of items) {
    const bulletX = MARGIN + 2;
    const textX = MARGIN + 7;
    const textW = CONTENT_W - 9;
    const lines = doc.splitTextToSize(item, textW);
    ensureSpace(cursor, lines.length * 4.5 + 2);
    doc.setFillColor(BRAND_BLUE[0], BRAND_BLUE[1], BRAND_BLUE[2]);
    doc.circle(bulletX, cursor.y - 1.2, 0.8, 'F');
    lines.forEach((line: string, idx: number) => {
      doc.text(line, textX, cursor.y + idx * 4.2);
    });
    cursor.y += lines.length * 4.2 + 2.5;
  }
  cursor.y += 2;
}

function drawHighlightBox(cursor: PdfCursor, title: string, body: string, color: [number, number, number]): void {
  const { doc } = cursor;
  const bodyLines = doc.splitTextToSize(body, CONTENT_W - 12);
  const boxH = 12 + bodyLines.length * 4.5;
  ensureSpace(cursor, boxH + 6);
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.roundedRect(MARGIN, cursor.y - 4, CONTENT_W, boxH, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(title, MARGIN + 6, cursor.y + 3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  bodyLines.forEach((line: string, idx: number) => {
    doc.text(line, MARGIN + 6, cursor.y + 9 + idx * 4.5);
  });
  cursor.y += boxH + 6;
}

function drawPriceCard(cursor: PdfCursor, label: string, value: string, note: string): void {
  const { doc } = cursor;
  const cardH = 28;
  ensureSpace(cursor, cardH + 4);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(220, 226, 235);
  doc.setLineWidth(0.35);
  doc.roundedRect(MARGIN, cursor.y - 3, CONTENT_W, cardH, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(label, MARGIN + 6, cursor.y + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(BRAND_BLUE[0], BRAND_BLUE[1], BRAND_BLUE[2]);
  doc.text(value, MARGIN + 6, cursor.y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const noteLines = doc.splitTextToSize(note, CONTENT_W - 12);
  noteLines.forEach((line: string, idx: number) => {
    doc.text(line, MARGIN + 6, cursor.y + 20 + idx * 3.8);
  });
  cursor.y += cardH + 6;
}

function drawSmallInfoBox(cursor: PdfCursor, title: string, lines: string[]): void {
  const { doc } = cursor;
  const innerPadX = 5;
  const innerPadTop = 4;
  const titleGap = 6;
  const lineGap = 4.2;
  const blockGap = 1.5;
  const textW = CONTENT_W - innerPadX * 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const wrappedBlocks = lines.map((line) => doc.splitTextToSize(line, textW));
  const totalTextLines = wrappedBlocks.reduce((sum, block) => sum + block.length, 0);
  const blockGaps = Math.max(0, lines.length - 1) * blockGap;
  const boxH = innerPadTop + titleGap + totalTextLines * lineGap + blockGaps + 4;

  ensureSpace(cursor, boxH + 4);
  doc.setFillColor(245, 247, 250);
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, cursor.y - 2, CONTENT_W, boxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
  doc.text(title, MARGIN + innerPadX, cursor.y + innerPadTop);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);

  let textY = cursor.y + innerPadTop + titleGap;
  wrappedBlocks.forEach((block: string[], blockIdx: number) => {
    block.forEach((line: string) => {
      doc.text(line, MARGIN + innerPadX, textY);
      textY += lineGap;
    });
    if (blockIdx < wrappedBlocks.length - 1) {
      textY += blockGap;
    }
  });

  cursor.y += boxH + 5;
}

const PLATFORM_FEATURES = [
  'Venta en línea 24/7 con checkout seguro y confirmación automática por correo con PDF del boleto.',
  'Boletos con código QR único, validación en puerta con escáner y control anti-fraude.',
  'Localidades y palcos con precios diferenciados; mapa interactivo de venue con zonas clickeables.',
  'Eventos únicos y eventos recurrentes (series semanales o personalizadas).',
  'Cortesías, boletos manuales y carga masiva desde Excel para invitados y prensa.',
  'Códigos de descuento configurables por evento para campañas de marketing.',
  'Abonos y pagos parciales: define mínimo inicial y plazo para saldo.',
  'Estadísticas, balance por evento, reportes PDF y exportación para conciliación.',
  'Usuarios partner con permisos granulares: taquilla, stats, edición, validación.',
  'Widget embebible para integrar la compra en tu sitio web.',
  'Personalización del PDF del boleto: colores, layout y diseño de marca.',
  'Transferencia de boletos entre compradores cuando lo necesites.',
  'Tienda pública con banners, búsqueda por ciudad y ficha detallada del evento.',
  'Taquilla física: sistema para venta en puerta al precio público, ideal para el día del evento.',
];

export type CommercialProposalOptions = {
  includeWhiteLabel?: boolean;
};

export async function generateCommercialProposalPdf(opts: CommercialProposalOptions = {}): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logo = await getLogoDataUrl();
  const pageH = doc.internal.pageSize.getHeight();

  // —— Encabezado ——
  const logoSize = 38;
  doc.addImage(logo, 'PNG', PAGE_W / 2 - logoSize / 2, 12, logoSize, logoSize);

  let y = 56;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
  doc.text('Propuesta Comercial', PAGE_W / 2, y, { align: 'center' });
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const dateStr = new Date().toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.text(`Plataforma de boletería digital · ${dateStr}`, PAGE_W / 2, y, { align: 'center' });
  y += 6;
  doc.setDrawColor(220, 226, 235);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 10;

  const cursor: PdfCursor = { doc, y };

  drawHighlightBox(
    cursor,
    'Sin costos para empezar',
    'No hay cobros de implementación, setup ni permanencia mínima. Comienza a vender cuando tu evento esté listo y paga solo por lo que uses.',
    ACCENT_GREEN
  );

  drawParagraph(
    cursor,
    'Ticket Colombia es la plataforma integral para organizadores que buscan vender entradas de forma profesional, con control total de inventario, reportes en tiempo real y una experiencia de compra moderna para tus asistentes.',
    { size: 10, color: BRAND_DARK }
  );

  // —— Modelo de precios ——
  drawSectionTitle(cursor, 'Modelo de precios');
  drawPriceCard(
    cursor,
    'Tarifa por boleto emitido',
    formatCOP(2900),
    'Por cada boleto creado en la plataforma, excepto cortesías. Este valor puede trasladarse al comprador final como tarifa de servicio.'
  );

  drawSmallInfoBox(cursor, 'Pasarela de pagos OnePay', [
    'Comisión de pasarela: 3,49% + $800 COP + IVA (IVA aplicado únicamente sobre la comisión, no sobre el monto total de la venta).',
    'OnePay es la misma pasarela utilizada por Movistar en Colombia — infraestructura confiable y probada a escala nacional.',
    'La comisión de pasarela es independiente de la tarifa de Ticket Colombia y corresponde al procesamiento del pago en línea.',
  ]);

  // —— Funcionalidades ——
  drawSectionTitle(cursor, 'Funcionalidades de la tiquetera');
  drawParagraph(
    cursor,
    'Todo lo que necesitas para operar eventos de cualquier tamaño, desde conciertos íntimos hasta producciones con mapa de palcos:',
    { size: 9 }
  );
  drawBulletList(cursor, PLATFORM_FEATURES);

  // —— Marca blanca (opcional) ——
  if (opts.includeWhiteLabel) {
    ensureSpace(cursor, 20);
    if (cursor.y > pageH - 80) {
      doc.addPage();
      cursor.y = MARGIN;
    }
    drawSectionTitle(cursor, 'Servicio de marca blanca');
    drawParagraph(
      cursor,
      'Ideal para empresas, agencias o productoras que desean ofrecer boletería bajo su propia marca, con dominio propio y márgenes configurables.',
      { size: 9.5, color: BRAND_DARK }
    );
    drawPriceCard(
      cursor,
      'Suscripción mensual marca blanca',
      formatCOP(1490000),
      'Incluye creación de boleterías, uso completo de la plataforma y soporte operativo. El dominio web debe ser suministrado por la empresa marca blanca.'
    );
    drawPriceCard(
      cursor,
      'Tarifa por boleto (marca blanca)',
      formatCOP(1900),
      'Por cada boleto emitido bajo el servicio de marca blanca.'
    );
    drawParagraph(cursor, 'Tarifa configurable por encima del costo base', {
      bold: true,
      size: 10,
      color: BRAND_DARK,
    });
    drawParagraph(
      cursor,
      'La empresa marca blanca puede definir un valor tarifario adicional sobre el precio del boleto. El excedente, después de descontar la comisión de Ticket Colombia, queda como ganancia de la empresa.',
      { size: 9 }
    );
    drawSmallInfoBox(cursor, 'Ejemplo práctico', [
      'Boleto de $100.000 con tarifa del 10% configurada por la empresa marca blanca:',
      '- Comisión Ticket Colombia: $1.900',
      '- Ganancia empresa marca blanca: $8.100',
      'Cálculo: 10% de $100.000 = $10.000; menos $1.900 de comisión = $8.100 de margen para la empresa.',
    ]);
    drawParagraph(
      cursor,
      'Requisito: el dominio (ej. boletos.tuempresa.com) debe ser provisto y administrado por la empresa marca blanca.',
      { size: 8.5, color: MUTED }
    );
  }

  // —— Cierre ——
  ensureSpace(cursor, 30);
  drawSectionTitle(cursor, 'Próximos pasos');
  drawParagraph(
    cursor,
    'Estamos listos para acompañarte desde la configuración de tu primer evento hasta el día de la operación en puerta. Contáctanos para activar tu cuenta y comenzar a vender sin costos iniciales.',
    { size: 9.5, color: BRAND_DARK }
  );
  drawParagraph(cursor, 'ticketcolombia.co', {
    bold: true,
    size: 10,
    color: BRAND_BLUE,
  });

  addFooters(doc);
  const basename = opts.includeWhiteLabel
    ? 'propuesta-comercial-ticket-colombia-marca-blanca'
    : 'propuesta-comercial-ticket-colombia';
  doc.save(`${basename}.pdf`);
}
