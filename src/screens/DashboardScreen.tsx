import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {useIsFocused} from '@react-navigation/core';
import SessionService, {type HistoryEntry} from '../services/SessionService';

const DashboardScreen: React.FC = () => {
  const isFocused = useIsFocused();
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);

  React.useEffect(() => {
    if (isFocused) {
      setHistory(SessionService.getHistory());
    }
  }, [isFocused]);

  const total = history.length;
  const verified = history.filter(h => h.result === 'VERIFIED').length;
  const rejected = history.filter(h => h.result === 'REJECTED').length;
  const passRate = total > 0 ? Math.round((verified / total) * 100) : 0;

  // Nationality breakdown
  const natMap: Record<string, number> = {};
  history.forEach(h => {
    const nat = h.nationality || 'Unknown';
    natMap[nat] = (natMap[nat] || 0) + 1;
  });
  const topNationalities = Object.entries(natMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Recent activity (last 7 days)
  const now = Date.now();
  const dayMs = 86400000;
  const last7 = Array.from({length: 7}, (_, i) => {
    const dayStart = now - (6 - i) * dayMs;
    const dayEnd = dayStart + dayMs;
    const count = history.filter(h => {
      const t = new Date(h.timestamp).getTime();
      return t >= dayStart && t < dayEnd;
    }).length;
    const d = new Date(dayStart);
    return {
      label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
      count,
    };
  });
  const maxCount = Math.max(...last7.map(d => d.count), 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.statCard, {backgroundColor: '#E8EAF6'}]}>
          <Text style={[styles.statNumber, {color: '#1A237E'}]}>{total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, {backgroundColor: '#E8F5E9'}]}>
          <Text style={[styles.statNumber, {color: '#2E7D32'}]}>{verified}</Text>
          <Text style={styles.statLabel}>Verified</Text>
        </View>
        <View style={[styles.statCard, {backgroundColor: '#FFEBEE'}]}>
          <Text style={[styles.statNumber, {color: '#C62828'}]}>{rejected}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
      </View>

      {/* Pass Rate */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pass Rate</Text>
        <View style={styles.rateRow}>
          <Text style={styles.rateNumber}>{passRate}%</Text>
          <View style={styles.rateBarOuter}>
            <View
              style={[
                styles.rateBarInner,
                {
                  width: `${passRate}%`,
                  backgroundColor: passRate >= 70 ? '#4CAF50' : passRate >= 40 ? '#FF9800' : '#F44336',
                },
              ]}
            />
          </View>
        </View>
        {total === 0 && (
          <Text style={styles.emptyHint}>
            Complete a KYC verification to see statistics here.
          </Text>
        )}
      </View>

      {/* Activity Chart (text-based bar chart) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Last 7 Days Activity</Text>
        <View style={styles.chartContainer}>
          {last7.map((day, i) => (
            <View key={i} style={styles.chartColumn}>
              <Text style={styles.chartCount}>{day.count || ''}</Text>
              <View style={styles.chartBarOuter}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: day.count > 0 ? `${(day.count / maxCount) * 100}%` : 4,
                      backgroundColor: day.count > 0 ? '#1A237E' : '#E0E0E0',
                    },
                  ]}
                />
              </View>
              <Text style={styles.chartLabel}>{day.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Result Breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Result Breakdown</Text>
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownDot, {backgroundColor: '#4CAF50'}]} />
            <Text style={styles.breakdownLabel}>Verified</Text>
            <Text style={styles.breakdownValue}>{verified}</Text>
          </View>
          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownDot, {backgroundColor: '#F44336'}]} />
            <Text style={styles.breakdownLabel}>Rejected</Text>
            <Text style={styles.breakdownValue}>{rejected}</Text>
          </View>
        </View>
        {total > 0 && (
          <View style={styles.stackedBar}>
            <View
              style={[
                styles.stackedGreen,
                {flex: verified || 0.01},
              ]}
            />
            <View
              style={[
                styles.stackedRed,
                {flex: rejected || 0.01},
              ]}
            />
          </View>
        )}
      </View>

      {/* Top Nationalities */}
      {topNationalities.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top Nationalities</Text>
          {topNationalities.map(([nat, count], i) => (
            <View key={nat} style={styles.natRow}>
              <Text style={styles.natRank}>{i + 1}</Text>
              <Text style={styles.natName}>{nat}</Text>
              <View style={styles.natBarOuter}>
                <View
                  style={[
                    styles.natBarInner,
                    {width: `${(count / total) * 100}%`},
                  ]}
                />
              </View>
              <Text style={styles.natCount}>{count}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.footer}>
        Statistics are based on in-memory session data.{'\n'}
        Data resets when the app is closed.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  content: {padding: 20, paddingBottom: 40},

  summaryRow: {flexDirection: 'row', gap: 10, marginBottom: 16},
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statNumber: {fontSize: 32, fontWeight: '900'},
  statLabel: {fontSize: 12, color: '#666', marginTop: 4, fontWeight: '600'},

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
  cardTitle: {fontSize: 15, fontWeight: '700', color: '#1A237E', marginBottom: 12},

  rateRow: {flexDirection: 'row', alignItems: 'center', gap: 14},
  rateNumber: {fontSize: 36, fontWeight: '900', color: '#1A237E', minWidth: 70},
  rateBarOuter: {
    flex: 1,
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  rateBarInner: {height: '100%', borderRadius: 6},
  emptyHint: {fontSize: 12, color: '#999', marginTop: 10, textAlign: 'center'},

  chartContainer: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120},
  chartColumn: {flex: 1, alignItems: 'center'},
  chartCount: {fontSize: 10, color: '#1A237E', fontWeight: '700', marginBottom: 4, minHeight: 14},
  chartBarOuter: {width: 20, height: 80, justifyContent: 'flex-end'},
  chartBar: {width: '100%', borderRadius: 4, minHeight: 4},
  chartLabel: {fontSize: 10, color: '#999', marginTop: 4},

  breakdownRow: {flexDirection: 'row', gap: 20, marginBottom: 12},
  breakdownItem: {flexDirection: 'row', alignItems: 'center', gap: 6},
  breakdownDot: {width: 10, height: 10, borderRadius: 5},
  breakdownLabel: {fontSize: 13, color: '#666'},
  breakdownValue: {fontSize: 13, fontWeight: '700', color: '#333'},
  stackedBar: {flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden'},
  stackedGreen: {backgroundColor: '#4CAF50'},
  stackedRed: {backgroundColor: '#F44336'},

  natRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8},
  natRank: {fontSize: 12, fontWeight: '700', color: '#999', width: 16, textAlign: 'center'},
  natName: {fontSize: 13, fontWeight: '500', color: '#333', width: 50},
  natBarOuter: {flex: 1, height: 8, backgroundColor: '#E8EAF6', borderRadius: 4, overflow: 'hidden'},
  natBarInner: {height: '100%', backgroundColor: '#1A237E', borderRadius: 4},
  natCount: {fontSize: 12, fontWeight: '700', color: '#1A237E', width: 24, textAlign: 'right'},

  footer: {textAlign: 'center', fontSize: 10, color: '#BBB', lineHeight: 16, marginTop: 8},
});

export default DashboardScreen;
