import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions
} from 'react-native';

// Types pour le menu et les commandes
interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
}

interface OrderLine {
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

interface Order {
  tableId: string;
  lines: OrderLine[];
  total: number;
  status: 'draft' | 'sent' | 'preparing' | 'ready';
  createdAt: Date;
  updatedAt: Date;
}

interface OrderEditorScreenProps {
  route: {
    params: {
      tableId: string;
      tableNumber: number;
    };
  };
}

// Données mock pour le menu (sera remplacé par doc.menuItems)
const mockMenuItems: MenuItem[] = [
  {
    id: '1',
    name: 'Pizza Margherita',
    description: 'Tomate, mozzarella, basilic',
    price: 12.50,
    category: 'Pizzas',
    available: true
  },
  {
    id: '2',
    name: 'Pizza Quattro Stagioni',
    description: 'Artichauts, champignons, jambon, olives',
    price: 15.00,
    category: 'Pizzas',
    available: true
  },
  {
    id: '3',
    name: 'Salade César',
    description: 'Laitue, parmesan, croûtons, sauce césar',
    price: 8.50,
    category: 'Entrées',
    available: true
  },
  {
    id: '4',
    name: 'Steak Frites',
    description: 'Steak de bœuf, frites maison, salade',
    price: 18.50,
    category: 'Plats',
    available: true
  },
  {
    id: '5',
    name: 'Poulet Rôti',
    description: 'Poulet fermier, légumes de saison',
    price: 16.00,
    category: 'Plats',
    available: true
  },
  {
    id: '6',
    name: 'Coca-Cola',
    description: 'Soda 33cl',
    price: 3.00,
    category: 'Boissons',
    available: true
  },
  {
    id: '7',
    name: 'Vin Rouge',
    description: 'Verre de vin rouge 15cl',
    price: 6.50,
    category: 'Boissons',
    available: true
  },
  {
    id: '8',
    name: 'Tiramisu',
    description: 'Dessert italien traditionnel',
    price: 7.00,
    category: 'Desserts',
    available: true
  }
];

// Composant pour afficher un élément du menu
const MenuItemCard: React.FC<{
  item: MenuItem;
  onAddToOrder: (item: MenuItem) => void;
}> = ({ item, onAddToOrder }) => {
  return (
    <View style={styles.menuItemCard}>
      <View style={styles.menuItemInfo}>
        <Text style={styles.menuItemName}>{item.name}</Text>
        <Text style={styles.menuItemDescription}>{item.description}</Text>
        <Text style={styles.menuItemCategory}>{item.category}</Text>
      </View>
      <View style={styles.menuItemActions}>
        <Text style={styles.menuItemPrice}>{item.price.toFixed(2)} €</Text>
        <TouchableOpacity
          style={[
            styles.addButton,
            { opacity: item.available ? 1 : 0.5 }
          ]}
          onPress={() => onAddToOrder(item)}
          disabled={!item.available}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Composant pour afficher une ligne de commande
const OrderLineCard: React.FC<{
  line: OrderLine;
  menuItem: MenuItem;
  onUpdateQuantity: (menuItemId: string, quantity: number) => void;
  onRemoveLine: (menuItemId: string) => void;
  onUpdateNotes: (menuItemId: string, notes: string) => void;
}> = ({ line, menuItem, onUpdateQuantity, onRemoveLine, onUpdateNotes }) => {
  const [notes, setNotes] = useState(line.notes || '');

  const handleQuantityChange = (delta: number) => {
    const newQuantity = Math.max(0, line.quantity + delta);
    if (newQuantity === 0) {
      onRemoveLine(line.menuItemId);
    } else {
      onUpdateQuantity(line.menuItemId, newQuantity);
    }
  };

  const handleNotesChange = (text: string) => {
    setNotes(text);
    onUpdateNotes(line.menuItemId, text);
  };

  return (
    <View style={styles.orderLineCard}>
      <View style={styles.orderLineHeader}>
        <Text style={styles.orderLineName}>{menuItem.name}</Text>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemoveLine(line.menuItemId)}
        >
          <Text style={styles.removeButtonText}>×</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.orderLineDetails}>
        <View style={styles.quantityControls}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(-1)}
          >
            <Text style={styles.quantityButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.quantityText}>{line.quantity}</Text>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(1)}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.orderLinePricing}>
          <Text style={styles.unitPrice}>{line.unitPrice.toFixed(2)} €</Text>
          <Text style={styles.totalPrice}>{line.totalPrice.toFixed(2)} €</Text>
        </View>
      </View>
      
      <TextInput
        style={styles.notesInput}
        placeholder="Notes spéciales..."
        value={notes}
        onChangeText={handleNotesChange}
        multiline
        numberOfLines={2}
      />
    </View>
  );
};

