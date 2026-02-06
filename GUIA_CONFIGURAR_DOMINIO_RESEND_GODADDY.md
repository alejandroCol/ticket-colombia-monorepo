# 🌐 Configurar ticketcolombia.com en Resend + GoDaddy

Esta guía te muestra paso a paso cómo verificar tu dominio `ticketcolombia.com` en Resend para poder enviar emails desde `tickets@ticketcolombia.com`.

---

## ⏱️ Tiempo estimado: 30 minutos

- 5 min: Agregar dominio en Resend
- 10 min: Configurar DNS en GoDaddy
- 15 min: Esperar propagación DNS

---

## 📋 Requisitos Previos

- ✅ Cuenta de Resend creada
- ✅ Acceso al panel de GoDaddy para `ticketcolombia.com`

---

## Paso 1: Agregar Dominio en Resend

### 1.1. Ir al Dashboard de Resend

1. Ve a: **https://resend.com/domains**
2. Inicia sesión si es necesario

### 1.2. Agregar Nuevo Dominio

1. Haz clic en el botón **"Add Domain"** (esquina superior derecha)
2. En el campo "Domain", ingresa:
   ```
   ticketcolombia.com
   ```
   O si prefieres usar un subdominio:
   ```
   mail.ticketcolombia.com
   ```
3. Selecciona la región: **United States** (o la más cercana)
4. Haz clic en **"Add"**

### 1.3. Copiar Registros DNS

Resend te mostrará una pantalla con 2-3 registros DNS que debes agregar:

**Registro SPF (TXT):**
```
Type: TXT
Host/Name: @ (si usas ticketcolombia.com) o "mail" (si usas mail.ticketcolombia.com)
Value: v=spf1 include:resend.com ~all
TTL: 3600
```

**Registro DKIM (CNAME):**
```
Type: CNAME
Host/Name: resend._domainkey (o resend._domainkey.mail)
Value: [un valor largo tipo: resend1234.resend.com]
TTL: 3600
```

**⚠️ IMPORTANTE:** NO cierres esta ventana aún. Necesitarás copiar estos valores exactos.

**💡 TIP:** Toma una captura de pantalla o deja esta pestaña abierta.

---

## Paso 2: Configurar DNS en GoDaddy

### 2.1. Acceder al DNS Manager

1. Ve a: **https://godaddy.com**
2. Inicia sesión con tu cuenta
3. Haz clic en tu nombre (arriba a la derecha) → **"My Products"**
4. Busca `ticketcolombia.com` en la lista
5. Haz clic en **"DNS"** o **"Manage DNS"**

### 2.2. Agregar Registro SPF (TXT)

1. En la sección "Records", haz clic en **"Add"** o **"Add Record"**
2. Selecciona **Type: TXT**
3. Completa los campos:

```
Type: TXT
Name: @ (para ticketcolombia.com) o "mail" (para mail.ticketcolombia.com)
Value: v=spf1 include:resend.com ~all
TTL: 3600 (o Default)
```

4. Haz clic en **"Save"**

**📸 Cómo se ve:**
```
┌─────────┬──────┬────────────────────────────────┬──────┐
│ Type    │ Name │ Value                          │ TTL  │
├─────────┼──────┼────────────────────────────────┼──────┤
│ TXT     │ @    │ v=spf1 include:resend.com ~all │ 3600 │
└─────────┴──────┴────────────────────────────────┴──────┘
```

### 2.3. Agregar Registro DKIM (CNAME)

1. Haz clic en **"Add"** nuevamente
2. Selecciona **Type: CNAME**
3. Completa los campos:

**Si usas `ticketcolombia.com`:**
```
Type: CNAME
Name: resend._domainkey
Value: [el valor que Resend te dio, ejemplo: resend1234.resend.com]
TTL: 3600 (o Default)
```

**Si usas `mail.ticketcolombia.com`:**
```
Type: CNAME
Name: resend._domainkey.mail
Value: [el valor que Resend te dio]
TTL: 3600
```

4. Haz clic en **"Save"**

**📸 Cómo se ve:**
```
┌─────────┬───────────────────────┬─────────────────────────┬──────┐
│ Type    │ Name                  │ Value                   │ TTL  │
├─────────┼───────────────────────┼─────────────────────────┼──────┤
│ CNAME   │ resend._domainkey     │ resend1234.resend.com   │ 3600 │
└─────────┴───────────────────────┴─────────────────────────┴──────┘
```

### 2.4. (Opcional) Agregar Registro DMARC

Este paso es **opcional** pero **recomendado** para mejorar la entregabilidad de tus emails.

1. Haz clic en **"Add"** nuevamente
2. Selecciona **Type: TXT**
3. Completa los campos:

```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@ticketcolombia.com
TTL: 3600
```

4. Haz clic en **"Save"**

---

## Paso 3: Verificar el Dominio en Resend

### 3.1. Esperar Propagación DNS

⏱️ **Tiempo de espera:** 10-30 minutos (a veces hasta 2 horas)

Los cambios DNS no son instantáneos. GoDaddy necesita tiempo para propagar los registros.

**💡 TIP:** Toma un café ☕ mientras esperas.

### 3.2. Verificar DNS (Herramienta Online)

