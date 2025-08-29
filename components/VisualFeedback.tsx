import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Modal,
  PanGestureHandler,
  State,
  PanGestureHandlerStateChangeEvent,
  PanGestureHandlerGestureEvent
} from 'react-native';

// Types pour le feedback visuel
interface FeedbackConfig {
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  message: string;
  duration?: number;
  showIcon?: boolean;
  showProgress?: boolean;
  autoHide?: boolean;
  position?: 'top' | 'center' | 'bottom';
  size?: 'small' | 'medium' | 'large';
  animation?: 'slide' | 'fade' | 'scale' | 'bounce';
}

interface VisualFeedbackProps {
  visible: boolean;
  config: FeedbackConfig;
  onClose?: () => void;
  onActionPress?: (action: string) => void;
  actions?: Array<{
    label: string;
    action: string;
    variant?: 'primary' | 'secondary' | 'danger';
  }>;
}

interface FeedbackState {
  isVisible: boolean;
  progress: number;
  isAnimating: boolean;
}

const VisualFeedback: React.FC<VisualFeedbackProps> = ({
  visible,
  config,
  onClose,
  onActionPress,
  actions = []
}) => {
  const [state, setState] = useState<FeedbackState>({
    isVisible: false,
    progress: 0,
    isAnimating: false
  });

  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0)).current;
  const iconRotateAnim = useRef(new Animated.Value(0)).current;

  // Timeout pour auto-hide
  const autoHideTimeout = useRef<NodeJS.Timeout>();
  const progressInterval = useRef<NodeJS.Timeout>();

  // Effet pour gérer la visibilité
  useEffect(() => {
    if (visible) {
      showFeedback();
    } else {
      hideFeedback();
    }
  }, [visible]);

  // Effet pour l'auto-hide
  useEffect(() => {
    if (config.autoHide && config.duration && state.isVisible) {
      if (autoHideTimeout.current) {
        clearTimeout(autoHideTimeout.current);
      }

      autoHideTimeout.current = setTimeout(() => {
        hideFeedback();
      }, config.duration);
    }

    return () => {
      if (autoHideTimeout.current) {
        clearTimeout(autoHideTimeout.current);
      }
    };
  }, [config.autoHide, config.duration, state.isVisible]);

  // Effet pour la barre de progression
  useEffect(() => {
    if (config.showProgress && config.duration && state.isVisible) {
      startProgressBar();
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [config.showProgress, config.duration, state.isVisible]);

  // Afficher le feedback
  const showFeedback = () => {
    setState(prev => ({ ...prev, isVisible: true, isAnimating: true }));

    const animations: Animated.CompositeAnimation[] = [];

    // Animation d'entrée selon le type
    switch (config.animation) {
      case 'slide':
        animations.push(
          Animated.spring(slideAnim, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          })
        );
        break;

      case 'fade':
        animations.push(
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          })
        );
        break;

      case 'scale':
        animations.push(
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          })
        );
        break;

      case 'bounce':
        animations.push(
          Animated.sequence([
            Animated.spring(scaleAnim, {
              toValue: 1.1,
              tension: 100,
              friction: 8,
              useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
              toValue: 1,
              tension: 100,
              friction: 8,
              useNativeDriver: true,
            })
          ])
        );
        break;

      default:
        animations.push(
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
          ])
        );
    }

    // Animation de l'icône
    if (config.showIcon) {
      animations.push(
        Animated.sequence([
          Animated.spring(iconScaleAnim, {
            toValue: 1.2,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(iconScaleAnim, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          })
        ])
      );

      // Rotation continue pour le loading
      if (config.type === 'loading') {
        Animated.loop(
          Animated.timing(iconRotateAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          })
        ).start();
      }
    }

    Animated.parallel(animations).start(() => {
      setState(prev => ({ ...prev, isAnimating: false }));
    });
  };

  // Masquer le feedback
  const hideFeedback = () => {
    setState(prev => ({ ...prev, isAnimating: true }));

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
      setState(prev => ({ ...prev, isVisible: false, isAnimating: false }));
      onClose?.();
    });
  };

  // Démarrer la barre de progression
  const startProgressBar = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    setState(prev => ({ ...prev, progress: 0 }));

    const interval = (config.duration || 5000) / 100;
    progressInterval.current = setInterval(() => {
      setState(prev => {
        if (prev.progress >= 100) {
          clearInterval(progressInterval.current);
          return prev;
        }
        return { ...prev, progress: prev.progress + 1 };
      });
    }, interval);

    // Animation de la barre de progression
    Animated.timing(progressAnim, {
      toValue: 100,
      duration: config.duration || 5000,
      useNativeDriver: false,
    }).start();
  };

  // Obtenir les styles selon le type
  const getTypeStyles = () => {
    const types = {
      success: {
        backgroundColor: '#34C759',
        iconColor: '#FFFFFF',
        textColor: '#FFFFFF',
        icon: '✓',
        borderColor: '#28A745'
      },
      error: {
        backgroundColor: '#FF3B30',
        iconColor: '#FFFFFF',
        textColor: '#FFFFFF',
        icon: '✕',
        borderColor: '#DC3545'
      },
      warning: {
        backgroundColor: '#FF9500',
        iconColor: '#FFFFFF',
        textColor: '#FFFFFF',
        icon: '⚠',
        borderColor: '#E6850E'
      },
      info: {
        backgroundColor: '#007AFF',
        iconColor: '#FFFFFF',
        textColor: '#FFFFFF',
        icon: 'ℹ',
        borderColor: '#0056CC'
      },
      loading: {
        backgroundColor: '#8E8E93',
        iconColor: '#FFFFFF',
        textColor: '#FFFFFF',
        icon: '⟳',
        borderColor: '#6C6C70'
      }
    };

    return types[config.type];
  };

  // Obtenir les tailles
  const getSizeStyles = () => {
    const sizes = {
      small: {
        padding: 12,
        fontSize: 14,
        iconSize: 16,
        borderRadius: 8
      },
      medium: {
        padding: 16,
        fontSize: 16,
        iconSize: 20,
        borderRadius: 12
      },
      large: {
        padding: 20,
        fontSize: 18,
        iconSize: 24,
        borderRadius: 16
      }
    };

    return sizes[config.size || 'medium'];
  };

  // Obtenir la position
  const getPositionStyles = () => {
    const positions = {
      top: { top: 50 },
      center: { top: '50%', transform: [{ translateY: -50 }] },
      bottom: { bottom: 50 }
    };

    return positions[config.position || 'top'];
  };

  const typeStyles = getTypeStyles();
  const sizeStyles = getSizeStyles();
  const positionStyles = getPositionStyles();

  // Si pas visible, ne rien afficher
  if (!state.isVisible) {
    return null;
  }

  const containerStyle = [
    styles.container,
    {
      padding: sizeStyles.padding,
      borderRadius: sizeStyles.borderRadius,
      backgroundColor: typeStyles.backgroundColor,
      borderColor: typeStyles.borderColor,
      ...positionStyles
    }
  ];

  const animatedStyle = {
    transform: [
      { translateY: slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: config.position === 'top' ? [-50, 0] : config.position === 'bottom' ? [50, 0] : [0, 0]
      })},
      { scale: scaleAnim }
    ],
    opacity: opacityAnim,
  };

  const iconStyle = {
    transform: [
      { scale: iconScaleAnim },
      { rotate: iconRotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
      })}
    ]
  };

  return (
    <Animated.View style={[containerStyle, animatedStyle]}>
      {/* Icône */}
      {config.showIcon && (
        <Animated.View style={[styles.iconContainer, iconStyle]}>
          <Text style={[
            styles.icon,
            {
              fontSize: sizeStyles.iconSize,
              color: typeStyles.iconColor
            }
          ]}>
            {typeStyles.icon}
          </Text>
        </Animated.View>
      )}

      {/* Message */}
      <View style={styles.messageContainer}>
        <Text style={[
          styles.message,
          {
            fontSize: sizeStyles.fontSize,
            color: typeStyles.textColor
          }
        ]} numberOfLines={3}>
          {config.message}
        </Text>
      </View>

      {/* Barre de progression */}
      {config.showProgress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%']
                  }),
                  backgroundColor: typeStyles.iconColor
                }
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: typeStyles.textColor }]}>
            {Math.round(state.progress)}%
          </Text>
        </View>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <View style={styles.actionsContainer}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.actionButton,
                {
                  backgroundColor: action.variant === 'danger' ? '#FF3B30' : 
                                 action.variant === 'primary' ? typeStyles.backgroundColor :
                                 'rgba(255, 255, 255, 0.2)',
                  borderColor: action.variant === 'danger' ? '#DC3545' : 
                              action.variant === 'primary' ? typeStyles.borderColor :
                              'rgba(255, 255, 255, 0.3)'
                }
              ]}
              onPress={() => onActionPress?.(action.action)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.actionText,
                {
                  color: action.variant === 'primary' || action.variant === 'danger' ? '#FFFFFF' : typeStyles.textColor
                }
              ]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Bouton de fermeture */}
      {!config.autoHide && (
        <TouchableOpacity
          style={styles.closeButton}
          onPress={hideFeedback}
          activeOpacity={0.7}
        >
          <Text style={[styles.closeButtonText, { color: typeStyles.textColor }]}>
            ✕
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
  },
  iconContainer: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
  },
  icon: {
    fontWeight: 'bold',
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    fontWeight: '500',
    lineHeight: 20,
  },
  progressContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    marginLeft: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

