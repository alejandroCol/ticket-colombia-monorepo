#!/usr/bin/env node

/**
 * Script para obtener estadísticas de ventas desde Firestore
 * Muestra total de tickets vendidos, ingresos y desglose por evento
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin con el service account
const serviceAccount = require('./ticket-colombia-e6267-firebase-adminsdk-fbsvc-dc603ba774.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Función para formatear precio en COP
function formatCOP(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

async function getSalesStats() {
  console.log('\n📊 Estadísticas de Ventas - Ticket Colombia\n');
  console.log('═'.repeat(60));

  try {
    // Obtener todos los tickets
    const ticketsRef = db.collection('tickets');
    const snapshot = await ticketsRef.get();

    if (snapshot.empty) {
      console.log('\n❌ No hay tickets vendidos aún.\n');
      return;
    }

    // Variables para estadísticas
    let totalTickets = 0;
    let totalRevenue = 0;
    let courtesyCount = 0;
    const eventStats = {};
    const statusCount = {
      valid: 0,
      used: 0,
      cancelled: 0
    };

    // Procesar cada ticket
    snapshot.forEach((doc) => {
      const ticket = doc.data();
      totalTickets++;
      if (ticket.isCourtesy) courtesyCount++;

      if (ticket.status) {
        statusCount[ticket.status] = (statusCount[ticket.status] || 0) + 1;
      }

      if (ticket.status === 'cancelled') return;

      const eventName = ticket.eventName || 'Sin nombre';
      if (!eventStats[eventName]) {
        eventStats[eventName] = { count: 0, revenue: 0, courtesy: 0, eventId: ticket.eventId };
      }
      eventStats[eventName].count++;

      // Cortesías no suman en ingresos (valor $0)
      if (ticket.isCourtesy) {
        eventStats[eventName].courtesy++;
      } else {
        const amount = ticket.purchaseAmount || ticket.amount || 0;
        if (amount > 0) {
          totalRevenue += amount;
          eventStats[eventName].revenue += amount;
        }
      }
    });

    // Mostrar resumen general
    console.log('\n📈 RESUMEN GENERAL\n');
    console.log(`   Total de tickets: ${totalTickets}`);
    if (courtesyCount > 0) {
      console.log(`   ├── 🎁 Cortesías (no suman en ingresos): ${courtesyCount}`);
    }
    console.log(`   ├── ✅ Válidos: ${statusCount.valid || 0}`);
    console.log(`   ├── 🎟️  Usados: ${statusCount.used || 0}`);
    console.log(`   └── ❌ Cancelados: ${statusCount.cancelled || 0}`);
    console.log(`\n   💰 Ingresos totales (sin cortesías): ${formatCOP(totalRevenue)}`);

    // Calcular comisión (9% del subtotal)
    // Nota: purchaseAmount ya incluye impuestos y comisión
    // Para cálculo exacto necesitaríamos el desglose
    const estimatedCommission = totalRevenue * 0.09 / 1.28; // Aproximado
    console.log(`   💸 Comisión estimada (9%): ${formatCOP(estimatedCommission)}`);

    // Mostrar estadísticas por evento
    console.log('\n\n📋 VENTAS POR EVENTO\n');
    console.log('─'.repeat(60));

    // Ordenar eventos por ingresos (mayor a menor)
    const sortedEvents = Object.entries(eventStats)
      .sort((a, b) => b[1].revenue - a[1].revenue);

    if (sortedEvents.length === 0) {
      console.log('   No hay ventas registradas\n');
    } else {
      sortedEvents.forEach(([eventName, stats], index) => {
        const paidCount = stats.count - (stats.courtesy || 0);
        console.log(`\n${index + 1}. ${eventName}`);
        console.log(`   ├── Tickets vendidos: ${stats.count}${stats.courtesy ? ` (${stats.courtesy} cortesía)` : ''}`);
        console.log(`   ├── Ingresos: ${formatCOP(stats.revenue)}`);
        console.log(`   └── Promedio por ticket pagado: ${formatCOP(paidCount > 0 ? stats.revenue / paidCount : 0)}`);
      });
    }

    // Calcular promedios (solo tickets pagados, excluye cortesías y cancelados)
    const paidTicketsCount = totalTickets - (statusCount.cancelled || 0) - courtesyCount;
    const avgTicketPrice = paidTicketsCount > 0 ? totalRevenue / paidTicketsCount : 0;
    console.log('\n\n📊 PROMEDIOS\n');
    console.log('─'.repeat(60));
    console.log(`   Precio promedio por ticket: ${formatCOP(avgTicketPrice)}`);
    console.log(`   Eventos con ventas: ${Object.keys(eventStats).length}`);

    console.log('\n' + '═'.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Ejecutar script
getSalesStats();





