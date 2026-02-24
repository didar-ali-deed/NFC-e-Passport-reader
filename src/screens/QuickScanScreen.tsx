import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import NFCService from '../services/NFCService';

interface QuickScanScreenProps {
  navigation: any;
}

const QuickScanScreen: React.FC<QuickScanScreenProps> = ({navigation}) => {
  const [scanning, setScanning] = useState(true);
  const [tagUid, setTagUid] = useState<string | null>(null);
  const [techTypes, setTechTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    scanTag();
    return () => {
      NFCService.cleanup();
    };
  }, []);

  const scanTag = async () => {
    setScanning(true);
    setTagUid(null);
    setTechTypes([]);
    setError(null);

    try {
      const result = await NFCService.scanTag();
      setTagUid(result.uid);
      setTechTypes(result.techTypes);
      setScanning(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to scan');
      setScanning(false);
    }
  };

  return (
    <View style={styles.container}>
      {scanning ? (
        <View style={styles.scanningArea}>
          <ActivityIndicator size="large" color="#1A237E" />
          <Text style={styles.scanningText}>
            Hold an NFC tag or card{'\n'}near your phone
          </Text>
        </View>
      ) : tagUid ? (
        <View style={styles.resultArea}>
          <Text style={styles.successTitle}>Tag Detected</Text>

          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>UID</Text>
            <Text style={styles.resultValue}>{tagUid}</Text>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Technologies</Text>
            {techTypes.map((tech, index) => (
              <Text key={index} style={styles.techItem}>
                {tech.split('.').pop()}
              </Text>
            ))}
          </View>

          <TouchableOpacity style={styles.scanAgainButton} onPress={scanTag}>
            <Text style={styles.scanAgainText}>Scan Another</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.errorArea}>
          <Text style={styles.errorText}>{error || 'No tag found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={scanTag}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    padding: 20,
    justifyContent: 'center',
  },
  scanningArea: {
    alignItems: 'center',
  },
  scanningText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 26,
  },
  resultArea: {
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 24,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resultLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'monospace',
  },
  techItem: {
    fontSize: 14,
    color: '#1A237E',
    paddingVertical: 2,
  },
  scanAgainButton: {
    backgroundColor: '#1A237E',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  scanAgainText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorArea: {
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1A237E',
    borderRadius: 12,
    padding: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default QuickScanScreen;
