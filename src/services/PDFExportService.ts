/**
 * ReportExportService — Generates passport scan reports and shares them.
 * Uses RNFS to save a local copy + React Native's built-in Share for sharing.
 * No external storage permissions required.
 */
import {Share} from 'react-native';
import RNFS from 'react-native-fs';
import type {PassportScanResult, PassportChipData, AuditLog} from '../types/kyc';

class PDFExportService {
  /**
   * Build, save locally, and share the scan report.
   * File is saved to app's private Documents directory.
   * Sharing uses the native share sheet (text-based — no FileProvider needed).
   */
  async generateAndShare(
    scanResult: PassportScanResult,
    passportData: PassportChipData,
    auditLog: AuditLog | null,
  ): Promise<void> {
    const report = this.buildTextReport(scanResult, passportData, auditLog);

    // Save to app-private Documents directory (no permission required)
    const fileName = `NFC_Passport_${scanResult.sessionId}.txt`;
    const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
    await RNFS.writeFile(filePath, report, 'utf8');

    // Share via native share sheet as text
    await Share.share(
      {
        title: 'NFC Passport Scan Report',
        message: report,
      },
      {dialogTitle: 'Share Passport Scan Report'},
    );
  }

  /**
   * Save report locally without sharing. Returns the saved file path.
   */
  async saveLocally(
    scanResult: PassportScanResult,
    passportData: PassportChipData,
    auditLog: AuditLog | null,
  ): Promise<string> {
    const report = this.buildTextReport(scanResult, passportData, auditLog);
    const fileName = `NFC_Passport_${scanResult.sessionId}.txt`;
    const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
    await RNFS.writeFile(filePath, report, 'utf8');
    return filePath;
  }

  private buildTextReport(
    scanResult: PassportScanResult,
    passportData: PassportChipData,
    auditLog: AuditLog | null,
  ): string {
    const pi = passportData.personalInfo;
    const date = new Date(scanResult.timestamp);
    const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    const divider = '─'.repeat(48);
    const pass = (v: boolean) => (v ? 'PASS' : 'FAIL');

    const lines: string[] = [
      '================================================',
      '         NFC PASSPORT SCAN REPORT               ',
      '             ICAO 9303 | ISO 14443-4            ',
      '================================================',
      '',
      `STATUS   : ${scanResult.status}`,
      `REASON   : ${scanResult.reason}`,
      `SESSION  : ${scanResult.sessionId}`,
      `DATE     : ${formattedDate}`,
      `GENERATED: ${new Date().toLocaleString()}`,
      '',
      divider,
      'PERSONAL DATA (DG1)',
      divider,
      `Full Name    : ${pi ? `${pi.givenNames} ${pi.surname}` : 'N/A'}`,
      `Document No. : ${pi?.documentNumber || 'N/A'}`,
      `Nationality  : ${pi?.nationality || 'N/A'}`,
      `Date of Birth: ${pi?.dateOfBirth || 'N/A'}`,
      `Date of Expiry: ${pi?.dateOfExpiry || 'N/A'}`,
      `Sex          : ${pi?.sex || 'N/A'}`,
      `Issuing State: ${pi?.issuingState || 'N/A'}`,
      '',
      divider,
      'SECURITY CHECKS',
      divider,
      `BAC Authentication       : ${pass(scanResult.passportAuthentic)}`,
      `Passive Authentication   : ${pass(scanResult.sodVerified)}`,
      `SOD Cert Chain           : N/A (CSCA certs not loaded)`,
      `Chip Authentication (CA) : NOT PERFORMED (requires gov PKI)`,
      '',
      divider,
      'DATA GROUPS',
      divider,
      `DG1 — Personal Data  : ${passportData.personalInfo ? 'EXTRACTED' : 'NOT AVAILABLE'}`,
      `DG2 — Face Image     : ${passportData.faceImageBase64 ? 'EXTRACTED' : 'NOT AVAILABLE'}`,
      `SOD — Security Object: ${scanResult.sodVerified ? 'VERIFIED' : 'UNVERIFIED'}`,
    ];

    if (auditLog && auditLog.steps.length > 0) {
      lines.push('', divider, 'AUDIT TRAIL', divider);
      auditLog.steps.forEach(s => {
        const t = new Date(s.timestamp).toLocaleTimeString();
        const detail = s.details ? ` — ${s.details}` : '';
        lines.push(`[${s.status.toUpperCase().padEnd(7)}] ${t}  ${s.step}${detail}`);
      });
    }

    lines.push(
      '',
      divider,
      'NFC Passport Reader | ICAO 9303 | ISO 14443-4',
      'Data processed in RAM only. Not stored permanently.',
      '================================================',
    );

    return lines.join('\n');
  }
}

export default new PDFExportService();
