/**
 * Step 1: User Consent & Session Creation
 */
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import SessionService from '../services/SessionService';

interface Props {navigation: any}

const ConsentScreen: React.FC<Props> = ({navigation}) => {
  const [agreed, setAgreed] = useState(false);
  const [dataProcessing, setDataProcessing] = useState(false);

  const handleStartKYC = () => {
    if (!agreed || !dataProcessing) {
      Alert.alert(
        'Consent Required',
        'You must agree to both consent items to proceed.',
      );
      return;
    }

    const session = SessionService.createSession();
    SessionService.recordConsent();

    navigation.navigate('MRZScanner', {sessionId: session.sessionId});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>Xflow</Text>
        <Text style={styles.title}>Identity Verification</Text>
        <Text style={styles.subtitle}>KYC-Xflow | NFC Passport + Liveness</Text>
      </View>

      {/* What we collect */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What we verify</Text>
        {[
          {icon: '📄', text: 'Your passport MRZ (Machine Readable Zone)'},
          {icon: '🔐', text: 'NFC chip data from your e-Passport'},
          {icon: '📸', text: 'A live selfie for liveness detection'},
          {icon: '✅', text: 'Face match between passport and selfie'},
        ].map((item, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bulletIcon}>{item.icon}</Text>
            <Text style={styles.bulletText}>{item.text}</Text>
          </View>
        ))}
      </View>

      {/* Privacy policy */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Privacy & Data Policy</Text>
        <Text style={styles.bodyText}>
          Your biometric data (face image, passport data) is processed
          exclusively for identity verification purposes. We do{' '}
          <Text style={styles.bold}>NOT</Text> store raw biometric data after
          verification is complete.{'\n\n'}
          Only the verification result (VERIFIED / REJECTED) and a session
          audit log are retained, encrypted with AES-256, in compliance with
          GDPR and Pakistan's Data Protection framework.{'\n\n'}
          Your MRZ data and NFC keys exist{' '}
          <Text style={styles.bold}>only in RAM</Text> and are destroyed
          immediately after the NFC session ends.
        </Text>
      </View>

      {/* Consent toggles */}
      <View style={styles.consentBox}>
        <View style={styles.consentRow}>
          <View style={styles.consentTextBox}>
            <Text style={styles.consentLabel}>
              I consent to identity verification
            </Text>
            <Text style={styles.consentSub}>
              I agree to have my identity verified using my passport and
              biometric data for KYC purposes.
            </Text>
          </View>
          <Switch
            value={agreed}
            onValueChange={setAgreed}
            trackColor={{false: '#ccc', true: '#1A237E'}}
            thumbColor={agreed ? '#fff' : '#f4f3f4'}
          />
        </View>

        <View style={[styles.consentRow, {marginTop: 16}]}>
          <View style={styles.consentTextBox}>
            <Text style={styles.consentLabel}>
              I consent to data processing
            </Text>
            <Text style={styles.consentSub}>
              I understand my biometric data will be temporarily processed and
              not stored permanently.
            </Text>
          </View>
          <Switch
            value={dataProcessing}
            onValueChange={setDataProcessing}
            trackColor={{false: '#ccc', true: '#1A237E'}}
            thumbColor={dataProcessing ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Steps overview */}
      <View style={styles.stepsCard}>
        <Text style={styles.cardTitle}>Verification Steps</Text>
        {[
          'Scan MRZ on your passport',
          'Tap phone on passport for NFC read',
          'Take a live selfie',
          'Receive instant KYC result',
        ].map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {/* Start button */}
      <TouchableOpacity
        style={[
          styles.startButton,
          (!agreed || !dataProcessing) && styles.disabledButton,
        ]}
        onPress={handleStartKYC}
        disabled={!agreed || !dataProcessing}>
        <Text style={styles.startButtonText}>Start KYC Verification</Text>
      </TouchableOpacity>

      <Text style={styles.footerText}>
        Session ID will be generated on start. All data processed under
        ICAO 9303 and GDPR guidelines.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  content: {padding: 20, paddingBottom: 40},
  header: {alignItems: 'center', marginBottom: 24, paddingTop: 10},
  headerIcon: {fontSize: 48, marginBottom: 8},
  title: {fontSize: 26, fontWeight: 'bold', color: '#1A237E'},
  subtitle: {fontSize: 14, color: '#666', marginTop: 4},
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
  bulletRow: {flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10},
  bulletIcon: {fontSize: 18, marginRight: 10, marginTop: 1},
  bulletText: {fontSize: 14, color: '#333', flex: 1, lineHeight: 20},
  bodyText: {fontSize: 13, color: '#444', lineHeight: 20},
  bold: {fontWeight: '700'},
  consentBox: {
    backgroundColor: '#E8EAF6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  consentRow: {flexDirection: 'row', alignItems: 'center'},
  consentTextBox: {flex: 1, marginRight: 12},
  consentLabel: {fontSize: 14, fontWeight: '600', color: '#1A237E'},
  consentSub: {fontSize: 12, color: '#555', marginTop: 3, lineHeight: 17},
  stepsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  stepRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 12},
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumText: {color: '#fff', fontWeight: '700', fontSize: 13},
  stepText: {fontSize: 14, color: '#333', flex: 1},
  startButton: {
    backgroundColor: '#1A237E',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledButton: {backgroundColor: '#9E9E9E'},
  startButtonText: {fontSize: 17, fontWeight: '700', color: '#fff'},
  footerText: {fontSize: 11, color: '#999', textAlign: 'center', lineHeight: 16},
});

export default ConsentScreen;
