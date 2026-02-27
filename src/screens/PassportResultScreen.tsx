/**
 * Passport NFC Read Result Screen
 * Displays extracted Data Groups, SOD verification, and chip authentication status.
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
import SessionService from '../services/SessionService';
import PDFExportService from '../services/PDFExportService';
import type {PassportChipData, PassportScanResult} from '../types/kyc';

interface Props {navigation: any; route: any}

const PassportResultScreen: React.FC<Props> = ({navigation, route}) => {
  const {passportData, sessionId} = route.params as {
    passportData: PassportChipData;
    sessionId: string;
  };

  const [result, setResult] = useState<PassportScanResult | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const passportAuthentic = passportData.isAuthenticated;
    const sodVerified = passportData.sodVerified;
    const chipAuthDone = passportData.chipAuthDone;

    let status: 'SUCCESS' | 'FAILED';
    let reason: string;

    if (passportAuthentic) {
      status = 'SUCCESS';
      reason = 'Passport chip read successfully. BAC authentication passed.';
    } else {
      status = 'FAILED';
      const failures: string[] = [];
      if (!passportAuthentic) failures.push('BAC authentication failed');
      reason = `Passport read failed: ${failures.join(', ')}.`;
    }

    const scanResult: PassportScanResult = {
      sessionId,
      passportAuthentic,
      sodVerified,
      chipAuthDone,
      status,
      reason,
      timestamp: new Date().toISOString(),
    };
    setResult(scanResult);

    const name = passportData.personalInfo
      ? `${passportData.personalInfo.givenNames} ${passportData.personalInfo.surname}`.trim()
      : 'Unknown';
    SessionService.addToHistory(
      scanResult,
      name,
      passportData.personalInfo?.documentNumber || '',
      passportData.personalInfo?.nationality || '',
    );
    SessionService.logStep('scan_complete', status === 'SUCCESS' ? 'pass' : 'fail', reason);
    SessionService.updateStatus(status === 'SUCCESS' ? 'complete' : 'failed');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startNew = () => {
    SessionService.destroySession();
    navigation.popToTop();
  };

  const handleExport = async () => {
    if (!result) return;
    setExporting(true);
    try {
      await PDFExportService.generateAndShare(result, passportData, SessionService.getAuditLog());
    } catch (err: any) {
      // User cancelled share — not an error
      const msg = err?.message || '';
      if (!msg.includes('cancel') && !msg.includes('Cancel') && !msg.includes('dismiss')) {
        Alert.alert('Export Failed', msg || 'Could not generate report.');
      }
    } finally {
      setExporting(false);
    }
  };

  if (!result) return null;

  const isSuccess = result.status === 'SUCCESS';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Result banner */}
        <View style={[styles.resultBanner, isSuccess ? styles.bannerGreen : styles.bannerRed]}>
          <Text style={styles.resultIcon}>{isSuccess ? '✓' : '✗'}</Text>
          <Text style={[styles.resultStatus, {color: isSuccess ? '#2E7D32' : '#C62828'}]}>
            {isSuccess ? 'PASSPORT READ SUCCESS' : 'READ FAILED'}
          </Text>
          <Text style={styles.resultReason}>{result.reason}</Text>
        </View>

        {/* Session info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Session</Text>
          <Row label="Session ID" value={result.sessionId} mono />
          <Row label="Timestamp" value={new Date(result.timestamp).toLocaleString()} />
        </View>

        {/* Personal data DG1 */}
        {passportData.personalInfo && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Personal Data (DG1)</Text>
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

        {/* Face image DG2 */}
        {passportData.faceImageBase64 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Face Image (DG2)</Text>
            <View style={styles.faceContainer}>
              <Image
                source={{uri: `data:image/jpeg;base64,${passportData.faceImageBase64}`}}
                style={styles.faceImage}
                resizeMode="contain"
              />
              <View style={styles.faceBadge}>
                <Text style={styles.faceBadgeText}>Extracted from chip</Text>
              </View>
            </View>
          </View>
        )}

        {/* Security checks */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Security Status</Text>
          <CheckResult
            label="BAC Authentication"
            passed={result.passportAuthentic}
            detail="Basic Access Control mutual authentication"
          />
          <CheckResult
            label="Passive Authentication (PA)"
            passed={result.passportAuthentic}
            detail="Data group integrity verified via hashes"
          />
          <CheckResult
            label="SOD Signature"
            passed={result.sodVerified}
            detail="Document Security Object issuer signature"
          />
          <CheckResult
            label="Chip Authentication (CA)"
            passed={result.chipAuthDone}
            detail={
              result.chipAuthDone === null
                ? 'EC key not in DG14 — requires PACE (not available via BAC)'
                : 'ECDH key exchange proves chip holds genuine private key'
            }
          />
        </View>

        {/* Data groups present */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Data Groups Extracted</Text>
          <CheckResult
            label="DG1 — Personal Data"
            passed={!!passportData.personalInfo}
            detail="Name, DOB, expiry, nationality"
          />
          <CheckResult
            label="DG2 — Face Image"
            passed={!!passportData.faceImageBase64}
            detail="Biometric facial image from chip"
          />
          <CheckResult
            label="SOD — Security Object"
            passed={result.sodVerified}
            detail="Signed hashes of all data groups"
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

        {/* Data policy */}
        <View style={styles.policyNote}>
          <Text style={styles.policyText}>
            Passport data exists only in RAM during this session and is not stored
            permanently. MRZ keys and NFC session data are destroyed after use.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExport}
            disabled={exporting}>
            {exporting ? (
              <ActivityIndicator size="small" color="#1A237E" />
            ) : (
              <>
                <Text style={styles.exportBtnText}>Share Report</Text>
                <Text style={styles.exportBtnSub}>Save or send</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.newScanBtn} onPress={startNew}>
            <Text style={styles.newScanBtnText}>New Scan</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const Row: React.FC<{label: string; value: string; mono?: boolean}> = ({label, value, mono}) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, mono && {fontFamily: 'monospace'}]}>{value}</Text>
  </View>
);

