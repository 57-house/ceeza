import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { supplyItemService } from '../services/supplyItemService';
import { SupplyOrder, supplyOrderService } from '../services/supplyOrderService';
import { SupplyEntry, SupplyItem, SupplyUnit, unitShortLabels } from '../types/supply';

export default function DailySupplyScreen() {
  const [order, setOrder] = useState<SupplyOrder | null>(null);
  const [supplyItems, setSupplyItems] = useState<SupplyItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SupplyItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    // Attendre un peu pour s'assurer que la DB est prête
    const timer = setTimeout(() => {
      loadOrderForDate(selectedDate);
      loadSupplyItems();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const loadOrderForDate = (date: Date, createIfNotExists: boolean = true) => {
    try {
      const dateTimestamp = new Date(date);
      dateTimestamp.setHours(0, 0, 0, 0);
      const orderForDate = supplyOrderService.getSupplyOrderByDate(dateTimestamp.getTime());
      if (!orderForDate) {
        if (createIfNotExists) {
          // Créer un nouvel approvisionnement pour la date sélectionnée
          const orderId = supplyOrderService.createSupplyOrder(dateTimestamp.getTime());
          const newOrder = supplyOrderService.getSupplyOrderById(orderId);
          setOrder(newOrder);
        } else {
          // Ne pas créer d'approvisionnement, juste afficher un message
          Alert.alert('Information', 'Aucun approvisionnement trouvé pour cette date.');
          setOrder(null);
        }
      } else {
        setOrder(orderForDate);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'approvisionnement:', error);
      Alert.alert('Erreur', 'Impossible de charger l\'approvisionnement');
    }
  };

  const loadSupplyItems = () => {
    try {
      const items = supplyItemService.getAllSupplyItems();
      setSupplyItems(items);
    } catch (error) {
      console.error('Erreur lors du chargement des articles:', error);
    }
  };

  const handleOpenModal = () => {
    setSelectedItem(null);
    setQuantity('');
    setCost('');
    setModalVisible(true);
  };

  const handleSelectItem = (item: SupplyItem) => {
    setSelectedItem(item);
  };

  const handleAddItem = () => {
    if (!selectedItem) {
      Alert.alert('Erreur', 'Veuillez sélectionner un article');
      return;
    }

    const quantityValue = parseFloat(quantity);
    if (isNaN(quantityValue) || quantityValue <= 0) {
      Alert.alert('Erreur', 'La quantité doit être un nombre positif');
      return;
    }

    const costValue = parseFloat(cost);
    if (isNaN(costValue) || costValue < 0) {
      Alert.alert('Erreur', 'Le coût doit être un nombre positif ou zéro');
      return;
    }

    if (!order) {
      Alert.alert('Erreur', 'Approvisionnement non initialisé');
      return;
    }

    try {
      supplyOrderService.addItemToOrder(
        order.id,
        selectedItem.id,
        selectedItem.name,
        quantityValue,
        selectedItem.unit,
        costValue
      );
      loadOrderForDate(selectedDate);
      setModalVisible(false);
      setSelectedItem(null);
      setQuantity('');
      setCost('');
      Alert.alert('Succès', 'Article ajouté à l\'approvisionnement');
    } catch (error) {
      console.error('Erreur lors de l\'ajout:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter l\'article');
    }
  };

  const handleRemoveItem = (itemId: string, itemName: string) => {
    if (!order) return;

    Alert.alert(
      'Confirmer la suppression',
      `Voulez-vous vraiment retirer "${itemName}" de l'approvisionnement ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => {
            try {
              supplyOrderService.removeItemFromOrder(order.id, itemId);
              loadOrderForDate(selectedDate);
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert('Erreur', 'Impossible de retirer l\'article');
            }
          },
        },
      ]
    );
  };

  const handleCompleteOrder = () => {
    if (!order || order.items.length === 0) {
      Alert.alert('Erreur', 'Aucun article dans l\'approvisionnement');
      return;
    }

    Alert.alert(
      'Finaliser l\'approvisionnement',
      'Voulez-vous finaliser cet approvisionnement ? Les stocks seront mis à jour.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Finaliser',
          onPress: () => {
            try {
              supplyOrderService.completeSupplyOrder(order.id);
              loadOrderForDate(selectedDate);
              Alert.alert('Succès', 'Approvisionnement finalisé. Les stocks ont été mis à jour.');
            } catch (error) {
              console.error('Erreur lors de la finalisation:', error);
              Alert.alert('Erreur', 'Impossible de finaliser l\'approvisionnement');
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateChange = (dateString: string) => {
    const newDate = new Date(dateString);
    setSelectedDate(newDate);
    loadOrderForDate(newDate, false); // Ne pas créer automatiquement un nouvel approvisionnement
    setDateModalVisible(false);
  };

  const handleCreateNewOrder = () => {
    const dateTimestamp = new Date(selectedDate);
    dateTimestamp.setHours(0, 0, 0, 0);
    try {
      const orderId = supplyOrderService.createSupplyOrder(dateTimestamp.getTime());
      const newOrder = supplyOrderService.getSupplyOrderById(orderId);
      setOrder(newOrder);
      Alert.alert('Succès', 'Nouvel approvisionnement créé pour cette date');
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      Alert.alert('Erreur', 'Impossible de créer l\'approvisionnement');
    }
  };

  const handleDatePress = () => {
    setDateModalVisible(true);
  };

  const calculateTotal = (): number => {
    if (!order) return 0;
    return order.items.reduce((sum, item) => sum + (item.cost || 0), 0);
  };

  const renderOrderItem = ({ item }: { item: SupplyEntry }) => (
    <View style={styles.orderItemCard}>
      <View style={styles.orderItemHeader}>
        <Text style={styles.orderItemName}>{item.supply_item_name}</Text>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveItem(item.supply_item_id, item.supply_item_name)}
        >
          <Text style={styles.removeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.orderItemDetails}>
        <Text style={styles.orderItemDetail}>
          Quantité: {item.quantity} {unitShortLabels[item.unit as SupplyUnit]}
        </Text>
        <Text style={styles.orderItemDetail}>
          Coût: {item.cost ? `${item.cost.toFixed(2)} €` : 'Non renseigné'}
        </Text>
      </View>
    </View>
  );

  if (!order) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📋 Approvisionnement</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleOpenModal}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.dateFooter}>
        <TouchableOpacity 
          onPress={handleDatePress} 
          style={styles.dateFooterContainer}
        >
          <Text style={styles.dateFooterText}>
            📅 {formatDate(order.date)}
          </Text>
          <Text style={styles.dateChangeText}>Changer</Text>
        </TouchableOpacity>
      </View>

      {!order ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Aucun approvisionnement pour cette date</Text>
          <Text style={styles.emptySubtext}>
            Créez un nouvel approvisionnement pour commencer
          </Text>
          <TouchableOpacity
            style={styles.createOrderButton}
            onPress={handleCreateNewOrder}
          >
            <Text style={styles.createOrderButtonText}>Créer un nouvel approvisionnement</Text>
          </TouchableOpacity>
        </View>
      ) : order.items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Aucun article ajouté</Text>
          <Text style={styles.emptySubtext}>
            Appuyez sur "Ajouter" pour commencer l'approvisionnement
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={order.items}
            renderItem={renderOrderItem}
            keyExtractor={(item, index) => `${item.supply_item_id}-${index}`}
            contentContainerStyle={styles.list}
          />
          <View style={styles.footer}>
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>{calculateTotal().toFixed(2)} €</Text>
            </View>
            {order.status === 'PENDING' && (
              <TouchableOpacity
                style={styles.completeButton}
                onPress={handleCompleteOrder}
              >
                <Text style={styles.completeButtonText}>
                  ✓ Finaliser l'approvisionnement
                </Text>
              </TouchableOpacity>
            )}
            {order.status === 'COMPLETED' && (
              <View style={styles.completedBadge}>
                <Text style={styles.completedText}>✓ Approvisionnement finalisé</Text>
              </View>
            )}
          </View>
        </>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Ajouter un article</Text>

              {!selectedItem ? (
                <>
                  <Text style={styles.label}>Sélectionner un article *</Text>
                  <View style={styles.itemsList}>
                    {supplyItems.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.itemOption}
                        onPress={() => handleSelectItem(item)}
                      >
                        <Text style={styles.itemOptionName}>{item.name}</Text>
                        <Text style={styles.itemOptionUnit}>
                          {unitShortLabels[item.unit]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.selectedItemContainer}>
                    <Text style={styles.selectedItemName}>{selectedItem.name}</Text>
                    <TouchableOpacity
                      style={styles.changeItemButton}
                      onPress={() => setSelectedItem(null)}
                    >
                      <Text style={styles.changeItemText}>Changer</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>Quantité *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={`Ex: 5, 10.5... (${unitShortLabels[selectedItem.unit]})`}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                  />

                  <Text style={styles.label}>Coût (€)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 25.50 (optionnel)"
                    value={cost}
                    onChangeText={setCost}
                    keyboardType="decimal-pad"
                  />

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => setModalVisible(false)}
                    >
                      <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.confirmButton]}
                      onPress={handleAddItem}
                    >
                      <Text style={styles.confirmButtonText}>Ajouter</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={dateModalVisible}
        onRequestClose={() => setDateModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Choisir une date</Text>
                
                {Platform.OS === 'web' ? (
                  <View style={styles.datePickerContainer}>
                    {/* @ts-ignore - HTML input element for web */}
                    <input
                      type="date"
                      value={formatDateForInput(selectedDate)}
                      onChange={(e: any) => handleDateChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '16px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        backgroundColor: '#f9f9f9',
                        marginTop: '8px',
                      }}
                    />
                  </View>
                ) : (
                  <>
                    <View style={styles.datePickerContainer}>
                      <Text style={styles.label}>Année</Text>
                      <TextInput
                        style={styles.dateInput}
                        value={selectedDate.getFullYear().toString()}
                        onChangeText={(text) => {
                          const year = parseInt(text) || selectedDate.getFullYear();
                          const newDate = new Date(selectedDate);
                          newDate.setFullYear(year);
                          setSelectedDate(newDate);
                        }}
                        keyboardType="numeric"
                      />
                    </View>
                    
                    <View style={styles.datePickerContainer}>
                      <Text style={styles.label}>Mois</Text>
                      <TextInput
                        style={styles.dateInput}
                        value={(selectedDate.getMonth() + 1).toString()}
                        onChangeText={(text) => {
                          const month = parseInt(text) || selectedDate.getMonth() + 1;
                          const newDate = new Date(selectedDate);
                          newDate.setMonth(month - 1);
                          setSelectedDate(newDate);
                        }}
                        keyboardType="numeric"
                      />
                    </View>
                    
                    <View style={styles.datePickerContainer}>
                      <Text style={styles.label}>Jour</Text>
                      <TextInput
                        style={styles.dateInput}
                        value={selectedDate.getDate().toString()}
                        onChangeText={(text) => {
                          const day = parseInt(text) || selectedDate.getDate();
                          const newDate = new Date(selectedDate);
                          newDate.setDate(day);
                          setSelectedDate(newDate);
                        }}
                        keyboardType="numeric"
                      />
                    </View>
                  </>
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setDateModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.confirmButton]}
                    onPress={() => {
                      loadOrderForDate(selectedDate, false); // Ne pas créer automatiquement un nouvel approvisionnement
                      setDateModalVisible(false);
                    }}
                  >
                    <Text style={styles.confirmButtonText}>Valider</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    justifyContent: 'flex-end',
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
    position: 'absolute',
    left: 20,
  },
  dateContainer: {
    position: 'absolute',
    left: 20,
    top: 44,
  },
  date: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  dateChangeText: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
    fontWeight: '600',
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
  list: {
    padding: 16,
    paddingBottom: 200,
  },
  orderItemCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderItemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  orderItemDetails: {
    gap: 4,
  },
  orderItemDetail: {
    fontSize: 14,
    color: '#666',
  },
  footer: {
    position: 'absolute',
    bottom: 60,
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
  dateFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  completeButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  completedBadge: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  completedText: {
    color: '#4CAF50',
    fontSize: 16,
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
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  createOrderButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  createOrderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
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
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  itemsList: {
    maxHeight: 300,
  },
  itemOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  itemOptionName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  itemOptionUnit: {
    fontSize: 14,
    color: '#666',
  },
  selectedItemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    marginBottom: 16,
  },
  selectedItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  changeItemButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  changeItemText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
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
  datePickerContainer: {
    marginBottom: 16,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginTop: 8,
  },
  dateFooterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  dateFooterText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  newOrderButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 12,
  },
  newOrderButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

