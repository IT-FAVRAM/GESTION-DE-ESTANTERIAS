# Security Policy

## Supported Versions

Currently, only the latest version of the application is supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a vulnerability, please report it responsibly:

1.  **Do NOT** open a public issue on GitHub.
2.  **Email** the details to `admin@example.com` (replace with actual admin email if known, or generic instruction).
3.  Include steps to reproduce the issue.

## Security Measures

This project implements several security layers:

### 1. Data Validation
- **Strict Location Whitelist**: All locations are validated against a central layout definition (`lib/warehouseLayout.ts`).
- **Sanitization**: All Excel/CSV exports are sanitized to prevent formula injection.
- **Input Validation**: Barcodes and Order IDs are validated for format and length.

### 2. Access Control
- **Role-Based Access (RBAC)**: Firestore Rules enforce strict role checks (`CARRETILLERO`, `JEFE`, `ADMIN`).
- **Deny-by-Default**: All database access is denied unless explicitly allowed.
- **Schema Validation**: Writes to critical collections (`assignments`) are validated against a strict schema in Firestore Rules.

### 3. Audit Trails
- **History Logging**: All inventory changes (`assign`, `move`, `remove`) are logged to the `history` collection with the actor's identity and timestamp.
- **Cloud Functions**: Critical operations and AI interactions are mediated by Cloud Functions to protect API keys.

## Best Practices for Developers
- Always use `isValidLayoutLocation` for validating location inputs.
- Use `sanitizeField` when exporting user-generated content.
- Do not commit API keys or secrets to the repository.
