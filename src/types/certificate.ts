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
}

export interface UploadedBatch {
  batchId: string;
  fileName: string;
  uploadedAt: string;
  count: number;
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
  qrConfig: {
    x: number;
    y: number;
    size: number;
    visible: boolean;
  };
  certNoConfig: {
    x: number;
    y: number;
    fontSize: number;
    color: string;
    isBold: boolean;
    visible: boolean;
  };
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