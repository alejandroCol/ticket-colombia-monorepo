#!/bin/bash

# 🔧 Script para Arreglar Permisos de NPM y Desplegar Functions

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   🔧 ARREGLAR NPM Y DESPLEGAR FUNCTIONS           ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

# 1. Arreglar permisos de npm (requiere contraseña)
echo -e "${YELLOW}[1/4] Arreglando permisos del cache de npm...${NC}"
echo -e "${YELLOW}Se te pedirá tu contraseña de administrador${NC}\n"

sudo chown -R 501:20 "/Users/alejandro/.npm"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Permisos arreglados${NC}\n"
else
  echo -e "${RED}❌ Error arreglando permisos${NC}"
  exit 1
fi

# 2. Limpiar e instalar dependencias
echo -e "${YELLOW}[2/4] Limpiando e instalando dependencias...${NC}"
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions/functions"

# Eliminar node_modules y package-lock
rm -rf node_modules package-lock.json

# Limpiar cache
npm cache clean --force

# Instalar dependencias
npm install

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Dependencias instaladas${NC}\n"
else
  echo -e "${RED}❌ Error instalando dependencias${NC}"
  exit 1
fi

# 3. Compilar TypeScript
echo -e "${YELLOW}[3/4] Compilando TypeScript...${NC}"
npm run build

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Compilación exitosa${NC}\n"
else
  echo -e "${RED}❌ Error en compilación${NC}"
  exit 1
fi

# 4. Desplegar a Firebase
echo -e "${YELLOW}[4/4] Desplegando Functions a Firebase...${NC}"
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions"
firebase deploy --only functions

if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}═══════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}   ✅ FUNCTIONS DESPLEGADAS EXITOSAMENTE           ${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════${NC}\n"
  
  echo -e "${BLUE}📱 URLs de tus Functions:${NC}"
  echo -e "   ${GREEN}https://us-central1-ticket-colombia-e6267.cloudfunctions.net/createTicketPreference${NC}"
  echo -e "   ${GREEN}https://us-central1-ticket-colombia-e6267.cloudfunctions.net/mercadopagoWebhook${NC}\n"
  
  echo -e "${YELLOW}⚠️  Recuerda actualizar el webhook en MercadoPago con la URL de arriba${NC}\n"
else
  echo -e "\n${RED}❌ Error desplegando Functions${NC}"
  exit 1
fi





