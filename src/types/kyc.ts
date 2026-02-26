export interface NFCSession {
  sessionId: string;
  consentGiven: boolean;
  timestamp: string;
  status: NFCSessionStatus;
}

export type NFCSessionStatus =
  | 'pending'
  | 'consent'
  | 'mrz_scan'
  | 'nfc_read'
  | 'complete'
  | 'failed';

export interface MRZScanResult {
  passportNumber: string;
  dateOfBirth: string;   // YYMMDD
  dateOfExpiry: string;  // YYMMDD
  surname: string;
  givenNames: string;
  nationality: string;
  sex: string;
  rawMRZ: string;
}

export interface PassportChipData {
  personalInfo: {
    surname: string;
    givenNames: string;
    documentNumber: string;
    nationality: string;
    dateOfBirth: string;
    sex: string;
    dateOfExpiry: string;
    issuingState: string;
  } | null;
  faceImageBase64: string | null;
  isAuthenticated: boolean;
  sodVerified: boolean;
  chipAuthDone: boolean | null; // null = not supported / not attempted
}

export interface PassportScanResult {
  sessionId: string;
  passportAuthentic: boolean;
  sodVerified: boolean;
  chipAuthDone: boolean | null;
  status: 'SUCCESS' | 'FAILED';
  reason: string;
  timestamp: string;
}

export interface AuditLog {
  sessionId: string;
  steps: AuditStep[];
  finalDecision: PassportScanResult | null;
}

export interface AuditStep {
  step: string;
  status: 'pass' | 'fail' | 'pending';
  timestamp: string;
  details?: string;
}
