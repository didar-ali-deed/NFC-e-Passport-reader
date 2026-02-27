import React from 'react';
import {StatusBar} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';

// Main screen
import HomeScreen from './src/screens/HomeScreen';

// NFC pipeline screens
import ConsentScreen from './src/screens/ConsentScreen';
import MRZScannerScreen from './src/screens/MRZScannerScreen';
import NFCScanScreen from './src/screens/NFCScanScreen';
import PassportResultScreen from './src/screens/PassportResultScreen';

// Utility screens
import HistoryScreen from './src/screens/HistoryScreen';
import AboutScreen from './src/screens/AboutScreen';
import DashboardScreen from './src/screens/DashboardScreen';

const Stack = createNativeStackNavigator();

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#161618" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: {backgroundColor: '#1422b5'},
            headerTintColor: '#ebebeb',
            headerTitleAlign: 'center',
            headerTitleStyle: {fontWeight: '900', fontSize: 28},
          }}>

          {/* Home */}
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{title: 'NFC Passport'}}
          />

          {/* NFC Scan Pipeline */}
          <Stack.Screen
            name="Consent"
            component={ConsentScreen}
            options={{title: 'Step 1 — Terms & Conditions', headerBackVisible: false}}
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
            name="PassportResult"
            component={PassportResultScreen}
            options={{title: 'Passport Data', headerBackVisible: false}}
          />

          {/* Utility Screens */}
          <Stack.Screen
            name="History"
            component={HistoryScreen}
            options={{title: 'Scan History'}}
          />
          <Stack.Screen
            name="About"
            component={AboutScreen}
            options={{title: 'About'}}
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
