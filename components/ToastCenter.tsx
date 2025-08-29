import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  PanGestureHandler,
  State,
  PanGestureHandlerStateChangeEvent,
  PanGestureHandlerGestureEvent
} from 'react-native';

// Types pour les notifications
interface ToastNotification {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  icon: string;
  color: string;
  backgroundColor: string;
  duration?: number;
  createdAt: Date;
  isRead: boolean;
  action?: {
    label: string;
    onPress: () => void;
  };
  metadata?: {
    orderId?: string;
    tableId?: string;
    status?: string;
    [key: string]: any;
  };
}

interface ToastCenterProps {
  notifications: ToastNotification[];
  onDismiss: (id: string) => void;
  onMarkAsRead: (id: string) => void;
  onActionPress: (notification: ToastNotification) => void;
  maxVisible?: number;
  position?: 'top' | 'bottom';
  autoDismiss?: boolean;
  autoDismissDelay?: number;
  enableSwipe?: boolean;
  enableSound?: boolean;
  enableVibration?: boolean;
}

interface ToastItemProps {
  notification: ToastNotification;
  onDismiss: (id: string) => void;
  onMarkAsRead: (id: string) => void;
  onActionPress: (notification: ToastNotification) => void;
  position: 'top' | 'bottom';
  enableSwipe: boolean;
  enableSound: boolean;
  enableVibration: boolean;
}

const ToastCenter: React.FC<ToastCenterProps> = ({
  notifications,
  onDismiss,
  onMarkAsRead,
  onActionPress,
  maxVisible = 3,
  position = 'top',
  autoDismiss = true,
  autoDismissDelay = 5000,
  enableSwipe = true,
  enableSound = true,
  enableVibration = true
}) => {
  const [visibleNotifications, setVisibleNotifications] = useState<ToastNotification[]>([]);
  const dismissTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Filtrer et limiter les notifications visibles
  useEffect(() => {
    const unreadNotifications = notifications
      .filter(n => !n.isRead)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, maxVisible);

    setVisibleNotifications(unreadNotifications);
  }, [notifications, maxVisible]);

  // Gérer l'auto-dismiss
  useEffect(() => {
    if (!autoDismiss) return;

    visibleNotifications.forEach(notification => {
      // Nettoyer les timeouts existants
      if (dismissTimeouts.current.has(notification.id)) {
        clearTimeout(dismissTimeouts.current.get(notification.id)!);
      }

      // Créer un nouveau timeout
      const timeout = setTimeout(() => {
        onDismiss(notification.id);
        dismissTimeouts.current.delete(notification.id);
      }, notification.duration || autoDismissDelay);

      dismissTimeouts.current.set(notification.id, timeout);
    });

    // Cleanup des timeouts
    return () => {
      dismissTimeouts.current.forEach(timeout => clearTimeout(timeout));
      dismissTimeouts.current.clear();
    };
  }, [visibleNotifications, autoDismiss, autoDismissDelay, onDismiss]);

  // Jouer un son de notification
  const playNotificationSound = useCallback(() => {
    if (!enableSound) return;
    
    // TODO: Implémenter la lecture audio
    // Pour l'instant, on simule avec une vibration
    if (enableVibration) {
      // Vibration pattern: [wait, vibrate, wait, vibrate]
      // Android: Vibration.vibrate([0, 100, 100, 100]);
      // iOS: HapticFeedback.trigger('notificationSuccess');
    }
  }, [enableSound, enableVibration]);

  // Marquer comme lu et jouer le son
  const handleMarkAsRead = useCallback((id: string) => {
    onMarkAsRead(id);
    playNotificationSound();
  }, [onMarkAsRead, playNotificationSound]);

  // Gérer l'action de la notification
  const handleActionPress = useCallback((notification: ToastNotification) => {
    if (notification.action) {
      notification.action.onPress();
    }
    onActionPress(notification);
    onDismiss(notification.id);
  }, [onActionPress, onDismiss]);

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <View style={[
      styles.container,
      position === 'top' ? styles.containerTop : styles.containerBottom
    ]}>
      {visibleNotifications.map((notification, index) => (
        <ToastItem
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
          onMarkAsRead={handleMarkAsRead}
          onActionPress={handleActionPress}
          position={position}
          enableSwipe={enableSwipe}
          enableSound={enableSound}
          enableVibration={enableVibration}
        />
      ))}
    </View>
  );
};

