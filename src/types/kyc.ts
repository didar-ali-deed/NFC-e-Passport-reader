export interface KYCSession {
  sessionId: string;
  consentGiven: boolean;
  timestamp: string;
  status: KYCStatus;
}

export type KYCStatus =
  | 'pending'
  | 'consent'
  | 'mrz_scan'
  | 'nfc_read'
  | 'liveness'
  | 'face_match'
  | 'verified'
  | 'rejected';

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
  chipAuthDone: boolean;
}

export interface LivenessResult {
  passed: boolean;
  score: number;
  provider: string;
}

export interface FaceMatchResult {
  matched: boolean;
  score: number;
  threshold: number;
}

export interface KYCDecision {
  sessionId: string;
  passportAuthentic: boolean;
  livenessPassed: boolean;
  faceMatched: boolean;
  finalStatus: 'VERIFIED' | 'REJECTED';
  reason: string;
  timestamp: string;
}

export interface AuditLog {
  sessionId: string;
  steps: AuditStep[];
  finalDecision: KYCDecision | null;
}

export interface AuditStep {
  step: string;
  status: 'pass' | 'fail' | 'pending';
  timestamp: string;
  details?: string;
}
