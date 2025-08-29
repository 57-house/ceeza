import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  Platform
} from 'react-native';
import ExtensionsHub from '../components/ExtensionsHub';
import PrintManager from '../components/PrintManager';
import MultiRoomManager from '../components/MultiRoomManager';
import StatisticsManager from '../components/StatisticsManager';

interface ExtensionsDemoScreenProps {
  navigation: any;
}

const ExtensionsDemoScreen: React.FC<ExtensionsDemoScreenProps> = ({ navigation }) => {
  const [activeExtension, setActiveExtension] = useState<string | null>(null);
  const [showExtensionsHub, setShowExtensionsHub] = useState(false);

  const extensions = [
    {
      id: 'print',
      title: '🖨️ Gestionnaire d\'impression',
      description: 'Configurez vos imprimantes Bluetooth et réseau',
      features: [
        'Découverte automatique des imprimantes',
        'Support Bluetooth, réseau et USB',
        'Gestion des files d\'attente d\'impression',
        'Historique des impressions',
        'Test d\'impression intégré'
      ],
      color: '#007AFF'
    },
    {
      id: 'multiroom',
      title: '🏢 Gestion Multi-Salle',
      description: 'Organisez vos espaces et plans de tables',
      features: [
        'Création et gestion de salles',
        'Plans de tables personnalisables',
        'Gestion de la capacité',
        'Statuts des salles (ouverte/fermée/maintenance)',
        'Navigation entre les salles'
      ],
      color: '#34C759'
    },
    {
      id: 'statistics',
      title: '📊 Statistiques & Analyses',
      description: 'Suivez vos performances et optimisez votre activité',
      features: [
        'Analyses des ventes par période',
        'Plats les plus populaires',
        'Performance des serveurs',
        'Évolution des ventes',
        'Export CSV/PDF'
      ],
      color: '#FF9500'
    }
  ];

  const openExtension = (extensionId: string) => {
    setActiveExtension(extensionId);
  };

  const closeExtension = () => {
    setActiveExtension(null);
  };

  const openExtensionsHub = () => {
    setShowExtensionsHub(true);
  };

  const closeExtensionsHub = () => {
    setShowExtensionsHub(false);
  };

  const getExtensionComponent = () => {
    switch (activeExtension) {
      case 'print':
        return (
          <PrintManager
            isVisible={true}
            onClose={closeExtension}
            onPrintComplete={(jobId) => {
              Alert.alert('Succès', `Impression terminée: ${jobId}`);
            }}
            onPrintError={(jobId, error) => {
              Alert.alert('Erreur', `Échec de l'impression: ${error}`);
            }}
          />
        );
      case 'multiroom':
        return (
          <MultiRoomManager
            isVisible={true}
            onClose={closeExtension}
            onRoomSelect={(roomId) => {
              Alert.alert('Salle sélectionnée', `ID: ${roomId}`);
            }}
            onRoomCreate={(room) => {
              Alert.alert('Salle créée', `Nom: ${room.name}`);
            }}
            onRoomUpdate={(room) => {
              Alert.alert('Salle mise à jour', `Nom: ${room.name}`);
            }}
            onRoomDelete={(roomId) => {
              Alert.alert('Salle supprimée', `ID: ${roomId}`);
            }}
          />
        );
      case 'statistics':
        return (
          <StatisticsManager
            isVisible={true}
            onClose={closeExtension}
            onExportData={(data, format) => {
              Alert.alert('Export', `Données exportées au format ${format.toUpperCase()}`);
              console.log('Données exportées:', data);
            }}
          />
        );
      default:
        return null;
    }
  };

  const showFeatureDemo = (extensionId: string) => {
    const extension = extensions.find(ext => ext.id === extensionId);
    if (extension) {
      Alert.alert(
        extension.title,
        `Fonctionnalités disponibles:\n\n${extension.features.map(f => `• ${f}`).join('\n')}`,
        [
          { text: 'Fermer', style: 'cancel' },
          { text: 'Tester', onPress: () => openExtension(extensionId) }
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Démonstration des Extensions</Text>
        <TouchableOpacity
          style={styles.hubButton}
          onPress={openExtensionsHub}
        >
          <Text style={styles.hubButtonText}>🔧 Hub</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Introduction */}
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>🚀 Extensions Avancées</Text>
          <Text style={styles.introDescription}>
            Découvrez et testez les fonctionnalités avancées de votre système de restaurant POS.
            Chaque extension apporte des outils puissants pour optimiser votre activité.
          </Text>
        </View>

        {/* Grille des extensions */}
        <View style={styles.extensionsGrid}>
          {extensions.map((extension) => (
            <View key={extension.id} style={styles.extensionCard}>
              <View style={styles.extensionHeader}>
                <Text style={styles.extensionIcon}>{extension.title.split(' ')[0]}</Text>
                <View style={styles.extensionInfo}>
                  <Text style={styles.extensionTitle}>
                    {extension.title.split(' ').slice(1).join(' ')}
                  </Text>
                  <Text style={styles.extensionDescription}>
                    {extension.description}
                  </Text>
                </View>
              </View>

              {/* Fonctionnalités */}
              <View style={styles.featuresSection}>
                <Text style={styles.featuresTitle}>Fonctionnalités clés:</Text>
                {extension.features.slice(0, 3).map((feature, index) => (
                  <Text key={index} style={styles.featureItem}>
                    • {feature}
                  </Text>
                ))}
                {extension.features.length > 3 && (
                  <Text style={styles.moreFeatures}>
                    +{extension.features.length - 3} autres fonctionnalités
                  </Text>
                )}
              </View>

              {/* Actions */}
              <View style={styles.extensionActions}>
                <TouchableOpacity
                  style={styles.infoButton}
                  onPress={() => showFeatureDemo(extension.id)}
                >
                  <Text style={styles.infoButtonText}>ℹ️ Détails</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.testButton, { backgroundColor: extension.color }]}
                  onPress={() => openExtension(extension.id)}
                >
                  <Text style={styles.testButtonText}>🧪 Tester</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Section des cas d'usage */}
        <View style={styles.useCasesSection}>
          <Text style={styles.sectionTitle}>Cas d'usage typiques</Text>
          
          <View style={styles.useCaseCard}>
            <Text style={styles.useCaseTitle}>🖨️ Impression</Text>
            <Text style={styles.useCaseDescription}>
              Idéal pour les restaurants avec plusieurs zones de service. Imprimez automatiquement 
              les commandes cuisine, les tickets de caisse et les factures sur différentes imprimantes.
            </Text>
          </View>

          <View style={styles.useCaseCard}>
            <Text style={styles.useCaseTitle}>🏢 Multi-Salle</Text>
            <Text style={styles.useCaseDescription}>
              Parfait pour les établissements avec plusieurs espaces (salle principale, terrasse, 
              salle privée). Gérez indépendamment chaque zone avec ses propres tables et capacité.
            </Text>
          </View>

          <View style={styles.useCaseCard}>
            <Text style={styles.useCaseTitle}>📊 Statistiques</Text>
            <Text style={styles.useCaseDescription}>
              Essentiel pour l'analyse des performances. Identifiez vos plats stars, 
              optimisez vos menus et suivez l'efficacité de votre équipe.
            </Text>
          </View>
        </View>

        {/* Section des avantages */}
        <View style={styles.benefitsSection}>
          <Text style={styles.sectionTitle}>Avantages des extensions</Text>
          
          <View style={styles.benefitsGrid}>
            <View style={styles.benefitCard}>
              <Text style={styles.benefitIcon}>⚡</Text>
              <Text style={styles.benefitTitle}>Efficacité</Text>
              <Text style={styles.benefitDescription}>
                Automatisez les tâches répétitives et optimisez vos processus
              </Text>
            </View>
            
            <View style={styles.benefitCard}>
              <Text style={styles.benefitIcon}>📈</Text>
              <Text style={styles.benefitTitle}>Performance</Text>
              <Text style={styles.benefitDescription}>
                Suivez vos métriques et prenez des décisions éclairées
              </Text>
            </View>
            
            <View style={styles.benefitCard}>
              <Text style={styles.benefitIcon}>🎯</Text>
              <Text style={styles.benefitTitle}>Précision</Text>
              <Text style={styles.benefitDescription}>
                Éliminez les erreurs humaines et améliorez la qualité du service
              </Text>
            </View>
            
            <View style={styles.benefitCard}>
              <Text style={styles.benefitIcon}>💰</Text>
              <Text style={styles.benefitTitle}>ROI</Text>
              <Text style={styles.benefitDescription}>
                Augmentez vos revenus grâce à une meilleure gestion
              </Text>
            </View>
          </View>
        </View>

        {/* Call to action */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Prêt à optimiser votre restaurant ?</Text>
          <Text style={styles.ctaDescription}>
            Testez toutes les extensions et découvrez comment elles peuvent transformer votre activité
          </Text>
          
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={openExtensionsHub}
          >
            <Text style={styles.ctaButtonText}>🚀 Démarrer les extensions</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Extensions Hub */}
      {showExtensionsHub && (
        <ExtensionsHub
          isVisible={showExtensionsHub}
          onClose={closeExtensionsHub}
        />
      )}

      {/* Extension active */}
      {activeExtension && getExtensionComponent()}
    </View>
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
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    flex: 1,
    textAlign: 'center',
  },
  hubButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  hubButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  introSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 12,
    textAlign: 'center',
  },
  introDescription: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  extensionsGrid: {
    gap: 20,
    marginBottom: 32,
  },
  extensionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
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
    marginBottom: 8,
  },
  extensionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  featuresSection: {
    marginBottom: 20,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  featureItem: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
    lineHeight: 18,
  },
  moreFeatures: {
    fontSize: 12,
    color: '#007AFF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  extensionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  infoButton: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  infoButtonText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
  },
  testButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  useCasesSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  useCaseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  useCaseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  useCaseDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  benefitsSection: {
    marginBottom: 32,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  benefitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: (width - 60) / 2 - 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  benefitIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  benefitDescription: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 16,
  },
  ctaSection: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  ctaDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  ctaButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  ctaButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ExtensionsDemoScreen;
