import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Dimensions
} from 'react-native';

// Types pour la gestion multi-salle
interface Room {
  id: string;
  name: string;
  description?: string;
  capacity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  tableCount: number;
  status: 'open' | 'closed' | 'maintenance';
}

interface Table {
  id: string;
  number: number;
  roomId: string;
  status: 'free' | 'occupied' | 'reserved' | 'maintenance';
  capacity: number;
  position: { x: number; y: number };
}

interface MultiRoomManagerProps {
  isVisible: boolean;
  onClose: () => void;
  onRoomSelect?: (roomId: string) => void;
  onRoomCreate?: (room: Room) => void;
  onRoomUpdate?: (room: Room) => void;
  onRoomDelete?: (roomId: string) => void;
}

const MultiRoomManager: React.FC<MultiRoomManagerProps> = ({
  isVisible,
  onClose,
  onRoomSelect,
  onRoomCreate,
  onRoomUpdate,
  onRoomDelete
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [newRoomData, setNewRoomData] = useState({
    name: '',
    description: '',
    capacity: 0
  });

  // Simuler des salles existantes
  useEffect(() => {
    if (isVisible) {
      const mockRooms: Room[] = [
        {
          id: 'room_1',
          name: 'Salle Principale',
          description: 'Salle principale avec vue sur le jardin',
          capacity: 80,
          isActive: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date(),
          tableCount: 12,
          status: 'open'
        },
        {
          id: 'room_2',
          name: 'Terrasse',
          description: 'Terrasse couverte avec chauffage',
          capacity: 40,
          isActive: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date(),
          tableCount: 8,
          status: 'open'
        },
        {
          id: 'room_3',
          name: 'Salle Privée',
          description: 'Salle privée pour événements',
          capacity: 25,
          isActive: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date(),
          tableCount: 4,
          status: 'open'
        },
        {
          id: 'room_4',
          name: 'Bar',
          description: 'Zone bar avec comptoir',
          capacity: 30,
          isActive: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date(),
          tableCount: 6,
          status: 'open'
        }
      ];
      setRooms(mockRooms);
    }
  }, [isVisible]);

  // Créer une nouvelle salle
  const createRoom = useCallback(() => {
    if (!newRoomData.name.trim() || newRoomData.capacity <= 0) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    const newRoom: Room = {
      id: `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newRoomData.name.trim(),
      description: newRoomData.description.trim(),
      capacity: newRoomData.capacity,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      tableCount: 0,
      status: 'open'
    };

    setRooms(prev => [...prev, newRoom]);
    onRoomCreate?.(newRoom);
    
    // Réinitialiser le formulaire
    setNewRoomData({ name: '', description: '', capacity: 0 });
    setIsCreatingRoom(false);
    
    Alert.alert('Succès', 'Salle créée avec succès');
  }, [newRoomData, onRoomCreate]);

  // Modifier une salle existante
  const updateRoom = useCallback(() => {
    if (!selectedRoom || !newRoomData.name.trim() || newRoomData.capacity <= 0) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    const updatedRoom: Room = {
      ...selectedRoom,
      name: newRoomData.name.trim(),
      description: newRoomData.description.trim(),
      capacity: newRoomData.capacity,
      updatedAt: new Date()
    };

    setRooms(prev => prev.map(room => 
      room.id === selectedRoom.id ? updatedRoom : room
    ));
    
    onRoomUpdate?.(updatedRoom);
    
    // Réinitialiser le formulaire
    setNewRoomData({ name: '', description: '', capacity: 0 });
    setIsEditingRoom(false);
    setSelectedRoom(null);
    
    Alert.alert('Succès', 'Salle modifiée avec succès');
  }, [selectedRoom, newRoomData, onRoomUpdate]);

  // Supprimer une salle
  const deleteRoom = useCallback((room: Room) => {
    Alert.alert(
      'Confirmer la suppression',
      `Êtes-vous sûr de vouloir supprimer la salle "${room.name}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            setRooms(prev => prev.filter(r => r.id !== room.id));
            onRoomDelete?.(room.id);
            
            if (selectedRoom?.id === room.id) {
              setSelectedRoom(null);
            }
            
            Alert.alert('Succès', 'Salle supprimée');
          }
        }
      ]
    );
  }, [selectedRoom, onRoomDelete]);

  // Activer/Désactiver une salle
  const toggleRoomStatus = useCallback((room: Room) => {
    const newStatus = room.status === 'open' ? 'closed' : 'open';
    const updatedRoom: Room = {
      ...room,
      status: newStatus,
      updatedAt: new Date()
    };

    setRooms(prev => prev.map(r => 
      r.id === room.id ? updatedRoom : r
    ));
    
    onRoomUpdate?.(updatedRoom);
  }, [onRoomUpdate]);

  // Commencer l'édition d'une salle
  const startEditingRoom = useCallback((room: Room) => {
    setSelectedRoom(room);
    setNewRoomData({
      name: room.name,
      description: room.description || '',
      capacity: room.capacity
    });
    setIsEditingRoom(true);
  }, []);

  // Annuler l'édition
  const cancelEdit = useCallback(() => {
    setIsEditingRoom(false);
    setSelectedRoom(null);
    setNewRoomData({ name: '', description: '', capacity: 0 });
  }, []);

  // Obtenir le statut de la salle
  const getRoomStatusText = (status: Room['status']) => {
    switch (status) {
      case 'open': return 'Ouverte';
      case 'closed': return 'Fermée';
      case 'maintenance': return 'Maintenance';
      default: return 'Inconnu';
    }
  };

  // Obtenir la couleur du statut
  const getRoomStatusColor = (status: Room['status']) => {
    switch (status) {
      case 'open': return '#34C759';
      case 'closed': return '#FF3B30';
      case 'maintenance': return '#FF9500';
      default: return '#8E8E93';
    }
  };

  // Obtenir l'icône du statut
  const getRoomStatusIcon = (status: Room['status']) => {
    switch (status) {
      case 'open': return '🟢';
      case 'closed': return '🔴';
      case 'maintenance': return '🟡';
      default: return '⚪';
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Gestion Multi-Salle</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Bouton Créer une salle */}
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setIsCreatingRoom(true)}
          >
            <Text style={styles.createButtonText}>➕ Créer une nouvelle salle</Text>
          </TouchableOpacity>

          {/* Liste des salles */}
          <View style={styles.roomsSection}>
            <Text style={styles.sectionTitle}>Salles disponibles</Text>
            
            {rooms.map(room => (
              <View key={room.id} style={styles.roomCard}>
                <View style={styles.roomHeader}>
                  <View style={styles.roomInfo}>
                    <Text style={styles.roomName}>{room.name}</Text>
                    <Text style={styles.roomDescription}>{room.description}</Text>
                    <View style={styles.roomStats}>
                      <Text style={styles.roomStat}>
                        📊 Capacité: {room.capacity} personnes
                      </Text>
                      <Text style={styles.roomStat}>
                        🪑 Tables: {room.tableCount}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.roomStatus}>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getRoomStatusColor(room.status) }
                    ]}>
                      <Text style={styles.statusText}>
                        {getRoomStatusIcon(room.status)} {getRoomStatusText(room.status)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.roomActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => onRoomSelect?.(room.id)}
                  >
                    <Text style={styles.actionButtonText}>👁️ Voir</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => startEditingRoom(room)}
                  >
                    <Text style={styles.actionButtonText}>✏️ Modifier</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: room.status === 'open' ? '#FF3B30' : '#34C759' }
                    ]}
                    onPress={() => toggleRoomStatus(room)}
                  >
                    <Text style={styles.actionButtonText}>
                      {room.status === 'open' ? '🔒 Fermer' : '🔓 Ouvrir'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => deleteRoom(room)}
                  >
                    <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                      🗑️ Supprimer
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Modal Création/Édition de salle */}
        <Modal
          visible={isCreatingRoom || isEditingRoom}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={cancelEdit}
        >
          <View style={styles.formContainer}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {isCreatingRoom ? 'Créer une nouvelle salle' : 'Modifier la salle'}
              </Text>
              <TouchableOpacity style={styles.formCloseButton} onPress={cancelEdit}>
                <Text style={styles.formCloseButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nom de la salle *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newRoomData.name}
                  onChangeText={(text) => setNewRoomData(prev => ({ ...prev, name: text }))}
                  placeholder="Ex: Salle Principale"
                  maxLength={50}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={newRoomData.description}
                  onChangeText={(text) => setNewRoomData(prev => ({ ...prev, description: text }))}
                  placeholder="Description de la salle (optionnel)"
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Capacité maximale *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newRoomData.capacity.toString()}
                  onChangeText={(text) => {
                    const capacity = parseInt(text) || 0;
                    setNewRoomData(prev => ({ ...prev, capacity }));
                  }}
                  placeholder="0"
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={cancelEdit}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={isCreatingRoom ? createRoom : updateRoom}
                >
                  <Text style={styles.saveButtonText}>
                    {isCreatingRoom ? 'Créer' : 'Modifier'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  roomsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  roomCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  roomInfo: {
    flex: 1,
    marginRight: 16,
  },
  roomName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  roomDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
    lineHeight: 20,
  },
  roomStats: {
    gap: 4,
  },
  roomStat: {
    fontSize: 12,
    color: '#8E8E93',
  },
  roomStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  roomActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#1C1C1E',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FFE5E5',
  },
  deleteButtonText: {
    color: '#FF3B30',
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  formCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formCloseButtonText: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  formContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E7',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MultiRoomManager;
