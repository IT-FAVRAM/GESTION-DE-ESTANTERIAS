# Operational Risk Remediation Checklist

- [x] Remove not-found cannot return success
- [x] Empty shelf does not report success when operation fails
- [x] Assignments direct writes blocked for non-admin clients
- [x] Critical inventory operations exposed through backend gateway
- [x] History entries include `uid`, `role`, `opId`, `source`
- [x] Pending requests query filtered server-side by `status=PENDING`
- [x] Assignments subscription scoped to active warehouse
- [x] AI callable restricted by role/type allowlist

## Verification Commands

1. `node tests/*.cjs`
2. `npm run build`
3. `npm --prefix functions run build`
