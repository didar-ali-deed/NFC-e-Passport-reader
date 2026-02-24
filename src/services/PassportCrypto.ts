/**
 * PassportCrypto — ICAO 9303 BAC + Secure Messaging
 *
 * Implements:
 *  - Key derivation from MRZ (ICAO 9303-11 §9.7.1)
 *  - BAC mutual authentication (ICAO 9303-11 §9.7.2)
 *  - Secure Messaging APDU wrap/unwrap (ICAO 9303-11 §9.8)
 *
 * Uses crypto-js for SHA-1 and DES/3DES primitives.
 */
import CryptoJS from 'crypto-js';

// ── Byte ↔ CryptoJS WordArray ──────────────────────────────────────────────

function toWA(bytes: number[]): CryptoJS.lib.WordArray {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i += 4) {
    words.push(
      ((bytes[i] || 0) << 24) |
        ((bytes[i + 1] || 0) << 16) |
        ((bytes[i + 2] || 0) << 8) |
        (bytes[i + 3] || 0),
    );
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

function fromWA(wa: CryptoJS.lib.WordArray): number[] {
  const out: number[] = [];
  for (let i = 0; i < wa.sigBytes; i++) {
    out.push((wa.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff);
  }
  return out;
}

// ── Crypto primitives ──────────────────────────────────────────────────────

function sha1(data: number[]): number[] {
  return fromWA(CryptoJS.SHA1(toWA(data)));
}

/** Adjust DES key parity bits — each byte must have odd parity. */
function adjustParity(key: number[]): number[] {
  return key.map(b => {
    b &= 0xfe;
    let ones = 0;
    for (let i = 1; i < 8; i++) {
      if (b & (1 << i)) ones++;
    }
    return ones % 2 === 0 ? b | 0x01 : b;
  });
}

/** 3DES-CBC encrypt with 16-byte key (2-key 3DES: K1‖K2‖K1). */
function des3Enc(
  key: number[],
  data: number[],
  iv: number[] = Array(8).fill(0),
): number[] {
  const key24 = [...key, ...key.slice(0, 8)];
  const enc = CryptoJS.TripleDES.encrypt(toWA(data), toWA(key24), {
    iv: toWA(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.NoPadding,
  });
  return fromWA(enc.ciphertext);
}

/** 3DES-CBC decrypt with 16-byte key. */
function des3Dec(
  key: number[],
  data: number[],
  iv: number[] = Array(8).fill(0),
): number[] {
  const key24 = [...key, ...key.slice(0, 8)];
  const cp = CryptoJS.lib.CipherParams.create({ciphertext: toWA(data)});
  const dec = CryptoJS.TripleDES.decrypt(cp, toWA(key24), {
    iv: toWA(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.NoPadding,
  });
  return fromWA(dec);
}

/** Single DES-ECB encrypt (8-byte key, 8-byte block). */
function desEnc(key: number[], data: number[]): number[] {
  const enc = CryptoJS.DES.encrypt(toWA(data), toWA(key), {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.NoPadding,
  });
  return fromWA(enc.ciphertext);
}

/** Single DES-ECB decrypt (8-byte key, 8-byte block). */
function desDec(key: number[], data: number[]): number[] {
  const cp = CryptoJS.lib.CipherParams.create({ciphertext: toWA(data)});
  const dec = CryptoJS.DES.decrypt(cp, toWA(key), {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.NoPadding,
  });
  return fromWA(dec);
}

/**
 * ISO 9797-1 MAC Algorithm 3 (Retail MAC) with 16-byte key.
 * Input must already be padded to a multiple of 8.
 */
function retailMac(key: number[], data: number[]): number[] {
  const ka = key.slice(0, 8);
  const kb = key.slice(8, 16);

  // CBC-MAC with Ka (single DES) over all blocks
  let h = Array(8).fill(0);
  for (let i = 0; i < data.length; i += 8) {
    const block = data.slice(i, i + 8);
    h = desEnc(
      ka,
      h.map((b, j) => b ^ (block[j] ?? 0)),
    );
  }

  // Final: decrypt with Kb, encrypt with Ka
  return desEnc(ka, desDec(kb, h));
}

// ── ISO 9797-1 Padding Method 2 ───────────────────────────────────────────

function pad(data: number[]): number[] {
  const p = [...data, 0x80];
  while (p.length % 8 !== 0) p.push(0x00);
  return p;
}

function unpad(data: number[]): number[] {
  let i = data.length - 1;
  while (i >= 0 && data[i] === 0x00) i--;
  if (i >= 0 && data[i] === 0x80) return data.slice(0, i);
  return data;
}

// ── TLV helpers ────────────────────────────────────────────────────────────

function tlvEncLen(len: number): number[] {
  if (len < 0x80) return [len];
  if (len < 0x100) return [0x81, len];
  return [0x82, (len >> 8) & 0xff, len & 0xff];
}

function tlvDecLen(data: number[], off: number): {len: number; size: number} {
  const b = data[off];
  if (b === undefined) return {len: 0, size: 1};
  if (b < 0x80) return {len: b, size: 1};
  if (b === 0x81) return {len: data[off + 1] ?? 0, size: 2};
  if (b === 0x82)
    return {len: ((data[off + 1] ?? 0) << 8) | (data[off + 2] ?? 0), size: 3};
  return {len: 0, size: 1};
}

// ── Random bytes ───────────────────────────────────────────────────────────

function randomBytes(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.floor(Math.random() * 256));
  return out;
}

function arrEq(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// ── Key derivation (ICAO 9303-11 §9.7.1) ──────────────────────────────────

/**
 * Compute 16-byte key seed from MRZ key-material string.
 * mrzInfo = docNo(9) + check(1) + DOB(6) + check(1) + DOE(6) + check(1)
 */
function computeKeySeed(mrzInfo: string): number[] {
  const bytes = Array.from(mrzInfo).map(c => c.charCodeAt(0));
  return sha1(bytes).slice(0, 16);
}

/**
 * Derive 16-byte 3DES key from seed.
 * counter=1 → encryption key, counter=2 → MAC key.
 */
function deriveKey(kSeed: number[], counter: number): number[] {
  const d = [...kSeed, 0x00, 0x00, 0x00, counter];
  const h = sha1(d);
  return [...adjustParity(h.slice(0, 8)), ...adjustParity(h.slice(8, 16))];
}

// ── BAC authentication (ICAO 9303-11 §9.7.2) ──────────────────────────────

export interface BACSession {
  ksEnc: number[];
  ksMac: number[];
  ssc: number[];
}

/**
 * Perform Basic Access Control mutual authentication.
 * @param transceive  send raw APDU → receive raw response (incl. SW)
 * @param mrzInfo     BAC key material from MRZParser.computeBACInput()
 */
export async function performBAC(
  transceive: (cmd: number[]) => Promise<number[]>,
  mrzInfo: string,
): Promise<BACSession> {
  // Derive document keys
  const kSeed = computeKeySeed(mrzInfo);
  const kEnc = deriveKey(kSeed, 1);
  const kMac = deriveKey(kSeed, 2);

  // GET CHALLENGE → 8-byte RND.ICC
  const challResp = await transceive([0x00, 0x84, 0x00, 0x00, 0x08]);
  checkSW(challResp, 'GET CHALLENGE');
  const rndICC = challResp.slice(0, challResp.length - 2);
  if (rndICC.length !== 8) {
    throw new Error(`BAC: bad challenge length ${rndICC.length}`);
  }

  // Generate IFD random values
  const rndIFD = randomBytes(8);
  const kIFD = randomBytes(16);

  // S = RND.IFD ‖ RND.ICC ‖ K.IFD   (32 bytes)
  const s = [...rndIFD, ...rndICC, ...kIFD];

  // Encrypt S, compute MAC over padded ciphertext
  const eIFD = des3Enc(kEnc, s);
  const mIFD = retailMac(kMac, pad(eIFD));

  // EXTERNAL AUTHENTICATE   00 82 00 00 28 [E_IFD(32)‖M_IFD(8)] 28
  const authResp = await transceive([
    0x00, 0x82, 0x00, 0x00,
    0x28, ...eIFD, ...mIFD,
    0x28,
  ]);
  checkSW(authResp, 'EXTERNAL AUTHENTICATE');

  const authData = authResp.slice(0, authResp.length - 2);
  if (authData.length !== 40) {
    throw new Error(`BAC: response length ${authData.length}, expected 40`);
  }

  const eICC = authData.slice(0, 32);
  const mICC = authData.slice(32, 40);

  // Verify ICC MAC
  if (!arrEq(retailMac(kMac, pad(eICC)), mICC)) {
    throw new Error('BAC: ICC MAC verification failed');
  }

  // Decrypt ICC response → RND.ICC' ‖ RND.IFD' ‖ K.ICC
  const r = des3Dec(kEnc, eICC);
  if (!arrEq(r.slice(0, 8), rndICC)) throw new Error('BAC: RND.ICC mismatch');
  if (!arrEq(r.slice(8, 16), rndIFD)) throw new Error('BAC: RND.IFD mismatch');

  const kICC = r.slice(16, 32);

  // Session key seed = K.IFD ⊕ K.ICC
  const ksSeed = kIFD.map((b, i) => b ^ kICC[i]);
  const ksEnc = deriveKey(ksSeed, 1);
  const ksMac = deriveKey(ksSeed, 2);

  // Initial SSC = last 4 of RND.ICC ‖ last 4 of RND.IFD
  const ssc = [...rndICC.slice(4, 8), ...rndIFD.slice(4, 8)];

  return {ksEnc, ksMac, ssc};
}

function checkSW(resp: number[], label: string): void {
  if (resp.length < 2) throw new Error(`${label}: empty response`);
  const sw1 = resp[resp.length - 2];
  const sw2 = resp[resp.length - 1];
  if (sw1 !== 0x90 || sw2 !== 0x00) {
    throw new Error(
      `${label} failed (SW ${sw1.toString(16).padStart(2, '0')}${sw2.toString(16).padStart(2, '0')})`,
    );
  }
}

// ── Secure Messaging — APDU wrapping (ICAO 9303-11 §9.8) ──────────────────

function incSSC(ssc: number[]): number[] {
  const r = [...ssc];
  for (let i = r.length - 1; i >= 0; i--) {
    r[i] = (r[i] + 1) & 0xff;
    if (r[i] !== 0) break;
  }
  return r;
}

/**
 * Wrap a plain APDU with Secure Messaging.
 * Returns the protected APDU and updated SSC.
 */
export function wrapAPDU(
  apdu: number[],
  ksEnc: number[],
  ksMac: number[],
  ssc: number[],
): {wrapped: number[]; ssc: number[]} {
  const ins = apdu[1];
  const p1 = apdu[2];
  const p2 = apdu[3];

  // Parse plain APDU: [CLA INS P1 P2] [Lc Data] [Le]
  let cmdData: number[] | null = null;
  let le: number | null = null;

  if (apdu.length === 4) {
    // no data, no Le
  } else if (apdu.length === 5) {
    le = apdu[4];
  } else {
    const lc = apdu[4];
    cmdData = apdu.slice(5, 5 + lc);
    if (apdu.length > 5 + lc) le = apdu[5 + lc];
  }

  ssc = incSSC(ssc);

  // DO87: encrypted command data
  let do87: number[] = [];
  if (cmdData && cmdData.length > 0) {
    const enc = des3Enc(ksEnc, pad(cmdData));
    const content = [0x01, ...enc]; // 0x01 = padding-content indicator
    do87 = [0x87, ...tlvEncLen(content.length), ...content];
  }

  // DO97: expected response length
  let do97: number[] = [];
  if (le !== null) {
    do97 = [0x97, 0x01, le];
  }

  // MAC input: SSC ‖ pad(header) ‖ DO87 ‖ DO97 — then pad the whole thing
  const maskedHeader = pad([0x0c, ins, p1, p2]); // 4 → 8 bytes
  let m = [...ssc, ...maskedHeader];
  if (do87.length > 0) m = [...m, ...do87];
  if (do97.length > 0) m = [...m, ...do97];
  m = pad(m);

  const cc = retailMac(ksMac, m);
  const do8e = [0x8e, 0x08, ...cc];

  // Assemble protected APDU
  const body = [...do87, ...do97, ...do8e];
  return {
    wrapped: [0x0c, ins, p1, p2, body.length, ...body, 0x00],
    ssc,
  };
}

/**
 * Unwrap a Secure-Messaging response.
 * Returns decrypted payload, status word, and updated SSC.
 */
export function unwrapResponse(
  response: number[],
  ksEnc: number[],
  ksMac: number[],
  ssc: number[],
): {data: number[]; sw: number[]; ssc: number[]} {
  ssc = incSSC(ssc);

  const outerSW = response.slice(response.length - 2);
  const body = response.slice(0, response.length - 2);

  if (body.length === 0) {
    return {data: [], sw: outerSW, ssc};
  }

  // Parse SM data objects
  let do87Enc: number[] | null = null;
  let do99: number[] | null = null;
  let do8e: number[] | null = null;
  let macEnd = body.length; // position where DO8E tag starts

  try {
    let idx = 0;
    while (idx < body.length) {
      const tagStart = idx;
      const tag = body[idx++];
      const {len, size} = tlvDecLen(body, idx);
      idx += size;
      const value = body.slice(idx, idx + len);
      idx += len;

      switch (tag) {
        case 0x87:
          do87Enc = value[0] === 0x01 ? value.slice(1) : value;
          break;
        case 0x85:
          do87Enc = value;
          break;
        case 0x99:
          do99 = value;
          break;
        case 0x8e:
          do8e = value;
          macEnd = tagStart;
          break;
      }
    }
  } catch {
    return {data: body, sw: outerSW, ssc};
  }

  // Verify MAC
  if (do8e) {
    const macInput = pad([...ssc, ...body.slice(0, macEnd)]);
    if (!arrEq(retailMac(ksMac, macInput), do8e)) {
      throw new Error('SM: response MAC verification failed');
    }
  }

  // Decrypt
  let plain: number[] = [];
  if (do87Enc && do87Enc.length > 0) {
    plain = unpad(des3Dec(ksEnc, do87Enc));
  }

  return {data: plain, sw: do99 || outerSW, ssc};
}
