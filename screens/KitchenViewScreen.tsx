import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions
} from 'react-native';

// Types pour les commandes de cuisine
interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
}

interface KitchenOrder {
  id: string;
  tableId: string;
  tableNumber: number;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'preparing' | 'ready';
  createdAt: Date;
  updatedAt: Date;
  priority: 'low' | 'medium' | 'high';
  estimatedTime?: number; // en minutes
}

interface KitchenViewScreenProps {
  navigation: any;
}

// Données mock pour les commandes (sera remplacé par doc.orders)
const mockKitchenOrders: KitchenOrder[] = [
  {
    id: '1',
    tableId: '2',
    tableNumber: 2,
    items: [
      { id: '1', name: 'Pizza Margherita', quantity: 2, notes: 'Sans basilic' },
      { id: '6', name: 'Coca-Cola', quantity: 2 }
    ],
    total: 31.00,
    status: 'pending',
    createdAt: new Date(Date.now() - 15 * 60 * 1000), // Il y a 15 minutes
    updatedAt: new Date(Date.now() - 15 * 60 * 1000),
    priority: 'high',
    estimatedTime: 20
  },
  {
    id: '2',
    tableId: '5',
    tableNumber: 5,
    items: [
      { id: '8', name: 'Plateau de Sushis', quantity: 1 },
      { id: '7', name: 'Thé Vert', quantity: 4 }
    ],
    total: 38.00,
    status: 'preparing',
    createdAt: new Date(Date.now() - 25 * 60 * 1000), // Il y a 25 minutes
    updatedAt: new Date(Date.now() - 10 * 60 * 1000), // Mise à jour il y a 10 minutes
    priority: 'medium',
    estimatedTime: 15
  },
  {
    id: '3',
    tableId: '7',
    tableNumber: 7,
    items: [
      { id: '4', name: 'Steak Frites', quantity: 3, notes: 'Steaks saignants' },
      { id: '7', name: 'Bière', quantity: 3 }
    ],
    total: 69.00,
    status: 'pending',
    createdAt: new Date(Date.now() - 5 * 60 * 1000), // Il y a 5 minutes
    updatedAt: new Date(Date.now() - 5 * 60 * 1000),
    priority: 'low',
    estimatedTime: 25
  },
  {
    id: '4',
    tableId: '3',
    tableNumber: 3,
    items: [
      { id: '3', name: 'Salade César', quantity: 1 },
      { id: '5', name: 'Poulet Rôti', quantity: 2 },
      { id: '7', name: 'Vin Rouge', quantity: 1 }
    ],
    total: 45.00,
    status: 'ready',
    createdAt: new Date(Date.now() - 35 * 60 * 1000), // Il y a 35 minutes
    updatedAt: new Date(Date.now() - 5 * 60 * 1000), // Prête il y a 5 minutes
    priority: 'medium',
    estimatedTime: 20
  }
];

