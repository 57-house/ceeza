import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform
} from 'react-native';

// Types pour l'historique des actions
interface ActionHistory<T> {
  id: string;
  action: 'create' | 'update' | 'delete';
  data: T;
  previousData?: T;
  timestamp: Date;
  description: string;
  tableId?: string;
  orderId?: string;
}

// État du gestionnaire undo/redo
interface UndoRedoManagerState<T> {
  history: ActionHistory<T>[];
  currentIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  lastAction?: ActionHistory<T>;
}

// Props du composant
interface UndoRedoManagerProps<T> {
  data: T[];
  onDataChange: (newData: T[]) => void;
  maxHistorySize?: number;
  enableUndoRedo?: boolean;
  enableControls?: boolean;
  position?: 'floating' | 'inline' | 'bottom';
  autoHideDelay?: number;
  onActionUndone?: (action: ActionHistory<T>) => void;
  onActionRedone?: (action: ActionHistory<T>) => void;
}

const UndoRedoManager = <T extends { id: string; [key: string]: any }>({
  data,
  onDataChange,
  maxHistorySize = 50,
  enableUndoRedo = true,
  enableControls = true,
  position = 'floating',
  autoHideDelay = 5000,
  onActionUndone,
  onActionRedone
}: UndoRedoManagerProps<T>) => {
  const [state, setState] = useState<UndoRedoManagerState<T>>({
    history: [],
    currentIndex: -1,
    canUndo: false,
    canRedo: false
  });

  const [isVisible, setIsVisible] = useState(false);
  const [lastActionTime, setLastActionTime] = useState(0);
  
  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  // Timeout pour auto-hide
  const autoHideTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  // Référence pour les données précédentes
  const previousDataRef = useRef<T[]>(data);

  // Effet pour détecter les changements de données
  useEffect(() => {
    if (JSON.stringify(data) !== JSON.stringify(previousDataRef.current)) {
      // Les données ont changé, mettre à jour la référence
      previousDataRef.current = [...data];
    }
  }, [data]);

  // Calculer les états undo/redo
  useEffect(() => {
    const canUndo = state.currentIndex >= 0;
    const canRedo = state.currentIndex < state.history.length - 1;
    
    setState(prev => ({
      ...prev,
      canUndo,
      canRedo
    }));
  }, [state.history, state.currentIndex]);

  // Auto-hide des contrôles
  useEffect(() => {
    if (autoHideTimeout.current) {
      clearTimeout(autoHideTimeout.current);
    }

    if (isVisible && autoHideDelay > 0) {
      autoHideTimeout.current = setTimeout(() => {
        hideControls();
      }, autoHideDelay);
    }

    return () => {
      if (autoHideTimeout.current) {
        clearTimeout(autoHideTimeout.current);
      }
    };
  }, [isVisible, lastActionTime, autoHideDelay]);

  // Animation d'entrée
  const showControls = useCallback(() => {
    setIsVisible(true);
    
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();
  }, [slideAnim, opacityAnim, scaleAnim]);

  // Animation de sortie
  const hideControls = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      setIsVisible(false);
    });
  }, [slideAnim, opacityAnim, scaleAnim]);

  // Afficher une notification d'undo/redo
  const showUndoNotification = useCallback((title: string, description: string) => {
    // Pour l'instant, on utilise un Alert simple
    // TODO: Implémenter un système de notification toast
    console.log(`${title}: ${description}`);
  }, []);

  // Ajouter une action à l'historique
  const addAction = useCallback((
    action: 'create' | 'update' | 'delete',
    actionData: T,
    previousData?: T,
    description?: string
  ) => {
    if (!enableUndoRedo) return;

    const newAction: ActionHistory<T> = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action,
      data: actionData,
      previousData,
      timestamp: new Date(),
      description: description || `${action} ${action === 'create' ? 'créé' : action === 'update' ? 'modifié' : 'supprimé'}`,
      tableId: (actionData as any).tableId,
      orderId: (actionData as any).orderId
    };

    setState(prev => {
      // Supprimer les actions après l'index actuel (si on fait undo puis nouvelle action)
      const newHistory = prev.history.slice(0, prev.currentIndex + 1);
      
      // Ajouter la nouvelle action
      newHistory.push(newAction);
      
      // Limiter la taille de l'historique
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
      }

      return {
        ...prev,
        history: newHistory,
        currentIndex: newHistory.length - 1,
        lastAction: newAction
      };
    });

    // Afficher les contrôles
    showControls();
    setLastActionTime(Date.now());
  }, [enableUndoRedo, maxHistorySize, showControls]);

  // Annuler la dernière action
  const undo = useCallback(() => {
    if (state.currentIndex < 0) return;

    const action = state.history[state.currentIndex];
    if (!action) return;

    try {
      let newData: T[];

      switch (action.action) {
        case 'create':
          // Supprimer l'élément créé
          newData = data.filter(item => item.id !== action.data.id);
          break;

        case 'update':
          // Restaurer les données précédentes
          if (action.previousData) {
            newData = data.map(item => 
              item.id === action.data.id ? action.previousData! : item
            );
          } else {
            newData = [...data];
          }
          break;

        case 'delete':
          // Restaurer l'élément supprimé
          newData = [...data, action.data];
          break;

        default:
          newData = [...data];
      }

      // Appliquer les changements
      onDataChange(newData);
      
      // Mettre à jour l'état
      setState(prev => ({
        ...prev,
        currentIndex: prev.currentIndex - 1
      }));

      // Notifier
      onActionUndone?.(action);
      showUndoNotification('Action annulée', action.description);

    } catch (error) {
      console.error('Erreur lors de l\'annulation:', error);
    }
  }, [state.currentIndex, state.history, data, onDataChange, onActionUndone, showUndoNotification]);

  // Rétablir une action annulée
  const redo = useCallback(() => {
    if (state.currentIndex >= state.history.length - 1) return;

    const action = state.history[state.currentIndex + 1];
    if (!action) return;

    try {
      let newData: T[];

      switch (action.action) {
        case 'create':
          // Recréer l'élément
          newData = [...data, action.data];
          break;

        case 'update':
          // Appliquer la modification
          newData = data.map(item => 
            item.id === action.data.id ? action.data : item
          );
          break;

        case 'delete':
          // Supprimer à nouveau l'élément
          newData = data.filter(item => item.id !== action.data.id);
          break;

        default:
          newData = [...data];
      }

      // Appliquer les changements
      onDataChange(newData);
      
      // Mettre à jour l'état
      setState(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1
      }));

      // Notifier
      onActionRedone?.(action);
      showUndoNotification('Action rétablie', action.description);

    } catch (error) {
      console.error('Erreur lors du rétablissement:', error);
    }
  }, [state.currentIndex, state.history, data, onDataChange, onActionRedone, showUndoNotification]);

  // Effacer l'historique
  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      history: [],
      currentIndex: -1,
      lastAction: undefined
    }));
  }, []);

  // Si les contrôles sont désactivés, ne rien afficher
  if (!enableControls) {
    return null;
  }

  // Styles conditionnels selon la position
  const getPositionStyles = () => {
    switch (position) {
      case 'floating':
        return {
          position: 'absolute' as const,
          top: 100,
          right: 20,
          zIndex: 1000,
        };
      case 'inline':
        return {
          position: 'relative' as const,
          marginVertical: 10,
        };
      case 'bottom':
        return {
          position: 'absolute' as const,
          bottom: 100,
          left: 20,
          right: 20,
          zIndex: 1000,
        };
      default:
        return {};
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        getPositionStyles(),
        {
          transform: [
            { translateX: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: position === 'floating' ? [100, 0] : [0, 0]
            })},
            { scale: scaleAnim }
          ],
          opacity: opacityAnim
        }
      ]}
    >
      {/* Bouton principal pour afficher/masquer les contrôles */}
      <TouchableOpacity
        style={styles.mainButton}
        onPress={isVisible ? hideControls : showControls}
        activeOpacity={0.8}
      >
        <Text style={styles.mainButtonText}>
          {isVisible ? '×' : '↶'}
        </Text>
      </TouchableOpacity>

      {/* Contrôles undo/redo */}
      {isVisible && (
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              !state.canUndo && styles.controlButtonDisabled
            ]}
            onPress={undo}
            disabled={!state.canUndo}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.controlButtonText,
              !state.canUndo && styles.controlButtonTextDisabled
            ]}>
              Annuler
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              !state.canRedo && styles.controlButtonDisabled
            ]}
            onPress={redo}
            disabled={!state.canRedo}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.controlButtonText,
              !state.canRedo && styles.controlButtonTextDisabled
            ]}>
              Rétablir
            </Text>
          </TouchableOpacity>

          {state.history.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearHistory}
              activeOpacity={0.7}
            >
              <Text style={styles.clearButtonText}>
                Effacer
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Indicateur de statut */}
      {state.lastAction && (
        <View style={styles.statusIndicator}>
          <Text style={styles.statusText} numberOfLines={1}>
            {state.lastAction.description}
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
  },
  mainButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  controlsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    marginTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minWidth: 120,
  },
  controlButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    marginBottom: 4,
  },
  controlButtonDisabled: {
    backgroundColor: '#E5E5EA',
    opacity: 0.5,
  },
  controlButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  controlButtonTextDisabled: {
    color: '#8E8E93',
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    marginTop: 4,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
    maxWidth: 200,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default UndoRedoManager;
