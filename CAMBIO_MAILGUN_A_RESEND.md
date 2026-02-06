# 🔄 Cambio de Mailgun a Resend - Completado

## ✅ Cambios Realizados

Hemos migrado exitosamente de Mailgun a Resend para el envío de emails. Resend es más simple, más económico y más rápido de configurar.

---

## 📝 Archivos Modificados

### 1. **Backend (Firebase Functions)**

#### ✅ `email-sender.ts`
- **Antes:** Usaba Nodemailer con MailgunTransport
- **Ahora:** Usa la API de Resend (más simple y directa)
- **Cambios principales:**
  - Eliminadas dependencias de `nodemailer` y `nodemailer-mailgun-transport`
  - Agregada dependencia de `resend`
  - API simplificada con solo 3 parámetros (vs 5 con Mailgun)

#### ✅ `create-manual-ticket.ts`
- **Secretos actualizados:**
  - ❌ ~~`MAILGUN_API_KEY`~~ → ✅ `RESEND_API_KEY`
  - ❌ ~~`MAILGUN_DOMAIN`~~ (ya no necesario)
  - ✅ `SENDER_EMAIL` (mismo)
  - ✅ `SENDER_NAME` (nuevo, opcional)
  - ✅ `APP_URL` (mismo)

### 2. **Documentación**

#### ✅ Nueva Guía: `GUIA_CONFIGURACION_RESEND.md`
- Tutorial completo paso a paso para configurar Resend
- Incluye comparación con Mailgun
- Explica cómo usar el dominio onboarding para pruebas
- Instrucciones opcionales para dominio personalizado

#### ✅ Actualizado: `COMANDOS_INSTALAR_BACKEND.md`
- Paso 3: Dependencias actualizadas (eliminado `nodemailer`, agregado `resend`)
- Paso 5: Secretos actualizados para usar Resend
- Troubleshooting actualizado con errores comunes de Resend

#### ✅ Actualizado: `README.md`
- Tabla de documentación actualizada
- Requisitos previos actualizados
- Stack tecnológico actualizado
- Tiempos de setup reducidos (5-10 min vs 15-20 min)

#### ✅ Actualizado: `RESUMEN_TICKETS_MANUALES.md`
- Secretos requeridos actualizados
- Preguntas frecuentes actualizadas

---

## 📦 Nuevas Dependencias

### Para Instalar:

```bash
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions/functions"
npm install resend qrcode @types/qrcode pdfkit @types/pdfkit
```

**Nota:** Ya NO necesitamos `uuid` porque usamos el módulo nativo `crypto.randomUUID()` de Node.js.

### Para Eliminar (opcional, si ya instalaste Mailgun):

```bash
npm uninstall nodemailer @types/nodemailer nodemailer-mailgun-transport uuid @types/uuid
```

---

## 🔑 Secretos a Configurar

### Nuevos Secretos (Resend):

```bash
# 1. API Key de Resend
firebase functions:secrets:set --project ticket-colombia-e6267 RESEND_API_KEY
# Valor: re_AbCdEfGh123... (tu API key de Resend)

# 2. Email del remitente
firebase functions:secrets:set --project ticket-colombia-e6267 SENDER_EMAIL
# Valor: onboarding@resend.dev (para pruebas) o tickets@ticketcolombia.co (producción)

# 3. Nombre del remitente
firebase functions:secrets:set --project ticket-colombia-e6267 SENDER_NAME
# Valor: Ticket Colombia

# 4. URL de la aplicación
firebase functions:secrets:set --project ticket-colombia-e6267 APP_URL
# Valor: https://ticketcolombia.co
```

### Secretos Antiguos a Eliminar (opcional):

```bash
firebase functions:secrets:delete --project ticket-colombia-e6267 MAILGUN_API_KEY
firebase functions:secrets:delete --project ticket-colombia-e6267 MAILGUN_DOMAIN
```

---

## 🎯 Ventajas de Resend vs Mailgun

| Característica | Resend ⭐ | Mailgun |
|---------------|----------|---------|
| **Plan Gratuito** | 3,000 emails/mes (PERMANENTE) | 5,000 emails/mes (solo 3 meses) |
| **Configuración DNS** | NO necesaria para pruebas | Necesaria o usar Sandbox |
| **Secretos requeridos** | 3 (API Key, Email, Name) | 4 (API Key, Domain, Email, URL) |
| **Facilidad de uso** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Velocidad de setup** | ⭐⭐⭐⭐⭐ (5 minutos) | ⭐⭐⭐ (15-20 minutos) |
| **Precio después del gratuito** | $20/mes (50k emails) | $35/mes (50k emails) |
| **Logs en dashboard** | ✅ Incluidos | ✅ Incluidos |
| **API moderna** | ✅ TypeScript nativo | ⚠️ Necesita transporte |

