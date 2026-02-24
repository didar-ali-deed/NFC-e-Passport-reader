/**
 * LivenessService — Steps 8 & 9
 * Integrates with a liveness detection API (Shufti Pro / Sumsub compatible).
 * Also performs face matching between passport photo and live selfie.
 */
import type {LivenessResult, FaceMatchResult} from '../types/kyc';

// React Native has global btoa/atob from Hermes JS engine
declare function btoa(s: string): string;

// Demo mode uses mock responses — replace with real API endpoint + key
const DEMO_MODE = true;
const API_BASE_URL = 'https://api.shuftipro.com'; // replace with your provider
const API_KEY = 'YOUR_API_KEY_HERE';               // replace with your key

class LivenessService {
  /**
   * Step 8: Liveness Detection
   * Send selfie to API — API checks for blink, texture, depth cues.
   */
  async checkLiveness(selfieBase64: string): Promise<LivenessResult> {
    if (DEMO_MODE) {
      return this.mockLivenessResult();
    }

    try {
      const response = await fetch(`${API_BASE_URL}/liveness`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${btoa(API_KEY + ':')}`,
        },
        body: JSON.stringify({
          reference: `liveness_${Date.now()}`,
          country: 'PK',
          language: 'EN',
          face: {
            proof: selfieBase64,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Liveness API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        passed: data.event === 'verification.accepted',
        score: data.verification_result?.face?.liveness_detected ?? 0,
        provider: 'ShuftiPro',
      };
    } catch (err: any) {
      throw new Error(`Liveness check failed: ${err.message}`);
    }
  }

  /**
   * Step 9: Face Matching
   * Compare passport chip face (DG2) with live selfie.
   */
  async matchFaces(
    passportFaceBase64: string,
    selfieBase64: string,
  ): Promise<FaceMatchResult> {
    if (DEMO_MODE) {
      return this.mockFaceMatchResult();
    }

    try {
      const response = await fetch(`${API_BASE_URL}/face-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${btoa(API_KEY + ':')}`,
        },
        body: JSON.stringify({
          reference: `match_${Date.now()}`,
          face: {
            proof: selfieBase64,
            proof_back: passportFaceBase64,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Face match API error: ${response.status}`);
      }

      const data = await response.json();
      const score = data.verification_result?.face?.face_match ?? 0;
      const threshold = 0.85;
      return {
        matched: score >= threshold,
        score,
        threshold,
      };
    } catch (err: any) {
      throw new Error(`Face match failed: ${err.message}`);
    }
  }

  private mockLivenessResult(): Promise<LivenessResult> {
    return new Promise(resolve =>
      setTimeout(
        () =>
          resolve({
            passed: true,
            score: 0.97,
            provider: 'Demo',
          }),
        2000,
      ),
    );
  }

  private mockFaceMatchResult(): Promise<FaceMatchResult> {
    return new Promise(resolve =>
      setTimeout(
        () =>
          resolve({
            matched: true,
            score: 0.93,
            threshold: 0.85,
          }),
        1500,
      ),
    );
  }
}

export default new LivenessService();
