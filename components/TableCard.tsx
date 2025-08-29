import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

// Types pour les tables
interface Table {
  id: string;
  number: number;
  status: 'free' | 'occupied' | 'bill-requested';
  hasOrder?: boolean;
  orderCount?: number;
}

interface TableCardProps {
  table: Table;
  onPress: (table: Table) => void;
  size?: 'small' | 'medium' | 'large';
}

const TableCard: React.FC<TableCardProps> = ({ 
  table, 
  onPress, 
  size = 'medium' 
}) => {
  // Déterminer la couleur selon le statut
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

  // Déterminer le texte du statut
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

  // Déterminer la taille des éléments selon la prop size
  const getSizes = () => {
    switch (size) {
      case 'small':
        return {
          container: 80,
          tableId: 24,
          statusText: 10,
          badge: 16,
          badgeText: 8
        };
      case 'large':
        return {
          container: 120,
          tableId: 32,
          statusText: 14,
          badge: 24,
          badgeText: 12
        };
      default: // medium
        return {
          container: 100,
          tableId: 28,
          statusText: 12,
          badge: 20,
          badgeText: 10
        };
    }
  };

  const sizes = getSizes();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          width: sizes.container,
          height: sizes.container,
          borderRadius: sizes.container / 2
        }
      ]}
      onPress={() => onPress(table)}
      activeOpacity={0.7}
    >
      {/* ID de la table */}
      <View style={styles.tableIdContainer}>
        <Text style={[
          styles.tableId,
          { fontSize: sizes.tableId }
        ]}>
          {table.number}
        </Text>
      </View>

      {/* État de la table */}
      <View style={styles.statusContainer}>
        <View style={[
          styles.statusDot,
          {
            backgroundColor: getStatusColor(),
            width: sizes.statusText,
            height: sizes.statusText,
            borderRadius: sizes.statusText / 2
          }
        ]} />
        <Text style={[
          styles.statusText,
          {
            fontSize: sizes.statusText,
            color: getStatusColor()
          }
        ]}>
          {getStatusText()}
        </Text>
      </View>

      {/* Badge de commande (si applicable) */}
      {table.hasOrder && (
        <View style={[
          styles.orderBadge,
          {
            width: sizes.badge,
            height: sizes.badge,
            borderRadius: sizes.badge / 2
          }
        ]}>
          <Text style={[
            styles.orderBadgeText,
            { fontSize: sizes.badgeText }
          ]}>
            {table.orderCount || '!'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  tableIdContainer: {
    marginBottom: 4,
  },
  tableId: {
    fontWeight: 'bold',
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  statusDot: {
    marginRight: 4,
  },
  statusText: {
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  orderBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  orderBadgeText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default TableCard;


