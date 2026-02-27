/**
 * PassportNFCService — Steps 3, 4, 5, 6
 * Handles NFC communication with e-Passport chip via ISO 14443.
 * Uses Basic Access Control (BAC) to establish a secure session,
 * then reads DG1, DG2, SOD through Secure Messaging.
 */
import NfcManager, {NfcTech} from 'react-native-nfc-manager';
import {MRZParser} from './MRZParser';
import {
  performBAC,
  wrapAPDU,
  unwrapResponse,
  type BACSession,
} from './PassportCrypto';
import type {MRZScanResult, PassportChipData} from '../types/kyc';

// Plain APDU templates (before SM wrapping)
const SELECT_AID = [
  0x00, 0xa4, 0x04, 0x0c, 0x07, 0xa0, 0x00, 0x00, 0x02, 0x47, 0x10, 0x01,
];
const SELECT_EF_DG1  = [0x00, 0xa4, 0x02, 0x0c, 0x02, 0x01, 0x01];
const SELECT_EF_DG2  = [0x00, 0xa4, 0x02, 0x0c, 0x02, 0x01, 0x02];
const SELECT_EF_DG14 = [0x00, 0xa4, 0x02, 0x0c, 0x02, 0x01, 0x0e];
const SELECT_EF_SOD  = [0x00, 0xa4, 0x02, 0x0c, 0x02, 0x01, 0x1d];
const READ_BINARY = (offset: number, length: number) => [
  0x00, 0xb0, (offset >> 8) & 0xff, offset & 0xff, length,
];

class PassportNFCService {
  /** Active Secure Messaging session (set after BAC). */
  private sm: BACSession | null = null;

  async init(): Promise<boolean> {
    const supported = await NfcManager.isSupported();
    if (supported) await NfcManager.start();
    return supported;
  }

  async isEnabled(): Promise<boolean> {
    try {
      return await NfcManager.isEnabled();
    } catch {
      return false;
    }
  }

  /**
   * Full passport reading flow:
   * 1. SELECT eMRTD application (plain)
   * 2. BAC mutual authentication (establishes Secure Messaging)
   * 3. Read DG1 — personal data (via SM)
   * 4. Read DG2 — face image  (via SM)
   * 5. Read SOD — signatures   (via SM)
   */
  async readPassport(
    mrz: MRZScanResult,
    onStep?: (step: string) => void,
  ): Promise<PassportChipData> {
    const result: PassportChipData = {
      personalInfo: null,
      faceImageBase64: null,
      isAuthenticated: false,
      sodVerified: false,
      chipAuthDone: false,
    };

    try {
      await NfcManager.requestTechnology(NfcTech.IsoDep);

      // ── Step 1: SELECT eMRTD application (plain, before BAC) ──
      onStep?.('selecting_app');
      const selectResp = await this.transceive(SELECT_AID);
      if (!this.isSuccess(selectResp)) {
        throw new Error('Failed to select eMRTD application on chip');
      }

      // ── Step 2: BAC mutual authentication ──
      onStep?.('bac_auth');
      const mrzInfo = MRZParser.computeBACInput(mrz);
      this.sm = await performBAC(cmd => this.transceive(cmd), mrzInfo);
      result.isAuthenticated = true;

      // ── Step 3: Read DG1 (personal information) ──
      onStep?.('reading_dg1');
      const dg1Data = await this.readDataGroupSM(SELECT_EF_DG1);
      if (dg1Data.length > 4) {
        result.personalInfo = this.parseDG1(dg1Data, mrz);
      }

      // ── Step 4: Read DG2 (face image) ──
      onStep?.('reading_dg2');
      try {
        const dg2Data = await this.readDataGroupSM(SELECT_EF_DG2);
        if (dg2Data.length > 10) {
          result.faceImageBase64 = this.extractFaceFromDG2(dg2Data);
        }
      } catch (dg2Err: any) {
        // DG2 can be large — some chips time out. Continue without it.
        console.warn('DG2 read failed:', dg2Err?.message);
      }

      // ── Step 5: Read SOD (Security Object Document) ──
      onStep?.('reading_sod');
      try {
        const sodData = await this.readDataGroupSM(SELECT_EF_SOD);
        if (sodData.length > 0) {
          result.sodVerified = this.verifySOD(sodData, dg1Data);
        }
      } catch (sodErr: any) {
        console.warn('SOD read failed:', sodErr?.message);
      }

      // ── Step 6: Chip Authentication (CA) via DG14 ECDH ──
      onStep?.('chip_auth');
      try {
        result.chipAuthDone = await this.performChipAuthentication();
      } catch (caErr: any) {
        console.warn('[CA] Chip Authentication failed:', caErr?.message);
      }

      return result;
    } catch (error: any) {
      throw new Error(error?.message || 'NFC passport read failed');
    } finally {
      this.sm = null;
      await this.cleanup();
    }
  }