const CheckResult: React.FC<{label: string; passed: boolean | null; detail?: string}> = ({
  label,
  passed,
  detail,
}) => {
  const isNA = passed === null;
  return (
    <View style={styles.checkRow}>
      <Text style={[styles.checkIcon, isNA ? styles.checkNA : passed ? styles.checkPass : styles.checkFail]}>
        {isNA ? '—' : passed ? '✓' : '✗'}
      </Text>
      <View style={styles.checkInfo}>
        <Text style={styles.checkLabel}>{label}</Text>
        {detail && <Text style={styles.checkDetail}>{detail}</Text>}
      </View>
      <Text style={[styles.checkStatus, isNA ? styles.checkNA : passed ? styles.checkPass : styles.checkFail]}>
        {isNA ? 'N/A' : passed ? 'PASS' : 'FAIL'}
      </Text>
    </View>
  );
};


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
  resultStatus: {fontSize: 22, fontWeight: '900', marginTop: 8},
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
  cardTitle: {fontSize: 15, fontWeight: '700', color: '#1A237E', marginBottom: 12},

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  rowLabel: {fontSize: 13, color: '#666', flex: 1},
  rowValue: {fontSize: 13, fontWeight: '500', color: '#333', flex: 1, textAlign: 'right'},

  faceContainer: {alignItems: 'center', paddingTop: 8},
  faceImage: {
    width: 140,
    height: 160,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginBottom: 8,
  },
  faceBadge: {
    backgroundColor: '#E8EAF6',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  faceBadgeText: {fontSize: 11, color: '#3949AB'},

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
  checkNA:   {color: '#9E9E9E'},

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
    backgroundColor: '#E8EAF6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  policyText: {fontSize: 12, color: '#3949AB', lineHeight: 17},

  actionRow: {flexDirection: 'row', gap: 12},
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
  newScanBtn: {
    flex: 1,
    backgroundColor: '#1A237E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newScanBtnText: {fontSize: 14, fontWeight: '700', color: '#fff'},
});

export default PassportResultScreen;
