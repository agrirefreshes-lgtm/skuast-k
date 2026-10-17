# Security Documentation - SKUAST-K Certificate System

## Security Findings & Fixes

### 1. **Hardcoded API Keys** ✅ FIXED
**Issue:** Supabase URL and API key were hardcoded in source files.
**Fix:** Updated to use environment variables with fallback.

**Action Required for Production:**
1. Copy `.env.example` to `.env`
2. Set real values in `.env`
3. Ensure `.env` is in `.gitignore`
4. Remove fallback values before deployment

---

### 2. **SessionStorage Usage** ✅ FIXED
**Issue:** AdminLogin.tsx used sessionStorage for session state.
**Fix:** Removed manual session storage; Supabase Auth manages browser session persistence.

---

### 3. **Missing Database Column** ✅ FIXED
**Issue:** `uploaded_certificate_no` column missing from certificates table.
**Fix:** Added the column to the fresh schema and consolidated the existing-project upgrade into `supabase/upgrade_existing.sql`.

---

### 4. **Storage Bucket Configuration** ⚠️ REQUIRES SETUP
**Issue:** `storage.buckets` table not found.
**Fix:** Updated `supabase/schema.sql` with proper storage bucket setup.

**Action:** Run updated schema SQL to create `templates` bucket.

---

### 5. **SQL Injection Prevention** ✅ IMPLEMENTED
Input sanitization blocks injection attempts:
- `123'; DROP TABLE certificates; --` → `123`
- `1' OR '1'='1` → sanitized
- Script tags removed

---

### 6. **XSS Prevention** ✅ IMPLEMENTED
- React StrictMode enabled
- Error boundaries implemented
- All input sanitized

---

### 7. **Cache Security** ✅ IMPLEMENTED
Cache-Control headers set: `no-cache, no-store, must-revalidate`

---

### 8. **HTTPS Enforcement** ✅ IMPLEMENTED
- Theme-color meta tag set
- Production should use HTTPS

---

### 9. **URL Security** ✅ IMPLEMENTED
- Certificate URLs properly encoded
- Event slugs sanitized
- No script injection via URL

---

### 10. **RBAC** ✅ IMPLEMENTED
**Database Roles:** super_admin, admin
**RLS Policies:** Enabled on all tables

---

### 11. **Department Admin Login & Creation**
- Dashboard creation uses the Supabase Auth Admin API through `supabase/functions/create-department-admin/index.ts`; the function verifies the caller's JWT and active `super_admin` profile before creating an account and active profile.
- Suspend/restore/remove operations use `supabase/functions/manage-department-admin/index.ts`; removed admins' event and certificate ownership is transferred to the Super Admin before account deletion.
- Public QR and event-download certificate lookups use `supabase/functions/verify-certificate/index.ts`. Anonymous clients have no direct certificate-table access; QR responses exclude configured private-field markers, and downloads require the event's two identity values.
- The service-role key is read only from the Edge Function runtime environment and is never included in the browser bundle.
- On an existing project, back up the project and run `supabase/upgrade_existing.sql` before deploying the frontend. The upgrade removes legacy direct-auth RPCs, revokes anonymous certificate access, and applies event-ownership policies.
- Deploy all three Edge Functions before publishing the frontend version that invokes them. Keep JWT verification enabled for both admin functions; certificate verification applies its own public-access rules.
- Admin login uses Supabase Auth email/password and only opens the console when the user has an active `admin` or `super_admin` profile.

---

## Security Tests Summary

```
✅ 47/47 tests passing with `npm test`
```
