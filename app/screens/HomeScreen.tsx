import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  getConnectedDevicesCount,
  getSyncConnectionState,
  isMasterDevice,
  subscribeSync,
} from '../services/syncService';
import { getSyncRole } from '../sync/syncRoleStorage';
import DailySupplyScreen from './DailySupplyScreen';
import CaisseScreen from './CaisseScreen';
import InvoiceScreen from './InvoiceScreen';
import KitchenScreen from './KitchenScreen';
import MenuScreen from './MenuScreen';
import OrderScreen from './OrderScreen';
import NetworkScreen from './NetworkScreen';
import SupplyItemsScreen from './SupplyItemsScreen';
import TablesScreen from './TablesScreen';

type Tab = 'tables' | 'menu' | 'supply-items' | 'daily-supply' | 'orders' | 'kitchen' | 'invoices' | 'caisse' | 'network';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('tables');
  const [syncOnline, setSyncOnline] = useState(getSyncConnectionState() === 'connected');
  const [devicesOnNetwork, setDevicesOnNetwork] = useState(getConnectedDevicesCount());
  const [isMaster, setIsMaster] = useState(isMasterDevice());

  useEffect(() => {
    getSyncRole().then((r) => setIsMaster(r === 'master'));
    return subscribeSync((event) => {
      const state = getSyncConnectionState();
      setSyncOnline(state === 'connected' || state === 'master');
      setIsMaster(state === 'master');
      if (event.type === 'DISCONNECTED') {
        setDevicesOnNetwork({ count: 0, max: 20 });
      }
      if (event.type === 'CLIENT_COUNT') {
        setDevicesOnNetwork({ count: event.count, max: event.max });
      }
      if (event.type === 'CONNECTED') {
        setDevicesOnNetwork(getConnectedDevicesCount());
      }
    });
  }, []);

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
        case 'kitchen':
          return <KitchenScreen />;
        case 'invoices':
          return <InvoiceScreen />;
        case 'caisse':
          return <CaisseScreen />;
        case 'network':
          return <NetworkScreen />;
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
      <View style={styles.syncBar}>
        <View style={[styles.syncDot, syncOnline ? styles.syncOn : styles.syncOff]} />
        <Text style={styles.syncText}>
          {syncOnline
            ? isMaster
              ? `Maître · ${devicesOnNetwork.count} client${devicesOnNetwork.count !== 1 ? 's' : ''} (onglet Réseau)`
              : `Sync · ${devicesOnNetwork.count} appareil${devicesOnNetwork.count !== 1 ? 's' : ''} — configurez dans Réseau si besoin`
            : 'Hors ligne — onglet Réseau : définir maître ou client'}
        </Text>
      </View>
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
          <TouchableOpacity
            style={[styles.tab, activeTab === 'kitchen' && styles.activeTab]}
            onPress={() => setActiveTab('kitchen')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'kitchen' && styles.activeTabText,
              ]}
            >
              🍳 Cuisine
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'invoices' && styles.activeTab]}
            onPress={() => setActiveTab('invoices')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'invoices' && styles.activeTabText,
              ]}
            >
              🧾 Factures
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'caisse' && styles.activeTab]}
            onPress={() => setActiveTab('caisse')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'caisse' && styles.activeTabText,
              ]}
            >
              💳 Caisse
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'network' && styles.activeTab]}
            onPress={() => setActiveTab('network')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'network' && styles.activeTabText,
              ]}
            >
              📡 Réseau
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
  syncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  syncOn: { backgroundColor: '#4CAF50' },
  syncOff: { backgroundColor: '#F44336' },
  syncText: { fontSize: 12, color: '#666' },
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

