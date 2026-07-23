const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'capturas');
const BASE_URL = 'https://localhost:3001';
// Fallback port
const ALT_URL = 'https://localhost:3000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForAppLoad(page, maxWait = 15000) {
  // Wait for the app to fully load - look for key UI elements
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const hasShelf = await page.locator('[class*="shelf"], [class*="grid"], [class*="cell"]').count();
    const hasHeader = await page.locator('header, [class*="header"], [class*="Header"]').count();
    if (hasShelf > 0 || hasHeader > 0) return true;
    await sleep(500);
  }
  return false;
}

async function takeScreenshot(page, name, options = {}) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({
    path: filePath,
    fullPage: false,
    ...options
  });
  console.log(`✓ Screenshot guardado: ${name}.png`);
  return filePath;
}

async function main() {
  console.log('🚀 Iniciando navegador Chromium...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  try {
    // 1. Navigate to app
    console.log(`\n📱 Navegando a ${BASE_URL}...`);
    try {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (e) {
      console.log(`⚠️ Error con ${BASE_URL}, intentando ${ALT_URL}...`);
      await page.goto(ALT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }
    await sleep(5000);

    // Check if we're on login screen or already in kiosk
    const currentUrl = page.url();
    console.log(`📍 URL actual: ${currentUrl}`);

    // Take screenshot of initial state
    await takeScreenshot(page, '00-pantalla-inicial');

    // Check if we need to handle login
    const loginButton = await page.locator('text=Acceder con cuenta').count();
    const kioskView = await page.locator('[class*="kiosk"], [class*="Kiosk"], [class*="shelf"]').count();

    if (loginButton > 0) {
      console.log('🔐 Pantalla de login detectada. Intentando login como guest...');

      // Try to find and click a guest/kiosk login option
      // The app uses anonymous auth for kiosks, so we might need to wait
      // for the auto-login or find a way to trigger it

      // Check if there's a quick access or guest button
      const guestBtn = await page.locator('text=carretillero, text=guest, text=invitado, text=operario').first();
      if (await guestBtn.count() > 0) {
        await guestBtn.click();
        await sleep(3000);
      } else {
        // Wait for auto-login (anonymous auth)
        console.log('⏳ Esperando auto-login anónimo...');
        await sleep(5000);
      }
    }

    // Wait for app to load
    console.log('⏳ Esperando carga de la aplicación...');
    await waitForAppLoad(page, 20000);
    await sleep(2000);

    // Take screenshot of main kiosk view
    await takeScreenshot(page, '01-vista-principal-kiosko');

    // Get page content for debugging
    const bodyText = await page.locator('body').innerText();
    console.log(`\n📄 Texto visible en página (primeros 500 chars):\n${bodyText.substring(0, 500)}`);

    // ============================================
    // UBICAR FLOW
    // ============================================
    console.log('\n\n===== PROCESO UBICAR =====');

    // Find and click UBICAR button
    const ubicarBtn = await page.locator('text=UBICAR').first();
    if (await ubicarBtn.count() > 0) {
      console.log('✅ Botón UBICAR encontrado');
      await ubicarBtn.click();
      await sleep(1500);
      await takeScreenshot(page, '02-ubicar-boton');

      // Look for scan method picker
      const scanOptions = await page.locator('text=escaner, text=cámara, text=codigo, text=barras, text=manual, text=OCR, text=Varios').count();
      console.log(`📋 Opciones de escaneo visibles: ${scanOptions}`);
      await takeScreenshot(page, '03-metodo-escaneo');

      // Try to select manual entry option
      const manualOption = await page.locator('text=manual, text=teclado, text=escribir, text=código de barras').first();
      if (await manualOption.count() > 0) {
        await manualOption.click();
        await sleep(1000);
      }

      await takeScreenshot(page, '04-ingreso-codigo');

      // Look for the scanner input field
      const inputField = await page.locator('input[type="text"], input[type="number"], input[placeholder*="código"], input[placeholder*="codigo"], input[placeholder*="scan"]').first();
      if (await inputField.count() > 0) {
        // Type a sample barcode
        console.log('⌨️ Ingresando código de ejemplo...');
        await inputField.fill('TEST001');
        await sleep(500);
        await page.keyboard.press('Enter');
        await sleep(2000);
      }

      await takeScreenshot(page, '05-codigo-escaneado');

      // Look for grid/cells to select positions
      const cells = await page.locator('[class*="cell"], [class*="position"], [class*="location"]').count();
      console.log(`📊 Celdas/grilla visibles: ${cells}`);

      // Try to click on some cells
      if (cells > 0) {
        const cellElements = await page.locator('[class*="cell"], [class*="position"]').all();
        for (let i = 0; i < Math.min(2, cellElements.length); i++) {
          try {
            await cellElements[i].click();
            await sleep(500);
          } catch (e) {}
        }
      }

      await takeScreenshot(page, '06-seleccion-posiciones');

      // Look for confirm button
      const confirmBtn = await page.locator('text=Ubicar, text=Confirmar, text=Guardar').first();
      if (await confirmBtn.count() > 0) {
        await takeScreenshot(page, '07-confirmar-ubicar');
      }

      // Go back to main view
      const backBtn = await page.locator('text=Volver, text=Atrás, text=Cancelar, [class*="close"], [class*="back"]').first();
      if (await backBtn.count() > 0) {
        await backBtn.click();
        await sleep(1000);
      }
    } else {
      console.log('⚠️ Botón UBICAR no encontrado. Intentando encontrar la vista del kiosko...');

      // Maybe we're already in the shelf view, look for action buttons
      const actionBtns = await page.locator('button, [role="button"]').all();
      console.log(`🔘 Botones encontrados: ${actionBtns.length}`);
      for (const btn of actionBtns.slice(0, 10)) {
        const text = await btn.innerText().catch(() => '');
        if (text) console.log(`  - "${text}"`);
      }
    }

    // ============================================
    // RETIRAR FLOW
    // ============================================
    console.log('\n\n===== PROCESO RETIRAR =====');

    // Find and click RETIRAR button
    const retirarBtn = await page.locator('text=RETIRAR').first();
    if (await retirarBtn.count() > 0) {
      console.log('✅ Botón RETIRAR encontrado');
      await retirarBtn.click();
      await sleep(1500);
      await takeScreenshot(page, '08-retirar-boton');

      // Look for article list or cell selection
      await takeScreenshot(page, '09-retirar-lista');

      // Try to select some articles
      const checkboxes = await page.locator('input[type="checkbox"], [role="checkbox"]').count();
      console.log(`☑️ Checkboxes visibles: ${checkboxes}`);

      if (checkboxes > 0) {
        const checkboxElements = await page.locator('input[type="checkbox"], [role="checkbox"]').all();
        for (let i = 0; i < Math.min(2, checkboxElements.length); i++) {
          try {
            await checkboxElements[i].click();
            await sleep(300);
          } catch (e) {}
        }
      }

      await takeScreenshot(page, '10-retirar-seleccion');

      // Look for confirm button
      const confirmRetirar = await page.locator('text=RETIRAR, text=Confirmar').first();
      if (await confirmRetirar.count() > 0) {
        await takeScreenshot(page, '11-confirmar-retirar');
      }
    } else {
      console.log('⚠️ Botón RETIRAR no encontrado directamente.');

      // Maybe need to go back to action grid first
      const mostrarBtn = await page.locator('text=Mostrar, text=acciones, text=Menú').first();
      if (await mostrarBtn.count() > 0) {
        await mostrarBtn.click();
        await sleep(1000);
        await takeScreenshot(page, '08b-menu-acciones');
      }
    }

    console.log('\n✅ Captura de pantallas completada');

  } catch (error) {
    console.error('❌ Error durante la captura:', error.message);
    // Take error screenshot
    await takeScreenshot(page, 'error-state');
  } finally {
    await browser.close();
    console.log('🔒 Navegador cerrado');
  }
}

main().catch(console.error);
