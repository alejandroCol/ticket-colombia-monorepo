/**
 * LIMPIEZA TOTAL DE CACHÉ DE FIREBASE
 * 
 * INSTRUCCIONES:
 * 1. Abre http://localhost:5174 (app principal)
 * 2. Abre DevTools (F12) → Console
 * 3. Copia y pega TODO este código
 * 4. Espera a que termine
 * 5. Repite en http://localhost:5173 (admin)
 */

console.log('%c🧹 LIMPIEZA TOTAL DE CACHÉ', 'color: white; background: red; font-size: 20px; padding: 10px');
console.log('Iniciando limpieza completa...\n');

async function limpiarTodo() {
  const pasos = [];
  
  try {
    // 1. Limpiar localStorage
    console.log('📦 [1/6] Limpiando localStorage...');
    localStorage.clear();
    pasos.push('✅ localStorage limpiado');
    
    // 2. Limpiar sessionStorage
    console.log('📦 [2/6] Limpiando sessionStorage...');
    sessionStorage.clear();
    pasos.push('✅ sessionStorage limpiado');
    
    // 3. Limpiar todas las cookies
    console.log('🍪 [3/6] Limpiando cookies...');
    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
    pasos.push('✅ Cookies limpiadas');
    
    // 4. Limpiar todas las bases de datos IndexedDB
    console.log('💾 [4/6] Obteniendo bases de datos IndexedDB...');
    const dbs = await indexedDB.databases();
    console.log(`   Encontradas ${dbs.length} bases de datos`);
    
    for (const dbInfo of dbs) {
      if (dbInfo.name) {
        console.log(`   🗑️  Eliminando: ${dbInfo.name}`);
        try {
          await new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(dbInfo.name);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            request.onblocked = () => {
              console.warn(`   ⚠️  Base de datos ${dbInfo.name} está bloqueada`);
              resolve(); // Continuar de todos modos
            };
          });
          console.log(`   ✅ ${dbInfo.name} eliminada`);
        } catch (err) {
          console.warn(`   ⚠️  Error eliminando ${dbInfo.name}:`, err.message);
        }
      }
    }
    pasos.push('✅ IndexedDB limpiado');
    
    // 5. Limpiar caché del Service Worker
    console.log('⚙️  [5/6] Limpiando Service Workers...');
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log('   ✅ Service Worker eliminado');
      }
      pasos.push('✅ Service Workers limpiados');
    } else {
      pasos.push('ℹ️  No hay Service Workers');
    }
    
    // 6. Limpiar caché del navegador
    console.log('🗄️  [6/6] Limpiando Cache Storage...');
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
        console.log(`   ✅ Cache ${cacheName} eliminado`);
      }
      pasos.push('✅ Cache Storage limpiado');
    } else {
      pasos.push('ℹ️  No hay Cache Storage');
    }
    
    // Resumen
    console.log('\n' + '═'.repeat(60));
    console.log('%c✅ LIMPIEZA COMPLETADA', 'color: white; background: green; font-size: 16px; padding: 10px');
    console.log('═'.repeat(60));
    console.log('\n📋 Resumen:');
    pasos.forEach(paso => console.log(`   ${paso}`));
    
    console.log('\n🔄 La página se recargará en 2 segundos...\n');
    console.log('═'.repeat(60));
    
    setTimeout(() => {
      location.reload();
    }, 2000);
    
  } catch (error) {
    console.error('\n❌ ERROR durante la limpieza:', error);
    console.log('\n💡 Intenta:');
    console.log('   1. Cerrar TODAS las pestañas de localhost');
    console.log('   2. Reabrir en modo incógnito');
    console.log('   3. Ejecutar este script de nuevo');
  }
}

// Ejecutar
limpiarTodo();