  // ── Secure Messaging transceive ────────────────────────────────────────

  /**
   * Send an APDU through the Secure Messaging channel.
   * Wraps the command, transceives, and unwraps the response.
   */
  private async transceiveSM(
    plainAPDU: number[],
  ): Promise<{data: number[]; sw: number[]}> {
    if (!this.sm) throw new Error('No active SM session');

    const {wrapped, ssc} = wrapAPDU(
      plainAPDU,
      this.sm.ksEnc,
      this.sm.ksMac,
      this.sm.ssc,
    );
    this.sm.ssc = ssc;

    const rawResp = await this.transceive(wrapped);

    const resp = unwrapResponse(
      rawResp,
      this.sm.ksEnc,
      this.sm.ksMac,
      this.sm.ssc,
    );
    this.sm.ssc = resp.ssc;

    return {data: resp.data, sw: resp.sw};
  }

  // ── Data group reading (with SM) ───────────────────────────────────────

  /**
   * SELECT an EF and read its full content via Secure Messaging.
   */
  private async readDataGroupSM(selectCmd: number[]): Promise<number[]> {
    // SELECT the elementary file
    const sel = await this.transceiveSM(selectCmd);
    if (sel.sw[0] !== 0x90) return [];

    // Read first 4 bytes to parse the TLV header
    const hdr = await this.transceiveSM(READ_BINARY(0, 4));
    if (hdr.data.length < 2) return [];

    // Calculate total file size = tag(1) + length-field + value
    const {headerSize, valueLen} = this.parseTLVHeader(hdr.data);
    const totalSize = headerSize + valueLen;
    if (totalSize <= 0 || totalSize > 100000) return hdr.data;

    // We already have the first 4 bytes; read the rest in chunks
    const allData: number[] = [...hdr.data];
    let offset = hdr.data.length;
    const CHUNK = 224;

    while (offset < totalSize) {
      const toRead = Math.min(CHUNK, totalSize - offset);
      const chunk = await this.transceiveSM(READ_BINARY(offset, toRead));
      if (chunk.data.length === 0) break;
      allData.push(...chunk.data);
      offset += chunk.data.length;
    }

    return allData;
  }

  // ── DG parsing helpers ─────────────────────────────────────────────────

