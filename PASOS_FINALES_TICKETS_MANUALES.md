# 🎫 Pasos Finales para Completar Tickets Manuales

**Fecha:** 28 de octubre de 2025  
**Estado:** Frontend ✅ Completado | Backend 🔄 Falta Ejecutar Comandos

---

## ✅ LO QUE YA ESTÁ HECHO

- ✅ Modal de creación de tickets (Frontend)
- ✅ Botón "🎫 Crear Ticket" en cada evento
- ✅ Integración con dashboard
- ✅ Función Firebase `createManualTicket` (código)
- ✅ Generador de PDF (`pdf-generator.ts`)
- ✅ Enviador de Email (`email-sender.ts`)
- ✅ Exportación en `index.ts`

---

## 🚀 COMANDOS A EJECUTAR (En tu Terminal)

### PASO 1: Arreglar Permisos de NPM

```bash
sudo chown -R 501:20 "/Users/alejandro/.npm"
```

*Te pedirá tu contraseña de Mac.*

---

### PASO 2: Instalar Dependencias

```bash
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions/functions"

npm install pdfkit @types/pdfkit --save
```

---

### PASO 3: Compilar Functions

```bash
npm run build
```

*Debería compilar sin errores.*

---

### PASO 4: Desplegar Función

```bash
firebase deploy --only functions:createManualTicket --project ticket-colombia-e6267
```

*Esto toma 2-5 minutos.*

---

### PASO 5: Instalar Extensión de Email (IMPORTANTE)

```bash
firebase ext:install firebase/firestore-send-email --project ticket-colombia-e6267
```

**Durante la instalación, te preguntará:**

1. **SMTP Connection URI:**
   - Para Gmail de prueba:
     ```
     smtps://tu-email@gmail.com:contraseña-app@smtp.gmail.com:465
     ```
   - Para SendGrid (recomendado producción):
     ```
     smtps://apikey:SG.tu-api-key@smtp.sendgrid.net:465
     ```

2. **Email collection:**
   ```
   mail
   ```

3. **Default FROM address:**
   ```
   noreply@ticketcolombia.co
   ```

**Nota:** Si usas Gmail, debes crear una "Contraseña de Aplicación":
1. Ve a: https://myaccount.google.com/apppasswords
2. Crea una contraseña nueva
3. Úsala en el SMTP URI

---

## ✅ Verificar que Todo Funciona

### 1. Verificar que la función se desplegó

```bash
firebase functions:list --project ticket-colombia-e6267
```

Deberías ver `createManualTicket` en la lista.

---

### 2. Probar desde el Panel Admin

1. **Ir a:** https://admin-ticket-colombia.web.app
2. **Login** con tu cuenta admin
3. **Click en "🎫 Crear Ticket"** en cualquier evento
4. **Completar formulario** con TU email
5. **Click "Crear Ticket"**
6. **Esperar alerta de éxito**
7. **Revisar tu email** (puede tardar 1-2 minutos)

---

### 3. Verificar en Firestore

```
https://console.firebase.google.com/project/ticket-colombia-e6267/firestore/data/~2Ftickets
```

- Busca tickets con `isManual: true`
- Verifica que tenga tu nombre y email

---

### 4. Verificar PDF en Storage

```
https://console.firebase.google.com/project/ticket-colombia-e6267/storage
```

- Busca carpeta `tickets/`
- Verifica que el PDF se generó

---

## 🆘 Problemas Comunes

### Error: "pdfkit not found"

**Solución:**
```bash
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions/functions"
npm install pdfkit @types/pdfkit --save
npm run build
```

---

### Error: "Permission denied" al crear ticket

**Causa:** Tu usuario no es admin.

**Solución:**
1. Ve a Firestore: https://console.firebase.google.com/project/ticket-colombia-e6267/firestore
2. Abre `users` → Tu UID
3. Verifica que `role` sea `ADMIN` (mayúsculas)

---

### Email no llega

**Causas posibles:**
1. Extensión no instalada
2. SMTP mal configurado
3. Email en spam

**Soluciones:**
1. Verificar logs:
   ```bash
   firebase functions:log --project ticket-colombia-e6267 --limit 20
   ```

2. Verificar colección `mail`:
   ```
   https://console.firebase.google.com/project/ticket-colombia-e6267/firestore/data/~2Fmail
   ```
   - Debería aparecer un documento
   - Si `delivery.state` es `ERROR`, revisa el mensaje

3. Revisar carpeta de spam

---

### Function no aparece después de desplegar

**Solución:**
```bash
# Listar functions
firebase functions:list --project ticket-colombia-e6267

# Si no aparece, redesplegar
firebase deploy --only functions --project ticket-colombia-e6267
```

---

## 📊 Resumen de Archivos Creados/Modificados

### Backend (Firebase Functions)

```
bitcomedia-functions/
└── functions/
    ├── src/
    │   ├── features/
    │   │   └── manual-ticket/
    │   │       ├── create-manual-ticket.ts   ✅ NUEVO
    │   │       ├── pdf-generator.ts          ✅ NUEVO
    │   │       └── email-sender.ts           ✅ NUEVO
    │   └── index.ts                          ✅ MODIFICADO
    └── package.json                          🔄 (agregar pdfkit)
```

### Frontend (Panel Admin)

```
bitcomedia-web-admin/
└── src/
    ├── components/
    │   └── CreateTicketModal/
    │       ├── index.tsx                     ✅ NUEVO
    │       └── index.scss                    ✅ NUEVO
    ├── containers/
    │   └── EventCard/
    │       ├── index.tsx                     ✅ MODIFICADO
    │       └── index.scss                    ✅ MODIFICADO
    ├── pages/
    │   └── dashboard/
    │       └── index.tsx                     ✅ MODIFICADO
    └── services/
        ├── firebase.ts                       ✅ MODIFICADO
        └── index.ts                          ✅ MODIFICADO
```

---

## 🎯 Script de Ejecución Rápida

Si prefieres ejecutar todo de una vez (después de arreglar permisos):

```bash
# 1. Arreglar permisos (requiere contraseña)
sudo chown -R 501:20 "/Users/alejandro/.npm"

# 2. Ir al directorio
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions/functions"

# 3. Instalar dependencias
npm install pdfkit @types/pdfkit --save

# 4. Compilar
npm run build

# 5. Desplegar
firebase deploy --only functions:createManualTicket --project ticket-colombia-e6267

# 6. Instalar extensión de email
firebase ext:install firebase/firestore-send-email --project ticket-colombia-e6267
```

---

## 🎉 ¿Qué Puedes Hacer una Vez Completado?

✅ **Crear tickets de cortesía** para invitados VIP  
✅ **Generar tickets para prensa**  
✅ **Tickets manuales** por pagos en efectivo  
✅ **Enviar tickets** con QR por email automáticamente  
✅ **Validar tickets manuales** igual que los pagados  
✅ **Trackear** quién creó cada ticket (campo `createdBy`)

---

## 📞 Soporte

Si algo no funciona:

1. **Revisar logs:**
   ```bash
   firebase functions:log --project ticket-colombia-e6267
   ```

2. **Verificar deployment:**
   ```bash
   firebase functions:list --project ticket-colombia-e6267
   ```

3. **Revisar documentación completa:**
   ```
   /Users/alejandro/Documents/Repos\ Tiquetera/IMPLEMENTAR_CREACION_TICKETS_MANUAL.md
   ```

---

**Última actualización:** 28 de octubre de 2025

**Siguiente paso:** Ejecutar los comandos en tu terminal 🚀





