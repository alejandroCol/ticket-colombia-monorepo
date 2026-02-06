/**
 * TEST SIMPLE DE ADMIN - Ejecutar en la consola del navegador
 * 
 * INSTRUCCIONES:
 * 1. Inicia sesión primero en: http://localhost:5174/login
 * 2. Presiona F12
 * 3. Escribe: allow pasting
 * 4. Copia y pega este código
 */

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  🔐 TEST SIMPLE - VERIFICACIÓN ADMIN            ║');
console.log('╚══════════════════════════════════════════════════╝\n');

// Verificar localStorage
const sessionKey = 'ticket_colombia_user_session';
const sessionData = localStorage.getItem(sessionKey);

console.log('📦 [1/3] Verificando localStorage...');
if (sessionData) {
  try {
    const userData = JSON.parse(sessionData);
    console.log('✅ Sesión encontrada en localStorage');
    console.log('   Datos:', userData);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Rol: "${userData.role}"`);
    console.log(`   UID: ${userData.uid}`);
    
    if (userData.role === 'ADMIN') {
      console.log('%c   ✅ ROL ES "ADMIN" (CORRECTO)', 'color: green; font-weight: bold');
    } else if (userData.role === 'admin') {
      console.log('%c   ❌ ROL ES "admin" (minúsculas - INCORRECTO)', 'color: red; font-weight: bold');
      console.log('\n   🔧 El problema está en Firestore');
      console.log('   El campo "role" debe ser "ADMIN" en mayúsculas');
    } else {
      console.log(`%c   ❌ ROL ES "${userData.role}" (INCORRECTO)`, 'color: red; font-weight: bold');
    }
  } catch (e) {
    console.error('❌ Error parseando sesión:', e);
  }
} else {
  console.log('⚠️  No hay sesión en localStorage');
  console.log('   Esto significa que necesitas:');
  console.log('   1. Cerrar sesión');
  console.log('   2. Actualizar el rol en Firestore a "ADMIN"');
  console.log('   3. Iniciar sesión de nuevo');
}

// Verificar si hay usuario autenticado en memoria
console.log('\n👤 [2/3] Verificando estado de autenticación...');

// Intentar obtener el estado actual del navegador
if (typeof window !== 'undefined') {
  // Verificar si hay datos en sessionStorage también
  const sessionStorageData = sessionStorage.getItem(sessionKey);
  if (sessionStorageData) {
    console.log('✅ También hay datos en sessionStorage');
  }
  
  // Verificar todas las keys de localStorage relacionadas con Firebase
  console.log('\n🔍 Keys de Firebase en localStorage:');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('firebase') || key.includes('ticket'))) {
      console.log(`   - ${key}`);
    }
  }
}

// Diagnóstico y recomendaciones
console.log('\n🎯 [3/3] Diagnóstico y Recomendaciones...');
console.log('═'.repeat(60));

if (sessionData) {
  const userData = JSON.parse(sessionData);
  
  if (userData.role === 'ADMIN') {
    console.log('%c✅ TODO ESTÁ CORRECTO', 'color: green; font-size: 16px; font-weight: bold');
    console.log('\nEl rol es "ADMIN" correctamente.');
    console.log('Si aún no ves las opciones de admin:');
    console.log('\n1. Verifica que estés en una ruta que requiera admin');
    console.log('2. Verifica el código que chequea el rol');
    console.log('3. Abre las DevTools → Network → verifica las peticiones a Firestore');
    console.log('4. Busca en el código: userData.role === "ADMIN"');
    
  } else {
    console.log('%c❌ PROBLEMA ENCONTRADO', 'color: red; font-size: 16px; font-weight: bold');
    console.log(`\n El rol guardado es: "${userData.role}"`);
    console.log(' Debe ser: "ADMIN" (todo en MAYÚSCULAS)\n');
    
    console.log('🔧 SOLUCIÓN PASO A PASO:');
    console.log('\n1️⃣ Actualiza el rol en Firestore:');
    console.log(`   https://console.firebase.google.com/project/ticket-colombia-e6267/firestore/data/~2Fusers~2F${userData.uid}`);
    console.log('   - Busca el campo "role"');
    console.log('   - Cámbialo a "ADMIN" (todo en MAYÚSCULAS)');
    console.log('   - Guarda');
    
    console.log('\n2️⃣ Limpia la sesión actual:');
    console.log('   Ejecuta estos comandos aquí en la consola:');
    console.log('   localStorage.clear()');
    console.log('   sessionStorage.clear()');
    
    console.log('\n3️⃣ Recarga la página:');
    console.log('   location.reload()');
    
    console.log('\n4️⃣ Inicia sesión de nuevo');
    console.log('   Ve a: http://localhost:5174/login');
    console.log('   Inicia sesión con: ale.mar.guz@gmail.com');
    
    console.log('\n💡 O más fácil: Ejecuta esto ahora mismo:');
    console.log('%c   localStorage.clear(); sessionStorage.clear(); location.reload();', 
                'background: #222; color: #0f0; padding: 10px; font-family: monospace');
  }
} else {
  console.log('%c⚠️  NO HAY SESIÓN', 'color: orange; font-size: 16px; font-weight: bold');
  console.log('\n1. Verifica que hayas iniciado sesión');
  console.log('2. Si ya iniciaste sesión pero no hay datos:');
  console.log('   - Puede que el documento no exista en Firestore');
  console.log('   - O el flujo de login tiene un problema');
}

console.log('\n═'.repeat(60));
console.log('Test completado. Lee los resultados arriba ☝️\n');





