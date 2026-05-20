// ─── Ordered Module Loader ─────────────────────────────────────────────────
// This file ensures modules load in the correct order:
// 1. vendor-react (React must be available first)
// 2. vendor-firebase (depends on React)
// 3. vendor-misc (depends on both)
// 4. app code

console.log('[entry-ordered] Starting ordered module loading...');

// The actual app needs to be imported after all dependencies are ready
import('./index.tsx').then(() => {
  console.log('[entry-ordered] ✅ App loaded successfully');
}).catch((err) => {
  console.error('[entry-ordered] ❌ Failed to load app:', err);
});
