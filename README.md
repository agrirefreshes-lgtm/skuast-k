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

### Supabase SQL files

- `supabase/schema.sql` — secure schema for a fresh project.
- `supabase/upgrade_existing.sql` — combined, idempotent upgrade for an existing project (RLS hardening, admin login fix, and the uploaded certificate column). Run this instead of separately running legacy SQL snippets.

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
