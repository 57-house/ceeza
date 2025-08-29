import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

// Types pour les éléments du menu
interface MenuItem {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

interface MenuItemCardProps {
  item: MenuItem;
  onAddToOrder: (item: MenuItem) => void;
  size?: 'small' | 'medium' | 'large';
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({ 
  item, 
  onAddToOrder, 
  size = 'medium' 
}) => {
  // Déterminer la taille des éléments selon la prop size
  const getSizes = () => {
    switch (size) {
      case 'small':
        return {
          container: 120,
          name: 14,
          price: 16,
          button: 24,
          buttonText: 16
        };
      case 'large':
        return {
          container: 180,
          name: 18,
          price: 20,
          button: 36,
          buttonText: 20
        };
      default: // medium
        return {
          container: 150,
          name: 16,
          price: 18,
          button: 32,
          buttonText: 18
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
          height: sizes.container * 0.8,
          borderRadius: 12
        }
      ]}
      onPress={() => onAddToOrder(item)}
      activeOpacity={0.7}
    >
      {/* Nom du plat */}
      <View style={styles.nameContainer}>
        <Text style={[
          styles.name,
          { fontSize: sizes.name }
        ]} numberOfLines={2}>
          {item.name}
        </Text>
      </View>

      {/* Prix et bouton d'ajout */}
      <View style={styles.bottomSection}>
        <Text style={[
          styles.price,
          { fontSize: sizes.price }
        ]}>
          {item.price.toFixed(2)} €
        </Text>
        
        <TouchableOpacity
          style={[
            styles.addButton,
            {
              width: sizes.button,
              height: sizes.button,
              borderRadius: sizes.button / 2,
              opacity: item.available ? 1 : 0.5
            }
          ]}
          onPress={() => onAddToOrder(item)}
          disabled={!item.available}
        >
          <Text style={[
            styles.addButtonText,
            { fontSize: sizes.buttonText }
          ]}>
            +
          </Text>
        </TouchableOpacity>
      </View>

      {/* Indicateur de disponibilité */}
      {!item.available && (
        <View style={styles.unavailableOverlay}>
          <Text style={styles.unavailableText}>Indisponible</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    justifyContent: 'space-between',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  nameContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  name: {
    fontWeight: '600',
    color: '#333',
    lineHeight: 20,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  price: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  addButton: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  unavailableOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unavailableText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
});

export default MenuItemCard;