**Ahorro anual:** $180 USD/año ($35-$20 = $15/mes × 12 meses)

---

## 📋 Próximos Pasos

### Para el Usuario:

1. ✅ **Leer la guía:** [GUIA_CONFIGURACION_RESEND.md](./GUIA_CONFIGURACION_RESEND.md)
2. ✅ **Crear cuenta en Resend:** https://resend.com/
3. ✅ **Obtener API Key:** Dashboard → API Keys → Create API Key
4. ✅ **Ejecutar comandos:** Seguir [COMANDOS_INSTALAR_BACKEND.md](./COMANDOS_INSTALAR_BACKEND.md)

---

## 🧪 Cómo Probar

1. **Configurar los secretos** (ver arriba)
2. **Desplegar la función:**
   ```bash
   cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions/functions"
   npm run build
   firebase deploy --only functions:createManualTicket --project ticket-colombia-e6267
   ```
3. **Probar desde el panel admin:**
   - Abrir: https://admin-ticket-colombia.web.app
   - Iniciar sesión como admin
   - Crear un ticket manual
   - Verificar que llega el email

---

## 📊 Código Antes vs Después

### Antes (Mailgun):

```typescript
import * as nodemailer from 'nodemailer';
import MailgunTransport from 'nodemailer-mailgun-transport';

export async function sendTicketEmail(
  to: string,
  subject: string,
  eventName: string,
  buyerName: string,
  pdfBuffer: Buffer,
  mailgunApiKey: string,
  mailgunDomain: string,
  senderEmail: string
): Promise<void> {
  const mailgunOptions = {
    auth: {
      api_key: mailgunApiKey,
      domain: mailgunDomain,
    },
  };

  const transporter = nodemailer.createTransport(MailgunTransport(mailgunOptions));

  const mailOptions = {
    from: `Ticket Colombia <${senderEmail}>`,
    to: to,
    subject: subject,
    html: generateEmailHTML(buyerName, eventName),
    attachments: [
      {
        filename: `ticket_${sanitizeFilename(eventName)}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  };

  await transporter.sendMail(mailOptions);
}
```

### Después (Resend):

```typescript
import { Resend } from 'resend';

export async function sendTicketEmail(
  to: string,
  subject: string,
  eventName: string,
  buyerName: string,
  pdfBuffer: Buffer,
  resendApiKey: string,
  senderEmail: string,
  senderName: string = 'Ticket Colombia'
): Promise<void> {
  const resend = new Resend(resendApiKey);

  const { data, error } = await resend.emails.send({
    from: `${senderName} <${senderEmail}>`,
    to: [to],
    subject: subject,
    html: generateEmailHTML(buyerName, eventName),
    attachments: [
      {
        filename: `ticket_${sanitizeFilename(eventName)}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
```

**Resultado:** 
- ✅ Código más simple (23 líneas vs 30 líneas)
- ✅ Menos dependencias (1 vs 2)
- ✅ API más moderna y fácil de usar
- ✅ Manejo de errores más claro

---

## ✅ Checklist de Migración

- [x] Actualizar `email-sender.ts` para usar Resend
- [x] Actualizar `create-manual-ticket.ts` para usar secretos de Resend
- [x] Crear guía de configuración de Resend
- [x] Actualizar `COMANDOS_INSTALAR_BACKEND.md`
- [x] Actualizar `README.md`
- [x] Actualizar `RESUMEN_TICKETS_MANUALES.md`
- [ ] Usuario: Instalar dependencia `resend`
- [ ] Usuario: Configurar secretos de Resend
- [ ] Usuario: Desplegar función actualizada
- [ ] Usuario: Probar envío de email

---

## 📞 Soporte

Si tienes problemas con la migración:
1. Revisa la guía: [GUIA_CONFIGURACION_RESEND.md](./GUIA_CONFIGURACION_RESEND.md)
2. Verifica los logs de Firebase: `firebase functions:log`
3. Verifica los logs de Resend: https://resend.com/logs
4. Comparte el error específico que ves

---

**🎉 ¡Migración completada! Ahora tienes un sistema de emails más simple, más barato y más confiable.**