Mientras esperas, puedes verificar si los DNS ya están propagados:

1. Ve a: **https://mxtoolbox.com/SuperTool.aspx**
2. Para verificar SPF, escribe:
   ```
   txt:ticketcolombia.com
   ```
3. Deberías ver: `v=spf1 include:resend.com ~all`

4. Para verificar DKIM, escribe:
   ```
   resend._domainkey.ticketcolombia.com
   ```
5. Deberías ver el CNAME apuntando a Resend

### 3.3. Verificar en Resend

1. Vuelve a: **https://resend.com/domains**
2. Haz clic en tu dominio: `ticketcolombia.com`
3. Haz clic en **"Verify DNS Records"** o **"Check Status"**

**✅ Si todo está bien:**
- Verás checkmarks verdes ✅ al lado de cada registro
- El estado del dominio será: **"Verified"**

**❌ Si algo falla:**
- Verás X rojas o warnings
- Revisa que copiaste los valores EXACTOS
- Espera 30 minutos más y vuelve a intentar

---

## Paso 4: Configurar el Email en Firebase

Una vez que tu dominio esté verificado en Resend:

```bash
firebase functions:secrets:set --project ticket-colombia-e6267 SENDER_EMAIL
```

Ingresa el email que quieres usar:
```
tickets@ticketcolombia.com
```

O cualquier otro:
- `no-reply@ticketcolombia.com`
- `info@ticketcolombia.com`
- `eventos@ticketcolombia.com`

---

## Paso 5: Redesplegar la Función

```bash
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions/functions"
firebase deploy --only functions:createManualTicket --project ticket-colombia-e6267
```

---

## Paso 6: Probar el Envío

1. Abre: https://admin-ticket-colombia.web.app
2. Inicia sesión como admin
3. Crea un ticket manual
4. Ingresa tu email personal
5. Verifica que recibes el email desde `tickets@ticketcolombia.com`

---

## 🐛 Troubleshooting

### Error: "SPF record not found"

**Causa:** El registro TXT no se agregó correctamente o no se ha propagado.

**Solución:**
1. Verifica que agregaste el registro TXT con Name: `@` y Value: `v=spf1 include:resend.com ~all`
2. Espera 30-60 minutos más
3. Verifica en MXToolbox: https://mxtoolbox.com/SuperTool.aspx

### Error: "DKIM record not found"

**Causa:** El registro CNAME no se agregó correctamente.

**Solución:**
1. Verifica que agregaste el CNAME con Name: `resend._domainkey`
2. Asegúrate de que copiaste el **valor EXACTO** que Resend te dio
3. NO agregues `.ticketcolombia.com` al final del Name (GoDaddy lo hace automáticamente)
4. Espera 30-60 minutos más

### Error: "Domain not verified" después de 2 horas

**Causa:** Los registros DNS no están correctos.

**Solución:**
1. Compara los registros en GoDaddy con los que Resend te dio
2. Borra los registros en GoDaddy y vuelve a agregarlos
3. Asegúrate de que no haya espacios extra al copiar y pegar
4. Contacta a soporte de GoDaddy si persiste

### Los emails llegan a spam

**Causa:** Falta configuración DMARC o el dominio es muy nuevo.

**Solución:**
1. Agrega el registro DMARC (Paso 2.4)
2. Espera unos días para que tu dominio gane "reputación"
3. Pide a los destinatarios que marquen como "No es spam"

---

## 📊 Resumen de Registros DNS

### Para `ticketcolombia.com`:

| Type  | Name                  | Value                                    | TTL  |
|-------|-----------------------|------------------------------------------|------|
| TXT   | @                     | v=spf1 include:resend.com ~all           | 3600 |
| CNAME | resend._domainkey     | [valor de Resend].resend.com             | 3600 |
| TXT   | _dmarc                | v=DMARC1; p=none; rua=mailto:dmarc@ticketcolombia.com | 3600 |

### Para `mail.ticketcolombia.com`:

| Type  | Name                        | Value                                    | TTL  |
|-------|-----------------------------|------------------------------------------|------|
| TXT   | mail                        | v=spf1 include:resend.com ~all           | 3600 |
| CNAME | resend._domainkey.mail      | [valor de Resend].resend.com             | 3600 |

---

## ✅ Checklist Final

- [ ] Dominio agregado en Resend
- [ ] Registro SPF (TXT) agregado en GoDaddy
- [ ] Registro DKIM (CNAME) agregado en GoDaddy
- [ ] Registro DMARC (TXT) agregado en GoDaddy (opcional)
- [ ] Esperé 30 minutos para propagación DNS
- [ ] Dominio verificado en Resend (checkmarks verdes ✅)
- [ ] `SENDER_EMAIL` configurado en Firebase
- [ ] Función redesplegada
- [ ] Email de prueba recibido exitosamente

---

## 📞 Soporte

Si tienes problemas:
1. **Logs de Resend:** https://resend.com/logs
2. **Herramienta de verificación DNS:** https://mxtoolbox.com/
3. **Soporte de GoDaddy:** https://www.godaddy.com/help
4. **Soporte de Resend:** https://resend.com/support

---

**🎉 ¡Listo! Ahora puedes enviar emails profesionales desde `tickets@ticketcolombia.com`**





