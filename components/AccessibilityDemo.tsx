import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions
} from 'react-native';
import AccessibleButton from './AccessibleButton';
import UndoRedoManager from './UndoRedoManager';
import VisualFeedback from './VisualFeedback';
import { useVisualFeedback } from './VisualFeedback';

// Types pour la démonstration
interface DemoOrder {
  id: string;
  tableId: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'served';
  createdAt: Date;
}

const AccessibilityDemo: React.FC = () => {
  const [orders, setOrders] = useState<DemoOrder[]>([
    {
      id: '1',
      tableId: 'T1',
      items: [
        { id: '1', name: 'Pizza Margherita', quantity: 2, price: 12.50 },
        { id: '2', name: 'Coca-Cola', quantity: 2, price: 3.50 }
      ],
      total: 32.00,
      status: 'pending',
      createdAt: new Date()
    },
    {
      id: '2',
      tableId: 'T2',
      items: [
        { id: '3', name: 'Salade César', quantity: 1, price: 8.50 },
        { id: '4', name: 'Eau minérale', quantity: 1, price: 2.50 }
      ],
      total: 11.00,
      status: 'ready',
      createdAt: new Date(Date.now() - 300000) // 5 min ago
    }
  ]);

  const [selectedOrder, setSelectedOrder] = useState<DemoOrder | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Hook pour le feedback visuel
  const { feedbackConfig, isVisible, showSuccess, showError, showWarning, showInfo, showLoading } = useVisualFeedback();

  // Gestion des commandes avec undo/redo
  const handleOrderAction = (action: 'create' | 'update' | 'delete', order: DemoOrder, previousOrder?: DemoOrder) => {
    switch (action) {
      case 'create':
        setOrders(prev => [...prev, order]);
        showSuccess(`Commande ${order.tableId} créée avec succès`);
        break;
      case 'update':
        setOrders(prev => prev.map(o => o.id === order.id ? order : o));
        showInfo(`Commande ${order.tableId} mise à jour`);
        break;
      case 'delete':
        setOrders(prev => prev.filter(o => o.id !== order.id));
        showWarning(`Commande ${order.tableId} supprimée`);
        break;
    }
  };

  // Simuler une action de traitement
  const handleProcessOrder = async (order: DemoOrder) => {
    setIsProcessing(true);
    showLoading('Traitement de la commande...', { duration: 3000 });

    try {
      // Simuler un délai de traitement
      await new Promise(resolve => setTimeout(resolve, 2000));

      const updatedOrder = { ...order, status: 'preparing' as const };
      setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));

      showSuccess(`Commande ${order.tableId} en préparation !`);
    } catch (error) {
      showError('Erreur lors du traitement de la commande');
    } finally {
      setIsProcessing(false);
    }
  };

  // Simuler une suppression avec confirmation
  const handleDeleteOrder = (order: DemoOrder) => {
    Alert.alert(
      'Confirmer la suppression',
      `Voulez-vous vraiment supprimer la commande de la table ${order.tableId} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            const previousOrder = { ...order };
            setOrders(prev => prev.filter(o => o.id !== order.id));
            showWarning(`Commande ${order.tableId} supprimée`, {
              actions: [
                { label: 'Annuler', action: 'undo', variant: 'secondary' },
                { label: 'OK', action: 'ok', variant: 'primary' }
              ]
            });
          }
        }
      ]
    );
  };

  // Gérer les actions du feedback
  const handleFeedbackAction = (action: string) => {
    switch (action) {
      case 'undo':
        // Logique d'annulation
        showInfo('Action d\'annulation en cours...');
        break;
      case 'ok':
        showSuccess('Action confirmée');
        break;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🎯 Démonstration Accessibilité & UX</Text>
        <Text style={styles.subtitle}>
          Composants avec boutons larges, feedback visuel et undo/redo
        </Text>
      </View>

      {/* Section des boutons accessibles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔘 Boutons Accessibles</Text>
        
        <View style={styles.buttonGrid}>
          <AccessibleButton
            title="Bouton Principal"
            onPress={() => showSuccess('Bouton principal pressé !')}
            variant="primary"
            size="large"
            fullWidth
            icon="⭐"
            accessibilityLabel="Bouton principal de démonstration"
            accessibilityHint="Affiche un message de succès"
          />

          <AccessibleButton
            title="Bouton Secondaire"
            onPress={() => showInfo('Bouton secondaire pressé !')}
            variant="secondary"
            size="large"
            fullWidth
            icon="ℹ"
            accessibilityLabel="Bouton secondaire de démonstration"
            accessibilityHint="Affiche un message d'information"
          />

          <AccessibleButton
            title="Bouton de Succès"
            onPress={() => showSuccess('Opération réussie !')}
            variant="success"
            size="large"
            fullWidth
            icon="✓"
            accessibilityLabel="Bouton de succès"
            accessibilityHint="Confirme une opération réussie"
          />

          <AccessibleButton
            title="Bouton d'Avertissement"
            onPress={() => showWarning('Attention, action requise !')}
            variant="warning"
            size="large"
            fullWidth
            icon="⚠"
            accessibilityLabel="Bouton d'avertissement"
            accessibilityHint="Affiche un avertissement important"
          />

          <AccessibleButton
            title="Bouton de Danger"
            onPress={() => showError('Action dangereuse détectée !')}
            variant="danger"
            size="large"
            fullWidth
            icon="✕"
            accessibilityLabel="Bouton de danger"
            accessibilityHint="Affiche une erreur critique"
          />

          <AccessibleButton
            title="Bouton Fantôme"
            onPress={() => showInfo('Bouton fantôme pressé !')}
            variant="ghost"
            size="large"
            fullWidth
            icon="👻"
            accessibilityLabel="Bouton fantôme"
            accessibilityHint="Bouton transparent avec bordure"
          />
        </View>

        {/* Boutons de différentes tailles */}
        <View style={styles.sizeSection}>
          <Text style={styles.subsectionTitle}>📏 Différentes Tailles</Text>
          
          <View style={styles.sizeButtons}>
            <AccessibleButton
              title="Petit"
              onPress={() => showInfo('Bouton petit')}
              size="small"
              variant="primary"
            />
            
            <AccessibleButton
              title="Moyen"
              onPress={() => showInfo('Bouton moyen')}
              size="medium"
              variant="primary"
            />
            
            <AccessibleButton
              title="Grand"
              onPress={() => showInfo('Bouton grand')}
              size="large"
              variant="primary"
            />
            
            <AccessibleButton
              title="Très Grand"
              onPress={() => showInfo('Bouton très grand')}
              size="xlarge"
              variant="primary"
            />
          </View>
        </View>
      </View>

      {/* Section des commandes avec undo/redo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Gestion des Commandes (Undo/Redo)</Text>
        
        <View style={styles.ordersContainer}>
          {orders.map(order => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderTitle}>Table {order.tableId}</Text>
                <Text style={styles.orderStatus}>{order.status}</Text>
              </View>
              
              <View style={styles.orderItems}>
                {order.items.map(item => (
                  <Text key={item.id} style={styles.orderItem}>
                    {item.quantity}x {item.name} - {item.price.toFixed(2)}€
                  </Text>
                ))}
              </View>
              
              <Text style={styles.orderTotal}>Total: {order.total.toFixed(2)}€</Text>
              
              <View style={styles.orderActions}>
                <AccessibleButton
                  title="Traiter"
                  onPress={() => handleProcessOrder(order)}
                  variant="success"
                  size="medium"
                  loading={isProcessing}
                  disabled={isProcessing || order.status !== 'pending'}
                  icon="⚡"
                  style={styles.actionButton}
                />
                
                <AccessibleButton
                  title="Modifier"
                  onPress={() => {
                    setSelectedOrder(order);
                    showInfo('Mode édition activé');
                  }}
                  variant="secondary"
                  size="medium"
                  icon="✏"
                  style={styles.actionButton}
                />
                
                <AccessibleButton
                  title="Supprimer"
                  onPress={() => handleDeleteOrder(order)}
                  variant="danger"
                  size="medium"
                  icon="🗑"
                  style={styles.actionButton}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Bouton pour ajouter une nouvelle commande */}
        <AccessibleButton
          title="➕ Ajouter une Commande"
          onPress={() => {
            const newOrder: DemoOrder = {
              id: Date.now().toString(),
              tableId: `T${orders.length + 1}`,
              items: [
                { id: Date.now().toString(), name: 'Nouveau plat', quantity: 1, price: 15.00 }
              ],
              total: 15.00,
              status: 'pending',
              createdAt: new Date()
            };
            
            handleOrderAction('create', newOrder);
          }}
          variant="primary"
          size="large"
          fullWidth
          icon="➕"
          accessibilityLabel="Ajouter une nouvelle commande"
          accessibilityHint="Crée une commande de démonstration"
        />
      </View>

      {/* Section des raccourcis clavier */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⌨️ Raccourcis Clavier</Text>
        
        <View style={styles.shortcutsContainer}>
          <View style={styles.shortcutItem}>
            <Text style={styles.shortcutKey}>⌘Z / Ctrl+Z</Text>
            <Text style={styles.shortcutDescription}>Annuler la dernière action</Text>
          </View>
          
          <View style={styles.shortcutItem}>
            <Text style={styles.shortcutKey}>⌘⇧Z / Ctrl+Y</Text>
            <Text style={styles.shortcutDescription}>Rétablir l'action annulée</Text>
          </View>
          
          <View style={styles.shortcutItem}>
            <Text style={styles.shortcutKey}>⌘S / Ctrl+S</Text>
            <Text style={styles.shortcutDescription}>Sauvegarder</Text>
          </View>
          
          <View style={styles.shortcutItem}>
            <Text style={styles.shortcutKey}>⌘N / Ctrl+N</Text>
            <Text style={styles.shortcutDescription}>Nouvelle commande</Text>
          </View>
        </View>
      </View>

      {/* Section des fonctionnalités d'accessibilité */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>♿ Fonctionnalités d'Accessibilité</Text>
        
        <View style={styles.accessibilityFeatures}>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🔊</Text>
            <Text style={styles.featureTitle}>VoiceOver/TalkBack</Text>
            <Text style={styles.featureDescription}>
              Support complet des lecteurs d'écran avec labels et hints détaillés
            </Text>
          </View>
          
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>👆</Text>
            <Text style={styles.featureTitle}>Navigation au Clavier</Text>
            <Text style={styles.featureDescription}>
              Navigation complète avec Tab, Espace et Entrée
            </Text>
          </View>
          
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🎨</Text>
            <Text style={styles.featureTitle}>Contraste Élevé</Text>
            <Text style={styles.featureDescription}>
              Couleurs optimisées pour la lisibilité
            </Text>
          </View>
          
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📱</Text>
            <Text style={styles.featureTitle}>Tailles Adaptatives</Text>
            <Text style={styles.featureDescription}>
              Boutons et textes qui s'adaptent aux préférences utilisateur
            </Text>
          </View>
        </View>
      </View>

      {/* Composants de feedback et undo/redo */}
      <VisualFeedback
        visible={isVisible}
        config={feedbackConfig!}
        onActionPress={handleFeedbackAction}
      />

      <UndoRedoManager
        data={orders}
        onDataChange={setOrders}
        maxHistorySize={20}
        enableUndoRedo={true}
        showControls={true}
        position="floating"
        autoHideDelay={8000}
        onActionUndone={(action) => {
          showInfo(`Action annulée: ${action.description}`);
        }}
        onActionRedone={(action) => {
          showInfo(`Action rétablie: ${action.description}`);
        }}
      />
    </ScrollView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#E3F2FD',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonGrid: {
    gap: 16,
  },
  sizeSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E7',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  sizeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 12,
  },
  ordersContainer: {
    gap: 16,
    marginBottom: 20,
  },
  orderCard: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  orderStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    textTransform: 'uppercase',
  },
  orderItems: {
    marginBottom: 12,
  },
  orderItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'right',
  },
  orderActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
  },
  shortcutsContainer: {
    gap: 12,
  },
  shortcutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  shortcutKey: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
    minWidth: 80,
    textAlign: 'center',
  },
  shortcutDescription: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  accessibilityFeatures: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 16,
    marginTop: 2,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    flex: 1,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    flex: 1,
  },
});

export default AccessibilityDemo;


