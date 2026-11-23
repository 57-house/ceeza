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
import { tableService } from '../services/tableService';
import { Table, TableStatus } from '../types/table';

const CAPACITY_PRESETS = [2, 4, 6, 8, 10, 12];
const CAPACITY_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#795548', '#E91E63'];

function getCapacityColor(capacity: number, capacities: number[]): string {
  const idx = capacities.indexOf(capacity);
  return CAPACITY_COLORS[(idx >= 0 ? idx : capacity) % CAPACITY_COLORS.length];
}

function capacityLabel(capacity: number): string {
  return `${capacity} pers.`;
}

function capacitySectionTitle(capacity: number): string {
  return `Tables ${capacity} personne${capacity > 1 ? 's' : ''}`;
}

export default function TablesScreen() {
  const [tables, setTables] = useState<Table[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('');
  const [selectedCapacity, setSelectedCapacity] = useState<number | 'ALL'>('ALL');

  const loadTables = () => {
    try {
      const allTables = tableService.getAllTables();
      setTables(allTables);
    } catch (error) {
      console.error('Erreur lors du chargement des tables:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      Alert.alert('Erreur', `Impossible de charger les tables: ${errorMessage}`);
    }
  };

  useDatabaseReady(loadTables);
  useSyncRefresh(loadTables);

  const capacitiesInUse = useMemo(() => {
    const set = new Set(tables.map((t) => t.capacity));
    return [...set].sort((a, b) => a - b);
  }, [tables]);

  const tableSections = useMemo(() => {
    return capacitiesInUse.map((cap) => ({
      capacity: cap,
      title: capacitySectionTitle(cap),
      data: tables
        .filter((t) => t.capacity === cap)
        .sort((a, b) => a.number - b.number),
    }));
  }, [tables, capacitiesInUse]);

  const displayedSections = useMemo(() => {
    if (selectedCapacity === 'ALL') return tableSections;
    return tableSections.filter((section) => section.capacity === selectedCapacity);
  }, [tableSections, selectedCapacity]);

  const handleAddTable = () => {
    const num = parseInt(tableNumber, 10);
    const cap = parseInt(capacity, 10);

    if (!tableNumber || !capacity) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (isNaN(num) || num <= 0) {
      Alert.alert('Erreur', 'Le numéro de table doit être un nombre positif');
      return;
    }

    if (isNaN(cap) || cap <= 0) {
      Alert.alert('Erreur', 'La capacité doit être un nombre positif');
      return;
    }

    if (tableService.tableNumberExists(num)) {
      Alert.alert('Erreur', `La table numéro ${num} existe déjà`);
      return;
    }

    try {
      tableService.addTable(num, cap);
      loadTables();
      setModalVisible(false);
      setTableNumber('');
      setCapacity('');
      Alert.alert('Succès', 'Table ajoutée avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la table:', error);
      const msg = error instanceof Error ? error.message : '';
      Alert.alert(
        'Erreur',
        msg.includes('existe déjà') ? msg : 'Impossible d\'ajouter la table (numéro peut-être déjà pris sur le réseau)'
      );
    }
  };

  const handleDeleteTable = (id: string, number: number) => {
    Alert.alert(
      'Confirmer la suppression',
      `Voulez-vous vraiment supprimer la table ${number} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            try {
              tableService.deleteTable(id);
              loadTables();
              Alert.alert('Succès', 'Table supprimée avec succès');
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert('Erreur', 'Impossible de supprimer la table');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: TableStatus): string => {
    switch (status) {
      case 'AVAILABLE':
        return '#4CAF50';
      case 'OCCUPIED':
        return '#F44336';
      case 'RESERVED':
        return '#FF9800';
      case 'CLEANING':
        return '#2196F3';
      default:
        return '#757575';
    }
  };

  const getStatusLabel = (status: TableStatus): string => {
    switch (status) {
      case 'AVAILABLE':
        return 'Disponible';
      case 'OCCUPIED':
        return 'Occupée';
      case 'RESERVED':
        return 'Réservée';
      case 'CLEANING':
        return 'Nettoyage';
      default:
        return status;
    }
  };

  const renderTable = ({ item }: { item: Table }) => (
    <View style={styles.tableCard}>
      <View style={styles.tableHeader}>
        <Text style={styles.tableNumber}>Table {item.number}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteTable(item.id, item.number)}
      >
        <Text style={styles.deleteButtonText}>Supprimer</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSectionHeader = ({
    section,
  }: {
    section: { title: string; capacity: number; data: Table[] };
  }) => (
    <View
      style={[
        styles.sectionHeader,
        { borderLeftColor: getCapacityColor(section.capacity, capacitiesInUse) },
      ]}
    >
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>{section.data.length}</Text>
    </View>
  );

  const selectedCapacityNum = parseInt(capacity, 10);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🍽️ Gestion des Tables</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {tables.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Aucune table enregistrée</Text>
            <Text style={styles.emptySubtext}>
              Appuyez sur &quot;+&quot; pour créer votre première table
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.capacityBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.capacityTabs}
                contentContainerStyle={styles.capacityTabsContent}
              >
                <TouchableOpacity
                  style={[
                    styles.capacityTab,
                    selectedCapacity === 'ALL' && styles.capacityTabActive,
                  ]}
                  onPress={() => setSelectedCapacity('ALL')}
                >
                  <Text
                    style={[
                      styles.capacityTabText,
                      selectedCapacity === 'ALL' && styles.capacityTabTextActive,
                    ]}
                  >
                    Tout
                  </Text>
                </TouchableOpacity>
                {capacitiesInUse.map((cap) => (
                  <TouchableOpacity
                    key={cap}
                    style={[
                      styles.capacityTab,
                      selectedCapacity === cap && styles.capacityTabActive,
                      { borderColor: getCapacityColor(cap, capacitiesInUse) },
                      selectedCapacity === cap && {
                        backgroundColor: getCapacityColor(cap, capacitiesInUse),
                      },
                    ]}
                    onPress={() => setSelectedCapacity(cap)}
                  >
                    <Text
                      style={[
                        styles.capacityTabText,
                        selectedCapacity === cap && styles.capacityTabTextActive,
                      ]}
                    >
                      {capacityLabel(cap)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <SectionList
              sections={displayedSections}
              renderItem={renderTable}
              renderSectionHeader={
                selectedCapacity === 'ALL' ? renderSectionHeader : undefined
              }
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              stickySectionHeadersEnabled={selectedCapacity === 'ALL'}
            />
          </>
        )}

        <Modal
          animationType="slide"
          transparent
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Ajouter une table</Text>

                  <Text style={styles.label}>Numéro de table</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 1, 2, 3..."
                    value={tableNumber}
                    onChangeText={setTableNumber}
                    keyboardType="number-pad"
                  />

                  <Text style={styles.label}>Capacité (nombre de personnes)</Text>
                  <View style={styles.capacityContainer}>
                    {CAPACITY_PRESETS.map((cap) => (
                      <TouchableOpacity
                        key={cap}
                        style={[
                          styles.capacityOption,
                          selectedCapacityNum === cap && styles.capacityOptionSelected,
                          { borderColor: getCapacityColor(cap, CAPACITY_PRESETS) },
                          selectedCapacityNum === cap && {
                            backgroundColor: getCapacityColor(cap, CAPACITY_PRESETS),
                          },
                        ]}
                        onPress={() => setCapacity(String(cap))}
                      >
                        <Text
                          style={[
                            styles.capacityOptionText,
                            selectedCapacityNum === cap && styles.capacityOptionTextSelected,
                          ]}
                        >
                          {capacityLabel(cap)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Ou saisir une autre capacité (ex: 14)"
                    value={capacity}
                    onChangeText={setCapacity}
                    keyboardType="number-pad"
                  />

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => {
                        setModalVisible(false);
                        setTableNumber('');
                        setCapacity('');
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.confirmButton]}
                      onPress={handleAddTable}
                    >
                      <Text style={styles.confirmButtonText}>Ajouter</Text>
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
  capacityBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  capacityTabs: {
    flexGrow: 0,
  },
  capacityTabsContent: {
    paddingRight: 8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  capacityTab: {
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
  capacityTabActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  capacityTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    lineHeight: 18,
    textAlign: 'center',
  },
  capacityTabTextActive: {
    color: '#fff',
  },
  list: {
    padding: 16,
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    marginTop: 4,
    borderLeftWidth: 4,
    borderRadius: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionCount: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  tableCard: {
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
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#F44336',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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
    maxWidth: 400,
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
  capacityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  capacityOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  capacityOptionSelected: {},
  capacityOptionText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
  },
  capacityOptionTextSelected: {
    color: '#fff',
    fontWeight: '700',
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
