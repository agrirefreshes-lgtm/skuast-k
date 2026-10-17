import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export interface VerifiedCertificateRecord {
  certificate_no: string;
  event_id: string;
  event_name: string;
  batch_id?: string;
  issue_date: string;
  status: string;
  data: Record<string, string>;
}

type VerificationRequest =
  | { mode: 'qr'; certificateNo: string }
  | {
      mode: 'event-download';
      event: string;
      primaryInput: string;
      securityInput: string;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const readFunctionError = async (error: Error): Promise<string> => {
  if (!(error instanceof FunctionsHttpError) || !(error.context instanceof Response)) {
    return error.message;
  }

  const text = await error.context.clone().text();
  if (!text) return error.message;
  try {
    const payload: unknown = JSON.parse(text);
    if (isRecord(payload)) {
      if (typeof payload.error === 'string') return payload.error;
      if (typeof payload.message === 'string') return payload.message;
    }
  } catch {
    return text;
  }
  return text;
};

export const verifyPublicCertificate = async (
  request: VerificationRequest,
): Promise<VerifiedCertificateRecord> => {
  const { data, error } = await supabase.functions.invoke<unknown>(
    'verify-certificate',
    { body: request },
  );
  if (error) {
    throw new Error(await readFunctionError(error));
  }

  if (!isRecord(data)) {
    throw new Error('Certificate verification returned an invalid response.');
  }
  if (data.ok !== true) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : typeof data.message === 'string'
          ? data.message
          : 'Certificate verification was not confirmed.',
    );
  }

  if (!isRecord(data.certificate)) {
    throw new Error('Certificate verification succeeded without certificate details.');
  }
  const certificate = data.certificate;
  if (
    typeof certificate.certificate_no !== 'string' ||
    typeof certificate.event_id !== 'string' ||
    typeof certificate.event_name !== 'string' ||
    typeof certificate.issue_date !== 'string' ||
    typeof certificate.status !== 'string' ||
    !isRecord(certificate.data)
  ) {
    throw new Error('Certificate verification returned incomplete certificate details.');
  }

  return {
    certificate_no: certificate.certificate_no,
    event_id: certificate.event_id,
    event_name: certificate.event_name,
    batch_id: typeof certificate.batch_id === 'string' ? certificate.batch_id : undefined,
    issue_date: certificate.issue_date,
    status: certificate.status,
    data: Object.fromEntries(
      Object.entries(certificate.data).map(([key, value]) => [key, String(value ?? '')]),
    ),
  };
};