// Composant individuel pour chaque notification
const ToastItem: React.FC<ToastItemProps> = ({
  notification,
  onDismiss,
  onMarkAsRead,
  onActionPress,
  position,
  enableSwipe,
  enableSound,
  enableVibration
}) => {
  const translateY = useRef(new Animated.Value(position === 'top' ? -100 : 100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const panX = useRef(new Animated.Value(0)).current;

  // Animation d'entrée
  useEffect(() => {
    const enterAnimation = Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]);

    enterAnimation.start();
  }, [translateY, opacity, scale]);

  // Animation de sortie
  const animateExit = useCallback(() => {
    const exitAnimation = Animated.parallel([
      Animated.timing(translateY, {
        toValue: position === 'top' ? -100 : 100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 250,
        useNativeDriver: true,
      }),
    ]);

    exitAnimation.start(() => {
      onDismiss(notification.id);
    });
  }, [translateY, opacity, scale, position, onDismiss, notification.id]);

  // Gérer le swipe pour dismiss
  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: panX } }],
    { useNativeDriver: true }
  );

  const onPanHandlerStateChange = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX } = event.nativeEvent;
      
      if (Math.abs(translationX) > 100) {
        // Swipe suffisamment long pour dismiss
        animateExit();
      } else {
        // Retour à la position initiale
        Animated.spring(panX, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [panX, animateExit]);

  // Gérer le tap pour marquer comme lu
  const handleTap = useCallback(() => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
  }, [notification.isRead, notification.id, onMarkAsRead]);

  // Gérer le long press pour plus d'options
  const handleLongPress = useCallback(() => {
    // TODO: Afficher un menu contextuel avec plus d'options
    console.log('Long press sur notification:', notification.id);
  }, [notification.id]);

  const toastContent = (
    <Animated.View
      style={[
        styles.toastItem,
        {
          backgroundColor: notification.backgroundColor,
          borderLeftColor: notification.color,
          transform: [
            { translateY },
            { scale },
            { translateX: panX },
          ],
          opacity,
        },
      ]}
    >
      {/* Icône et contenu principal */}
      <View style={styles.toastContent}>
        <Text style={[styles.toastIcon, { color: notification.color }]}>
          {notification.icon}
        </Text>
        
        <View style={styles.toastText}>
          <Text style={[styles.toastTitle, { color: notification.color }]}>
            {notification.title}
          </Text>
          <Text style={styles.toastMessage} numberOfLines={2}>
            {notification.message}
          </Text>
        </View>
      </View>

      {/* Bouton d'action (si présent) */}
      {notification.action && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: notification.color }]}
          onPress={() => onActionPress(notification)}
          activeOpacity={0.8}
        >
          <Text style={styles.actionButtonText}>
            {notification.action.label}
          </Text>
        </TouchableOpacity>
      )}

      {/* Bouton de fermeture */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={animateExit}
        activeOpacity={0.6}
      >
        <Text style={styles.closeButtonText}>×</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  if (enableSwipe) {
    return (
      <PanGestureHandler
        onGestureEvent={onPanGestureEvent}
        onHandlerStateChange={onPanHandlerStateChange}
      >
        <Animated.View>
          {toastContent}
        </Animated.View>
      </PanGestureHandler>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleTap}
      onLongPress={handleLongPress}
      activeOpacity={0.9}
      style={styles.touchableToast}
    >
      {toastContent}
    </TouchableOpacity>
  );
};

