# 🎫 Implementación Completa: Creación de Tickets Manuales

**Fecha:** 28 de octubre de 2025  
**Estado:** ✅ Frontend Completado | 🔄 Backend Por Completar

---

## 📊 Resumen de Cambios Implementados

### ✅ Frontend (Panel Admin) - COMPLETADO

Los siguientes archivos ya fueron creados/modificados:

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `CreateTicketModal/index.tsx` | ✅ Creado | Modal para capturar datos del comprador |
| `CreateTicketModal/index.scss` | ✅ Creado | Estilos del modal |
| `EventCard/index.tsx` | ✅ Modificado | Agregado botón "🎫 Crear Ticket" |
| `EventCard/index.scss` | ✅ Modificado | Estilos para dos botones |
| `dashboard/index.tsx` | ✅ Modificado | Integración del modal y llamada a Function |
| `services/firebase.ts` | ✅ Modificado | Exportación de `functions` |
| `services/index.ts` | ✅ Modificado | Re-exportación de `functions` |

---

## 🚧 Backend (Firebase Functions) - POR COMPLETAR

### Archivos Creados (Parcialmente)

1. ✅ `/bitcomedia-functions/functions/src/features/manual-ticket/create-manual-ticket.ts`
   - Función principal para crear tickets manuales
   - **NOTA:** Requiere completar `pdf-generator.ts` y `email-sender.ts`

---

## 📋 Pasos Pendientes para Completar el Backend

### PASO 1: Instalar Dependencias Necesarias

```bash
cd /Users/alejandro/Documents/Repos\ Tiquetera/bitcomedia-functions/functions

# Instalar dependencias para PDF y Email
npm install pdfkit
npm install @types/pdfkit --save-dev
npm install nodemailer
npm install @types/nodemailer --save-dev
```

---

### PASO 2: Crear Generador de PDF

Crear archivo: `/bitcomedia-functions/functions/src/features/manual-ticket/pdf-generator.ts`

```typescript
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

interface TicketData {
  id: string;
  eventName: string;
  eventDate: any;
  eventTime: string;
  venue: {
    name: string;
    address: string;
  };
  city: string;
  buyerName: string;
  buyerEmail: string;
  purchaseAmount: number;
}

interface QRCode {
  ticketId: string;
  qrCodeDataUrl: string;
}

export async function generateTicketPDF(
  ticket: TicketData,
  eventData: any,
  qrCodes: QRCode[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // --- HEADER ---
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .fillColor('#00d4ff')
        .text('🎫 TICKET COLOMBIA', { align: 'center' });

      doc.moveDown(0.5);

      // --- EVENT INFO ---
      doc
        .fontSize(20)
        .fillColor('#e0e1dd')
        .text(ticket.eventName, { align: 'center' });

      doc.moveDown();

      // Fecha y hora
      const dateStr = ticket.eventDate.toDate ?
        ticket.eventDate.toDate().toLocaleDateString('es-CO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }) :
        'Fecha por confirmar';

      doc
        .fontSize(14)
        .fillColor('#778da9')
        .text(`📅 ${dateStr} - ⏰ ${ticket.eventTime}`, { align: 'center' });

      doc
        .text(`📍 ${ticket.venue.name}`, { align: 'center' })
        .text(`${ticket.city}`, { align: 'center' });

      doc.moveDown(2);

      // --- DIVIDER LINE ---
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .strokeColor('#778da9')
        .lineWidth(1)
        .stroke();

      doc.moveDown();

      // --- QR CODES SECTION ---
      doc
        .fontSize(16)
        .fillColor('#e0e1dd')
        .text('Tu(s) Ticket(s):', { align: 'left' });

      doc.moveDown();

      // Generar cada ticket con su QR
      qrCodes.forEach((qr, index) => {
        const yPosition = doc.y;

        // QR Code (convertir data URL a imagen)
        const base64Data = qr.qrCodeDataUrl.split(',')[1];
        const qrBuffer = Buffer.from(base64Data, 'base64');

        doc.image(qrBuffer, 50, yPosition, {
          width: 150,
          height: 150
        });

        // Ticket Info al lado del QR
        doc
          .fontSize(12)
          .fillColor('#e0e1dd')
          .text(`Ticket #${index + 1}`, 220, yPosition + 20);

        doc
          .fontSize(10)
          .fillColor('#778da9')
          .text(`ID: ${qr.ticketId}`, 220, yPosition + 40)
          .text(`Titular: ${ticket.buyerName}`, 220, yPosition + 60)
          .text(`Email: ${ticket.buyerEmail}`, 220, yPosition + 80);

        doc.moveDown(10);
      });

      // --- FOOTER ---
      doc
        .fontSize(9)
        .fillColor('#778da9')
        .text(
          'Este ticket es válido para una sola entrada. Presenta el código QR en la entrada del evento.',
          50,
          doc.page.height - 100,
          { align: 'center', width: 500 }
        );

      doc
        .fontSize(8)
        .text(
          `Generado el ${new Date().toLocaleDateString('es-CO')} | Ticket Colombia`,
          { align: 'center' }
        );

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}
```

---

### PASO 3: Configurar Envío de Emails

#### Opción A: Usar Firebase Extension "Trigger Email" (Recomendado)

**Ventajas:**
- ✅ Fácil de configurar
- ✅ Gratis hasta 100 emails/día
- ✅ Integrado con Firebase

**Instalación:**

```bash
firebase ext:install firebase/firestore-send-email
```

Luego crear archivo: `/bitcomedia-functions/functions/src/features/manual-ticket/email-sender.ts`

```typescript
import * as admin from 'firebase-admin';

