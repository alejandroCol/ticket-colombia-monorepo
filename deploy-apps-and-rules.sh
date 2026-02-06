#!/bin/bash

# 🚀 Script para Desplegar Apps Web y Reglas de Seguridad - Ticket Colombia

set -e  # Detener si hay errores

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   🚀 DESPLEGAR APPS WEB Y REGLAS - TICKET COLOMBIA ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

# Directorio base
BASE_DIR="/Users/alejandro/Documents/Repos Tiquetera"

# Función para preguntar confirmación
confirm() {
  read -p "$(echo -e ${YELLOW}"$1 (y/n): "${NC})" -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    return 1
  fi
  return 0
}

# ============================================
# PASO 2: DESPLEGAR APLICACIONES WEB
# ============================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   PASO 2: DESPLEGAR APLICACIONES WEB              ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

# 2.1 Desplegar App Principal (usuarios)
echo -e "${BLUE}[2.1/2.2] Desplegando App Principal (usuarios)...${NC}\n"

cd "$BASE_DIR/bitcomedia-main-app"

echo -e "${YELLOW}📦 Instalando dependencias de la app principal...${NC}"
npm install

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Error instalando dependencias de la app principal${NC}"
  exit 1
fi

echo -e "\n${YELLOW}🔨 Construyendo app principal para producción...${NC}"
npm run build

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Error construyendo la app principal${NC}"
  exit 1
fi

if [ ! -d "dist" ]; then
  echo -e "${RED}❌ Error: No se generó la carpeta dist en app principal${NC}"
  exit 1
fi

echo -e "\n${YELLOW}🚀 Desplegando app principal a Firebase Hosting...${NC}"
firebase deploy --only hosting

if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}✅ App Principal desplegada exitosamente${NC}"
else
  echo -e "\n${RED}❌ Error desplegando app principal${NC}"
  exit 1
fi

# 2.2 Desplegar Panel Admin
echo -e "\n${BLUE}[2.2/2.2] Desplegando Panel Admin...${NC}\n"

cd "$BASE_DIR/bitcomedia-web-admin"

echo -e "${YELLOW}📦 Instalando dependencias del panel admin...${NC}"
npm install

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Error instalando dependencias del panel admin${NC}"
  exit 1
fi

echo -e "\n${YELLOW}🔨 Construyendo panel admin para producción...${NC}"
npm run build

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Error construyendo el panel admin${NC}"
  exit 1
fi

if [ ! -d "dist" ]; then
  echo -e "${RED}❌ Error: No se generó la carpeta dist en panel admin${NC}"
  exit 1
fi

echo -e "\n${YELLOW}🚀 Desplegando panel admin a Firebase Hosting...${NC}"
firebase deploy --only hosting

if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}✅ Panel Admin desplegado exitosamente${NC}"
else
  echo -e "\n${RED}❌ Error desplegando panel admin${NC}"
  exit 1
fi

# ============================================
# PASO 3: DESPLEGAR REGLAS DE SEGURIDAD
# ============================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   PASO 3: DESPLEGAR REGLAS DE SEGURIDAD           ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

cd "$BASE_DIR/bitcomedia-web-admin"

# 3.1 Desplegar Reglas de Firestore
echo -e "${BLUE}[3.1/3.3] Desplegando reglas de Firestore...${NC}"
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Reglas de Firestore desplegadas${NC}\n"
else
  echo -e "${RED}❌ Error desplegando reglas de Firestore${NC}"
  exit 1
fi

# 3.2 Desplegar Índices de Firestore
echo -e "${BLUE}[3.2/3.3] Desplegando índices de Firestore...${NC}"
firebase deploy --only firestore:indexes

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Índices de Firestore desplegados${NC}\n"
else
  echo -e "${RED}❌ Error desplegando índices de Firestore${NC}"
  exit 1
fi

# 3.3 Desplegar Reglas de Storage
echo -e "${BLUE}[3.3/3.3] Desplegando reglas de Storage...${NC}"
firebase deploy --only storage

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Reglas de Storage desplegadas${NC}\n"
else
  echo -e "${RED}❌ Error desplegando reglas de Storage${NC}"
  exit 1
fi

# ============================================
# RESUMEN FINAL
# ============================================

echo -e "\n${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ DESPLIEGUE COMPLETADO EXITOSAMENTE           ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}\n"

echo -e "${BLUE}📱 URLs de Producción (Firebase):${NC}"
echo -e "   App Principal: ${GREEN}https://ticket-colombia-e6267.web.app${NC}"
echo -e "   Panel Admin:   ${GREEN}https://ticket-colombia-e6267.web.app${NC}"
echo -e "   Functions:     ${GREEN}https://us-central1-ticket-colombia-e6267.cloudfunctions.net${NC}\n"

echo -e "${YELLOW}🌐 URLs de Dominio Personalizado (cuando configures GoDaddy):${NC}"
echo -e "   App Principal: ${GREEN}https://ticketcolombia.co${NC}"
echo -e "   Panel Admin:   ${GREEN}https://admin.ticketcolombia.co${NC}\n"

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   📋 PRÓXIMOS PASOS                                ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

echo -e "${YELLOW}1. Verificar que las apps funcionan:${NC}"
echo -e "   ${GREEN}open https://ticket-colombia-e6267.web.app${NC}\n"

echo -e "${YELLOW}2. Configurar dominio en GoDaddy:${NC}"
echo -e "   Ver: ${GREEN}CONFIGURACION_DOMINIO_GODADDY.md${NC}\n"

echo -e "${YELLOW}3. Configurar Webhook de MercadoPago:${NC}"
echo -e "   URL: ${GREEN}https://console.firebase.google.com/project/ticket-colombia-e6267/hosting/sites${NC}"
echo -e "   Ir a: ${GREEN}https://www.mercadopago.com.co/developers/panel${NC}"
echo -e "   Webhook URL: ${GREEN}https://us-central1-ticket-colombia-e6267.cloudfunctions.net/mercadopagoWebhook${NC}\n"

echo -e "${YELLOW}4. Hacer una compra de prueba:${NC}"
echo -e "   Usar tarjetas de prueba de MercadoPago\n"

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

echo -e "${GREEN}🎉 ¡Tu aplicación está lista para recibir usuarios!${NC}\n"

# Preguntar si quiere abrir el navegador
if confirm "¿Quieres abrir la app en el navegador ahora?"; then
  open https://ticket-colombia-e6267.web.app
  echo -e "${GREEN}✅ Navegador abierto${NC}\n"
fi

echo -e "${BLUE}📊 Para ver logs en tiempo real:${NC}"
echo -e "   ${YELLOW}firebase functions:log --follow${NC}\n"

echo -e "${BLUE}📚 Documentación útil:${NC}"
echo -e "   - CONFIGURACION_DOMINIO_GODADDY.md"
echo -e "   - DESPLIEGUE_PRODUCCION.md"
echo -e "   - SOLUCION_ERROR_NPM.md\n"





