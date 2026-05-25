import AsyncStorage from '@react-native-async-storage/async-storage';

export type SyncRole = 'master' | 'client' | 'unset';

const ROLE_KEY = 'ceeza_sync_role';
const MASTER_HOST_KEY = 'ceeza_master_host';

export async function getSyncRole(): Promise<SyncRole> {
  const v = await AsyncStorage.getItem(ROLE_KEY);
  if (v === 'master' || v === 'client') return v;
  return 'unset';
}

export async function setSyncRole(role: SyncRole): Promise<void> {
  if (role === 'unset') {
    await AsyncStorage.removeItem(ROLE_KEY);
    return;
  }
  await AsyncStorage.setItem(ROLE_KEY, role);
}

export async function getMasterHost(): Promise<string | null> {
  return AsyncStorage.getItem(MASTER_HOST_KEY);
}

export async function setMasterHost(host: string): Promise<void> {
  await AsyncStorage.setItem(MASTER_HOST_KEY, host.trim());
}
