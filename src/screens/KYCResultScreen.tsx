/**
 * Steps 10 & 11: Final KYC Decision + Audit Log
 */
import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import KYCDecisionService from '../services/KYCDecisionService';
import SessionService from '../services/SessionService';
import PDFExportService from '../services/PDFExportService';
import type {
  PassportChipData,
  LivenessResult,
  FaceMatchResult,
  KYCDecision,
} from '../types/kyc';

interface Props {navigation: any; route: any}

const KYCResultScreen: React.FC<Props> = ({navigation, route}) => {
  const {passportData, livenessResult, faceMatchResult, selfieBase64, sessionId} =
    route.params as {
      passportData: PassportChipData;
      livenessResult: LivenessResult;
      faceMatchResult: FaceMatchResult;
      selfieBase64: string;
      sessionId: string;
    };

  const [decision, setDecision] = useState<KYCDecision | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    // Step 10: Make decision
    const d = KYCDecisionService.makeDecision(
      passportData,
      livenessResult,
      faceMatchResult,
    );
    setDecision(d);

    // Save to history
    const name = passportData.personalInfo
      ? `${passportData.personalInfo.givenNames} ${passportData.personalInfo.surname}`.trim()
      : 'Unknown';
    SessionService.addToHistory(
      d,
      name,
      passportData.personalInfo?.documentNumber || '',
      passportData.personalInfo?.nationality || '',
    );

    // Step 11: Submit audit log to backend
    const audit = KYCDecisionService.buildAuditRecord(d, faceMatchResult, livenessResult);
    KYCDecisionService.submitToBackend(audit).then(() => setSubmitted(true));
  }, []);

  const startNew = () => {
    SessionService.destroySession();
    navigation.popToTop();
  };

  const handleExportPDF = async () => {
    if (!decision) return;
    setExporting(true);
    try {
      await PDFExportService.generateAndShare(
        decision,
        passportData,
        livenessResult,
        faceMatchResult,
        SessionService.getAuditLog(),
      );
    } catch (err: any) {
      if (!err?.message?.includes('User did not share')) {
        Alert.alert('Export Failed', err?.message || 'Could not generate PDF report.');
      }
    } finally {
      setExporting(false);
    }
  };

  if (!decision) return null;

  const isVerified = decision.finalStatus === 'VERIFIED';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Main result banner */}
        <View style={[styles.resultBanner, isVerified ? styles.bannerGreen : styles.bannerRed]}>
          <Text style={styles.resultIcon}>{isVerified ? '✓' : '✗'}</Text>
          <Text style={styles.resultStatus}>{decision.finalStatus}</Text>
          <Text style={styles.resultReason}>{decision.reason}</Text>
        </View>

        {/* Session info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Session Info</Text>
          <Row label="Session ID" value={decision.sessionId} mono />
          <Row label="Timestamp" value={new Date(decision.timestamp).toLocaleString()} />
          <Row
            label="Audit Submitted"
            value={submitted ? 'Yes' : 'Pending...'}
            color={submitted ? '#4CAF50' : '#FF9800'}
          />
        </View>

        {/* Check results */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verification Checks</Text>

          <CheckResult
            label="Passport Authentication"
            passed={decision.passportAuthentic}
            detail="BAC session + SOD signature verified"
          />
          <CheckResult
            label="Liveness Detection"
            passed={decision.livenessPassed}
            detail={`Score: ${(livenessResult.score * 100).toFixed(0)}% (provider: ${livenessResult.provider})`}
          />
          <CheckResult
            label="Face Match"
            passed={decision.faceMatched}
            detail={`Score: ${(faceMatchResult.score * 100).toFixed(0)}% (threshold: ${(faceMatchResult.threshold * 100).toFixed(0)}%)`}
          />
        </View>

        {/* Passport data */}
        {passportData.personalInfo && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Passport Data (DG1)</Text>
            {[
              ['Full Name', `${passportData.personalInfo.givenNames} ${passportData.personalInfo.surname}`],
              ['Document No.', passportData.personalInfo.documentNumber],
              ['Nationality', passportData.personalInfo.nationality],
              ['Date of Birth', passportData.personalInfo.dateOfBirth],
              ['Date of Expiry', passportData.personalInfo.dateOfExpiry],
              ['Sex', passportData.personalInfo.sex],
              ['Issuing State', passportData.personalInfo.issuingState],
            ].map(([l, v]) => <Row key={l} label={l} value={v} />)}
          </View>
        )}

        {/* Face images */}
        {(selfieBase64 || passportData.faceImageBase64) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Face Comparison</Text>
            <View style={styles.faceRow}>
              {passportData.faceImageBase64 ? (
                <View style={styles.faceItem}>
                  <Image
                    source={{uri: `data:image/jpeg;base64,${passportData.faceImageBase64}`}}
                    style={styles.faceImage}
                  />
                  <Text style={styles.faceLabel}>Passport (DG2)</Text>
                </View>
              ) : (
                <View style={styles.faceItem}>
                  <View style={styles.noFacePlaceholder}>
                    <Text style={styles.noFaceText}>No DG2</Text>
                  </View>
                  <Text style={styles.faceLabel}>Passport (DG2)</Text>
                </View>
              )}

              <Text style={styles.vsText}>
                {faceMatchResult.matched ? '✓ MATCH' : '✗ NO MATCH'}
              </Text>

              {selfieBase64 && (
                <View style={styles.faceItem}>
                  <Image
                    source={{uri: `data:image/jpeg;base64,${selfieBase64}`}}
                    style={styles.faceImage}
                  />
                  <Text style={styles.faceLabel}>Live Selfie</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Security status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Security Status</Text>
          <CheckResult label="Passive Authentication (PA)" passed={passportData.isAuthenticated} />
          <CheckResult label="SOD Signature Verified" passed={passportData.sodVerified} />
          <CheckResult
            label="Chip Authentication (CA)"
            passed={passportData.chipAuthDone}
            detail="Requires extended hardware support"
          />
          <CheckResult
            label="EAC (Fingerprints/Iris)"
            passed={false}
            detail="Requires government-authorized reader"
          />
        </View>

        {/* Audit log */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Audit Log</Text>
          {SessionService.getAuditLog()?.steps.map((s, i) => (
            <View key={i} style={styles.auditRow}>
              <Text style={[
                styles.auditStatus,
                s.status === 'pass' ? styles.auditPass :
                s.status === 'fail' ? styles.auditFail : styles.auditPending,
              ]}>
                {s.status === 'pass' ? '✓' : s.status === 'fail' ? '✗' : '○'}
              </Text>
              <View style={styles.auditInfo}>
                <Text style={styles.auditStep}>{s.step}</Text>
                {s.details && <Text style={styles.auditDetail}>{s.details}</Text>}
              </View>
              <Text style={styles.auditTime}>
                {new Date(s.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          ))}
        </View>

        {/* Data policy note */}
        <View style={styles.policyNote}>
          <Text style={styles.policyText}>
            ❌ No raw biometric data stored. Only KYC result hash and audit log
            retained per GDPR and ICAO 9303 guidelines.
          </Text>
        </View>

        {/* Export & Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExportPDF}
            disabled={exporting}>
            {exporting ? (
              <ActivityIndicator size="small" color="#1A237E" />
            ) : (
              <>
                <Text style={styles.exportBtnText}>Export PDF</Text>
                <Text style={styles.exportBtnSub}>Share report</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.newKycBtn} onPress={startNew}>
            <Text style={styles.newKycBtnText}>Start New KYC</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

// Helper components
const Row: React.FC<{
  label: string;
  value: string;
  mono?: boolean;
  color?: string;
}> = ({label, value, mono, color}) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, mono && {fontFamily: 'monospace'}, color ? {color} : {}]}>
      {value}
    </Text>
  </View>
);

const CheckResult: React.FC<{
  label: string;
  passed: boolean;
  detail?: string;
}> = ({label, passed, detail}) => (
  <View style={styles.checkRow}>
    <Text style={[styles.checkIcon, passed ? styles.checkPass : styles.checkFail]}>
      {passed ? '✓' : '✗'}
    </Text>
    <View style={styles.checkInfo}>
      <Text style={styles.checkLabel}>{label}</Text>
      {detail && <Text style={styles.checkDetail}>{detail}</Text>}
    </View>
    <Text style={[styles.checkStatus, passed ? styles.checkPass : styles.checkFail]}>
      {passed ? 'PASS' : 'FAIL'}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  content: {padding: 20, paddingBottom: 40},
  resultBanner: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  bannerGreen: {backgroundColor: '#E8F5E9', borderWidth: 2, borderColor: '#4CAF50'},
  bannerRed: {backgroundColor: '#FFEBEE', borderWidth: 2, borderColor: '#F44336'},
  resultIcon: {fontSize: 56},
  resultStatus: {fontSize: 28, fontWeight: '900', marginTop: 8, color: '#333'},
  resultReason: {
    fontSize: 13,
    color: '#555',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A237E',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  rowLabel: {fontSize: 13, color: '#666', flex: 1},
  rowValue: {fontSize: 13, fontWeight: '500', color: '#333', flex: 1, textAlign: 'right'},
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  checkIcon: {fontSize: 16, marginRight: 10, marginTop: 2},
  checkInfo: {flex: 1},
  checkLabel: {fontSize: 13, color: '#333', fontWeight: '500'},
  checkDetail: {fontSize: 11, color: '#999', marginTop: 2},
  checkStatus: {fontSize: 12, fontWeight: '700'},
  checkPass: {color: '#4CAF50'},
  checkFail: {color: '#F44336'},
  faceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  faceItem: {alignItems: 'center'},
  faceImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  noFacePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#EEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noFaceText: {fontSize: 11, color: '#999'},
  faceLabel: {fontSize: 11, color: '#666', marginTop: 6},
  vsText: {fontSize: 13, fontWeight: '700', color: '#1A237E'},
  auditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  auditStatus: {fontSize: 14, marginRight: 8, marginTop: 1},
  auditPass: {color: '#4CAF50'},
  auditFail: {color: '#F44336'},
  auditPending: {color: '#999'},
  auditInfo: {flex: 1},
  auditStep: {fontSize: 12, fontWeight: '600', color: '#333'},
  auditDetail: {fontSize: 11, color: '#999'},
  auditTime: {fontSize: 10, color: '#BBB'},
  policyNote: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  policyText: {fontSize: 12, color: '#E65100', lineHeight: 17},
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  exportBtn: {
    flex: 1,
    backgroundColor: '#E8EAF6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C5CAE9',
  },
  exportBtnText: {fontSize: 14, fontWeight: '700', color: '#1A237E'},
  exportBtnSub: {fontSize: 10, color: '#7986CB', marginTop: 2},
  newKycBtn: {
    flex: 1,
    backgroundColor: '#1A237E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newKycBtnText: {fontSize: 14, fontWeight: '700', color: '#fff'},
});

export default KYCResultScreen;