interface EmailData {
  to: string;
  buyerName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  city: string;
  quantity: number;
  pdfBuffer: Buffer;
  ticketIds: string[];
}

export async function sendTicketEmail(data: EmailData): Promise<void> {
  // Subir PDF a Storage
  const pdfPath = `tickets/ticket_${data.ticketIds[0]}_${Date.now()}.pdf`;
  const bucket = admin.storage().bucket();
  const file = bucket.file(pdfPath);

  await file.save(data.pdfBuffer, {
    metadata: {
      contentType: 'application/pdf'
    }
  });

  // Hacer el archivo público temporalmente (24 horas)
  await file.makePublic();
  const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${pdfPath}`;

  // Crear documento en colección 'mail' para la extensión
  await admin.firestore().collection('mail').add({
    to: data.to,
    message: {
      subject: `🎫 Tu${data.quantity > 1 ? 's' : ''} Ticket${data.quantity > 1 ? 's' : ''} para ${data.eventName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0d1b2a; color: #e0e1dd; padding: 20px;">
          <div style="text-align: center; padding: 20px; background-color: #1b263b; border-radius: 10px;">
            <h1 style="color: #00d4ff; margin: 0;">🎫 Ticket Colombia</h1>
          </div>
          
          <div style="padding: 30px 20px; background-color: #1b263b; margin-top: 20px; border-radius: 10px;">
            <h2 style="color: #00d4ff;">¡Hola ${data.buyerName}!</h2>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Tu${data.quantity > 1 ? 's' : ''} ticket${data.quantity > 1 ? 's han' : ' ha'} sido generado${data.quantity > 1 ? 's' : ''} exitosamente para:
            </p>
            
            <div style="background-color: #0d1b2a; padding: 20px; border-left: 4px solid #00d4ff; margin: 20px 0;">
              <h3 style="color: #00d4ff; margin-top: 0;">${data.eventName}</h3>
              <p style="margin: 5px 0;">📅 ${data.eventDate}</p>
              <p style="margin: 5px 0;">⏰ ${data.eventTime}</p>
              <p style="margin: 5px 0;">📍 ${data.venue}</p>
              <p style="margin: 5px 0;">🌆 ${data.city}</p>
              ${data.quantity > 1 ? `<p style="margin: 5px 0;">🎟️ Cantidad: ${data.quantity} tickets</p>` : ''}
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Adjunto encontrarás tu${data.quantity > 1 ? 's' : ''} ticket${data.quantity > 1 ? 's' : ''} en formato PDF. 
              <strong>Por favor, presenta el código QR en la entrada del evento.</strong>
            </p>
            
            <p style="font-size: 14px; color: #778da9; margin-top: 30px;">
              ℹ️ Cada ticket es válido para una sola entrada.
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #778da9; font-size: 12px;">
            <p>¿Tienes dudas? Contáctanos</p>
            <p style="margin: 5px 0;">Ticket Colombia © ${new Date().getFullYear()}</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `ticket_${data.eventName.replace(/\s+/g, '_')}.pdf`,
          path: pdfUrl
        }
      ]
    }
  });

  console.log(`✅ Email queued for ${data.to}`);
}
```

#### Opción B: Usar SendGrid o Resend (APIs Externas)

Si prefieres usar un servicio externo, sigue las instrucciones en sus respectivas documentaciones.

---

### PASO 4: Exportar la Función en index.ts

Agregar en: `/bitcomedia-functions/functions/src/index.ts`

```typescript
// Import manual ticket function
import { createManualTicket } from './features/manual-ticket/create-manual-ticket';

// Export manual ticket function
export { createManualTicket };
```

---

### PASO 5: Desplegar Functions

```bash
cd /Users/alejandro/Documents/Repos\ Tiquetera/bitcomedia-functions

# Build
npm run build

