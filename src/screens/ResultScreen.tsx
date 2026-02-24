import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import type {NFCReadResult} from '../types/nfc';

interface ResultScreenProps {
  navigation: any;
  route: any;
}

const ResultScreen: React.FC<ResultScreenProps> = ({navigation, route}) => {
  const {result} = route.params as {result: NFCReadResult};

  const renderDataField = (label: string, value: string | undefined) => {
    if (!value) return null;
    return (
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{value}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.headerIcon}>
            {result.isAuthenticated ? 'VERIFIED' : 'UNVERIFIED'}
          </Text>
          <Text style={styles.headerTitle}>
            {result.isAuthenticated
              ? 'Document Verified'
              : 'Verification Pending'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {result.isAuthenticated
              ? 'Passive Authentication passed'
              : 'Could not fully authenticate'}
          </Text>
        </View>

        {result.personalInfo && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Personal Information (DG1)</Text>
            {renderDataField('Surname', result.personalInfo.surname)}
            {renderDataField('Given Names', result.personalInfo.givenNames)}
            {renderDataField('Document Number', result.personalInfo.documentNumber)}
            {renderDataField('Nationality', result.personalInfo.nationality)}
            {renderDataField('Date of Birth', result.personalInfo.dateOfBirth)}
            {renderDataField('Sex', result.personalInfo.sex)}
            {renderDataField('Date of Expiry', result.personalInfo.dateOfExpiry)}
            {renderDataField('Issuing State', result.personalInfo.issuingState)}
            {result.personalInfo.rawMRZ &&
              renderDataField('Raw MRZ', result.personalInfo.rawMRZ)}
          </View>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Security Status</Text>
          <View style={styles.securityRow}>
            <Text style={styles.securityLabel}>Passive Authentication</Text>
            <Text
              style={[
                styles.securityStatus,
                {color: result.isAuthenticated ? '#4CAF50' : '#FF9800'},
              ]}>
              {result.isAuthenticated ? 'Passed' : 'Pending'}
            </Text>
          </View>
          <View style={styles.securityRow}>
            <Text style={styles.securityLabel}>Chip Authentication</Text>
            <Text style={[styles.securityStatus, {color: '#FF9800'}]}>
              Not Available
            </Text>
          </View>
          <View style={styles.securityRow}>
            <Text style={styles.securityLabel}>Extended Access Control</Text>
            <Text style={[styles.securityStatus, {color: '#999'}]}>
              Requires authorized reader
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Data Groups Read</Text>
          <Text style={styles.dgInfo}>
            DG1 (Personal Info): {result.personalInfo ? 'Read' : 'Not read'}{'\n'}
            DG2 (Face Image): {result.faceImageBase64 ? 'Read' : 'Not read'}{'\n'}
            DG3 (Fingerprints): Protected by EAC{'\n'}
            DG4 (Iris): Protected by EAC
          </Text>
        </View>

        {Object.keys(result.rawData).length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Raw Data</Text>
            <Text style={styles.rawDataText}>
              {JSON.stringify(result.rawData, null, 2)}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => navigation.popToTop()}>
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </TouchableOpacity>
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
  headerCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIcon: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A237E',
    marginBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  fieldLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  securityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  securityLabel: {
    fontSize: 14,
    color: '#666',
  },
  securityStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  dgInfo: {
    fontSize: 13,
    color: '#555',
    lineHeight: 22,
  },
  rawDataText: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  homeButton: {
    backgroundColor: '#1A237E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ResultScreen;
