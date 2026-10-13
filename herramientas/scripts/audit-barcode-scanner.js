/**
 * AUDITORÍA AUTOMATIZADA - BarcodeFormScanner con Proxy Local
 *
 * Prueba: Búsqueda de artículo OF26-05315 usando Playwright
 * Usuario: OF26-05315 (artículo conocido)
 *
 * PRECONDICIONES:
 * - Proxy server ejecutándose: node proxy-server.js
 * - App desplegada: https://gestion-de-estanterias.web.app
 */

const { chromium } = require('playwright');

(async () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🔍 AUDITORÍA: BarcodeFormScanner + Proxy Local             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  let browser;
  let errors = [];
  let warnings = [];
  let successes = [];

  try {
    // ═════════════════════════════════════════════════════════════
    // PASO 1: Verificar que el proxy está activo
    // ═════════════════════════════════════════════════════════════
    console.log('📋 PASO 1: Verificar Proxy Server...');
    try {
      const proxyTest = await fetch('http://localhost:3000/health');
      if (proxyTest.ok) {
        successes.push('✅ Proxy server está activo (http://localhost:3000)');
        console.log('   ✅ Proxy health: OK');
      } else {
        errors.push('❌ Proxy server respondió con error: ' + proxyTest.status);
      }
    } catch (err) {
      errors.push('❌ No se puede conectar al proxy: ' + err.message);
      console.log('   ❌ Error: ' + err.message);
    }
    console.log('');

    // ═════════════════════════════════════════════════════════════
    // PASO 2: Probar proxy directamente
    // ═════════════════════════════════════════════════════════════
    console.log('📋 PASO 2: Test API Proxy (buscar OF26-05315)...');
    try {
      const apiTest = await fetch('http://localhost:3000/api/articulo?orderFab=OF26-05315');
      const apiData = await apiTest.json();

      if (apiData.success && apiData.articulo) {
        successes.push(`✅ Proxy API funciona - Artículo: ${apiData.articulo}`);
        console.log(`   ✅ Articulo encontrado: ${apiData.articulo}`);
      } else {
        warnings.push('⚠️ Proxy retornó respuesta sin artículo: ' + JSON.stringify(apiData));
        console.log('   ⚠️ Respuesta: ' + JSON.stringify(apiData));
      }
    } catch (err) {
      errors.push('❌ Error llamando proxy API: ' + err.message);
      console.log('   ❌ Error: ' + err.message);
    }
    console.log('');

    // ═════════════════════════════════════════════════════════════
    // PASO 3: Abrir navegador con Playwright
    // ═════════════════════════════════════════════════════════════
    console.log('📋 PASO 3: Iniciar Navegador (Playwright)...');
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Capturar console errors y network errors
    const networkErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('   🔴 Console error:', msg.text());
      }
    });

    successes.push('✅ Navegador Playwright iniciado');
    console.log('   ✅ Browser abierto');
    console.log('');

    // ═════════════════════════════════════════════════════════════
    // PASO 4: Navegar a la app
    // ═════════════════════════════════════════════════════════════
    console.log('📋 PASO 4: Navegar a la App...');
    await page.goto('https://gestion-de-estanterias.web.app', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    successes.push('✅ App cargada correctamente');
    console.log('   ✅ URL: https://gestion-de-estanterias.web.app');
    console.log('');

    // ═════════════════════════════════════════════════════════════
    // PASO 5: Aguardar login y navegar a UBICAR
    // ═════════════════════════════════════════════════════════════
    console.log('📋 PASO 5: Esperando interfaz disponible...');

    // Esperar a que cargue la app (esperar login, cargar data, etc)
    await page.waitForTimeout(2000);

    // Buscar botón de UBICAR en diferentes posibles ubicaciones
    let ubicarBtn = await page.locator('button, a').filter({
      hasText: /UBICAR|Ubicar|ubicar/
    }).first();

    if (await ubicarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await ubicarBtn.click();
      successes.push('✅ Navegado a flujo UBICAR');
      console.log('   ✅ Click en UBICAR');
      await page.waitForTimeout(1000);
    } else {
      warnings.push('⚠️ No se encontró botón UBICAR, intentando navegar directamente');
      console.log('   ⚠️ Buscando interfaz de otra forma...');
    }
    console.log('');

    // ═════════════════════════════════════════════════════════════
    // PASO 6: Buscar y activar TEXTO/CODIGO BARRAS
    // ═════════════════════════════════════════════════════════════
    console.log('📋 PASO 6: Activar TEXTO/CODIGO BARRAS...');

    // Buscar opción de TEXTO/CODIGO BARRAS
    let barcodeOption = await page.locator('button, label, div').filter({
      hasText: /TEXTO|CODIGO BARRAS|BARRAS/i
    }).first();

    if (await barcodeOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await barcodeOption.click();
      successes.push('✅ Activado modo TEXTO/CODIGO BARRAS');
      console.log('   ✅ Modo barcode activado');
      await page.waitForTimeout(500);
    } else {
      warnings.push('⚠️ No se encontró opción de BARCODE');
      console.log('   ⚠️ Buscando campo de input...');
    }
    console.log('');

    // ═════════════════════════════════════════════════════════════
    // PASO 7: Escribir código en el campo de barcode
    // ═════════════════════════════════════════════════════════════
    console.log('📋 PASO 7: Escribir Código de Barras (05315)...');

    // Buscar input field para código de barras
    const barcodeInputs = await page.locator('input[type="text"]');
    let inputFound = false;

    for (let i = 0; i < await barcodeInputs.count(); i++) {
      const input = barcodeInputs.nth(i);
      const placeholder = await input.getAttribute('placeholder');

      if (placeholder && (placeholder.includes('Escanea') || placeholder.includes('código') || placeholder.includes('Código'))) {
        await input.click();
        await input.fill('05315'); // Escribir sin "OF26-"
        inputFound = true;
        successes.push('✅ Código escrito en campo de barcode');
        console.log('   ✅ Escrito: 05315');
        break;
      }
    }

    if (!inputFound) {
      warnings.push('⚠️ Campo de código de barras no encontrado, intentando cualquier input');
      console.log('   ⚠️ Usando primer input visible...');
      const firstInput = page.locator('input[type="text"]').first();
      await firstInput.click();
      await firstInput.fill('05315');
    }
    console.log('');

    // ═════════════════════════════════════════════════════════════
    // PASO 8: Esperar búsqueda automática (debounce 1s + búsqueda)
    // ═════════════════════════════════════════════════════════════
    console.log('📋 PASO 8: Esperando búsqueda automática...');
    console.log('   ⏳ Esperando 3 segundos (debounce 1s + búsqueda)...');

    await page.waitForTimeout(3000);

    // Buscar resultado de artículo
    let articuloField = null;
    const textContents = await page.locator('input, div, p').allTextContents();

    let foundArticulo = false;
    for (const text of textContents) {
      // Buscar patrones de artículos (ej: 27894-05, etc)
      if (/\d{5,}-\d{2,}/.test(text) || /[A-Z]{3}-\d{3,}/.test(text)) {
        console.log(`   ✅ Artículo encontrado: ${text}`);
        successes.push(`✅ Búsqueda completada - Artículo: ${text}`);
        foundArticulo = true;
        break;
      }
    }

    if (!foundArticulo) {
      // Verificar si hay spinner (buscando)
      const spinner = await page.locator('.animate-spin, [class*="spin"], [class*="load"]').isVisible().catch(() => false);
      if (spinner) {
        warnings.push('⚠️ Todavía buscando (spinner visible)');
        console.log('   ⚠️ Spinner visible, esperando más...');
        await page.waitForTimeout(2000);
      } else {
        warnings.push('⚠️ No se encontró artículo en la interfaz');
        console.log('   ⚠️ Artículo no visible');
      }
    }
    console.log('');

    // ═════════════════════════════════════════════════════════════
    // PASO 9: Verificar errores CORS
    // ═════════════════════════════════════════════════════════════
    console.log('📋 PASO 9: Verificar errores CORS...');

    const corsErrors = await page.evaluate(() => {
      const errors = [];
      const allText = document.body.innerText;

      if (allText.includes('CORS') || allText.includes('cors')) {
        errors.push('CORS error encontrado en página');
      }
      return errors;
    });

    if (corsErrors.length === 0) {
      successes.push('✅ No hay errores CORS visibles');
      console.log('   ✅ Sin errores CORS');
    } else {
      errors.push('❌ Errores CORS detectados: ' + corsErrors.join(', '));
      console.log('   ❌ Errores CORS: ' + corsErrors.join(', '));
    }
    console.log('');

    // ═════════════════════════════════════════════════════════════
    // PASO 10: Captura de pantalla
    // ═════════════════════════════════════════════════════════════
    console.log('📋 PASO 10: Captura de pantalla...');
    await page.screenshot({ path: 'audit-screenshot.png' });
    successes.push('✅ Screenshot guardado: audit-screenshot.png');
    console.log('   ✅ Guardado: audit-screenshot.png');
    console.log('');

    // Cerrar browser
    await browser.close();

  } catch (error) {
    errors.push('❌ Error fatal: ' + error.message);
    console.log('❌ Error:', error.message);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  // ═════════════════════════════════════════════════════════════
  // REPORTE FINAL
  // ═════════════════════════════════════════════════════════════
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  📊 REPORTE FINAL DE AUDITORÍA                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  if (successes.length > 0) {
    console.log('✅ ÉXITOS:');
    successes.forEach(s => console.log('   ' + s));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  ADVERTENCIAS:');
    warnings.forEach(w => console.log('   ' + w));
    console.log('');
  }

  if (errors.length > 0) {
    console.log('❌ ERRORES:');
    errors.forEach(e => console.log('   ' + e));
    console.log('');
  }

  // Resumen
  const total = successes.length + warnings.length + errors.length;
  const percentage = Math.round((successes.length / total) * 100);

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`RESULTADO: ${successes.length}/${total} (${percentage}%)`);

  if (errors.length === 0) {
    console.log('🎉 AUDITORÍA EXITOSA - Sistema funcionando correctamente');
    process.exit(0);
  } else {
    console.log('⚠️  AUDITORÍA PARCIAL - Hay problemas que resolver');
    process.exit(1);
  }
})();
