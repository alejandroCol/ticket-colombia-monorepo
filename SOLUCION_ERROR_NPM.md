# 🔧 Solución: Error de Permisos NPM

## 🐛 El Problema

Estás recibiendo este error al intentar instalar dependencias o desplegar:

```
npm error code EPERM
npm error syscall open
npm error path /Users/alejandro/.npm/_cacache/tmp/...
npm error
npm error Your cache folder contains root-owned files, due to a bug in
npm error previous versions of npm which has since been addressed.
```

**Causa**: El cache de npm tiene archivos con permisos incorrectos (propiedad de root).

---

## ✅ Solución Rápida (Recomendada)

### Opción 1: Usar el Script Automatizado

He creado un script que arregla todo automáticamente:

```bash
cd "/Users/alejandro/Documents/Repos Tiquetera"
./fix-npm-and-deploy.sh
```

**Se te pedirá tu contraseña de administrador** una sola vez.

El script hará:
1. ✅ Arreglar permisos del cache de npm
2. ✅ Limpiar e instalar dependencias
3. ✅ Compilar TypeScript
4. ✅ Desplegar Functions a Firebase

**Tiempo estimado**: 3-5 minutos

---

## 🔨 Solución Manual (Alternativa)

Si prefieres hacerlo paso a paso:

### Paso 1: Arreglar Permisos de NPM

Abre la Terminal y ejecuta:

```bash
sudo chown -R 501:20 "/Users/alejandro/.npm"
```

**Se te pedirá tu contraseña de administrador.**

---

### Paso 2: Limpiar e Instalar Dependencias

```bash
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions/functions"

# Eliminar node_modules anterior
rm -rf node_modules package-lock.json

# Limpiar cache
npm cache clean --force

# Instalar dependencias
npm install
```

---

### Paso 3: Compilar TypeScript

```bash
# Asegúrate de estar en: bitcomedia-functions/functions
npm run build
```

Deberías ver:
```
✓ Successfully compiled TypeScript
```

---

### Paso 4: Desplegar a Firebase

```bash
# Volver a la carpeta raíz de functions
cd ..

# Desplegar
firebase deploy --only functions
```

---

## 🎯 Verificar que Funcionó

Si todo salió bien, deberías ver:

```
✔  functions: Finished running predeploy script.
✔  functions[createTicketPreference(us-central1)]: Successful create operation.
✔  functions[mercadopagoWebhook(us-central1)]: Successful create operation.

✔  Deploy complete!
```

Y las URLs de tus functions:

```
Function URL (createTicketPreference):
https://us-central1-ticket-colombia-e6267.cloudfunctions.net/createTicketPreference

Function URL (mercadopagoWebhook):
https://us-central1-ticket-colombia-e6267.cloudfunctions.net/mercadopagoWebhook
```

---

## 🔍 Verificar Dependencias Instaladas

Para asegurarte de que todas las dependencias están instaladas:

```bash
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions/functions"

# Verificar que node_modules exista y tenga las dependencias clave
ls node_modules | grep -E "mercadopago|firebase-functions|firebase-admin"
```

Deberías ver:
```
firebase-admin
firebase-functions
mercadopago
```

---

## 🆘 Si Persiste el Error

### Error: "Cannot find module 'mercadopago'"

**Solución:**
```bash
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions/functions"
npm install mercadopago --save
npm run build
```

### Error: "Cannot find module 'firebase-functions/v1'"

**Solución:**
```bash
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions/functions"
npm install firebase-functions@latest --save
npm run build
```

### Error: Versión de Node.js

Si ves:
```
npm WARN EBADENGINE Unsupported engine {
npm WARN EBADENGINE   required: { node: '18' },
npm WARN EBADENGINE   current: { node: 'v22.21.0' }
```

**Esto es solo una advertencia**, no debería causar problemas. Firebase Functions usa Node 18 en producción, pero tu versión local (22) es compatible.

Si quieres evitar la advertencia, puedes:
1. Ignorarla (no afecta el despliegue)
2. O instalar Node 18 con `nvm`:
```bash
nvm install 18
nvm use 18
```

---

## 📊 Estructura Correcta de Archivos

Después de instalar, deberías tener:

```
bitcomedia-functions/
├── functions/
│   ├── node_modules/          ← Debe existir y tener ~500+ paquetes
│   │   ├── mercadopago/       ← Debe existir
│   │   ├── firebase-admin/    ← Debe existir
│   │   └── firebase-functions/← Debe existir
│   ├── lib/                   ← Código compilado (después de build)
│   │   ├── index.js
│   │   └── features/
│   ├── src/                   ← Código fuente TypeScript
│   │   ├── index.ts
│   │   └── features/
│   ├── package.json
│   ├── package-lock.json      ← Se crea después de npm install
│   └── tsconfig.json
├── firebase.json
└── .firebaserc
```

---

## ✅ Checklist Final

Antes de intentar desplegar de nuevo:

- [ ] Ejecuté `sudo chown -R 501:20 "/Users/alejandro/.npm"`
- [ ] Eliminé `node_modules` y `package-lock.json`
- [ ] Ejecuté `npm cache clean --force`
- [ ] Ejecuté `npm install` exitosamente
- [ ] La carpeta `node_modules` existe y tiene las dependencias
- [ ] Ejecuté `npm run build` exitosamente
- [ ] La carpeta `lib` existe con archivos .js compilados
- [ ] Estoy en la carpeta correcta para `firebase deploy`

---

## 🚀 Comando Todo-en-Uno

Si quieres hacerlo todo de una vez (después de arreglar permisos):

```bash
# Arreglar permisos (requiere contraseña)
sudo chown -R 501:20 "/Users/alejandro/.npm"

# Todo lo demás
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions/functions" && \
rm -rf node_modules package-lock.json && \
npm cache clean --force && \
npm install && \
npm run build && \
cd .. && \
firebase deploy --only functions
```

---

## 📞 Enlaces Útiles

- **Firebase Console - Functions**: https://console.firebase.google.com/project/ticket-colombia-e6267/functions
- **Ver logs en tiempo real**: `firebase functions:log --follow`
- **Documentación Firebase Functions**: https://firebase.google.com/docs/functions

---

**Última actualización**: Octubre 2025  
**Script automatizado**: `fix-npm-and-deploy.sh`





