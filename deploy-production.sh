#!/bin/bash

# 🚀 Script de Despliegue a Producción - Ticket Colombia
# Este script automatiza el despliegue completo a Firebase

set -e  # Detener si hay errores

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   🚀 DESPLIEGUE A PRODUCCIÓN - TICKET COLOMBIA    ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

# Verificar que estamos en el directorio correcto
BASE_DIR="/Users/alejandro/Documents/Repos Tiquetera"
if [ "$PWD" != "$BASE_DIR" ]; then
  echo -e "${YELLOW}⚠️  Cambiando al directorio base...${NC}"
  cd "$BASE_DIR"
fi

# Función para preguntar confirmación
confirm() {
  read -p "$(echo -e ${YELLOW}"$1 (y/n): "${NC})" -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    return 1
  fi
  return 0
}

# 1. Verificar Firebase CLI
echo -e "\n${BLUE}[1/7] Verificando Firebase CLI...${NC}"
if ! command -v firebase &> /dev/null; then
  echo -e "${RED}❌ Firebase CLI no está instalado${NC}"
  echo -e "${YELLOW}Instala con: npm install -g firebase-tools${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Firebase CLI instalado${NC}"

# Verificar login
if ! firebase projects:list &> /dev/null; then
  echo -e "${RED}❌ No has iniciado sesión en Firebase${NC}"
  echo -e "${YELLOW}Ejecuta: firebase login${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Sesión de Firebase activa${NC}"

# 2. Desplegar Firebase Functions
echo -e "\n${BLUE}[2/7] Desplegando Firebase Functions...${NC}"
if confirm "¿Desplegar Functions?"; then
  cd "$BASE_DIR/bitcomedia-functions"
  
  echo -e "${YELLOW}📦 Instalando dependencias...${NC}"
  npm install
  
  echo -e "${YELLOW}🔨 Compilando TypeScript...${NC}"
  cd functions
  npm run build
  cd ..
  
  echo -e "${YELLOW}🚀 Desplegando a Firebase...${NC}"
  firebase deploy --only functions
  
  echo -e "${GREEN}✅ Functions desplegadas${NC}"
else
  echo -e "${YELLOW}⏭️  Saltando Functions${NC}"
fi

# 3. Construir y Desplegar App Principal
echo -e "\n${BLUE}[3/7] Construyendo App Principal...${NC}"
if confirm "¿Desplegar App Principal?"; then
  cd "$BASE_DIR/bitcomedia-main-app"
  
  echo -e "${YELLOW}📦 Instalando dependencias...${NC}"
  npm install
  
  echo -e "${YELLOW}🔨 Construyendo para producción...${NC}"
  npm run build
  
  if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: No se generó la carpeta dist${NC}"
    exit 1
  fi
  
  echo -e "${YELLOW}🚀 Desplegando a Firebase Hosting...${NC}"
  firebase deploy --only hosting
  
  echo -e "${GREEN}✅ App Principal desplegada${NC}"
else
  echo -e "${YELLOW}⏭️  Saltando App Principal${NC}"
fi

# 4. Construir y Desplegar Panel Admin
echo -e "\n${BLUE}[4/7] Construyendo Panel Admin...${NC}"
if confirm "¿Desplegar Panel Admin?"; then
  cd "$BASE_DIR/bitcomedia-web-admin"
  
  echo -e "${YELLOW}📦 Instalando dependencias...${NC}"
  npm install
  
  echo -e "${YELLOW}🔨 Construyendo para producción...${NC}"
  npm run build
  
  if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: No se generó la carpeta dist${NC}"
    exit 1
  fi
  
  echo -e "${YELLOW}🚀 Desplegando a Firebase Hosting...${NC}"
  firebase deploy --only hosting
  
  echo -e "${GREEN}✅ Panel Admin desplegado${NC}"
else
  echo -e "${YELLOW}⏭️  Saltando Panel Admin${NC}"
fi

# 5. Desplegar Reglas de Firestore
echo -e "\n${BLUE}[5/7] Desplegando Reglas de Firestore...${NC}"
if confirm "¿Desplegar reglas de Firestore?"; then
  cd "$BASE_DIR/bitcomedia-web-admin"
  firebase deploy --only firestore:rules
  echo -e "${GREEN}✅ Reglas de Firestore desplegadas${NC}"
else
  echo -e "${YELLOW}⏭️  Saltando Reglas de Firestore${NC}"
fi

# 6. Desplegar Índices de Firestore
echo -e "\n${BLUE}[6/7] Desplegando Índices de Firestore...${NC}"
if confirm "¿Desplegar índices de Firestore?"; then
  cd "$BASE_DIR/bitcomedia-web-admin"
  firebase deploy --only firestore:indexes
  echo -e "${GREEN}✅ Índices de Firestore desplegados${NC}"
else
  echo -e "${YELLOW}⏭️  Saltando Índices de Firestore${NC}"
fi

# 7. Desplegar Reglas de Storage
echo -e "\n${BLUE}[7/7] Desplegando Reglas de Storage...${NC}"
if confirm "¿Desplegar reglas de Storage?"; then
  cd "$BASE_DIR/bitcomedia-web-admin"
  firebase deploy --only storage
  echo -e "${GREEN}✅ Reglas de Storage desplegadas${NC}"
else
  echo -e "${YELLOW}⏭️  Saltando Reglas de Storage${NC}"
fi

# Resumen final
echo -e "\n${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ DESPLIEGUE COMPLETADO EXITOSAMENTE           ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}\n"

echo -e "${BLUE}📱 URLs de Producción:${NC}"
echo -e "   Firebase App:  ${GREEN}https://ticket-colombia-e6267.web.app${NC}"
echo -e "   🌐 Dominio:     ${GREEN}https://ticketcolombia.co${NC} ⭐"
echo -e "   🌐 Admin:       ${GREEN}https://admin.ticketcolombia.co${NC} ⭐"
echo -e "   Functions:     ${GREEN}https://us-central1-ticket-colombia-e6267.cloudfunctions.net${NC}\n"

echo -e "${YELLOW}⚠️  Recuerda configurar:${NC}"
echo -e "   1. Dominio personalizado en GoDaddy (ver CONFIGURACION_DOMINIO_GODADDY.md)"
echo -e "   2. Webhook de MercadoPago con la URL de producción"
echo -e "   3. Credenciales de producción (no sandbox)"
echo -e "   4. Probar una compra de prueba\n"

echo -e "${BLUE}📊 Ver logs:${NC} firebase functions:log --follow\n"
echo -e "${GREEN}🎉 ¡Tu aplicación está en producción!${NC}\n"

