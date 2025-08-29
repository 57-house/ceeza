import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SyncIndicatorProps {
  connectionsCount: number;
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncError: string | null;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  connectionsCount,
  isSyncing,
  lastSyncTime,
  syncError,
  size = 'medium',
  showDetails = false
}) => {
  // Déterminer la couleur principale selon le nombre de connexions
  const getConnectionColor = () => {
    if (connectionsCount === 0) return '#9E9E9E'; // Gris - pas de connexions
    if (connectionsCount === 1) return '#FF9800'; // Orange - connexion unique
    if (connectionsCount <= 3) return '#4CAF50'; // Vert - bon nombre de pairs
    return '#2196F3'; // Bleu - beaucoup de pairs
  };

  // Déterminer la couleur du statut de synchronisation
  const getSyncColor = () => {
    if (syncError) return '#F44336'; // Rouge - erreur
    if (isSyncing) return '#FF9800'; // Orange - synchronisation en cours
    if (lastSyncTime) return '#4CAF50'; // Vert - synchronisé
    return '#9E9E9E'; // Gris - pas de synchronisation
  };

  // Déterminer le texte du statut
  const getStatusText = () => {
    if (syncError) return 'Erreur';
    if (isSyncing) return 'Sync...';
    if (lastSyncTime) return 'Sync';
    return 'Offline';
  };

  // Déterminer la taille des indicateurs
  const getIndicatorSize = () => {
    switch (size) {
      case 'small':
        return { dot: 8, text: 10, container: 16 };
      case 'large':
        return { dot: 16, text: 14, container: 24 };
      default: // medium
        return { dot: 12, text: 12, container: 20 };
    }
  };

  const sizes = getIndicatorSize();

  return (
    <View style={styles.container}>
      {/* Indicateur principal des connexions */}
      <View style={styles.mainIndicator}>
        <View
          style={[
            styles.connectionDot,
            {
              backgroundColor: getConnectionColor(),
              width: sizes.dot,
              height: sizes.dot,
              borderRadius: sizes.dot / 2
            }
          ]}
        />
        {showDetails && (
          <Text style={[styles.connectionText, { fontSize: sizes.text }]}>
            {connectionsCount} pair{connectionsCount !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* Indicateur de synchronisation */}
      <View style={styles.syncIndicator}>
        <View
          style={[
            styles.syncDot,
            {
              backgroundColor: getSyncColor(),
              width: sizes.dot * 0.7,
              height: sizes.dot * 0.7,
              borderRadius: (sizes.dot * 0.7) / 2
            }
          ]}
        />
        {showDetails && (
          <Text style={[styles.syncText, { fontSize: sizes.text }]}>
            {getStatusText()}
          </Text>
        )}
      </View>

      {/* Indicateur de temps de dernière synchronisation */}
      {showDetails && lastSyncTime && (
        <View style={styles.timeIndicator}>
          <Text style={[styles.timeText, { fontSize: sizes.text - 2 }]}>
            {formatLastSyncTime(lastSyncTime)}
          </Text>
        </View>
      )}

      {/* Indicateur d'erreur */}
      {showDetails && syncError && (
        <View style={styles.errorIndicator}>
          <Text style={[styles.errorText, { fontSize: sizes.text - 2 }]}>
            ⚠️
          </Text>
        </View>
      )}
    </View>
  );
};

// Fonction pour formater le temps de dernière synchronisation
const formatLastSyncTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) { // Moins d'1 minute
    return 'À l\'instant';
  } else if (diff < 3600000) { // Moins d'1 heure
    const minutes = Math.floor(diff / 60000);
    return `Il y a ${minutes} min`;
  } else if (diff < 86400000) { // Moins d'1 jour
    const hours = Math.floor(diff / 3600000);
    return `Il y a ${hours}h`;
  } else {
    const days = Math.floor(diff / 86400000);
    return `Il y a ${days}j`;
  }
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  mainIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  connectionDot: {
    marginRight: 4,
  },
  connectionText: {
    color: '#333',
    fontWeight: '500',
    marginLeft: 4,
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  syncDot: {
    marginRight: 4,
  },
  syncText: {
    color: '#666',
    fontWeight: '400',
    marginLeft: 4,
  },
  timeIndicator: {
    marginRight: 8,
  },
  timeText: {
    color: '#888',
    fontWeight: '300',
  },
  errorIndicator: {
    marginLeft: 'auto',
  },
  errorText: {
    color: '#F44336',
  },
});

export default SyncIndicator;
