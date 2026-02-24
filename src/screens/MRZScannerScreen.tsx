/**
 * Step 2: MRZ Scanning
 * Camera scan mode: VisionCamera + Google ML Kit Text Recognition for automatic MRZ OCR.
 * Manual entry fallback: user types the two 44-char MRZ lines.
 */
import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {Camera, useCameraDevice, useCameraPermission} from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import {MRZParser} from '../services/MRZParser';
import SessionService from '../services/SessionService';
import type {MRZScanResult} from '../types/kyc';

interface Props {navigation: any; route: any}

/**
 * Fix common OCR misreads in MRZ text.
 * In alpha zones: digits → letters (0→O, 1→I, 8→B, 5→S, 2→Z)
 * In digit zones: letters → digits (O→0, I→1, B→8, S→5, Z→2, D→0, G→6, Q→0)
 */
function correctMRZCharacters(line1: string, line2: string): {line1: string; line2: string} {
  // Line 1 is mostly alpha (name fields) — fix stray digits in name area
  let l1 = line1;
  // Positions 0-4 are doc type + issuing state (alpha)
  // Positions 5-43 are name (alpha + <)
  const l1Chars = l1.split('');
  for (let i = 0; i < l1Chars.length; i++) {
    const ch = l1Chars[i];
    // In name area, digits should be letters
    if (i >= 2) {
      if (ch === '0') l1Chars[i] = 'O';
      else if (ch === '1') l1Chars[i] = 'I';
      else if (ch === '8') l1Chars[i] = 'B';
      else if (ch === '5') l1Chars[i] = 'S';
      else if (ch === '2') l1Chars[i] = 'Z';
    }
  }
  l1 = l1Chars.join('');

  // Line 2 has mixed zones — fix letters in numeric positions
  const l2Chars = line2.split('');
  // Digit-only positions in line 2:
  // 0-8: doc number (alphanumeric, skip)
  // 9: check digit (must be digit)
  // 13-18: DOB (must be digits)
  // 19: check digit
  // 21-26: DOE (must be digits)
  // 27: check digit
  // 28-42: optional data (alphanumeric, skip)
  // 43: composite check digit
  const digitPositions = [9, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 43];
  for (const pos of digitPositions) {
    if (pos >= l2Chars.length) continue;
    const ch = l2Chars[pos];
    if (ch === 'O' || ch === 'D' || ch === 'Q') l2Chars[pos] = '0';
    else if (ch === 'I' || ch === 'L') l2Chars[pos] = '1';
    else if (ch === 'B') l2Chars[pos] = '8';
    else if (ch === 'S') l2Chars[pos] = '5';
    else if (ch === 'Z') l2Chars[pos] = '2';
    else if (ch === 'G') l2Chars[pos] = '6';
    else if (ch === 'A') l2Chars[pos] = '4';
    else if (ch === 'T') l2Chars[pos] = '7';
  }

  // Position 10-12: nationality (must be alpha)
  for (let i = 10; i <= 12 && i < l2Chars.length; i++) {
    const ch = l2Chars[i];
    if (ch === '0') l2Chars[i] = 'O';
    else if (ch === '1') l2Chars[i] = 'I';
    else if (ch === '8') l2Chars[i] = 'B';
  }

  // Position 20: sex (must be M, F, or <)
  if (l2Chars[20] === '0') l2Chars[20] = 'O'; // shouldn't be digit

  return {line1: l1, line2: l2Chars.join('')};
}

