import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
  Alert
} from 'react-native';

// Types pour les statistiques
interface SalesData {
  date: string;
  totalSales: number;
  orderCount: number;
  averageOrderValue: number;
  topItems: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
}

interface MenuItemStats {
  id: string;
  name: string;
  category: string;
  totalSold: number;
  totalRevenue: number;
  averageRating: number;
  popularityRank: number;
}

interface ServerPerformance {
  id: string;
  name: string;
  ordersHandled: number;
  totalSales: number;
  averageOrderValue: number;
  customerRating: number;
  efficiency: number; // %
}

interface TimeRange {
  label: string;
  value: 'today' | 'week' | 'month' | 'quarter' | 'year';
  days: number;
}

interface StatisticsManagerProps {
  isVisible: boolean;
  onClose: () => void;
  onExportData?: (data: any, format: 'csv' | 'pdf') => void;
}

const StatisticsManager: React.FC<StatisticsManagerProps> = ({
  isVisible,
  onClose,
  onExportData
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>({
    label: 'Cette semaine',
    value: 'week',
    days: 7
  });
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [menuItemStats, setMenuItemStats] = useState<MenuItemStats[]>([]);
  const [serverPerformance, setServerPerformance] = useState<ServerPerformance[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const timeRanges: TimeRange[] = [
    { label: 'Aujourd\'hui', value: 'today', days: 1 },
    { label: 'Cette semaine', value: 'week', days: 7 },
    { label: 'Ce mois', value: 'month', days: 30 },
    { label: 'Ce trimestre', value: 'quarter', days: 90 },
    { label: 'Cette année', value: 'year', days: 365 }
  ];

  // Simuler des données de statistiques
  useEffect(() => {
    if (isVisible) {
      generateMockData();
    }
  }, [isVisible, selectedTimeRange]);

  const generateMockData = () => {
    // Données de ventes simulées
    const mockSalesData: SalesData[] = Array.from({ length: selectedTimeRange.days }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (selectedTimeRange.days - 1 - index));
      
      const totalSales = Math.floor(Math.random() * 5000) + 1000;
      const orderCount = Math.floor(Math.random() * 50) + 10;
      
      return {
        date: date.toLocaleDateString('fr-FR'),
        totalSales,
        orderCount,
        averageOrderValue: totalSales / orderCount,
        topItems: [
          { name: 'Burger Classique', quantity: Math.floor(Math.random() * 20) + 5, revenue: Math.floor(Math.random() * 200) + 100 },
          { name: 'Pizza Margherita', quantity: Math.floor(Math.random() * 15) + 3, revenue: Math.floor(Math.random() * 150) + 80 },
          { name: 'Salade César', quantity: Math.floor(Math.random() * 10) + 2, revenue: Math.floor(Math.random() * 100) + 50 }
        ]
      };
    });

    // Statistiques des plats
    const mockMenuItemStats: MenuItemStats[] = [
      {
        id: 'item_1',
        name: 'Burger Classique',
        category: 'Plats principaux',
        totalSold: 156,
        totalRevenue: 2340,
        averageRating: 4.5,
        popularityRank: 1
      },
      {
        id: 'item_2',
        name: 'Pizza Margherita',
        category: 'Plats principaux',
        totalSold: 134,
        totalRevenue: 2010,
        averageRating: 4.3,
        popularityRank: 2
      },
      {
        id: 'item_3',
        name: 'Salade César',
        category: 'Entrées',
        totalSold: 98,
        totalRevenue: 980,
        averageRating: 4.7,
        popularityRank: 3
      },
      {
        id: 'item_4',
        name: 'Tiramisu',
        category: 'Desserts',
        totalSold: 87,
        totalRevenue: 870,
        averageRating: 4.8,
        popularityRank: 4
      },
      {
        id: 'item_5',
        name: 'Vin Rouge',
        category: 'Boissons',
        totalSold: 76,
        totalRevenue: 1520,
        averageRating: 4.6,
        popularityRank: 5
      }
    ];

    // Performance des serveurs
    const mockServerPerformance: ServerPerformance[] = [
      {
        id: 'server_1',
        name: 'Marie Dupont',
        ordersHandled: 45,
        totalSales: 2340,
        averageOrderValue: 52,
        customerRating: 4.8,
        efficiency: 95
      },
      {
        id: 'server_2',
        name: 'Jean Martin',
        ordersHandled: 38,
        totalSales: 1890,
        averageOrderValue: 49.7,
        customerRating: 4.6,
        efficiency: 88
      },
      {
        id: 'server_3',
        name: 'Sophie Bernard',
        ordersHandled: 42,
        totalSales: 2150,
        averageOrderValue: 51.2,
        customerRating: 4.7,
        efficiency: 92
      }
    ];

    setSalesData(mockSalesData);
    setMenuItemStats(mockMenuItemStats);
    setServerPerformance(mockServerPerformance);
  };

  // Calculer les totaux
  const getTotalStats = () => {
    const totalSales = salesData.reduce((sum, day) => sum + day.totalSales, 0);
    const totalOrders = salesData.reduce((sum, day) => sum + day.orderCount, 0);
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    return {
      totalSales,
      totalOrders,
      averageOrderValue,
      averageDailySales: totalSales / selectedTimeRange.days
    };
  };

  // Obtenir les catégories uniques
  const getCategories = () => {
    const categories = menuItemStats.map(item => item.category);
    return ['all', ...Array.from(new Set(categories))];
  };

  // Filtrer les plats par catégorie
  const getFilteredMenuItems = () => {
    if (selectedCategory === 'all') {
      return menuItemStats;
    }
    return menuItemStats.filter(item => item.category === selectedCategory);
  };

  // Formater la monnaie
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  // Exporter les données
  const handleExport = useCallback((format: 'csv' | 'pdf') => {
    const exportData = {
      timeRange: selectedTimeRange,
      salesData,
      menuItemStats: getFilteredMenuItems(),
      serverPerformance,
      totalStats: getTotalStats()
    };
    
    onExportData?.(exportData, format);
    Alert.alert('Export', `Données exportées au format ${format.toUpperCase()}`);
  }, [selectedTimeRange, salesData, menuItemStats, serverPerformance, onExportData]);

  const totalStats = getTotalStats();
  const categories = getCategories();
  const filteredMenuItems = getFilteredMenuItems();

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
          <Text style={styles.title}>Statistiques & Analyses</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => handleExport('csv')}
            >
              <Text style={styles.exportButtonText}>📊 CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => handleExport('pdf')}
            >
              <Text style={styles.exportButtonText}>📄 PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content}>
          {/* Sélecteur de période */}
          <View style={styles.timeRangeSelector}>
            {timeRanges.map((range) => (
              <TouchableOpacity
                key={range.value}
                style={[
                  styles.timeRangeButton,
                  selectedTimeRange.value === range.value && styles.timeRangeButtonActive
                ]}
                onPress={() => setSelectedTimeRange(range)}
              >
                <Text style={[
                  styles.timeRangeButtonText,
                  selectedTimeRange.value === range.value && styles.timeRangeButtonTextActive
                ]}>
                  {range.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Résumé des totaux */}
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Résumé de la période</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Ventes totales</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalStats.totalSales)}</Text>
                <Text style={styles.summarySubtext}>
                  {formatCurrency(totalStats.averageDailySales)}/jour
                </Text>
              </View>
              
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Commandes</Text>
                <Text style={styles.summaryValue}>{totalStats.totalOrders}</Text>
                <Text style={styles.summarySubtext}>
                  {Math.round(totalStats.totalOrders / selectedTimeRange.days)}/jour
                </Text>
              </View>
              
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Panier moyen</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalStats.averageOrderValue)}</Text>
                <Text style={styles.summarySubtext}>Par commande</Text>
              </View>
            </View>
          </View>

          {/* Plats les plus populaires */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Plats les plus populaires</Text>
              
              {/* Filtre par catégorie */}
              <View style={styles.categoryFilter}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryButton,
                      selectedCategory === category && styles.categoryButtonActive
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text style={[
                      styles.categoryButtonText,
                      selectedCategory === category && styles.categoryButtonTextActive
                    ]}>
                      {category === 'all' ? 'Toutes' : category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {filteredMenuItems.map((item, index) => (
              <View key={item.id} style={styles.menuItemCard}>
                <View style={styles.menuItemRank}>
                  <Text style={styles.rankNumber}>#{item.popularityRank}</Text>
                </View>
                
                <View style={styles.menuItemInfo}>
                  <Text style={styles.menuItemName}>{item.name}</Text>
                  <Text style={styles.menuItemCategory}>{item.category}</Text>
                </View>
                
                <View style={styles.menuItemStats}>
                  <Text style={styles.menuItemStat}>
                    📊 {item.totalSold} vendus
                  </Text>
                  <Text style={styles.menuItemStat}>
                    💰 {formatCurrency(item.totalRevenue)}
                  </Text>
                  <Text style={styles.menuItemStat}>
                    ⭐ {item.averageRating.toFixed(1)}/5
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Performance des serveurs */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance des serveurs</Text>
            
            {serverPerformance.map((server) => (
              <View key={server.id} style={styles.serverCard}>
                <View style={styles.serverHeader}>
                  <Text style={styles.serverName}>{server.name}</Text>
                  <View style={[
                    styles.efficiencyBadge,
                    { backgroundColor: server.efficiency >= 90 ? '#34C759' : 
                                    server.efficiency >= 80 ? '#FF9500' : '#FF3B30' }
                  ]}>
                    <Text style={styles.efficiencyText}>
                      {server.efficiency}% efficacité
                    </Text>
                  </View>
                </View>
                
                <View style={styles.serverStats}>
                  <View style={styles.serverStat}>
                    <Text style={styles.serverStatLabel}>Commandes</Text>
                    <Text style={styles.serverStatValue}>{server.ordersHandled}</Text>
                  </View>
                  
                  <View style={styles.serverStat}>
                    <Text style={styles.serverStatLabel}>Ventes</Text>
                    <Text style={styles.serverStatValue}>{formatCurrency(server.totalSales)}</Text>
                  </View>
                  
                  <View style={styles.serverStat}>
                    <Text style={styles.serverStatLabel}>Panier moyen</Text>
                    <Text style={styles.serverStatValue}>{formatCurrency(server.averageOrderValue)}</Text>
                  </View>
                  
                  <View style={styles.serverStat}>
                    <Text style={styles.serverStatLabel}>Note clients</Text>
                    <Text style={styles.serverStatValue}>⭐ {server.customerRating.toFixed(1)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Évolution des ventes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Évolution des ventes</Text>
            
            {salesData.slice(-7).map((day, index) => (
              <View key={index} style={styles.salesDayCard}>
                <View style={styles.salesDayHeader}>
                  <Text style={styles.salesDayDate}>{day.date}</Text>
                  <Text style={styles.salesDayTotal}>
                    {formatCurrency(day.totalSales)}
                  </Text>
                </View>
                
                <View style={styles.salesDayDetails}>
                  <Text style={styles.salesDayDetail}>
                    📋 {day.orderCount} commandes
                  </Text>
                  <Text style={styles.salesDayDetail}>
                    💰 Panier moyen: {formatCurrency(day.averageOrderValue)}
                  </Text>
                </View>
                
                {day.topItems.length > 0 && (
                  <View style={styles.topItemsSection}>
                    <Text style={styles.topItemsTitle}>Plats populaires du jour:</Text>
                    {day.topItems.map((item, itemIndex) => (
                      <Text key={itemIndex} style={styles.topItem}>
                        • {item.name} ({item.quantity}x - {formatCurrency(item.revenue)})
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
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
  timeRangeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  timeRangeButton: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  timeRangeButtonActive: {
    backgroundColor: '#007AFF',
  },
  timeRangeButtonText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
  },
  timeRangeButtonTextActive: {
    color: '#FFFFFF',
  },
  summarySection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  summarySubtext: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
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
    marginBottom: 16,
  },
  categoryFilter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  categoryButton: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  categoryButtonActive: {
    backgroundColor: '#007AFF',
  },
  categoryButtonText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  menuItemRank: {
    width: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  menuItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  menuItemCategory: {
    fontSize: 12,
    color: '#8E8E93',
  },
  menuItemStats: {
    alignItems: 'flex-end',
  },
  menuItemStat: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 2,
  },
  serverCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  serverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  efficiencyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  efficiencyText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  serverStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  serverStat: {
    alignItems: 'center',
    minWidth: 80,
  },
  serverStatLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  serverStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  salesDayCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  salesDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  salesDayDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  salesDayTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34C759',
  },
  salesDayDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  salesDayDetail: {
    fontSize: 14,
    color: '#8E8E93',
  },
  topItemsSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  topItemsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 4,
  },
  topItem: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 8,
  },
});

export default StatisticsManager;
