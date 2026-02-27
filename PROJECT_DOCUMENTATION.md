# NFC e-Passport Reader — Project Documentation

> **Built entirely using Claude AI (Anthropic)**
> Platform: React Native (Android) | Standard: ICAO 9303 | Language: TypeScript

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technologies Used](#2-technologies-used)
3. [System Architecture](#3-system-architecture)
4. [Scan Pipeline Flow](#4-scan-pipeline-flow)
5. [Methodology](#5-methodology)
6. [NFC Passport Reading — How It Works](#6-nfc-passport-reading--how-it-works)
7. [Cryptographic Implementation](#7-cryptographic-implementation)
8. [MRZ Scanning & OCR](#8-mrz-scanning--ocr)
9. [Security Model](#9-security-model)
10. [Data Flow Between Screens](#10-data-flow-between-screens)
11. [Data Handling & Privacy](#11-data-handling--privacy)
12. [Android Configuration](#12-android-configuration)
13. [APDU Commands Reference](#13-apdu-commands-reference)
14. [PDF Export](#14-pdf-export)
15. [Limitations](#15-limitations)
16. [Future Work](#16-future-work)

---

## 1. Project Overview

This is an **NFC e-Passport Reader** that reads NFC-enabled electronic passports (e-Passports) following the **ICAO 9303 international standard**. The app performs passport chip reading through:

- **Passport MRZ scanning** (camera OCR or manual entry)
- **NFC chip reading** with cryptographic authentication (BAC + Secure Messaging)
- **Data Group extraction** — personal data (DG1), face image (DG2), digital signatures (SOD)
- **Scan report export** as a shareable text file

The app reads, verifies, and displays the chip data with a **SUCCESS** or **FAILED** scan result, and optionally exports a detailed report.

**Target Documents:** ICAO-compliant e-Passports (TD3 format), with TD1 (ID card) parser included
**App Display Name:** `NFC Passport Reader`
**App Package:** `com.nfcidcardreader`
**Min Android:** 7.0 (API 24)

---

## 2. Technologies Used

### Core Framework

| Technology | Version | Purpose |
|-----------|---------|---------|
| React Native | 0.84.0 | Cross-platform mobile framework |
| React | 19.2.3 | UI component library |
| TypeScript | 5.8.3 | Type-safe JavaScript |
| Hermes | Built-in | JavaScript engine for React Native |

### NFC & Passport Communication

| Technology | Version | Purpose |
|-----------|---------|---------|
| react-native-nfc-manager | 3.17.2 | NFC hardware access (IsoDep / ISO 14443-4) |
| crypto-js | 4.2.0 | SHA-1, 3DES-CBC, DES-ECB for ICAO 9303 cryptography |

### Camera & OCR

| Technology | Version | Purpose |
|-----------|---------|---------|
| react-native-vision-camera | 4.7.3 | High-performance camera for MRZ scanning |
| @react-native-ml-kit/text-recognition | 2.0.0 | Google ML Kit OCR for reading MRZ text |

### Navigation & UI

| Technology | Version | Purpose |
|-----------|---------|---------|
| @react-navigation/native | 7.1.28 | Screen navigation framework |
| @react-navigation/native-stack | 7.13.0 | Native stack navigator |
| react-native-safe-area-context | 5.6.2 | Safe area insets handling |
| react-native-screens | 4.23.0 | Native screen optimization |

### Utilities

| Technology | Version | Purpose |
|-----------|---------|---------|
| react-native-fs | 2.20.0 | File system access for report export |

### Build & Development

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | >= 22.11.0 | Runtime environment |
| Android SDK | 36 | Android build tools |
| Android NDK | 27.1.12297006 | Native Development Kit |
| Babel | 7.25.x | JavaScript transpiler |
| Jest | 29.6.3 | Testing framework |
| ESLint | 8.19.0 | Code linting |

---

## 3. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
│  HomeScreen → ConsentScreen → MRZScanner → NFCScan →        │
│  PassportResultScreen                                        │
├─────────────────────────────────────────────────────────────┤
│                      SERVICE LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  MRZParser    │  │ SessionSvc   │  │ PDFExportSvc    │   │
│  │  (OCR Parse)  │  │ (Lifecycle)  │  │ (Report Export) │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ PassportNFC   │  │ PassportCryp │                         │
│  │ (Chip I/O)    │  │ (BAC + SM)   │                         │
│  └──────────────┘  └──────────────┘                         │
├─────────────────────────────────────────────────────────────┤
│                     HARDWARE LAYER                           │
│  NFC Antenna (IsoDep)  │  Back Camera (MRZ OCR)             │
└─────────────────────────────────────────────────────────────┘
```

### Service Responsibilities

| Service | File | Responsibility |
|---------|------|---------------|
| **PassportCrypto** | `PassportCrypto.ts` | ICAO 9303 cryptography: BAC key derivation (SHA-1 → 3DES), Secure Messaging APDU wrap/unwrap, ISO 9797-1 Retail MAC, Passive Authentication (ASN.1/CMS SOD parsing, DG hash verification) |
| **PassportNFCService** | `PassportNFCService.ts` | NFC chip communication: SELECT eMRTD app, BAC mutual authentication, read DG1/DG2/DG14/SOD via 224-byte chunked reads, invoke Passive Authentication |
| **MRZParser** | `MRZParser.ts` | Parse TD3 (passport) and TD1 (ID card) MRZ formats, ICAO check digit validation, BAC key material computation |
| **SessionService** | `SessionService.ts` | Session lifecycle: session creation, consent recording, status tracking (`SUCCESS`/`FAILED`), audit logging. Session IDs prefixed `NFC_` |
| **PDFExportService** | `PDFExportService.ts` | Generate and share passport scan report (personal info, security checks, audit trail) via native share sheet |

---

## 4. Scan Pipeline Flow

```
┌──────────────────────────────────────────────────────────────┐
│ Step 1: CONSENT                                              │
│ User accepts privacy terms + data processing consent         │
│ Session ID generated: NFC_YYYY_MMDD_HHMMSS                  │
└─────────────────────┬────────────────────────────────────────┘
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 2: MRZ SCANNING                                         │
│ Camera OCR (ML Kit) or manual entry of 2 × 44-char MRZ lines│
│ OCR character correction: O↔0, I↔1, B↔8, S↔5, Z↔2          │
│ Check digit validation per ICAO 9303                         │
│ Extract: passport number, DOB, DOE, name, nationality, sex  │
└─────────────────────┬────────────────────────────────────────┘
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 3: NFC CHIP READING                                     │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ 3a. SELECT eMRTD Application (AID: A0000002471001)      │  │
│ │ 3b. BAC Mutual Authentication (3DES key exchange)       │  │
│ │ 3c. Read DG1 — Personal Data (via Secure Messaging)     │  │
│ │ 3d. Read DG2 — Face Image JPEG (via Secure Messaging)   │  │
│ │ 3e. Read SOD — Digital Signatures (via Secure Messaging)  │  │
│ │ 3f. Passive Authentication — DG1 hash verified vs SOD     │  │
│ └─────────────────────────────────────────────────────────┘  │
│ All communication after BAC is encrypted with 3DES           │
└─────────────────────┬────────────────────────────────────────┘
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 4: RESULT & EXPORT                                      │
│ Display: personal info, face photo, SOD verification status  │
│ Scan result: SUCCESS or FAILED (with failure reason)         │
│ Audit log saved to session history                           │
│ Optional: export scan report via native share sheet          │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Methodology

### Development Approach

The entire application was designed and developed using **Claude AI (Anthropic)** as the development partner. Claude handled:

- **Architecture design** — Service-layer separation, screen flow, type system
- **Cryptographic implementation** — Full ICAO 9303 BAC + Secure Messaging from scratch using crypto-js
- **NFC protocol implementation** — APDU command construction, TLV parsing, chunked data reading
- **OCR processing** — MRZ extraction from camera frames, character correction algorithms
- **UI/UX development** — All screens, animations, progress indicators
- **Debugging** — Real-device testing with e-Passports, fixing OCR misreads, date formatting bugs, NFC detection issues

### Standards Followed

| Standard | Area | Usage |
|----------|------|-------|
| **ICAO 9303** | Passport specification | MRZ format (TD1/TD3), check digits, data groups, BAC protocol, Passive Authentication |
| **ISO 14443-4** | NFC communication | IsoDep technology for e-MRTD chip access |
| **ISO 7816-4** | Smart card commands | APDU command/response format (CLA, INS, P1, P2, Lc, Le) |
| **ISO 9797-1** | Message authentication | Retail MAC (Algorithm 3) with DES/3DES |
| **ISO 19794-5** | Biometric data | Face image format in DG2 (JPEG/JPEG2000) |
| **CMS / ASN.1 DER** | Cryptographic syntax | SOD (Security Object Document) parsing for Passive Authentication |

### Software Design Patterns

- **Service Layer Pattern** — Business logic isolated in singleton services
- **Screen-based Architecture** — Each scan step is a separate screen component
- **Callback Pattern** — NFC progress reporting via `onStep` callbacks
- **State Machine** — Session status tracks progress (`pending` → `SUCCESS`/`FAILED`)
- **Graceful Degradation** — DG2/SOD read failures don't crash the pipeline
- **Retry Pattern** — NFC read allows multiple retry attempts

---

## 6. NFC Passport Reading — How It Works

### What Happens When Phone Touches Passport

```
Phone (NFC Antenna)  ←→  Passport Chip (ISO 14443-4)
        │                        │
   1. SELECT eMRTD app     → chip responds OK
   2. GET CHALLENGE        → chip sends 8 random bytes
   3. EXTERNAL AUTH        → phone proves it knows MRZ
      (encrypted with      ← chip verifies + sends session keys
       derived 3DES keys)
   4. READ DG1 (encrypted) → chip sends personal data
   5. READ DG2 (encrypted) → chip sends face photo
   6. READ SOD (encrypted) → chip sends digital signatures
```

### BAC (Basic Access Control) — The "Password"

BAC ensures only someone who has physically seen the passport MRZ can read the chip. The password is derived from:

```
Input:  Passport Number + Date of Birth + Date of Expiry
        (from MRZ line 2)

Process:
  1. Concatenate: "ZN18532519040313031208" (docNum+check+DOB+check+DOE+check)
  2. SHA-1 hash → take first 16 bytes as key seed
  3. Derive encryption key (ksEnc) using counter=1
  4. Derive MAC key (ksMac) using counter=2
  5. Adjust DES parity on all key bytes

Mutual Authentication:
  1. Phone requests 8-byte challenge from chip (GET CHALLENGE)
  2. Phone generates its own 8-byte random
  3. Phone encrypts: [RND.IFD + RND.ICC + Key material] with 3DES
  4. Phone sends encrypted block to chip (EXTERNAL AUTHENTICATE)
  5. Chip decrypts, verifies RND.ICC matches, sends back encrypted response
  6. Phone verifies chip's response → mutual trust established
  7. Session keys (ksEnc, ksMac, SSC) derived from shared key material
```

### Secure Messaging — Encrypted Communication

After BAC, every APDU command is wrapped with encryption and a MAC:

```
Plain APDU:   [00 B0 00 00 E0]  (READ BINARY at offset 0, 224 bytes)

Wrapped APDU: [0C B0 00 00 Lc  87 xx {encrypted data}  97 01 E0  8E 08 {MAC}  00]
                │                │                        │          │
                CLA=0x0C         encrypted payload         expected   authentication
                (protected)                                length     code (8 bytes)
```

### Data Groups Read

| Group | Content | Size | Format |
|-------|---------|------|--------|
| **DG1** | Personal data (MRZ) | ~200 bytes | TLV: tag 0x5F1F contains 88-char MRZ string |
| **DG2** | Face photograph | 5–50 KB | JPEG or JPEG2000 inside TLV structure |
| **DG14** | Chip Authentication info | ~100–300 bytes | ASN.1 SecurityInfos — EC public key for CA |
| **SOD** | Digital signatures | 1–5 KB | CMS SignedData (ASN.1/DER) — LDSSecurityObject with SHA hashes of all DGs |

Reading uses **224-byte chunks** via READ BINARY commands, reassembled into complete data groups.

### Date Formatting

Year cutoff rule in `PassportNFCService.ts`:
- `00–50` → 2000s (e.g., `30` → `2030`)
- `51–99` → 1900s (e.g., `85` → `1985`)

---

## 7. Cryptographic Implementation

All cryptography is implemented in JavaScript using the `crypto-js` library (no native modules required).

### Algorithms Used

| Algorithm | Library Function | Purpose |
|-----------|-----------------|---------|
| **SHA-1** | `CryptoJS.SHA1()` | BAC key seed derivation from MRZ material |
| **SHA-256** | `CryptoJS.SHA256()` | Passive Authentication DG hash verification (modern passports) |
| **SHA-384** | `CryptoJS.SHA384()` | Passive Authentication DG hash verification (some passports) |
| **SHA-512** | `CryptoJS.SHA512()` | Passive Authentication DG hash verification (some passports) |
| **3DES-CBC** | `CryptoJS.TripleDES` | Encrypt/decrypt Secure Messaging data (16-byte 2-key: K1\|\|K2\|\|K1) |
| **DES-ECB** | `CryptoJS.DES` | Single-DES for Retail MAC inner computation |
| **ISO 9797-1 Retail MAC** | Custom implementation | Message authentication: CBC-MAC with Ka, final DES-decrypt-encrypt with Kb |
| **ISO 9797-1 Padding Method 2** | Custom implementation | Pad data with 0x80 followed by 0x00s to 8-byte boundary |

### Key Derivation Process

```
MRZ Key Material (24 chars)
    │
    ▼ SHA-1
Key Seed (16 bytes = first 16 bytes of SHA-1 output)
    │
    ├── + counter 0x00000001 → SHA-1 → first 16 bytes → adjust parity → ksEnc
    │
    └── + counter 0x00000002 → SHA-1 → first 16 bytes → adjust parity → ksMac
```

### Passive Authentication (PA)

Passive Authentication verifies that the data groups read from the chip match the hashes stored in the SOD. Implemented in `verifyPassiveAuthentication()` in `PassportCrypto.ts`.

```
SOD (CMS SignedData — ASN.1/DER)
  └── ContentInfo
        └── [0] EXPLICIT → SignedData
              └── encapContentInfo
                    └── [0] EXPLICIT → OCTET STRING
                          └── LDSSecurityObject
                                ├── hashAlgorithm OID  (SHA-1 / SHA-256 / SHA-384 / SHA-512)
                                └── dataGroupHashValues
                                      ├── DataGroupHash { DG1 number → hash bytes }
                                      ├── DataGroupHash { DG2 number → hash bytes }
                                      └── ...
```

**Verification steps:**

```
1. Strip outer EF.SOD tag 0x77 (if present)
2. Walk ContentInfo → SignedData → encapContentInfo → OCTET STRING
3. Parse LDSSecurityObject → detect hash algorithm from OID
4. Compute hash(dg1RawBytes) using detected algorithm
5. Compare against DG1 hash stored in SOD
6. sodVerified = true only if hashes match exactly
```

**OIDs recognised:**

| OID | Algorithm | Hex |
|-----|-----------|-----|
| 1.3.14.3.2.26 | SHA-1 | `2b 0e 03 02 1a` |
| 2.16.840.1.101.3.4.2.1 | SHA-256 | `60 86 48 01 65 03 04 02 01` |
| 2.16.840.1.101.3.4.2.2 | SHA-384 | `60 86 48 01 65 03 04 02 02` |
| 2.16.840.1.101.3.4.2.3 | SHA-512 | `60 86 48 01 65 03 04 02 03` |

**What PA proves vs. what it does not:**

| Check | Done | Note |
|-------|------|------|
| DG1 bytes match SOD hash | ✅ Yes | Real cryptographic comparison |
| DG2 bytes match SOD hash | ✅ Yes | If DG2 was read successfully |
| SOD signed by genuine DSC | ❌ No | Requires Document Signing Certificate |
| DSC signed by CSCA root | ❌ No | Requires per-country ICAO CSCA certs |

### BAC vs PACE Authentication

| Feature | BAC (implemented) | PACE (not implemented) |
|---------|-------------------|------------------------|
| Introduced | Early ICAO 9303 | Later ICAO 9303 update |
| Security Level | Medium | High |
| Crypto | 3DES + SHA-1 | AES + AES-CMAC + ECDH |
| Key Source | MRZ only | MRZ / CAN / PIN |
| Mutual Authentication | Yes | Yes |
| Forward Secrecy | No | Yes (ECDH) |
| DGs accessible | DG1, DG2, SOD, DG14 | All DGs incl. EF.CardSecurity |
| Used in | Older and most current passports | Modern EU biometric passports |

**Why PACE is not yet implemented:** PACE requires AES-CMAC + ECDH key agreement with `EF.CardAccess` parsing. It is mandatory for Chip Authentication on passports that store the CA key in `EF.CardSecurity` rather than DG14 (e.g. Pakistani NADRA passports).

### DES Parity Adjustment

Every byte in a DES key must have odd parity (odd number of 1-bits). The least significant bit is adjusted to ensure this:

```
Byte: 10110010 → has 4 ones (even) → set bit 0 to 1 → 10110011
Byte: 10110011 → has 5 ones (odd) → leave as-is
```

---

## 8. MRZ Scanning & OCR

### MRZ Format (TD3 Passport)

```
Line 1 (44 chars): P<PAKSURNAME<<GIVENNAMES<<<<<<<<<<<<<<<<<<<<<
                    │ │  │         │
                    │ │  │         └── Given names (< separated)
                    │ │  └── Surname
                    │ └── Issuing country (3-letter code)
                    └── Document type (P = Passport)

Line 2 (44 chars): ZN18532510PAK0403131M3102085<<<<<<<<<<<<<<04
                    │        │ │  │      │ │      │             │
                    │        │ │  │      │ │      │             └── Composite check digit
                    │        │ │  │      │ │      └── Optional data
                    │        │ │  │      │ └── Date of expiry + check
                    │        │ │  │      └── Sex (M/F/<)
                    │        │ │  └── Date of birth + check
                    │        │ └── Nationality
                    │        └── Document number check digit
                    └── Document number (9 chars)
```

### OCR Character Correction

The camera OCR frequently confuses similar-looking characters. The app applies **position-aware correction**:

**In digit-only positions** (check digits, dates):
| OCR reads | Corrected to | Reason |
|-----------|-------------|--------|
| O, D, Q | 0 | Similar shapes |
| I, L | 1 | Vertical strokes |
| B | 8 | Similar curves |
| S | 5 | Similar shape |
| Z | 2 | Similar angles |
| G | 6 | Similar curves |
| A | 4 | Similar top shape |
| T | 7 | Similar angles |

**In alpha-only positions** (names, nationality):
| OCR reads | Corrected to | Reason |
|-----------|-------------|--------|
| 0 | O | Round shape |
| 1 | I | Vertical stroke |
| 8 | B | Similar curves |
| 5 | S | Similar shape |
| 2 | Z | Similar angles |

### Check Digit Algorithm

Per ICAO 9303 Part 3:

```
Weights: [7, 3, 1] (repeating)
Character values: 0-9 = 0-9, A-Z = 10-35, < = 0

Check digit = (sum of char_value × weight[i % 3]) mod 10

Example: Document number "ZN1853251"
  Z=35×7 + N=23×3 + 1=1×1 + 8=8×7 + 5=5×3 + 3=3×1 + 2=2×7 + 5=5×3 + 1=1×1
  = 245 + 69 + 1 + 56 + 15 + 3 + 14 + 15 + 1 = 419
  Check digit = 419 mod 10 = 9 → Position 9 should contain "9"
```

---

## 9. Security Model

### Authentication Layers

| Layer | What It Proves | How | Status |
|-------|---------------|-----|--------|
| **BAC** | Reader has physically seen the passport MRZ | 3DES mutual authentication using MRZ-derived keys | ✅ Implemented |
| **Secure Messaging** | Communication is encrypted and tamper-proof | Every APDU wrapped with 3DES encryption + Retail MAC | ✅ Implemented |
| **Passive Authentication (PA)** | DG1 (and DG2) data has not been tampered with | Hash DG1 raw bytes, compare against SOD LDSSecurityObject | ✅ Implemented |
| **SOD Certificate Chain** | SOD was signed by a genuine government DSC/CSCA | Verify DSC signature + CSCA root cert | ❌ Not implemented (requires ICAO PKD) |
| **Chip Authentication (CA)** | Chip has not been cloned | ECDH with chip's private EC key (DG14) | ⚠️ N/A — EC key not in DG14 via BAC |
| **PACE** | Stronger session establishment, forward secrecy | AES-CMAC + ECDH key agreement with EF.CardAccess | ❌ Not implemented |

### Security Level Comparison

| Use Case | BAC | PA (hash) | Cert Chain | CA |
|----------|-----|-----------|------------|----|
| Just read data | ✅ | — | — | — |
| Verify data not tampered | ✅ | ✅ | — | — |
| Verify issued by real government | ✅ | ✅ | ✅ | — |
| Verify chip not cloned | ✅ | ✅ | ✅ | ✅ |
| **This app** | ✅ | ✅ | — | — |
| **Border control / eGates** | ✅ | ✅ | ✅ | ✅ |

### Data Protection

- **MRZ data** — Exists only in RAM during NFC session, not persisted
- **Session keys** (ksEnc, ksMac) — In RAM only, valid only for the active NFC session
- **Face images** — Base64 in RAM, never written to device storage
- **Audit logs** — Timestamps, session ID, pass/fail flags only (no raw biometric data)
- **Send Sequence Counter (SSC)** — Incremented per message to prevent replay attacks
- **Random nonces** — 8-byte RND.ICC + RND.IFD prevent chosen-plaintext attacks

---

## 10. Data Flow Between Screens

```
HomeScreen
  │  (no data)
  ▼
ConsentScreen
  │  Creates: NFCSession {sessionId: "NFC_...", timestamp, consentGiven}
  │  Passes:  sessionId
  ▼
MRZScannerScreen
  │  Input:   sessionId
  │  Creates: MRZScanResult {passportNumber, DOB, DOE, surname, givenNames, nationality, sex}
  │  Passes:  mrzData + sessionId
  ▼
NFCScanScreen
  │  Input:   mrzData + sessionId
  │  Creates: PassportChipData {personalInfo, faceImageBase64, isAuthenticated, sodVerified}
  │  Passes:  passportData + sessionId
  ▼
PassportResultScreen
  │  Input:   passportData + sessionId
  │  Creates: PassportScanResult {status: SUCCESS|FAILED, reason}
  │           AuditLog (timestamps, chip auth status, SOD result)
  │  Action:  Export scan report via native share sheet
  │  Action:  View session history
  ▼
HomeScreen (loop)
```

---

## 11. Data Handling & Privacy

### What Data Is Collected

| Data | Collected | Stored on Device | Shared Externally |
|------|----------|-----------------|------------------|
| MRZ text (passport number, dates, name) | Yes | No (RAM only) | No |
| Passport chip photo (DG2) | Yes | No (RAM only) | No |
| Scan result (SUCCESS/FAILED) | Yes | Session history | Export only (user-initiated) |
| Audit timestamps | Yes | Session history | Export only (user-initiated) |
| SOD / chip auth status | Yes | Session history | Export only (user-initiated) |

### Privacy Design

- **No raw biometric data is ever stored** on the device or sent externally without user action
- Only pass/fail flags and timestamps are kept in session history
- Session data is cleared when the user starts a new scan
- User must provide explicit consent before any data processing begins
- All NFC communication is encrypted after BAC (cannot be intercepted wirelessly)
- Report export is entirely user-initiated via the native OS share sheet

---

## 12. Android Configuration

### Permissions Required

| Permission | Purpose |
|-----------|---------|
| `android.permission.NFC` | Read passport NFC chip |
| `android.permission.CAMERA` | MRZ scanning |
| `android.permission.VIBRATE` | Haptic feedback on NFC events |
| `android.permission.FOREGROUND_SERVICE` | Long-running NFC operations (Android 14+) |

### Hardware Requirements

| Feature | Required | Purpose |
|---------|---------|---------|
| NFC | Yes | Passport chip reading |
| Back camera | Yes | MRZ scanning |
| Autofocus | Recommended | Better OCR accuracy |

### NFC Technology Filters

The app responds to these NFC technologies:
- **IsoDep** (ISO 14443-4) — Primary, for e-Passport communication
- **NfcA** (ISO 14443-3A) — Tag type A
- **NfcB** (ISO 14443-3B) — Tag type B
- **Ndef** — NFC Data Exchange Format
- **MifareClassic** — Mifare Classic tags
- **MifareUltralight** — Mifare Ultralight tags

---

## 13. APDU Commands Reference

### Command Format

```
[CLA] [INS] [P1] [P2] [Lc] [Data...] [Le]
  │     │    │    │    │     │          └── Expected response length
  │     │    │    │    │     └── Command data
  │     │    │    │    └── Command data length
  │     │    │    └── Parameter 2
  │     │    └── Parameter 1
  │     └── Instruction byte
  └── Class byte (0x00 = plain, 0x0C = Secure Messaging)
```

### Commands Used in This App

| Command | Bytes | Purpose |
|---------|-------|---------|
| SELECT eMRTD | `00 A4 04 0C 07 A0000002471001` | Select passport application |
| GET CHALLENGE | `00 84 00 00 08` | Request 8-byte random from chip |
| EXTERNAL AUTH | `00 82 00 00 28 [40 bytes]` | Send BAC authentication data |
| SELECT DG1 | `00 A4 02 0C 02 0101` | Select personal data file |
| SELECT DG2 | `00 A4 02 0C 02 0102` | Select face image file |
| SELECT SOD | `00 A4 02 0C 02 011D` | Select security object file |
| READ BINARY | `00 B0 [offset] [length]` | Read file data at offset (max 224 bytes) |

### Success Response

A successful response ends with status word `90 00`. Any other status word indicates an error.

---

## 14. PDF Export

The `PDFExportService` generates a human-readable passport scan report and shares it via the native OS share sheet. No external storage permissions are required.

### Report Contents

- **Scan metadata:** Session ID, timestamp, result (SUCCESS/FAILED)
- **Personal information:** Name, passport number, nationality, DOB, DOE, sex
- **Security checks:** BAC authentication status, Passive Authentication result (DG1 hash match), SOD certificate chain status (N/A), chip authentication status
- **Audit log:** Step-by-step timestamps for each phase of the scan

### Implementation Notes

- File saved to app's private Documents directory (`RNFS.DocumentDirectoryPath`)
- Shared as plain text via `react-native`'s `Share` API (no FileProvider or external permissions needed)
- File name format: `PassportScan_NFC_YYYYMMDD_HHMMSS.txt`

---

## 15. Limitations

### Not Implemented

| Feature | Status | Reason |
|---------|--------|--------|
| **Chip Authentication (CA)** | N/A via BAC | EC public key stored in EF.CardSecurity (requires PACE); returns N/A gracefully |
| **PACE Authentication** | Not implemented | Requires AES-CMAC + ECDH; needed for passports that mandate PACE (some EU) |
| **SOD Certificate Chain** | Not implemented | Full PA (DSC → CSCA chain) requires per-country ICAO PKD root certificates |
| **Extended Access Control (EAC)** | Not implemented | Requires government-issued CVCA certificates and authorized reader |
| **DG3 (Fingerprints)** | Cannot read | Protected by EAC, requires government authorization |
| **DG4 (Iris data)** | Cannot read | Protected by EAC, requires government authorization — PACE alone is not sufficient |
| **Liveness Detection** | Not included | Removed from scope — NFC-only reader |
| **Face Matching** | Not included | Removed from scope — NFC-only reader |
| **Backend Audit Submission** | Not implemented | No remote backend; history is in-memory only |
| **iOS Support** | Not tested | Android-only configuration and testing |
| **TD1 (ID card) full flow** | Parser only | TD1 MRZ parser exists but scan UI targets TD3 (passport) |
| **Data Persistence** | None (all in-memory) | No local database; session history lost on app restart |

### Known Constraints

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| **224-byte NFC read chunks** | DG2 (face photo) reading is slow (5–50 KB) | Graceful timeout handling; continue without DG2 if it fails |
| **crypto-js performance** | JavaScript 3DES is slower than native | Acceptable for passport reading (few KB of data) |
| **OCR accuracy** | ML Kit may misread MRZ characters | Position-aware character correction algorithm applied |
| **NFC chip position varies** | User must find the right spot on passport | Diagram guide + retry mechanism |
| **Some passport chips timeout** | Older or damaged chips may not respond | Graceful error handling, optional data groups skipped |

---

## 16. Future Work

| Enhancement | Priority | Description |
|------------|----------|-------------|
| SOD Certificate Chain (full PA) | High | Verify DSC signature + CSCA root cert using ICAO PKD certificate database |
| PACE Authentication | High | AES-CMAC + ECDH session establishment; enables Chip Authentication on modern passports |
| Data persistence | High | SQLite or AsyncStorage for session history across app restarts |
| iOS support | Medium | Test and configure for iOS devices |
| TD1 (ID card) full flow | Medium | Full UI flow for ID card scanning (3-line MRZ) |
| Chip Authentication (CA) | Medium | Requires PACE to be implemented first (EF.CardSecurity access) |
| Multi-language support | Low | Arabic, Urdu UI translations |
| Liveness + face match | Low | Optional future module for identity verification use cases |

---

*This document was generated as part of the NFC e-Passport Reader project, built entirely using Claude AI (Anthropic).*
