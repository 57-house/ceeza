import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { AutomergeProvider } from './crdt/automergeDoc';
import { WebRTCTransport } from './crdt/webrtcTransport';
import ToastCenter from './components/ToastCenter';
import UndoRedoManager from './components/UndoRedoManager';

// Import screens
import PairingScreen from './screens/PairingScreen';
import TableMapScreen from './screens/TableMapScreen';
import OrderEditorScreen from './screens/OrderEditorScreen';
import KitchenViewScreen from './screens/KitchenViewScreen';
import CashRegisterScreen from './screens/CashRegisterScreen';
import ExtensionsDemoScreen from './screens/ExtensionsDemoScreen';

// Import components
import SyncIndicator from './components/SyncIndicator';

// Define navigation types
type RootStackParamList = {
  Home: undefined;
  MainApp: undefined;
};

type MainStackParamList = {
  Pairing: undefined;
  TableMap: undefined;
  OrderEditor: { tableId: string; tableNumber: number };
  KitchenView: undefined;
  CashRegister: undefined;
  Extensions: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const MainStack = createStackNavigator<MainStackParamList>();

// Main navigation component
function MainNavigator() {
  return (
    <MainStack.Navigator
      initialRouteName="Pairing"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2c3e50',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerTitleAlign: 'center',
      }}
    >
      <MainStack.Screen 
        name="Pairing" 
        component={PairingScreen}
        options={{ title: 'Connexion P2P' }}
      />
      <MainStack.Screen 
        name="TableMap" 
        component={TableMapScreen}
        options={{ title: 'Plan des Tables' }}
      />
      <MainStack.Screen 
        name="OrderEditor" 
        component={OrderEditorScreen}
        options={{ title: 'Édition de Commande' }}
      />
      <MainStack.Screen 
        name="KitchenView" 
        component={KitchenViewScreen}
        options={{ title: 'Vue Cuisine' }}
      />
      <MainStack.Screen 
        name="CashRegister" 
        component={CashRegisterScreen}
        options={{ title: 'Caisse' }}
      />
      <MainStack.Screen 
        name="Extensions" 
        component={ExtensionsDemoScreen}
        options={{ title: 'Extensions' }}
      />
    </MainStack.Navigator>
  );
}

// Home screen with navigation buttons
function HomeScreen({ navigation }: any) {
  const startApp = () => {
    navigation.navigate('MainApp');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Restaurant POS</Text>
        <Text style={styles.subtitle}>Système de Point de Vente</Text>
        <SyncIndicator 
          connectionsCount={0}
          isSyncing={false}
          lastSyncTime={Date.now()}
          syncError={null}
        />
      </View>

      <View style={styles.navigationGrid}>
        <TouchableOpacity 
          style={styles.navButton} 
          onPress={startApp}
          activeOpacity={0.7}
        >
          <Text style={styles.navButtonText}>🚀 Démarrer l'Application</Text>
          <Text style={styles.navButtonSubtext}>Accéder à toutes les fonctionnalités</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Système CRDT + WebRTC</Text>
        <Text style={styles.footerText}>Synchronisation temps réel</Text>
      </View>
    </View>
  );
}

// Main App component
export default function App() {
  return (
    <AutomergeProvider>
      <NavigationContainer>
        <View style={styles.appContainer}>
          <StatusBar style="light" />
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerStyle: {
                backgroundColor: '#2c3e50',
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
              headerTitleAlign: 'center',
            }}
          >
            <Stack.Screen 
              name="Home" 
              component={HomeScreen}
              options={{ 
                title: 'Restaurant POS',
                headerShown: false 
              }}
            />
            <Stack.Screen 
              name="MainApp" 
              component={MainNavigator}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
          
          {/* Global components */}
          <ToastCenter 
            notifications={[]}
            onDismiss={() => {}}
            onMarkAsRead={() => {}}
            onActionPress={() => {}}
          />
          <UndoRedoManager
            data={[]}
            onDataChange={() => {}}
            enableControls={true}
            position="bottom"
          />
        </View>
      </NavigationContainer>
    </AutomergeProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#7f8c8d',
    marginBottom: 20,
  },
  navigationGrid: {
    flex: 1,
    justifyContent: 'center',
  },
  navButton: {
    backgroundColor: '#3498db',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  navButtonSubtext: {
    color: '#ecf0f1',
    fontSize: 14,
    opacity: 0.9,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  footerText: {
    color: '#95a5a6',
    fontSize: 12,
    marginBottom: 4,
  },
});