/** Try to extract two MRZ lines (TD3: 44 chars each) from OCR text blocks. */
function extractMRZLines(ocrText: string): {line1: string; line2: string} | null {
  // Normalize: remove spaces within lines, uppercase
  const raw = ocrText.toUpperCase();
  // MRZ chars: A-Z, 0-9, <
  // Build candidate lines from each text line — also try merging short fragments
  const candidates: string[] = [];
  let pendingFragment = '';
  for (const line of raw.split('\n')) {
    // Strip everything except MRZ-valid chars
    const cleaned = line.replace(/[^A-Z0-9<]/g, '');
    if (cleaned.length >= 38) {
      // If we had a pending fragment, try merging
      if (pendingFragment.length > 0) {
        const merged = pendingFragment + cleaned;
        if (merged.length >= 44) {
          candidates.push(merged.substring(0, 44));
        }
        pendingFragment = '';
      }
      candidates.push(cleaned);
    } else if (cleaned.length >= 15) {
      // Short fragment — might be a split MRZ line, try to merge with next
      if (pendingFragment.length > 0) {
        const merged = pendingFragment + cleaned;
        if (merged.length >= 38) {
          candidates.push(merged);
        }
        pendingFragment = '';
      } else {
        pendingFragment = cleaned;
      }
    } else {
      pendingFragment = '';
    }
  }

  if (candidates.length < 2) return null;

  // Find the best TD3 pair: line1 starts with P, line2 has numeric check digit positions
  for (let i = 0; i < candidates.length - 1; i++) {
    const l1 = candidates[i].substring(0, 44).padEnd(44, '<');
    const l2 = candidates[i + 1].substring(0, 44).padEnd(44, '<');
    // TD3 line 1 always starts with P (document type)
    if (l1.startsWith('P') && l1.length >= 44 && l2.length >= 44) {
      const corrected = correctMRZCharacters(l1, l2);
      return corrected;
    }
  }

  // Fallback: just use the first two long-enough candidates
  if (candidates.length >= 2) {
    const l1 = candidates[0].substring(0, 44).padEnd(44, '<');
    const l2 = candidates[1].substring(0, 44).padEnd(44, '<');
    const corrected = correctMRZCharacters(l1, l2);
    return corrected;
  }

  return null;
}

