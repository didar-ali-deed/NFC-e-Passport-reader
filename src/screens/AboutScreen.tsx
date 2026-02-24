import React from 'react';
import {View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity} from 'react-native';

const AboutScreen: React.FC = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Logo */}
      <View style={styles.logoSection}>
        <View style={styles.logoShield}>
          <Text style={styles.logoX}>X</Text>
        </View>
        <Text style={styles.appName}>KYC-Xflow</Text>
        <Text style={styles.version}>Version 1.0.0</Text>
      </View>

      {/* Description */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>About</Text>
        <Text style={styles.bodyText}>
          KYC-Xflow is a mobile identity verification app that reads NFC-enabled
          passports following the ICAO 9303 international standard. It performs
          full KYC (Know Your Customer) verification through passport chip reading,
          liveness detection, and face matching.
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
          ['Camera/OCR', 'Vision Camera + ML Kit'],
          ['Liveness', 'AI-based face detection'],
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
          'ISO 14443-4 (NFC Proximity Cards)',
          'GDPR (General Data Protection Regulation)',
          'ISO 9797-1 (Message Authentication Codes)',
        ].map((std, i) => (
          <View key={i} style={styles.stdRow}>
            <Text style={styles.stdCheck}>*</Text>
            <Text style={styles.stdText}>{std}</Text>
          </View>
        ))}
      </View>

      {/* Security */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Security & Privacy</Text>
        <Text style={styles.bodyText}>
          All biometric data (face images, passport data) is processed in memory
          only and never stored permanently. MRZ keys and NFC session data are
          destroyed immediately after the verification session ends.{'\n\n'}
          Only the verification result (VERIFIED / REJECTED) and an encrypted audit
          log are retained.
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
        KYC-Xflow | ICAO 9303 Compliant | GDPR Ready
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
  logoX: {color: '#fff', fontSize: 32, fontWeight: '900'},
  appName: {fontSize: 24, fontWeight: '900', color: '#1A237E'},
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
