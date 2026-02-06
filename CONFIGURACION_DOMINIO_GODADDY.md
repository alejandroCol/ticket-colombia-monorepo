# 🌐 Configuración de Dominio ticketcolombia.co en GoDaddy

Esta guía te ayudará a conectar tu dominio `ticketcolombia.co` de GoDaddy con Firebase Hosting.

---

## 🎯 Estructura de Dominios Recomendada

```
ticketcolombia.co              → App Principal (usuarios compran tickets)
www.ticketcolombia.co          → Redirige a ticketcolombia.co
admin.ticketcolombia.co        → Panel Administrativo
```

---

## 📋 PASO 1: Configurar Dominios en Firebase

### 1.1 Agregar Dominio Principal en Firebase

```bash
# Asegúrate de estar en la carpeta correcta
cd /Users/alejandro/Documents/Repos\ Tiquetera/bitcomedia-main-app

# Agregar dominio personalizado
firebase hosting:channel:deploy production
```

**O desde la Consola de Firebase:**

1. Ir a: https://console.firebase.google.com/project/ticket-colombia-e6267/hosting/sites
2. Click en "Agregar dominio personalizado"
3. Ingresar: `ticketcolombia.co`
4. Click en "Continuar"

Firebase te mostrará algo como:

```
Tipo A
Nombre: @
Valor: 199.36.158.100

Tipo A
Nombre: @
Valor: 199.36.158.101
```

**⚠️ GUARDA ESTOS VALORES** - los necesitarás en GoDaddy

---

### 1.2 Agregar www.ticketcolombia.co

Repite el proceso para `www.ticketcolombia.co`:
1. Click en "Agregar dominio personalizado"
2. Ingresar: `www.ticketcolombia.co`
3. Guardar los valores que te da Firebase

---

### 1.3 Agregar Subdominio Admin

Para el panel admin:
1. Click en "Agregar dominio personalizado"
2. Ingresar: `admin.ticketcolombia.co`
3. Guardar los valores que te da Firebase

---

## 🔧 PASO 2: Configurar DNS en GoDaddy

### 2.1 Acceder a la Configuración DNS

1. Ir a: https://dcc.godaddy.com/
2. Iniciar sesión
3. Click en tu dominio **"ticketcolombia.co"**
4. Scroll hasta **"Configuración adicional"**
5. Click en **"Administrar DNS"**

---

### 2.2 Eliminar Registros A Existentes (IMPORTANTE)

Antes de agregar los nuevos, debes eliminar los registros A que apunten al nombre `@`:

1. Buscar registros tipo **"A"** con nombre **"@"**
2. Click en el ícono de **lápiz** o **tres puntos**
3. Click en **"Eliminar"**
4. Confirmar

**⚠️ NO elimines registros MX (correo) ni CNAME (www) si los tienes**

---

### 2.3 Agregar Registros A para Firebase

Ahora agrega los registros que Firebase te dio:

#### **Dominio Principal (ticketcolombia.co)**

| Tipo | Nombre | Valor | TTL |
|------|--------|-------|-----|
| A | @ | 199.36.158.100 | 1 hora (predeterminado) |
| A | @ | 199.36.158.101 | 1 hora (predeterminado) |

**Cómo agregar:**
1. Click en **"Agregar"** o **"Agregar registro"**
2. Seleccionar tipo: **A**
3. Nombre: **@** (esto significa el dominio raíz)
4. Valor: **199.36.158.100**
5. TTL: dejar predeterminado (1 hora)
6. Guardar
7. Repetir para la segunda IP: **199.36.158.101**

---

#### **Subdominio www (www.ticketcolombia.co)**

Firebase te dará registros similares. Agrégalos así:

| Tipo | Nombre | Valor | TTL |
|------|--------|-------|-----|
| CNAME | www | ticketcolombia.co | 1 hora |

**O puede que Firebase te pida registros A:**

| Tipo | Nombre | Valor | TTL |
|------|--------|-------|-----|
| A | www | 199.36.158.100 | 1 hora |
| A | www | 199.36.158.101 | 1 hora |

**Cómo agregar:**
1. Click en **"Agregar"**
2. Tipo: **CNAME** (o **A** según lo que Firebase indique)
3. Nombre: **www**
4. Valor: **ticketcolombia.co** (o las IPs)
5. Guardar

---

#### **Subdominio Admin (admin.ticketcolombia.co)**

| Tipo | Nombre | Valor | TTL |
|------|--------|-------|-----|
| A | admin | 199.36.158.100 | 1 hora |
| A | admin | 199.36.158.101 | 1 hora |

**Cómo agregar:**
1. Click en **"Agregar"**
2. Tipo: **A**
3. Nombre: **admin**
4. Valor: las IPs que Firebase te dio para este subdominio
5. Guardar

