# Legacy Frontend Boundary

This directory is frozen.

- `app/web/AppV3.tsx` is the active application entrypoint.
- Files under `app/web/legacy/` remain only for compatibility, historical reference, and staged retirement.
- New features must not be added here.
- Bug fixes here should be limited to preventing regressions while the final retirement is completed.

## Current retirement status

- `AppLegacy.tsx` is the legacy shell.
- `firebaseCompat.ts` and `hooks/useRoles.ts` are legacy auth/role dependencies.
- Some shared components outside `app/web/legacy/` still import legacy role types, but those flows are consumed by the legacy shell, not by `AppV3.tsx`.

## Retirement plan

1. Keep `AppV3.tsx` as the only active v3 entrypoint.
2. Avoid new imports from `app/web/legacy/**` into active v3 flows.
3. Migrate any remaining type-only dependencies away from `hooks/useRoles.ts` when the old shell is retired.
4. Remove `firebaseCompat.ts`, `AppLegacy.tsx`, and `hooks/useRoles.ts` together once no runtime consumer remains.
