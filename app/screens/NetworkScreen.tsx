import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SYNC_PORT } from '../config/network';
import {
  connectSyncService,
  disconnectSyncService,
  getConnectedDevicesCount,
  getSyncConnectionState,
  isExpoGo,
  isLocalTcpSyncAvailable,
  isMasterDevice,
  subscribeSync,
} from '../services/syncService';
import { getMasterHost, getSyncRole, setMasterHost, setSyncRole, SyncRole } from '../sync/syncRoleStorage';
import { getLocalIpAddress } from '../utils/deviceNetwork';

export default function NetworkScreen() {
  const [role, setRole] = useState<SyncRole>('unset');
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [masterHostInput, setMasterHostInput] = useState('');
  const [clientCount, setClientCount] = useState(0);
  const [syncState, setSyncState] = useState(getSyncConnectionState());

  const refresh = useCallback(async () => {
    setRole(await getSyncRole());
    const savedHost = await getMasterHost();
    if (savedHost) setMasterHostInput(savedHost);
    setLocalIp(await getLocalIpAddress());
    setSyncState(getSyncConnectionState());
    setClientCount(getConnectedDevicesCount().count);
  }, []);

  useEffect(() => {
    refresh();
    return subscribeSync((event) => {
      if (event.type === 'CLIENT_COUNT' || event.type === 'CONNECTED' || event.type === 'DISCONNECTED') {
        setSyncState(getSyncConnectionState());
        setClientCount(getConnectedDevicesCount().count);
      }
    });
  }, [refresh]);

  const applyRole = async (newRole: SyncRole, host?: string) => {
    if (newRole === 'client' && !host?.trim()) {
      Alert.alert('IP requise', 'Entrez l\'adresse IP de la tablette maître.');
      return;
    }

    await setSyncRole(newRole);
    if (newRole === 'client' && host) {
      await setMasterHost(host);
    }

    disconnectSyncService();
    await connectSyncService();
    await refresh();

    Alert.alert(
      'Réseau configuré',
      newRole === 'master'
        ? 'Cet appareil est la tablette maître. Les autres doivent se connecter à son IP.'
        : `Connecté à la maître ${host}`
    );
  };

  const isWeb = Platform.OS === 'web';
  const tcpAvailable = isLocalTcpSyncAvailable();
  const inExpoGo = isExpoGo();

  const applyRoleSafe = async (newRole: SyncRole, host?: string) => {
    if (!tcpAvailable && newRole !== 'unset' && !isWeb) {
      Alert.alert(
        'Expo Go',
        'La sync maître/client nécessite une app compilée (npx expo run:android).\n\nEn attendant : npm run server sur un PC, puis définissez EXPO_PUBLIC_WS_URL dans .env (ex. ws://192.168.x.x:8765).'
      );
      return;
    }
    await applyRole(newRole, host);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📡 Réseau local</Text>
      <Text style={styles.subtitle}>
        Sans PC : une tablette maître remplace le serveur. Les autres appareils s&apos;y connectent.
      </Text>

      {isWeb && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Sur le navigateur web, utilisez le mode dev avec npm run server sur un PC, ou l&apos;app
            mobile native.
          </Text>
        </View>
      )}

      {inExpoGo && !isWeb && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Expo Go ne supporte pas la tablette maître. Pour la prod : npx expo run:android (ou iOS).
            {'\n\n'}En dev : npm run server sur le PC + fichier .env avec EXPO_PUBLIC_WS_URL=ws://IP_DU_PC:8765
          </Text>
        </View>
      )}

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>État actuel</Text>
        <Text style={styles.statusValue}>
          {syncState === 'master'
            ? `🟢 Tablette maître — ${clientCount} appareil${clientCount !== 1 ? 's' : ''} connecté${clientCount !== 1 ? 's' : ''}`
            : syncState === 'connected'
              ? `🟢 Connecté à la maître — ${clientCount} sur le réseau`
              : '🔴 Non connecté — configurez ci-dessous'}
        </Text>
        {role !== 'unset' && (
          <Text style={styles.roleHint}>
            Rôle : {role === 'master' ? 'Maître' : 'Client'}
          </Text>
        )}
      </View>

      {!isWeb && tcpAvailable && (
        <>
          <Text style={styles.sectionTitle}>1. Tablette maître (1 seul appareil)</Text>
          <Text style={styles.help}>
            Choisissez la tablette ou le téléphone qui restera au comptoir. Elle héberge la sync
            pour tout le restaurant (jusqu&apos;à 20 appareils).
          </Text>

          {localIp && role === 'master' && (
            <View style={styles.ipBox}>
              <Text style={styles.ipTitle}>IP à donner aux autres appareils :</Text>
              <Text style={styles.ipValue}>{localIp}</Text>
              <Text style={styles.ipPort}>Port : {SYNC_PORT}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, styles.btnMaster, role === 'master' && styles.btnActive]}
            onPress={() => applyRoleSafe('master')}
          >
            <Text style={styles.btnText}>
              {role === 'master' ? '✓ Cet appareil est la maître' : 'Définir comme tablette maître'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>2. Autres appareils (clients)</Text>
          <Text style={styles.help}>
            Sur chaque autre téléphone/tablette, entrez l&apos;IP affichée sur la maître (ex.{' '}
            192.168.1.42).
          </Text>

          <TextInput
            style={styles.input}
            placeholder="IP de la tablette maître (ex. 192.168.1.42)"
            value={masterHostInput}
            onChangeText={setMasterHostInput}
            keyboardType="numeric"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.btn, styles.btnClient]}
            onPress={() => applyRoleSafe('client', masterHostInput)}
          >
            <Text style={styles.btnText}>Se connecter à la maître</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.sectionTitle}>Mode développement (optionnel)</Text>
      <Text style={styles.help}>
        Avec un PC : npm run server puis EXPO_PUBLIC_WS_URL=ws://IP_PC:{SYNC_PORT}
      </Text>

      {isMasterDevice() && (
        <Text style={styles.footerNote}>
          La maître doit rester allumée et sur le même Wi‑Fi que les autres pendant le service.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 20 },
  warningBox: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: { color: '#E65100', fontSize: 13 },
  statusCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  statusLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  statusValue: { fontSize: 16, fontWeight: '600', color: '#333' },
  roleHint: { fontSize: 13, color: '#666', marginTop: 8 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#333', marginTop: 8, marginBottom: 8 },
  help: { fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 19 },
  ipBox: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  ipTitle: { fontSize: 13, color: '#2E7D32' },
  ipValue: { fontSize: 28, fontWeight: 'bold', color: '#1B5E20', marginVertical: 8 },
  ipPort: { fontSize: 14, color: '#388E3C' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnMaster: { backgroundColor: '#2196F3' },
  btnClient: { backgroundColor: '#4CAF50' },
  btnActive: { backgroundColor: '#1565C0' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  footerNote: {
    marginTop: 24,
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
