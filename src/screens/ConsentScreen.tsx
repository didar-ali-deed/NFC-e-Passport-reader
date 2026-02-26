/**
 * Step 1: User Consent — Terms & Conditions
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

  const handleStart = () => {
    if (!agreed || !dataProcessing) {
      Alert.alert(
        'Consent Required',
        'You must agree to both items to proceed.',
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
        <Text style={styles.headerIcon}>NFC</Text>
        <Text style={styles.title}>Terms & Conditions</Text>
        <Text style={styles.subtitle}>NFC Passport Reader | ICAO 9303</Text>
      </View>

      {/* What we read */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What this app reads</Text>
        {[
          {icon: '📄', text: 'Passport MRZ (Machine Readable Zone) — used to generate BAC key'},
          {icon: '🔐', text: 'NFC chip data via Basic Access Control (BAC)'},
          {icon: '👤', text: 'DG1 — personal data (name, DOB, nationality, document number)'},
          {icon: '🖼', text: 'DG2 — biometric face image stored on the chip'},
          {icon: '🔏', text: 'SOD — Document Security Object (digital signatures)'},
        ].map((item, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bulletIcon}>{item.icon}</Text>
            <Text style={styles.bulletText}>{item.text}</Text>
          </View>
        ))}
      </View>

      {/* Data policy */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Data Policy</Text>
        <Text style={styles.bodyText}>
          All passport data is processed <Text style={styles.bold}>exclusively in device RAM</Text>{' '}
          during this session. No passport data, face images, or NFC keys are stored
          to disk or transmitted to any server.{'\n\n'}
          MRZ-derived BAC keys and NFC session data are destroyed immediately after
          the chip reading completes.{'\n\n'}
          Only an anonymised scan log (session ID, timestamp, pass/fail status) is
          retained in memory for the duration of the app session.
        </Text>
      </View>

      {/* Consent toggles */}
      <View style={styles.consentBox}>
        <View style={styles.consentRow}>
          <View style={styles.consentTextBox}>
            <Text style={styles.consentLabel}>
              I consent to NFC passport reading
            </Text>
            <Text style={styles.consentSub}>
              I agree to have my passport chip read using the above-listed data groups
              for the purposes of identity document verification.
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
              I consent to temporary data processing
            </Text>
            <Text style={styles.consentSub}>
              I understand that passport data will be temporarily processed
              in device memory and not stored permanently.
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
        <Text style={styles.cardTitle}>Scan Steps</Text>
        {[
          'Scan MRZ zone on your passport (camera or manual entry)',
          'Tap phone on passport — BAC unlocks the NFC chip',
          'App reads DG1, DG2, and SOD from the chip',
          'Chip authentication and signature verification',
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
        onPress={handleStart}
        disabled={!agreed || !dataProcessing}>
        <Text style={styles.startButtonText}>Start Passport Scan</Text>
      </TouchableOpacity>

      <Text style={styles.footerText}>
        A session ID is generated on start. All data processed under ICAO 9303 and
        ISO 14443-4 protocols.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  content: {padding: 20, paddingBottom: 40},
  header: {alignItems: 'center', marginBottom: 24, paddingTop: 10},
  headerIcon: {fontSize: 36, fontWeight: '900', color: '#1A237E', marginBottom: 8},
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
