# SKUAST-K Official Digital Certification System

**Sher-e-Kashmir University of Agricultural Sciences and Technology of Kashmir (SKUAST-K)**

A comprehensive, tamper-proof digital certificate management platform built for Sher-e-Kashmir University of Agricultural Sciences and Technology of Kashmir. Issue, download, and verify academic certificates for seminars, workshops, conferences, training programs, and events — designed for District Service Welfare (DSW) under NSS Unints.

## Features

- **Digital Certificate Issuance:** Auto-generate official PDF certificates for any certified event/batch.
- **Public Verification Portal:** Anyone can verify certificate authenticity via a unique Certificate No. using QR code scanning or manual entry.
- **QR Code Authentication:** Tamper-proof QR codes embedded on every certificate for quick mobile verification.
- **Batch Upload (Excel/CSV):** Bulk upload candidate data from Excel/CSV sheets — auto-detect columns and map fields.
- **Admin Dashboard:** Full-featured admin console to create events, upload templates, manage batches, and publish certificates.
- **Event Slug Pages:** Shareable event-specific URLs (e.g., /event/{event-slug}) for targeted downloads.
- **Cloud-Backed Security:** Backend powered by Supabase (PostgreSQL) with encrypted records and role-based access control.
- **Official PDF Export:** Export verified certificates in high-resolution PDF format.

## Tech Stack

| Category | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Routing | React Router DOM |
| Backend | Supabase (Auth, PostgreSQL, Storage) |
| PDF Generation | jsPDF, html2canvas |
| QR Code | @zxing/browser, qrcode.react |
| File Upload | xlsx (Excel/CSV) |

## Installation & Setup

```bash
# Clone the repository
git clone https://github.com/agrirefreshes-lgtm/skuast-k.git
cd skuast-k

# Install dependencies
npm install
```

For local development, copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell) and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The ignored `.env` is your private local config; `.env.example` is the safe template committed to Git. They are intentionally different and should both remain.

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

```bash
# Push to main; GitHub Actions builds and publishes GitHub Pages automatically
git push origin main
```

The deployment workflow at `.github/workflows/deploy.yml` builds and tests the site before publishing `dist/` to the `gh-pages` branch. GitHub Pages must be configured to deploy from the `gh-pages` branch, root folder. Add the repository Actions secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Settings → Secrets and variables → Actions**; the workflow stops before deployment if either is missing.

There is intentionally no local `gh-pages` deploy command: push code to `main` and check **Actions → Deploy to GitHub Pages** for the result. Do not commit `.env`; it is for local development only. The published site is served from `/skuast-k/`.

The page components load with the app shell for immediate route navigation; large spreadsheet, PDF/image export, and camera-scanning libraries are split into feature chunks and loaded only when those actions are used.

### Supabase admin and certificate functions

The browser uses three Supabase Edge Functions; account changes and public certificate lookups do not write/read certificate or Auth internals directly:

- `create-department-admin` creates the Auth account with Supabase's Auth Admin API, then creates its active `admin_profiles` row. If profile creation fails, it removes the incomplete Auth account.
- `manage-department-admin` suspends, restores, or removes department-admin accounts. Removal transfers that admin's event and certificate ownership to the Super Admin first.
- `verify-certificate` performs published-event/verified-certificate lookups and returns only public-safe fields for QR verification. Event downloads require both configured identity fields.

Deploy these exact function sources to the same Supabase project before publishing the frontend:

1. Verify a restorable database and Storage backup exists.
2. Run `supabase/upgrade_existing.sql` in the Supabase SQL Editor. Do not run old SQL snippets/RPCs from prior deployments.
3. Deploy `create-department-admin`, `manage-department-admin`, and `verify-certificate` from their matching folders under `supabase/functions/`. Keep JWT verification enabled for the two admin functions; the server code independently verifies the active Super Admin role. Public certificate verification remains a public function and enforces publication/download rules itself.
4. Verify the existing Super Admin profile still has `role = 'super_admin'` and `is_active = true`.
5. Push the frontend to `main` and verify the GitHub Pages workflow succeeds. Test Super Admin creation of a department admin, department-admin sign-in, event creation, certificate issuance, QR verification, and candidate download.

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the server-side function runtime. Never add the service-role key to GitHub Pages environment variables, `.env`, or frontend code.

#### Approved data reset

Only perform this after confirming the backup can be restored. Preserve the current Super Admin Auth user and profile. Remove each department admin from the Super Admin dashboard (which transfers their records), delete the events from the dashboard (certificate rows cascade with their event), then delete the old template files from **Storage → templates**. Do not delete users from `auth.users` with SQL or delete the Super Admin. Confirm the resulting admin profile list contains the preserved Super Admin before creating new department admins.

### Supabase SQL files

- `supabase/schema.sql` — secure schema for a fresh project.
- `supabase/upgrade_existing.sql` — combined, idempotent upgrade for an existing project (RLS hardening, legacy admin-creation RPC removal, and the uploaded certificate column). Run this instead of separately running legacy SQL snippets.

## Architecture

```
src/
  components/   # Navbar, Footer, CertificateCanvas, ExcelUploader
  lib/          # supabaseClient, shareUrl helpers, certificateFields mapping
  pages/        # UserPortal, AdminDashboard, PublicVerification, PublicEventDownload
  types/        # TypeScript interfaces for certificate events
```

## Project Metadata (SEO / Discoverability)

**Project Name:** SKUAST-K Certificate System
**Official Website:** https://skuastkashmir.ac.in/
**GitHub Repository:** https://github.com/agrirefreshes-lgtm/skuast-k
**Author:** Aditya Jha

**Keywords:** SKUAST-K, SKUAST-Kashmir, University Certificate System, Digital Certificate, Academic Credential, Certificate Verification, Event Certificate, Seminar Certificate, Workshop Certificate, Conference Certificate, Certificate Management System, DSW Certification, NSS Unints, QR Certificate Verification, Sham-e-Kashmir University, Agricultural University, Jammu Kashmir, Digital Certificate Download, Certificate Authentication, Official University Certificate, Certificate PDF Download, university certificate portal, academic credential management

## Contributing

Contributions are welcome! Please read the CONTRIBUTING.md guidelines before submitting a pull request.

## License

This project is licensed under the MIT License.

## Contact

For queries, please contact the SKUAST-K Certificate System team via the official university website: https://skuastkashmir.ac.in/
