import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DailySupplyScreen from './DailySupplyScreen';
import MenuScreen from './MenuScreen';
import OrderScreen from './OrderScreen';
import SupplyItemsScreen from './SupplyItemsScreen';
import TablesScreen from './TablesScreen';

type Tab = 'tables' | 'menu' | 'supply-items' | 'daily-supply' | 'orders';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('tables');

  const renderContent = () => {
    try {
      switch (activeTab) {
        case 'tables':
          return <TablesScreen />;
        case 'menu':
          return <MenuScreen />;
        case 'supply-items':
          return <SupplyItemsScreen />;
        case 'daily-supply':
          return <DailySupplyScreen />;
        case 'orders':
          return <OrderScreen />;
        default:
          return <TablesScreen />;
      }
    } catch (error) {
      console.error('Erreur dans renderContent:', error);
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: '#F44336', textAlign: 'center' }}>
            Erreur lors du chargement: {error instanceof Error ? error.message : 'Erreur inconnue'}
          </Text>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBarContainer}
          contentContainerStyle={styles.tabBar}
        >
          <TouchableOpacity
            style={[styles.tab, activeTab === 'tables' && styles.activeTab]}
            onPress={() => setActiveTab('tables')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'tables' && styles.activeTabText,
              ]}
            >
              🪑 Tables
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'menu' && styles.activeTab]}
            onPress={() => setActiveTab('menu')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'menu' && styles.activeTabText,
              ]}
            >
              📋 Menu
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'supply-items' && styles.activeTab]}
            onPress={() => setActiveTab('supply-items')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'supply-items' && styles.activeTabText,
              ]}
            >
              📦 Articles
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'daily-supply' && styles.activeTab]}
            onPress={() => setActiveTab('daily-supply')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'daily-supply' && styles.activeTabText,
              ]}
            >
              🛒 Approvisionnement
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'orders' && styles.activeTab]}
            onPress={() => setActiveTab('orders')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'orders' && styles.activeTabText,
              ]}
            >
              📝 Commandes
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.content}>
        {renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabBarContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#4CAF50',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
});

