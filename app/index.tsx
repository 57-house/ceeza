import 'react-native-get-random-values';

// Polyfill pour SharedArrayBuffer sur le web
if (typeof window !== 'undefined') {
  // Vérifier si SharedArrayBuffer est disponible
  if (typeof window.SharedArrayBuffer === 'undefined') {
    // Créer un polyfill basique pour SharedArrayBuffer
    // Note: Ce polyfill peut ne pas fonctionner parfaitement avec expo-sqlite
    // car SharedArrayBuffer nécessite des en-têtes HTTP spécifiques
    try {
      // @ts-ignore
      window.SharedArrayBuffer = class SharedArrayBuffer extends ArrayBuffer {
        constructor(length: number) {
          super(length);
        }
        static get [Symbol.species]() {
          return ArrayBuffer;
        }
      };
      // @ts-ignore
      globalThis.SharedArrayBuffer = window.SharedArrayBuffer;
      console.warn('SharedArrayBuffer non disponible, utilisation d\'un polyfill. L\'application peut ne pas fonctionner correctement sur le web.');
    } catch (e) {
      console.error('Impossible de créer le polyfill SharedArrayBuffer:', e);
    }
  }
}

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { initDB } from './db/database';
import HomeScreen from './screens/HomeScreen';
import { connectSyncService } from './services/syncService';
import { initSoundService } from './services/soundService';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        await initDB();
        await initSoundService();
        await connectSyncService();
        setDbReady(true);
      } catch (err) {
        console.error('Erreur lors de l\'initialisation:', err);
        const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
        setError(errorMessage);
      }
    };

    initialize();
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Erreur: {error}</Text>
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Initialisation...</Text>
      </View>
    );
  }

  return <HomeScreen />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    padding: 20,
  },
});

