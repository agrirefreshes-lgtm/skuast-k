-- =====================================================================
-- SKUAST-K Certificate System — Migration: Fix Missing Column
-- Run: Supabase Dashboard → SQL Editor → paste this → Run
-- Purpose: Add uploaded_certificate_no column to certificates table
-- =====================================================================

-- Add uploaded_certificate_no column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'certificates'
    AND column_name = 'uploaded_certificate_no'
  ) THEN
    ALTER TABLE public.certificates
    ADD COLUMN uploaded_certificate_no text;
  END IF;

  -- Add index for faster lookups
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_certs_uploaded'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_certs_uploaded
    ON public.certificates (uploaded_certificate_no);
  END IF;
END $$;

-- Add policy for uploaded_certificate_no if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'certificates'
    AND policyname = 'uploaded_certificate_no_public'
  ) THEN
    CREATE POLICY "uploaded_certificate_no_public"
      ON public.certificates FOR SELECT
      USING (true);
  END IF;
END $$;

-- Verify the change
SELECT 'uploaded_certificate_no column' as check_item, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'certificates'
AND column_name = 'uploaded_certificate_no';

SELECT count(*) as column_exists FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'certificates'
AND column_name = 'uploaded_certificate_no';
