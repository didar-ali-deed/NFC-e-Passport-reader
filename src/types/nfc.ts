export interface MRZData {
  documentNumber: string;
  dateOfBirth: string; // YYMMDD
  dateOfExpiry: string; // YYMMDD
}

export interface PersonalInfo {
  surname: string;
  givenNames: string;
  documentNumber: string;
  nationality: string;
  dateOfBirth: string;
  sex: string;
  dateOfExpiry: string;
  issuingState: string;
  rawMRZ?: string;
}

export interface NFCReadResult {
  personalInfo: PersonalInfo | null;
  faceImageBase64: string | null;
  isAuthenticated: boolean;
  rawData: Record<string, unknown>;
}

export type ScanStatus =
  | 'idle'
  | 'waiting'
  | 'reading'
  | 'success'
  | 'error';
