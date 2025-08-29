import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  TextInput
} from 'react-native';

// Types pour les commandes de caisse
interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

interface CashRegisterOrder {
  id: string;
  tableId: string;
  tableNumber: number;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'served' | 'paid' | 'cancelled';
  createdAt: Date;
  servedAt: Date;
  paidAt?: Date;
  paymentMethod?: 'cash' | 'card' | 'other';
  tip?: number;
  customerNotes?: string;
}

interface CashRegisterScreenProps {
  navigation: any;
}

// Données mock pour les commandes (sera remplacé par doc.orders)
const mockCashRegisterOrders: CashRegisterOrder[] = [
  {
    id: '1',
    tableId: '2',
    tableNumber: 2,
    items: [
      { id: '1', name: 'Pizza Margherita', quantity: 2, unitPrice: 12.50, totalPrice: 25.00, notes: 'Sans basilic' },
      { id: '6', name: 'Coca-Cola', quantity: 2, unitPrice: 3.00, totalPrice: 6.00 }
    ],
    subtotal: 31.00,
    tax: 3.10,
    total: 34.10,
    status: 'served',
    createdAt: new Date(Date.now() - 90 * 60 * 1000), // Il y a 1h30
    servedAt: new Date(Date.now() - 30 * 60 * 1000), // Servie il y a 30 min
    customerNotes: 'Client pressé'
  },
  {
    id: '2',
    tableId: '5',
    tableNumber: 5,
    items: [
      { id: '8', name: 'Plateau de Sushis', quantity: 1, unitPrice: 28.00, totalPrice: 28.00 },
      { id: '7', name: 'Thé Vert', quantity: 4, unitPrice: 2.50, totalPrice: 10.00 }
    ],
    subtotal: 38.00,
    tax: 3.80,
    total: 41.80,
    status: 'paid',
    createdAt: new Date(Date.now() - 120 * 60 * 1000), // Il y a 2h
    servedAt: new Date(Date.now() - 45 * 60 * 1000), // Servie il y a 45 min
    paidAt: new Date(Date.now() - 15 * 60 * 1000), // Payée il y a 15 min
    paymentMethod: 'card',
    tip: 5.00
  },
  {
    id: '3',
    tableId: '7',
    tableNumber: 7,
    items: [
      { id: '4', name: 'Steak Frites', quantity: 3, unitPrice: 18.50, totalPrice: 55.50, notes: 'Steaks saignants' },
      { id: '7', name: 'Bière', quantity: 3, unitPrice: 4.50, totalPrice: 13.50 }
    ],
    subtotal: 69.00,
    tax: 6.90,
    total: 75.90,
    status: 'served',
    createdAt: new Date(Date.now() - 60 * 60 * 1000), // Il y a 1h
    servedAt: new Date(Date.now() - 20 * 60 * 1000), // Servie il y a 20 min
    customerNotes: 'Table d\'anniversaire'
  },
  {
    id: '4',
    tableId: '3',
    tableNumber: 3,
    items: [
      { id: '3', name: 'Salade César', quantity: 1, unitPrice: 8.50, totalPrice: 8.50 },
      { id: '5', name: 'Poulet Rôti', quantity: 2, unitPrice: 16.00, totalPrice: 32.00 },
      { id: '7', name: 'Vin Rouge', quantity: 1, unitPrice: 6.50, totalPrice: 6.50 }
    ],
    subtotal: 47.00,
    tax: 4.70,
    total: 51.70,
    status: 'cancelled',
    createdAt: new Date(Date.now() - 150 * 60 * 1000), // Il y a 2h30
    servedAt: new Date(Date.now() - 60 * 60 * 1000), // Servie il y a 1h
    customerNotes: 'Client mécontent - remboursement'
  }
];

