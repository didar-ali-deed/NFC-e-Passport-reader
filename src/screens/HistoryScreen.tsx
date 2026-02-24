import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {useIsFocused} from '@react-navigation/core';
import SessionService, {type HistoryEntry} from '../services/SessionService';

const HistoryScreen: React.FC = () => {
  const isFocused = useIsFocused();
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    SessionService.getHistory(),
  );

  // Refresh when screen is focused
  React.useEffect(() => {
    if (isFocused) {
      setHistory(SessionService.getHistory());
    }
  }, [isFocused]);

  const handleClear = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all verification history?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            SessionService.clearHistory();
            setHistory([]);
          },
        },
      ],
    );
  };

  const renderItem = ({item}: {item: HistoryEntry}) => {
    const isVerified = item.result === 'VERIFIED';
    const date = new Date(item.timestamp);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.statusBadge,
              isVerified ? styles.badgeGreen : styles.badgeRed,
            ]}>
            <Text style={styles.statusText}>{item.result}</Text>
          </View>
          <Text style={styles.dateText}>
            {date.toLocaleDateString()} {date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{item.name || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Document</Text>
          <Text style={[styles.value, {fontFamily: 'monospace'}]}>
            {item.documentNumber || 'N/A'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Nationality</Text>
          <Text style={styles.value}>{item.nationality || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Session</Text>
          <Text style={[styles.value, {fontFamily: 'monospace', fontSize: 10}]}>
            {item.sessionId}
          </Text>
        </View>

        <Text style={styles.reason}>{item.reason}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {history.length > 0 ? (
        <>
          <View style={styles.topBar}>
            <Text style={styles.countText}>
              {history.length} verification{history.length !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={history}
            keyExtractor={item => item.sessionId}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
          />
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>H</Text>
          <Text style={styles.emptyTitle}>No Verifications Yet</Text>
          <Text style={styles.emptySub}>
            Complete a KYC verification to see it here.{'\n'}
            History is stored in memory for this session.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  countText: {fontSize: 13, fontWeight: '600', color: '#666'},
  clearBtn: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  clearBtnText: {fontSize: 12, fontWeight: '600', color: '#F44336'},
  listContent: {padding: 20, paddingTop: 0},
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  badgeGreen: {backgroundColor: '#E8F5E9'},
  badgeRed: {backgroundColor: '#FFEBEE'},
  statusText: {fontSize: 11, fontWeight: '800'},
  dateText: {fontSize: 11, color: '#999'},
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  label: {fontSize: 12, color: '#666'},
  value: {fontSize: 12, fontWeight: '500', color: '#333'},
  reason: {fontSize: 11, color: '#888', marginTop: 8, fontStyle: 'italic'},

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    color: '#E0E0E0',
    marginBottom: 16,
    fontWeight: '900',
  },
  emptyTitle: {fontSize: 18, fontWeight: '700', color: '#666', marginBottom: 8},
  emptySub: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default HistoryScreen;
