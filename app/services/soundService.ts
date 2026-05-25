import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let ready = false;

export async function initSoundService(): Promise<void> {
  if (ready) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    ready = true;
  } catch (error) {
    console.warn('Impossible d\'initialiser le son:', error);
  }
}

/** Son de notification quand une commande est prête (cuisine → salle) */
export async function playOrderReadySound(): Promise<void> {
  try {
    await initSoundService();

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);

      setTimeout(() => {
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.connect(g2);
        g2.connect(ctx.destination);
        o2.frequency.value = 1174.66;
        o2.type = 'sine';
        g2.gain.setValueAtTime(0.3, ctx.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        o2.start(ctx.currentTime);
        o2.stop(ctx.currentTime + 0.5);
      }, 200);
      return;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
      { shouldPlay: true, volume: 1 }
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (error) {
    console.warn('Lecture du son impossible:', error);
  }
}
