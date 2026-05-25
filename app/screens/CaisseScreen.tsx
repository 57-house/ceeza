import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { waitForDB } from '../db/database';
import { useDatabaseReady } from '../hooks/useDatabaseReady';
import { useSyncRefresh } from '../hooks/useSyncRefresh';
import { invoiceService } from '../services/invoiceService';
import { Invoice, invoiceStatusLabels } from '../types/invoice';

export default function CaisseScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [manualCode, setManualCode] = useState('');
  const [scanned, setScanned] = useState(false);
  const [lastPaid, setLastPaid] = useState<string | null>(null);

  const loadPending = useCallback(() => {
    setPendingInvoices(invoiceService.getPendingInvoices());
  }, []);

  useSyncRefresh(loadPending);

  useDatabaseReady(loadPending, [loadPending]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    waitForDB().then(() => {
      if (cancelled) return;
      interval = setInterval(loadPending, 8000);
    });
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [loadPending]);

  const confirmPayment = (invoice: Invoice, source: string) => {
    Alert.alert(
      'Encaisser',
      `Marquer ${invoice.invoice_number} (Table ${invoice.table_number}) comme payée ?\n\nTotal : ${invoice.total.toFixed(2)} €`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer le paiement',
          onPress: () => {
            try {
              invoiceService.markInvoiceAsPaid(invoice.id);
              setLastPaid(invoice.invoice_number);
              setScanned(false);
              setManualCode('');
              loadPending();
              Alert.alert('Paiement enregistré', `${invoice.invoice_number} — Table ${invoice.table_number}`);
            } catch (error) {
              Alert.alert('Erreur', error instanceof Error ? error.message : 'Erreur inconnue');
            }
          },
        },
      ]
    );
  };

  const handleScan = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    try {
      const invoice = invoiceService.resolveInvoiceFromScan(data);
      if (!invoice) {
        Alert.alert('QR non reconnu', 'Ce code ne correspond à aucune facture Ceeza.');
        setTimeout(() => setScanned(false), 2000);
        return;
      }
      if (invoice.status === 'PAID') {
        Alert.alert('Déjà payée', `La facture ${invoice.invoice_number} est déjà réglée.`);
        setTimeout(() => setScanned(false), 2000);
        return;
      }
      confirmPayment(invoice, 'scan');
      setTimeout(() => setScanned(false), 3000);
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Erreur');
      setScanned(false);
    }
  };

  const handleManualSearch = () => {
    if (!manualCode.trim()) {
      Alert.alert('Saisie requise', 'Entrez le numéro de facture ou scannez le QR.');
      return;
    }
    const invoice = invoiceService.resolveInvoiceFromScan(manualCode);
    if (!invoice) {
      Alert.alert('Facture introuvable', 'Vérifiez le numéro ou le QR code.');
      return;
    }
    if (invoice.status === 'PAID') {
      Alert.alert('Déjà payée', `La facture ${invoice.invoice_number} est déjà réglée.`);
      return;
    }
    confirmPayment(invoice, 'manual');
  };

  const renderPending = ({ item }: { item: Invoice }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.invoiceNum}>{item.invoice_number}</Text>
        <Text style={styles.pendingBadge}>{invoiceStatusLabels.PENDING}</Text>
      </View>
      <Text style={styles.tableText}>Table {item.table_number}</Text>
      <Text style={styles.totalText}>{item.total.toFixed(2)} €</Text>
      <TouchableOpacity style={styles.payButton} onPress={() => confirmPayment(item, 'list')}>
        <Text style={styles.payButtonText}>💳 Marquer comme payée</Text>
      </TouchableOpacity>
    </View>
  );

  const showScanner = Platform.OS !== 'web' && permission?.granted;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>💳 Caisse</Text>
        <Text style={styles.subtitle}>
          {pendingInvoices.length} facture{pendingInvoices.length !== 1 ? 's' : ''} en attente
        </Text>
        {lastPaid ? (
          <Text style={styles.lastPaid}>Dernier encaissement : {lastPaid}</Text>
        ) : null}
      </View>

      {Platform.OS !== 'web' && !permission?.granted ? (
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>📷 Autoriser la caméra pour scanner</Text>
        </TouchableOpacity>
      ) : null}

      {showScanner ? (
        <View style={styles.scannerBox}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanned ? undefined : handleScan}
          />
          <Text style={styles.scanHint}>Scannez le QR code sur la facture client</Text>
        </View>
      ) : (
        <View style={styles.webManualBox}>
          <Text style={styles.webHint}>
            {Platform.OS === 'web'
              ? 'Sur le web : saisissez le numéro de facture ci-dessous'
              : 'Caméra indisponible — saisissez le numéro de facture'}
          </Text>
        </View>
      )}

      <View style={styles.manualRow}>
        <TextInput
          style={styles.manualInput}
          placeholder="N° facture (ex. FAC-20260524-001)"
          value={manualCode}
          onChangeText={setManualCode}
          autoCapitalize="characters"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleManualSearch}>
          <Text style={styles.searchBtnText}>Encaisser</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.listTitle}>Factures en attente</Text>
      {pendingInvoices.length === 0 ? (
        <Text style={styles.empty}>Aucune facture en attente de paiement.</Text>
      ) : (
        <FlatList
          data={pendingInvoices}
          renderItem={renderPending}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  lastPaid: { fontSize: 12, color: '#4CAF50', marginTop: 6, fontWeight: '600' },
  permissionBtn: {
    margin: 16,
    padding: 14,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    alignItems: 'center',
  },
  permissionBtnText: { color: '#fff', fontWeight: '600' },
  scannerBox: { height: 200, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  camera: { flex: 1 },
  scanHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    padding: 8,
    backgroundColor: '#fff',
  },
  webManualBox: {
    margin: 16,
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  webHint: { fontSize: 13, color: '#1565C0', textAlign: 'center' },
  manualRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  manualInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
  },
  searchBtnText: { color: '#fff', fontWeight: 'bold' },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingTop: 12,
    color: '#333',
  },
  list: { padding: 16, paddingBottom: 32 },
  empty: { textAlign: 'center', color: '#999', padding: 24, fontSize: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceNum: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  pendingBadge: {
    fontSize: 11,
    color: '#FF9800',
    fontWeight: '600',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tableText: { fontSize: 14, color: '#666', marginTop: 6 },
  totalText: { fontSize: 20, fontWeight: 'bold', color: '#4CAF50', marginVertical: 8 },
  payButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
