#!/bin/bash

# Script para completar la instalación del backend de creación de tickets manuales
# Ticket Colombia - 28 de octubre de 2025

echo "🚀 Completando instalación del backend - Creación de Tickets Manuales"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

# 1. Arreglar permisos de npm (requiere contraseña)
echo "📦 PASO 1: Arreglando permisos de npm..."
sudo chown -R 501:20 "/Users/alejandro/.npm"

if [ $? -ne 0 ]; then
    echo "❌ Error: No se pudieron arreglar los permisos."
    echo "Por favor ejecuta manualmente: sudo chown -R 501:20 \"/Users/alejandro/.npm\""
    exit 1
fi

echo "✅ Permisos arreglados"
echo ""

# 2. Cambiar al directorio de functions
cd "/Users/alejandro/Documents/Repos Tiquetera/bitcomedia-functions/functions"

# 3. Instalar pdfkit
echo "📦 PASO 2: Instalando pdfkit..."
npm install pdfkit @types/pdfkit --save

if [ $? -ne 0 ]; then
    echo "❌ Error instalando pdfkit"
    exit 1
fi

echo "✅ pdfkit instalado"
echo ""

# 4. Compilar functions
echo "🔨 PASO 3: Compilando functions..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Error compilando functions"
    exit 1
fi

echo "✅ Compilación exitosa"
echo ""

# 5. Desplegar function
echo "🚀 PASO 4: Desplegando función createManualTicket..."
firebase deploy --only functions:createManualTicket --project ticket-colombia-e6267

if [ $? -ne 0 ]; then
    echo "❌ Error desplegando función"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "✅ ¡BACKEND COMPLETADO EXITOSAMENTE!"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""
echo "📋 Próximos pasos:"
echo "1. Instalar extensión de email de Firebase:"
echo "   firebase ext:install firebase/firestore-send-email"
echo ""
echo "2. Configurar SMTP durante la instalación"
echo ""
echo "3. Probar desde el panel admin:"
echo "   https://admin-ticket-colombia.web.app"
echo ""
echo "🎉 ¡Listo para crear tickets manuales!"





