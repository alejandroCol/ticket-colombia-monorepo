# 📧 Guía Completa: Configuración de Resend para Ticket Colombia

Esta guía te mostrará paso a paso cómo obtener las credenciales de Resend necesarias para enviar tickets por correo electrónico.

**✨ ¿Por qué Resend?**
- ✅ **Más simple** que Mailgun (solo necesitas una API Key)
- ✅ **Plan gratuito PERMANENTE** (3,000 emails/mes para siempre, no solo 3 meses)
- ✅ **API moderna** y fácil de usar
- ✅ **No necesitas configurar DNS** para pruebas
- ✅ **Dominio de prueba incluido** (`onboarding.resend.dev`)

---

## 📋 Índice

1. [Crear Cuenta en Resend](#1-crear-cuenta-en-resend)
2. [Obtener API Key](#2-obtener-api-key)
3. [Verificar tu Email (para dominio onboarding)](#3-verificar-tu-email-para-dominio-onboarding)
4. [Configurar Secretos en Firebase](#4-configurar-secretos-en-firebase)
5. [Opcional: Configurar tu Dominio Personalizado](#5-opcional-configurar-tu-dominio-personalizado)

---

## 1. Crear Cuenta en Resend

### Paso 1.1: Registrarse

1. Ve a **https://resend.com/**
2. Haz clic en **"Start Building"** o **"Sign Up"** (arriba a la derecha)
3. Puedes registrarte con:
   - **Email y contraseña**, o
   - **GitHub** (más rápido)
4. Si usas email, verifica tu correo haciendo clic en el link que te enviarán

**¡Listo!** Ya tienes cuenta en Resend.

---

## 2. Obtener API Key

### Paso 2.1: Crear una API Key

1. Una vez dentro del dashboard de Resend, ve a:
   ```
   API Keys (en el menú lateral izquierdo)
   ```
   
2. O directamente: **https://resend.com/api-keys**

3. Haz clic en **"Create API Key"**

4. Dale un nombre descriptivo:
   ```
   Nombre: Ticket Colombia - Production
   ```
   O para pruebas:
   ```
   Nombre: Ticket Colombia - Testing
   ```

5. Selecciona los permisos:
   - ✅ **Sending access** (enviar emails)
   - (Para producción, puedes dar todos los permisos)

6. Haz clic en **"Add"**

### Paso 2.2: Copiar la API Key

**⚠️ IMPORTANTE:** La API Key solo se muestra **UNA VEZ**. Si no la copias ahora, tendrás que crear una nueva.

1. Verás algo como:
   ```
   re_123abc456def789ghi012jkl345mno678
   ```

2. Haz clic en **"Copy"** o copia manualmente

3. **GUÁRDALA EN UN LUGAR SEGURO** (la necesitarás en el Paso 4)

**Ejemplo de API Key:**
```
re_AbCdEfGh123456789IjKlMnOpQrStUvWxYz
```

⚠️ **IMPORTANTE:** Nunca compartas esta key públicamente ni la subas a GitHub.

---

## 3. Verificar tu Email (para dominio onboarding)

### Paso 3.1: Agregar tu Email como Remitente

Resend incluye un dominio de prueba: `onboarding.resend.dev`

Para usarlo, debes verificar el email desde el cual enviarás:

1. Ve a: **Domains** (en el menú lateral)
2. Verás el dominio: `onboarding.resend.dev` (ya activo)
3. Haz clic en **"Add Email"** o **"Verify Email"**
4. Ingresa tu email de remitente:
   ```
   tickets@resend.dev
   ```
   **NOTA:** Usa `@resend.dev` para el dominio onboarding, NO `@ticketcolombia.co`

**Alternativa (Más Simple):**

Resend te permite enviar desde cualquier email con el dominio `onboarding.resend.dev` sin verificación adicional. Solo usa:
```
onboarding@resend.dev
```

---

## 4. Configurar Secretos en Firebase

Ahora que tienes tu API Key, configúrala en Firebase:

### Paso 4.1: Abrir Terminal

```bash
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions/functions"
```

### Paso 4.2: Configurar RESEND_API_KEY

```bash
firebase functions:secrets:set --project ticket-colombia-e6267 RESEND_API_KEY
```

Cuando te pregunte, pega tu API Key:
```
re_AbCdEfGh123456789IjKlMnOpQrStUvWxYz
```

Presiona **Enter**.

### Paso 4.3: Configurar SENDER_EMAIL

```bash
firebase functions:secrets:set --project ticket-colombia-e6267 SENDER_EMAIL
```

Ingresa el email del remitente:
- **Para dominio onboarding:** `onboarding@resend.dev`
- **Para dominio personalizado:** `tickets@ticketcolombia.co` (después de configurar el dominio)

Presiona **Enter**.

### Paso 4.4: Configurar SENDER_NAME (opcional pero recomendado)

```bash
firebase functions:secrets:set --project ticket-colombia-e6267 SENDER_NAME
```

Ingresa el nombre que aparecerá como remitente:
```
Ticket Colombia
```

Presiona **Enter**.

### Paso 4.5: Configurar APP_URL

```bash
firebase functions:secrets:set --project ticket-colombia-e6267 APP_URL
```

Ingresa la URL de tu aplicación:
```
https://ticketcolombia.co
```

Presiona **Enter**.

### Paso 4.6: Verificar que los Secretos Están Configurados

```bash
firebase functions:secrets:access --project ticket-colombia-e6267
```

Deberías ver algo como:
```
✔ Secrets configured:
  - RESEND_API_KEY
  - SENDER_EMAIL
  - SENDER_NAME
  - APP_URL
  - MERCADOPAGO_ACCESS_TOKEN
  - MERCADOPAGO_WEBHOOK_SECRET
```

---

## 5. Opcional: Configurar tu Dominio Personalizado

**⚠️ NOTA:** Solo necesitas esto si quieres enviar desde `tickets@ticketcolombia.co` en lugar de `onboarding@resend.dev`.

### Paso 5.1: Agregar Dominio en Resend

1. Ve a: **Domains** (en el menú lateral)
2. Haz clic en **"Add Domain"**
3. Ingresa tu dominio o subdominio:
   ```
   ticketcolombia.co
   ```
   O un subdominio específico:
   ```
   mail.ticketcolombia.co
   ```
4. Haz clic en **"Add"**

### Paso 5.2: Configurar DNS en GoDaddy

Resend te mostrará los registros DNS que debes agregar:

**Registros TXT (para SPF):**
```
Type: TXT
Name: @ (o ticketcolombia.co)
Value: v=spf1 include:resend.com ~all
TTL: 3600
```

**Registros CNAME (para DKIM):**
```
Type: CNAME
Name: resend._domainkey
Value: resend._domainkey.resend.com
TTL: 3600
```

**Registros MX (para recibir bounces):**
```
Type: MX
Name: @ (o ticketcolombia.co)
Priority: 10
Value: feedback-smtp.us-east-1.amazonses.com
TTL: 3600
```

### Paso 5.3: Agregar los Registros en GoDaddy

1. Inicia sesión en **https://godaddy.com**
2. Ve a **"My Products" → "DNS"**
3. Busca `ticketcolombia.co` y haz clic en **"Manage DNS"**
4. Haz clic en **"Add"** para cada registro
5. Copia y pega los valores exactos que Resend te dio
6. Haz clic en **"Save"**

⏱️ **Espera 10-30 minutos** para que los DNS se propaguen.

### Paso 5.4: Verificar el Dominio

1. Vuelve a Resend: **Domains**
2. Haz clic en tu dominio: `ticketcolombia.co`
3. Haz clic en **"Verify DNS"**
4. Si todo está correcto, verás checkmarks verdes ✅

### Paso 5.5: Actualizar SENDER_EMAIL

Una vez verificado el dominio, actualiza el secreto:

```bash
firebase functions:secrets:set --project ticket-colombia-e6267 SENDER_EMAIL
```

Ingresa:
```
tickets@ticketcolombia.co
```

---

## 6. Redesplegar la Función

Ahora que los secretos están configurados, redespliega la función:

```bash
firebase deploy --only functions:createManualTicket --project ticket-colombia-e6267
```

---

## 🧪 Probar el Envío de Emails

1. **Completa todos los pasos anteriores**
2. **Redespliega la función** (Paso 6)
3. **Abre el panel admin:** https://admin-ticket-colombia.web.app
4. **Inicia sesión** como administrador
5. **Haz clic en "Crear Ticket"** en cualquier evento
6. **Rellena el formulario:**
   - **Nombre:** Tu nombre
   - **Email:** `ale.mar.guz@gmail.com`
   - **Cantidad:** 1
7. **Haz clic en "Crear Ticket"**
8. **Revisa tu bandeja de entrada** (y spam si no lo ves)

---

## 🐛 Troubleshooting

### Error: "Invalid API key"

- **Causa:** API Key incorrecta o no configurada
- **Solución:** Verifica que copiaste la API Key completa (comienza con `re_`)

### Error: "The from email address is not verified"

- **Causa:** Estás usando un dominio personalizado no verificado
- **Solución:** 
  - Usa `onboarding@resend.dev` para pruebas, O
  - Verifica tu dominio personalizado en Resend

### No recibo el correo

- **Causa 1:** Puede estar en spam
- **Solución:** Revisa la carpeta de spam

- **Causa 2:** Email destino incorrecto
- **Solución:** Verifica que el email del destinatario es correcto

- **Causa 3:** API Key no configurada
- **Solución:** Verifica que configuraste `RESEND_API_KEY` correctamente

### Error: "Rate limit exceeded"

- **Causa:** Has superado el límite del plan gratuito (3,000 emails/mes o 1 email/segundo)
- **Solución:** Espera un momento o actualiza tu plan en Resend

---

## 📊 Resumen de Valores Necesarios

Al final, necesitarás tener estos 4 valores:

| Secreto | Ejemplo |
|---------|---------|
| **RESEND_API_KEY** | `re_AbCdEfGh123456789IjKlMnOpQrStUvWxYz` |
| **SENDER_EMAIL** | `onboarding@resend.dev` o `tickets@ticketcolombia.co` |
| **SENDER_NAME** | `Ticket Colombia` |
| **APP_URL** | `https://ticketcolombia.co` |

---

## ⚖️ Comparación: Resend vs Mailgun

| Característica | Resend ⭐ | Mailgun |
|---------------|----------|---------|
| **Plan Gratuito** | 3,000 emails/mes (PERMANENTE) | 5,000 emails/mes (solo 3 meses) |
| **Configuración DNS** | NO necesaria para pruebas | Necesaria o usar Sandbox |
| **API Key** | Solo 1 | API Key + Domain + Sender |
| **Facilidad de uso** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Velocidad de setup** | ⭐⭐⭐⭐⭐ (5 minutos) | ⭐⭐⭐ (15-20 minutos) |
| **Precio después del gratuito** | $20/mes (50k emails) | $35/mes (50k emails) |

**Conclusión:** Resend es más simple, más barato y más rápido de configurar. ✅

---

## 🎯 Recomendación Final

**Para empezar hoy mismo:**
1. ✅ Usa el **dominio onboarding** de Resend (`onboarding@resend.dev`)
2. ✅ Solo necesitas la API Key
3. ✅ Haz pruebas inmediatamente

**Para producción (opcional, no urgente):**
1. ✅ Configura el dominio personalizado `ticketcolombia.co`
2. ✅ Verifica los DNS en GoDaddy
3. ✅ Actualiza `SENDER_EMAIL` a `tickets@ticketcolombia.co`
4. ✅ Redespliega la función

---

## ✅ Checklist

- [ ] Cuenta de Resend creada
- [ ] API Key copiada y guardada
- [ ] Los 4 secretos configurados en Firebase (`RESEND_API_KEY`, `SENDER_EMAIL`, `SENDER_NAME`, `APP_URL`)
- [ ] Función redesplegada
- [ ] Prueba de envío exitosa

---

## 📞 ¿Necesitas Ayuda?

Si te atascas en algún paso, compárteme:
1. Una captura de pantalla del error (si lo hay)
2. Los valores que configuraste (sin mostrar la API Key completa)
3. El mensaje de error exacto de los logs de Firebase

¡Éxito! 🚀

---

## 📚 Recursos Adicionales

- **Dashboard de Resend:** https://resend.com/dashboard
- **Documentación oficial:** https://resend.com/docs
- **Panel de logs:** https://resend.com/logs (para ver emails enviados)
- **Status de la API:** https://status.resend.com/





