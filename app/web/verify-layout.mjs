import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.createContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  
  // Set landscape viewport
  await page.setViewportSize({ width: 1366, height: 768 });
  
  await page.goto('https://localhost:3001/', { waitUntil: 'networkidle' });
  
  // Wait for React to render
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  
  // Check if orientation overlay is hidden (landscape orientation)
  const overlayVisible = await page.isVisible('#orientation-overlay');
  console.log('❌ Overlay visible in landscape:', overlayVisible);
  
  // Check the root div dimensions
  const rootBounds = await page.locator('#root').boundingBox();
  console.log('✅ Root element bounds:', rootBounds);
  
  // Check viewport dimensions
  const viewportSize = page.viewportSize();
  console.log('✅ Viewport size:', viewportSize);
  
  // Take screenshot for manual verification
  await page.screenshot({ path: 'landscape-layout.png' });
  console.log('✅ Screenshot saved to landscape-layout.png');
  
  // Test portrait orientation
  await page.setViewportSize({ width: 768, height: 1366 });
  await page.waitForTimeout(500);
  
  const overlayVisiblePortrait = await page.isVisible('#orientation-overlay');
  console.log('✅ Overlay visible in portrait:', overlayVisiblePortrait);
  
  await browser.close();
})();
