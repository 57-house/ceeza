import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useDatabaseReady } from '../hooks/useDatabaseReady';
import { useSyncRefresh } from '../hooks/useSyncRefresh';
import { menuService } from '../services/menuService';
import { MenuItem, MenuCategory, categoryLabels } from '../types/menu';

const CATEGORY_ORDER: MenuCategory[] = [
  'ENTREE',
  'PLAT',
  'DESSERT',
  'BOISSON',
  'SUPPLEMENT',
  'AUTRE',
];

export default function MenuScreen() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<MenuCategory>('PLAT');
  const [price, setPrice] = useState('');
  const [available, setAvailable] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null);

  const loadMenuItems = () => {
    try {
      const allItems = menuService.getAllMenuItems();
      setMenuItems(allItems);
    } catch (error) {
      console.error('Erreur lors du chargement du menu:', error);
      Alert.alert('Erreur', 'Impossible de charger le menu');
    }
  };

  useDatabaseReady(loadMenuItems);

  useSyncRefresh(loadMenuItems);

  const menuSections = useMemo(() => {
    const grouped = new Map<MenuCategory, MenuItem[]>();
    for (const cat of CATEGORY_ORDER) {
      grouped.set(cat, []);
    }
    for (const item of menuItems) {
      const cat = CATEGORY_ORDER.includes(item.category) ? item.category : 'AUTRE';
      grouped.get(cat)!.push(item);
    }
    return CATEGORY_ORDER.map((category) => ({
      category,
      title: categoryLabels[category],
      data: grouped
        .get(category)!
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    })).filter((section) => section.data.length > 0);
  }, [menuItems]);

  const categoriesWithItems = useMemo(
    () => new Set(menuSections.map((section) => section.category)),
    [menuSections]
  );

  /** Catégorie affichée : celle choisie si elle a encore des articles, sinon la première non vide */
  const activeCategory = useMemo<MenuCategory | null>(() => {
    if (selectedCategory && categoriesWithItems.has(selectedCategory)) return selectedCategory;
    return menuSections[0]?.category ?? null;
  }, [selectedCategory, categoriesWithItems, menuSections]);

  const displayedSections = useMemo(() => {
    if (!activeCategory) return [];
    return menuSections.filter((section) => section.category === activeCategory);
  }, [menuSections, activeCategory]);

  const handleOpenModal = (item?: MenuItem) => {
    if (item) {
      setEditItem(item);
      setName(item.name);
      setDescription(item.description);
      setCategory(item.category);
      setPrice(item.price.toString());
      setAvailable(item.available);
    } else {
      setEditItem(null);
      setName('');
      setDescription('');
      setCategory('PLAT');
      setPrice('');
      setAvailable(true);
    }
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setEditItem(null);
    setName('');
    setDescription('');
    setCategory('PLAT');
    setPrice('');
    setAvailable(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom est requis');
      return;
    }

    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
      Alert.alert('Erreur', 'Le prix doit être un nombre positif');
      return;
    }

    try {
      if (editItem) {
        menuService.updateMenuItem(
          editItem.id,
          name.trim(),
          description.trim(),
          category,
          priceValue,
          available
        );
        Alert.alert('Succès', 'Élément modifié avec succès');
      } else {
        menuService.addMenuItem(
          name.trim(),
          description.trim(),
          category,
          priceValue
        );
        Alert.alert('Succès', 'Élément ajouté au menu');
      }
      loadMenuItems();
      handleCloseModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder l\'élément');
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Confirmer la suppression',
      `Voulez-vous vraiment supprimer "${name}" du menu ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            try {
              menuService.deleteMenuItem(id);
              loadMenuItems();
              Alert.alert('Succès', 'Élément supprimé du menu');
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert('Erreur', 'Impossible de supprimer l\'élément');
            }
          },
        },
      ]
    );
  };

  const handleToggleAvailability = (item: MenuItem) => {
    try {
      menuService.toggleAvailability(item.id);
      loadMenuItems();
    } catch (error) {
      console.error('Erreur lors du changement de disponibilité:', error);
      Alert.alert('Erreur', 'Impossible de modifier la disponibilité');
    }
  };

  const getCategoryColor = (category: MenuCategory): string => {
    switch (category) {
      case 'ENTREE':
        return '#FF9800';
      case 'PLAT':
        return '#4CAF50';
      case 'DESSERT':
        return '#E91E63';
      case 'BOISSON':
        return '#2196F3';
      case 'SUPPLEMENT':
        return '#9C27B0';
      default:
        return '#757575';
    }
  };

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <View style={styles.menuCard}>
      <View style={styles.menuHeader}>
        <Text style={styles.menuName}>{item.name}</Text>
        <Text style={styles.menuPrice}>{item.price.toFixed(2)} €</Text>
      </View>

      {item.description ? (
        <Text style={styles.menuDescription}>{item.description}</Text>
      ) : null}

      <View style={styles.menuActions}>
        <TouchableOpacity
          style={[
            styles.availabilityButton,
            item.available
              ? styles.availableButton
              : styles.unavailableButton,
          ]}
          onPress={() => handleToggleAvailability(item)}
        >
          <Text
            style={[
              styles.availabilityText,
              item.available
                ? styles.availableText
                : styles.unavailableText,
            ]}
          >
            {item.available ? '✓ Disponible' : '✗ Indisponible'}
          </Text>
        </TouchableOpacity>

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

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🍽️ Menu du Restaurant</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleOpenModal()}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {menuItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Aucun élément dans le menu</Text>
          <Text style={styles.emptySubtext}>
            Appuyez sur "Ajouter" pour créer votre premier élément
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.categoryBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabs}
            contentContainerStyle={styles.categoryTabsContent}
          >
            {CATEGORY_ORDER.filter((cat) => categoriesWithItems.has(cat)).map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryTab,
                  activeCategory === cat && styles.categoryTabActive,
                  { borderColor: getCategoryColor(cat) },
                  activeCategory === cat && { backgroundColor: getCategoryColor(cat) },
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    activeCategory === cat && styles.categoryTabTextActive,
                  ]}
                >
                  {categoryLabels[cat]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          </View>

          <SectionList
            sections={displayedSections}
            renderItem={renderMenuItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled={false}
          />
        </>
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
                {editItem ? 'Modifier l\'élément' : 'Ajouter un élément'}
              </Text>

              <Text style={styles.label}>Nom *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Salade César"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description du plat..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Catégorie *</Text>
              <View style={styles.categoryContainer}>
                {CATEGORY_ORDER.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryOption,
                      category === cat && styles.categoryOptionSelected,
                      { borderColor: getCategoryColor(cat) },
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        category === cat && styles.categoryOptionTextSelected,
                      ]}
                    >
                      {categoryLabels[cat]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Prix (€) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 12.50"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />

              {editItem && (
                <>
                  <Text style={styles.label}>Disponibilité</Text>
                  <TouchableOpacity
                    style={[
                      styles.switchButton,
                      available && styles.switchButtonActive,
                    ]}
                    onPress={() => setAvailable(!available)}
                  >
                    <Text
                      style={[
                        styles.switchText,
                        available && styles.switchTextActive,
                      ]}
                    >
                      {available ? '✓ Disponible' : '✗ Indisponible'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

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
  categoryBar: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categoryTabs: {
    flexGrow: 0,
  },
  categoryTabsContent: {
    paddingRight: 8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  categoryTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
  },
  categoryTabActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    lineHeight: 18,
    textAlign: 'center',
  },
  categoryTabTextActive: {
    color: '#fff',
  },
  list: {
    padding: 16,
    paddingBottom: 24,
  },
  menuCard: {
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
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  menuName: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 12,
  },
  menuPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  menuDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  menuActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  availabilityButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  availableButton: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  unavailableButton: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  availableText: {
    color: '#4CAF50',
  },
  unavailableText: {
    color: '#F44336',
  },
  editButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: '#F44336',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  categoryOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: '#fff',
  },
  categoryOptionSelected: {
    backgroundColor: '#f0f0f0',
  },
  categoryOptionText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
  },
  categoryOptionTextSelected: {
    color: '#111',
    fontWeight: '700',
  },
  switchButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },
  switchButtonActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  switchText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  switchTextActive: {
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

