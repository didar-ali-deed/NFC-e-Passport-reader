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

// ── SHA-256 ────────────────────────────────────────────────────────────────

function sha256(data: number[]): number[] {
  return fromWA(CryptoJS.SHA256(toWA(data)));
}

// ── ASN.1 parser (for SOD/CMS) ─────────────────────────────────────────────

interface ASN1Node {
  tag: number;
  value: number[];
  totalLength: number;
}

function asn1Read(data: number[], offset: number): ASN1Node {
  if (offset >= data.length) throw new Error('ASN1: offset out of bounds');
  const tag = data[offset];
  let pos = offset + 1;
  const lb = data[pos++];
  let len: number;
  if      (lb < 0x80)    { len = lb; }
  else if (lb === 0x81)  { len = data[pos++]; }
  else if (lb === 0x82)  { len = (data[pos] << 8) | data[pos + 1]; pos += 2; }
  else if (lb === 0x83)  { len = (data[pos] << 16) | (data[pos+1] << 8) | data[pos+2]; pos += 3; }
  else throw new Error(`ASN1: unsupported length encoding 0x${lb.toString(16)}`);
  return { tag, value: data.slice(pos, pos + len), totalLength: pos - offset + len };
}

function asn1Children(data: number[]): ASN1Node[] {
  const nodes: ASN1Node[] = [];
  let offset = 0;
  while (offset < data.length - 1) {
    const node = asn1Read(data, offset);
    nodes.push(node);
    offset += node.totalLength;
  }
  return nodes;
}

// Hash algorithm OIDs
const OID_SHA1   = [0x2b, 0x0e, 0x03, 0x02, 0x1a];
const OID_SHA256 = [0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01];
const OID_SHA384 = [0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x02];
const OID_SHA512 = [0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x03];

