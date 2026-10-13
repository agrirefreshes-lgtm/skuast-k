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
| Backend | Supabase (PostgreSQL), Edge Functions |
| PDF Generation | jsPDF, html2canvas |
| QR Code | @zxing/browser, qrcode.react |
| File Upload | xlsx (Excel/CSV) |

## Installation & Setup

```bash
# Clone the repository
git clone https://github.com/agrirefreshes-lgtm/skuast-k.git
cd skuastk-cert-system

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

```bash
# Build and deploy to GitHub Pages
npm run deploy
```

The deployed site is served from the /skuast-k/ base path. Update base in vite.config.ts for custom domains.

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