const MRZScannerScreen: React.FC<Props> = ({navigation, route}) => {
  const {sessionId} = route.params;
  const [mode, setMode] = useState<'camera' | 'manual'>('manual');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [parsed, setParsed] = useState<MRZScanResult | null>(null);
  const [error, setError] = useState('');

  // Camera state
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const {hasPermission, requestPermission} = useCameraPermission();
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const scanningRef = useRef(false);
  const foundRef = useRef(false);

  useEffect(() => {
    if (mode === 'camera' && !hasPermission) {
      requestPermission();
    }
  }, [mode, hasPermission, requestPermission]);

  // Start/stop scanning loop when mode changes
  useEffect(() => {
    if (mode === 'camera' && hasPermission && !parsed) {
      scanningRef.current = true;
      foundRef.current = false;
      setScanning(true);
      setScanStatus('Point camera at passport MRZ...');
      runScanLoop();
    } else {
      scanningRef.current = false;
      setScanning(false);
    }
    return () => {
      scanningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hasPermission, parsed]);

  const runScanLoop = useCallback(async () => {
    while (scanningRef.current && !foundRef.current) {
      try {
        if (!cameraRef.current) {
          await sleep(500);
          continue;
        }

        // Take a photo for OCR
        const photo = await cameraRef.current.takePhoto();

        if (!scanningRef.current || foundRef.current) break;

        // Run ML Kit text recognition on the captured photo
        const result = await TextRecognition.recognize('file://' + photo.path);

        if (!scanningRef.current || foundRef.current) break;

        // Combine all recognized text
        const fullText = result.blocks.map(b => b.text).join('\n');

        // Try to extract MRZ lines
        const mrz = extractMRZLines(fullText);
        if (mrz) {
          setScanStatus('MRZ detected! Validating...');
          const parseResult = MRZParser.parseTD3(mrz.line1, mrz.line2);
          const valid = MRZParser.validateCheckDigits(mrz.line2);

          if (valid) {
            // Valid MRZ found
            foundRef.current = true;
            scanningRef.current = false;
            setScanning(false);
            setScanStatus('MRZ scanned successfully!');
            setLine1(mrz.line1);
            setLine2(mrz.line2);
            confirmMRZ(parseResult);
            return;
          } else {
            // Found MRZ-like text but check digits failed — keep scanning
            setScanStatus('MRZ detected but check digits invalid. Adjusting...');
          }
        } else {
          setScanStatus('Scanning... Hold passport steady');
        }
      } catch (err: any) {
        // Camera might not be ready yet, just retry
        if (!scanningRef.current) break;
        setScanStatus('Scanning...');
      }

      // Wait before next capture (fast interval for responsive scanning)
      await sleep(400);
    }
  }, []);

  const parseMRZ = () => {
    setError('');
    if (!line1.trim() || !line2.trim()) {
      setError('Please enter both MRZ lines.');
      return;
    }
    if (line1.trim().length < 40 || line2.trim().length < 40) {
      setError('Each MRZ line must be at least 40 characters.');
      return;
    }

    const result = MRZParser.parseTD3(line1.trim(), line2.trim());
    const valid = MRZParser.validateCheckDigits(line2.trim());

    if (!valid) {
      Alert.alert(
        'Check Digit Warning',
        'MRZ check digits do not match. The data may be incorrectly typed. Proceed anyway?',
        [
          {text: 'Re-enter', style: 'cancel'},
          {text: 'Proceed', onPress: () => confirmMRZ(result)},
        ],
      );
      return;
    }
    confirmMRZ(result);
  };

  const confirmMRZ = (result: MRZScanResult) => {
    setParsed(result);
    SessionService.logStep('mrz_scan', 'pass', `Passport: ${result.passportNumber}`);
    SessionService.updateStatus('mrz_scan');
  };

  const proceedToNFC = () => {
    if (!parsed) return;
    navigation.navigate('NFCScan', {mrzData: parsed, sessionId});
  };

  const useSampleData = () => {
    setLine1('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<');
    setLine2('L898902C36UTO7408122F1204159ZE184226B<<<<<10');
  };

  const resetScan = () => {
    setParsed(null);
    setLine1('');
    setLine2('');
    setError('');
    foundRef.current = false;
    if (mode === 'camera') {
      scanningRef.current = true;
      setScanning(true);
      setScanStatus('Point camera at passport MRZ...');
      runScanLoop();
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        {/* Header */}
        <Text style={styles.title}>Scan Passport MRZ</Text>
        <Text style={styles.subtitle}>
          The MRZ is the two machine-readable lines at the bottom of your
          passport's data page.
        </Text>

        {/* Session ID */}
        <View style={styles.sessionBadge}>
          <Text style={styles.sessionText}>Session: {sessionId}</Text>
        </View>

        {!parsed && (
          <>
            {/* MRZ illustration */}
            <View style={styles.mrzIllustration}>
              <Text style={styles.mrzIllustrationTitle}>Where is the MRZ?</Text>
              <View style={styles.passportMock}>
                <View style={styles.passportTop}>
                  <Text style={styles.passportTopText}>PASSPORT DATA PAGE</Text>
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoText}>PHOTO</Text>
                  </View>
                </View>
                <View style={styles.mrzBox}>
                  <Text style={styles.mrzLine}>P&lt;PAKNAME&lt;&lt;GIVEN&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</Text>
                  <Text style={styles.mrzLine}>AB12345670PAK9804123M3209015&lt;&lt;&lt;&lt;&lt;&lt;06</Text>
                </View>
              </View>
              <Text style={styles.mrzArrow}>↑ Enter these two lines below</Text>
            </View>

            {/* Mode tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, mode === 'manual' && styles.activeTab]}
                onPress={() => setMode('manual')}>
                <Text style={[styles.tabText, mode === 'manual' && styles.activeTabText]}>
                  Manual Entry
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, mode === 'camera' && styles.activeTab]}
                onPress={() => setMode('camera')}>
                <Text style={[styles.tabText, mode === 'camera' && styles.activeTabText]}>
                  Camera Scan
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {mode === 'manual' && !parsed ? (
          <View>
            <Text style={styles.label}>MRZ Line 1 (44 characters)</Text>
            <TextInput
              style={styles.mrzInput}
              value={line1}
              onChangeText={t => setLine1(t.toUpperCase())}
              placeholder="P<PAKNAME<<GIVEN<<<<<<<<<<<<<<<<<<<<<<<<<<<<<"
              placeholderTextColor="#999"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={44}
              multiline={false}
            />
            <Text style={styles.charCount}>{line1.length}/44</Text>

            <Text style={styles.label}>MRZ Line 2 (44 characters)</Text>
            <TextInput
              style={styles.mrzInput}
              value={line2}
              onChangeText={t => setLine2(t.toUpperCase())}
              placeholder="AB12345670PAK9804123M3209015<<<<<<06"
              placeholderTextColor="#999"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={44}
              multiline={false}
            />
            <Text style={styles.charCount}>{line2.length}/44</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.sampleBtn} onPress={useSampleData}>
              <Text style={styles.sampleBtnText}>Use ICAO Sample Data (for testing)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.parseButton} onPress={parseMRZ}>
              <Text style={styles.parseButtonText}>Parse MRZ</Text>
            </TouchableOpacity>
          </View>
        ) : mode === 'camera' && !parsed ? (
          <View>
            {hasPermission ? (
              <>
                {/* Camera preview */}
                <View style={styles.cameraWrapper}>
                  {device ? (
                    <>
                      <Camera
                        ref={cameraRef}
                        style={styles.camera}
                        device={device}
                        isActive={mode === 'camera' && !parsed}
                        photo={true}
                        zoom={device.neutralZoom * 1.5}
                        torch={torchOn ? 'on' : 'off'}
                        exposure={0}
                      />
                      {/* MRZ guide overlay */}
                      <View style={styles.mrzOverlay}>
                        <View style={styles.mrzGuideBox}>
                          <Text style={styles.mrzGuideText}>
                            Align MRZ lines here
                          </Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    <View style={[styles.camera, styles.noCameraBox]}>
                      <Text style={styles.noCameraText}>
                        No back camera available
                      </Text>
                    </View>
                  )}
                </View>

                {/* Torch toggle + Scan status */}
                <View style={styles.scanStatusContainer}>
                  {scanning && (
                    <ActivityIndicator
                      size="small"
                      color="#1A237E"
                      style={{marginRight: 8}}
                    />
                  )}
                  <Text style={styles.scanStatusText}>{scanStatus}</Text>
                </View>

                {/* Torch toggle */}
                <TouchableOpacity
                  style={[styles.torchBtn, torchOn && styles.torchBtnActive]}
                  onPress={() => setTorchOn(prev => !prev)}>
                  <Text style={[styles.torchBtnText, torchOn && styles.torchBtnTextActive]}>
                    {torchOn ? 'Torch ON' : 'Torch OFF'}
                  </Text>
                </TouchableOpacity>

                {/* Scan tips */}
                <View style={styles.scanTips}>
                  {['Hold steady', 'Good lighting', 'Fill frame', 'Zoom in'].map((tip, i) => (
                    <View key={i} style={styles.tipChip}>
                      <Text style={styles.tipText}>{tip}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.switchBtn}
                  onPress={() => setMode('manual')}>
                  <Text style={styles.switchBtnText}>Switch to Manual Entry</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.permissionNotice}>
                <Text style={styles.permissionTitle}>Camera Permission Required</Text>
                <Text style={styles.permissionText}>
                  Please grant camera permission to scan MRZ automatically.
                </Text>
                <TouchableOpacity
                  style={styles.parseButton}
                  onPress={() => requestPermission()}>
                  <Text style={styles.parseButtonText}>Grant Permission</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.switchBtn}
                  onPress={() => setMode('manual')}>
                  <Text style={styles.switchBtnText}>Use Manual Entry Instead</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}

        {/* Parsed result preview */}
        {parsed && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>MRZ Parsed Successfully</Text>
            {mode === 'camera' && (
              <Text style={styles.resultSource}>Detected via Camera OCR</Text>
            )}
            <View style={styles.resultGrid}>
              {([
                ['Passport No.', parsed.passportNumber],
                ['Surname', parsed.surname],
                ['Given Names', parsed.givenNames],
                ['Nationality', parsed.nationality],
                ['Date of Birth', parsed.dateOfBirth],
                ['Date of Expiry', parsed.dateOfExpiry],
                ['Sex', parsed.sex],
              ] as [string, string][]).map(([label, value]) => (
                <View key={label} style={styles.resultRow}>
                  <Text style={styles.resultLabel}>{label}</Text>
                  <Text style={styles.resultValue}>{value || '\u2014'}</Text>
                </View>
              ))}
            </View>
            <View style={styles.bacInfo}>
              <Text style={styles.bacInfoText}>
                BAC Key Input: {MRZParser.computeBACInput(parsed)}
              </Text>
            </View>

            <View style={styles.resultActions}>
              <TouchableOpacity style={styles.rescanBtn} onPress={resetScan}>
                <Text style={styles.rescanBtnText}>Re-scan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.proceedButton} onPress={proceedToNFC}>
                <Text style={styles.proceedButtonText}>
                  Proceed to NFC Scan →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  content: {padding: 20, paddingBottom: 40},
  title: {fontSize: 22, fontWeight: 'bold', color: '#1A237E', marginBottom: 8},
  subtitle: {fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 12},
  sessionBadge: {
    backgroundColor: '#E8EAF6',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  sessionText: {fontSize: 11, color: '#3949AB', fontFamily: 'monospace'},
  mrzIllustration: {marginBottom: 20},
  mrzIllustrationTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  passportMock: {
    backgroundColor: '#1B5E20',
    borderRadius: 8,
    overflow: 'hidden',
  },
  passportTop: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passportTopText: {color: '#fff', fontSize: 10, flex: 1},
  photoPlaceholder: {
    width: 40,
    height: 50,
    backgroundColor: '#4CAF50',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoText: {color: '#fff', fontSize: 8},
  mrzBox: {
    backgroundColor: '#F5F5F0',
    padding: 8,
  },
  mrzLine: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#000',
    letterSpacing: 0.5,
  },
  mrzArrow: {fontSize: 12, color: '#F44336', textAlign: 'center', marginTop: 4},
  tabs: {flexDirection: 'row', marginBottom: 16, gap: 8},
  tab: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
  },
  activeTab: {backgroundColor: '#1A237E'},
  tabText: {fontSize: 13, fontWeight: '600', color: '#666'},
  activeTabText: {color: '#fff'},
  label: {fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6},
  mrzInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#000',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    letterSpacing: 1,
  },
  charCount: {fontSize: 11, color: '#999', textAlign: 'right', marginBottom: 12},
  error: {color: '#F44336', fontSize: 13, marginBottom: 8},
  sampleBtn: {
    borderWidth: 1,
    borderColor: '#1A237E',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  sampleBtnText: {fontSize: 13, color: '#1A237E'},
  parseButton: {
    backgroundColor: '#1A237E',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  parseButtonText: {fontSize: 15, fontWeight: '700', color: '#fff'},
  // Camera styles
  cameraWrapper: {
    height: 340,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 12,
  },
  camera: {flex: 1},
  noCameraBox: {justifyContent: 'center', alignItems: 'center'},
  noCameraText: {color: '#fff', textAlign: 'center'},
  mrzOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
  mrzGuideBox: {
    borderWidth: 2,
    borderColor: 'rgba(255,200,0,0.8)',
    borderRadius: 6,
    borderStyle: 'dashed',
    paddingVertical: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  mrzGuideText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  scanStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 24,
  },
  scanStatusText: {fontSize: 13, color: '#1A237E', fontWeight: '600'},
  scanTips: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  tipChip: {
    backgroundColor: '#E8EAF6',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  tipText: {fontSize: 12, color: '#3949AB'},
  torchBtn: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1A237E',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  torchBtnActive: {
    backgroundColor: '#FFA000',
    borderColor: '#FFA000',
  },
  torchBtnText: {fontSize: 13, fontWeight: '600', color: '#1A237E'},
  torchBtnTextActive: {color: '#fff'},
  switchBtn: {
    alignSelf: 'center',
    backgroundColor: '#1A237E',
    borderRadius: 8,
    padding: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  switchBtnText: {color: '#fff', fontWeight: '600'},
  permissionNotice: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  permissionTitle: {fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 8},
  permissionText: {fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 16},
  resultCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 4,
  },
  resultSource: {
    fontSize: 11,
    color: '#4CAF50',
    marginBottom: 12,
    fontWeight: '600',
  },
  resultGrid: {gap: 6},
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
  },
  resultLabel: {fontSize: 13, color: '#555', flex: 1},
  resultValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1B5E20',
    flex: 1,
    textAlign: 'right',
    fontFamily: 'monospace',
  },
  bacInfo: {
    backgroundColor: '#C8E6C9',
    borderRadius: 6,
    padding: 8,
    marginTop: 10,
  },
  bacInfoText: {fontSize: 10, color: '#1B5E20', fontFamily: 'monospace'},
  resultActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  rescanBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2E7D32',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  rescanBtnText: {fontSize: 15, fontWeight: '700', color: '#2E7D32'},
  proceedButton: {
    flex: 2,
    backgroundColor: '#2E7D32',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  proceedButtonText: {fontSize: 15, fontWeight: '700', color: '#fff'},
});

export default MRZScannerScreen;