// Hook personnalisé pour gérer les notifications CRDT
export const useToastNotifications = () => {
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  // Ajouter une notification
  const addNotification = useCallback((notification: Omit<ToastNotification, 'id' | 'createdAt' | 'isRead'>) => {
    const newNotification: ToastNotification = {
      ...notification,
      id: `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      isRead: false,
    };

    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  // Marquer comme lu
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  }, []);

  // Supprimer une notification
  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Gérer l'action d'une notification
  const handleNotificationAction = useCallback((notification: ToastNotification) => {
    // Logique spécifique selon le type de notification
    if (notification.metadata?.orderId) {
      console.log(`Action sur commande: ${notification.metadata.orderId}`);
      // TODO: Navigation vers la commande
    }
  }, []);

  // Nettoyer les anciennes notifications
  const cleanupOldNotifications = useCallback(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    setNotifications(prev =>
      prev.filter(n => n.createdAt > oneHourAgo)
    );
  }, []);

  // Nettoyer automatiquement toutes les heures
  useEffect(() => {
    const interval = setInterval(cleanupOldNotifications, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [cleanupOldNotifications]);

  return {
    notifications,
    addNotification,
    markAsRead,
    dismissNotification,
    handleNotificationAction,
    cleanupOldNotifications,
  };
};

// Fonctions utilitaires pour créer des notifications typiques
export const createOrderNotification = (
  type: 'success' | 'info' | 'warning' | 'error',
  title: string,
  message: string,
  orderId: string,
  tableId?: string,
  action?: { label: string; onPress: () => void }
): Omit<ToastNotification, 'id' | 'createdAt' | 'isRead'> => {
  const notificationConfigs = {
    success: {
      icon: '✅',
      color: '#4CAF50',
      backgroundColor: '#E8F5E8',
    },
    info: {
      icon: 'ℹ️',
      color: '#2196F3',
      backgroundColor: '#E3F2FD',
    },
    warning: {
      icon: '⚠️',
      color: '#FF9800',
      backgroundColor: '#FFF3E0',
    },
    error: {
      icon: '❌',
      color: '#F44336',
      backgroundColor: '#FFEBEE',
    },
  };

  const config = notificationConfigs[type];

  return {
    type,
    title,
    message,
    icon: config.icon,
    color: config.color,
    backgroundColor: config.backgroundColor,
    duration: 5000,
    action,
    metadata: {
      orderId,
      tableId,
      type: 'order',
    },
  };
};

// Notifications prédéfinies pour les commandes
export const orderNotifications = {
  ready: (orderId: string, tableId: string) =>
    createOrderNotification(
      'success',
      'Commande prête !',
      `La commande de la table ${tableId} est prête à être servie.`,
      orderId,
      tableId,
      {
        label: 'Voir',
        onPress: () => console.log(`Voir commande ${orderId}`),
      }
    ),

  preparing: (orderId: string, tableId: string) =>
    createOrderNotification(
      'info',
      'Commande en préparation',
      `La commande de la table ${tableId} est en cours de préparation.`,
      orderId,
      tableId
    ),

  delayed: (orderId: string, tableId: string, delayMinutes: number) =>
    createOrderNotification(
      'warning',
      'Commande en retard',
      `La commande de la table ${tableId} a ${delayMinutes} min de retard.`,
      orderId,
      tableId,
      {
        label: 'Priorité',
        onPress: () => console.log(`Priorité commande ${orderId}`),
      }
    ),

  cancelled: (orderId: string, tableId: string) =>
    createOrderNotification(
      'error',
      'Commande annulée',
      `La commande de la table ${tableId} a été annulée.`,
      orderId,
      tableId
    ),

  served: (orderId: string, tableId: string) =>
    createOrderNotification(
      'success',
      'Commande servie',
      `La commande de la table ${tableId} a été servie.`,
      orderId,
      tableId
    ),

  paid: (orderId: string, tableId: string, amount: number) =>
    createOrderNotification(
      'success',
      'Paiement reçu',
      `Paiement de ${amount.toFixed(2)}€ reçu pour la table ${tableId}.`,
      orderId,
      tableId
    ),
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  containerTop: {
    top: 50,
  },
  containerBottom: {
    bottom: 50,
  },
  touchableToast: {
    marginBottom: 8,
  },
  toastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 8,
    minHeight: 60,
  },
  toastContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toastIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  toastText: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  toastMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 12,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
    marginLeft: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#999',
    fontWeight: 'bold',
  },
});

export default ToastCenter;