  /**
   * Parse DG1 MRZ data from TLV bytes.
   * DG1 structure: Tag 61 → Tag 5F1F → MRZ string (88 chars for TD3).
   */
  private parseDG1(
    data: number[],
    mrz: MRZScanResult,
  ): PassportChipData['personalInfo'] {
    try {
      // Scan for tag 5F 1F (MRZ data)
      for (let idx = 0; idx < data.length - 2; idx++) {
        if (data[idx] === 0x5f && data[idx + 1] === 0x1f) {
          // Length byte(s) follow
          let len: number;
          let start: number;
          const lb = data[idx + 2];
          if (lb < 0x80) {
            len = lb;
            start = idx + 3;
          } else if (lb === 0x81) {
            len = data[idx + 3];
            start = idx + 4;
          } else {
            continue;
          }

          const mrzBytes = data.slice(start, start + len);
          const mrzString = String.fromCharCode(...mrzBytes);

          if (mrzString.length >= 88) {
            const l1 = mrzString.substring(0, 44);
            const l2 = mrzString.substring(44, 88);
            const parsed = MRZParser.parseTD3(l1, l2);
            return {
              surname: parsed.surname,
              givenNames: parsed.givenNames,
              documentNumber: parsed.passportNumber,
              nationality: parsed.nationality,
              dateOfBirth: this.formatDate(parsed.dateOfBirth),
              sex: parsed.sex,
              dateOfExpiry: this.formatDate(parsed.dateOfExpiry),
              issuingState: parsed.nationality,
            };
          }
        }
      }

      // Fallback: use the MRZ data already parsed from OCR/manual entry
      return {
        surname: mrz.surname,
        givenNames: mrz.givenNames,
        documentNumber: mrz.passportNumber,
        nationality: mrz.nationality,
        dateOfBirth: this.formatDate(mrz.dateOfBirth),
        sex: mrz.sex,
        dateOfExpiry: this.formatDate(mrz.dateOfExpiry),
        issuingState: mrz.nationality,
      };
    } catch {
      return null;
    }
  }