---

### 2.4 Agregar Registro TXT (Verificación)

Firebase también te pedirá un registro TXT para verificar que eres dueño del dominio:

| Tipo | Nombre | Valor | TTL |
|------|--------|-------|-----|
| TXT | @ | firebase=ticket-colombia-e6267 | 1 hora |

**Cómo agregar:**
1. Click en **"Agregar"**
2. Tipo: **TXT**
3. Nombre: **@**
4. Valor: el código que Firebase te dio (algo como `firebase=ticket-colombia-e6267`)
5. Guardar

---

## ✅ PASO 3: Verificar Configuración

### 3.1 Resumen de Registros DNS que debes tener

Al final, tu DNS en GoDaddy debe verse así:

```
Tipo    Nombre    Valor                           TTL
────────────────────────────────────────────────────────────
A       @         199.36.158.100                  1 hora
A       @         199.36.158.101                  1 hora
A       admin     199.36.158.100                  1 hora
A       admin     199.36.158.101                  1 hora
CNAME   www       ticketcolombia.co               1 hora
TXT     @         firebase=ticket-colombia-e6267  1 hora
```

**Notas:**
- Las IPs pueden variar según lo que Firebase te dé
- NO toques registros MX (correo) ni otros que ya estén configurados

---

### 3.2 Guardar Cambios en GoDaddy

1. Verificar que todos los registros estén correctos
2. Click en **"Guardar"** o los cambios se guardan automáticamente
3. GoDaddy puede mostrar un mensaje: "Los cambios pueden tardar hasta 48 horas"

---

## ⏱️ PASO 4: Esperar Propagación DNS

### ¿Cuánto tarda?

- **Mínimo**: 10-30 minutos
- **Normal**: 2-4 horas
- **Máximo**: 24-48 horas

### ¿Cómo verificar si ya está activo?

#### Opción 1: Comando en Terminal

```bash
# Verificar dominio principal
dig ticketcolombia.co

# Verificar subdominio admin
dig admin.ticketcolombia.co

# Debería mostrar las IPs de Firebase (199.36.158.100, etc.)
```

#### Opción 2: Herramienta Online

1. Ir a: https://www.whatsmydns.net/
2. Ingresar: `ticketcolombia.co`
3. Tipo: **A**
4. Click en **"Search"**
5. Verificar que la mayoría de países muestren las IPs de Firebase

---

## 🔒 PASO 5: Certificado SSL (HTTPS)

Firebase configurará automáticamente el certificado SSL:

1. Una vez que los DNS estén propagados
2. Firebase detectará el dominio
3. Emitirá un certificado SSL gratuito (Let's Encrypt)
4. Puede tardar **hasta 24 horas**

### Verificar SSL

Cuando esté listo, podrás acceder a:
- ✅ https://ticketcolombia.co (con candado verde 🔒)
- ✅ https://www.ticketcolombia.co
- ✅ https://admin.ticketcolombia.co

---

## 🚀 PASO 6: Verificar que Todo Funcione

Una vez que los DNS estén propagados y el SSL activo:

### 6.1 Probar App Principal

```bash
# Abrir en el navegador
open https://ticketcolombia.co
```

Verificar:
- ✅ Se carga la aplicación
- ✅ Aparece el candado 🔒 (HTTPS)
- ✅ Puedes navegar y hacer login

### 6.2 Probar Panel Admin

```bash
# Abrir en el navegador
open https://admin.ticketcolombia.co
```

Verificar:
- ✅ Se carga el panel
- ✅ HTTPS activo
- ✅ Puedes hacer login como admin

### 6.3 Probar Redirección www

```bash
# Abrir en el navegador
open https://www.ticketcolombia.co
```

Verificar:
- ✅ Redirige automáticamente a `ticketcolombia.co`

---

## 🔄 PASO 7: Actualizar URLs en el Código

Una vez que el dominio funcione, actualiza las URLs en tu código:

### 7.1 Actualizar MercadoPago Webhook

Archivo: `bitcomedia-functions/functions/src/features/payments/services/payment.service.ts`

```typescript
notification_url: "https://api.ticketcolombia.co/mercadopagoWebhook",
```

O si no usas subdominio para API:
```typescript
notification_url: "https://ticketcolombia.co/api/mercadopagoWebhook",
```

### 7.2 Actualizar Back URLs

En el mismo archivo:

```typescript
back_urls: {
  success: `https://ticketcolombia.co/compra-finalizada?event=${eventData.slug || eventData.id}&value=${request.amount}`,
  failure: `https://ticketcolombia.co/tickets`,
  pending: `https://ticketcolombia.co/compra-finalizada?event=${eventData.slug || eventData.id}&value=${request.amount}`,
},
```

### 7.3 Actualizar Secret APP_URL

```bash
cd /Users/alejandro/Documents/Repos\ Tiquetera/bitcomedia-functions

