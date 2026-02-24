/**
 * PDFExportService — Generates KYC verification reports as PDF files.
 * Uses react-native-html-to-pdf for conversion and react-native-share for sharing.
 */
import {generatePDF} from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import type {
  KYCDecision,
  PassportChipData,
  LivenessResult,
  FaceMatchResult,
  AuditLog,
} from '../types/kyc';

class PDFExportService {
  /**
   * Generate a KYC verification report PDF and return the file path.
   */
  async generateReport(
    decision: KYCDecision,
    passportData: PassportChipData,
    livenessResult: LivenessResult,
    faceMatchResult: FaceMatchResult,
    auditLog: AuditLog | null,
  ): Promise<string> {
    const html = this.buildHTML(decision, passportData, livenessResult, faceMatchResult, auditLog);

    const options = {
      html,
      fileName: `KYC_Report_${decision.sessionId}`,
      directory: 'Documents',
      base64: false,
    };

    const pdf = await generatePDF(options);
    if (!pdf.filePath) {
      throw new Error('PDF generation failed');
    }
    return pdf.filePath;
  }

  /**
   * Generate and share the PDF report.
   */
  async generateAndShare(
    decision: KYCDecision,
    passportData: PassportChipData,
    livenessResult: LivenessResult,
    faceMatchResult: FaceMatchResult,
    auditLog: AuditLog | null,
  ): Promise<void> {
    const filePath = await this.generateReport(
      decision,
      passportData,
      livenessResult,
      faceMatchResult,
      auditLog,
    );

    await Share.open({
      title: 'KYC Verification Report',
      url: `file://${filePath}`,
      type: 'application/pdf',
      subject: `KYC Report - ${decision.sessionId}`,
    });
  }

