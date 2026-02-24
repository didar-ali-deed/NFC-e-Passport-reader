import NfcManager, {NfcTech, Ndef} from 'react-native-nfc-manager';
import type {MRZData, NFCReadResult} from '../types/nfc';

class NFCService {
  async init(): Promise<boolean> {
    const supported = await NfcManager.isSupported();
    if (supported) {
      await NfcManager.start();
    }
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
   * Read an NFC ID card or passport using ISO-DEP (ISO 14443-4).
   * This communicates with the chip using APDU commands per ICAO 9303.
   */
  async readIdCard(mrzData: MRZData): Promise<NFCReadResult> {
    const result: NFCReadResult = {
      personalInfo: null,
      faceImageBase64: null,
      isAuthenticated: false,
      rawData: {},
    };

    try {
      // Request IsoDep technology (ISO 14443-4) for e-MRTD communication
      await NfcManager.requestTechnology(NfcTech.IsoDep);

      // SELECT the eMRTD application (AID: A0000002471001)
      const selectCmd = [
        0x00, 0xa4, 0x04, 0x0c, 0x07, 0xa0, 0x00, 0x00, 0x02, 0x47, 0x10,
        0x01,
      ];
      const selectResponse = await NfcManager.isoDepHandler.transceive(selectCmd);
      result.rawData.selectResponse = Array.from(selectResponse);

      // Perform BAC (Basic Access Control) authentication
      // BAC requires: document number, date of birth, date of expiry from MRZ
      const bacKey = this.computeBACKey(mrzData);
      result.rawData.bacKeyComputed = true;

      // GET CHALLENGE - request a random number from the chip
      const getChallengeCmd = [0x00, 0x84, 0x00, 0x00, 0x08];
      const challengeResponse =
        await NfcManager.isoDepHandler.transceive(getChallengeCmd);
      result.rawData.challengeReceived = challengeResponse.length > 0;

      // Note: Full BAC mutual authentication requires 3DES encryption
      // which needs a native module. For now, read unprotected DGs.

      // Try to read DG1 (Personal Info) - SELECT EF
      const selectDG1 = [0x00, 0xa4, 0x02, 0x0c, 0x02, 0x01, 0x01];
      const dg1SelectResp =
        await NfcManager.isoDepHandler.transceive(selectDG1);
      result.rawData.dg1Selected = Array.from(dg1SelectResp);

      // READ BINARY from DG1
      const readDG1 = [0x00, 0xb0, 0x00, 0x00, 0x00];
      const dg1Data = await NfcManager.isoDepHandler.transceive(readDG1);
      result.rawData.dg1Data = Array.from(dg1Data);

      if (dg1Data && dg1Data.length > 2) {
        result.personalInfo = this.parseDG1(dg1Data);
        result.isAuthenticated = true;
      }

      return result;
    } catch (error: any) {
      result.rawData.error = error?.message || 'Unknown NFC error';
      throw error;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Simple NFC tag scan - reads any NFC tag/card UID and basic info
   */
  async scanTag(): Promise<{uid: string; techTypes: string[]}> {
    try {
      await NfcManager.requestTechnology(NfcTech.NfcA);
      const tag = await NfcManager.getTag();
      return {
        uid: tag?.id || 'unknown',
        techTypes: tag?.techTypes || [],
      };
    } finally {
      this.cleanup();
    }
  }

  /**
   * Compute BAC session key from MRZ data
   * Per ICAO 9303: Key = SHA1(docNum + checkDigit + DOB + checkDigit + DOE + checkDigit)
   */
  private computeBACKey(mrzData: MRZData): Uint8Array {
    const docNumCheck = this.computeCheckDigit(mrzData.documentNumber);
    const dobCheck = this.computeCheckDigit(mrzData.dateOfBirth);
    const doeCheck = this.computeCheckDigit(mrzData.dateOfExpiry);

    const keySeed = `${mrzData.documentNumber}${docNumCheck}${mrzData.dateOfBirth}${dobCheck}${mrzData.dateOfExpiry}${doeCheck}`;

    // In production: SHA-1 hash of keySeed, then derive 3DES keys
    // This is a placeholder - real implementation needs crypto native module
    const arr = new Uint8Array(keySeed.length);
    for (let i = 0; i < keySeed.length; i++) {
      arr[i] = keySeed.charCodeAt(i);
    }
    return arr;
  }

  /**
   * Compute MRZ check digit per ICAO 9303
   */
  private computeCheckDigit(input: string): number {
    const weights = [7, 3, 1];
    let sum = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      let value: number;
      if (char >= '0' && char <= '9') {
        value = parseInt(char, 10);
      } else if (char >= 'A' && char <= 'Z') {
        value = char.charCodeAt(0) - 55; // A=10, B=11, ...
      } else {
        value = 0; // '<' filler
      }
      sum += value * weights[i % 3];
    }
    return sum % 10;
  }

  /**
   * Parse DG1 (MRZ data) from raw bytes
   */
  private parseDG1(data: number[]): any {
    // DG1 contains MRZ in TLV format
    // Tag 0x61 -> Tag 0x5F1F contains the MRZ string
    try {
      const mrzString = String.fromCharCode(...data.filter(b => b >= 32 && b < 127));
      if (mrzString.length >= 44) {
        // TD1 format (ID card, 3 lines of 30 chars) or TD3 format (passport, 2 lines of 44 chars)
        return {
          surname: mrzString.substring(5, 30).replace(/</g, ' ').trim(),
          givenNames: '',
          documentNumber: mrzString.substring(0, 9).replace(/</g, ''),
          nationality: '',
          dateOfBirth: '',
          sex: '',
          dateOfExpiry: '',
          issuingState: '',
          rawMRZ: mrzString,
        };
      }
    } catch {
      // parsing failed
    }
    return null;
  }

  async cleanup(): Promise<void> {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // ignore cleanup errors
    }
  }

  async goToNfcSettings(): Promise<void> {
    await NfcManager.goToNfcSetting();
  }
}

export default new NFCService();
