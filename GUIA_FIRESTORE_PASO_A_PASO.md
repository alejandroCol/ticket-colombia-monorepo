# 🔥 Guía Paso a Paso: Configurar Firestore

## 📋 Índice
1. [Crear Proyecto Firebase](#1-crear-proyecto-firebase)
2. [Configurar Firestore Database](#2-configurar-firestore-database)
3. [Configurar Reglas de Seguridad](#3-configurar-reglas-de-seguridad)
4. [Crear Colecciones Necesarias](#4-crear-colecciones-necesarias)
5. [Configurar Índices](#5-configurar-índices)
6. [Obtener Credenciales](#6-obtener-credenciales)

---

## 1. Crear Proyecto Firebase

### Paso 1.1: Acceder a Firebase Console
1. Ve a: **https://console.firebase.google.com/**
2. Inicia sesión con tu cuenta de Google
3. Haz clic en **"Agregar proyecto"** o **"Add project"**

### Paso 1.2: Configurar el Proyecto
1. **Nombre del proyecto**: `ticket-colombia-prod`
   - Puedes usar el nombre que prefieras
   - Firebase generará un ID único (ej: `ticket-colombia-prod-abc123`)

2. Haz clic en **"Continuar"**

3. **Google Analytics**: 
   - ✅ Recomiendo activarlo
   - Te ayudará a ver estadísticas de uso
   - Haz clic en **"Continuar"**

4. **Cuenta de Analytics**:
   - Selecciona una cuenta existente o crea una nueva
   - Acepta los términos
   - Haz clic en **"Crear proyecto"**

5. **Espera** 30-60 segundos mientras Firebase crea tu proyecto

6. Haz clic en **"Continuar"** cuando esté listo

---

## 2. Configurar Firestore Database

### Paso 2.1: Crear Base de Datos

1. En el panel izquierdo, busca **"Compilación"** o **"Build"**
2. Haz clic en **"Firestore Database"**
3. Haz clic en **"Crear base de datos"** o **"Create database"**

### Paso 2.2: Elegir Modo de Seguridad

Verás dos opciones:

**Opción A: Modo de Prueba (NO recomendado para producción)**
```
⚠️ Permite lectura y escritura a cualquiera
⚠️ Solo para desarrollo/testing
```

**Opción B: Modo de Producción (RECOMENDADO) ✅**
```
✅ Requiere autenticación
✅ Más seguro
✅ Lo configuraremos después
```

1. Selecciona **"Empezar en modo de producción"**
2. Haz clic en **"Siguiente"**

### Paso 2.3: Elegir Ubicación

**Importante**: Una vez elegida, NO se puede cambiar

Para Colombia, las mejores opciones son:

1. **`southamerica-east1` (São Paulo)** ⭐ RECOMENDADO
   - Más cercana a Colombia
   - Mejor latencia
   
2. **`us-east1` (Carolina del Sur)**
   - Segunda opción
   - Más económica pero más lejos

3. Selecciona `southamerica-east1`
4. Haz clic en **"Habilitar"**

⏳ Espera 1-2 minutos mientras se crea la base de datos

---

## 3. Configurar Reglas de Seguridad

### Paso 3.1: Acceder a las Reglas

1. En Firestore Database, ve a la pestaña **"Reglas"** o **"Rules"**
2. Verás un editor con reglas básicas

### Paso 3.2: Copiar Reglas de Seguridad

**IMPORTANTE**: Estas reglas son para producción. Ajústalas según tus necesidades.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ============================
    // FUNCIONES AUXILIARES
    // ============================
    
    // Verificar si el usuario está autenticado
    function isSignedIn() {
      return request.auth != null;
    }
    
    // Verificar si el usuario es el dueño del recurso
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }
    
    // Verificar si el usuario es admin
    function isAdmin() {
      return isSignedIn() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid))
             .data.role == 'admin';
    }
    
    // ============================
    // COLECCIÓN: users
    // ============================
    match /users/{userId} {
      // Permitir lectura solo al dueño o admin
      allow read: if isOwner(userId) || isAdmin();
      
      // Permitir creación solo si el ID coincide con el auth
      allow create: if isSignedIn() && request.auth.uid == userId;
      
      // Permitir actualización solo al dueño
      allow update: if isOwner(userId);
      
      // No permitir eliminación (o solo admin)
      allow delete: if isAdmin();
    }
    
    // ============================
    // COLECCIÓN: events
    // ============================
    match /events/{eventId} {
      // Permitir lectura a todos
      allow read: if true;
      
      // Permitir creación/actualización solo a admins
      allow create, update: if isAdmin();
      
      // Permitir eliminación solo a admins
      allow delete: if isAdmin();
    }
    
    // ============================
    // COLECCIÓN: recurring_events
    // ============================
    match /recurring_events/{eventId} {
      // Permitir lectura solo a admins
      allow read: if isAdmin();
      
      // Permitir escritura solo a admins
      allow write: if isAdmin();
    }
    
    // ============================
    // COLECCIÓN: tickets
    // ============================
    match /tickets/{ticketId} {
      // Permitir lectura al dueño del ticket o admin
      allow read: if isSignedIn() && 
                     (resource.data.userId == request.auth.uid || isAdmin());
      
      // Permitir creación a usuarios autenticados
      allow create: if isSignedIn() && request.auth.uid == request.resource.data.userId;
      
      // Permitir actualización solo a través de Cloud Functions o admin
      allow update: if isAdmin();
      
      // No permitir eliminación (mantener registro)
      allow delete: if false;
    }
    
    // ============================
    // COLECCIÓN: venues (lugares)
    // ============================
    match /venues/{venueId} {
      // Permitir lectura a todos
      allow read: if true;
      
      // Permitir escritura solo a admins
      allow write: if isAdmin();
    }
    
    // ============================
    // BLOQUEAR TODO LO DEMÁS
    // ============================
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Paso 3.3: Publicar Reglas

1. Haz clic en **"Publicar"** o **"Publish"**
2. Confirma la publicación
3. ✅ Las reglas ya están activas

---

## 4. Crear Colecciones Necesarias

### Paso 4.1: Ir a la Pestaña Datos

1. En Firestore Database, ve a la pestaña **"Datos"** o **"Data"**
2. Haz clic en **"Iniciar colección"** o **"Start collection"**

### Paso 4.2: Crear Colección "users"

1. **ID de colección**: `users`
2. Haz clic en **"Siguiente"**
3. **Crear primer documento** (ejemplo):
   - **ID del documento**: (déjalo en automático por ahora, o usa tu UID de prueba)
   - Agregar campos:
     ```
     Campo: email         Tipo: string    Valor: admin@ticketcolombia.com
     Campo: name          Tipo: string    Valor: Admin
     Campo: role          Tipo: string    Valor: admin
     Campo: createdAt     Tipo: timestamp Valor: (ahora)
     ```
4. Haz clic en **"Guardar"**

### Paso 4.3: Crear Colección "events"

1. Haz clic en **"Iniciar colección"**
2. **ID de colección**: `events`
3. **Crear documento de ejemplo**:
   ```
   Campo: name          Tipo: string    Valor: Evento de Prueba
   Campo: description   Tipo: string    Valor: Este es un evento de prueba
   Campo: date          Tipo: string    Valor: 2025-12-31
   Campo: time          Tipo: string    Valor: 20:00
   Campo: city          Tipo: string    Valor: Bogotá
   Campo: price         Tipo: number    Valor: 50000
   Campo: capacity      Tipo: number    Valor: 100
   Campo: active        Tipo: boolean   Valor: true
   Campo: createdAt     Tipo: timestamp Valor: (ahora)
   ```
4. Haz clic en **"Guardar"**

### Paso 4.4: Crear Colección "tickets"

1. Haz clic en **"Iniciar colección"**
2. **ID de colección**: `tickets`
3. Haz clic en **"Guardar"** (dejar vacía, se llenará con compras)

### Paso 4.5: Crear Colección "venues"

1. Haz clic en **"Iniciar colección"**
2. **ID de colección**: `venues`
3. **Crear documento de ejemplo**:
   ```
   Campo: name          Tipo: string    Valor: Teatro Principal
   Campo: address       Tipo: string    Valor: Calle 123 # 45-67
   Campo: city          Tipo: string    Valor: Bogotá
   Campo: capacity      Tipo: number    Valor: 200
   Campo: active        Tipo: boolean   Valor: true
   ```
4. Haz clic en **"Guardar"**

### Paso 4.6: Crear Colección "recurring_events"

1. Haz clic en **"Iniciar colección"**
2. **ID de colección**: `recurring_events`
3. Haz clic en **"Guardar"** (dejar vacía)

---

## 5. Configurar Índices

Los índices mejoran el rendimiento de las consultas.

### Paso 5.1: Acceder a Índices

1. En Firestore Database, ve a la pestaña **"Índices"** o **"Indexes"**
2. Ve a **"Índices compuestos"** o **"Composite indexes"**

### Paso 5.2: Crear Índice para Events

1. Haz clic en **"Crear índice"**
2. **Colección**: `events`
3. **Campos**:
   - Campo: `active`, Orden: Ascendente
   - Campo: `date`, Orden: Ascendente
   - Campo: `time`, Orden: Ascendente
4. **Estado de consulta**: Habilitado
5. Haz clic en **"Crear"**

### Paso 5.3: Crear Índice para Tickets

1. Haz clic en **"Crear índice"**
2. **Colección**: `tickets`
3. **Campos**:
   - Campo: `userId`, Orden: Ascendente
   - Campo: `createdAt`, Orden: Descendente
4. Haz clic en **"Crear"**

### Paso 5.4: Esperar Construcción

Los índices pueden tardar unos minutos en construirse. Verás el estado:
- 🟡 **Building** (Construyendo)
- 🟢 **Enabled** (Habilitado)

---

## 6. Obtener Credenciales

### Paso 6.1: Registrar App Web

1. En la página principal de Firebase (icono de casa), ve a **"Configuración del proyecto"** (⚙️)
2. Baja hasta la sección **"Tus aplicaciones"**
3. Haz clic en el ícono **`</>`** (Web)

### Paso 6.2: Registrar la App

1. **Alias de la app**: `ticket-colombia-web`
2. ✅ Marcar **"Configurar también Firebase Hosting"**
3. Haz clic en **"Registrar app"**

### Paso 6.3: Copiar Credenciales

Verás algo como esto:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "ticket-colombia-prod.firebaseapp.com",
  projectId: "ticket-colombia-prod",
  storageBucket: "ticket-colombia-prod.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:xxxxxxxxxxxx",
  measurementId: "G-XXXXXXXXXX"
};
```

### Paso 6.4: Actualizar en el Código

**Archivo 1**: `bitcomedia-main-app/src/services/firebase-confi.ts`

```typescript
export const firebaseConfig = {
    apiKey: "TU_API_KEY_AQUI",
    authDomain: "ticket-colombia-prod.firebaseapp.com",
    projectId: "ticket-colombia-prod",
    storageBucket: "ticket-colombia-prod.appspot.com",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID",
    measurementId: "TU_MEASUREMENT_ID"
};
```

**Archivo 2**: `bitcomedia-web-admin/src/services/firebase-confi.ts`

```typescript
// Copiar exactamente las mismas credenciales
export const firebaseConfig = {
    apiKey: "TU_API_KEY_AQUI",
    authDomain: "ticket-colombia-prod.firebaseapp.com",
    projectId: "ticket-colombia-prod",
    storageBucket: "ticket-colombia-prod.appspot.com",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID",
    measurementId: "TU_MEASUREMENT_ID"
};
```

---

## 7. Configurar Authentication

### Paso 7.1: Habilitar Email/Password

1. En el panel izquierdo, ve a **"Authentication"**
2. Haz clic en **"Comenzar"** o **"Get started"**
3. Ve a la pestaña **"Sign-in method"**
4. Haz clic en **"Correo electrónico/contraseña"** o **"Email/Password"**
5. ✅ Habilita **"Correo electrónico/contraseña"**
6. ❌ NO habilites "Vínculo de correo electrónico" (opcional)
7. Haz clic en **"Guardar"**

### Paso 7.2: Crear Usuario Admin

1. Ve a la pestaña **"Users"**
2. Haz clic en **"Agregar usuario"**
3. **Correo**: `admin@ticketcolombia.com` (o el que prefieras)
4. **Contraseña**: (usa una contraseña segura)
5. Haz clic en **"Agregar usuario"**
6. **IMPORTANTE**: Copia el **User UID** que se genera

### Paso 7.3: Actualizar Documento de Usuario

1. Ve a **Firestore Database** → **Datos**
2. Busca la colección **"users"**
3. Si creaste un documento de prueba antes, elimínalo
4. Crea un nuevo documento con el **UID del usuario admin**:
   - Haz clic en **"Agregar documento"**
   - **ID del documento**: (pega el UID que copiaste)
   - Campos:
     ```
     email: admin@ticketcolombia.com
     name: Admin
     role: admin
     createdAt: (timestamp actual)
     ```
5. Guarda

---

## 8. Configurar Storage

### Paso 8.1: Habilitar Storage

1. En el panel izquierdo, ve a **"Storage"**
2. Haz clic en **"Comenzar"**
3. Selecciona **"Empezar en modo de producción"**
4. Haz clic en **"Siguiente"**
5. Selecciona la misma ubicación que Firestore: **`southamerica-east1`**
6. Haz clic en **"Listo"**

### Paso 8.2: Configurar Reglas de Storage

1. Ve a la pestaña **"Rules"**
2. Reemplaza las reglas con:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Imágenes de eventos - lectura pública, escritura admin
    match /events/{eventId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && 
                      request.auth.token.role == 'admin';
    }
    
    // Imágenes de venues - lectura pública, escritura admin
    match /venues/{venueId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && 
                      request.auth.token.role == 'admin';
    }
    
    // QR codes de tickets - solo el dueño o admin
    match /tickets/{userId}/{ticketId}/qr.png {
      allow read: if request.auth != null && 
                     (request.auth.uid == userId || 
                      request.auth.token.role == 'admin');
      allow write: if false; // Solo a través de Cloud Functions
    }
    
    // Bloquear todo lo demás
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

3. Haz clic en **"Publicar"**

---

## 9. Configurar en Firebase CLI

### Paso 9.1: Instalar Firebase CLI (si no lo tienes)

```bash
npm install -g firebase-tools
```

### Paso 9.2: Iniciar Sesión

```bash
firebase login
```

### Paso 9.3: Seleccionar Proyecto

```bash
# En cada carpeta del proyecto:
cd bitcomedia-main-app
firebase use --add
# Selecciona: ticket-colombia-prod
# Alias: default

cd ../bitcomedia-web-admin
firebase use --add
# Selecciona: ticket-colombia-prod
# Alias: default

cd ../bitcomedia-functions
firebase use --add
# Selecciona: ticket-colombia-prod
# Alias: default
```

---

## ✅ Verificación Final

### Checklist Firestore

- [ ] Proyecto Firebase creado
- [ ] Firestore habilitado en modo producción
- [ ] Ubicación configurada (southamerica-east1)
- [ ] Reglas de seguridad publicadas
- [ ] Colecciones creadas:
  - [ ] users
  - [ ] events
  - [ ] tickets
  - [ ] venues
  - [ ] recurring_events
- [ ] Índices creados
- [ ] Authentication habilitado (Email/Password)
- [ ] Usuario admin creado
- [ ] Storage habilitado y configurado
- [ ] Credenciales copiadas y actualizadas en el código
- [ ] Firebase CLI configurado

---

## 🚀 Probar la Configuración

### Prueba 1: Autenticación

```bash
cd bitcomedia-main-app
npm run dev
```

1. Abre `http://localhost:5173/login`
2. Intenta iniciar sesión con tu usuario admin
3. ✅ Deberías poder entrar

### Prueba 2: Lectura de Firestore

```bash
# En la consola del navegador (F12):
```

```javascript
// Esto debería funcionar si todo está bien
import { collection, getDocs } from 'firebase/firestore';
const events = await getDocs(collection(db, 'events'));
console.log(events.docs.map(d => d.data()));
```

---

## 📞 Soporte

Si tienes problemas:

1. **Revisa la consola del navegador** (F12) para errores
2. **Verifica las reglas de Firestore** en Firebase Console
3. **Asegúrate de que el usuario esté autenticado**
4. **Revisa que las credenciales estén correctas** en `firebase-confi.ts`

---

## 🎯 Próximo Paso

Una vez completado esto, continúa con:
- **[Configuración de MercadoPago](./GUIA_MERCADOPAGO_PASO_A_PASO.md)**

---

✅ **¡Firestore configurado correctamente!**