function oidEq(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

type HashAlg = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

function hashData(alg: HashAlg, data: number[]): number[] {
  switch (alg) {
    case 'SHA-1':   return sha1(data);
    case 'SHA-256': return sha256(data);
    case 'SHA-384': return fromWA(CryptoJS.SHA384(toWA(data)));
    case 'SHA-512': return fromWA(CryptoJS.SHA512(toWA(data)));
  }
}

/**
 * Walk the CMS SignedData tree to find the OCTET STRING
 * that contains the raw LDSSecurityObject DER bytes.
 *
 * Handles both:
 *   77 [len] 30 … (EF.SOD DG wrapper)
 *   30 …         (bare ContentInfo)
 */
function extractLDSContent(sodData: number[]): number[] | null {
  let data = sodData;

  // Strip outer EF.SOD tag 0x77
  if (data[0] === 0x77) {
    data = asn1Read(data, 0).value;
  }

  if (data[0] !== 0x30) return null;

  // ContentInfo: SEQUENCE { OID, [0] EXPLICIT SignedData }
  const ciKids = asn1Children(asn1Read(data, 0).value);
  if (ciKids.length < 2) return null;

  // Unwrap [0] EXPLICIT → SignedData SEQUENCE
  let sdValue: number[];
  if (ciKids[1].tag === 0xa0) {
    const a0Kids = asn1Children(ciKids[1].value);
    if (a0Kids.length === 0) return null;
    sdValue = a0Kids[0].value;
  } else if (ciKids[1].tag === 0x30) {
    sdValue = ciKids[1].value;
  } else {
    return null;
  }

  // SignedData fields — find encapContentInfo (SEQUENCE whose first child is OID)
  for (const kid of asn1Children(sdValue)) {
    if (kid.tag !== 0x30) continue;
    const encapKids = asn1Children(kid.value);
    if (encapKids.length < 2 || encapKids[0].tag !== 0x06) continue;
    // Found encapContentInfo — look for [0] EXPLICIT → OCTET STRING
    for (let j = 1; j < encapKids.length; j++) {
      if (encapKids[j].tag === 0xa0) {
        for (const inner of asn1Children(encapKids[j].value)) {
          if (inner.tag === 0x04) return inner.value;
        }
      }
    }
  }
  return null;
}

/**
 * Parse LDSSecurityObject:
 *   SEQUENCE { version, AlgorithmIdentifier, SEQUENCE OF DataGroupHash }
 * DataGroupHash ::= SEQUENCE { INTEGER (dgNumber), OCTET STRING (hash) }
 */
function parseLDSSecObj(data: number[]): { alg: HashAlg | null; hashes: Map<number, number[]> } {
  const result: { alg: HashAlg | null; hashes: Map<number, number[]> } =
    { alg: null, hashes: new Map() };
  try {
    const top = asn1Read(data, 0);
    if (top.tag !== 0x30) return result;
    const fields = asn1Children(top.value);
    if (fields.length < 3) return result;

    // fields[1] = AlgorithmIdentifier SEQUENCE { OID }
    if (fields[1].tag === 0x30) {
      const algKids = asn1Children(fields[1].value);
      if (algKids.length > 0 && algKids[0].tag === 0x06) {
        const oid = algKids[0].value;
        if      (oidEq(oid, OID_SHA1))   result.alg = 'SHA-1';
        else if (oidEq(oid, OID_SHA256)) result.alg = 'SHA-256';
        else if (oidEq(oid, OID_SHA384)) result.alg = 'SHA-384';
        else if (oidEq(oid, OID_SHA512)) result.alg = 'SHA-512';
      }
    }

    // fields[2] = SEQUENCE OF DataGroupHash
    if (fields[2].tag === 0x30) {
      for (const dg of asn1Children(fields[2].value)) {
        if (dg.tag !== 0x30) continue;
        const dgFields = asn1Children(dg.value);
        if (dgFields.length < 2) continue;
        if (dgFields[0].tag === 0x02 && dgFields[1].tag === 0x04) {
          const dgNum = dgFields[0].value[dgFields[0].value.length - 1];
          result.hashes.set(dgNum, dgFields[1].value);
        }
      }
    }
  } catch (e: any) {
    console.warn('[PA] LDSSecurityObject parse error:', e?.message);
  }
  return result;
}

// ── Passive Authentication ─────────────────────────────────────────────────

export interface PassiveAuthResult {
  /** true if DG1 hash in SOD matches the raw bytes read from chip */
  verified: boolean;
  /** hash algorithm found in SOD, e.g. "SHA-256" */
  hashAlg: string | null;
  dg1Match: boolean;
  /** null if DG2 was not provided or not in SOD hashes */
  dg2Match: boolean | null;
}

/**
 * Passive Authentication (ICAO 9303 §5.1).
 *
 * Verifies that the DG1 bytes read from the chip match the hash stored
 * inside the SOD (LDSSecurityObject). If raw DG2 bytes are supplied,
 * DG2 is verified as well.
 *
 * Note: full PKI verification (DSC → CSCA chain) is NOT performed here,
 * as it requires per-country CSCA root certificates.
 */
export function verifyPassiveAuthentication(
  sodData: number[],
  dg1Data: number[],
  dg2Data: number[] | null = null,
): PassiveAuthResult {
  const result: PassiveAuthResult =
    { verified: false, hashAlg: null, dg1Match: false, dg2Match: null };

  try {
    const ldsContent = extractLDSContent(sodData);
    if (!ldsContent) {
      console.warn('[PA] Could not extract LDSSecurityObject from SOD');
      return result;
    }

    const { alg, hashes } = parseLDSSecObj(ldsContent);
    result.hashAlg = alg;

    if (!alg) {
      console.warn('[PA] Unknown hash algorithm in SOD');
      return result;
    }

    // Verify DG1 (data group number = 1)
    const sodDg1 = hashes.get(1);
    if (sodDg1 && dg1Data.length > 0) {
      const computed = hashData(alg, dg1Data);
      result.dg1Match = arrEq(computed, sodDg1);
      console.log(`[PA] DG1 ${alg} computed : ${computed.map(b => b.toString(16).padStart(2, '0')).join('')}`);
      console.log(`[PA] DG1 ${alg} in SOD   : ${sodDg1.map(b => b.toString(16).padStart(2, '0')).join('')}`);
      console.log(`[PA] DG1 match: ${result.dg1Match}`);
    }

    // Verify DG2 (data group number = 2) if raw bytes provided
    if (dg2Data && dg2Data.length > 0) {
      const sodDg2 = hashes.get(2);
      if (sodDg2) {
        const computed = hashData(alg, dg2Data);
        result.dg2Match = arrEq(computed, sodDg2);
        console.log(`[PA] DG2 match: ${result.dg2Match}`);
      }
    }

    result.verified = result.dg1Match;
  } catch (e: any) {
    console.warn('[PA] Passive authentication error:', e?.message);
  }

  return result;
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
