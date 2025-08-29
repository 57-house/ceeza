import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { useAutomerge } from '../hooks/useAutomerge';
import QRCode from 'react-native-qrcode-svg';
import { RNCamera } from 'react-native-camera';

// Composant pour afficher l'indicateur de synchronisation
const SyncIndicator: React.FC<{ connection: any }> = ({ connection }) => {
  const getStatusColor = () => {
    switch (connection.connectionState) {
      case 'connected':
        return '#4CAF50'; // Vert
      case 'connecting':
        return '#FF9800'; // Orange
      case 'disconnected':
        return '#F44336'; // Rouge
      default:
        return '#9E9E9E'; // Gris
    }
  };

  const getStatusText = () => {
    switch (connection.connectionState) {
      case 'connected':
        return 'Connecté';
      case 'connecting':
        return 'Connexion...';
      case 'disconnected':
        return 'Déconnecté';
      default:
        return 'Inconnu';
    }
  };

  return (
    <View style={styles.syncIndicator}>
      <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
      <Text style={styles.connectionId}>Pair {connection.id.slice(0, 8)}</Text>
      <Text style={styles.statusText}>{getStatusText()}</Text>
    </View>
  );
};

// Composant pour le scanner QR
const QRScanner: React.FC<{
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}> = ({ visible, onClose, onScan }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (visible) {
      // Pour l'instant, on suppose que la permission est accordée
      // TODO: Implémenter la vraie vérification des permissions
      setHasPermission(true);
    }
  }, [visible]);

  if (!visible) return null;

  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text>Demande d'autorisation caméra...</Text>
        </View>
      </Modal>
    );
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text>Pas d'accès à la caméra</Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.modalContainer}>
        <RNCamera
          style={styles.camera}
          type={RNCamera.Constants.Type.back}
          onBarCodeRead={(event) => {
            onScan(event.data);
            onClose();
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanText}>Scannez le QR code</Text>
          </View>
        </RNCamera>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// Écran principal de pairing
const PairingScreen: React.FC = () => {
  const {
    connections,
    createConnection,
    createPairingOffer,
    connectViaPIN,
    isSyncing,
    lastSyncTime,
    syncError
  } = useAutomerge({
    initialData: { session: 'restaurant-pos' },
    autoSync: true
  });

  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showJoinSession, setShowJoinSession] = useState(false);
  const [currentConnection, setCurrentConnection] = useState<any>(null);
  const [offerSDP, setOfferSDP] = useState<string>('');
  const [pinCode, setPinCode] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Créer une nouvelle session
  const handleCreateSession = async () => {
    try {
      setIsCreating(true);
      const connection = await createConnection();
      setCurrentConnection(connection);
      
      const offer = await createPairingOffer(connection.id);
      setOfferSDP(offer);
      setShowCreateSession(true);
      
      console.log('Session créée avec succès');
    } catch (error) {
      console.error('Erreur lors de la création de session:', error);
      Alert.alert('Erreur', 'Impossible de créer la session');
    } finally {
      setIsCreating(false);
    }
  };

  // Rejoindre une session via QR
  const handleJoinSession = () => {
    setShowQRScanner(true);
  };

  // Traiter le scan QR
  const handleQRScan = async (data: string) => {
    try {
      // Le QR code contient l'offre SDP
      setOfferSDP(data);
      setShowJoinSession(true);
    } catch (error) {
      console.error('Erreur lors du scan QR:', error);
      Alert.alert('Erreur', 'QR code invalide');
    }
  };

  // Confirmer la connexion via PIN
  const handleConfirmJoin = async () => {
    if (!pinCode.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un code PIN');
      return;
    }

    try {
      setIsJoining(true);
      const connection = await createConnection();
      const answer = await connectViaPIN(pinCode, offerSDP);
      
      console.log('Connexion établie avec succès');
      setShowJoinSession(false);
      setPinCode('');
      setOfferSDP('');
      
      Alert.alert('Succès', 'Connexion établie !');
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      Alert.alert('Erreur', 'Impossible de rejoindre la session');
    } finally {
      setIsJoining(false);
    }
  };

  // Copier l'offre SDP dans le presse-papiers
  const copyToClipboard = () => {
    // Implémentation de la copie dans le presse-papiers
    Alert.alert('Copié', 'Offre SDP copiée dans le presse-papiers');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Pairing CRDT</Text>
      
      {/* Boutons d'action */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.button, styles.createButton]}
          onPress={handleCreateSession}
          disabled={isCreating}
        >
          {isCreating ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Créer une session</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.joinButton]}
          onPress={handleJoinSession}
        >
          <Text style={styles.buttonText}>Rejoindre une session</Text>
        </TouchableOpacity>
      </View>

      {/* Indicateur de synchronisation */}
      <View style={styles.syncSection}>
        <Text style={styles.sectionTitle}>État de la synchronisation</Text>
        {isSyncing && (
          <View style={styles.syncStatus}>
            <ActivityIndicator size="small" color="#4CAF50" />
            <Text style={styles.syncText}>Synchronisation en cours...</Text>
          </View>
        )}
        {lastSyncTime && (
          <Text style={styles.lastSyncText}>
            Dernière sync: {new Date(lastSyncTime).toLocaleTimeString()}
          </Text>
        )}
        {syncError && (
          <Text style={styles.errorText}>Erreur: {syncError}</Text>
        )}
      </View>

      {/* Liste des pairs connectés */}
      <View style={styles.connectionsSection}>
        <Text style={styles.sectionTitle}>
          Pairs connectés ({connections.length})
        </Text>
        {connections.length === 0 ? (
          <Text style={styles.noConnectionsText}>
            Aucun pair connecté
          </Text>
        ) : (
          connections.map((connection) => (
            <SyncIndicator key={connection.id} connection={connection} />
          ))
        )}
      </View>

      {/* Modal de création de session */}
      <Modal
        visible={showCreateSession}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Session créée</Text>
            <Text style={styles.modalSubtitle}>
              Partagez ce QR code avec d'autres appareils
            </Text>
            
            {offerSDP && (
              <View style={styles.qrContainer}>
                <QRCode value={offerSDP} size={200} />
              </View>
            )}
            
            <TouchableOpacity
              style={styles.button}
              onPress={copyToClipboard}
            >
              <Text style={styles.buttonText}>Copier l'offre SDP</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => setShowCreateSession(false)}
            >
              <Text style={styles.buttonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de rejoindre une session */}
      <Modal
        visible={showJoinSession}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rejoindre une session</Text>
            <Text style={styles.modalSubtitle}>
              Entrez le code PIN de la session
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Code PIN"
              value={pinCode}
              onChangeText={setPinCode}
              keyboardType="numeric"
              maxLength={6}
            />
            
            <TouchableOpacity
              style={[styles.button, styles.joinButton]}
              onPress={handleConfirmJoin}
              disabled={isJoining}
            >
              {isJoining ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Rejoindre</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => setShowJoinSession(false)}
            >
              <Text style={styles.buttonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Scanner QR */}
      <QRScanner
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScan}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  createButton: {
    backgroundColor: '#4CAF50',
  },
  joinButton: {
    backgroundColor: '#FF9800',
  },
  secondaryButton: {
    backgroundColor: '#9E9E9E',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  syncSection: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  syncText: {
    marginLeft: 10,
    color: '#4CAF50',
    fontWeight: '500',
  },
  lastSyncText: {
    color: '#666',
    fontSize: 14,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    marginTop: 10,
  },
  connectionsSection: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noConnectionsText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 10,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  connectionId: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    width: '100%',
    marginBottom: 20,
    textAlign: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 12,
  },
  scanText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default PairingScreen;