  private buildHTML(
    decision: KYCDecision,
    passportData: PassportChipData,
    livenessResult: LivenessResult,
    faceMatchResult: FaceMatchResult,
    auditLog: AuditLog | null,
  ): string {
    const isVerified = decision.finalStatus === 'VERIFIED';
    const pi = passportData.personalInfo;
    const date = new Date(decision.timestamp);
    const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

    const statusColor = isVerified ? '#2E7D32' : '#C62828';
    const statusBg = isVerified ? '#E8F5E9' : '#FFEBEE';
    const statusBorder = isVerified ? '#4CAF50' : '#F44336';

    const checkIcon = (passed: boolean) =>
      passed
        ? '<span style="color:#4CAF50;font-weight:bold;">PASS</span>'
        : '<span style="color:#F44336;font-weight:bold;">FAIL</span>';

    const auditRows = auditLog?.steps
      .map(
        s => `
        <tr>
          <td style="padding:4px 8px;font-size:11px;color:${
            s.status === 'pass' ? '#4CAF50' : s.status === 'fail' ? '#F44336' : '#999'
          };font-weight:bold;">${s.status.toUpperCase()}</td>
          <td style="padding:4px 8px;font-size:11px;">${s.step}</td>
          <td style="padding:4px 8px;font-size:10px;color:#999;">${s.details || ''}</td>
          <td style="padding:4px 8px;font-size:10px;color:#BBB;">${new Date(s.timestamp).toLocaleTimeString()}</td>
        </tr>`,
      )
      .join('') || '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; padding: 30px; background: #fff; }
    .header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #1A237E; }
    .logo { font-size: 28px; font-weight: 900; color: #1A237E; letter-spacing: 2px; }
    .logo-sub { font-size: 11px; color: #666; margin-top: 4px; }
    .result-banner {
      text-align: center; padding: 20px; border-radius: 12px; margin-bottom: 20px;
      background: ${statusBg}; border: 2px solid ${statusBorder};
    }
    .result-status { font-size: 32px; font-weight: 900; color: ${statusColor}; }
    .result-reason { font-size: 12px; color: #555; margin-top: 6px; }
    .section { margin-bottom: 18px; }
    .section-title { font-size: 14px; font-weight: 700; color: #1A237E; margin-bottom: 8px; border-bottom: 1px solid #E8EAF6; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; }
    .info-table td { padding: 5px 0; font-size: 12px; border-bottom: 1px solid #F5F5F5; }
    .info-table td:first-child { color: #666; width: 35%; }
    .info-table td:last-child { font-weight: 500; }
    .check-table td { padding: 6px 0; font-size: 12px; border-bottom: 1px solid #F5F5F5; }
    .check-table td:first-child { width: 50%; }
    .check-table td:nth-child(2) { color: #999; font-size: 11px; }
    .check-table td:last-child { text-align: right; width: 60px; }
    .audit-table { font-size: 11px; }
    .audit-table td { border-bottom: 1px solid #F5F5F5; }
    .footer { text-align: center; margin-top: 24px; padding-top: 16px; border-top: 2px solid #E8EAF6; }
    .footer-text { font-size: 10px; color: #999; line-height: 16px; }
    .footer-brand { font-size: 12px; font-weight: 700; color: #1A237E; margin-bottom: 4px; }
    .two-col { display: flex; gap: 20px; }
    .two-col > div { flex: 1; }
    .score-bar { height: 6px; background: #E0E0E0; border-radius: 3px; margin-top: 4px; }
    .score-fill { height: 100%; border-radius: 3px; }
  </style>
</head>
<body>

  <div class="header">
    <div class="logo">KYC-Xflow</div>
    <div class="logo-sub">NFC Passport Verification Report</div>
  </div>

  <div class="result-banner">
    <div class="result-status">${decision.finalStatus}</div>
    <div class="result-reason">${decision.reason}</div>
  </div>

  <div class="two-col">
    <div class="section">
      <div class="section-title">Session Information</div>
      <table class="info-table">
        <tr><td>Session ID</td><td style="font-family:monospace;font-size:10px;">${decision.sessionId}</td></tr>
        <tr><td>Date & Time</td><td>${formattedDate}</td></tr>
        <tr><td>Report Generated</td><td>${new Date().toLocaleString()}</td></tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Passport Data (DG1)</div>
      <table class="info-table">
        <tr><td>Full Name</td><td>${pi ? `${pi.givenNames} ${pi.surname}` : 'N/A'}</td></tr>
        <tr><td>Document No.</td><td>${pi?.documentNumber || 'N/A'}</td></tr>
        <tr><td>Nationality</td><td>${pi?.nationality || 'N/A'}</td></tr>
        <tr><td>Date of Birth</td><td>${pi?.dateOfBirth || 'N/A'}</td></tr>
        <tr><td>Date of Expiry</td><td>${pi?.dateOfExpiry || 'N/A'}</td></tr>
        <tr><td>Sex</td><td>${pi?.sex || 'N/A'}</td></tr>
        <tr><td>Issuing State</td><td>${pi?.issuingState || 'N/A'}</td></tr>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Verification Checks</div>
    <table class="check-table">
      <tr>
        <td>Passport Authentication (BAC + SOD)</td>
        <td>NFC chip cryptographic verification</td>
        <td>${checkIcon(decision.passportAuthentic)}</td>
      </tr>
      <tr>
        <td>Liveness Detection</td>
        <td>Score: ${(livenessResult.score * 100).toFixed(0)}% (${livenessResult.provider})</td>
        <td>${checkIcon(decision.livenessPassed)}</td>
      </tr>
      <tr>
        <td>Face Match</td>
        <td>Score: ${(faceMatchResult.score * 100).toFixed(0)}% (threshold: ${(faceMatchResult.threshold * 100).toFixed(0)}%)</td>
        <td>${checkIcon(decision.faceMatched)}</td>
      </tr>
    </table>
  </div>

  <div class="two-col">
    <div class="section">
      <div class="section-title">Liveness Score</div>
      <div style="font-size:24px;font-weight:900;color:${livenessResult.passed ? '#4CAF50' : '#F44336'};">
        ${(livenessResult.score * 100).toFixed(0)}%
      </div>
      <div class="score-bar">
        <div class="score-fill" style="width:${livenessResult.score * 100}%;background:${livenessResult.passed ? '#4CAF50' : '#F44336'};"></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Face Match Score</div>
      <div style="font-size:24px;font-weight:900;color:${faceMatchResult.matched ? '#4CAF50' : '#F44336'};">
        ${(faceMatchResult.score * 100).toFixed(0)}%
      </div>
      <div class="score-bar">
        <div class="score-fill" style="width:${faceMatchResult.score * 100}%;background:${faceMatchResult.matched ? '#4CAF50' : '#F44336'};"></div>
      </div>
      <div style="font-size:10px;color:#999;margin-top:2px;">Threshold: ${(faceMatchResult.threshold * 100).toFixed(0)}%</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Security Status</div>
    <table class="check-table">
      <tr>
        <td>Passive Authentication (PA)</td>
        <td>Data integrity via digital signatures</td>
        <td>${checkIcon(passportData.isAuthenticated)}</td>
      </tr>
      <tr>
        <td>SOD Signature Verified</td>
        <td>Issuing country signature</td>
        <td>${checkIcon(passportData.sodVerified)}</td>
      </tr>
      <tr>
        <td>Chip Authentication (CA)</td>
        <td>Requires extended hardware</td>
        <td>${checkIcon(passportData.chipAuthDone)}</td>
      </tr>
    </table>
  </div>

  ${auditLog ? `
  <div class="section">
    <div class="section-title">Audit Trail</div>
    <table class="audit-table">
      ${auditRows}
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <div class="footer-brand">KYC-Xflow</div>
    <div class="footer-text">
      This report was generated automatically by KYC-Xflow.<br>
      ICAO 9303 compliant | ISO 14443-4 NFC | GDPR ready<br>
      No raw biometric data is stored. Only verification results and audit logs are retained.
    </div>
  </div>

</body>
</html>`;
  }
}

export default new PDFExportService();
