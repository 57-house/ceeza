import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  Platform,
  PermissionsAndroid
} from 'react-native';

// Types pour l'impression
interface PrinterDevice {
  id: string;
  name: string;
  type: 'bluetooth' | 'network' | 'usb';
  address?: string;
  port?: number;
  isConnected: boolean;
  isDefault: boolean;
}

interface PrintJob {
  id: string;
  type: 'receipt' | 'invoice' | 'kitchen' | 'bar';
  content: string;
  printerId: string;
  status: 'pending' | 'printing' | 'completed' | 'failed';
  timestamp: Date;
  retryCount: number;
}

interface PrintManagerProps {
  isVisible: boolean;
  onClose: () => void;
  onPrintComplete?: (jobId: string) => void;
  onPrintError?: (jobId: string, error: string) => void;
}

const PrintManager: React.FC<PrintManagerProps> = ({
  isVisible,
  onClose,
  onPrintComplete,
  onPrintError
}) => {
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterDevice | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Simuler la découverte d'imprimantes
  useEffect(() => {
    if (isVisible) {
      discoverPrinters();
    }
  }, [isVisible]);

  // Découvrir les imprimantes disponibles
  const discoverPrinters = async () => {
    setIsScanning(true);
    
    try {
      // Simulation de découverte d'imprimantes
      // En production, utilisez des bibliothèques comme react-native-thermal-receipt-printer
      const mockPrinters: PrinterDevice[] = [
        {
          id: 'printer_1',
          name: 'Imprimante Cuisine',
          type: 'bluetooth',
          address: '00:11:22:33:44:55',
          isConnected: false,
          isDefault: false
        },
        {
          id: 'printer_2',
          name: 'Imprimante Caisse',
          type: 'network',
          address: '192.168.1.100',
          port: 9100,
          isConnected: false,
          isDefault: true
        },
        {
          id: 'printer_3',
          name: 'Imprimante Bar',
          type: 'bluetooth',
          address: 'AA:BB:CC:DD:EE:FF',
          isConnected: false,
          isDefault: false
        }
      ];

      setPrinters(mockPrinters);
      
      // Connecter l'imprimante par défaut
      const defaultPrinter = mockPrinters.find(p => p.isDefault);
      if (defaultPrinter) {
        await connectToPrinter(defaultPrinter);
      }
    } catch (error) {
      console.error('Erreur lors de la découverte des imprimantes:', error);
      Alert.alert('Erreur', 'Impossible de découvrir les imprimantes');
    } finally {
      setIsScanning(false);
    }
  };

  // Demander les permissions Bluetooth (Android)
  const requestBluetoothPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permission Bluetooth',
            message: 'L\'application a besoin d\'accéder à la localisation pour utiliser Bluetooth',
            buttonNeutral: 'Demander plus tard',
            buttonNegative: 'Annuler',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  // Se connecter à une imprimante
  const connectToPrinter = async (printer: PrinterDevice) => {
    if (printer.type === 'bluetooth') {
      const hasPermission = await requestBluetoothPermissions();
      if (!hasPermission) {
        Alert.alert('Permission refusée', 'Permission Bluetooth requise');
        return;
      }
    }

    setIsConnecting(true);
    
    try {
      // Simulation de connexion
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setPrinters(prev => prev.map(p => ({
        ...p,
        isConnected: p.id === printer.id
      })));
      
      setSelectedPrinter(printer);
      Alert.alert('Succès', `Connecté à ${printer.name}`);
    } catch (error) {
      console.error('Erreur de connexion:', error);
      Alert.alert('Erreur', `Impossible de se connecter à ${printer.name}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Déconnecter d'une imprimante
  const disconnectPrinter = (printer: PrinterDevice) => {
    setPrinters(prev => prev.map(p => ({
      ...p,
      isConnected: p.id === printer.id ? false : p.isConnected
    })));
    
    if (selectedPrinter?.id === printer.id) {
      setSelectedPrinter(null);
    }
  };

  // Imprimer un document
  const printDocument = async (type: PrintJob['type'], content: string) => {
    if (!selectedPrinter) {
      Alert.alert('Erreur', 'Aucune imprimante sélectionnée');
      return;
    }

    const printJob: PrintJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      printerId: selectedPrinter.id,
      status: 'pending',
      timestamp: new Date(),
      retryCount: 0
    };

    setPrintJobs(prev => [...prev, printJob]);

    try {
      // Simulation d'impression
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setPrintJobs(prev => prev.map(job => 
        job.id === printJob.id 
          ? { ...job, status: 'completed' as const }
          : job
      ));
      
      onPrintComplete?.(printJob.id);
      Alert.alert('Succès', 'Document imprimé avec succès');
    } catch (error) {
      console.error('Erreur d\'impression:', error);
      
      setPrintJobs(prev => prev.map(job => 
        job.id === printJob.id 
          ? { ...job, status: 'failed' as const }
          : job
      ));
      
      onPrintError?.(printJob.id, error instanceof Error ? error.message : String(error));
      Alert.alert('Erreur', 'Échec de l\'impression');
    }
  };

  // Test d'impression
  const testPrint = () => {
    const testContent = `
=== TEST D'IMPRESSION ===
Date: ${new Date().toLocaleString()}
Imprimante: ${selectedPrinter?.name || 'Aucune'}
Type: Test
=====================
    `;
    
    printDocument('receipt', testContent);
  };

  // Obtenir le statut d'un job d'impression
  const getJobStatusText = (status: PrintJob['status']) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'printing': return 'Impression...';
      case 'completed': return 'Terminé';
      case 'failed': return 'Échec';
      default: return 'Inconnu';
    }
  };

  // Obtenir la couleur du statut
  const getJobStatusColor = (status: PrintJob['status']) => {
    switch (status) {
      case 'pending': return '#FF9800';
      case 'printing': return '#2196F3';
      case 'completed': return '#4CAF50';
      case 'failed': return '#F44336';
      default: return '#9E9E9E';
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
          <Text style={styles.title}>Gestionnaire d'impression</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Section Imprimantes */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Imprimantes disponibles</Text>
              <TouchableOpacity 
                style={styles.scanButton} 
                onPress={discoverPrinters}
                disabled={isScanning}
              >
                <Text style={styles.scanButtonText}>
                  {isScanning ? 'Recherche...' : 'Rechercher'}
                </Text>
              </TouchableOpacity>
            </View>

            {printers.map(printer => (
              <View key={printer.id} style={styles.printerItem}>
                <View style={styles.printerInfo}>
                  <Text style={styles.printerName}>{printer.name}</Text>
                  <Text style={styles.printerType}>
                    {printer.type === 'bluetooth' ? '📶 Bluetooth' : 
                     printer.type === 'network' ? '🌐 Réseau' : '🔌 USB'}
                  </Text>
                  <Text style={styles.printerAddress}>
                    {printer.address}
                    {printer.port && `:${printer.port}`}
                  </Text>
                </View>
                
                <View style={styles.printerActions}>
                  {printer.isConnected ? (
                    <TouchableOpacity
                      style={styles.disconnectButton}
                      onPress={() => disconnectPrinter(printer)}
                    >
                      <Text style={styles.disconnectButtonText}>Déconnecter</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.connectButton}
                      onPress={() => connectToPrinter(printer)}
                      disabled={isConnecting}
                    >
                      <Text style={styles.connectButtonText}>
                        {isConnecting ? 'Connexion...' : 'Connecter'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  
                  {printer.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Par défaut</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Section Actions d'impression */}
          {selectedPrinter && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Actions d'impression - {selectedPrinter.name}
              </Text>
              
              <View style={styles.printActions}>
                <TouchableOpacity
                  style={styles.printActionButton}
                  onPress={() => printDocument('receipt', 'Contenu du reçu...')}
                >
                  <Text style={styles.printActionButtonText}>📄 Reçu</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.printActionButton}
                  onPress={() => printDocument('invoice', 'Contenu de la facture...')}
                >
                  <Text style={styles.printActionButtonText}>🧾 Facture</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.printActionButton}
                  onPress={() => printDocument('kitchen', 'Commande cuisine...')}
                >
                  <Text style={styles.printActionButtonText}>👨‍🍳 Cuisine</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.printActionButton}
                  onPress={() => printDocument('bar', 'Commande bar...')}
                >
                  <Text style={styles.printActionButtonText}>🍺 Bar</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity
                style={styles.testButton}
                onPress={testPrint}
              >
                <Text style={styles.testButtonText}>🧪 Test d'impression</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Section Historique des impressions */}
          {printJobs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Historique des impressions</Text>
              
              {printJobs.slice(-10).reverse().map(job => (
                <View key={job.id} style={styles.jobItem}>
                  <View style={styles.jobInfo}>
                    <Text style={styles.jobType}>
                      {job.type === 'receipt' ? '📄' : 
                       job.type === 'invoice' ? '🧾' : 
                       job.type === 'kitchen' ? '👨‍🍳' : '🍺'} {job.type}
                    </Text>
                    <Text style={styles.jobTime}>
                      {job.timestamp.toLocaleTimeString()}
                    </Text>
                  </View>
                  
                  <View style={[
                    styles.jobStatus,
                    { backgroundColor: getJobStatusColor(job.status) }
                  ]}>
                    <Text style={styles.jobStatusText}>
                      {getJobStatusText(job.status)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

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
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  scanButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  printerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  printerInfo: {
    flex: 1,
  },
  printerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  printerType: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  printerAddress: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  printerActions: {
    alignItems: 'flex-end',
  },
  connectButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  disconnectButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  disconnectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  defaultBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  defaultBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  printActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  printActionButton: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  printActionButtonText: {
    color: '#1C1C1E',
    fontSize: 14,
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  jobItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  jobInfo: {
    flex: 1,
  },
  jobType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  jobTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  jobStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  jobStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default PrintManager;
