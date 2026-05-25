import * as Network from 'expo-network';
import { Platform } from 'react-native';

export async function getLocalIpAddress(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }
  try {
    const ip = await Network.getIpAddressAsync();
    return ip && ip !== '0.0.0.0' ? ip : null;
  } catch {
    return null;
  }
}
