import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert
} from 'react-native';

// Types pour les tables
interface Table {
  id: string;
  number: number;
  seats: number;
  status: 'free' | 'occupied' | 'bill-requested';
  currentOrder?: {
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    total: number;
    startTime: Date;
  };
}

// Données mock pour les tables
const mockTables: Table[] = [
  {
    id: '1',
    number: 1,
    seats: 2,
    status: 'free'
  },
  {
    id: '2',
    number: 2,
    seats: 4,
    status: 'occupied',
    currentOrder: {
      items: [
        { name: 'Pizza Margherita', quantity: 2, price: 12.50 },
        { name: 'Coca-Cola', quantity: 2, price: 3.00 }
      ],
      total: 31.00,
      startTime: new Date(Date.now() - 45 * 60 * 1000) // Il y a 45 minutes
    }
  },
  {
    id: '3',
    number: 3,
    seats: 6,
    status: 'bill-requested',
    currentOrder: {
      items: [
        { name: 'Salade César', quantity: 1, price: 8.50 },
        { name: 'Poulet Rôti', quantity: 2, price: 15.00 },
        { name: 'Vin Rouge', quantity: 1, price: 6.50 }
      ],
      total: 45.00,
      startTime: new Date(Date.now() - 90 * 60 * 1000) // Il y a 1h30
    }
  },
  {
    id: '4',
    number: 4,
    seats: 2,
    status: 'free'
  },
  {
    id: '5',
    number: 5,
    seats: 8,
    status: 'occupied',
    currentOrder: {
      items: [
        { name: 'Plateau de Sushis', quantity: 1, price: 28.00 },
        { name: 'Thé Vert', quantity: 4, price: 2.50 }
      ],
      total: 38.00,
      startTime: new Date(Date.now() - 20 * 60 * 1000) // Il y a 20 minutes
    }
  },
  {
    id: '6',
    number: 6,
    seats: 4,
    status: 'free'
  },
  {
    id: '7',
    number: 7,
    seats: 6,
    status: 'occupied',
    currentOrder: {
      items: [
        { name: 'Steak Frites', quantity: 3, price: 18.50 },
        { name: 'Bière', quantity: 3, price: 4.50 }
      ],
      total: 69.00,
      startTime: new Date(Date.now() - 60 * 60 * 1000) // Il y a 1 heure
    }
  },
  {
    id: '8',
    number: 8,
    seats: 2,
    status: 'free'
  }
];

