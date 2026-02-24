/**
 * MRZParser — Step 2/3
 * Parses raw MRZ text (from OCR) into structured fields.
 * Also computes BAC key material per ICAO 9303.
 */
import type {MRZScanResult} from '../types/kyc';

export class MRZParser {
  /**
   * Parse TD3 format MRZ (passport — 2 lines × 44 chars)
   * Line 1: P<ISSNAME<<GIVEN<<<<<<<<<<<<<<<<<<<<<<<<<<
   * Line 2: DOCNUM0CHECKNAT8DOBCHEXA8DOECHEKOOO<<<<<<CHECK
   */
  static parseTD3(line1: string, line2: string): MRZScanResult {
    // Pad/trim to correct length
    const l1 = line1.padEnd(44, '<').substring(0, 44).toUpperCase();
    const l2 = line2.padEnd(44, '<').substring(0, 44).toUpperCase();

    // Line 1 parsing
    // const docType = l1.substring(0, 2);      // P<
    const issuingState = l1.substring(2, 5);   // PAK
    const nameField = l1.substring(5, 44);     // SURNAME<<GIVEN<<<<

    const nameParts = nameField.split('<<');
    const surname = (nameParts[0] || '').replace(/</g, ' ').trim();
    const givenNames = (nameParts[1] || '').replace(/</g, ' ').trim();

    // Line 2 parsing
    const passportNumber = l2.substring(0, 9).replace(/</g, '');
    const nationality = l2.substring(10, 13);
    const dateOfBirth = l2.substring(13, 19);
    const sex = l2.substring(20, 21);
    const dateOfExpiry = l2.substring(21, 27);

    return {
      passportNumber,
      dateOfBirth,
      dateOfExpiry,
      surname,
      givenNames,
      nationality,
      sex,
      rawMRZ: l1 + '\n' + l2,
    };
  }

  /**
   * Parse TD1 format MRZ (ID card — 3 lines × 30 chars)
   */
  static parseTD1(line1: string, line2: string, line3: string): MRZScanResult {
    const l1 = line1.padEnd(30, '<').substring(0, 30).toUpperCase();
    const l2 = line2.padEnd(30, '<').substring(0, 30).toUpperCase();
    const l3 = line3.padEnd(30, '<').substring(0, 30).toUpperCase();

    const docNum = l1.substring(5, 14).replace(/</g, '');
    const dateOfBirth = l2.substring(0, 6);
    const sex = l2.substring(7, 8);
    const dateOfExpiry = l2.substring(8, 14);
    const nationality = l2.substring(15, 18);

    const nameParts = l3.split('<<');
    const surname = (nameParts[0] || '').replace(/</g, ' ').trim();
    const givenNames = (nameParts[1] || '').replace(/</g, ' ').trim();

    return {
      passportNumber: docNum,
      dateOfBirth,
      dateOfExpiry,
      surname,
      givenNames,
      nationality,
      sex,
      rawMRZ: l1 + '\n' + l2 + '\n' + l3,
    };
  }

  /**
   * Compute MRZ check digit per ICAO 9303 Part 3
   */
  static computeCheckDigit(input: string): number {
    const weights = [7, 3, 1];
    let sum = 0;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i].toUpperCase();
      let val: number;
      if (ch >= '0' && ch <= '9') {
        val = parseInt(ch, 10);
      } else if (ch >= 'A' && ch <= 'Z') {
        val = ch.charCodeAt(0) - 55;
      } else {
        val = 0; // '<' filler
      }
      sum += val * weights[i % 3];
    }
    return sum % 10;
  }

  /**
   * Compute BAC key seed from MRZ data (Step 3)
   * Per ICAO 9303-11 §9.7.1
   * keySeed = SHA1(docNum+check + DOB+check + DOE+check)
   * Returns hex string of the seed (SHA1 not available in RN without native module,
   * so we return the concatenated input for native layer to hash)
   */
  static computeBACInput(mrz: MRZScanResult): string {
    const docCheck = this.computeCheckDigit(mrz.passportNumber);
    const dobCheck = this.computeCheckDigit(mrz.dateOfBirth);
    const doeCheck = this.computeCheckDigit(mrz.dateOfExpiry);
    // This string goes to the native NFC module for SHA-1 + 3DES key derivation
    return `${mrz.passportNumber}${docCheck}${mrz.dateOfBirth}${dobCheck}${mrz.dateOfExpiry}${doeCheck}`;
  }

  /**
   * Validate MRZ line check digits
   */
  static validateCheckDigits(line2: string): boolean {
    try {
      const l2 = line2.padEnd(44, '<').substring(0, 44);
      const docCheck = parseInt(l2[9], 10);
      const dobCheck = parseInt(l2[19], 10);
      const doeCheck = parseInt(l2[27], 10);
      return (
        this.computeCheckDigit(l2.substring(0, 9)) === docCheck &&
        this.computeCheckDigit(l2.substring(13, 19)) === dobCheck &&
        this.computeCheckDigit(l2.substring(21, 27)) === doeCheck
      );
    } catch {
      return false;
    }
  }
}
