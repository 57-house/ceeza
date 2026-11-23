import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Network from 'expo-network';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
function normalizeDeviceKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

const STORAGE_KEY = 'ceeza_device_physical_id';

let cachedPhysicalId: string | null = null;

/**
 * Identifiant physique / réseau de l'appareil (stable, stocké localement).
 * Utilisé comme préfixe de tous les IDs métier.
 */
export async function initDevicePhysicalId(): Promise<string> {
  if (cachedPhysicalId) return cachedPhysicalId;

  const parts: string[] = [];

  if (Platform.OS === 'android') {
    const androidId = Application.getAndroidId();
    if (androidId) parts.push(`android:${androidId}`);
  } else if (Platform.OS === 'ios') {
    const iosId = await Application.getIosIdForVendorAsync();
    if (iosId) parts.push(`ios:${iosId}`);
  } else if (Platform.OS === 'web') {
    parts.push('web');
  }

  try {
    const ip = await Network.getIpAddressAsync();
    if (ip && ip !== '0.0.0.0') {
      parts.push(`ip:${ip}`);
    }
  } catch {
    // ignore
  }

  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (parts.length > 0) {
    cachedPhysicalId = normalizeDeviceKey(parts.join('|'));
  } else {
    cachedPhysicalId = stored ?? uuidv4();
  }

  await AsyncStorage.setItem(STORAGE_KEY, cachedPhysicalId);
  return cachedPhysicalId;
}

export function getDevicePhysicalId(): string {
  if (!cachedPhysicalId) {
    throw new Error(
      "Identifiant appareil non initialisé. Appelez initDevicePhysicalId() au démarrage."
    );
  }
  return cachedPhysicalId;
}

/** Lecture sans erreur (avant init ou en secours). */
export function getDevicePhysicalIdOrFallback(): string {
  return cachedPhysicalId ?? 'device-pending';
}

export function getDevicePhysicalIdLabel(): string {
  const id = getDevicePhysicalIdOrFallback();
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}
