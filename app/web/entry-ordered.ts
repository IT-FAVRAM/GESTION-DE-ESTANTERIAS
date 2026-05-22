// ─── Ordered Module Loader ─────────────────────────────────────────────────
// This file ensures modules load in the correct order:
// 1. vendor-react (React must be available first)
// 2. vendor-firebase (depends on React)
// 3. vendor-misc (depends on both)
// 4. app code

import('./index.tsx').catch((err) => {
  console.error('[entry-ordered] Failed to load app:', err);
});
