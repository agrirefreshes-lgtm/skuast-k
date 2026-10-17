import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsonResponse, optionsResponse } from '../_shared/admin-auth.ts';

type EventField = {
  key?: string;
  label?: string;
  sourceKey?: string;
};

const normalize = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

const privateFieldMarkers = [
  'mobile',
  'phone',
  'contact',
  'cell',
  'email',
  'reg',
  'registration',
  'roll',
  'aadhaar',
  'security',
  'password',
  'pin',
];

const publicCertificateData = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([key]) => {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      return !privateFieldMarkers.some((marker) => normalizedKey.includes(marker));
    }),
  );
};

const resolveFieldValue = (
  data: Record<string, unknown>,
  fields: EventField[],
  reference: string,
): string => {
  const field = fields.find((item) =>
    item.sourceKey === reference || item.key === reference || item.label === reference
  );
  const candidates = field
    ? [field.sourceKey, field.key, field.label]
    : [reference];
  for (const candidate of candidates) {
    if (candidate && Object.prototype.hasOwnProperty.call(data, candidate)) {
      return String(data[candidate] ?? '');
    }
  }
  return '';
};

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    console.error('Certificate verification function is missing Supabase server credentials.');
    return jsonResponse(request, { error: 'Certificate verification is temporarily unavailable.' }, 500);
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(request, { error: 'Request body must be valid JSON.' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonResponse(request, { error: 'Invalid verification request.' }, 400);
    }

    const input = body as Record<string, unknown>;
    const client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (input.mode === 'qr') {
      if (typeof input.certificateNo !== 'string' || !input.certificateNo.trim()) {
        return jsonResponse(request, { error: 'Enter a certificate number.' }, 400);
      }
      const certificateNo = input.certificateNo.trim().slice(0, 160);
      const { data: certificate, error } = await client
        .from('certificates')
        .select('certificate_no, event_id, event_name, batch_id, issue_date, status, data')
        .eq('certificate_no', certificateNo)
        .eq('status', 'verified')
        .maybeSingle();
      if (error) {
        console.error('Certificate lookup failed:', error.message);
        return jsonResponse(request, { error: 'Certificate lookup failed. Please try again.' }, 500);
      }
      if (!certificate) {
        return jsonResponse(request, { error: 'No verified certificate matched that number.' }, 404);
      }
      const { data: event, error: eventError } = await client
        .from('events')
        .select('is_published')
        .eq('id', certificate.event_id)
        .maybeSingle();
      if (eventError) {
        console.error('Certificate event lookup failed:', eventError.message);
        return jsonResponse(request, { error: 'Certificate status could not be verified.' }, 500);
      }
      if (!event?.is_published) {
        return jsonResponse(request, { error: 'This certificate is not publicly available.' }, 404);
      }
      return jsonResponse(request, {
        ok: true,
        certificate: { ...certificate, data: publicCertificateData(certificate.data) },
      });
    }

    if (input.mode !== 'event-download') {
      return jsonResponse(request, { error: 'Unsupported verification mode.' }, 400);
    }
    if (
      typeof input.event !== 'string' ||
      typeof input.primaryInput !== 'string' ||
      typeof input.securityInput !== 'string'
    ) {
      return jsonResponse(request, { error: 'Event and verification details are required.' }, 400);
    }
    const eventKey = input.event.trim().slice(0, 200);
    const primaryInput = normalize(input.primaryInput).slice(0, 200);
    const securityInput = normalize(input.securityInput).slice(0, 200);
    if (!eventKey || !primaryInput) {
      return jsonResponse(request, { error: 'Event and primary verification detail are required.' }, 400);
    }

    const byId = await client.from('events').select('*').eq('id', eventKey).maybeSingle();
    if (byId.error) {
      console.error('Event lookup failed:', byId.error.message);
      return jsonResponse(request, { error: 'Event lookup failed. Please try again.' }, 500);
    }
    let event = byId.data;
    if (!event) {
      const bySlug = await client.from('events').select('*').eq('slug', eventKey).maybeSingle();
      if (bySlug.error) {
        console.error('Event lookup failed:', bySlug.error.message);
        return jsonResponse(request, { error: 'Event lookup failed. Please try again.' }, 500);
      }
      event = bySlug.data;
    }
    if (!event || !event.is_published) {
      return jsonResponse(request, { error: 'This event is not publicly available.' }, 404);
    }
    if (event.is_download_enabled === false) {
      return jsonResponse(request, { error: 'Certificate downloads for this event are paused.' }, 403);
    }

    const { data: certificates, error: certificatesError } = await client
      .from('certificates')
      .select('certificate_no, event_id, event_name, batch_id, issue_date, status, data')
      .eq('event_id', event.id)
      .eq('status', 'verified')
      .limit(10000);
    if (certificatesError) {
      console.error('Event certificate lookup failed:', certificatesError.message);
      return jsonResponse(request, { error: 'Certificate lookup failed. Please try again.' }, 500);
    }

    const fields = (Array.isArray(event.fields) ? event.fields : []) as EventField[];
    const primaryReference = String(
      event.primary_auth_field || fields[0]?.sourceKey || fields[0]?.label || fields[0]?.key || '',
    );
    const securityReference = String(
      event.security_auth_field || fields[1]?.sourceKey || fields[1]?.label || fields[1]?.key || '',
    );
    const requiresSecurity = Boolean(securityReference && securityReference !== primaryReference);
    const match = (certificates ?? []).find((certificate) => {
      const data = certificate.data && typeof certificate.data === 'object'
        ? certificate.data as Record<string, unknown>
        : {};
      const primaryMatches =
        normalize(resolveFieldValue(data, fields, primaryReference)) === primaryInput ||
        normalize(certificate.certificate_no) === primaryInput;
      const securityMatches =
        !requiresSecurity ||
        normalize(resolveFieldValue(data, fields, securityReference)) === securityInput;
      return primaryMatches && securityMatches;
    });
    if (!match) {
      return jsonResponse(
        request,
        { error: 'No certificate matched those verification details.' },
        404,
      );
    }

    return jsonResponse(request, { ok: true, certificate: match });
  } catch (error: unknown) {
    console.error(
      'Unexpected certificate verification error:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return jsonResponse(request, { error: 'Certificate verification failed. Please try again.' }, 500);
  }
});