firebase functions:secrets:set APP_URL
# Cuando te pida el valor, ingresa: https://ticketcolombia.co
```

### 7.4 Re-desplegar Functions

```bash
cd bitcomedia-functions/functions
npm run build
cd ..
firebase deploy --only functions
```

---

## 🌐 PASO 8: Configurar Webhook en MercadoPago

1. Ir a: https://www.mercadopago.com.co/developers/panel
2. Seleccionar "Ticket Colombia"
3. Ir a "Webhooks"
4. Actualizar URL a: `https://ticketcolombia.co/mercadopagoWebhook`
   - O la URL que corresponda según tu configuración
5. Guardar

---

## 📊 Referencia Visual: Pantalla de GoDaddy DNS

Tu pantalla de "Administrar DNS" en GoDaddy debe verse así:

```
┌─────────────────────────────────────────────────────────┐
│  Registros DNS                                          │
├──────┬────────┬──────────────────────┬─────────────────┤
│ Tipo │ Nombre │ Valor                │ TTL             │
├──────┼────────┼──────────────────────┼─────────────────┤
│  A   │   @    │ 199.36.158.100       │ 1 hora          │
│  A   │   @    │ 199.36.158.101       │ 1 hora          │
│  A   │ admin  │ 199.36.158.100       │ 1 hora          │
│  A   │ admin  │ 199.36.158.101       │ 1 hora          │
│CNAME │  www   │ ticketcolombia.co    │ 1 hora          │
│ TXT  │   @    │ firebase=ticket...   │ 1 hora          │
└──────┴────────┴──────────────────────┴─────────────────┘
```

---

## 🆘 Solución de Problemas

### Problema: "No puedo eliminar el registro A existente"

**Solución:** 
- GoDaddy a veces no permite eliminar el registro A por defecto
- En su lugar, **edítalo** con las nuevas IPs de Firebase

### Problema: "Firebase dice que no puede verificar el dominio"

**Solución:**
1. Verificar que el registro TXT esté correcto
2. Esperar 1-2 horas para propagación DNS
3. En Firebase, click en "Verificar" nuevamente

### Problema: "El sitio sigue mostrando Firebase default"

**Solución:**
1. Limpiar caché del navegador (Cmd + Shift + R)
2. Verificar que desplegaste la app: `firebase deploy --only hosting`
3. Esperar a que el SSL esté activo

### Problema: "ERR_SSL_VERSION_OR_CIPHER_MISMATCH"

**Solución:**
- El certificado SSL aún se está emitiendo
- Esperar 24 horas
- Verificar en Firebase Console que el estado sea "Activo"

### Problema: "www no redirige correctamente"

**Solución:**
- En Firebase Console, configurar redirección automática
- O agregar en `firebase.json`:
```json
{
  "hosting": {
    "redirects": [
      {
        "source": "/",
        "destination": "https://ticketcolombia.co",
        "type": 301
      }
    ]
  }
}
```

---

## ✅ Checklist Final

Antes de dar por terminada la configuración:

- [ ] Registros A agregados en GoDaddy para `@`
- [ ] Registros A agregados para `admin`
- [ ] CNAME agregado para `www`
- [ ] Registro TXT agregado para verificación
- [ ] DNS propagado (verificado con dig o whatsmydns)
- [ ] Certificado SSL activo (candado verde)
- [ ] `ticketcolombia.co` abre la app principal
- [ ] `admin.ticketcolombia.co` abre el panel admin
- [ ] `www.ticketcolombia.co` redirige correctamente
- [ ] URLs actualizadas en el código
- [ ] Functions re-desplegadas
- [ ] Webhook de MercadoPago actualizado
- [ ] Compra de prueba exitosa con el nuevo dominio

---

## 🎉 ¡Listo!

Tu aplicación ahora está accesible en:

📱 **App Principal**: https://ticketcolombia.co  
👨‍💼 **Panel Admin**: https://admin.ticketcolombia.co  
🌐 **Alternativa www**: https://www.ticketcolombia.co

---

## 📞 Links Útiles

- **Firebase Console - Hosting**: https://console.firebase.google.com/project/ticket-colombia-e6267/hosting/sites
- **GoDaddy DNS**: https://dcc.godaddy.com/
- **MercadoPago Webhooks**: https://www.mercadopago.com.co/developers/panel
- **Verificar DNS**: https://www.whatsmydns.net/
- **Verificar SSL**: https://www.ssllabs.com/ssltest/

---

**Última actualización**: Octubre 2025  
**Dominio**: ticketcolombia.co  
**Proveedor**: GoDaddy  
**Hosting**: Firebase





