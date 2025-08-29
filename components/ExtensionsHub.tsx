import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform
} from 'react-native';
import PrintManager from './PrintManager';
import MultiRoomManager from './MultiRoomManager';
import StatisticsManager from './StatisticsManager';

interface ExtensionsHubProps {
  isVisible: boolean;
  onClose: () => void;
}

const ExtensionsHub: React.FC<ExtensionsHubProps> = ({
  isVisible,
  onClose
}) => {
  const [activeExtension, setActiveExtension] = useState<string | null>(null);

  const extensions = [
    {
      id: 'print',
      title: '🖨️ Impression',
      subtitle: 'Gestion des imprimantes Bluetooth/Réseau',
      description: 'Configurez et gérez vos imprimantes pour les tickets, factures et commandes cuisine',
      color: '#007AFF',
      icon: '🖨️'
    },
    {
      id: 'multiroom',
      title: '🏢 Multi-Salle',
      subtitle: 'Gestion de plusieurs salles et plans de tables',
      description: 'Organisez vos espaces, créez des plans de tables personnalisés et gérez la capacité',
      color: '#34C759',
      icon: '🏢'
    },
    {
      id: 'statistics',
      title: '📊 Statistiques',
      subtitle: 'Analyses des ventes et performance',
      description: 'Suivez vos performances, analysez les tendances et optimisez votre activité',
      color: '#FF9500',
      icon: '📊'
    }
  ];

  const openExtension = (extensionId: string) => {
    setActiveExtension(extensionId);
  };

  const closeExtension = () => {
    setActiveExtension(null);
  };

  const getExtensionComponent = () => {
    switch (activeExtension) {
      case 'print':
        return (
          <PrintManager
            isVisible={true}
            onClose={closeExtension}
            onPrintComplete={(jobId) => console.log('Impression terminée:', jobId)}
            onPrintError={(jobId, error) => console.error('Erreur d\'impression:', error)}
          />
        );
      case 'multiroom':
        return (
          <MultiRoomManager
            isVisible={true}
            onClose={closeExtension}
            onRoomSelect={(roomId) => console.log('Salle sélectionnée:', roomId)}
            onRoomCreate={(room) => console.log('Salle créée:', room)}
            onRoomUpdate={(room) => console.log('Salle mise à jour:', room)}
            onRoomDelete={(roomId) => console.log('Salle supprimée:', roomId)}
          />
        );
      case 'statistics':
        return (
          <StatisticsManager
            isVisible={true}
            onClose={closeExtension}
            onExportData={(data, format) => console.log('Export:', format, data)}
          />
        );
      default:
        return null;
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Hub principal */}
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Extensions & Outils</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <Text style={styles.description}>
            Accédez aux outils avancés et extensions pour optimiser votre restaurant
          </Text>

          {/* Grille des extensions */}
          <View style={styles.extensionsGrid}>
            {extensions.map((extension) => (
              <TouchableOpacity
                key={extension.id}
                style={[styles.extensionCard, { borderLeftColor: extension.color }]}
                onPress={() => openExtension(extension.id)}
                activeOpacity={0.7}
              >
                <View style={styles.extensionHeader}>
                  <Text style={styles.extensionIcon}>{extension.icon}</Text>
                  <View style={styles.extensionInfo}>
                    <Text style={styles.extensionTitle}>{extension.title}</Text>
                    <Text style={styles.extensionSubtitle}>{extension.subtitle}</Text>
                  </View>
                </View>
                
                <Text style={styles.extensionDescription}>
                  {extension.description}
                </Text>
                
                <View style={styles.extensionFooter}>
                  <TouchableOpacity
                    style={[styles.openButton, { backgroundColor: extension.color }]}
                    onPress={() => openExtension(extension.id)}
                  >
                    <Text style={styles.openButtonText}>Ouvrir</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Section des raccourcis rapides */}
          <View style={styles.quickActionsSection}>
            <Text style={styles.sectionTitle}>Actions rapides</Text>
            
            <View style={styles.quickActionsGrid}>
              <TouchableOpacity style={styles.quickActionButton}>
                <Text style={styles.quickActionIcon}>📋</Text>
                <Text style={styles.quickActionText}>Nouvelle commande</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickActionButton}>
                <Text style={styles.quickActionIcon}>💰</Text>
                <Text style={styles.quickActionText}>Caisse</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickActionButton}>
                <Text style={styles.quickActionIcon}>👥</Text>
                <Text style={styles.quickActionText}>Réservations</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickActionButton}>
                <Text style={styles.quickActionIcon}>📦</Text>
                <Text style={styles.quickActionText}>Inventaire</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section des informations système */}
          <View style={styles.systemInfoSection}>
            <Text style={styles.sectionTitle}>Informations système</Text>
            
            <View style={styles.systemInfoGrid}>
              <View style={styles.systemInfoCard}>
                <Text style={styles.systemInfoLabel}>Version</Text>
                <Text style={styles.systemInfoValue}>2.1.0</Text>
              </View>
              
              <View style={styles.systemInfoCard}>
                <Text style={styles.systemInfoLabel}>Dernière mise à jour</Text>
                <Text style={styles.systemInfoValue}>Aujourd'hui</Text>
              </View>
              
              <View style={styles.systemInfoCard}>
                <Text style={styles.systemInfoLabel}>Statut</Text>
                <Text style={styles.systemInfoValue}>🟢 Opérationnel</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Extension active */}
      {activeExtension && getExtensionComponent()}
    </>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  extensionsGrid: {
    gap: 16,
    marginBottom: 32,
  },
  extensionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  extensionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  extensionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  extensionInfo: {
    flex: 1,
  },
  extensionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  extensionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  extensionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 20,
  },
  extensionFooter: {
    alignItems: 'flex-end',
  },
  openButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  openButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  quickActionsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minWidth: (width - 60) / 2 - 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  systemInfoSection: {
    marginBottom: 20,
  },
  systemInfoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  systemInfoCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  systemInfoLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
    textAlign: 'center',
  },
  systemInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
  },
});

export default ExtensionsHub;
