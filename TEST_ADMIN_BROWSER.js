/**
 * TEST DE ADMIN - Ejecutar en la consola del navegador
 * 
 * INSTRUCCIONES:
 * 1. Abre http://localhost:5174/login
 * 2. Inicia sesión con: ale.mar.guz@gmail.com / 12345678
 * 3. Presiona F12 para abrir DevTools
 * 4. Ve a la pestaña Console
 * 5. Copia y pega TODO este archivo
 * 6. Presiona Enter
 */

(async function testAdminBackend() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  🔐 TEST DE LOGIN - VERIFICACIÓN BACKEND ADMIN        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  try {
    // Importar Firebase desde el módulo
    const { getAuth } = await import('/node_modules/firebase/auth/dist/esm/index.esm.js');
    const { getFirestore, doc, getDoc, collection } = await import('/node_modules/firebase/firestore/dist/esm/index.esm.js');
    const { getApp } = await import('/node_modules/firebase/app/dist/esm/index.esm.js');
    
    // Obtener instancias de Firebase
    const app = getApp();
    const auth = getAuth(app);
    const db = getFirestore(app);
    
    // PASO 1: Verificar configuración de Firebase
    console.log('📋 [PASO 1/5] Verificando configuración de Firebase...');
    const projectId = app.options.projectId;
    console.log('   ✅ Proyecto:', projectId);
    console.log('   ✅ Auth Domain:', app.options.authDomain);
    
    if (projectId !== 'ticket-colombia-e6267') {
      console.error('   ❌ ERROR: Proyecto incorrecto!');
      console.error(`   Esperado: ticket-colombia-e6267`);
      console.error(`   Actual: ${projectId}`);
      return;
    }
    
    // PASO 2: Verificar usuario autenticado
    console.log('\n👤 [PASO 2/5] Verificando usuario autenticado...');
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.error('   ❌ ERROR: No hay usuario autenticado');
      console.log('   🔧 Inicia sesión primero en: http://localhost:5174/login');
      return;
    }
    
    console.log('   ✅ Usuario autenticado:', currentUser.email);
    console.log('   ✅ UID:', currentUser.uid);
    
    // PASO 3: Obtener datos de Firestore (lo que hace getUserData())
    console.log('\n📄 [PASO 3/5] Obteniendo datos de Firestore...');
    console.log(`   Query: /users/${currentUser.uid}`);
    
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.error('   ❌ ERROR: Usuario NO existe en Firestore!');
      console.error(`   Documento buscado: /users/${currentUser.uid}`);
      console.log('\n   🔧 SOLUCIÓN:');
      console.log('   1. Ve a Firebase Console → Firestore');
      console.log(`   2. Crea documento en /users/${currentUser.uid}`);
      console.log('   3. Campos requeridos:');
      console.log('      - email: "ale.mar.guz@gmail.com"');
      console.log('      - name: "Alejandro"');
      console.log('      - role: "ADMIN"  ← EN MAYÚSCULAS');
      console.log('      - active: true');
      return;
    }
    
    console.log('   ✅ Documento encontrado en Firestore');
    const userData = userDoc.data();
    console.log('   📦 Datos completos:', userData);
    
    // PASO 4: Verificar rol (lo que hace el frontend)
    console.log('\n🔑 [PASO 4/5] Verificando rol de administrador...');
    console.log(`   Rol encontrado: "${userData.role}"`);
    console.log(`   Tipo: ${typeof userData.role}`);
    console.log(`   Length: ${userData.role?.length || 0}`);
    
    // Verificaciones detalladas
    const isADMIN = userData.role === 'ADMIN';
    const isAdmin = userData.role === 'admin';
    const isActive = userData.active === true;
    
    console.log('\n   Verificaciones:');
    console.log(`   ${isADMIN ? '✅' : '❌'} userData.role === "ADMIN"`);
    console.log(`   ${isAdmin ? '⚠️' : '✅'} userData.role === "admin" (minúsculas)`);
    console.log(`   ${isActive ? '✅' : '❌'} userData.active === true`);
    
    // PASO 5: Resultado final y diagnóstico
    console.log('\n🎯 [PASO 5/5] Resultado del test...');
    console.log('═'.repeat(60));
    
    if (isADMIN && isActive) {
      console.log('%c✅ ¡ÉXITO! El usuario ES ADMIN correctamente', 'color: green; font-size: 16px; font-weight: bold');
      console.log('\n📊 Resumen:');
      console.log(`   • Email: ${currentUser.email}`);
      console.log(`   • UID: ${currentUser.uid}`);
      console.log(`   • Rol: ${userData.role} ✅`);
      console.log(`   • Activo: ${userData.active} ✅`);
      console.log(`   • Proyecto: ${projectId} ✅`);
      
      console.log('\n✨ El backend está trayendo correctamente la información de ADMIN');
      console.log('   El usuario DEBERÍA ver las opciones de administrador');
      
      console.log('\n🔍 Si aún no ves las opciones de admin, prueba:');
      console.log('   1. Ejecuta: localStorage.clear()');
      console.log('   2. Ejecuta: sessionStorage.clear()');
      console.log('   3. Ejecuta: location.reload()');
      console.log('   4. O cierra y abre en modo incógnito');
      
      // Verificar localStorage
      console.log('\n📦 Verificando localStorage...');
      const storedSession = localStorage.getItem('ticket_colombia_user_session');
      if (storedSession) {
        const sessionData = JSON.parse(storedSession);
        console.log('   Sesión almacenada:', sessionData);
        console.log(`   Rol en sesión: ${sessionData.role}`);
        if (sessionData.role !== 'ADMIN') {
          console.warn('   ⚠️  El rol en localStorage no coincide!');
          console.log('   🔧 Ejecuta: localStorage.clear() y recarga');
        }
      } else {
        console.log('   ℹ️  No hay sesión en localStorage');
      }
      
    } else if (isAdmin) {
      console.log('%c❌ PROBLEMA: Rol en minúsculas', 'color: red; font-size: 16px; font-weight: bold');
      console.log(`\n   El rol es: "${userData.role}" (minúsculas)`);
      console.log(`   Debe ser: "ADMIN" (MAYÚSCULAS)`);
      
      console.log('\n🔧 SOLUCIÓN:');
      console.log('   1. Ve a Firebase Console → Firestore');
      console.log(`   2. Navega a: /users/${currentUser.uid}`);
      console.log('   3. Edita el campo "role"');
      console.log('   4. Cambia "admin" → "ADMIN"');
      console.log('   5. Guarda y recarga la página');
      
      console.log('\n🔗 Link directo:');
      console.log(`   https://console.firebase.google.com/project/${projectId}/firestore/data/~2Fusers~2F${currentUser.uid}`);
      
    } else if (!isActive) {
      console.log('%c❌ PROBLEMA: Usuario inactivo', 'color: red; font-size: 16px; font-weight: bold');
      console.log('\n🔧 SOLUCIÓN:');
      console.log('   Cambia el campo "active" a true en Firestore');
      
    } else {
      console.log('%c❌ PROBLEMA: Rol incorrecto o no existe', 'color: red; font-size: 16px; font-weight: bold');
      console.log(`\n   Rol actual: "${userData.role}"`);
      console.log(`   Rol esperado: "ADMIN"`);
      
      console.log('\n🔧 SOLUCIÓN:');
      console.log('   Actualiza el campo "role" a "ADMIN" (todo en MAYÚSCULAS)');
    }
    
    console.log('\n═'.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERROR EJECUTANDO TEST:');
    console.error(error);
  }
})();

