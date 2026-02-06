#!/bin/bash

# 🚀 Script para Configurar Sitios de Hosting Separados

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   🔧 CONFIGURAR HOSTING SEPARADO                  ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

BASE_DIR="/Users/alejandro/Documents/Repos Tiquetera"

echo -e "${YELLOW}📝 Configuración que vamos a crear:${NC}"
echo -e "   ${GREEN}ticketcolombia.co${NC} → App Principal (usuarios)"
echo -e "   ${GREEN}admin.ticketcolombia.co${NC} → Panel Admin\n"

# Paso 1: Crear sitio para admin
echo -e "${BLUE}[1/4] Creando sitio de hosting para admin...${NC}"
echo -e "${YELLOW}Ejecuta este comando en Firebase Console o CLI:${NC}\n"
echo -e "${GREEN}firebase hosting:sites:create admin-ticket-colombia${NC}\n"
echo -e "${YELLOW}Presiona Enter cuando hayas creado el sitio...${NC}"
read

# Paso 2: Actualizar firebase.json del admin
echo -e "\n${BLUE}[2/4] Configurando firebase.json del admin...${NC}"

cd "$BASE_DIR/bitcomedia-web-admin"

cat > firebase.json << 'EOF'
{
  "hosting": {
    "site": "admin-ticket-colombia",
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
EOF

echo -e "${GREEN}✅ firebase.json del admin actualizado${NC}"

# Paso 3: Verificar firebase.json del main-app
echo -e "\n${BLUE}[3/4] Verificando firebase.json de la app principal...${NC}"

cd "$BASE_DIR/bitcomedia-main-app"

# El main-app usa el sitio por defecto (sin "site" especificado)
cat > firebase.json << 'EOF'
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
EOF

echo -e "${GREEN}✅ firebase.json de la app principal verificado${NC}"

# Paso 4: Re-desplegar ambas apps
echo -e "\n${BLUE}[4/4] Desplegando ambas aplicaciones...${NC}\n"

echo -e "${YELLOW}Desplegando App Principal...${NC}"
cd "$BASE_DIR/bitcomedia-main-app"
firebase deploy --only hosting

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ App Principal desplegada${NC}\n"
else
  echo -e "${RED}❌ Error desplegando app principal${NC}"
  exit 1
fi

echo -e "${YELLOW}Desplegando Panel Admin...${NC}"
cd "$BASE_DIR/bitcomedia-web-admin"
firebase deploy --only hosting

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Panel Admin desplegado${NC}\n"
else
  echo -e "${RED}❌ Error desplegando panel admin${NC}"
  exit 1
fi

# Resumen
echo -e "\n${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ CONFIGURACIÓN COMPLETADA                      ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}\n"

echo -e "${BLUE}📱 URLs de Firebase:${NC}"
echo -e "   App Principal: ${GREEN}https://ticket-colombia-e6267.web.app${NC}"
echo -e "   Panel Admin:   ${GREEN}https://admin-ticket-colombia.web.app${NC}\n"

echo -e "${BLUE}🌐 Para configurar dominios personalizados:${NC}"
echo -e "   1. Ir a: ${GREEN}https://console.firebase.google.com/project/ticket-colombia-e6267/hosting/sites${NC}"
echo -e "   2. Para el sitio ${GREEN}ticket-colombia-e6267${NC}: Agregar dominio ${GREEN}ticketcolombia.co${NC}"
echo -e "   3. Para el sitio ${GREEN}admin-ticket-colombia${NC}: Agregar dominio ${GREEN}admin.ticketcolombia.co${NC}\n"

echo -e "${YELLOW}⚠️  Recuerda agregar los registros DNS en GoDaddy después${NC}\n"





