import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { invoiceService, TableBillGroup } from '../services/invoiceService';
import { Invoice, invoiceStatusLabels } from '../types/invoice';
import { Order, orderStatusLabels } from '../types/order';
import { OrderTakenLines } from '../components/OrderTakenLines';
import { computeInvoiceAmounts } from '../utils/invoiceHtml';
import { formatOrderDateTime } from '../utils/orderDate';

type InvoiceView = 'billable' | 'pending' | 'paid';

const INVOICE_TABS: { id: InvoiceView; label: string }[] = [
  { id: 'billable', label: 'À facturer' },
  { id: 'pending', label: 'En attente' },
  { id: 'paid', label: 'Payées' },
];

export default function InvoiceScreen() {
  const [billableTables, setBillableTables] = useState<TableBillGroup[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [historyInvoices, setHistoryInvoices] = useState<Invoice[]>([]);
  const [selectedTableBill, setSelectedTableBill] = useState<TableBillGroup | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [previewVisible, setPreviewVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invoiceView, setInvoiceView] = useState<InvoiceView>('billable');

  const selectedOrders = useMemo(() => {
    if (!selectedTableBill) return [];
    return selectedTableBill.orders.filter((o) => selectedOrderIds.has(o.id));
  }, [selectedTableBill, selectedOrderIds]);

  const selectedTotal = useMemo(
    () => selectedOrders.reduce((sum, o) => sum + o.total, 0),
    [selectedOrders]
  );

  const loadData = useCallback(() => {
    setBillableTables(invoiceService.getBillableTableGroups());
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

  const openTablePreview = (group: TableBillGroup) => {
    setSelectedTableBill(group);
    setSelectedOrderIds(new Set());
    setPreviewVisible(true);
  };

  const closePreview = () => {
    setPreviewVisible(false);
    setSelectedTableBill(null);
    setSelectedOrderIds(new Set());
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const allOrdersSelected = useMemo(() => {
    if (!selectedTableBill || selectedTableBill.orders.length === 0) return false;
    return selectedTableBill.orders.every((o) => selectedOrderIds.has(o.id));
  }, [selectedTableBill, selectedOrderIds]);

  const toggleSelectAllOrders = () => {
    if (!selectedTableBill) return;
    if (allOrdersSelected) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(selectedTableBill.orders.map((o) => o.id)));
    }
  };

  const handleGenerateInvoice = async () => {
    if (!selectedTableBill || selectedOrders.length === 0) return;

    const { tableId, tableNumber } = selectedTableBill;
    const orderLabel =
      selectedOrders.length > 1
        ? `${selectedOrders.length} commandes regroupées`
        : '1 commande';

    Alert.alert(
      'Générer la facture',
      `Créer la facture pour la table ${tableNumber} (${selectedTotal.toFixed(2)} € TTC) ?\n${orderLabel}\n\nUn QR code sera imprimé pour le paiement en caisse.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Générer',
          onPress: async () => {
            setLoading(true);
            try {
              await invoiceService.createAndPrintTableInvoice(
                tableId,
                tableNumber,
                selectedOrders.map((o) => o.id)
              );
              closePreview();
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

  const handleCancelInvoice = (invoice: Invoice) => {
    const orderCount = invoiceService.getOrdersForInvoice(invoice).length;
    const orderLabel =
      orderCount > 1
        ? `Les ${orderCount} commandes repasseront dans « À facturer ».`
        : 'La commande repassera dans « À facturer ».';

    Alert.alert(
      'Annuler la facture',
      `${invoice.invoice_number} — Table ${invoice.table_number}\n${orderLabel}`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Annuler la facture',
          style: 'destructive',
          onPress: () => {
            try {
              invoiceService.cancelPendingInvoice(invoice.id);
              loadData();
              Alert.alert('Facture annulée', 'Les commandes sont à nouveau à facturer.');
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

  const renderBillableTable = ({ item }: { item: TableBillGroup }) => {
    const amounts = computeInvoiceAmounts(item.total, DEFAULT_TVA_RATE);
    return (
      <TouchableOpacity style={styles.card} onPress={() => openTablePreview(item)}>
        <View style={styles.cardRow}>
          <Text style={styles.tableNum}>Table {item.tableNumber}</Text>
          <Text style={styles.statusBadge}>
            {item.orders.length} commande{item.orders.length > 1 ? 's' : ''}
          </Text>
        </View>
        <Text style={styles.cardTotal}>{item.total.toFixed(2)} € TTC</Text>
        <Text style={styles.cardHint}>
          HT {amounts.subtotal.toFixed(2)} € · TVA {amounts.tax_amount.toFixed(2)} €
        </Text>
        {item.orders.map((order) => (
          <View key={order.id} style={styles.orderBlock}>
            <Text style={styles.orderBlockHeader}>
              {orderStatusLabels[order.status]} · {formatOrderDateTime(order.created_at)} ·{' '}
              {order.total.toFixed(2)} €
            </Text>
            <OrderTakenLines
              items={order.items}
              lineStyle={styles.orderTakenLine}
              supplementStyle={styles.orderTakenSupplement}
            />
          </View>
        ))}
        <Text style={styles.cardAction}>Générer la facture table avec QR →</Text>
      </TouchableOpacity>
    );
  };

  const renderInvoiceOrderDetails = (invoice: Invoice) => {
    const orders = invoiceService.getOrdersForInvoice(invoice);
    if (orders.length === 0) {
      return <Text style={styles.emptyItemsText}>Détail des articles indisponible</Text>;
    }
    return orders.map((order, index) => (
      <View key={order.id} style={styles.orderBlock}>
        <Text style={styles.orderBlockHeader}>
          {orders.length > 1 ? `Commande ${index + 1} · ` : ''}
          {formatOrderDateTime(order.created_at)} · {order.total.toFixed(2)} €
        </Text>
        <OrderTakenLines
          items={order.items}
          lineStyle={styles.orderTakenLine}
          supplementStyle={styles.orderTakenSupplement}
        />
      </View>
    ));
  };

  const renderPendingInvoice = ({ item }: { item: Invoice }) => (
    <View style={[styles.card, styles.pendingCard]}>
      <View style={styles.cardRow}>
        <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
        <Text style={styles.pendingLabel}>{invoiceStatusLabels.PENDING}</Text>
      </View>
      <Text style={styles.cardMeta}>
        Table {item.table_number} · {formatOrderDateTime(item.created_at)}
      </Text>
      {renderInvoiceOrderDetails(item)}
      <Text style={styles.cardTotal}>{item.total.toFixed(2)} € TTC</Text>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.payBtn} onPress={() => handleMarkPaid(item)}>
          <Text style={styles.payBtnText}>✓ Marquer payée</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.reprintBtn} onPress={() => handleReprint(item)} disabled={loading}>
          <Text style={styles.reprintBtnText}>🖨️</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.cancelInvoiceBtn}
        onPress={() => handleCancelInvoice(item)}
        disabled={loading}
      >
        <Text style={styles.cancelInvoiceBtnText}>↩ Annuler — renvoyer en commande</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHistoryInvoice = ({ item }: { item: Invoice }) => (
    <View style={[styles.card, styles.paidCard]}>
      <View style={styles.cardRow}>
        <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
        <Text style={styles.paidLabel}>{invoiceStatusLabels.PAID}</Text>
      </View>
      <Text style={styles.cardMeta}>
        Table {item.table_number} · Créée le {formatOrderDateTime(item.created_at)}
      </Text>
      <Text style={styles.cardMeta}>
        Payée le {item.paid_at ? formatOrderDateTime(item.paid_at) : '—'}
      </Text>
      {renderInvoiceOrderDetails(item)}
      <Text style={styles.cardTotal}>{item.total.toFixed(2)} € TTC</Text>
      <TouchableOpacity style={styles.reprintFullBtn} onPress={() => handleReprint(item)} disabled={loading}>
        <Text style={styles.reprintFullBtnText}>🖨️ Réimprimer</Text>
      </TouchableOpacity>
    </View>
  );

  const tabCounts: Record<InvoiceView, number> = {
    billable: billableTables.length,
    pending: pendingInvoices.length,
    paid: historyInvoices.length,
  };

  const emptyMessages: Record<InvoiceView, string> = {
    billable: 'Aucune table à facturer.',
    pending: 'Aucune facture en attente.',
    paid: 'Aucune facture payée pour le moment.',
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧾 Factures</Text>
        <Text style={styles.subtitle}>{RESTAURANT_INFO.name}</Text>
      </View>

      <View style={styles.invoiceTabBar}>
        {INVOICE_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.invoiceTab, invoiceView === tab.id && styles.invoiceTabActive]}
            onPress={() => setInvoiceView(tab.id)}
          >
            <Text
              style={[
                styles.invoiceTabText,
                invoiceView === tab.id && styles.invoiceTabTextActive,
              ]}
            >
              {tab.label} ({tabCounts[tab.id]})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.panel}>
        {invoiceView === 'billable' && (
          billableTables.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{emptyMessages.billable}</Text>
            </View>
          ) : (
            <FlatList
              data={billableTables}
              renderItem={renderBillableTable}
              keyExtractor={(item) => String(item.tableNumber)}
              contentContainerStyle={styles.listContent}
            />
          )
        )}

        {invoiceView === 'pending' && (
          pendingInvoices.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{emptyMessages.pending}</Text>
            </View>
          ) : (
            <FlatList
              data={pendingInvoices}
              renderItem={renderPendingInvoice}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
            />
          )
        )}

        {invoiceView === 'paid' && (
          historyInvoices.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{emptyMessages.paid}</Text>
            </View>
          ) : (
            <FlatList
              data={historyInvoices}
              renderItem={renderHistoryInvoice}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
            />
          )
        )}
      </View>

      <Modal visible={previewVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTableBill && (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.modalTitle}>Aperçu facture</Text>
                <Text style={styles.modalTable}>Table {selectedTableBill.tableNumber}</Text>
                <Text style={styles.qrInfo}>
                  Cochez les commandes à inclure sur la même facture.
                </Text>

                <View style={styles.selectAllRow}>
                  <TouchableOpacity onPress={toggleSelectAllOrders}>
                    <Text style={styles.selectAllText}>
                      {allOrdersSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.selectedCount}>
                    {selectedOrders.length}/{selectedTableBill.orders.length} sélectionnée
                    {selectedOrders.length > 1 ? 's' : ''}
                  </Text>
                </View>

                <View style={styles.orderPickList}>
                  {selectedTableBill.orders.map((order, index) => {
                    const checked = selectedOrderIds.has(order.id);
                    return (
                      <TouchableOpacity
                        key={order.id}
                        style={[styles.orderPickRow, checked && styles.orderPickRowSelected]}
                        onPress={() => toggleOrderSelection(order.id)}
                      >
                        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                          {checked && <Text style={styles.checkboxMark}>✓</Text>}
                        </View>
                        <View style={styles.orderPickInfo}>
                          <View style={styles.orderPickHeader}>
                            <Text style={styles.orderPickTitle}>
                              Commande {index + 1} · {orderStatusLabels[order.status]}
                            </Text>
                            <Text style={styles.orderPickTotal}>{order.total.toFixed(2)} €</Text>
                          </View>
                          <Text style={styles.orderPickMeta}>
                            {formatOrderDateTime(order.created_at)}
                          </Text>
                          <OrderTakenLines
                            items={order.items}
                            style={styles.orderTakenInPick}
                            lineStyle={styles.orderTakenLine}
                            supplementStyle={styles.orderTakenSupplement}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.previewTotals}>
                  <View style={styles.previewRow}>
                    <Text>Total TTC</Text>
                    <Text style={styles.previewTotalValue}>
                      {selectedTotal.toFixed(2)} €
                    </Text>
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn]}
                    onPress={closePreview}
                  >
                    <Text style={styles.cancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalBtn,
                      styles.generateBtn,
                      selectedOrders.length === 0 && styles.generateBtnDisabled,
                    ]}
                    onPress={handleGenerateInvoice}
                    disabled={loading || selectedOrders.length === 0}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.generateBtnText}>Générer + QR</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
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
  invoiceTabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 16,
  },
  invoiceTab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    paddingHorizontal: 4,
  },
  invoiceTabActive: {
    borderBottomColor: '#2196F3',
  },
  invoiceTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
  },
  invoiceTabTextActive: {
    color: '#2196F3',
    fontWeight: '700',
  },
  panel: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center' },
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
  emptyItemsText: { fontSize: 12, color: '#999', fontStyle: 'italic', marginTop: 8 },
  cardTotal: { fontSize: 20, fontWeight: 'bold', color: '#4CAF50', marginTop: 8 },
  cardHint: { fontSize: 12, color: '#888', marginTop: 4 },
  orderBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  orderBlockHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  orderTakenLine: { fontSize: 12, color: '#555' },
  orderTakenSupplement: { fontSize: 11, color: '#888' },
  orderTakenInPick: { marginTop: 4 },
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
  cancelInvoiceBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  cancelInvoiceBtnText: { color: '#C62828', fontWeight: '600', fontSize: 13 },
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
    paddingHorizontal: 24,
    paddingTop: 24,
    maxHeight: '90%',
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    paddingBottom: 48,
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  modalTable: { fontSize: 16, color: '#666', marginBottom: 8 },
  qrInfo: { fontSize: 13, color: '#2196F3', marginBottom: 12 },
  selectAllRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectAllText: { fontSize: 13, color: '#2196F3', fontWeight: '600' },
  selectedCount: { fontSize: 12, color: '#888' },
  orderPickList: { marginBottom: 12 },
  orderPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  orderPickRowSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8E9',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#bbb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  checkboxMark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  orderPickInfo: { flex: 1 },
  orderPickHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  orderPickTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#333' },
  orderPickMeta: { fontSize: 12, color: '#888', marginTop: 2, marginBottom: 4 },
  orderPickTotal: { fontSize: 14, fontWeight: '700', color: '#4CAF50' },
  previewTotals: { borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 12, marginTop: 8 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewTotalValue: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#f5f5f5' },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  generateBtn: { backgroundColor: '#4CAF50' },
  generateBtnDisabled: { backgroundColor: '#c8e6c9', opacity: 0.7 },
  generateBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
