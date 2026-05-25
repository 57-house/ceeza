import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DEFAULT_TVA_RATE, RESTAURANT_INFO } from '../config/restaurant';
import { waitForDB } from '../db/database';
import { useDatabaseReady } from '../hooks/useDatabaseReady';
import { useSyncRefresh } from '../hooks/useSyncRefresh';
import { invoiceService } from '../services/invoiceService';
import { Invoice, invoiceStatusLabels } from '../types/invoice';
import { Order, orderStatusLabels } from '../types/order';
import { computeInvoiceAmounts } from '../utils/invoiceHtml';

export default function InvoiceScreen() {
  const [billableOrders, setBillableOrders] = useState<Order[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [historyInvoices, setHistoryInvoices] = useState<Invoice[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(() => {
    setBillableOrders(invoiceService.getBillableOrders());
    setPendingInvoices(invoiceService.getPendingInvoices());
    setHistoryInvoices(invoiceService.getPaidInvoices());
  }, []);

  useSyncRefresh(loadData);

  useDatabaseReady(loadData, [loadData]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    waitForDB().then(() => {
      if (cancelled) return;
      interval = setInterval(loadData, 8000);
    });
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [loadData]);

  const openPreview = (order: Order) => {
    setSelectedOrder(order);
    setPreviewVisible(true);
  };

  const handleGenerateInvoice = async () => {
    if (!selectedOrder) return;

    Alert.alert(
      'Générer la facture',
      `Créer la facture pour la table ${selectedOrder.table_number} (${selectedOrder.total.toFixed(2)} € TTC) ?\n\nUn QR code sera imprimé pour le paiement en caisse.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Générer',
          onPress: async () => {
            setLoading(true);
            try {
              await invoiceService.createAndPrintInvoice(selectedOrder.id);
              setPreviewVisible(false);
              setSelectedOrder(null);
              loadData();
              Alert.alert(
                'Facture créée',
                'Facture générée avec QR code. Encaissez en caisse (scan ou manuel).'
              );
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Erreur inconnue';
              Alert.alert('Erreur', msg);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleMarkPaid = (invoice: Invoice) => {
    Alert.alert(
      'Marquer comme payée',
      `${invoice.invoice_number} — Table ${invoice.table_number}\n${invoice.total.toFixed(2)} €`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => {
            try {
              invoiceService.markInvoiceAsPaid(invoice.id);
              loadData();
              Alert.alert('Succès', 'Facture marquée comme payée.');
            } catch (error) {
              Alert.alert('Erreur', error instanceof Error ? error.message : 'Erreur');
            }
          },
        },
      ]
    );
  };

  const handleReprint = async (invoice: Invoice) => {
    setLoading(true);
    try {
      await invoiceService.printInvoice(invoice);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'imprimer la facture');
    } finally {
      setLoading(false);
    }
  };

  const renderBillableOrder = ({ item }: { item: Order }) => {
    const amounts = computeInvoiceAmounts(item.total, DEFAULT_TVA_RATE);
    return (
      <TouchableOpacity style={styles.card} onPress={() => openPreview(item)}>
        <View style={styles.cardRow}>
          <Text style={styles.tableNum}>Table {item.table_number}</Text>
          <Text style={styles.statusBadge}>{orderStatusLabels[item.status]}</Text>
        </View>
        <Text style={styles.cardTotal}>{item.total.toFixed(2)} € TTC</Text>
        <Text style={styles.cardHint}>
          HT {amounts.subtotal.toFixed(2)} € · TVA {amounts.tax_amount.toFixed(2)} €
        </Text>
        <Text style={styles.cardAction}>Générer la facture avec QR →</Text>
      </TouchableOpacity>
    );
  };

  const renderPendingInvoice = ({ item }: { item: Invoice }) => (
    <View style={[styles.card, styles.pendingCard]}>
      <View style={styles.cardRow}>
        <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
        <Text style={styles.pendingLabel}>{invoiceStatusLabels.PENDING}</Text>
      </View>
      <Text style={styles.cardMeta}>Table {item.table_number}</Text>
      <Text style={styles.cardTotal}>{item.total.toFixed(2)} €</Text>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.payBtn} onPress={() => handleMarkPaid(item)}>
          <Text style={styles.payBtnText}>✓ Marquer payée</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.reprintBtn} onPress={() => handleReprint(item)} disabled={loading}>
          <Text style={styles.reprintBtnText}>🖨️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHistoryInvoice = ({ item }: { item: Invoice }) => (
    <View style={[styles.card, styles.paidCard]}>
      <View style={styles.cardRow}>
        <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
        <Text style={styles.paidLabel}>{invoiceStatusLabels.PAID}</Text>
      </View>
      <Text style={styles.cardMeta}>
        Table {item.table_number} ·{' '}
        {item.paid_at
          ? new Date(item.paid_at).toLocaleString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—'}
      </Text>
      <Text style={styles.cardTotal}>{item.total.toFixed(2)} €</Text>
      <TouchableOpacity style={styles.reprintFullBtn} onPress={() => handleReprint(item)} disabled={loading}>
        <Text style={styles.reprintFullBtnText}>🖨️ Réimprimer</Text>
      </TouchableOpacity>
    </View>
  );

  const previewAmounts = selectedOrder
    ? computeInvoiceAmounts(selectedOrder.total, DEFAULT_TVA_RATE)
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧾 Factures</Text>
        <Text style={styles.subtitle}>{RESTAURANT_INFO.name}</Text>
      </View>

      <ScrollView style={styles.scroll}>
        <Text style={styles.sectionTitle}>Nouvelles commandes ({billableOrders.length})</Text>
        {billableOrders.length === 0 ? (
          <Text style={styles.emptyText}>Aucune commande à facturer.</Text>
        ) : (
          <FlatList
            data={billableOrders}
            renderItem={renderBillableOrder}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        )}

        <Text style={[styles.sectionTitle, styles.sectionMargin]}>
          En attente de paiement ({pendingInvoices.length})
        </Text>
        {pendingInvoices.length === 0 ? (
          <Text style={styles.emptyText}>Aucune facture en attente.</Text>
        ) : (
          <FlatList
            data={pendingInvoices}
            renderItem={renderPendingInvoice}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        )}

        <Text style={[styles.sectionTitle, styles.sectionMargin]}>
          Historique — payées ({historyInvoices.length})
        </Text>
        {historyInvoices.length === 0 ? (
          <Text style={styles.emptyText}>Aucune facture payée pour le moment.</Text>
        ) : (
          <FlatList
            data={historyInvoices}
            renderItem={renderHistoryInvoice}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        )}
      </ScrollView>

      <Modal visible={previewVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedOrder && previewAmounts && (
              <>
                <Text style={styles.modalTitle}>Aperçu facture</Text>
                <Text style={styles.modalTable}>Table {selectedOrder.table_number}</Text>
                <Text style={styles.qrInfo}>Un QR code sera ajouté pour le paiement en caisse.</Text>

                <ScrollView style={styles.previewList}>
                  {selectedOrder.items.map((item) => (
                    <View key={item.id}>
                      <View style={styles.previewLine}>
                        <Text style={styles.previewName}>
                          {item.quantity}× {item.menu_item_name}
                        </Text>
                        <Text style={styles.previewPrice}>
                          {(item.price * item.quantity).toFixed(2)} €
                        </Text>
                      </View>
                      {(item.supplements || []).map((sup) => (
                        <View key={sup.id} style={styles.previewSubLine}>
                          <Text style={styles.previewSubName}>+ {sup.menu_item_name}</Text>
                          <Text style={styles.previewPrice}>
                            {(sup.price * sup.quantity).toFixed(2)} €
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.previewTotals}>
                  <View style={styles.previewRow}>
                    <Text>Total TTC</Text>
                    <Text style={styles.previewTotalValue}>
                      {previewAmounts.total.toFixed(2)} €
                    </Text>
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn]}
                    onPress={() => {
                      setPreviewVisible(false);
                      setSelectedOrder(null);
                    }}
                  >
                    <Text style={styles.cancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.generateBtn]}
                    onPress={handleGenerateInvoice}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.generateBtnText}>Générer + QR</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  scroll: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  sectionMargin: { marginTop: 24 },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  pendingCard: { borderLeftColor: '#FF9800' },
  paidCard: { borderLeftColor: '#4CAF50' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tableNum: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statusBadge: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '600',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pendingLabel: {
    fontSize: 11,
    color: '#FF9800',
    fontWeight: '600',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  paidLabel: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardTotal: { fontSize: 20, fontWeight: 'bold', color: '#4CAF50', marginTop: 8 },
  cardHint: { fontSize: 12, color: '#888', marginTop: 4 },
  cardAction: { fontSize: 12, color: '#2196F3', marginTop: 8 },
  cardMeta: { fontSize: 14, color: '#666', marginTop: 4 },
  invoiceNumber: { fontSize: 15, fontWeight: '600', color: '#333' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  payBtn: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  payBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  reprintBtn: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 8,
  },
  reprintBtnText: { fontSize: 18 },
  reprintFullBtn: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  reprintFullBtnText: { fontSize: 13, color: '#333' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  modalTable: { fontSize: 16, color: '#666', marginBottom: 8 },
  qrInfo: { fontSize: 13, color: '#2196F3', marginBottom: 12 },
  previewList: { maxHeight: 200, marginBottom: 12 },
  previewLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  previewSubLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingLeft: 12,
  },
  previewName: { flex: 1, fontSize: 15, color: '#333' },
  previewSubName: { flex: 1, fontSize: 13, color: '#666' },
  previewPrice: { fontSize: 14, fontWeight: '600', color: '#4CAF50' },
  previewTotals: { borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 12 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewTotalValue: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#f5f5f5' },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  generateBtn: { backgroundColor: '#4CAF50' },
  generateBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