// Hook personnalisé pour utiliser le feedback visuel
export const useVisualFeedback = () => {
  const [feedbackConfig, setFeedbackConfig] = useState<FeedbackConfig | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const showFeedback = (config: FeedbackConfig) => {
    setFeedbackConfig(config);
    setIsVisible(true);
  };

  const hideFeedback = () => {
    setIsVisible(false);
    setFeedbackConfig(null);
  };

  const showSuccess = (message: string, options?: Partial<FeedbackConfig>) => {
    showFeedback({
      type: 'success',
      message,
      duration: 3000,
      autoHide: true,
      animation: 'slide',
      ...options
    });
  };

  const showError = (message: string, options?: Partial<FeedbackConfig>) => {
    showFeedback({
      type: 'error',
      message,
      duration: 5000,
      autoHide: true,
      animation: 'bounce',
      ...options
    });
  };

  const showWarning = (message: string, options?: Partial<FeedbackConfig>) => {
    showFeedback({
      type: 'warning',
      message,
      duration: 4000,
      autoHide: true,
      animation: 'slide',
      ...options
    });
  };

  const showInfo = (message: string, options?: Partial<FeedbackConfig>) => {
    showFeedback({
      type: 'info',
      message,
      duration: 3000,
      autoHide: true,
      animation: 'fade',
      ...options
    });
  };

  const showLoading = (message: string, options?: Partial<FeedbackConfig>) => {
    showFeedback({
      type: 'loading',
      message,
      showProgress: true,
      autoHide: false,
      animation: 'scale',
      ...options
    });
  };

  return {
    feedbackConfig,
    isVisible,
    showFeedback,
    hideFeedback,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading
  };
};

export default VisualFeedback;


