/**
 * Step 4: NFC Passport Chip Communication
 * Steps 3 (BAC), 5 (SOD), 6 (DG2 face) all happen here.
 */
import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import PassportNFCService from '../services/PassportNFCService';
import SessionService from '../services/SessionService';
import type {MRZScanResult, PassportChipData} from '../types/kyc';

interface Props {navigation: any; route: any}

type NFCStep =
  | 'ready'
  | 'selecting_app'
  | 'bac_auth'
  | 'reading_dg1'
  | 'reading_dg2'
  | 'reading_sod'
  | 'chip_auth'
  | 'verifying'
  | 'done'
  | 'error';

const STEP_LABELS: Record<NFCStep, string> = {
  ready: 'Ready to scan',
  selecting_app: 'Selecting eMRTD app...',
  bac_auth: 'BAC authentication...',
  reading_dg1: 'Reading personal data (DG1)...',
  reading_dg2: 'Reading face image (DG2)...',
  reading_sod: 'Reading security data (SOD)...',
  chip_auth: 'Chip Authentication (CA)...',
  verifying: 'Verifying digital signatures...',
  done: 'Passport read complete!',
  error: 'Read failed',
};

const NFCScanScreen: React.FC<Props> = ({navigation, route}) => {
  const {mrzData, sessionId} = route.params as {
    mrzData: MRZScanResult;
    sessionId: string;
  };
  const [step, setStep] = useState<NFCStep>('ready');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  // Pulse animation for NFC icon
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {toValue: 1.2, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 1.0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  useEffect(() => {
    startNFCScan();
    return () => {PassportNFCService.cleanup();};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startNFCScan = async () => {
    setError('');
    setStep('selecting_app');
    try {
      SessionService.logStep('nfc_start', 'pass', `Attempt ${attempts + 1}`);

      // readPassport now reports real progress via the onStep callback
      const result: PassportChipData = await PassportNFCService.readPassport(
        mrzData,
        (s: string) => {
          if (s === 'selecting_app' || s === 'bac_auth' || s === 'reading_dg1' ||
              s === 'reading_dg2' || s === 'reading_sod' || s === 'chip_auth') {
            setStep(s as NFCStep);
          }
        },
      );

      setStep('verifying');
      // Brief pause so user sees the "verifying" step
      await new Promise<void>(r => setTimeout(r, 500));

      setStep('done');
      SessionService.logStep(
        'nfc_complete',
        result.isAuthenticated ? 'pass' : 'fail',
        `Auth: ${result.isAuthenticated}, SOD: ${result.sodVerified}, CA: ${result.chipAuthDone}`,
      );
      SessionService.updateStatus('nfc_read');

      // Navigate to passport result screen
      setTimeout(() => {
        navigation.navigate('PassportResult', {passportData: result, sessionId});
      }, 1200);
    } catch (err: any) {
      setStep('error');
      setError(err?.message || 'NFC read failed. Make sure NFC is enabled and hold passport steady.');
      SessionService.logStep('nfc_error', 'fail', err?.message);
    }
  };

  const retry = () => {
    setAttempts(a => a + 1);
    setStep('ready');
    startNFCScan();
  };

  const getStepColor = (s: NFCStep): string => {
    if (s === 'error') return '#F44336';
    if (s === 'done') return '#4CAF50';
    return '#1A237E';
  };

  const steps: NFCStep[] = [
    'selecting_app', 'bac_auth', 'reading_dg1',
    'reading_dg2', 'reading_sod', 'chip_auth', 'verifying',
  ];
  const stepOrder = steps.indexOf(step);

  return (
    <View style={styles.container}>
      {/* NFC Animation */}
      <View style={styles.nfcArea}>
        <Animated.View style={[styles.nfcRing3, {transform: [{scale: pulse}]}]} />
        <Animated.View style={styles.nfcRing2} />
        <View style={styles.nfcCircle}>
          <Text style={styles.nfcIcon}>NFC</Text>
        </View>
      </View>

      {/* Status */}
      <Text style={[styles.statusText, {color: getStepColor(step)}]}>
        {STEP_LABELS[step]}
      </Text>

      {step === 'error' && (
        <Text style={styles.errorDetail}>{error}</Text>
      )}

      {/* Instructions */}
      {(step !== 'done' && step !== 'error') && (
        <View style={styles.instructionBox}>
          <Text style={styles.instructionTitle}>Hold your passport like this:</Text>
          <View style={styles.phonePassportDiagram}>
            <View style={styles.phoneDiagram}>
              <Text style={styles.diagramLabel}>PHONE</Text>
              <Text style={styles.diagramSub}>(back)</Text>
            </View>
            <Text style={styles.diagramArrow}>←→</Text>
            <View style={styles.passportDiagram}>
              <Text style={styles.diagramLabel}>PASSPORT</Text>
              <Text style={styles.diagramSub}>(cover)</Text>
            </View>
          </View>
          <Text style={styles.instructionNote}>
            The NFC chip is in the center or lower area of the passport.{'\n'}
            Keep steady for up to 10 seconds.
          </Text>
        </View>
      )}

      {/* Progress steps */}
      <View style={styles.progressContainer}>
        {steps.map((s, i) => {
          const done = stepOrder > i;
          const active = stepOrder === i;
          return (
            <View key={s} style={styles.progressRow}>
              <View style={[
                styles.progressDot,
                done && styles.progressDotDone,
                active && styles.progressDotActive,
              ]}>
                <Text style={styles.progressDotText}>
                  {done ? '✓' : i + 1}
                </Text>
              </View>
              <Text style={[
                styles.progressLabel,
                done && styles.progressLabelDone,
                active && styles.progressLabelActive,
              ]}>
                {STEP_LABELS[s]}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Buttons */}
      {step === 'error' && (
        <TouchableOpacity style={styles.retryBtn} onPress={retry}>
          <Text style={styles.retryBtnText}>Try Again ({3 - attempts} left)</Text>
        </TouchableOpacity>
      )}
      {step === 'error' && attempts >= 3 && (
        <Text style={styles.giveUpText}>
          If NFC keeps failing, make sure:{'\n'}
          • NFC is enabled in phone settings{'\n'}
          • Passport has NFC chip (biometric passport){'\n'}
          • Remove phone case if thick
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA', padding: 20, alignItems: 'center'},
  nfcArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 160,
    height: 160,
    marginTop: 20,
    marginBottom: 20,
  },
  nfcRing3: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: '#C5CAE9',
  },
  nfcRing2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#9FA8DA',
  },
  nfcCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nfcIcon: {color: '#fff', fontWeight: '900', fontSize: 18},
  statusText: {fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 6},
  errorDetail: {
    fontSize: 13,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  instructionBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginBottom: 16,
  },
  instructionTitle: {fontSize: 13, fontWeight: '600', color: '#1565C0', marginBottom: 10},
  phonePassportDiagram: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 12,
  },
  phoneDiagram: {
    backgroundColor: '#1565C0',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    width: 80,
  },
  passportDiagram: {
    backgroundColor: '#1B5E20',
    borderRadius: 4,
    padding: 10,
    alignItems: 'center',
    width: 80,
  },
  diagramLabel: {color: '#fff', fontSize: 10, fontWeight: '700'},
  diagramSub: {color: '#ccc', fontSize: 9},
  diagramArrow: {fontSize: 18, color: '#666'},
  instructionNote: {fontSize: 12, color: '#1565C0', textAlign: 'center', lineHeight: 17},
  progressContainer: {width: '100%', gap: 8, marginTop: 4},
  progressRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotDone: {backgroundColor: '#4CAF50'},
  progressDotActive: {backgroundColor: '#1A237E'},
  progressDotText: {fontSize: 10, color: '#fff', fontWeight: '700'},
  progressLabel: {fontSize: 12, color: '#999'},
  progressLabelDone: {color: '#4CAF50'},
  progressLabelActive: {color: '#1A237E', fontWeight: '600'},
  retryBtn: {
    backgroundColor: '#1A237E',
    borderRadius: 10,
    padding: 14,
    paddingHorizontal: 40,
    marginTop: 16,
  },
  retryBtnText: {color: '#fff', fontWeight: '700', fontSize: 15},
  giveUpText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
});

export default NFCScanScreen;
