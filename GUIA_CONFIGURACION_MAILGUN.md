# 📧 Guía Completa: Configuración de Mailgun para Ticket Colombia

Esta guía te mostrará paso a paso cómo obtener las credenciales de Mailgun necesarias para enviar tickets por correo electrónico.

---

## 📋 Índice

1. [Crear Cuenta en Mailgun](#1-crear-cuenta-en-mailgun)
2. [Obtener API Key](#2-obtener-api-key)
3. [Configurar Dominio](#3-configurar-dominio)
4. [Configurar Email del Remitente](#4-configurar-email-del-remitente)
5. [Configurar Secretos en Firebase](#5-configurar-secretos-en-firebase)
6. [Alternativa: Usar Sandbox para Pruebas](#alternativa-usar-sandbox-para-pruebas)

---

## 1. Crear Cuenta en Mailgun

### Paso 1.1: Registrarse

1. Ve a **https://www.mailgun.com/**
2. Haz clic en **"Sign Up"** (arriba a la derecha)
3. Completa el formulario de registro:
   - **Email**: `ale.mar.guz@gmail.com` (o tu email)
   - **Password**: (elige una contraseña segura)
   - **Company**: `Ticket Colombia`
   - **Website**: `ticketcolombia.co`
4. Haz clic en **"Start Sending"**

### Paso 1.2: Verificar Email

1. Revisa tu bandeja de entrada
2. Haz clic en el link de verificación que Mailgun te envió
3. Completa el proceso de verificación

### Paso 1.3: Elegir Plan

- **Plan Gratuito (Foundation)**: 
  - ✅ 5,000 emails gratis por mes durante 3 meses
  - ✅ Perfecto para empezar
  - Luego: $35/mes para 50,000 emails
  
- **Selecciona el plan gratuito** para comenzar

---

## 2. Obtener API Key

### Paso 2.1: Acceder a la Configuración

1. Una vez dentro del dashboard de Mailgun, ve a:
   ```
   Settings → API Keys
   ```
   
2. O directamente: **https://app.mailgun.com/settings/api_security**

### Paso 2.2: Copiar la API Key

Verás una tabla con tus API Keys. Busca:

```
Private API key: key-1234567890abcdefghijklmnopqrstuv
```

1. Haz clic en el **ícono del ojo** 👁️ para revelar la key completa
2. Haz clic en **"Copy"** para copiarla al portapapeles
3. **GUÁRDALA EN UN LUGAR SEGURO** (la necesitarás en el Paso 5)

**Ejemplo de API Key:**
```
key-1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
```

⚠️ **IMPORTANTE:** Nunca compartas esta key públicamente ni la subas a GitHub.

---

## 3. Configurar Dominio

Tienes dos opciones:

### Opción A: Usar el Sandbox Domain (Para Pruebas) ⭐ RECOMENDADO PARA EMPEZAR

El sandbox domain te permite enviar emails de prueba sin configurar DNS.

1. Ve a: **Sending → Domains**
2. Verás algo como:
   ```
   sandboxXXXXXXXXXXXXXXXXXXXXXXXX.mailgun.org
   ```
3. **Copia ese dominio completo**
4. **GUÁRDALO** (lo necesitarás en el Paso 5)

**⚠️ Limitación del Sandbox:**
- Solo puedes enviar emails a direcciones autorizadas
- Debes agregar tu email personal como "Authorized Recipient"

#### 3.1: Agregar Authorized Recipients (Solo para Sandbox)

1. Haz clic en tu sandbox domain
2. Ve a la pestaña **"Authorized Recipients"**
3. Haz clic en **"Add Authorized Recipient"**
4. Ingresa tu email: `ale.mar.guz@gmail.com`
5. Haz clic en **"Save"**
6. Revisa tu email y haz clic en el link de confirmación

Ahora puedes enviar emails de prueba a `ale.mar.guz@gmail.com`.

---

### Opción B: Configurar tu Dominio Personalizado (ticketcolombia.co) - Para Producción

**⚠️ NOTA:** Esto requiere acceso a los DNS de tu dominio en GoDaddy.

1. Ve a: **Sending → Domains**
2. Haz clic en **"Add New Domain"**
3. Ingresa: `mg.ticketcolombia.co`
4. Selecciona región: **US** (o EU si prefieres)
5. Haz clic en **"Add Domain"**

#### 3.2: Verificar el Dominio en GoDaddy

Mailgun te mostrará registros DNS que debes agregar:

**Registros TXT (para verificación y SPF):**
```
Type: TXT
Name: mg.ticketcolombia.co
Value: v=spf1 include:mailgun.org ~all
TTL: 600 (o 3600)
```

**Registros MX (para recibir bounces):**
```
Type: MX
Name: mg.ticketcolombia.co
Priority: 10
Value: mxa.mailgun.org
TTL: 600
```

```
Type: MX
Name: mg.ticketcolombia.co
Priority: 10
Value: mxb.mailgun.org
TTL: 600
```

**Registros CNAME (para tracking):**
```
Type: CNAME
Name: email.mg.ticketcolombia.co
Value: mailgun.org
TTL: 600
```

**Registro DKIM (para autenticación):**
```
Type: TXT
Name: k1._domainkey.mg.ticketcolombia.co
Value: k=rsa; p=MIGfMA0GCSqGS... (te lo dará Mailgun)
TTL: 600
```

#### 3.3: Agregar los Registros en GoDaddy

1. Inicia sesión en **https://godaddy.com**
2. Ve a **"My Products" → "DNS"**
3. Busca `ticketcolombia.co` y haz clic en **"Manage DNS"**
4. Haz clic en **"Add"** para cada registro
5. Copia y pega los valores exactos que Mailgun te dio
6. Haz clic en **"Save"**

⏱️ **Espera 10-30 minutos** para que los DNS se propaguen.

#### 3.4: Verificar el Dominio

1. Vuelve a Mailgun: **Sending → Domains**
2. Haz clic en tu dominio: `mg.ticketcolombia.co`
3. Haz clic en **"Verify DNS Settings"**
4. Si todo está correcto, verás checkmarks verdes ✅

---

## 4. Configurar Email del Remitente

Este es el email que aparecerá como remitente de los tickets.

### Opciones:

1. **Para Sandbox:**
   ```
   no-reply@sandboxXXXXXXXXXXXXXXXXXXXXXXXX.mailgun.org
   ```

2. **Para Dominio Personalizado:**
   ```
   tickets@ticketcolombia.co
   no-reply@ticketcolombia.co
   info@ticketcolombia.co
   ```

**Recomendación:** Usa `tickets@ticketcolombia.co` o `no-reply@ticketcolombia.co`

⚠️ **IMPORTANTE:** El dominio del email debe coincidir con el dominio que configuraste en Mailgun.

---

## 5. Configurar Secretos en Firebase

Ahora que tienes todos los valores, configúralos en Firebase:

### Paso 5.1: Abrir Terminal

```bash
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions/functions"
```

### Paso 5.2: Configurar MAILGUN_API_KEY

```bash
firebase functions:secrets:set --project ticket-colombia-e6267 MAILGUN_API_KEY
```

Cuando te pregunte, pega tu API Key:
```
key-1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
```

Presiona **Enter**.

### Paso 5.3: Configurar MAILGUN_DOMAIN

```bash
firebase functions:secrets:set --project ticket-colombia-e6267 MAILGUN_DOMAIN
```

Ingresa tu dominio:
- **Para Sandbox:** `sandboxXXXXXXXXXXXXXXXXXXXXXXXX.mailgun.org`
- **Para Producción:** `mg.ticketcolombia.co`

Presiona **Enter**.

### Paso 5.4: Configurar SENDER_EMAIL

```bash
firebase functions:secrets:set --project ticket-colombia-e6267 SENDER_EMAIL
```

Ingresa el email del remitente:
- **Para Sandbox:** `no-reply@sandboxXXXXXXXXXXXXXXXXXXXXXXXX.mailgun.org`
- **Para Producción:** `tickets@ticketcolombia.co`

Presiona **Enter**.

### Paso 5.5: Configurar APP_URL

```bash
firebase functions:secrets:set --project ticket-colombia-e6267 APP_URL
```

Ingresa la URL de tu aplicación:
```
https://ticketcolombia.co
```

Presiona **Enter**.

### Paso 5.6: Verificar que los Secretos Están Configurados

```bash
firebase functions:secrets:access --project ticket-colombia-e6267
```

Deberías ver algo como:
```
✔ Secrets configured:
  - MAILGUN_API_KEY
  - MAILGUN_DOMAIN
  - SENDER_EMAIL
  - APP_URL
  - MERCADOPAGO_ACCESS_TOKEN
  - MERCADOPAGO_WEBHOOK_SECRET
```

---

## 6. Redesplegar la Función

Ahora que los secretos están configurados, redespliega la función:

```bash
firebase deploy --only functions:createManualTicket --project ticket-colombia-e6267
```

---

## Alternativa: Usar Sandbox para Pruebas

Si quieres **probar rápido sin configurar tu dominio**, usa el Sandbox:

### Resumen de Valores para Sandbox:

```bash
# MAILGUN_API_KEY
key-1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p  # (tu key real)

# MAILGUN_DOMAIN
sandbox1234567890abcdef1234567890ab.mailgun.org  # (tu sandbox real)

# SENDER_EMAIL
no-reply@sandbox1234567890abcdef1234567890ab.mailgun.org

# APP_URL
https://ticketcolombia.co
```

### ⚠️ No Olvides:

1. Agregar `ale.mar.guz@gmail.com` como **Authorized Recipient**
2. Verificar el email de autorización que recibirás

---

## 🧪 Probar el Envío de Emails

1. **Completa todos los pasos anteriores**
2. **Redespliega la función** (Paso 6)
3. **Abre el panel admin:** https://admin-ticket-colombia.web.app
4. **Inicia sesión** como administrador
5. **Haz clic en "Crear Ticket"** en cualquier evento
6. **Rellena el formulario:**
   - **Nombre:** Tu nombre
   - **Email:** `ale.mar.guz@gmail.com` (o el email que autorizaste)
   - **Cantidad:** 1
7. **Haz clic en "Crear Ticket"**
8. **Revisa tu bandeja de entrada** (y spam si no lo ves)

---

## 🐛 Troubleshooting

### Error: "Authentication failed"

- **Causa:** API Key incorrecta
- **Solución:** Verifica que copiaste la API Key completa (comienza con `key-`)

### Error: "Domain not found"

- **Causa:** El dominio no está configurado o verificado
- **Solución:** Verifica que el dominio en Mailgun esté activo y verificado

### No recibo el correo (Sandbox)

- **Causa:** Tu email no está autorizado
- **Solución:** Agrega tu email como "Authorized Recipient" y verifica el link

### No recibo el correo (Producción)

- **Causa:** DNS no propagados o incorrectos
- **Solución:** Espera 30 minutos y verifica los registros DNS en Mailgun

### Error: "Sandbox domain requires authorized recipients"

- **Causa:** Intentas enviar a un email no autorizado
- **Solución:** Agrega el email del destinatario en "Authorized Recipients"

---

## 📊 Resumen de Valores Necesarios

Al final, necesitarás tener estos 4 valores:

| Secreto | Ejemplo Sandbox | Ejemplo Producción |
|---------|----------------|-------------------|
| **MAILGUN_API_KEY** | `key-1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p` | `key-1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p` |
| **MAILGUN_DOMAIN** | `sandbox123...mailgun.org` | `mg.ticketcolombia.co` |
| **SENDER_EMAIL** | `no-reply@sandbox123...mailgun.org` | `tickets@ticketcolombia.co` |
| **APP_URL** | `https://ticketcolombia.co` | `https://ticketcolombia.co` |

---

## 🎯 Recomendación Final

**Para empezar hoy mismo:**
1. ✅ Usa el **Sandbox** de Mailgun
2. ✅ Autoriza tu email personal
3. ✅ Haz pruebas

**Para producción:**
1. ✅ Configura el dominio personalizado `mg.ticketcolombia.co`
2. ✅ Verifica los DNS en GoDaddy
3. ✅ Actualiza los secretos de Firebase
4. ✅ Redespliega la función

---

## ✅ Checklist

- [ ] Cuenta de Mailgun creada
- [ ] API Key copiada
- [ ] Dominio configurado (Sandbox o Personalizado)
- [ ] Email autorizado (si usas Sandbox)
- [ ] Los 4 secretos configurados en Firebase
- [ ] Función redesplegada
- [ ] Prueba de envío exitosa

---

## 📞 ¿Necesitas Ayuda?

Si te atascas en algún paso, compárteme:
1. Una captura de pantalla del error (si lo hay)
2. Los valores que configuraste (sin mostrar la API Key completa)
3. Si estás usando Sandbox o dominio personalizado

¡Éxito! 🚀





