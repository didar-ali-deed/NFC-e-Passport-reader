/**
 * SessionService — Step 1
 * Manages KYC session lifecycle: creation, consent, audit logging, and history.
 */
import type {KYCSession, KYCStatus, AuditLog, AuditStep, KYCDecision} from '../types/kyc';

export interface HistoryEntry {
  sessionId: string;
  timestamp: string;
  name: string;
  documentNumber: string;
  nationality: string;
  result: 'VERIFIED' | 'REJECTED';
  reason: string;
}

function generateSessionId(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `KYC_${now.getFullYear()}_${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

class SessionService {
  private currentSession: KYCSession | null = null;
  private auditLog: AuditLog | null = null;
  private history: HistoryEntry[] = [];

  /**
   * Create a new KYC session (called when user taps "Start KYC")
   */
  createSession(): KYCSession {
    const sessionId = generateSessionId();
    this.currentSession = {
      sessionId,
      consentGiven: false,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    this.auditLog = {
      sessionId,
      steps: [],
      finalDecision: null,
    };
    this.logStep('session_created', 'pass', 'Session initialized');
    return this.currentSession;
  }

  /**
   * Record user consent (GDPR requirement)
   */
  recordConsent(): KYCSession {
    if (!this.currentSession) {
      throw new Error('No active session. Call createSession() first.');
    }
    this.currentSession.consentGiven = true;
    this.currentSession.status = 'consent';
    this.logStep('consent', 'pass', 'User gave explicit consent');
    return this.currentSession;
  }

  updateStatus(status: KYCStatus): void {
    if (this.currentSession) {
      this.currentSession.status = status;
    }
  }

  getSession(): KYCSession | null {
    return this.currentSession;
  }

  getAuditLog(): AuditLog | null {
    return this.auditLog;
  }

  logStep(step: string, status: 'pass' | 'fail' | 'pending', details?: string): void {
    if (!this.auditLog) return;
    const entry: AuditStep = {
      step,
      status,
      timestamp: new Date().toISOString(),
      details,
    };
    this.auditLog.steps.push(entry);
  }

  /**
   * Add a completed KYC result to history
   */
  addToHistory(
    decision: KYCDecision,
    name: string,
    documentNumber: string,
    nationality: string,
  ): void {
    this.history.unshift({
      sessionId: decision.sessionId,
      timestamp: decision.timestamp,
      name,
      documentNumber: documentNumber.replace(/.(?=.{3})/g, '*'),
      nationality,
      result: decision.finalStatus,
      reason: decision.reason,
    });
    // Keep last 50 entries
    if (this.history.length > 50) {
      this.history = this.history.slice(0, 50);
    }
  }

  getHistory(): HistoryEntry[] {
    return this.history;
  }

  clearHistory(): void {
    this.history = [];
  }

  /**
   * Destroy session — clear all sensitive data from memory
   */
  destroySession(): void {
    this.currentSession = null;
    this.auditLog = null;
  }
}

export default new SessionService();
