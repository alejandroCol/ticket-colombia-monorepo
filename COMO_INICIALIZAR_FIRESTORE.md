# 🚀 Cómo Inicializar Firestore Automáticamente

Esta guía te muestra cómo usar el script de inicialización para crear todas las colecciones y datos de ejemplo automáticamente.

---

## ⚡ Opción Rápida (Recomendada)

### Paso 1: Crear Usuario en Authentication

**IMPORTANTE**: Primero debes crear el usuario en Firebase Authentication:

1. Ve a: https://console.firebase.google.com/project/ticket-colombia-e6267/authentication/users
2. Click en **"Add user"** (Agregar usuario)
3. Ingresa:
   - **Email**: `admin@ticketcolombia.com` (o el que prefieras)
   - **Password**: (tu contraseña segura)
4. Click en **"Add user"**
5. ⚠️ **COPIA EL UID** del usuario (ejemplo: `xYz123AbC456...`)
   - Lo verás en la columna "User UID"

### Paso 2: Ejecutar el Script

```bash
# Ve a la carpeta de functions
cd /Users/alejandro/Documents/Repos\ Tiquetera/bitcomedia-functions

# Instala dependencias (si no lo has hecho)
npm install

# Ejecuta el script de inicialización
npm run init-db
```

### Paso 3: Sigue las Instrucciones

El script te preguntará:

```
¿Deseas continuar? (si/no): si

Ingresa el UID del usuario admin: [PEGA EL UID QUE COPIASTE]
Ingresa el email del admin: admin@ticketcolombia.com
Ingresa el nombre del admin: Admin
```

### Paso 4: ¡Listo!

El script creará automáticamente:
- ✅ Usuario admin en Firestore con rol de administrador
- ✅ 3 Venues de ejemplo (Bogotá, Medellín, Cali)
- ✅ 1 Evento de prueba
- ✅ Todas las colecciones necesarias

---

## 📋 ¿Qué Crea el Script?

### 1. Usuario Admin (colección `users`)
```javascript
{
  email: "admin@ticketcolombia.com",
  name: "Admin",
  role: "admin",
  active: true,
  createdAt: [timestamp],
  updatedAt: [timestamp]
}
```

### 2. Venues (colección `venues`)
```javascript
[
  {
    name: "Teatro Nacional",
    city: "Bogotá",
    capacity: 300,
    address: "Calle 71 # 10-25"
  },
  {
    name: "Centro de Eventos Plaza Mayor",
    city: "Medellín",
    capacity: 500,
    address: "Carrera 48 # 10-30"
  },
  {
    name: "Auditorio Principal",
    city: "Cali",
    capacity: 250,
    address: "Calle 5 # 39-184"
  }
]
```

### 3. Evento de Ejemplo (colección `events`)
```javascript
{
  name: "Noche de Comedia - Evento de Prueba",
  slug: "noche-comedia-prueba",
  date: "[30 días en el futuro]",
  time: "20:00",
  city: "Bogotá",
  price: 50000,
  capacity: 200,
  event_type: "bitcomedia_direct",
  active: true,
  featured: true
}
```

---

## ✅ Verificar que Funcionó

### Opción 1: Firebase Console
1. Ve a: https://console.firebase.google.com/project/ticket-colombia-e6267/firestore
2. Deberías ver las colecciones:
   - `users` (1 documento)
   - `venues` (3 documentos)
   - `events` (1 documento)

### Opción 2: Desde tu App
```bash
cd /Users/alejandro/Documents/Repos\ Tiquetera/bitcomedia-main-app
npm run dev
```

1. Abre: http://localhost:5173/login
2. Inicia sesión con:
   - Email: `admin@ticketcolombia.com`
   - Password: (la que configuraste)
3. Deberías poder entrar y ver el dashboard

---

## 🔧 Solución de Problemas

### Error: "Cannot find module 'firebase-admin'"

```bash
cd bitcomedia-functions
npm install
```

### Error: "Permission denied"

Asegúrate de estar autenticado en Firebase:

```bash
firebase login
firebase use ticket-colombia-e6267
```

### Error: "Invalid credential"

El script usa Application Default Credentials. Ejecuta:

```bash
firebase login
```

### El script no hace nada

Verifica que estés en la carpeta correcta:

```bash
pwd
# Debe mostrar: /Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions
```

### Error: "User UID is invalid"

El UID debe tener al menos 10 caracteres. Asegúrate de:
1. Haber creado el usuario en Authentication primero
2. Copiar correctamente el UID completo

---

## 🎯 Después de Inicializar

### 1. Probar Login
```bash
cd bitcomedia-main-app
npm run dev
# Abre http://localhost:5173/login
```

### 2. Ver Dashboard
- Después de iniciar sesión, ve a: http://localhost:5173/dashboard
- Deberías ver el evento de ejemplo

### 3. Crear Más Eventos
- Click en "Nuevo Evento"
- Llena el formulario
- Selecciona uno de los venues creados

### 4. Configurar MercadoPago
- Para habilitar pagos, sigue: `GUIA_MERCADOPAGO_PASO_A_PASO.md`

---

## 🔄 Ejecutar Nuevamente

Si quieres reiniciar la base de datos:

1. **Elimina las colecciones en Firebase Console**:
   - Ve a Firestore
   - Elimina cada colección (users, venues, events)

2. **Ejecuta el script de nuevo**:
   ```bash
   npm run init-db
   ```

⚠️ **ADVERTENCIA**: Esto NO eliminará el usuario de Authentication, solo de Firestore.

---

## 📝 Personalizar el Script

Si quieres modificar los datos de ejemplo, edita el archivo:
```
bitcomedia-functions/init-firestore.js
```

Puedes cambiar:
- Nombres de venues
- Ciudades
- Capacidades
- Datos del evento de ejemplo

---

## 🆚 Manual vs Script

| Aspecto | Manual | Script |
|---------|--------|--------|
| **Tiempo** | 15-20 min | 2 min |
| **Facilidad** | Media | Muy fácil |
| **Datos de ejemplo** | No | Sí (3 venues, 1 evento) |
| **Errores** | Posibles | Mínimos |
| **Aprendizaje** | Alto | Bajo |

**Recomendación**: Usa el script para iniciar rápido, luego explora Firebase Console para familiarizarte.

---

## 🎉 ¡Listo!

Con esto ya tienes:
- ✅ Base de datos inicializada
- ✅ Usuario admin funcional
- ✅ Datos de ejemplo para probar
- ✅ Colecciones necesarias creadas

**Próximo paso**: Configura MercadoPago con `GUIA_MERCADOPAGO_PASO_A_PASO.md`





