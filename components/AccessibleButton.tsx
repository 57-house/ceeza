import React, { useState, useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Animated,
  Dimensions,
  AccessibilityInfo,
  Vibration,
  Platform
} from 'react-native';

// Types pour le bouton accessible
interface AccessibleButtonProps {
  title: string;
  onPress: () => void;
  onLongPress?: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  feedbackType?: 'visual' | 'haptic' | 'both' | 'none';
  showRipple?: boolean;
  cornerRadius?: 'small' | 'medium' | 'large' | 'round';
  fullWidth?: boolean;
  style?: any;
  textStyle?: any;
}

const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  title,
  onPress,
  onLongPress,
  variant = 'primary',
  size = 'large',
  disabled = false,
  loading = false,
  icon,
  accessibilityLabel,
  accessibilityHint,
  feedbackType = 'both',
  showRipple = true,
  cornerRadius = 'medium',
  fullWidth = false,
  style,
  textStyle
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  // Animations
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;

  // Référence pour l'accessibilité
  const buttonRef = useRef<TouchableOpacity>(null);

  // Obtenir les styles selon la variante
  const getVariantStyles = () => {
    const variants = {
      primary: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
        textColor: '#FFFFFF',
        pressedColor: '#0056CC',
        disabledColor: '#E5E5E7',
        disabledTextColor: '#8E8E93'
      },
      secondary: {
        backgroundColor: '#F2F2F7',
        borderColor: '#C7C7CC',
        textColor: '#007AFF',
        pressedColor: '#E5E5EA',
        disabledColor: '#F2F2F7',
        disabledTextColor: '#C7C7CC'
      },
      success: {
        backgroundColor: '#34C759',
        borderColor: '#34C759',
        textColor: '#FFFFFF',
        pressedColor: '#28A745',
        disabledColor: '#E5E5E7',
        disabledTextColor: '#8E8E93'
      },
      warning: {
        backgroundColor: '#FF9500',
        borderColor: '#FF9500',
        textColor: '#FFFFFF',
        pressedColor: '#E6850E',
        disabledColor: '#E5E5E7',
        disabledTextColor: '#8E8E93'
      },
      danger: {
        backgroundColor: '#FF3B30',
        borderColor: '#FF3B30',
        textColor: '#FFFFFF',
        pressedColor: '#DC3545',
        disabledColor: '#E5E5E7',
        disabledTextColor: '#8E8E93'
      },
      ghost: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        textColor: '#007AFF',
        pressedColor: '#F2F2F7',
        disabledColor: 'transparent',
        disabledTextColor: '#C7C7CC'
      }
    };

    return variants[variant];
  };

  // Obtenir les tailles selon la prop size
  const getSizeStyles = () => {
    const sizes = {
      small: {
        height: 36,
        paddingHorizontal: 12,
        fontSize: 14,
        iconSize: 16
      },
      medium: {
        height: 44,
        paddingHorizontal: 16,
        fontSize: 16,
        iconSize: 18
      },
      large: {
        height: 56,
        paddingHorizontal: 20,
        fontSize: 18,
        iconSize: 20
      },
      xlarge: {
        height: 72,
        paddingHorizontal: 24,
        fontSize: 20,
        iconSize: 24
      }
    };

    return sizes[size];
  };

  // Obtenir le rayon des coins
  const getCornerRadius = () => {
    const radii = {
      small: 6,
      medium: 12,
      large: 20,
      round: getSizeStyles().height / 2
    };

    return radii[cornerRadius];
  };

  // Feedback haptique
  const triggerHapticFeedback = () => {
    if (feedbackType === 'haptic' || feedbackType === 'both') {
      if (Platform.OS === 'ios') {
        // iOS Haptic Feedback
        // HapticFeedback.trigger('impactLight');
      } else if (Platform.OS === 'android') {
        // Android Vibration
        Vibration.vibrate(50);
      }
    }
  };

  // Animation de pression
  const animatePress = (pressed: boolean) => {
    const animations = [];
    
    if (pressed) {
      animations.push(
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.95,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.8,
            duration: 100,
            useNativeDriver: true,
          })
        ])
      );
    } else {
      animations.push(
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          })
        ])
      );
    }

    Animated.sequence(animations).start();
  };

  // Animation de ripple
  const animateRipple = () => {
    if (!showRipple) return;

    rippleAnim.setValue(0);
    rippleOpacity.setValue(0.3);

    Animated.parallel([
      Animated.timing(rippleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: false,
      }),
      Animated.timing(rippleOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: false,
      })
    ]).start();
  };

  // Gérer le press
  const handlePressIn = () => {
    if (disabled || loading) return;
    
    setIsPressed(true);
    animatePress(true);
    triggerHapticFeedback();
    animateRipple();
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    
    setIsPressed(false);
    animatePress(false);
  };

  const handlePress = () => {
    if (disabled || loading) return;
    
    onPress();
    
    // Feedback visuel supplémentaire
    if (feedbackType === 'visual' || feedbackType === 'both') {
      // Flash de couleur
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.6,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        })
      ]).start();
    }
  };

  const handleLongPress = () => {
    if (disabled || loading || !onLongPress) return;
    
    onLongPress();
    triggerHapticFeedback();
  };

  // Focus pour l'accessibilité
  const handleFocus = () => {
    setIsFocused(true);
    // Animation de focus
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.02,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  // Configuration de l'accessibilité
  useEffect(() => {
    if (buttonRef.current) {
      AccessibilityInfo.setAccessibilityFocus(buttonRef.current);
    }
  }, []);

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();
  const cornerRadius = getCornerRadius();

  const buttonStyle = [
    styles.button,
    {
      height: sizeStyles.height,
      paddingHorizontal: sizeStyles.paddingHorizontal,
      backgroundColor: disabled ? variantStyles.disabledColor : variantStyles.backgroundColor,
      borderColor: disabled ? variantStyles.disabledColor : variantStyles.borderColor,
      borderRadius: cornerRadius,
      width: fullWidth ? '100%' : undefined,
    },
    style
  ];

  const textStyleFinal = [
    styles.text,
    {
      fontSize: sizeStyles.fontSize,
      color: disabled ? variantStyles.disabledTextColor : variantStyles.textColor,
    },
    textStyle
  ];

  return (
    <TouchableOpacity
      ref={buttonRef}
      style={buttonStyle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled || loading}
      activeOpacity={1}
      accessible={true}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          }
        ]}
      >
        {icon && (
          <Text style={[styles.icon, { fontSize: sizeStyles.iconSize }]}>
            {icon}
          </Text>
        )}
        
        <Text style={textStyleFinal} numberOfLines={1}>
          {loading ? 'Chargement...' : title}
        </Text>
      </Animated.View>

      {/* Ripple effect */}
      {showRipple && (
        <Animated.View
          style={[
            styles.ripple,
            {
              borderRadius: cornerRadius,
              opacity: rippleOpacity,
              transform: [{ scale: rippleAnim }],
            }
          ]}
        />
      )}

      {/* Focus indicator */}
      {isFocused && (
        <View
          style={[
            styles.focusIndicator,
            {
              borderRadius: cornerRadius + 2,
              borderColor: variantStyles.textColor,
            }
          ]}
        />
      )}
    </TouchableOpacity>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    minWidth: 120,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  ripple: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  focusIndicator: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderWidth: 2,
    borderStyle: 'solid',
  },
});

export default AccessibleButton;