// Composant pour la barre de résumé de commande
const OrderSummaryBar: React.FC<{
  total: number;
  itemCount: number;
  onSendToKitchen: () => void;
  onSaveDraft: () => void;
}> = ({ total, itemCount, onSendToKitchen, onSaveDraft }) => {
  return (
    <View style={styles.orderSummaryBar}>
      <View style={styles.summaryInfo}>
        <Text style={styles.summaryText}>
          {itemCount} article{itemCount > 1 ? 's' : ''}
        </Text>
        <Text style={styles.summaryTotal}>{total.toFixed(2)} €</Text>
      </View>
      
      <View style={styles.summaryActions}>
        <TouchableOpacity
          style={styles.saveDraftButton}
          onPress={onSaveDraft}
        >
          <Text style={styles.saveDraftButtonText}>Sauvegarder</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.sendToKitchenButton,
            { opacity: itemCount > 0 ? 1 : 0.5 }
          ]}
          onPress={onSendToKitchen}
          disabled={itemCount === 0}
        >
          <Text style={styles.sendToKitchenButtonText}>
            Envoyer en cuisine
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Écran principal de l'éditeur de commande
const OrderEditorScreen: React.FC<OrderEditorScreenProps> = ({ route }) => {
  const { tableId, tableNumber } = route.params;
  
  // État local (sera remplacé par le CRDT)
  const [menuItems] = useState<MenuItem[]>(mockMenuItems);
  const [order, setOrder] = useState<Order>({
    tableId,
    lines: [],
    total: 0,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('Toutes');

  // Obtenir les catégories uniques
  const categories = ['Toutes', ...Array.from(new Set(menuItems.map(item => item.category)))];

  // Filtrer les éléments du menu par catégorie
  const filteredMenuItems = selectedCategory === 'Toutes' 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  // Ajouter un élément à la commande
  const addToOrder = (menuItem: MenuItem) => {
    setOrder(prevOrder => {
      const existingLine = prevOrder.lines.find(line => line.menuItemId === menuItem.id);
      
      if (existingLine) {
        // Mettre à jour la quantité existante
        const updatedLines = prevOrder.lines.map(line =>
          line.menuItemId === menuItem.id
            ? {
                ...line,
                quantity: line.quantity + 1,
                totalPrice: (line.quantity + 1) * line.unitPrice
              }
            : line
        );
        
        return {
          ...prevOrder,
          lines: updatedLines,
          total: updatedLines.reduce((sum, line) => sum + line.totalPrice, 0),
          updatedAt: new Date()
        };
      } else {
        // Ajouter une nouvelle ligne
        const newLine: OrderLine = {
          menuItemId: menuItem.id,
          quantity: 1,
          unitPrice: menuItem.price,
          totalPrice: menuItem.price
        };
        
        const newLines = [...prevOrder.lines, newLine];
        return {
          ...prevOrder,
          lines: newLines,
          total: prevOrder.total + menuItem.price,
          updatedAt: new Date()
        };
      }
    });
  };

  // Mettre à jour la quantité d'une ligne
  const updateQuantity = (menuItemId: string, quantity: number) => {
    setOrder(prevOrder => {
      const updatedLines = prevOrder.lines.map(line =>
        line.menuItemId === menuItemId
          ? {
              ...line,
              quantity,
              totalPrice: quantity * line.unitPrice
            }
          : line
      );
      
      return {
        ...prevOrder,
        lines: updatedLines,
        total: updatedLines.reduce((sum, line) => sum + line.totalPrice, 0),
        updatedAt: new Date()
      };
    });
  };

  // Supprimer une ligne
  const removeLine = (menuItemId: string) => {
    setOrder(prevOrder => {
      const lineToRemove = prevOrder.lines.find(line => line.menuItemId === menuItemId);
      const updatedLines = prevOrder.lines.filter(line => line.menuItemId !== menuItemId);
      
      return {
        ...prevOrder,
        lines: updatedLines,
        total: prevOrder.total - (lineToRemove?.totalPrice || 0),
        updatedAt: new Date()
      };
    });
  };

  // Mettre à jour les notes d'une ligne
  const updateNotes = (menuItemId: string, notes: string) => {
    setOrder(prevOrder => ({
      ...prevOrder,
      lines: prevOrder.lines.map(line =>
        line.menuItemId === menuItemId
          ? { ...line, notes }
          : line
      ),
      updatedAt: new Date()
    }));
  };

  // Envoyer la commande en cuisine
  const sendToKitchen = () => {
    if (order.lines.length === 0) {
      Alert.alert('Erreur', 'Aucun article dans la commande');
      return;
    }

    Alert.alert(
      'Confirmer la commande',
      `Envoyer la commande de ${order.lines.length} article(s) pour la table ${tableNumber} ?`,
      [
        {
          text: 'Annuler',
          style: 'cancel'
        },
        {
          text: 'Envoyer',
          onPress: () => {
            // TODO: Mettre à jour le CRDT avec le statut 'sent'
            setOrder(prevOrder => ({
              ...prevOrder,
              status: 'sent',
              updatedAt: new Date()
            }));
            
            Alert.alert(
              'Commande envoyée',
              'La commande a été envoyée en cuisine',
              [{ text: 'OK' }]
            );
          }
        }
      ]
    );
  };

  // Sauvegarder le brouillon
  const saveDraft = () => {
    // TODO: Sauvegarder dans le CRDT
    Alert.alert(
      'Brouillon sauvegardé',
      'La commande a été sauvegardée',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Commande - Table {tableNumber}</Text>
        <Text style={styles.headerSubtitle}>
          {order.lines.length} article{order.lines.length > 1 ? 's' : ''} • 
          Total: {order.total.toFixed(2)} €
        </Text>
      </View>

      {/* Filtres de catégories */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFilters}
        contentContainerStyle={styles.categoryFiltersContent}
      >
        {categories.map(category => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryFilter,
              selectedCategory === category && styles.categoryFilterActive
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text style={[
              styles.categoryFilterText,
              selectedCategory === category && styles.categoryFilterTextActive
            ]}>
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Contenu principal */}
      <View style={styles.content}>
        {/* Liste des éléments du menu */}
        <ScrollView style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Menu</Text>
          {filteredMenuItems.map(item => (
            <MenuItemCard
              key={item.id}
              item={item}
              onAddToOrder={addToOrder}
            />
          ))}
        </ScrollView>

        {/* Résumé de la commande */}
        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>Commande en cours</Text>
          {order.lines.length === 0 ? (
            <View style={styles.emptyOrder}>
              <Text style={styles.emptyOrderText}>
                Aucun article dans la commande
              </Text>
              <Text style={styles.emptyOrderSubtext}>
                Sélectionnez des éléments du menu ci-dessus
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.orderLines}>
              {order.lines.map(line => {
                const menuItem = menuItems.find(item => item.id === line.menuItemId);
                if (!menuItem) return null;
                
                return (
                  <OrderLineCard
                    key={line.menuItemId}
                    line={line}
                    menuItem={menuItem}
                    onUpdateQuantity={updateQuantity}
                    onRemoveLine={removeLine}
                    onUpdateNotes={updateNotes}
                  />
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Barre de résumé de commande */}
      <OrderSummaryBar
        total={order.total}
        itemCount={order.lines.length}
        onSendToKitchen={sendToKitchen}
        onSaveDraft={saveDraft}
      />
    </View>
  );
};

const { width, height } = Dimensions.get('window');

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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  categoryFilters: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  categoryFiltersContent: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  categoryFilter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  categoryFilterActive: {
    backgroundColor: '#007AFF',
  },
  categoryFilterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryFilterTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  menuSection: {
    flex: 1,
    padding: 20,
  },
  orderSection: {
    flex: 1,
    padding: 20,
    backgroundColor: 'white',
    borderLeftWidth: 1,
    borderLeftColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  menuItemCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItemInfo: {
    marginBottom: 12,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  menuItemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  menuItemCategory: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  menuItemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuItemPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyOrder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyOrderText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptyOrderSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  orderLines: {
    flex: 1,
  },
  orderLineCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  orderLineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderLineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  removeButton: {
    backgroundColor: '#ff4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderLineDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    backgroundColor: '#007AFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },
  orderLinePricing: {
    alignItems: 'flex-end',
  },
  unitPrice: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  notesInput: {
    backgroundColor: 'white',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 40,
  },
  orderSummaryBar: {
    backgroundColor: 'white',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  summaryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  summaryText: {
    fontSize: 16,
    color: '#666',
  },
  summaryTotal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  summaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  saveDraftButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveDraftButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  sendToKitchenButton: {
    flex: 2,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendToKitchenButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default OrderEditorScreen;
