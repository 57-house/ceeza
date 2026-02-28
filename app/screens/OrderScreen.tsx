import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { menuService } from '../services/menuService';
import { orderService } from '../services/orderService';
import { tableService } from '../services/tableService';
import { MenuCategory, MenuItem, categoryLabels } from '../types/menu';
import { Order, OrderItem } from '../types/order';
import { Table } from '../types/table';

export default function OrderScreen() {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | 'ALL'>('ALL');
  const [showTableModal, setShowTableModal] = useState(false);
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [showDrinkModal, setShowDrinkModal] = useState(false);
  const [lastAddedPlat, setLastAddedPlat] = useState<MenuItem | null>(null);
  const [selectedSupplements, setSelectedSupplements] = useState<MenuItem[]>([]);

  useEffect(() => {
    loadTables();
    loadMenuItems();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      loadOrder();
    }
  }, [selectedTable]);

  const loadTables = () => {
    try {
      const allTables = tableService.getAllTables();
      setTables(allTables);
    } catch (error) {
      console.error('Erreur lors du chargement des tables:', error);
    }
  };

  const loadMenuItems = () => {
    try {
      const items = menuService.getAllMenuItems();
      setMenuItems(items.filter((item) => item.available));
    } catch (error) {
      console.error('Erreur lors du chargement du menu:', error);
    }
  };

  const loadOrder = () => {
    if (!selectedTable) return;

    try {
      let currentOrder = orderService.getOpenOrderByTable(selectedTable.id);

      if (!currentOrder) {
        // Créer une nouvelle commande
        currentOrder = orderService.createOrder(selectedTable.id, selectedTable.number);
      }

      setOrder(currentOrder);
    } catch (error) {
      console.error('Erreur lors du chargement de la commande:', error);
      Alert.alert('Erreur', 'Impossible de charger la commande');
    }
  };

  const handleSelectTable = (table: Table) => {
    setSelectedTable(table);
    setShowTableModal(false);
  };

  const handleAddItem = (menuItem: MenuItem) => {
    if (!order) {
      Alert.alert('Erreur', 'Aucune commande active');
      return;
    }

    try {
      // Si c'est un plat principal, demander les suppléments
      if (menuItem.category === 'PLAT') {
        setLastAddedPlat(menuItem);
        setShowSupplementModal(true);
      } else {
        // Ajouter directement l'item
        orderService.addItemToOrder(order.id, menuItem, 1);
        loadOrder();
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter l\'élément');
    }
  };

  const handleAddPlatWithSupplements = (supplements: MenuItem[]) => {
    if (!order || !lastAddedPlat) return;

    // Stocker les suppléments et ouvrir le modal de boisson
    setSelectedSupplements(supplements);
    setShowSupplementModal(false);
    setShowDrinkModal(true);
  };

  const handleAddPlatWithSupplementsAndDrinks = (drinks: MenuItem[]) => {
    if (!order || !lastAddedPlat) return;

    try {
      // Ajouter le plat principal et récupérer son ID
      const platItemId = orderService.addItemToOrder(order.id, lastAddedPlat, 1);

      // Ajouter les suppléments associés au plat
      selectedSupplements.forEach((supplement) => {
        orderService.addItemToOrder(order.id, supplement, 1, platItemId);
      });

      // Ajouter les boissons associées au plat
      drinks.forEach((drink) => {
        orderService.addItemToOrder(order.id, drink, 1, platItemId);
      });

      loadOrder();
      setShowDrinkModal(false);
      setLastAddedPlat(null);
      setSelectedSupplements([]);
    } catch (error) {
      console.error('Erreur lors de l\'ajout:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter la commande');
    }
  };

  const handleRemoveItem = (itemId: string) => {
    if (!order) return;

    Alert.alert(
      'Confirmer la suppression',
      'Voulez-vous retirer cet élément de la commande ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => {
            try {
              orderService.removeItemFromOrder(order.id, itemId);
              loadOrder();
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert('Erreur', 'Impossible de retirer l\'élément');
            }
          },
        },
      ]
    );
  };

  const handleSendToKitchen = () => {
    if (!order) return;

    Alert.alert(
      'Envoyer à la cuisine',
      'Voulez-vous envoyer cette commande à la cuisine ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer',
          onPress: () => {
            try {
              orderService.updateOrderStatus(order.id, 'PREPARING');
              loadOrder();
              Alert.alert('Succès', 'Commande envoyée à la cuisine');
            } catch (error) {
              console.error('Erreur lors de l\'envoi:', error);
              Alert.alert('Erreur', 'Impossible d\'envoyer la commande');
            }
          },
        },
      ]
    );
  };

  const filteredMenuItems = selectedCategory === 'ALL'
    ? menuItems
    : menuItems.filter((item) => item.category === selectedCategory);

  const categories: (MenuCategory | 'ALL')[] = ['ALL', 'ENTREE', 'PLAT', 'DESSERT', 'BOISSON', 'SUPPLEMENT'];

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <TouchableOpacity
      style={styles.menuItemCard}
      onPress={() => handleAddItem(item)}
    >
      <View style={styles.menuItemInfo}>
        <Text style={styles.menuItemName}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.menuItemDescription}>{item.description}</Text>
        ) : null}
      </View>
      <Text style={styles.menuItemPrice}>{item.price.toFixed(2)} €</Text>
    </TouchableOpacity>
  );

  const renderOrderItem = ({ item }: { item: OrderItem }) => {
    // Séparer les suppléments et les boissons
    const supplements = item.supplements?.filter(sup => sup.category === 'SUPPLEMENT') || [];
    const drinks = item.supplements?.filter(sup => sup.category === 'BOISSON') || [];
    const others = item.supplements?.filter(sup => sup.category !== 'SUPPLEMENT' && sup.category !== 'BOISSON') || [];
    
    const hasComplements = supplements.length > 0 || drinks.length > 0 || others.length > 0;
    
    return (
      <View style={styles.orderItemCard}>
        <View style={styles.orderItemHeader}>
          <View style={styles.orderItemInfo}>
            <Text style={styles.orderItemName}>
              {item.quantity}x {item.menu_item_name}
            </Text>
            {hasComplements && (
              <View style={styles.complementsContainer}>
                {supplements.map((sup) => (
                  <Text key={sup.id} style={styles.complementDot}>
                    • {sup.menu_item_name}
                  </Text>
                ))}
                {drinks.map((drink) => (
                  <Text key={drink.id} style={styles.complementDot}>
                    • {drink.menu_item_name}
                  </Text>
                ))}
                {others.map((other) => (
                  <Text key={other.id} style={styles.complementDot}>
                    • {other.menu_item_name}
                  </Text>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveItem(item.id)}
          >
            <Text style={styles.removeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.orderItemPrice}>
          {(item.price * item.quantity).toFixed(2)} €
        </Text>
      </View>
    );
  };

  if (!selectedTable) {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>📝 Prise de Commande</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowTableModal(true)}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Sélectionnez une table pour commencer</Text>
          </View>

          <Modal
            visible={showTableModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowTableModal(false)}
          >
            <TouchableWithoutFeedback onPress={() => setShowTableModal(false)}>
              <View style={styles.modalOverlay}>
                <TouchableWithoutFeedback onPress={() => {}}>
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Sélectionner une table</Text>
                    <FlatList
                      data={tables.filter((t) => t.status !== 'CLEANING')}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.tableOption}
                          onPress={() => handleSelectTable(item)}
                        >
                          <Text style={styles.tableOptionText}>
                            Table {item.number} ({item.capacity} pers.)
                          </Text>
                          <Text style={styles.tableStatusText}>
                            {item.status === 'AVAILABLE' ? 'Disponible' : 'Occupée'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      keyExtractor={(item) => item.id}
                    />
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Table {selectedTable.number}</Text>
            <Text style={styles.orderTotal}>
              Total: {order?.total.toFixed(2) || '0.00'} €
            </Text>
          </View>
          <TouchableOpacity
            style={styles.changeTableButton}
            onPress={() => {
              setSelectedTable(null);
              setOrder(null);
            }}
          >
            <Text style={styles.changeTableButtonText}>Changer</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>Menu</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryTabs}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryTab,
                    selectedCategory === cat && styles.categoryTabActive,
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryTabText,
                      selectedCategory === cat && styles.categoryTabTextActive,
                    ]}
                  >
                    {cat === 'ALL' ? 'Tout' : categoryLabels[cat]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView 
              style={styles.menuList}
              showsVerticalScrollIndicator={true}
            >
              {filteredMenuItems.map((item) => (
                <View key={item.id}>
                  {renderMenuItem({ item })}
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.orderSection}>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>Commande</Text>
            </View>
            {order && order.items.length > 0 ? (
              <View style={styles.orderListContainer}>
                <ScrollView 
                  style={styles.orderList}
                  contentContainerStyle={styles.orderListContent}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  bounces={true}
                >
                  {order.items.map((item) => (
                    <View key={item.id}>
                      {renderOrderItem({ item })}
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <View style={styles.emptyOrder}>
                <Text style={styles.emptyOrderText}>Aucun élément dans la commande</Text>
              </View>
            )}
          </View>
        </View>

        {order && order.items.length > 0 && (
          <View style={styles.footer}>
            {/* <View style={styles.footerTotal}>
              <Text style={styles.footerTotalLabel}>Total:</Text>
              <Text style={styles.footerTotalValue}>{order.total.toFixed(2)} €</Text>
            </View> */}
            {order.status === 'OPEN' && (
              <TouchableOpacity
                style={styles.sendToKitchenButton}
                onPress={handleSendToKitchen}
              >
                <Text style={styles.sendToKitchenButtonText}>
                  🍳 Envoyer à la cuisine
                </Text>
              </TouchableOpacity>
            )}
            {order.status === 'PREPARING' && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>⏳ En préparation</Text>
              </View>
            )}
            {order.status === 'READY' && (
              <View style={styles.statusBadgeReady}>
                <Text style={styles.statusBadgeText}>✅ Prête</Text>
              </View>
            )}
          </View>
        )}

        {/* Modal pour les suppléments */}
        <Modal
          visible={showSupplementModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setShowSupplementModal(false);
            setLastAddedPlat(null);
          }}
        >
          <SupplementModal
            onClose={() => {
              setShowSupplementModal(false);
              setLastAddedPlat(null);
            }}
            onConfirm={handleAddPlatWithSupplements}
            supplements={menuItems.filter((item) => item.category === 'SUPPLEMENT')}
          />
        </Modal>

        {/* Modal pour les boissons */}
        <Modal
          visible={showDrinkModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setShowDrinkModal(false);
            setLastAddedPlat(null);
            setSelectedSupplements([]);
          }}
        >
          <DrinkModal
            onClose={() => {
              setShowDrinkModal(false);
              setLastAddedPlat(null);
              setSelectedSupplements([]);
            }}
            onConfirm={handleAddPlatWithSupplementsAndDrinks}
            drinks={menuItems.filter((item) => item.category === 'BOISSON')}
          />
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

// Composant modal pour les suppléments
function SupplementModal({
  onClose,
  onConfirm,
  supplements,
}: {
  onClose: () => void;
  onConfirm: (supplements: MenuItem[]) => void;
  supplements: MenuItem[];
}) {
  const [selectedSupplements, setSelectedSupplements] = useState<Set<string>>(new Set());

  const toggleSupplement = (supplementId: string) => {
    const newSet = new Set(selectedSupplements);
    if (newSet.has(supplementId)) {
      newSet.delete(supplementId);
    } else {
      newSet.add(supplementId);
    }
    setSelectedSupplements(newSet);
  };

  const handleConfirm = () => {
    const selected = supplements.filter((sup) => selectedSupplements.has(sup.id));
    onConfirm(selected);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ajouter des suppléments ?</Text>
            <Text style={styles.modalSubtitle}>
              Sélectionnez les suppléments à ajouter au plat
            </Text>

            <ScrollView style={styles.supplementsList}>
              {supplements.length === 0 ? (
                <Text style={styles.noSupplementsText}>Aucun supplément disponible</Text>
              ) : (
                supplements.map((supplement) => (
                  <TouchableOpacity
                    key={supplement.id}
                    style={[
                      styles.supplementOption,
                      selectedSupplements.has(supplement.id) && styles.supplementOptionSelected,
                    ]}
                    onPress={() => toggleSupplement(supplement.id)}
                  >
                    <Text
                      style={[
                        styles.supplementOptionText,
                        selectedSupplements.has(supplement.id) &&
                          styles.supplementOptionTextSelected,
                      ]}
                    >
                      {supplement.name}
                    </Text>
                    <Text style={styles.supplementPrice}>{supplement.price.toFixed(2)} €</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Passer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}

// Composant modal pour les boissons
function DrinkModal({
  onClose,
  onConfirm,
  drinks,
}: {
  onClose: () => void;
  onConfirm: (drinks: MenuItem[]) => void;
  drinks: MenuItem[];
}) {
  const [selectedDrinks, setSelectedDrinks] = useState<Set<string>>(new Set());

  const toggleDrink = (drinkId: string) => {
    const newSet = new Set(selectedDrinks);
    if (newSet.has(drinkId)) {
      newSet.delete(drinkId);
    } else {
      newSet.add(drinkId);
    }
    setSelectedDrinks(newSet);
  };

  const handleConfirm = () => {
    const selected = drinks.filter((drink) => selectedDrinks.has(drink.id));
    onConfirm(selected);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ajouter des boissons ?</Text>
            <Text style={styles.modalSubtitle}>
              Sélectionnez les boissons à ajouter au plat
            </Text>

            <ScrollView style={styles.supplementsList}>
              {drinks.length === 0 ? (
                <Text style={styles.noSupplementsText}>Aucune boisson disponible</Text>
              ) : (
                drinks.map((drink) => (
                  <TouchableOpacity
                    key={drink.id}
                    style={[
                      styles.supplementOption,
                      selectedDrinks.has(drink.id) && styles.supplementOptionSelected,
                    ]}
                    onPress={() => toggleDrink(drink.id)}
                  >
                    <Text
                      style={[
                        styles.supplementOptionText,
                        selectedDrinks.has(drink.id) &&
                          styles.supplementOptionTextSelected,
                      ]}
                    >
                      {drink.name}
                    </Text>
                    <Text style={styles.supplementPrice}>{drink.price.toFixed(2)} €</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Passer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  orderTotal: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 24,
  },
  changeTableButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  changeTableButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  menuSection: {
    flex: 1,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    flexDirection: 'column',
  },
  orderSection: {
    flex: 1,
    backgroundColor: '#fff',
    flexDirection: 'column',
  },
  sectionTitleContainer: {
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 16,
  },
  orderListContainer: {
    flex: 1,
  },
  categoryTabs: {
    maxHeight: 50,
    backgroundColor: '#f9f9f9',
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  categoryTabActive: {
    borderBottomColor: '#4CAF50',
  },
  categoryTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryTabTextActive: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  menuList: {
    flex: 1,
  },
  menuListContent: {
    flexGrow: 1,
  },
  menuItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  menuItemDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  menuItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  orderList: {
    flex: 1,
  },
  orderListContent: {
    paddingBottom: 100,
  },
  orderItemCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  complementsContainer: {
    marginTop: 6,
    marginLeft: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  complementDot: {
    fontSize: 11,
    color: '#999',
    marginRight: 8,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  orderItemPrice: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  emptyOrder: {
    padding: 40,
    alignItems: 'center',
  },
  emptyOrderText: {
    fontSize: 14,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  tableOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tableStatusText: {
    fontSize: 14,
    color: '#666',
  },
  supplementsList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  supplementOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  supplementOptionSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  supplementOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  supplementOptionTextSelected: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  supplementPrice: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  noSupplementsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  footerTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  footerTotalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  footerTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  sendToKitchenButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendToKitchenButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBadge: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  statusBadgeReady: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  statusBadgeText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

