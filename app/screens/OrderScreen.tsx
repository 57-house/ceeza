import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { DEFAULT_TVA_RATE } from '../config/restaurant';
import { menuService } from '../services/menuService';
import { invoiceService } from '../services/invoiceService';
import { orderService } from '../services/orderService';
import { useDatabaseReady } from '../hooks/useDatabaseReady';
import { useSyncRefresh } from '../hooks/useSyncRefresh';
import { broadcastOrderToKitchen, subscribeSync } from '../services/syncService';
import { playOrderReadySound } from '../services/soundService';
import { tableService } from '../services/tableService';
import { MenuCategory, MenuItem, categoryLabels } from '../types/menu';
import { Order, OrderItem, OrderStatus, orderStatusLabels } from '../types/order';
import { Table, TableStatus } from '../types/table';
import { OrderTakenLines } from '../components/OrderTakenLines';
import { computeInvoiceAmounts } from '../utils/invoiceHtml';
import { formatOrderDateTime, formatOrderTime } from '../utils/orderDate';

type TableView = 'menu' | 'order' | 'history';
type PickView = 'tables' | 'orders_by_day';

function formatOrderDateShort(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('fr-FR');
}

function formatOrderDateLong(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}


function matchDateSearch(timestamp: number, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const short = formatOrderDateShort(timestamp).toLowerCase();
  const long = formatOrderDateLong(timestamp).toLowerCase();
  return short.includes(q) || long.includes(q);
}

function groupOrdersByDate(orders: Order[]): { title: string; data: Order[] }[] {
  const map = new Map<number, Order[]>();

  for (const order of orders) {
    const day = new Date(order.created_at);
    day.setHours(0, 0, 0, 0);
    const key = day.getTime();
    const list = map.get(key) ?? [];
    list.push(order);
    map.set(key, list);
  }

  return Array.from(map.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([key, data]) => ({
      title: formatOrderDateLong(key),
      data: data.sort((a, b) => b.created_at - a.created_at),
    }));
}

function getStatusStyle(status: OrderStatus) {
  switch (status) {
    case 'OPEN':
      return styles.statusOpen;
    case 'PREPARING':
      return styles.statusPreparing;
    case 'READY':
      return styles.statusReady;
    case 'SERVED':
      return styles.statusServed;
    case 'PAID':
      return styles.statusPaid;
    case 'CANCELLED':
      return styles.statusCancelled;
    default:
      return styles.statusOpen;
  }
}

