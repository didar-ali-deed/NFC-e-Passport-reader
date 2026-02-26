import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';

const AboutScreen: React.FC = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Logo */}
      <View style={styles.logoSection}>
        <View style={styles.logoShield}>
          <Text style={styles.logoIcon}>NFC</Text>
        </View>
        <Text style={styles.appName}>NFC Passport Reader</Text>
        <Text style={styles.version}>Version 1.0.0</Text>
      </View>

      {/* Description */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>About</Text>
        <Text style={styles.bodyText}>
          NFC Passport Reader is a mobile app that reads NFC-enabled e-Passports
          following the ICAO 9303 international standard. It uses Basic Access
          Control (BAC) to securely authenticate and extract passport chip data
          including personal information (DG1), biometric face image (DG2), and
          the Document Security Object (SOD) for signature verification.
        </Text>
      </View>

      {/* Tech Stack */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Technology</Text>
        {[
          ['Framework', 'React Native 0.84'],
          ['NFC Protocol', 'ISO 14443-4 (IsoDep)'],
          ['Auth Protocol', 'ICAO 9303 BAC + Secure Messaging'],
          ['Cryptography', '3DES-CBC, SHA-1, ISO 9797-1 MAC'],
          ['Camera/OCR', 'Vision Camera + ML Kit (MRZ scan)'],
          ['NFC Library', 'react-native-nfc-manager'],
        ].map(([label, value]) => (
          <View key={label} style={styles.techRow}>
            <Text style={styles.techLabel}>{label}</Text>
            <Text style={styles.techValue}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Standards */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Compliance</Text>
        {[
          'ICAO 9303 (Machine Readable Travel Documents)',
          'ISO 14443-4 (NFC Proximity Cards — IsoDep)',
          'ISO 9797-1 (Message Authentication Codes)',
          'BSI TR-03110 (BAC / Secure Messaging)',
        ].map((std, i) => (
          <View key={i} style={styles.stdRow}>
            <Text style={styles.stdCheck}>✓</Text>
            <Text style={styles.stdText}>{std}</Text>
          </View>
        ))}
      </View>

      {/* Security */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Security & Privacy</Text>
        <Text style={styles.bodyText}>
          All passport data (DG1, DG2, SOD) is processed in device RAM only and
          never written to disk or transmitted to any external server.{'\n\n'}
          MRZ-derived BAC keys and NFC Secure Messaging session keys are destroyed
          immediately after the chip reading session ends.{'\n\n'}
          Only a minimal scan audit log (session ID, timestamp, pass/fail result)
          is retained in memory for the duration of the app session.
        </Text>
      </View>

      {/* Credits */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Credits</Text>
        <Text style={styles.bodyText}>
          Built with Claude AI (Anthropic){'\n'}
          NFC: react-native-nfc-manager{'\n'}
          Camera: react-native-vision-camera{'\n'}
          OCR: @react-native-ml-kit/text-recognition{'\n'}
          Crypto: crypto-js
        </Text>
      </View>

      <Text style={styles.footer}>
        NFC Passport Reader | ICAO 9303 | ISO 14443-4
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  content: {padding: 20, paddingBottom: 40},
  logoSection: {alignItems: 'center', marginBottom: 24, paddingTop: 10},
  logoShield: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#1A237E',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginBottom: 10,
  },
  logoIcon: {color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1},
  appName: {fontSize: 22, fontWeight: '900', color: '#1A237E'},
  version: {fontSize: 13, color: '#999', marginTop: 2},
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
  cardTitle: {fontSize: 15, fontWeight: '700', color: '#1A237E', marginBottom: 10},
  bodyText: {fontSize: 13, color: '#444', lineHeight: 20},
  techRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  techLabel: {fontSize: 13, color: '#666'},
  techValue: {fontSize: 13, fontWeight: '500', color: '#333', flex: 1, textAlign: 'right'},
  stdRow: {flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6},
  stdCheck: {fontSize: 14, color: '#4CAF50', marginRight: 8, marginTop: 1},
  stdText: {fontSize: 13, color: '#444', flex: 1, lineHeight: 18},
  footer: {textAlign: 'center', fontSize: 10, color: '#BBB', marginTop: 8},
});

export default AboutScreen;
