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
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useDatabaseReady } from '../hooks/useDatabaseReady';
import { useSyncRefresh } from '../hooks/useSyncRefresh';
import { tableService } from '../services/tableService';
import { Table, TableStatus } from '../types/table';

export default function TablesScreen() {
  const [tables, setTables] = useState<Table[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('');

  const loadTables = () => {
    try {
      const allTables = tableService.getAllTables();
      setTables(allTables);
    } catch (error) {
      console.error('Erreur lors du chargement des tables:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Détails de l\'erreur:', errorMessage);
      Alert.alert('Erreur', `Impossible de charger les tables: ${errorMessage}`);
    }
  };

  useDatabaseReady(loadTables);

  useSyncRefresh(loadTables);

  const handleAddTable = () => {
    const num = parseInt(tableNumber);
    const cap = parseInt(capacity);

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
      Alert.alert('Erreur', 'Impossible d\'ajouter la table');
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
      <Text style={styles.capacity}>Capacité: {item.capacity} personnes</Text>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteTable(item.id, item.number)}
      >
        <Text style={styles.deleteButtonText}>Supprimer</Text>
      </TouchableOpacity>
    </View>
  );

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
            Appuyez sur "Ajouter" pour créer votre première table
          </Text>
        </View>
      ) : (
        <FlatList
          data={tables}
          renderItem={renderTable}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
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
            <TextInput
              style={styles.input}
              placeholder="Ex: 2, 4, 6..."
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
  list: {
    padding: 16,
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
    marginBottom: 8,
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
  capacity: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
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

