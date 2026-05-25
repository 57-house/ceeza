import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { waitForDB } from '../db/database';
import { useDatabaseReady } from '../hooks/useDatabaseReady';
import { useSyncRefresh } from '../hooks/useSyncRefresh';
import { orderService } from '../services/orderService';
import { broadcastOrderReady } from '../services/syncService';
import { Order, OrderItem } from '../types/order';

export default function KitchenScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(() => {
    try {
      const preparing = orderService.getOrdersByStatus('PREPARING');
      setOrders(preparing);
    } catch (error) {
      console.error('Erreur chargement cuisine:', error);
    }
  }, []);

  useSyncRefresh(loadOrders);

  useDatabaseReady(loadOrders, [loadOrders]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    waitForDB().then(() => {
      if (cancelled) return;
      interval = setInterval(loadOrders, 8000);
    });
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [loadOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
    setRefreshing(false);
  };

  const handleComplete = (order: Order) => {
    Alert.alert(
      'Commande terminée',
      `Marquer la table ${order.table_number} comme prête ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Terminé',
          onPress: () => {
            try {
              const completed = orderService.completeKitchenOrder(order.id);
              if (completed) {
                broadcastOrderReady(completed);
              }
              loadOrders();
            } catch (error) {
              console.error('Erreur:', error);
              Alert.alert('Erreur', 'Impossible de terminer la commande');
            }
          },
        },
      ]
    );
  };

  const renderItemLine = (item: OrderItem) => {
    const supplements = item.supplements || [];
    return (
      <View key={item.id} style={styles.lineItem}>
        <Text style={styles.lineText}>
          {item.quantity}x {item.menu_item_name}
        </Text>
        {supplements.map((sup) => (
          <Text key={sup.id} style={styles.lineSub}>
            + {sup.menu_item_name}
          </Text>
        ))}
      </View>
    );
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.tableLabel}>Table {item.table_number}</Text>
        <Text style={styles.timeLabel}>
          {new Date(item.created_at).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>

      <View style={styles.itemsBlock}>{item.items.map(renderItemLine)}</View>

      <Text style={styles.total}>Total : {item.total.toFixed(2)} €</Text>

      <TouchableOpacity
        style={styles.doneButton}
        onPress={() => handleComplete(item)}
      >
        <Text style={styles.doneButtonText}>✅ Terminé</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🍳 Cuisine</Text>
        <Text style={styles.subtitle}>
          {orders.length} commande{orders.length !== 1 ? 's' : ''} en cours
        </Text>
      </View>

      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Aucune commande en cuisine</Text>
          <Text style={styles.emptyHint}>
            Les commandes envoyées depuis l&apos;onglet Commandes apparaîtront ici.
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableLabel: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  timeLabel: {
    fontSize: 14,
    color: '#888',
  },
  itemsBlock: {
    marginBottom: 12,
  },
  lineItem: {
    marginBottom: 6,
  },
  lineText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  lineSub: {
    fontSize: 13,
    color: '#666',
    marginLeft: 12,
    marginTop: 2,
  },
  total: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 12,
  },
  doneButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