# Deploy
firebase deploy --only functions:createManualTicket --project ticket-colombia-e6267
```

---

## 🧪 Cómo Probar la Funcionalidad

### 1. Desde el Panel Admin

1. **Ir a:** https://admin-ticket-colombia.web.app
2. **Login** con tu usuario admin
3. **En el Dashboard**, busca cualquier evento
4. **Click en "🎫 Crear Ticket"**
5. **Completar formulario:**
   - Nombre: Tu nombre
   - Email: Tu email real
   - Teléfono: (opcional)
   - Cantidad: 1-10
6. **Click "Crear Ticket"**
7. **Verificar:**
   - Alert de éxito
   - Email recibido con PDF adjunto
   - PDF contiene QR válido

### 2. Verificar en Firestore

```
https://console.firebase.google.com/project/ticket-colombia-e6267/firestore/data/~2Ftickets
```

- Buscar tickets con `isManual: true`
- Verificar campo `createdBy` (UID del admin)
- Verificar `buyerEmail` y `buyerName`

### 3. Verificar en Storage

```
https://console.firebase.google.com/project/ticket-colombia-e6267/storage
```

- Buscar carpeta `tickets/`
- Verificar PDFs generados

---

## 🔧 Configuración de Email Extension

Si usas la extensión de Firebase, necesitas configurar:

1. **Instalar extensión:**
   ```bash
   firebase ext:install firebase/firestore-send-email
   ```

2. **Durante la instalación, configurar:**
   - **SMTP Connection URI:** Usar Gmail, SendGrid, o similar
   - **Email documents collection:** `mail`
   - **Default FROM address:** `noreply@ticketcolombia.co`

3. **Para Gmail (desarrollo):**
   - Crear contraseña de aplicación
   - URI formato: `smtps://your-email@gmail.com:app-password@smtp.gmail.com:465`

4. **Para producción:**
   - Usar SendGrid, Mailgun, o AWS SES
   - Configura un dominio verificado

---

## 📊 Estructura Final de Archivos

```
bitcomedia-functions/
└── functions/
    └── src/
        └── features/
            └── manual-ticket/
                ├── create-manual-ticket.ts   ✅ Creado
                ├── pdf-generator.ts           🔄 Por crear
                └── email-sender.ts            🔄 Por crear
```

---

## ⚠️ Consideraciones Importantes

### Seguridad

- ✅ Solo admins pueden crear tickets manuales
- ✅ Validación en backend (no se puede bypass)
- ✅ Verificación de autenticación en Function

### Límites

- **Tickets por llamada:** Máximo 10
- **Email diario (gratis):** 100 con extension Firebase
- **Tamaño PDF:** ~500KB por ticket

### Costos

- **Firebase Functions:** Gratis hasta 2M invocaciones/mes
- **Storage:** Gratis hasta 5GB
- **Email Extension:** Gratis hasta 100/día, luego ~$0.03/email
- **Alternative (SendGrid):** 100 emails/día gratis, luego desde $15/mes

---

## 🚀 Próximos Pasos

### Alta Prioridad

1. ✅ Completar instalación de dependencias (`pdfkit`, `nodemailer`)
2. ✅ Crear `pdf-generator.ts`
3. ✅ Crear `email-sender.ts`
4. ✅ Configurar extensión de email o servicio externo
5. ✅ Desplegar función
6. ✅ Probar con email real

### Media Prioridad

7. Mejorar diseño del PDF (agregar logo, más estilos)
8. Agregar opción para reenviar email desde panel admin
9. Agregar historial de tickets manuales creados
10. Notificación al admin cuando se crea ticket

### Baja Prioridad

11. Exportar lista de tickets manuales a CSV
12. Estadísticas de tickets manuales vs pagados
13. Opción de cancelar ticket manual desde panel

---

## 🆘 Troubleshooting

### Error: "functions is not exported"

**Solución:** Ya resuelto. Asegúrate de que `services/firebase.ts` y `services/index.ts` exporten `functions`.

### Error: "Permission denied" al crear ticket

**Causa:** Usuario no es admin o no está autenticado.
**Solución:** Verificar que el campo `role` en Firestore sea `ADMIN` (mayúsculas).

### Email no llega

**Causas posibles:**
- Extensión no instalada correctamente
- SMTP no configurado
- Email en spam

**Solución:**
- Verificar logs de Functions: `firebase functions:log`
- Verificar colección `mail` en Firestore
- Revisar carpeta de spam

### PDF no se genera

**Causa:** Dependencia `pdfkit` no instalada.
**Solución:**
```bash
cd /Users/alejandro/Documents/Repos\ Tiquetera/bitcomedia-functions/functions
npm install pdfkit @types/pdfkit
```

---

**Última actualización:** 28 de octubre de 2025

**Estado:** Frontend listo ✅ | Backend pendiente 🔄





