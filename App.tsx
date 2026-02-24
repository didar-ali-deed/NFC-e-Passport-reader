import React from 'react';
import {StatusBar} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';

// Original screens
import HomeScreen from './src/screens/HomeScreen';
import MRZInputScreen from './src/screens/MRZInputScreen';
import ScanCardScreen from './src/screens/ScanCardScreen';
import ResultScreen from './src/screens/ResultScreen';
import QuickScanScreen from './src/screens/QuickScanScreen';

// KYC pipeline screens
import ConsentScreen from './src/screens/ConsentScreen';
import MRZScannerScreen from './src/screens/MRZScannerScreen';
import NFCScanScreen from './src/screens/NFCScanScreen';
import SelfieScreen from './src/screens/SelfieScreen';
import KYCResultScreen from './src/screens/KYCResultScreen';

// New feature screens
import HistoryScreen from './src/screens/HistoryScreen';
import AboutScreen from './src/screens/AboutScreen';
import DashboardScreen from './src/screens/DashboardScreen';

const Stack = createNativeStackNavigator();

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#1A237E" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: {backgroundColor: '#1A237E'},
            headerTintColor: '#FFFFFF',
            headerTitleStyle: {fontWeight: '700'},
          }}>

          {/* ── Home ── */}
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{title: 'KYC-Xflow'}}
          />

          {/* ── KYC Pipeline ── */}
          <Stack.Screen
            name="Consent"
            component={ConsentScreen}
            options={{title: 'Step 1 — Consent', headerBackVisible: false}}
          />
          <Stack.Screen
            name="MRZScanner"
            component={MRZScannerScreen}
            options={{title: 'Step 2 — Scan MRZ'}}
          />
          <Stack.Screen
            name="NFCScan"
            component={NFCScanScreen}
            options={{title: 'Step 3 — NFC Read', headerBackVisible: false}}
          />
          <Stack.Screen
            name="SelfieScan"
            component={SelfieScreen}
            options={{title: 'Step 4 — Liveness', headerBackVisible: false}}
          />
          <Stack.Screen
            name="KYCResult"
            component={KYCResultScreen}
            options={{title: 'KYC Result', headerBackVisible: false}}
          />

          {/* ── Quick Tools ── */}
          <Stack.Screen
            name="MRZInput"
            component={MRZInputScreen}
            options={{title: 'Enter MRZ Data'}}
          />
          <Stack.Screen
            name="ScanCard"
            component={ScanCardScreen}
            options={{title: 'Scanning...', headerBackVisible: false}}
          />
          <Stack.Screen
            name="Result"
            component={ResultScreen}
            options={{title: 'Scan Result', headerBackVisible: false}}
          />
          <Stack.Screen
            name="QuickScan"
            component={QuickScanScreen}
            options={{title: 'Quick NFC Scan'}}
          />

          {/* ── New Feature Screens ── */}
          <Stack.Screen
            name="History"
            component={HistoryScreen}
            options={{title: 'Verification History'}}
          />
          <Stack.Screen
            name="About"
            component={AboutScreen}
            options={{title: 'About KYC-Xflow'}}
          />
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{title: 'Dashboard'}}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
