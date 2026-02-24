import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import type {MRZData} from '../types/nfc';

interface MRZInputScreenProps {
  navigation: any;
}

const MRZInputScreen: React.FC<MRZInputScreenProps> = ({navigation}) => {
  const [documentNumber, setDocumentNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [dateOfExpiry, setDateOfExpiry] = useState('');

  const validateAndProceed = () => {
    if (!documentNumber.trim()) {
      Alert.alert('Error', 'Please enter the document number.');
      return;
    }
    if (!/^\d{6}$/.test(dateOfBirth)) {
      Alert.alert('Error', 'Date of birth must be in YYMMDD format (e.g., 950115).');
      return;
    }
    if (!/^\d{6}$/.test(dateOfExpiry)) {
      Alert.alert('Error', 'Date of expiry must be in YYMMDD format (e.g., 301231).');
      return;
    }

    const mrzData: MRZData = {
      documentNumber: documentNumber.trim().toUpperCase(),
      dateOfBirth,
      dateOfExpiry,
    };

    navigation.navigate('ScanCard', {mrzData});
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <Text style={styles.title}>Enter MRZ Data</Text>
        <Text style={styles.description}>
          Enter the information from the Machine-Readable Zone (MRZ) at the
          bottom of your ID card or passport. This data is required to
          establish a secure connection with the NFC chip (BAC protocol).
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Document Number</Text>
          <TextInput
            style={styles.input}
            value={documentNumber}
            onChangeText={setDocumentNumber}
            placeholder="e.g., AB1234567"
            placeholderTextColor="#999"
            autoCapitalize="characters"
            maxLength={20}
          />
          <Text style={styles.hint}>
            Found in the first line of the MRZ
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date of Birth (YYMMDD)</Text>
          <TextInput
            style={styles.input}
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="e.g., 950115"
            placeholderTextColor="#999"
            keyboardType="numeric"
            maxLength={6}
          />
          <Text style={styles.hint}>
            Year-Month-Day format, e.g., 950115 for Jan 15, 1995
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date of Expiry (YYMMDD)</Text>
          <TextInput
            style={styles.input}
            value={dateOfExpiry}
            onChangeText={setDateOfExpiry}
            placeholder="e.g., 301231"
            placeholderTextColor="#999"
            keyboardType="numeric"
            maxLength={6}
          />
          <Text style={styles.hint}>
            Year-Month-Day format, e.g., 301231 for Dec 31, 2030
          </Text>
        </View>

        <TouchableOpacity
          style={styles.scanButton}
          onPress={validateAndProceed}>
          <Text style={styles.scanButtonText}>Proceed to Scan</Text>
        </TouchableOpacity>

        <View style={styles.mrzInfoCard}>
          <Text style={styles.mrzInfoTitle}>Where to find MRZ data?</Text>
          <Text style={styles.mrzInfoText}>
            The MRZ is the two or three lines of text at the bottom of your
            passport data page or ID card. It contains {'<'} characters and
            looks like:{'\n\n'}
            P{'<'}UTOERIKSSON{'<<'}ANNA{'<<<<<<<<<<<<<<'}...{'\n'}
            L898902C36UTO7408122F1204159{'<<<'}...
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A237E',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  scanButton: {
    backgroundColor: '#1A237E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  scanButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  mrzInfoCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
  },
  mrzInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 8,
  },
  mrzInfoText: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

export default MRZInputScreen;
