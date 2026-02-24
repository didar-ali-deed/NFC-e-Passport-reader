import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  AppState,
} from 'react-native';
import {useIsFocused} from '@react-navigation/core';
import NFCService from '../services/NFCService';

interface HomeScreenProps {
  navigation: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({navigation}) => {
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [nfcEnabled, setNfcEnabled] = useState<boolean | null>(null);
  const isFocused = useIsFocused();

  const checkNFC = useCallback(async () => {
    try {
      const supported = await NFCService.init();
      setNfcSupported(supported);
      if (supported) {
        await new Promise<void>(r => setTimeout(r, 300));
        const enabled = await NFCService.isEnabled();
        setNfcEnabled(enabled);
      }
    } catch {
      setNfcSupported(false);
      setNfcEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      checkNFC();
    }
  }, [isFocused, checkNFC]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        checkNFC();
      }
    });
    return () => sub.remove();
  }, [checkNFC]);

  const requireNFC = (cb: () => void) => {
    if (!nfcEnabled) {
      Alert.alert('NFC Disabled', 'Please enable NFC in your device settings.', [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Open Settings', onPress: () => NFCService.goToNfcSettings()},
      ]);
      return;
    }
    cb();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Brand Header */}
      <View style={styles.brandHeader}>
        <View style={styles.logoContainer}>
          <View style={styles.logoShield}>
            <Text style={styles.logoX}>X</Text>
          </View>
        </View>
        <Text style={styles.brandName}>KYC-Xflow</Text>
        <Text style={styles.brandTagline}>
          NFC Passport Verification & Identity Check
        </Text>
      </View>

      {/* NFC Status Chip */}
      <TouchableOpacity
        style={[
          styles.nfcChip,
          nfcEnabled === true && styles.nfcChipOk,
          nfcEnabled === false && styles.nfcChipOff,
        ]}
        onPress={checkNFC}
        activeOpacity={0.7}>
        <View
          style={[
            styles.nfcDot,
            nfcEnabled === true && styles.nfcDotOk,
            nfcEnabled === false && styles.nfcDotOff,
          ]}
        />
        <Text style={styles.nfcChipText}>
          NFC:{' '}
          {nfcSupported === null
            ? 'Checking...'
            : !nfcSupported
            ? 'Not Supported'
            : nfcEnabled
            ? 'Ready'
            : 'Disabled'}
        </Text>
        <Text style={styles.nfcChipRefresh}>Tap to refresh</Text>
      </TouchableOpacity>

      {/* Main Action Card */}
      <TouchableOpacity
        style={styles.mainCard}
        onPress={() => requireNFC(() => navigation.navigate('Consent'))}
        disabled={!nfcSupported}
        activeOpacity={0.85}>
        <View style={styles.mainCardContent}>
          <View style={styles.mainCardLeft}>
            <Text style={styles.mainCardTitle}>Full KYC Verification</Text>
            <Text style={styles.mainCardSub}>
              Complete identity check with passport NFC + liveness detection
            </Text>
            <View style={styles.pipelineRow}>
              {['Consent', 'MRZ', 'NFC', 'Selfie', 'Result'].map((s, i) => (
                <View key={s} style={styles.pipelineItem}>
                  <View style={styles.pipelineDot}>
                    <Text style={styles.pipelineNum}>{i + 1}</Text>
                  </View>
                  <Text style={styles.pipelineLabel}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.mainCardArrow}>
            <Text style={styles.arrowText}>Go</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Quick Tools */}
      <Text style={styles.sectionTitle}>Quick Tools</Text>
      <View style={styles.quickGrid}>
        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => requireNFC(() => navigation.navigate('MRZInput'))}
          disabled={!nfcSupported}>
          <View style={[styles.quickIcon, {backgroundColor: '#1A237E'}]}>
            <Text style={styles.quickIconText}>P</Text>
          </View>
          <Text style={styles.quickTitle}>Passport Scan</Text>
          <Text style={styles.quickSub}>MRZ + NFC chip read</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => requireNFC(() => navigation.navigate('QuickScan'))}
          disabled={!nfcSupported}>
          <View style={[styles.quickIcon, {backgroundColor: '#0D47A1'}]}>
            <Text style={styles.quickIconText}>N</Text>
          </View>
          <Text style={styles.quickTitle}>NFC Tag Scan</Text>
          <Text style={styles.quickSub}>Read any NFC tag UID</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickGrid}>
        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => navigation.navigate('Dashboard')}>
          <View style={[styles.quickIcon, {backgroundColor: '#E65100'}]}>
            <Text style={styles.quickIconText}>D</Text>
          </View>
          <Text style={styles.quickTitle}>Dashboard</Text>
          <Text style={styles.quickSub}>Stats & analytics</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => navigation.navigate('History')}>
          <View style={[styles.quickIcon, {backgroundColor: '#4A148C'}]}>
            <Text style={styles.quickIconText}>H</Text>
          </View>
          <Text style={styles.quickTitle}>History</Text>
          <Text style={styles.quickSub}>Past verifications</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickGrid}>
        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => navigation.navigate('About')}>
          <View style={[styles.quickIcon, {backgroundColor: '#37474F'}]}>
            <Text style={styles.quickIconText}>i</Text>
          </View>
          <Text style={styles.quickTitle}>About</Text>
          <Text style={styles.quickSub}>App info & settings</Text>
        </TouchableOpacity>
        <View style={{flex: 1}} />
      </View>

      {/* How it works */}
      <View style={styles.howCard}>
        <Text style={styles.howTitle}>How KYC-Xflow works</Text>
        {[
          {num: '1', text: 'Scan MRZ zone on your passport'},
          {num: '2', text: 'NFC reads the encrypted passport chip'},
          {num: '3', text: 'Live selfie checks you are a real person'},
          {num: '4', text: 'AI matches your face with passport photo'},
          {num: '5', text: 'Instant KYC verification result'},
        ].map(item => (
          <View key={item.num} style={styles.howRow}>
            <View style={styles.howNum}>
              <Text style={styles.howNumText}>{item.num}</Text>
            </View>
            <Text style={styles.howText}>{item.text}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>
        KYC-Xflow v1.0 | ICAO 9303 compliant | GDPR ready
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  scrollContent: {padding: 20, paddingBottom: 40},
  brandHeader: {alignItems: 'center', marginBottom: 20, paddingTop: 8},
  logoContainer: {marginBottom: 10},
  logoShield: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#1A237E',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  logoX: {color: '#fff', fontSize: 28, fontWeight: '900'},
  brandName: {fontSize: 28, fontWeight: '900', color: '#1A237E', letterSpacing: 1},
  brandTagline: {fontSize: 13, color: '#666', marginTop: 4, textAlign: 'center'},

  nfcChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#E0E0E0',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 6,
  },
  nfcChipOk: {backgroundColor: '#E8F5E9'},
  nfcChipOff: {backgroundColor: '#FFEBEE'},
  nfcDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#999'},
  nfcDotOk: {backgroundColor: '#4CAF50'},
  nfcDotOff: {backgroundColor: '#F44336'},
  nfcChipText: {fontSize: 12, fontWeight: '600', color: '#333'},
  nfcChipRefresh: {fontSize: 10, color: '#999'},

  mainCard: {
    backgroundColor: '#B71C1C',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#B71C1C',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  mainCardContent: {flexDirection: 'row', alignItems: 'center'},
  mainCardLeft: {flex: 1},
  mainCardTitle: {fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 6},
  mainCardSub: {fontSize: 12, color: '#FFCDD2', lineHeight: 17, marginBottom: 12},
  pipelineRow: {flexDirection: 'row', gap: 4},
  pipelineItem: {alignItems: 'center'},
  pipelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipelineNum: {fontSize: 9, fontWeight: '700', color: '#fff'},
  pipelineLabel: {fontSize: 8, color: '#FFCDD2', marginTop: 2},
  mainCardArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  arrowText: {color: '#fff', fontWeight: '800', fontSize: 14},

  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },
  quickGrid: {flexDirection: 'row', gap: 12, marginBottom: 12},
  quickCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickIconText: {color: '#fff', fontWeight: '800', fontSize: 16},
  quickTitle: {fontSize: 13, fontWeight: '700', color: '#333'},
  quickSub: {fontSize: 11, color: '#999', marginTop: 2},

  howCard: {
    backgroundColor: '#E8EAF6',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  howTitle: {fontSize: 14, fontWeight: '700', color: '#1A237E', marginBottom: 12},
  howRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  howNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  howNumText: {color: '#fff', fontSize: 11, fontWeight: '700'},
  howText: {fontSize: 12, color: '#333', flex: 1},

  footer: {
    textAlign: 'center',
    fontSize: 10,
    color: '#BBB',
    marginTop: 4,
  },
});

export default HomeScreen;