// Composant pour afficher une carte de table
const TableCard: React.FC<{
  table: Table;
  onPress: (table: Table) => void;
}> = ({ table, onPress }) => {
  const getStatusColor = () => {
    switch (table.status) {
      case 'free':
        return '#4CAF50'; // Vert
      case 'occupied':
        return '#FF9800'; // Orange
      case 'bill-requested':
        return '#F44336'; // Rouge
      default:
        return '#9E9E9E'; // Gris
    }
  };

  const getStatusText = () => {
    switch (table.status) {
      case 'free':
        return 'Libre';
      case 'occupied':
        return 'Occupée';
      case 'bill-requested':
        return 'Addition';
      default:
        return 'Inconnu';
    }
  };

  const getStatusIcon = () => {
    switch (table.status) {
      case 'free':
        return '🟢';
      case 'occupied':
        return '🟠';
      case 'bill-requested':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const formatDuration = (startTime: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - startTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 60) {
      return `${diffMins} min`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h${mins > 0 ? mins : ''}`;
    }
  };

  return (
    <TouchableOpacity
      style={[styles.tableCard, { borderLeftColor: getStatusColor() }]}
      onPress={() => onPress(table)}
      activeOpacity={0.7}
    >
      {/* En-tête de la table */}
      <View style={styles.tableHeader}>
        <View style={styles.tableNumberContainer}>
          <Text style={styles.tableNumber}>{table.number}</Text>
        </View>
        <View style={styles.statusContainer}>
          <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>
      </View>

      {/* Informations de la table */}
      <View style={styles.tableInfo}>
        <Text style={styles.seatsText}>
          {table.seats} place{table.seats > 1 ? 's' : ''}
        </Text>
        
        {table.currentOrder && (
          <View style={styles.orderInfo}>
            <Text style={styles.orderDuration}>
              {formatDuration(table.currentOrder.startTime)}
            </Text>
            <Text style={styles.orderTotal}>
              {table.currentOrder.total.toFixed(2)} €
            </Text>
            <Text style={styles.orderItems}>
              {table.currentOrder.items.length} article{table.currentOrder.items.length > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Bouton d'action */}
      <View style={styles.actionContainer}>
        <Text style={styles.actionText}>
          {table.status === 'free' ? 'Nouvelle commande' : 'Gérer commande'}
        </Text>
        <Text style={styles.actionArrow}>→</Text>
      </View>
    </TouchableOpacity>
  );
};

// Écran principal de la carte des tables
const TableMapScreen: React.FC = () => {
  const [tables] = useState<Table[]>(mockTables);

  const handleTablePress = (table: Table) => {
    // Navigation vers OrderEditorScreen
    Alert.alert(
      `Table ${table.number}`,
      `Ouverture de l'éditeur de commande pour la table ${table.number}`,
      [
        {
          text: 'Annuler',
          style: 'cancel'
        },
        {
          text: 'Ouvrir',
          onPress: () => {
            // TODO: Navigation vers OrderEditorScreen
            console.log(`Navigation vers OrderEditorScreen pour la table ${table.number}`);
          }
        }
      ]
    );
  };

  const getTablesByStatus = (status: Table['status']) => {
    return tables.filter(table => table.status === status);
  };

  const getStatusSummary = () => {
    const free = getTablesByStatus('free').length;
    const occupied = getTablesByStatus('occupied').length;
    const billRequested = getTablesByStatus('bill-requested').length;
    
    return { free, occupied, billRequested };
  };

  const summary = getStatusSummary();

  return (
    <ScrollView style={styles.container}>
      {/* En-tête avec résumé */}
      <View style={styles.header}>
        <Text style={styles.title}>Carte des Tables</Text>
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: '#4CAF50' }]}>
              {summary.free}
            </Text>
            <Text style={styles.summaryLabel}>Libres</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: '#FF9800' }]}>
              {summary.occupied}
            </Text>
            <Text style={styles.summaryLabel}>Occupées</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: '#F44336' }]}>
              {summary.billRequested}
            </Text>
            <Text style={styles.summaryLabel}>Addition</Text>
          </View>
        </View>
      </View>

      {/* Grille des tables */}
      <View style={styles.tablesGrid}>
        {tables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            onPress={handleTablePress}
          />
        ))}
      </View>

      {/* Légende */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Légende</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <Text style={styles.legendIcon}>🟢</Text>
            <Text style={styles.legendText}>Table libre</Text>
          </View>
          <View style={styles.legendItem}>
            <Text style={styles.legendIcon}>🟠</Text>
            <Text style={styles.legendText}>Table occupée</Text>
          </View>
          <View style={styles.legendItem}>
            <Text style={styles.legendIcon}>🔴</Text>
            <Text style={styles.legendText}>Addition demandée</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const { width } = Dimensions.get('window');
const cardWidth = (width - 60) / 2; // 2 colonnes avec marges

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  tableCard: {
    width: cardWidth,
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
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableNumberContainer: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableNumber: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tableInfo: {
    marginBottom: 12,
  },
  seatsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  orderInfo: {
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 6,
  },
  orderDuration: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  orderItems: {
    fontSize: 12,
    color: '#666',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  actionArrow: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  legend: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    alignItems: 'center',
  },
  legendIcon: {
    fontSize: 20,
    marginBottom: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default TableMapScreen;
