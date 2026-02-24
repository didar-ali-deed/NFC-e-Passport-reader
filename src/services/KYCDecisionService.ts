/**
 * KYCDecisionService — Steps 10 & 11
 * Makes final KYC decision and stores audit log.
 */
import type {
  KYCDecision,
  PassportChipData,
  LivenessResult,
  FaceMatchResult,
  AuditLog,
} from '../types/kyc';
import SessionService from './SessionService';

class KYCDecisionService {
  /**
   * Step 10: Final KYC Decision
   * All three checks must pass for VERIFIED status.
   */
  makeDecision(
    passportData: PassportChipData,
    liveness: LivenessResult,
    faceMatch: FaceMatchResult,
  ): KYCDecision {
    const session = SessionService.getSession();
    const sessionId = session?.sessionId ?? 'UNKNOWN';

    const passportAuthentic = passportData.isAuthenticated;
    const livenessPassed = liveness.passed && liveness.score >= 0.80;
    const faceMatched = faceMatch.matched && faceMatch.score >= faceMatch.threshold;

    let finalStatus: 'VERIFIED' | 'REJECTED';
    let reason: string;

    if (passportAuthentic && livenessPassed && faceMatched) {
      finalStatus = 'VERIFIED';
      reason = 'All checks passed: passport authentic, liveness confirmed, face matched.';
    } else {
      finalStatus = 'REJECTED';
      const failures: string[] = [];
      if (!passportAuthentic) failures.push('passport authentication failed');
      if (!livenessPassed) failures.push(`liveness failed (score: ${liveness.score})`);
      if (!faceMatched) failures.push(`face match failed (score: ${faceMatch.score})`);
      reason = `KYC rejected: ${failures.join(', ')}.`;
    }

    const decision: KYCDecision = {
      sessionId,
      passportAuthentic,
      livenessPassed,
      faceMatched,
      finalStatus,
      reason,
      timestamp: new Date().toISOString(),
    };

    // Log decision in audit trail
    SessionService.logStep(
      'kyc_decision',
      finalStatus === 'VERIFIED' ? 'pass' : 'fail',
      reason,
    );

    const auditLog = SessionService.getAuditLog();
    if (auditLog) auditLog.finalDecision = decision;

    return decision;
  }

  /**
   * Step 11: Build final audit record for backend submission
   * Contains NO raw biometrics — only hashes, results, timestamps.
   */
  buildAuditRecord(
    decision: KYCDecision,
    faceMatch: FaceMatchResult,
    liveness: LivenessResult,
  ): object {
    const auditLog: AuditLog | null = SessionService.getAuditLog();
    return {
      session_id: decision.sessionId,
      kyc_status: decision.finalStatus,
      reason: decision.reason,
      timestamp: decision.timestamp,
      checks: {
        passport_authentic: decision.passportAuthentic,
        liveness_passed: decision.livenessPassed,
        liveness_score: liveness.score,
        face_matched: decision.faceMatched,
        face_match_score: faceMatch.score,
        face_match_threshold: faceMatch.threshold,
      },
      audit_steps: auditLog?.steps ?? [],
      // NOTE: No raw images, no MRZ data, no biometrics stored here
      data_policy: 'biometrics_not_stored',
    };
  }

  /**
   * Submit audit record to backend (Step 11)
   * In production: POST to your Node.js/Python backend → PostgreSQL
   */
  async submitToBackend(auditRecord: object): Promise<boolean> {
    // Demo mode: just log it
    console.log('[KYC AUDIT]', JSON.stringify(auditRecord, null, 2));
    // In production:
    // await fetch('https://your-backend.com/api/kyc/result', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(auditRecord),
    // });
    return true;
  }
}

export default new KYCDecisionService();