// Composant pour afficher une commande individuelle
const OrderCard: React.FC<{
  order: CashRegisterOrder;
  onMarkAsPaid: (orderId: string, paymentMethod: 'cash' | 'card' | 'other', tip?: number) => void;
  onCancelOrder: (orderId: string) => void;
}> = ({ order, onMarkAsPaid, onCancelOrder }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'card' | 'other'>('card');
  const [tipAmount, setTipAmount] = useState<string>('');

  // Formater la durée écoulée depuis le service
  const formatTimeSinceServed = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `Il y a ${hours}h${mins > 0 ? mins : ''}`;
  };

  // Obtenir la couleur du statut
  const getStatusColor = () => {
    switch (order.status) {
      case 'served': return '#FF9800'; // Orange
      case 'paid': return '#4CAF50'; // Vert
      case 'cancelled': return '#F44336'; // Rouge
      default: return '#9E9E9E'; // Gris
    }
  };

  // Obtenir le texte du statut
  const getStatusText = () => {
    switch (order.status) {
      case 'served': return 'Servie';
      case 'paid': return 'Payée';
      case 'cancelled': return 'Annulée';
      default: return 'Inconnu';
    }
  };

  // Obtenir l'icône du statut
  const getStatusIcon = () => {
    switch (order.status) {
      case 'served': return '🍽️';
      case 'paid': return '✅';
      case 'cancelled': return '❌';
      default: return '❓';
    }
  };

  // Gérer le paiement
  const handlePayment = () => {
    const tip = parseFloat(tipAmount) || 0;
    onMarkAsPaid(order.id, selectedPaymentMethod, tip);
    setShowPaymentModal(false);
    setTipAmount('');
  };

  // Calculer le pourcentage de pourboire
  const getTipPercentage = () => {
    if (!order.tip || order.total === 0) return 0;
    return Math.round((order.tip / order.total) * 100);
  };

  return (
    <View style={[
      styles.orderCard,
      { borderLeftColor: getStatusColor() },
      order.status === 'paid' && styles.orderCardPaid,
      order.status === 'cancelled' && styles.orderCardCancelled
    ]}>
      {/* En-tête de la commande */}
      <TouchableOpacity
        style={styles.orderHeader}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.8}
      >
        <View style={styles.orderInfo}>
          <View style={styles.tableInfo}>
            <Text style={styles.tableNumber}>Table {order.tableNumber}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {getStatusText()}
              </Text>
            </View>
          </View>
          
          <View style={styles.orderMeta}>
            <Text style={styles.orderTime}>
              Servie {formatTimeSinceServed(order.servedAt)}
            </Text>
            <Text style={styles.orderTotal}>
              {order.total.toFixed(2)} €
            </Text>
          </View>
        </View>

        <View style={styles.expandIcon}>
          <Text style={styles.expandIconText}>
            {isExpanded ? '▼' : '▶'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Détails de la commande (si développé) */}
      {isExpanded && (
        <View style={styles.expandedDetails}>
          {/* Liste des articles */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>Articles commandés</Text>
            {order.items.map((item, index) => (
              <View key={item.id} style={styles.orderItem}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemQuantity}>×{item.quantity}</Text>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemTotal}>{item.totalPrice.toFixed(2)} €</Text>
                </View>
                {item.notes && (
                  <Text style={styles.itemNotes}>• {item.notes}</Text>
                )}
              </View>
            ))}
          </View>

          {/* Détails de paiement */}
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Détails de paiement</Text>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Sous-total:</Text>
              <Text style={styles.paymentValue}>{order.subtotal.toFixed(2)} €</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>TVA:</Text>
              <Text style={styles.paymentValue}>{order.tax.toFixed(2)} €</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Total:</Text>
              <Text style={[styles.paymentValue, styles.totalValue]}>
                {order.total.toFixed(2)} €
              </Text>
            </View>
            {order.tip && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Pourboire:</Text>
                <Text style={styles.paymentValue}>
                  {order.tip.toFixed(2)} € ({getTipPercentage()}%)
                </Text>
              </View>
            )}
            {order.paymentMethod && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Méthode:</Text>
                <Text style={styles.paymentValue}>
                  {order.paymentMethod === 'cash' ? 'Espèces' : 
                   order.paymentMethod === 'card' ? 'Carte' : 'Autre'}
                </Text>
              </View>
            )}
          </View>

          {/* Notes client */}
          {order.customerNotes && (
            <View style={styles.notesSection}>
              <Text style={styles.sectionTitle}>Notes client</Text>
              <Text style={styles.customerNotes}>{order.customerNotes}</Text>
            </View>
          )}

          {/* Horodatages */}
          <View style={styles.timestampsSection}>
            <Text style={styles.sectionTitle}>Horodatages</Text>
            <Text style={styles.timestamp}>
              Créée: {order.createdAt.toLocaleString('fr-FR')}
            </Text>
            <Text style={styles.timestamp}>
              Servie: {order.servedAt.toLocaleString('fr-FR')}
            </Text>
            {order.paidAt && (
              <Text style={styles.timestamp}>
                Payée: {order.paidAt.toLocaleString('fr-FR')}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Boutons d'action */}
      {order.status === 'served' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => onCancelOrder(order.id)}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.payButton]}
            onPress={() => setShowPaymentModal(true)}
          >
            <Text style={styles.payButtonText}>Marquer comme payée</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal de paiement */}
      {showPaymentModal && (
        <View style={styles.paymentModal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Paiement - Table {order.tableNumber}</Text>
            
            {/* Méthode de paiement */}
            <View style={styles.paymentMethodSection}>
              <Text style={styles.modalLabel}>Méthode de paiement:</Text>
              <View style={styles.paymentMethodButtons}>
                {[
                  { key: 'card', label: '💳 Carte', color: '#2196F3' },
                  { key: 'cash', label: '💰 Espèces', color: '#4CAF50' },
                  { key: 'other', label: '📱 Autre', color: '#9C27B0' }
                ].map(method => (
                  <TouchableOpacity
                    key={method.key}
                    style={[
                      styles.paymentMethodButton,
                      { backgroundColor: selectedPaymentMethod === method.key ? method.color : '#f0f0f0' }
                    ]}
                    onPress={() => setSelectedPaymentMethod(method.key as any)}
                  >
                    <Text style={[
                      styles.paymentMethodButtonText,
                      { color: selectedPaymentMethod === method.key ? 'white' : '#666' }
                    ]}>
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Pourboire */}
            <View style={styles.tipSection}>
              <Text style={styles.modalLabel}>Pourboire (optionnel):</Text>
              <TextInput
                style={styles.tipInput}
                placeholder="0.00"
                value={tipAmount}
                onChangeText={setTipAmount}
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
              <Text style={styles.tipHint}>€</Text>
            </View>

            {/* Total avec pourboire */}
            <View style={styles.totalSection}>
              <Text style={styles.modalLabel}>Total à payer:</Text>
              <Text style={styles.modalTotal}>
                {(order.total + (parseFloat(tipAmount) || 0)).toFixed(2)} €
              </Text>
            </View>

            {/* Boutons d'action */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => setShowPaymentModal(false)}
              >
                <Text style={styles.cancelModalButtonText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmPaymentButton]}
                onPress={handlePayment}
              >
                <Text style={styles.confirmPaymentButtonText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

// Écran principal de la caisse
const CashRegisterScreen: React.FC<CashRegisterScreenProps> = ({ navigation }) => {
  const [orders, setOrders] = useState<CashRegisterOrder[]>(mockCashRegisterOrders);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'served' | 'paid' | 'cancelled'>('served');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrer les commandes selon le statut sélectionné
  const filteredOrders = selectedFilter === 'all' 
    ? orders 
    : orders.filter(order => order.status === selectedFilter);

  // Filtrer par recherche
  const searchedOrders = searchQuery.trim() === '' 
    ? filteredOrders 
    : filteredOrders.filter(order => 
        order.tableNumber.toString().includes(searchQuery) ||
        order.items.some(item => 
          item.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );

  // Trier les commandes par temps de service (plus récent en premier)
  const sortedOrders = [...searchedOrders].sort((a, b) => 
    b.servedAt.getTime() - a.servedAt.getTime()
  );

  // Marquer une commande comme payée
  const handleMarkAsPaid = (orderId: string, paymentMethod: 'cash' | 'card' | 'other', tip?: number) => {
    setOrders(prevOrders => 
      prevOrders.map(order =>
        order.id === orderId
          ? {
              ...order,
              status: 'paid',
              paidAt: new Date(),
              paymentMethod,
              tip: tip || 0
            }
          : order
      )
    );

    // TODO: Mettre à jour le CRDT
    console.log(`Commande ${orderId} marquée comme payée: ${paymentMethod}, pourboire: ${tip || 0}`);
    
    Alert.alert(
      'Paiement confirmé',
      'La commande a été marquée comme payée',
      [{ text: 'OK' }]
    );
  };

  // Annuler une commande
  const handleCancelOrder = (orderId: string) => {
    Alert.alert(
      'Annuler la commande',
      'Êtes-vous sûr de vouloir annuler cette commande ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui',
          style: 'destructive',
          onPress: () => {
            setOrders(prevOrders => 
              prevOrders.map(order =>
                order.id === orderId
                  ? { ...order, status: 'cancelled' }
                  : order
              )
            );
            
            // TODO: Mettre à jour le CRDT
            console.log(`Commande ${orderId} annulée`);
            
            Alert.alert(
              'Commande annulée',
              'La commande a été annulée',
              [{ text: 'OK' }]
            );
          }
        }
      ]
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
    const served = orders.filter(o => o.status === 'served').length;
    const paid = orders.filter(o => o.status === 'paid').length;
    const cancelled = orders.filter(o => o.status === 'cancelled').length;
    
    const totalRevenue = orders
      .filter(o => o.status === 'paid')
      .reduce((sum, o) => sum + o.total + (o.tip || 0), 0);
    
    const totalTips = orders
      .filter(o => o.status === 'paid')
      .reduce((sum, o) => sum + (o.tip || 0), 0);
    
    return { served, paid, cancelled, totalRevenue, totalTips };
  };

  const stats = getStats();

  return (
    <View style={styles.container}>
      {/* En-tête avec statistiques */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Caisse</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#FF9800' }]}>
              {stats.served}
            </Text>
            <Text style={styles.statLabel}>À payer</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#4CAF50' }]}>
              {stats.paid}
            </Text>
            <Text style={styles.statLabel}>Payées</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#007AFF' }]}>
              {stats.totalRevenue.toFixed(0)}€
            </Text>
            <Text style={styles.statLabel}>CA du jour</Text>
          </View>
        </View>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par table ou plat..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>

      {/* Filtres de statut */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        {[
          { key: 'served', label: 'À payer', count: stats.served },
          { key: 'paid', label: 'Payées', count: stats.paid },
          { key: 'cancelled', label: 'Annulées', count: stats.cancelled },
          { key: 'all', label: 'Toutes', count: orders.length }
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
              Aucune commande {selectedFilter === 'all' ? '' : selectedFilter === 'served' ? 'à payer' : selectedFilter === 'paid' ? 'payée' : 'annulée'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery ? 'Aucun résultat pour cette recherche' : 'Les nouvelles commandes apparaîtront ici'}
            </Text>
          </View>
        ) : (
          sortedOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onMarkAsPaid={handleMarkAsPaid}
              onCancelOrder={handleCancelOrder}
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
  searchContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
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
  orderCardPaid: {
    opacity: 0.7,
    backgroundColor: '#f8f9fa',
  },
  orderCardCancelled: {
    opacity: 0.5,
    backgroundColor: '#ffebee',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  statusText: {
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
  expandIcon: {
    marginLeft: 12,
  },
  expandIconText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  expandedDetails: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
    marginBottom: 12,
  },
  itemsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  orderItem: {
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
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
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  itemNotes: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginLeft: 28,
  },
  paymentSection: {
    marginBottom: 16,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#666',
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  notesSection: {
    marginBottom: 16,
  },
  customerNotes: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 6,
  },
  timestampsSection: {
    marginBottom: 16,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  payButton: {
    backgroundColor: '#4CAF50',
  },
  payButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  paymentModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: width * 0.9,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  paymentMethodSection: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  paymentMethodButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentMethodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  paymentMethodButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tipSection: {
    marginBottom: 20,
  },
  tipInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  tipHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  totalSection: {
    marginBottom: 20,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  modalTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelModalButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelModalButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmPaymentButton: {
    backgroundColor: '#4CAF50',
  },
  confirmPaymentButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CashRegisterScreen;


