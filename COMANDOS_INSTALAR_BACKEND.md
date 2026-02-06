# 🛠️ Comandos para Instalar y Desplegar el Backend de Tickets Manuales

## ⚠️ IMPORTANTE: Debes ejecutar estos comandos manualmente en tu terminal

Debido a problemas de permisos con npm, necesitas ejecutar los siguientes comandos **uno por uno** en tu terminal.

---

## 📋 Paso 1: Navegar al Directorio de Funciones

```bash
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions/functions"
```

---

## 🔧 Paso 2: Arreglar Permisos de node_modules

Si el siguiente paso falla por permisos, ejecuta estos comandos primero:

```bash
# Eliminar el directorio node_modules completamente
rm -rf node_modules

# Limpiar la caché de npm
rm -rf ~/.npm/_cacache

# Reinstalar todas las dependencias desde cero
npm install
```

**NOTA:** Si aún falla, intenta con sudo (te pedirá tu contraseña):

```bash
sudo rm -rf node_modules
sudo rm -rf ~/.npm/_cacache
npm install
```

---

## 📦 Paso 3: Instalar Dependencias Nuevas

Una vez que `npm install` funcione sin errores, instala las dependencias para tickets manuales:

```bash
npm install pdfkit @types/pdfkit resend qrcode @types/qrcode
```

**Nota:** Ya NO necesitamos `uuid` porque usamos el módulo nativo `crypto.randomUUID()` de Node.js.

---

## 🔨 Paso 4: Compilar el Código TypeScript

```bash
npm run build
```

**✅ ESPERADO:** Deberías ver el mensaje "Compiled successfully" sin errores.

---

## 🔑 Paso 5: Configurar Secretos de Firebase

Antes de desplegar, necesitas configurar los secretos para el envío de correos.

### 📖 **GUÍA COMPLETA DE RESEND:**

👉 **[GUIA_CONFIGURACION_RESEND.md](./GUIA_CONFIGURACION_RESEND.md)** 👈

Esta guía te explica:
- Cómo crear una cuenta en Resend (GRATIS y PERMANENTE)
- Dónde encontrar tu API Key
- Cómo usar el dominio onboarding para pruebas inmediatas (sin configurar DNS)
- Cómo configurar tu dominio personalizado (opcional)

**✨ ¿Por qué Resend?**
- ✅ Más simple que Mailgun (solo necesitas 1 API Key)
- ✅ 3,000 emails/mes GRATIS PARA SIEMPRE (no solo 3 meses)
- ✅ No necesitas configurar DNS para pruebas
- ✅ Setup en 5 minutos

---

### Resumen Rápido (si ya tienes Resend configurado):

Ejecuta estos comandos **uno por uno** (Firebase te pedirá el valor de cada secreto):

#### 5.1. Configurar Resend API Key

```bash
firebase functions:secrets:set --project ticket-colombia-e6267 RESEND_API_KEY
```

Ingresa tu clave API de Resend (ejemplo: `re_AbCdEfGh123...`).

#### 5.2. Configurar Email del Remitente

```bash
firebase functions:secrets:set --project ticket-colombia-e6267 SENDER_EMAIL
```

Ingresa el correo desde el cual se enviarán los tickets:
- **Para pruebas (dominio onboarding):** `onboarding@resend.dev`
- **Para producción (dominio personalizado):** `tickets@ticketcolombia.co`

#### 5.3. Configurar Nombre del Remitente

```bash
firebase functions:secrets:set --project ticket-colombia-e6267 SENDER_NAME
```

Ingresa el nombre que aparecerá como remitente: `Ticket Colombia`

#### 5.4. Configurar URL de la Aplicación

```bash
firebase functions:secrets:set --project ticket-colombia-e6267 APP_URL
```

Ingresa la URL de tu aplicación: `https://ticketcolombia.co`

---

## 🚀 Paso 6: Desplegar la Función a Firebase

```bash
firebase deploy --only functions:createManualTicket --project ticket-colombia-e6267
```

**✅ ESPERADO:** Deberías ver algo como:

```
✔  functions[us-central1-createManualTicket]: Successful create operation.
Function URL (createManualTicket): https://us-central1-ticket-colombia-e6267.cloudfunctions.net/createManualTicket
```

---

## 📱 Paso 7: Redesplegar el Panel Admin (Frontend)

Ahora que el backend está listo, redespliega el panel admin para asegurar que todo esté actualizado:

```bash
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-web-admin"
npm run build
firebase deploy --only hosting --project ticket-colombia-e6267
```

---

## 🧪 Paso 8: Probar la Funcionalidad

1. **Abre el Panel Admin:**
   ```bash
   open https://admin-ticket-colombia.web.app
   ```

2. **Inicia sesión** con tu usuario administrador (`ale.mar.guz@gmail.com`).

3. **Haz clic en "Crear Ticket"** en cualquier evento.

4. **Rellena el formulario** con tus datos (usa tu email personal para recibir el ticket de prueba).

5. **Verifica el correo** que recibirás con el PDF adjunto.

---

## 🐛 Troubleshooting

### Error: "EACCES: permission denied"

Si sigues viendo errores de permisos al instalar dependencias:

1. Elimina `node_modules` y vuelve a instalar:
   ```bash
   rm -rf node_modules
   npm install
   ```

2. Si falla, usa sudo:
   ```bash
   sudo rm -rf node_modules
   sudo npm install
   ```

### Error: "Could not find module 'qrcode'" o "Could not find module 'resend'"

Asegúrate de que instalaste TODAS las dependencias del Paso 3:
```bash
npm install pdfkit @types/pdfkit resend qrcode @types/qrcode
```

### Error al desplegar: "Missing secrets"

Asegúrate de haber configurado TODOS los secretos del Paso 5 antes de desplegar:
- `RESEND_API_KEY`
- `SENDER_EMAIL`
- `SENDER_NAME`
- `APP_URL`

### Error: "Invalid API key" (Resend)

Verifica que:
1. Copiaste la API Key completa (comienza con `re_`)
2. No incluiste espacios al pegar la key
3. La key no ha sido eliminada o revocada en el dashboard de Resend

### No recibo el correo electrónico

1. Verifica que configuraste correctamente los secretos de Resend.
2. Revisa la carpeta de spam.
3. Si usas dominio onboarding (`onboarding@resend.dev`), verifica que el email destino esté correcto.
4. Revisa los logs de Firebase Functions:
   ```bash
   firebase functions:log --project ticket-colombia-e6267
   ```
5. Revisa los logs en el dashboard de Resend: https://resend.com/logs

---

## ✅ Resultado Final

Cuando completes todos los pasos, podrás:

- ✅ Crear tickets manuales (de cortesía) desde el panel admin
- ✅ Generar PDFs con códigos QR automáticamente
- ✅ Enviar los tickets por correo electrónico al comprador
- ✅ Validar los tickets en la entrada del evento (con el QR)

---

## 📞 ¿Necesitas Ayuda?

Si algún paso falla, copia el error completo que aparece en la terminal y compártelo conmigo para poder ayudarte.

¡Buena suerte! 🚀

