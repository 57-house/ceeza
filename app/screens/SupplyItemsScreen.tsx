import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { supplyItemService } from '../services/supplyItemService';
import { SupplyItem, SupplyUnit, unitLabels, unitShortLabels } from '../types/supply';

export default function SupplyItemsScreen() {
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<SupplyItem | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<SupplyUnit>('KG');
  const [minStock, setMinStock] = useState('');

  useEffect(() => {
    // Attendre un peu pour s'assurer que la DB est prête
    const timer = setTimeout(() => {
      loadItems();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const loadItems = () => {
    try {
      const allItems = supplyItemService.getAllSupplyItems();
      setItems(allItems);
    } catch (error) {
      console.error('Erreur lors du chargement des articles:', error);
      Alert.alert('Erreur', 'Impossible de charger les articles');
    }
  };

  const handleOpenModal = (item?: SupplyItem) => {
    if (item) {
      setEditItem(item);
      setName(item.name);
      setUnit(item.unit);
      setMinStock(item.min_stock.toString());
    } else {
      setEditItem(null);
      setName('');
      setUnit('KG');
      setMinStock('');
    }
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setEditItem(null);
    setName('');
    setUnit('KG');
    setMinStock('');
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom est requis');
      return;
    }

    const minStockValue = parseFloat(minStock);
    if (isNaN(minStockValue) || minStockValue < 0) {
      Alert.alert('Erreur', 'Le stock minimum doit être un nombre positif ou zéro');
      return;
    }

    try {
      if (editItem) {
        supplyItemService.updateSupplyItem(
          editItem.id,
          name.trim(),
          unit,
          minStockValue
        );
        Alert.alert('Succès', 'Article modifié avec succès');
      } else {
        supplyItemService.addSupplyItem(name.trim(), unit, minStockValue);
        Alert.alert('Succès', 'Article ajouté avec succès');
      }
      loadItems();
      handleCloseModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder l\'article');
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Confirmer la suppression',
      `Voulez-vous vraiment supprimer "${name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            try {
              supplyItemService.deleteSupplyItem(id);
              loadItems();
              Alert.alert('Succès', 'Article supprimé avec succès');
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert('Erreur', 'Impossible de supprimer l\'article');
            }
          },
        },
      ]
    );
  };

  const getStockStatus = (item: SupplyItem): { color: string; label: string } => {
    if (item.current_stock <= item.min_stock) {
      return { color: '#F44336', label: 'Stock faible' };
    } else if (item.current_stock <= item.min_stock * 1.5) {
      return { color: '#FF9800', label: 'Attention' };
    }
    return { color: '#4CAF50', label: 'OK' };
  };

  const renderItem = ({ item }: { item: SupplyItem }) => {
    const stockStatus = getStockStatus(item);

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName}>{item.name}</Text>
          <View
            style={[
              styles.stockBadge,
              { backgroundColor: stockStatus.color },
            ]}
          >
            <Text style={styles.stockBadgeText}>{stockStatus.label}</Text>
          </View>
        </View>

        <View style={styles.itemDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Stock actuel:</Text>
            <Text style={styles.detailValue}>
              {item.current_stock} {unitShortLabels[item.unit]}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Stock minimum:</Text>
            <Text style={styles.detailValue}>
              {item.min_stock} {unitShortLabels[item.unit]}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Unité:</Text>
            <Text style={styles.detailValue}>{unitLabels[item.unit]}</Text>
          </View>
        </View>

        <View style={styles.itemActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleOpenModal(item)}
          >
            <Text style={styles.editButtonText}>Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item.id, item.name)}
          >
            <Text style={styles.deleteButtonText}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const units: SupplyUnit[] = ['KG', 'L', 'PIECE', 'BOITE', 'SACHET', 'AUTRE'];

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📦 Articles d'Approvisionnement</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleOpenModal()}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Aucun article enregistré</Text>
          <Text style={styles.emptySubtext}>
            Appuyez sur "Ajouter" pour créer votre premier article
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCloseModal}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editItem ? 'Modifier l\'article' : 'Ajouter un article'}
              </Text>

              <Text style={styles.label}>Nom *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Tomates, Riz, Huile..."
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Unité *</Text>
              <View style={styles.unitContainer}>
                {units.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[
                      styles.unitOption,
                      unit === u && styles.unitOptionSelected,
                    ]}
                    onPress={() => setUnit(u)}
                  >
                    <Text
                      style={[
                        styles.unitOptionText,
                        unit === u && styles.unitOptionTextSelected,
                      ]}
                    >
                      {unitLabels[u]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Stock minimum *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 10, 5.5..."
                value={minStock}
                onChangeText={setMinStock}
                keyboardType="decimal-pad"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={handleCloseModal}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleSave}
                >
                  <Text style={styles.confirmButtonText}>
                    {editItem ? 'Modifier' : 'Ajouter'}
                  </Text>
                </TouchableOpacity>
              </View>
                </ScrollView>
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
  },
  itemCard: {
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
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  stockBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  itemDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  deleteButton: {
    backgroundColor: '#F44336',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  unitContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  unitOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  unitOptionSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  unitOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  unitOptionTextSelected: {
    color: '#4CAF50',
    fontWeight: '600',
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
});
