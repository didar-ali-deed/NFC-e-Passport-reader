import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import NFCService from '../services/NFCService';
import type {MRZData, NFCReadResult, ScanStatus} from '../types/nfc';

interface ScanCardScreenProps {
  navigation: any;
  route: any;
}

const ScanCardScreen: React.FC<ScanCardScreenProps> = ({navigation, route}) => {
  const {mrzData} = route.params as {mrzData: MRZData};
  const [status, setStatus] = useState<ScanStatus>('waiting');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    startScan();
    return () => {
      NFCService.cleanup();
    };
  }, []);

  const startScan = async () => {
    setStatus('waiting');
    setErrorMessage('');

    try {
      setStatus('reading');
      const result = await NFCService.readIdCard(mrzData);
      setStatus('success');
      navigation.replace('Result', {result});
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error?.message || 'Failed to read NFC card');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'waiting':
      case 'reading':
        return <ActivityIndicator size="large" color="#1A237E" />;
      case 'success':
        return <Text style={styles.successIcon}>OK</Text>;
      case 'error':
        return <Text style={styles.errorIcon}>!</Text>;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'waiting':
        return 'Hold your ID card or passport\nagainst the back of your phone';
      case 'reading':
        return 'Reading NFC chip...\nDo not move the document';
      case 'success':
        return 'Card read successfully!';
      case 'error':
        return errorMessage || 'Failed to read card';
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.scanArea}>
        <View style={styles.iconContainer}>{getStatusIcon()}</View>
        <Text style={styles.statusText}>{getStatusText()}</Text>

        {status === 'waiting' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              The NFC chip is usually located in the center of the document.
              Try placing different areas of the card against your phone's NFC
              antenna.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bottomActions}>
        {status === 'error' && (
          <TouchableOpacity style={styles.retryButton} onPress={startScan}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => {
            NFCService.cleanup();
            navigation.goBack();
          }}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mrzInfo}>
        <Text style={styles.mrzLabel}>Document: {mrzData.documentNumber}</Text>
        <Text style={styles.mrzLabel}>DOB: {mrzData.dateOfBirth}</Text>
        <Text style={styles.mrzLabel}>Expiry: {mrzData.dateOfExpiry}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
    padding: 20,
  },
  scanArea: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8EAF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    fontSize: 48,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  errorIcon: {
    fontSize: 48,
    color: '#F44336',
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 20,
  },
  infoText: {
    fontSize: 13,
    color: '#1565C0',
    textAlign: 'center',
    lineHeight: 18,
  },
  bottomActions: {
    gap: 12,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1A237E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  mrzInfo: {
    backgroundColor: '#ECEFF1',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mrzLabel: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
  },
});

export default ScanCardScreen;
