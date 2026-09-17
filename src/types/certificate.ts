export interface DynamicFieldDef {
  key: string;
  label: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  backgroundColor?: string;
  fontFamily: string;
  isBold: boolean;
  isItalic?: boolean;
  isUppercase?: boolean;
  align: 'center' | 'left' | 'right';
  maxWidth: number;
  lineHeight: number;
  maxLines?: number;
  visible: boolean;
  isLocked?: boolean; // Layer lock toggle feature
}

export interface UploadedBatch {
  batchId: string;
  fileName: string;
  uploadedAt: string;
  count: number;
}

export interface QRConfig {
  x: number;
  y: number;
  size: number;
  visible: boolean;
  isLocked?: boolean; // QR layer lock toggle feature
}

export interface CertNoConfig {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  isBold: boolean;
  visible: boolean;
  isLocked?: boolean; // Cert No layer lock toggle feature
}

export interface EventItem {
  id: string;
  name: string;
  slug: string;
  certPrefix: string;
  templateUrl: string;
  fields: DynamicFieldDef[];
  batches: UploadedBatch[];
  primaryAuthField: string;
  securityAuthField: string;
  qrConfig: QRConfig;
  certNoConfig: CertNoConfig;
  created_at?: string;
}

export interface IssuedCertificate {
  certificate_no: string;
  event_id: string;
  event_name: string;
  batchId?: string;
  issue_date: string;
  status: 'verified' | 'cancelled' | string;
  data: Record<string, string>;
}