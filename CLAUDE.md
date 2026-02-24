# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Start Metro dev server
npm start

# Build and run on Android device/emulator
npm run android

# Build Android APK directly (from android/ directory)
cd android && gradlew.bat assembleDebug

# Install APK on connected device
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Launch app on device
adb shell am start -n com.nfcidcardreader/.MainActivity

# Lint
npm run lint

# Run tests (Jest)
npm test

# TypeScript type check
npx tsc --noEmit --skipLibCheck
```

**Requirements:** Node >= 22.11.0, Android SDK 36, NDK 27.1.12297006

## Architecture Overview

This is a React Native KYC (Know Your Customer) app that reads NFC e-Passports following the **ICAO 9303** standard. It performs identity verification through passport chip reading, liveness detection, and face matching.

### KYC Pipeline Flow

```
HomeScreen → ConsentScreen → MRZScannerScreen → NFCScanScreen → SelfieScreen → KYCResultScreen
```

1. **Consent** — GDPR privacy acceptance
2. **MRZ Scan** — Camera OCR or manual entry of passport machine-readable zone
3. **NFC Read** — BAC authentication → Secure Messaging → Read DG1/DG2/SOD from chip
4. **Selfie** — Liveness detection + face matching (passport photo vs live selfie)
5. **Decision** — Multi-factor KYC result (VERIFIED / REJECTED)

### Service Layer (`src/services/`)

| Service | Responsibility |
|---------|---------------|
| **PassportCrypto.ts** | ICAO 9303 cryptography: BAC key derivation (SHA-1 → 3DES), Secure Messaging APDU wrap/unwrap, ISO 9797-1 Retail MAC |
| **PassportNFCService.ts** | NFC chip communication: SELECT eMRTD app, BAC mutual auth, read DG1 (personal data), DG2 (face image), SOD (signatures) via 224-byte chunked reads |
| **MRZParser.ts** | Parse TD3 (passport, 2×44 chars) and TD1 (ID card, 3×30 chars) formats, ICAO check digit validation, BAC key material computation |
| **LivenessService.ts** | Liveness detection + face matching API integration. **Currently in DEMO_MODE** (`DEMO_MODE = true`) — returns mock pass results. Set to `false` and configure API_KEY for production. |
| **KYCDecisionService.ts** | Final multi-factor decision: passport auth + liveness + face match. Builds audit records. |
| **SessionService.ts** | KYC session lifecycle tracking with audit logging |
| **NFCService.ts** | Legacy simplified NFC service (plain APDU, no Secure Messaging) |

### Key Technical Details

- **NFC Protocol:** ISO 14443-4 (IsoDep) → APDU commands → Basic Access Control → 3DES Secure Messaging
- **Crypto:** `crypto-js` for SHA-1, 3DES-CBC, DES-ECB (no native crypto modules needed)
- **Camera/OCR:** `react-native-vision-camera` + `@react-native-ml-kit/text-recognition` for MRZ scanning
- **MRZ OCR correction:** `correctMRZCharacters()` in MRZScannerScreen fixes common OCR misreads (O↔0, I↔1, B↔8) based on position-aware rules
- **Date formatting:** `formatDate()` in PassportNFCService uses year cutoff of 50 (00-50 → 2000s, 51-99 → 1900s)

### Android Configuration

- **Package:** `com.nfcidcardreader`
- **Min SDK:** 24 (Android 7.0)
- **Required hardware:** NFC, front+back camera with autofocus
- **NFC tech filter:** IsoDep, NfcA, NfcB, Ndef, MifareClassic, MifareUltralight
- **Intent filters:** NDEF_DISCOVERED, TAG_DISCOVERED, TECH_DISCOVERED

### Type System (`src/types/`)

- `kyc.ts` — Core KYC types: `MRZScanResult`, `PassportChipData`, `KYCSession`, `KYCDecision`, `LivenessResult`, `FaceMatchResult`, `AuditLog`
- `nfc.ts` — Legacy NFC types: `MRZData`, `NFCReadResult`

### Navigation

React Navigation native-stack with 10 screens. The main KYC flow uses `headerShown: false` on ConsentScreen to prevent back navigation after consent.