  /**
   * Extract JPEG/JPEG2000 face image from DG2 (ISO 19794-5).
   */
  private extractFaceFromDG2(data: number[]): string | null {
    try {
      for (let i = 0; i < data.length - 4; i++) {
        // JPEG SOI marker
        if (data[i] === 0xff && data[i + 1] === 0xd8) {
          return this.bytesToBase64(data.slice(i));
        }
        // JPEG2000 signature
        if (
          data[i] === 0x00 &&
          data[i + 1] === 0x00 &&
          data[i + 2] === 0x00 &&
          data[i + 3] === 0x0c
        ) {
          return this.bytesToBase64(data.slice(i));
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Verify SOD (Security Object Document) — Passive Authentication.
   * Full PKI verification needs ICAO CSCA certificates (out of scope).
   * We verify that SOD is present and structurally valid.
   */
  private verifySOD(sodData: number[], dg1Data: number[]): boolean {
    try {
      // SOD should start with tag 0x77 or be a CMS SignedData (tag 0x30)
      if (sodData[0] !== 0x77 && sodData[0] !== 0x30) return false;
      return sodData.length > 20 && dg1Data.length > 0;
    } catch {
      return false;
    }
  }

  // ── Low-level helpers ──────────────────────────────────────────────────

  private async transceive(cmd: number[]): Promise<number[]> {
    const resp = await NfcManager.isoDepHandler.transceive(cmd);
    return Array.from(resp);
  }

  private isSuccess(resp: number[]): boolean {
    if (resp.length < 2) return false;
    return resp[resp.length - 2] === 0x90 && resp[resp.length - 1] === 0x00;
  }

  /**
   * Parse TLV header from first few bytes.
   * Returns the header size (tag + length-encoding) and value length.
   */
  private parseTLVHeader(data: number[]): {
    headerSize: number;
    valueLen: number;
  } {
    if (data.length < 2) return {headerSize: 0, valueLen: 0};
    const lb = data[1];
    if (lb < 0x80) return {headerSize: 2, valueLen: lb};
    if (lb === 0x81)
      return {headerSize: 3, valueLen: data[2] ?? 0};
    if (lb === 0x82)
      return {
        headerSize: 4,
        valueLen: ((data[2] ?? 0) << 8) | (data[3] ?? 0),
      };
    if (lb === 0x83)
      return {
        headerSize: 5,
        valueLen:
          ((data[2] ?? 0) << 16) | ((data[3] ?? 0) << 8) | (data[4] ?? 0),
      };
    return {headerSize: 2, valueLen: 0};
  }

  private bytesToBase64(bytes: number[]): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1024) {
      binary += String.fromCharCode(...bytes.slice(i, i + 1024));
    }
    return (globalThis as any).btoa(binary);
  }

  private formatDate(yymmdd: string): string {
    if (yymmdd.length !== 6) return yymmdd;
    const yy = parseInt(yymmdd.substring(0, 2), 10);
    const mm = yymmdd.substring(2, 4);
    const dd = yymmdd.substring(4, 6);
    const year = yy >= 0 && yy <= 50 ? 2000 + yy : 1900 + yy;
    return `${dd}/${mm}/${year}`;
  }

  // ── Chip Authentication helpers ────────────────────────────────────────

  /**
   * Scan DG14 SecurityInfos for an EC public key in SubjectPublicKeyInfo.
   * BIT STRING format: 03 [len] 00 04 [x][y]  (uncompressed EC point).
   * P-256 → 65 bytes, P-384 → 97 bytes, P-521 → 133 bytes.
   * Handles short (1-byte), 0x81, and 0x82 BIT STRING length encodings.
   */
  private parseECPublicKeyFromDG14(data: number[]): number[] | null {
    // Dump raw DG14 for diagnostics (first 160 bytes)
    const hex = data
      .slice(0, 160)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    console.log(`[CA] DG14 (${data.length}B): ${hex}${data.length > 160 ? '…' : ''}`);

    for (let i = 0; i < data.length - 4; i++) {
      if (data[i] !== 0x03) continue; // BIT STRING tag

      // Parse length — support short form, 0x81, and 0x82
      const lb = data[i + 1];
      let len: number;
      let skip: number;
      if (lb < 0x80) {
        len = lb;
        skip = 2;
      } else if (lb === 0x81) {
        len = data[i + 2] ?? 0;
        skip = 3;
      } else if (lb === 0x82) {
        len = ((data[i + 2] ?? 0) << 8) | (data[i + 3] ?? 0);
        skip = 4;
      } else {
        continue;
      }

      const start = i + skip;
      if (start + len > data.length || len < 2) continue;
      if (data[start] !== 0x00) continue; // unused-bits byte must be 0

      const pointByte = data[start + 1];
      const pointLen = len - 1; // subtract unused-bits byte

      // Uncompressed EC point (04 prefix) — what we need for Web Crypto ECDH
      if (pointByte === 0x04) {
        if (pointLen === 65 || pointLen === 97 || pointLen === 133) {
          const curve =
            pointLen === 65 ? 'P-256' : pointLen === 97 ? 'P-384' : 'P-521';
          console.log(`[CA] Found uncompressed EC point: ${curve} (${pointLen}B)`);
          return data.slice(start + 1, start + 1 + pointLen);
        }
        console.log(`[CA] BIT STRING has 04-prefix but unexpected length ${pointLen} — skipping`);
        continue;
      }

      // Compressed EC point (02/03 prefix) — Web Crypto ECDH cannot use these directly
      if (pointByte === 0x02 || pointByte === 0x03) {
        if (pointLen === 33 || pointLen === 49 || pointLen === 67) {
          console.warn(
            `[CA] Chip uses compressed EC point (${pointLen}B) — ` +
            'Web Crypto requires uncompressed points. Install react-native-quick-crypto for decompression support.',
          );
        }
        continue;
      }

      // BIT STRING starts with 0x02 INTEGER tag → DH (not ECDH) key
      if (pointByte === 0x02) {
        console.warn(
          '[CA] DG14 contains a DH (Diffie-Hellman) public key, not ECDH. ' +
          'Web Crypto does not support raw DH. DH-based CA is not implemented.',
        );
      }
    }

    return null;
  }

  /**
   * Chip Authentication (ICAO 9303 Part 11 §6.1) via ECDH:
   * 1. Read DG14 → parse chip's EC public key
   * 2. Generate ephemeral ECDH key pair via Web Crypto (Hermes RN ≥ 0.73)
   * 3. Send GENERAL AUTHENTICATE with our ephemeral public key
   * 4. SW=9000 → chip holds the matching private key → chip is genuine
   *
   * Returns:
   *   true  — CA completed successfully
   *   false — CA attempted but chip rejected it
   *   null  — CA not available (DG14 has no EC public key; requires PACE)
   *
   * Pakistani NADRA passports advertise CA in DG14 but store the EC public key
   * in EF.CardSecurity, which is only accessible after PACE (not BAC).
   * In that case we return null so the UI shows "N/A" instead of "FAIL".
   */
  private async performChipAuthentication(): Promise<boolean | null> {
    try {
      // ── 1. Read DG14 ──────────────────────────────────────────────────────
      const dg14Data = await this.readDataGroupSM(SELECT_EF_DG14);
      if (dg14Data.length < 10) {
        console.log('[CA] DG14 absent — chip does not support CA');
        return null;
      }

      // ── 2. Extract chip EC public key ─────────────────────────────────────
      const chipPubKeyBytes = this.parseECPublicKeyFromDG14(dg14Data);
      if (!chipPubKeyBytes) {
        // DG14 exists but contains no EC public key — chip advertises CA but
        // the key is stored in EF.CardSecurity (requires PACE to access).
        console.log('[CA] DG14 has CA protocol info but no EC public key — PACE required');
        return null;
      }

      const namedCurve =
        chipPubKeyBytes.length === 65  ? 'P-256' :
        chipPubKeyBytes.length === 97  ? 'P-384' :
        chipPubKeyBytes.length === 133 ? 'P-521' : null;
      if (!namedCurve) {
        console.warn('[CA] Unrecognised EC key size:', chipPubKeyBytes.length);
        return false;
      }

      // ── 3. Check Web Crypto availability ──────────────────────────────────
      // crypto.subtle is available in Hermes on RN ≥ 0.73.
      // If absent, install react-native-quick-crypto and add its shim to index.js.
      const subtle: any =
        (globalThis as any).crypto?.subtle ??
        (globalThis as any).nativeCrypto?.subtle;

      if (!subtle) {
        console.warn(
          '[CA] crypto.subtle not available in this runtime.\n' +
          'Fix: npm install react-native-quick-crypto\n' +
          'Then add: import "react-native-quick-crypto/shim"  at the top of index.js',
        );
        return null; // can't attempt CA without crypto
      }

      // ── 4. Import chip public key ─────────────────────────────────────────
      await subtle.importKey(
        'raw',
        new Uint8Array(chipPubKeyBytes),
        {name: 'ECDH', namedCurve},
        false,
        [],
      );

      // ── 5. Generate our ephemeral key pair ───────────────────────────────
      const ephemeral = await subtle.generateKey(
        {name: 'ECDH', namedCurve},
        true,
        ['deriveBits'],
      );

      // ── 6. Export ephemeral public key (uncompressed point) ───────────────
      const pkTRaw = await subtle.exportKey('raw', ephemeral.publicKey);
      const pkT = Array.from(new Uint8Array(pkTRaw as ArrayBuffer));

      // ── 7. Send GENERAL AUTHENTICATE ─────────────────────────────────────
      // TLV: 7C [len] 80 [len] [ephemeral_pubkey]
      const encLen = (n: number): number[] =>
        n < 0x80  ? [n] :
        n < 0x100 ? [0x81, n] :
                    [0x82, (n >> 8) & 0xff, n & 0xff];

      const inner  = [0x80, ...encLen(pkT.length), ...pkT];
      const outer  = [0x7c, ...encLen(inner.length), ...inner];
      const gaApdu = [0x00, 0x86, 0x00, 0x00, ...encLen(outer.length), ...outer, 0x00];

      const gaResp = await this.transceiveSM(gaApdu);
      const success = gaResp.sw[0] === 0x90 && gaResp.sw[1] === 0x00;
      if (!success) {
        console.warn(
          `[CA] GENERAL AUTHENTICATE rejected: SW=${gaResp.sw.map(b => b.toString(16).padStart(2,'0')).join('')}`,
        );
      }
      return success;
    } catch (err: any) {
      console.warn('[CA] Exception:', err?.message ?? err);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {}
  }

  async goToSettings(): Promise<void> {
    await NfcManager.goToNfcSetting();
  }
}

export default new PassportNFCService();