// Composant pour afficher une commande individuelle
const OrderCard: React.FC<{
  order: KitchenOrder;
  onStatusUpdate: (orderId: string, newStatus: KitchenOrder['status']) => void;
}> = ({ order, onStatusUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Formater la durée écoulée
  const formatElapsedTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `Il y a ${hours}h${mins > 0 ? mins : ''}`;
  };

  // Obtenir la couleur de priorité
  const getPriorityColor = () => {
    switch (order.priority) {
      case 'high': return '#F44336'; // Rouge
      case 'medium': return '#FF9800'; // Orange
      case 'low': return '#4CAF50'; // Vert
      default: return '#9E9E9E'; // Gris
    }
  };

  // Obtenir l'icône de priorité
  const getPriorityIcon = () => {
    switch (order.priority) {
      case 'high': return '🔥';
      case 'medium': return '⚡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  // Obtenir la couleur du statut
  const getStatusColor = () => {
    switch (order.status) {
      case 'pending': return '#FF9800'; // Orange
      case 'preparing': return '#2196F3'; // Bleu
      case 'ready': return '#4CAF50'; // Vert
      default: return '#9E9E9E'; // Gris
    }
  };

  // Obtenir le texte du statut
  const getStatusText = () => {
    switch (order.status) {
      case 'pending': return 'En attente';
      case 'preparing': return 'En préparation';
      case 'ready': return 'Prête';
      default: return 'Inconnu';
    }
  };

  // Calculer le temps restant estimé
  const getEstimatedTimeRemaining = () => {
    if (order.status === 'ready') return null;
    
    const elapsed = Math.floor((Date.now() - order.createdAt.getTime()) / (1000 * 60));
    const remaining = (order.estimatedTime || 0) - elapsed;
    
    if (remaining <= 0) return 'En retard';
    return `${remaining} min restantes`;
  };

  const timeRemaining = getEstimatedTimeRemaining();
  const isOverdue = timeRemaining === 'En retard';

  return (
    <TouchableOpacity
      style={[
        styles.orderCard,
        { borderLeftColor: getPriorityColor() },
        order.status === 'ready' && styles.orderCardReady
      ]}
      onPress={() => setIsExpanded(!isExpanded)}
      activeOpacity={0.8}
    >
      {/* En-tête de la commande */}
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <View style={styles.tableInfo}>
            <Text style={styles.tableNumber}>Table {order.tableNumber}</Text>
            <View style={styles.priorityBadge}>
              <Text style={styles.priorityIcon}>{getPriorityIcon()}</Text>
              <Text style={[styles.priorityText, { color: getPriorityColor() }]}>
                {order.priority.toUpperCase()}
              </Text>
            </View>
          </View>
          
          <View style={styles.orderMeta}>
            <Text style={styles.orderTime}>
              {formatElapsedTime(order.createdAt)}
            </Text>
            <Text style={styles.orderTotal}>
              {order.total.toFixed(2)} €
            </Text>
          </View>
        </View>

        <View style={styles.statusContainer}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor() }
          ]}>
            <Text style={styles.statusText}>
              {getStatusText()}
            </Text>
          </View>
        </View>
      </View>

      {/* Temps estimé et retard */}
      {order.status !== 'ready' && (
        <View style={styles.timeInfo}>
          <Text style={[
            styles.estimatedTime,
            isOverdue && styles.overdueTime
          ]}>
            {timeRemaining}
          </Text>
          {isOverdue && (
            <Text style={styles.overdueWarning}>⚠️ En retard</Text>
          )}
        </View>
      )}

      {/* Liste des articles (toujours visible) */}
      <View style={styles.itemsList}>
        {order.items.map((item, index) => (
          <View key={item.id} style={styles.orderItem}>
            <Text style={styles.itemQuantity}>×{item.quantity}</Text>
            <Text style={styles.itemName}>{item.name}</Text>
            {item.notes && (
              <Text style={styles.itemNotes}>• {item.notes}</Text>
            )}
          </View>
        ))}
      </View>

      {/* Détails supplémentaires (si développé) */}
      {isExpanded && (
        <View style={styles.expandedDetails}>
          <Text style={styles.detailLabel}>
            Créée le: {order.createdAt.toLocaleTimeString('fr-FR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
          <Text style={styles.detailLabel}>
            Dernière mise à jour: {order.updatedAt.toLocaleTimeString('fr-FR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
          {order.estimatedTime && (
            <Text style={styles.detailLabel}>
              Temps estimé: {order.estimatedTime} minutes
            </Text>
          )}
        </View>
      )}

      {/* Boutons d'action */}
      {order.status !== 'ready' && (
        <View style={styles.actionButtons}>
          {order.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.startPreparingButton]}
              onPress={() => onStatusUpdate(order.id, 'preparing')}
            >
              <Text style={styles.startPreparingButtonText}>
                Commencer préparation
              </Text>
            </TouchableOpacity>
          )}
          
          {order.status === 'preparing' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.readyButton]}
              onPress={() => onStatusUpdate(order.id, 'ready')}
            >
              <Text style={styles.readyButtonText}>
                Commande prête
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

// Écran principal de la vue cuisine
const KitchenViewScreen: React.FC<KitchenViewScreenProps> = ({ navigation }) => {
  const [orders, setOrders] = useState<KitchenOrder[]>(mockKitchenOrders);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'preparing' | 'ready'>('all');

  // Filtrer les commandes selon le statut sélectionné
  const filteredOrders = selectedFilter === 'all' 
    ? orders 
    : orders.filter(order => order.status === selectedFilter);

  // Trier les commandes par priorité et temps d'attente
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    // Priorité d'abord
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    
    if (priorityDiff !== 0) return priorityDiff;
    
    // Puis par temps d'attente (plus ancien en premier)
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Mettre à jour le statut d'une commande
  const handleStatusUpdate = (orderId: string, newStatus: KitchenOrder['status']) => {
    setOrders(prevOrders => 
      prevOrders.map(order =>
        order.id === orderId
          ? {
              ...order,
              status: newStatus,
              updatedAt: new Date()
            }
          : order
      )
    );

    // TODO: Mettre à jour le CRDT
    console.log(`Commande ${orderId} mise à jour: ${newStatus}`);
    
    // Feedback utilisateur
    const statusText = newStatus === 'preparing' ? 'en préparation' : 'prête';
    Alert.alert(
      'Statut mis à jour',
      `La commande est maintenant ${statusText}`,
      [{ text: 'OK' }]
    );
  };

  // Actualiser la liste
  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Récupérer les données depuis le CRDT
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  // Obtenir les statistiques
  const getStats = () => {
    const pending = orders.filter(o => o.status === 'pending').length;
    const preparing = orders.filter(o => o.status === 'preparing').length;
    const ready = orders.filter(o => o.status === 'ready').length;
    
    return { pending, preparing, ready };
  };

  const stats = getStats();

  return (
    <View style={styles.container}>
      {/* En-tête avec statistiques */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vue Cuisine</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#FF9800' }]}>
              {stats.pending}
            </Text>
            <Text style={styles.statLabel}>En attente</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#2196F3' }]}>
              {stats.preparing}
            </Text>
            <Text style={styles.statLabel}>En préparation</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#4CAF50' }]}>
              {stats.ready}
            </Text>
            <Text style={styles.statLabel}>Prêtes</Text>
          </View>
        </View>
      </View>

      {/* Filtres de statut */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        {[
          { key: 'all', label: 'Toutes', count: orders.length },
          { key: 'pending', label: 'En attente', count: stats.pending },
          { key: 'preparing', label: 'En préparation', count: stats.preparing },
          { key: 'ready', label: 'Prêtes', count: stats.ready }
        ].map(filter => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterButton,
              selectedFilter === filter.key && styles.filterButtonActive
            ]}
            onPress={() => setSelectedFilter(filter.key as any)}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === filter.key && styles.filterButtonTextActive
            ]}>
              {filter.label}
            </Text>
            <View style={[
              styles.filterCount,
              selectedFilter === filter.key && styles.filterCountActive
            ]}>
              <Text style={[
                styles.filterCountText,
                selectedFilter === filter.key && styles.filterCountTextActive
              ]}>
                {filter.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Liste des commandes */}
      <ScrollView
        style={styles.ordersList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
      >
        {sortedOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Aucune commande {selectedFilter === 'all' ? '' : selectedFilter === 'pending' ? 'en attente' : selectedFilter === 'preparing' ? 'en préparation' : 'prête'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Les nouvelles commandes apparaîtront ici
            </Text>
          </View>
        ) : (
          sortedOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onStatusUpdate={handleStatusUpdate}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  filtersContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filtersContent: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginRight: 8,
  },
  filterButtonTextActive: {
    color: 'white',
  },
  filterCount: {
    backgroundColor: '#ddd',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  filterCountText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  filterCountTextActive: {
    color: 'white',
  },
  ordersList: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderCardReady: {
    opacity: 0.7,
    backgroundColor: '#f8f9fa',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  tableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tableNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 12,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  orderMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTime: {
    fontSize: 12,
    color: '#666',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  timeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  estimatedTime: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  overdueTime: {
    color: '#F44336',
    fontWeight: 'bold',
  },
  overdueWarning: {
    fontSize: 12,
    color: '#F44336',
    fontWeight: '600',
  },
  itemsList: {
    marginBottom: 12,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
    marginRight: 8,
    minWidth: 20,
  },
  itemName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  itemNotes: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginLeft: 8,
  },
  expandedDetails: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  startPreparingButton: {
    backgroundColor: '#2196F3',
  },
  startPreparingButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  readyButton: {
    backgroundColor: '#4CAF50',
  },
  readyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default KitchenViewScreen;