export default function OrderScreen() {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null);
  const [selectedTableCapacity, setSelectedTableCapacity] = useState<number | null>(null);
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [showDrinkModal, setShowDrinkModal] = useState(false);
  const [lastAddedPlat, setLastAddedPlat] = useState<MenuItem | null>(null);
  const [selectedSupplements, setSelectedSupplements] = useState<MenuItem[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [pickView, setPickView] = useState<PickView>('tables');
  const [tableView, setTableView] = useState<TableView>('menu');
  const [tableHistory, setTableHistory] = useState<Order[]>([]);
  const [kitchenOrders, setKitchenOrders] = useState<Order[]>([]);
  const [historyDateSearch, setHistoryDateSearch] = useState('');
  const [billableTableOrders, setBillableTableOrders] = useState<Order[]>([]);
  const [selectedInvoiceOrderIds, setSelectedInvoiceOrderIds] = useState<Set<string>>(new Set());
  const [invoicePreviewVisible, setInvoicePreviewVisible] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const loadCompletedOrders = () => {
    try {
      const merged = orderService
        .getOrdersByStatus('READY')
        .filter((o) => !invoiceService.hasInvoice(o.id))
        .sort((a, b) => b.created_at - a.created_at);
      setCompletedOrders(merged);
    } catch (error) {
      console.error('Erreur chargement commandes terminées:', error);
    }
  };

  useDatabaseReady(() => {
    loadTables();
    loadMenuItems();
    loadCompletedOrders();
  });

  useEffect(() => {
    const unsubscribe = subscribeSync((event) => {
      if (event.type === 'ORDER_READY') {
        void playOrderReadySound();
      }
    });
    return unsubscribe;
  }, []);

  const getSelectedTableId = () => {
    if (!selectedTable) return null;
    return tableService.resolveTableId(selectedTable.number, selectedTable.id);
  };

  const loadTableHistory = () => {
    const tableId = getSelectedTableId();
    if (!tableId) return;
    try {
      setTableHistory(orderService.getOrdersByTable(tableId));
    } catch (error) {
      console.error('Erreur chargement historique:', error);
    }
  };

  const loadKitchenOrders = () => {
    const tableId = getSelectedTableId();
    if (!tableId) return;
    try {
      setKitchenOrders(orderService.getKitchenOrdersByTable(tableId));
    } catch (error) {
      console.error('Erreur chargement cuisine table:', error);
    }
  };

  const loadBillableForTable = () => {
    if (!selectedTable) return;
    try {
      setBillableTableOrders(invoiceService.getBillableOrdersForTable(selectedTable.number));
    } catch (error) {
      console.error('Erreur chargement facturable:', error);
    }
  };

  const selectedBillableOrders = useMemo(
    () => billableTableOrders.filter((o) => selectedInvoiceOrderIds.has(o.id)),
    [billableTableOrders, selectedInvoiceOrderIds]
  );

  const billableTableTotal = useMemo(
    () => selectedBillableOrders.reduce((sum, o) => sum + o.total, 0),
    [selectedBillableOrders]
  );

  const openInvoicePreview = () => {
    setSelectedInvoiceOrderIds(new Set());
    setInvoicePreviewVisible(true);
  };

  const toggleInvoiceOrderSelection = (orderId: string) => {
    setSelectedInvoiceOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const allInvoiceOrdersSelected = useMemo(() => {
    if (billableTableOrders.length === 0) return false;
    return billableTableOrders.every((o) => selectedInvoiceOrderIds.has(o.id));
  }, [billableTableOrders, selectedInvoiceOrderIds]);

  const toggleSelectAllInvoiceOrders = () => {
    if (allInvoiceOrdersSelected) {
      setSelectedInvoiceOrderIds(new Set());
    } else {
      setSelectedInvoiceOrderIds(new Set(billableTableOrders.map((o) => o.id)));
    }
  };

  useSyncRefresh(() => {
    loadTables();
    loadMenuItems();
    loadCompletedOrders();
    if (selectedTable) {
      loadOrder();
      loadTableHistory();
      loadKitchenOrders();
      loadBillableForTable();
    }
  });

  useEffect(() => {
    if (selectedTable) {
      loadOrder();
      loadTableHistory();
      loadKitchenOrders();
      loadBillableForTable();
      setTableView('menu');
      setHistoryDateSearch('');
    }
  }, [selectedTable]);

  const handleGenerateTableInvoice = () => {
    const tableId = getSelectedTableId();
    if (!selectedTable || !tableId || selectedBillableOrders.length === 0) return;

    Alert.alert(
      'Générer la facture',
      `Créer la facture pour la table ${selectedTable.number} (${billableTableTotal.toFixed(2)} € TTC) ?\n${selectedBillableOrders.length} commande${selectedBillableOrders.length > 1 ? 's' : ''} sélectionnée${selectedBillableOrders.length > 1 ? 's' : ''}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Générer',
          onPress: async () => {
            setInvoiceLoading(true);
            try {
              await invoiceService.createAndPrintTableInvoice(
                tableId,
                selectedTable.number,
                selectedBillableOrders.map((o) => o.id)
              );
              setInvoicePreviewVisible(false);
              setSelectedInvoiceOrderIds(new Set());
              loadBillableForTable();
              loadTableHistory();
              Alert.alert('Facture créée', 'Facture générée avec QR code pour la caisse.');
            } catch (error) {
              Alert.alert('Erreur', error instanceof Error ? error.message : 'Erreur inconnue');
            } finally {
              setInvoiceLoading(false);
            }
          },
        },
      ]
    );
  };

  const loadTables = () => {
    try {
      const allTables = tableService.getAllTables();
      setTables(allTables);
    } catch (error) {
      console.error('Erreur lors du chargement des tables:', error);
    }
  };

  const loadMenuItems = () => {
    try {
      const items = menuService.getAllMenuItems();
      setMenuItems(items.filter((item) => item.available));
    } catch (error) {
      console.error('Erreur lors du chargement du menu:', error);
    }
  };

  const loadOrder = () => {
    const tableId = getSelectedTableId();
    if (!tableId) return;

    try {
      const currentOrder = orderService.getOpenOrderByTable(tableId);
      setOrder(currentOrder);
    } catch (error) {
      console.error('Erreur lors du chargement de la commande:', error);
      Alert.alert('Erreur', 'Impossible de charger la commande');
    }
  };

  const refreshOrder = (orderId: string) => {
    const updated = orderService.getOrderById(orderId);
    if (updated) {
      setOrder(updated);
    }
  };

  const handleSelectTable = (table: Table) => {
    setSelectedTable(table);
  };

  const handleBackToTables = () => {
    setSelectedTable(null);
    setOrder(null);
    setTableHistory([]);
    setKitchenOrders([]);
    setBillableTableOrders([]);
    setHistoryDateSearch('');
    setTableView('menu');
    setInvoicePreviewVisible(false);
    setSelectedInvoiceOrderIds(new Set());
  };

  const selectableTables = useMemo(
    () => tables.filter((t) => t.status !== 'CLEANING').sort((a, b) => a.number - b.number),
    [tables]
  );

  const tableCapacitiesInUse = useMemo(() => {
    const set = new Set(selectableTables.map((t) => t.capacity));
    return [...set].sort((a, b) => a - b);
  }, [selectableTables]);

  /** Capacité affichée : celle choisie si elle existe encore, sinon la première disponible */
  const activeTableCapacity = useMemo(() => {
    if (tableCapacitiesInUse.length === 0) return null;
    if (selectedTableCapacity !== null && tableCapacitiesInUse.includes(selectedTableCapacity)) {
      return selectedTableCapacity;
    }
    return tableCapacitiesInUse[0];
  }, [tableCapacitiesInUse, selectedTableCapacity]);

  const tablePickSections = useMemo(() => {
    if (activeTableCapacity === null) return [];
    const cap = activeTableCapacity;
    return [
      {
        capacity: cap,
        title: `Tables ${cap} personne${cap > 1 ? 's' : ''}`,
        data: selectableTables
          .filter((t) => t.capacity === cap)
          .sort((a, b) => a.number - b.number),
      },
    ];
  }, [selectableTables, activeTableCapacity]);

  const getTableStatusLabel = (status: TableStatus): string => {
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

  const getTableStatusColor = (status: TableStatus): string => {
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

  /** Commande ouverte en base, ou nouvelle si la précédente est déjà en cuisine */
  const resolveActiveOrder = (): Order | null => {
    if (!selectedTable) return null;

    const tableId = getSelectedTableId()!;
    let openOrder = orderService.getOpenOrderByTable(tableId);

    if (!openOrder) {
      openOrder = orderService.createOrder(tableId, selectedTable.number);
    }

    setOrder(openOrder);
    return openOrder;
  };

  const handleAddItem = (menuItem: MenuItem) => {
    const activeOrder = resolveActiveOrder();
    if (!activeOrder) {
      Alert.alert('Erreur', 'Aucune commande active');
      return;
    }

    try {
      // Si c'est un plat principal, demander les suppléments
      if (menuItem.category === 'PLAT') {
        setLastAddedPlat(menuItem);
        setShowSupplementModal(true);
      } else {
        orderService.addItemToOrder(activeOrder.id, menuItem, 1);
        refreshOrder(activeOrder.id);
        loadTableHistory();
        setTableView('order');
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter l\'élément');
    }
  };

  const handleAddPlatWithSupplements = (supplements: MenuItem[]) => {
    if (!lastAddedPlat) return;

    // Stocker les suppléments et ouvrir le modal de boisson
    setSelectedSupplements(supplements);
    setShowSupplementModal(false);
    setShowDrinkModal(true);
  };

  const handleAddPlatWithSupplementsAndDrinks = (drinks: MenuItem[]) => {
    if (!lastAddedPlat) return;

    const activeOrder = resolveActiveOrder();
    if (!activeOrder) return;

    try {
      // Ajouter le plat principal et récupérer son ID
      const platItemId = orderService.addItemToOrder(activeOrder.id, lastAddedPlat, 1);

      // Ajouter les suppléments associés au plat
      selectedSupplements.forEach((supplement) => {
        orderService.addItemToOrder(activeOrder.id, supplement, 1, platItemId);
      });

      // Ajouter les boissons associées au plat
      drinks.forEach((drink) => {
        orderService.addItemToOrder(activeOrder.id, drink, 1, platItemId);
      });

      const orderId = activeOrder.id;
      refreshOrder(orderId);
      loadTableHistory();
      setTableView('order');
      setShowDrinkModal(false);
      setLastAddedPlat(null);
      setSelectedSupplements([]);

      const updatedOrder = orderService.getOrderById(orderId);
      if (updatedOrder?.status === 'OPEN' && updatedOrder.items.length > 0) {
        promptSendToKitchenAfterPlat(orderId);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter la commande');
    }
  };

  const handleRemoveItem = (itemId: string) => {
    if (!order || order.status !== 'OPEN') return;

    Alert.alert(
      'Confirmer la suppression',
      'Voulez-vous retirer cet élément de la commande ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => {
            try {
              orderService.removeItemFromOrder(order.id, itemId);
              refreshOrder(order.id);
              loadTableHistory();
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert('Erreur', 'Impossible de retirer l\'élément');
            }
          },
        },
      ]
    );
  };

  const sendOrderToKitchen = (orderId: string) => {
    orderService.updateOrderStatus(orderId, 'PREPARING');
    const updated = orderService.getOrderById(orderId);
    if (updated) {
      broadcastOrderToKitchen(updated);
    }
    setOrder(null);
    loadTableHistory();
    loadKitchenOrders();
    loadCompletedOrders();
  };

  const promptSendToKitchenAfterPlat = (orderId: string) => {
    Alert.alert(
      'Envoyer à la cuisine ?',
      'Voulez-vous envoyer cette commande directement en cuisine ?',
      [
        { text: 'Plus tard', style: 'cancel' },
        {
          text: 'Envoyer',
          onPress: () => {
            try {
              sendOrderToKitchen(orderId);
              Alert.alert('Succès', 'Commande envoyée à la cuisine');
            } catch (error) {
              console.error('Erreur lors de l\'envoi:', error);
              Alert.alert('Erreur', 'Impossible d\'envoyer la commande');
            }
          },
        },
      ]
    );
  };

  const handleSendToKitchen = () => {
    if (!order) return;

    Alert.alert(
      'Envoyer à la cuisine',
      'Voulez-vous envoyer cette commande à la cuisine ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer',
          onPress: () => {
            try {
              sendOrderToKitchen(order.id);
              Alert.alert('Succès', 'Commande envoyée à la cuisine');
            } catch (error) {
              console.error('Erreur lors de l\'envoi:', error);
              Alert.alert('Erreur', 'Impossible d\'envoyer la commande');
            }
          },
        },
      ]
    );
  };

  const MENU_CATEGORY_ORDER: MenuCategory[] = ['ENTREE', 'PLAT', 'DESSERT', 'BOISSON', 'SUPPLEMENT', 'AUTRE'];

  /** Catégories affichées : uniquement celles qui contiennent au moins un article disponible */
  const categories = useMemo<MenuCategory[]>(() => {
    const present = new Set(menuItems.map((item) => item.category));
    return MENU_CATEGORY_ORDER.filter((cat) => present.has(cat));
  }, [menuItems]);

  /** Si la catégorie choisie n'a plus d'articles, revenir sur la première disponible */
  const activeCategory = useMemo<MenuCategory | null>(() => {
    if (selectedCategory && categories.includes(selectedCategory)) return selectedCategory;
    return categories[0] ?? null;
  }, [categories, selectedCategory]);

  const filteredMenuItems = activeCategory
    ? menuItems.filter((item) => item.category === activeCategory)
    : [];

  const filteredHistory = useMemo(
    () => tableHistory.filter((o) => matchDateSearch(o.created_at, historyDateSearch)),
    [tableHistory, historyDateSearch]
  );

  const historySections = useMemo(
    () => groupOrdersByDate(filteredHistory),
    [filteredHistory]
  );

  const completedOrdersByDay = useMemo(
    () => groupOrdersByDate(completedOrders),
    [completedOrders]
  );

  const tableActiveOrders = useMemo(() => {
    const byId = new Map<string, Order>();
    const add = (o: Order | null | undefined) => {
      if (!o) return;
      if (o.status === 'PAID' || o.status === 'CANCELLED') return;
      if (invoiceService.hasInvoice(o.id)) return;
      byId.set(o.id, o);
    };
    kitchenOrders.forEach(add);
    add(order);
    tableHistory
      .filter((o) => ['OPEN', 'PREPARING', 'READY'].includes(o.status))
      .forEach(add);
    return Array.from(byId.values());
  }, [kitchenOrders, order, tableHistory]);

  const orderTabSections = useMemo(
    () => groupOrdersByDate(tableActiveOrders),
    [tableActiveOrders]
  );

  const handleMarkServed = (target: Order) => {
    if (target.status !== 'READY') return;
    Alert.alert(
      'Marquer comme servie',
      `Table ${target.table_number} — ${target.total.toFixed(2)} €`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Servie',
          onPress: () => {
            try {
              orderService.updateOrderStatus(target.id, 'SERVED');
              loadCompletedOrders();
              loadTableHistory();
              loadKitchenOrders();
              loadBillableForTable();
              if (order?.id === target.id) {
                refreshOrder(target.id);
              }
            } catch (error) {
              Alert.alert(
                'Erreur',
                error instanceof Error ? error.message : 'Impossible de mettre à jour'
              );
            }
          },
        },
      ]
    );
  };

  const renderHistoryOrder = (item: Order) => (
    <View style={styles.historyOrderCard}>
      <View style={styles.historyOrderHeader}>
        <Text style={styles.historyOrderTime}>{formatOrderTime(item.created_at)}</Text>
        <View style={[styles.statusChip, getStatusStyle(item.status)]}>
          <Text style={styles.statusChipText}>{orderStatusLabels[item.status]}</Text>
        </View>
        <Text style={styles.historyOrderTotal}>{item.total.toFixed(2)} €</Text>
      </View>
      <Text style={styles.historyOrderMeta}>{formatOrderDateTime(item.created_at)}</Text>
      <OrderTakenLines
        items={item.items}
        style={styles.historyOrderItems}
        lineStyle={styles.historyOrderItemLine}
        supplementStyle={styles.historyOrderSupplementLine}
      />
    </View>
  );

  const renderReadyOrderCard = (item: Order, options?: { showTable?: boolean }) => (
    <View style={styles.historyOrderCard}>
      <View style={styles.historyOrderHeader}>
        {options?.showTable !== false && (
          <Text style={styles.readyOrderTable}>Table {item.table_number}</Text>
        )}
        <View style={[styles.statusChip, getStatusStyle(item.status)]}>
          <Text style={styles.statusChipText}>{orderStatusLabels[item.status]}</Text>
        </View>
        <Text style={styles.historyOrderTotal}>{item.total.toFixed(2)} €</Text>
      </View>
      <Text style={styles.historyOrderMeta}>{formatOrderDateTime(item.created_at)}</Text>
      <OrderTakenLines
        items={item.items}
        style={styles.historyOrderItems}
        lineStyle={styles.historyOrderItemLine}
        supplementStyle={styles.historyOrderSupplementLine}
      />
      {item.status === 'READY' && (
        <TouchableOpacity style={styles.servedBtn} onPress={() => handleMarkServed(item)}>
          <Text style={styles.servedBtnText}>✓ Servie</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderTableOrderInDaySection = (item: Order, indexInDay: number) => {
    const isEditableOpen = order?.id === item.id && item.status === 'OPEN' && item.items.length > 0;

    return (
      <View key={item.id} style={styles.kitchenOrderCard}>
        <View style={styles.kitchenOrderHeader}>
          <Text style={styles.kitchenOrderLabel}>
            Commande {indexInDay + 1} · {orderStatusLabels[item.status]}
          </Text>
          <Text style={styles.kitchenOrderTotal}>{item.total.toFixed(2)} €</Text>
        </View>
        <Text style={styles.kitchenOrderMeta}>{formatOrderDateTime(item.created_at)}</Text>
        {isEditableOpen ? (
          item.items.map((line) => (
            <View key={line.id}>{renderOrderItem({ item: line })}</View>
          ))
        ) : (
          <>
            <OrderTakenLines
              items={item.items}
              style={styles.historyOrderItems}
              lineStyle={styles.historyOrderItemLine}
              supplementStyle={styles.historyOrderSupplementLine}
            />
            {item.status === 'READY' && (
              <TouchableOpacity style={styles.servedBtn} onPress={() => handleMarkServed(item)}>
                <Text style={styles.servedBtnText}>✓ Servie</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    );
  };

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <TouchableOpacity
      style={styles.menuItemCard}
      onPress={() => handleAddItem(item)}
    >
      <View style={styles.menuItemInfo}>
        <Text style={styles.menuItemName}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.menuItemDescription}>{item.description}</Text>
        ) : null}
      </View>
      <Text style={styles.menuItemPrice}>{item.price.toFixed(2)} €</Text>
    </TouchableOpacity>
  );

  const renderOrderItemDetails = (item: OrderItem) => {
    const supplements = item.supplements?.filter((sup) => sup.category === 'SUPPLEMENT') || [];
    const drinks = item.supplements?.filter((sup) => sup.category === 'BOISSON') || [];
    const others =
      item.supplements?.filter(
        (sup) => sup.category !== 'SUPPLEMENT' && sup.category !== 'BOISSON'
      ) || [];
    const hasComplements = supplements.length > 0 || drinks.length > 0 || others.length > 0;

    return (
      <View style={styles.orderItemInfo}>
        <Text style={styles.orderItemName}>
          {item.quantity}× {item.menu_item_name}
        </Text>
        {hasComplements && (
          <View style={styles.complementsContainer}>
            {supplements.map((sup) => (
              <Text key={sup.id} style={styles.complementDot}>
                • {sup.menu_item_name}
              </Text>
            ))}
            {drinks.map((drink) => (
              <Text key={drink.id} style={styles.complementDot}>
                • {drink.menu_item_name}
              </Text>
            ))}
            {others.map((other) => (
              <Text key={other.id} style={styles.complementDot}>
                • {other.menu_item_name}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderOrderItem = ({ item }: { item: OrderItem }) => (
    <View style={styles.orderItemCard}>
      <View style={styles.orderItemHeader}>
        {renderOrderItemDetails(item)}
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveItem(item.id)}
        >
          <Text style={styles.removeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.orderItemPrice}>
        {(item.price * item.quantity).toFixed(2)} €
      </Text>
    </View>
  );

  if (!selectedTable) {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>📝 Prise de commande</Text>
              <Text style={styles.subtitle}>
                {pickView === 'tables' ? 'Choisir une table' : 'Commandes classées par jour'}
              </Text>
            </View>
          </View>

          <View style={styles.pickViewBar}>
            <TouchableOpacity
              style={[styles.pickViewTab, pickView === 'tables' && styles.pickViewTabActive]}
              onPress={() => setPickView('tables')}
            >
              <Text
                style={[
                  styles.pickViewTabText,
                  pickView === 'tables' && styles.pickViewTabTextActive,
                ]}
              >
                Tables
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickViewTab, pickView === 'orders_by_day' && styles.pickViewTabActive]}
              onPress={() => setPickView('orders_by_day')}
            >
              <Text
                style={[
                  styles.pickViewTabText,
                  pickView === 'orders_by_day' && styles.pickViewTabTextActive,
                ]}
              >
                Par jour ({completedOrders.length})
              </Text>
            </TouchableOpacity>
          </View>

          {pickView === 'orders_by_day' ? (
            completedOrdersByDay.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Aucune commande prête ou servie</Text>
                <Text style={styles.emptySubtext}>
                  Les commandes terminées en cuisine apparaissent ici, regroupées par date.
                </Text>
              </View>
            ) : (
              <SectionList
                style={styles.tablePickList}
                sections={completedOrdersByDay}
                keyExtractor={(item) => item.id}
                renderSectionHeader={({ section: { title } }) => (
                  <View style={styles.historyDateBlock}>
                    <Text style={styles.historyDateTitle}>{title}</Text>
                  </View>
                )}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      const table = tables.find((t) => t.number === item.table_number);
                      if (table) handleSelectTable(table);
                    }}
                  >
                    {renderReadyOrderCard(item)}
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.historyListContent}
                showsVerticalScrollIndicator
                stickySectionHeadersEnabled
              />
            )
          ) : selectableTables.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Aucune table disponible</Text>
              <Text style={styles.emptySubtext}>
                Créez des tables dans l&apos;onglet Tables pour commencer.
              </Text>
            </View>
          ) : (
            <>
              {tableCapacitiesInUse.length > 1 && (
                <View style={styles.tablePickCapacityBar}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tablePickCapacityContent}
                  >
                    {tableCapacitiesInUse.map((cap) => (
                      <TouchableOpacity
                        key={cap}
                        style={[
                          styles.tablePickCapacityTab,
                          activeTableCapacity === cap && styles.tablePickCapacityTabActive,
                        ]}
                        onPress={() => setSelectedTableCapacity(cap)}
                      >
                        <Text
                          style={[
                            styles.tablePickCapacityTabText,
                            activeTableCapacity === cap && styles.tablePickCapacityTabTextActive,
                          ]}
                        >
                          {cap} pers.
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <SectionList
                style={styles.tablePickList}
                sections={tablePickSections}
                keyExtractor={(item) => item.id}
                renderSectionHeader={({ section: { title } }) => (
                  <View style={styles.tablePickSectionHeader}>
                    <Text style={styles.tablePickSectionTitle}>{title}</Text>
                  </View>
                )}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.tablePickCard}
                    onPress={() => handleSelectTable(item)}
                  >
                    <View style={styles.tablePickCardMain}>
                      <Text style={styles.tablePickNumber}>Table {item.number}</Text>
                      <Text style={styles.tablePickCapacity}>{item.capacity} pers.</Text>
                    </View>
                    <View
                      style={[
                        styles.tablePickStatusBadge,
                        { backgroundColor: getTableStatusColor(item.status) },
                      ]}
                    >
                      <Text style={styles.tablePickStatusText}>
                        {getTableStatusLabel(item.status)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.tablePickListContent}
                showsVerticalScrollIndicator
                stickySectionHeadersEnabled={false}
              />
            </>
          )}
        </View>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackToTables}>
            <Text style={styles.backButtonText}>← Retour aux tables</Text>
          </TouchableOpacity>
          <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>Table {selectedTable.number}</Text>
            {order ? (
              <View style={styles.headerMeta}>
                <View style={[styles.statusChip, getStatusStyle(order.status)]}>
                  <Text style={styles.statusChipText}>{orderStatusLabels[order.status]}</Text>
                </View>
                <Text style={styles.headerDate}>{formatOrderDateTime(order.created_at)}</Text>
              </View>
            ) : kitchenOrders.length > 0 ? (
              <Text style={styles.headerHint}>
                {kitchenOrders.length} commande{kitchenOrders.length > 1 ? 's' : ''} en cuisine
              </Text>
            ) : null}
            <Text style={styles.orderTotal}>
              Total en cours : {order?.total.toFixed(2) || '0.00'} €
            </Text>
          </View>
          <View style={styles.headerActions}>
            {billableTableOrders.length > 0 && (
              <TouchableOpacity
                style={styles.invoiceButton}
                onPress={openInvoicePreview}
              >
                <Text style={styles.invoiceButtonText}>🧾 Facturer</Text>
              </TouchableOpacity>
            )}
          </View>
          </View>
        </View>

        <View style={styles.tableTabBar}>
          <TouchableOpacity
            style={[styles.tableTab, tableView === 'menu' && styles.tableTabActive]}
            onPress={() => setTableView('menu')}
          >
            <Text style={[styles.tableTabText, tableView === 'menu' && styles.tableTabTextActive]}>
              Menu
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tableTab, tableView === 'order' && styles.tableTabActive]}
            onPress={() => setTableView('order')}
          >
            <Text style={[styles.tableTabText, tableView === 'order' && styles.tableTabTextActive]}>
              Commande
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tableTab, tableView === 'history' && styles.tableTabActive]}
            onPress={() => {
              loadTableHistory();
              setTableView('history');
            }}
          >
            <Text style={[styles.tableTabText, tableView === 'history' && styles.tableTabTextActive]}>
              Historique
            </Text>
          </TouchableOpacity>
        </View>

        {tableView === 'menu' && (
          <View style={styles.panel}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryTabs}
              contentContainerStyle={styles.categoryTabsContent}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryTab,
                    activeCategory === cat && styles.categoryTabActive,
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
            <ScrollView style={styles.menuList} showsVerticalScrollIndicator>
              {filteredMenuItems.length === 0 ? (
                <View style={styles.emptyOrder}>
                  <Text style={styles.emptyOrderText}>
                    Aucun article disponible. Ajoutez des plats dans l&apos;onglet Menu.
                  </Text>
                </View>
              ) : (
                filteredMenuItems.map((item) => (
                  <View key={item.id}>{renderMenuItem({ item })}</View>
                ))
              )}
            </ScrollView>
          </View>
        )}

        {tableView === 'order' && (
          <View style={styles.panel}>
            {orderTabSections.length === 0 ? (
              <View style={styles.emptyOrder}>
                <Text style={styles.emptyOrderText}>Aucune commande pour cette table</Text>
                <TouchableOpacity
                  style={styles.goToMenuButton}
                  onPress={() => setTableView('menu')}
                >
                  <Text style={styles.goToMenuButtonText}>Parcourir le menu</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                style={styles.orderList}
                contentContainerStyle={styles.orderListContent}
                showsVerticalScrollIndicator
              >
                {orderTabSections.map((section) => (
                  <View key={section.title}>
                    <View style={styles.historyDateBlock}>
                      <Text style={styles.historyDateTitle}>{section.title}</Text>
                    </View>
                    {section.data.map((tableOrder, index) =>
                      renderTableOrderInDaySection(tableOrder, index)
                    )}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {tableView === 'history' && (
          <View style={styles.panel}>
            <View style={styles.historySearchBar}>
              <TextInput
                style={styles.historySearchInput}
                placeholder="Rechercher par date (ex: 24/05/2026)"
                placeholderTextColor="#999"
                value={historyDateSearch}
                onChangeText={setHistoryDateSearch}
              />
            </View>
            {historySections.length === 0 ? (
              <View style={styles.emptyOrder}>
                <Text style={styles.emptyOrderText}>
                  {historyDateSearch.trim()
                    ? 'Aucune commande pour cette date'
                    : 'Aucun historique pour cette table'}
                </Text>
              </View>
            ) : (
              <SectionList
                sections={historySections}
                keyExtractor={(item) => item.id}
                renderSectionHeader={({ section: { title } }) => (
                  <View style={styles.historyDateBlock}>
                    <Text style={styles.historyDateTitle}>{title}</Text>
                  </View>
                )}
                renderItem={({ item }) => renderHistoryOrder(item)}
                contentContainerStyle={styles.historyListContent}
                showsVerticalScrollIndicator
                stickySectionHeadersEnabled
              />
            )}
          </View>
        )}

        {tableView === 'order' && order?.status === 'OPEN' && order.items.length > 0 && (
          <View style={styles.footer}>
            {order.status === 'OPEN' && (
              <TouchableOpacity
                style={styles.sendToKitchenButton}
                onPress={handleSendToKitchen}
              >
                <Text style={styles.sendToKitchenButtonText}>
                  🍳 Envoyer à la cuisine
                </Text>
              </TouchableOpacity>
            )}
            {order.status === 'PREPARING' && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>⏳ En préparation</Text>
              </View>
            )}
            {order.status === 'READY' && (
              <View style={styles.statusBadgeReady}>
                <Text style={styles.statusBadgeText}>✅ Prête</Text>
              </View>
            )}
          </View>
        )}

        <Modal visible={invoicePreviewVisible} animationType="slide" transparent>
          <View style={styles.invoiceModalOverlay}>
            <View style={styles.invoiceModalContent}>
              {selectedTable && (
                <>
                  <Text style={styles.invoiceModalTitle}>Facture — Table {selectedTable.number}</Text>
                  <Text style={styles.invoiceModalSubtitle}>
                    Cochez les commandes à inclure sur la même facture.
                  </Text>

                  <View style={styles.invoiceSelectAllRow}>
                    <TouchableOpacity onPress={toggleSelectAllInvoiceOrders}>
                      <Text style={styles.invoiceSelectAllText}>
                        {allInvoiceOrdersSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.invoiceSelectedCount}>
                      {selectedBillableOrders.length}/{billableTableOrders.length} sélectionnée
                      {selectedBillableOrders.length > 1 ? 's' : ''}
                    </Text>
                  </View>

                  <ScrollView style={styles.invoiceOrderPickList}>
                    {billableTableOrders.map((order, index) => {
                      const checked = selectedInvoiceOrderIds.has(order.id);
                      return (
                        <TouchableOpacity
                          key={order.id}
                          style={[
                            styles.invoiceOrderPickRow,
                            checked && styles.invoiceOrderPickRowSelected,
                          ]}
                          onPress={() => toggleInvoiceOrderSelection(order.id)}
                        >
                          <View
                            style={[
                              styles.invoiceCheckbox,
                              checked && styles.invoiceCheckboxChecked,
                            ]}
                          >
                            {checked && <Text style={styles.invoiceCheckboxMark}>✓</Text>}
                          </View>
                          <View style={styles.invoiceOrderPickInfo}>
                            <View style={styles.invoiceOrderPickHeader}>
                              <Text style={styles.invoiceOrderPickTitle}>
                                Commande {index + 1} · {orderStatusLabels[order.status]}
                              </Text>
                              <Text style={styles.invoiceOrderPickTotal}>
                                {order.total.toFixed(2)} €
                              </Text>
                            </View>
                            <Text style={styles.invoiceOrderPickMeta}>
                              {formatOrderDateTime(order.created_at)}
                            </Text>
                            <OrderTakenLines
                              items={order.items}
                              style={styles.invoiceOrderTakenLines}
                              lineStyle={styles.invoiceOrderTakenLine}
                              supplementStyle={styles.invoiceOrderTakenSupplement}
                            />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <Text style={styles.invoiceModalHint}>
                    Total TTC : {billableTableTotal.toFixed(2)} € · HT{' '}
                    {computeInvoiceAmounts(billableTableTotal, DEFAULT_TVA_RATE).subtotal.toFixed(2)} € · TVA{' '}
                    {computeInvoiceAmounts(billableTableTotal, DEFAULT_TVA_RATE).tax_amount.toFixed(2)} €
                  </Text>
                  <View style={styles.invoiceModalButtons}>
                    <TouchableOpacity
                      style={[styles.invoiceModalBtn, styles.invoiceCancelBtn]}
                      onPress={() => {
                        setInvoicePreviewVisible(false);
                        setSelectedInvoiceOrderIds(new Set());
                      }}
                    >
                      <Text style={styles.invoiceCancelBtnText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.invoiceModalBtn,
                        styles.invoiceGenerateBtn,
                        selectedBillableOrders.length === 0 && styles.invoiceGenerateBtnDisabled,
                      ]}
                      onPress={handleGenerateTableInvoice}
                      disabled={invoiceLoading || selectedBillableOrders.length === 0}
                    >
                      {invoiceLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.invoiceGenerateBtnText}>Générer + QR</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Modal pour les suppléments */}
        <Modal
          visible={showSupplementModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => handleAddPlatWithSupplements([])}
        >
          <SupplementModal
            onConfirm={handleAddPlatWithSupplements}
            supplements={menuItems.filter((item) => item.category === 'SUPPLEMENT')}
          />
        </Modal>

        {/* Modal pour les boissons */}
        <Modal
          visible={showDrinkModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => handleAddPlatWithSupplementsAndDrinks([])}
        >
          <DrinkModal
            onConfirm={handleAddPlatWithSupplementsAndDrinks}
            drinks={menuItems.filter((item) => item.category === 'BOISSON')}
          />
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

// Composant modal pour les suppléments
function SupplementModal({
  onConfirm,
  supplements,
}: {
  onConfirm: (supplements: MenuItem[]) => void;
  supplements: MenuItem[];
}) {
  const [selectedSupplements, setSelectedSupplements] = useState<Set<string>>(new Set());
  const hasSelection = selectedSupplements.size > 0;

  const toggleSupplement = (supplementId: string) => {
    const newSet = new Set(selectedSupplements);
    if (newSet.has(supplementId)) {
      newSet.delete(supplementId);
    } else {
      newSet.add(supplementId);
    }
    setSelectedSupplements(newSet);
  };

  const handleConfirm = () => {
    if (!hasSelection) return;
    const selected = supplements.filter((sup) => selectedSupplements.has(sup.id));
    onConfirm(selected);
  };

  const handleSkip = () => {
    onConfirm([]);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ajouter des suppléments ?</Text>
            <Text style={styles.modalSubtitle}>
              Sélectionnez les suppléments à ajouter au plat
            </Text>

            <ScrollView style={styles.supplementsList}>
              {supplements.length === 0 ? (
                <Text style={styles.noSupplementsText}>Aucun supplément disponible</Text>
              ) : (
                supplements.map((supplement) => (
                  <TouchableOpacity
                    key={supplement.id}
                    style={[
                      styles.supplementOption,
                      selectedSupplements.has(supplement.id) && styles.supplementOptionSelected,
                    ]}
                    onPress={() => toggleSupplement(supplement.id)}
                  >
                    <Text
                      style={[
                        styles.supplementOptionText,
                        selectedSupplements.has(supplement.id) &&
                          styles.supplementOptionTextSelected,
                      ]}
                    >
                      {supplement.name}
                    </Text>
                    <Text style={styles.supplementPrice}>{supplement.price.toFixed(2)} €</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleSkip}
              >
                <Text style={styles.cancelButtonText}>Passer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  !hasSelection && styles.confirmButtonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={!hasSelection}
              >
                <Text
                  style={[
                    styles.confirmButtonText,
                    !hasSelection && styles.confirmButtonTextDisabled,
                  ]}
                >
                  Ajouter
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}

// Composant modal pour les boissons
function DrinkModal({
  onConfirm,
  drinks,
}: {
  onConfirm: (drinks: MenuItem[]) => void;
  drinks: MenuItem[];
}) {
  const [selectedDrinks, setSelectedDrinks] = useState<Set<string>>(new Set());
  const hasSelection = selectedDrinks.size > 0;

  const toggleDrink = (drinkId: string) => {
    const newSet = new Set(selectedDrinks);
    if (newSet.has(drinkId)) {
      newSet.delete(drinkId);
    } else {
      newSet.add(drinkId);
    }
    setSelectedDrinks(newSet);
  };

  const handleConfirm = () => {
    if (!hasSelection) return;
    const selected = drinks.filter((drink) => selectedDrinks.has(drink.id));
    onConfirm(selected);
  };

  const handleSkip = () => {
    onConfirm([]);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ajouter des boissons ?</Text>
            <Text style={styles.modalSubtitle}>
              Sélectionnez les boissons à ajouter au plat
            </Text>

            <ScrollView style={styles.supplementsList}>
              {drinks.length === 0 ? (
                <Text style={styles.noSupplementsText}>Aucune boisson disponible</Text>
              ) : (
                drinks.map((drink) => (
                  <TouchableOpacity
                    key={drink.id}
                    style={[
                      styles.supplementOption,
                      selectedDrinks.has(drink.id) && styles.supplementOptionSelected,
                    ]}
                    onPress={() => toggleDrink(drink.id)}
                  >
                    <Text
                      style={[
                        styles.supplementOptionText,
                        selectedDrinks.has(drink.id) &&
                          styles.supplementOptionTextSelected,
                      ]}
                    >
                      {drink.name}
                    </Text>
                    <Text style={styles.supplementPrice}>{drink.price.toFixed(2)} €</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleSkip}
              >
                <Text style={styles.cancelButtonText}>Passer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  !hasSelection && styles.confirmButtonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={!hasSelection}
              >
                <Text
                  style={[
                    styles.confirmButtonText,
                    !hasSelection && styles.confirmButtonTextDisabled,
                  ]}
                >
                  Ajouter
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingRight: 12,
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 15,
    color: '#2196F3',
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  orderTotal: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 4,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  invoiceButton: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  invoiceButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  invoiceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  invoiceModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '90%',
  },
  invoiceModalTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  invoiceModalSubtitle: { fontSize: 14, color: '#666', marginTop: 4, marginBottom: 12 },
  invoiceSelectAllRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  invoiceSelectAllText: { fontSize: 13, color: '#9C27B0', fontWeight: '600' },
  invoiceSelectedCount: { fontSize: 12, color: '#888' },
  invoiceOrderPickList: { maxHeight: 300, marginBottom: 12 },
  invoiceOrderPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  invoiceOrderPickRowSelected: {
    borderColor: '#9C27B0',
    backgroundColor: '#F3E5F5',
  },
  invoiceCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#bbb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  invoiceCheckboxChecked: {
    backgroundColor: '#9C27B0',
    borderColor: '#9C27B0',
  },
  invoiceCheckboxMark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  invoiceOrderPickInfo: { flex: 1 },
  invoiceOrderPickHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  invoiceOrderPickTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#333' },
  invoiceOrderPickMeta: { fontSize: 12, color: '#888', marginTop: 2, marginBottom: 6 },
  invoiceOrderPickTotal: { fontSize: 14, fontWeight: '700', color: '#9C27B0' },
  invoiceOrderTakenLines: { marginTop: 2 },
  invoiceOrderTakenLine: { fontSize: 12, color: '#555' },
  invoiceOrderTakenSupplement: { fontSize: 11, color: '#888' },
  invoiceModalHint: { fontSize: 12, color: '#888', marginTop: 8, marginBottom: 8 },
  invoiceModalButtons: { flexDirection: 'row', gap: 12, marginTop: 12 },
  invoiceModalBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  invoiceCancelBtn: { backgroundColor: '#f5f5f5' },
  invoiceCancelBtnText: { color: '#666', fontWeight: '600' },
  invoiceGenerateBtn: { backgroundColor: '#9C27B0' },
  invoiceGenerateBtnDisabled: { backgroundColor: '#e1bee7', opacity: 0.7 },
  invoiceGenerateBtnText: { color: '#fff', fontWeight: 'bold' },
  headerInfo: {
    flex: 1,
    marginRight: 12,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  headerDate: {
    fontSize: 13,
    color: '#666',
  },
  headerHint: {
    fontSize: 13,
    color: '#FF9800',
    fontWeight: '600',
    marginTop: 6,
  },
  kitchenOrdersSection: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#FFF8E1',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
  },
  kitchenSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 10,
  },
  kitchenOrderCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFCC80',
  },
  kitchenOrderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kitchenOrderLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  kitchenOrderTime: {
    fontSize: 13,
    color: '#666',
  },
  kitchenOrderTotal: {
    marginLeft: 'auto',
    fontSize: 14,
    fontWeight: '700',
    color: '#E65100',
  },
  kitchenOrderMeta: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 12,
    color: '#888',
  },
  kitchenOrderItems: {
    borderTopWidth: 1,
    borderTopColor: '#FFE082',
    paddingTop: 10,
    gap: 10,
  },
  kitchenOrderLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  kitchenOrderLinePrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E65100',
    minWidth: 56,
    textAlign: 'right',
  },
  currentOrderSection: {
    paddingTop: 8,
  },
  currentOrderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tableTabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 16,
  },
  tableTab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tableTabActive: {
    borderBottomColor: '#4CAF50',
  },
  tableTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  tableTabTextActive: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  panel: {
    flex: 1,
    backgroundColor: '#fff',
  },
  categoryTabs: {
    maxHeight: 50,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categoryTabsContent: {
    paddingHorizontal: 16,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  categoryTabActive: {
    borderBottomColor: '#4CAF50',
  },
  categoryTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryTabTextActive: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  menuList: {
    flex: 1,
  },
  menuListContent: {
    flexGrow: 1,
  },
  menuItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  menuItemDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  menuItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  orderList: {
    flex: 1,
  },
  orderListContent: {
    paddingBottom: 100,
  },
  orderItemCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  complementsContainer: {
    marginTop: 6,
    marginLeft: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  complementDot: {
    fontSize: 11,
    color: '#999',
    marginRight: 8,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  orderItemPrice: {
    fontSize: 14,
    color: '#4CAF50',
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
    color: '#666',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  tablePickCapacityBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tablePickCapacityContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tablePickCapacityTab: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
  },
  tablePickCapacityTabActive: {
    backgroundColor: '#4CAF50',
  },
  tablePickCapacityTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  tablePickCapacityTabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  tablePickList: {
    flex: 1,
  },
  tablePickListContent: {
    paddingBottom: 16,
  },
  tablePickSectionHeader: {
    backgroundColor: '#f0f4f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tablePickSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  tablePickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  tablePickCardMain: {
    flex: 1,
  },
  tablePickNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  tablePickCapacity: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  tablePickStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 12,
  },
  tablePickStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  completedSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  completedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  completedEmpty: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 24,
  },
  completedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  completedCardCompact: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#4CAF50',
    minWidth: 110,
  },
  completedTable: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  completedTotal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginRight: 12,
  },
  completedTime: {
    fontSize: 13,
    color: '#666',
  },
  emptyOrder: {
    padding: 40,
    alignItems: 'center',
  },
  emptyOrderText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  goToMenuButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  goToMenuButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  statusOpen: {
    backgroundColor: '#E3F2FD',
  },
  statusPreparing: {
    backgroundColor: '#FFF3E0',
  },
  statusReady: {
    backgroundColor: '#E8F5E9',
  },
  statusServed: {
    backgroundColor: '#F3E5F5',
  },
  statusPaid: {
    backgroundColor: '#E0F2F1',
  },
  statusCancelled: {
    backgroundColor: '#FFEBEE',
  },
  pickViewBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 16,
  },
  pickViewTab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  pickViewTabActive: {
    borderBottomColor: '#4CAF50',
  },
  pickViewTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  pickViewTabTextActive: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  readyOrderTable: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  servedBtn: {
    marginTop: 10,
    backgroundColor: '#9C27B0',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  servedBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  historySearchBar: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  historySearchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  historyListContent: {
    paddingBottom: 24,
  },
  historyDateBlock: {
    backgroundColor: '#f0f4f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  historyDateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    textTransform: 'capitalize',
  },
  historyOrderCard: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  historyOrderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyOrderTime: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    minWidth: 48,
  },
  historyOrderTotal: {
    marginLeft: 'auto',
    fontSize: 15,
    fontWeight: '700',
    color: '#4CAF50',
  },
  historyOrderMeta: {
    marginTop: 6,
    fontSize: 12,
    color: '#888',
  },
  historyOrderItems: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  historyOrderItemLine: {
    fontSize: 13,
    color: '#555',
  },
  historyOrderSupplementLine: {
    fontSize: 12,
    color: '#888',
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  tableOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tableStatusText: {
    fontSize: 14,
    color: '#666',
  },
  supplementsList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  supplementOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  supplementOptionSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  supplementOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  supplementOptionTextSelected: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  supplementPrice: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  noSupplementsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
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
  footerTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  footerTotalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  footerTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  sendToKitchenButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendToKitchenButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBadge: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  statusBadgeReady: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  statusBadgeText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
  confirmButtonDisabled: {
    backgroundColor: '#c8e6c9',
    opacity: 0.7,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  confirmButtonTextDisabled: {
    color: '#f5f5f5',
  },
});

