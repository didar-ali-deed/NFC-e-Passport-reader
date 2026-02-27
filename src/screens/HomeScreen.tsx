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
import NfcManager from 'react-native-nfc-manager';

interface HomeScreenProps {
  navigation: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({navigation}) => {
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [nfcEnabled, setNfcEnabled] = useState<boolean | null>(null);
  const isFocused = useIsFocused();

  const checkNFC = useCallback(async () => {
    try {
      const supported = await NfcManager.isSupported();
      setNfcSupported(supported);
      if (supported) {
        await NfcManager.start();
        await new Promise<void>(r => setTimeout(r, 300));
        const enabled = await NfcManager.isEnabled();
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
        {text: 'Open Settings', onPress: () => NfcManager.goToNfcSetting()},
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
            <Text style={styles.logoIcon}>NFC</Text>
          </View>
        </View>
        <Text style={styles.brandName}>NFC Passport Reader</Text>
        <Text style={styles.brandTagline}>
          e-Passport chip reading via ICAO 9303 BAC
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
            <Text style={styles.mainCardTitle}>Scan e-Passport</Text>
            <Text style={styles.mainCardSub}>
              Read NFC chip data: DG1, DG2, SOD with BAC authentication
            </Text>
            <View style={styles.pipelineRow}>
              {['Consent', 'MRZ', 'NFC', 'Result'].map((s, i) => (
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
          <Text style={styles.quickSub}>Past scans</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => navigation.navigate('About')}>
          <View style={[styles.quickIcon, {backgroundColor: '#37474F'}]}>
            <Text style={styles.quickIconText}>i</Text>
          </View>
          <Text style={styles.quickTitle}>About</Text>
          <Text style={styles.quickSub}>App info & standards</Text>
        </TouchableOpacity>
      </View>

      {/* How it works */}
      <View style={styles.howCard}>
        <Text style={styles.howTitle}>How it works</Text>
        {[
          {num: '1', text: 'Accept Terms & Conditions'},
          {num: '2', text: 'Scan MRZ zone on your passport (camera or manual)'},
          {num: '3', text: 'Tap phone on passport — BAC key unlocks the NFC chip'},
          {num: '4', text: 'App reads DG1 (personal data), DG2 (face), SOD (signatures)'},
          {num: '5', text: 'Chip authentication & SOD signature are verified'},
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
        NFC Passport Reader v1.0 | ICAO 9303 compliant | ISO 14443-4
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
    width: 64,
    height: 64,
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
  logoIcon: {color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1},
  brandName: {fontSize: 24, fontWeight: '900', color: '#1A237E', letterSpacing: 0.5},
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
    backgroundColor: '#1A237E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#1A237E',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  mainCardContent: {flexDirection: 'row', alignItems: 'center'},
  mainCardLeft: {flex: 1},
  mainCardTitle: {fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 6},
  mainCardSub: {fontSize: 12, color: '#C5CAE9', lineHeight: 17, marginBottom: 12},
  pipelineRow: {flexDirection: 'row', gap: 6},
  pipelineItem: {alignItems: 'center'},
  pipelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipelineNum: {fontSize: 9, fontWeight: '700', color: '#fff'},
  pipelineLabel: {fontSize: 8, color: '#C5CAE9', marginTop: 2},
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
