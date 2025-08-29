import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

// Types pour la timeline des commandes
interface TimelineStep {
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';
  label: string;
  description: string;
  icon: string;
  color: string;
  timestamp?: Date;
  isCompleted: boolean;
  isCurrent: boolean;
}

interface OrderTimelineProps {
  currentStatus: 'pending' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';
  timestamps: {
    createdAt?: Date;
    preparingAt?: Date;
    readyAt?: Date;
    servedAt?: Date;
    paidAt?: Date;
    cancelledAt?: Date;
  };
  size?: 'small' | 'medium' | 'large';
  variant?: 'horizontal' | 'vertical';
  showDescriptions?: boolean;
  showTimestamps?: boolean;
}

const OrderTimeline: React.FC<OrderTimelineProps> = ({
  currentStatus,
  timestamps,
  size = 'medium',
  variant = 'vertical',
  showDescriptions = true,
  showTimestamps = true
}) => {
  // Définir les étapes de la timeline
  const getTimelineSteps = (): TimelineStep[] => {
    const steps: TimelineStep[] = [
      {
        status: 'pending',
        label: 'En attente',
        description: 'Commande reçue et en attente de préparation',
        icon: '📋',
        color: '#FF9800',
        timestamp: timestamps.createdAt,
        isCompleted: ['preparing', 'ready', 'served', 'paid'].includes(currentStatus),
        isCurrent: currentStatus === 'pending'
      },
      {
        status: 'preparing',
        label: 'En préparation',
        description: 'Commande en cours de préparation en cuisine',
        icon: '👨‍🍳',
        color: '#2196F3',
        timestamp: timestamps.preparingAt,
        isCompleted: ['ready', 'served', 'paid'].includes(currentStatus),
        isCurrent: currentStatus === 'preparing'
      },
      {
        status: 'ready',
        label: 'Prête',
        description: 'Commande prête à être servie',
        icon: '✅',
        color: '#4CAF50',
        timestamp: timestamps.readyAt,
        isCompleted: ['served', 'paid'].includes(currentStatus),
        isCurrent: currentStatus === 'ready'
      },
      {
        status: 'served',
        label: 'Servie',
        description: 'Commande servie au client',
        icon: '🍽️',
        color: '#9C27B0',
        timestamp: timestamps.servedAt,
        isCompleted: ['paid'].includes(currentStatus),
        isCurrent: currentStatus === 'served'
      },
      {
        status: 'paid',
        label: 'Payée',
        description: 'Commande payée et finalisée',
        icon: '💰',
        color: '#4CAF50',
        timestamp: timestamps.paidAt,
        isCompleted: currentStatus === 'paid',
        isCurrent: currentStatus === 'paid'
      }
    ];

    // Si la commande est annulée, ajouter l'étape d'annulation
    if (currentStatus === 'cancelled') {
      steps.push({
        status: 'cancelled',
        label: 'Annulée',
        description: 'Commande annulée',
        icon: '❌',
        color: '#F44336',
        timestamp: timestamps.cancelledAt,
        isCompleted: true,
        isCurrent: true
      });
    }

    return steps;
  };

  // Obtenir les tailles selon la prop size
  const getSizes = () => {
    switch (size) {
      case 'small':
        return {
          stepSize: 24,
          lineWidth: 2,
          fontSize: 10,
          descriptionSize: 8,
          timestampSize: 8,
          spacing: 8
        };
      case 'large':
        return {
          stepSize: 40,
          lineWidth: 3,
          fontSize: 16,
          descriptionSize: 12,
          timestampSize: 10,
          spacing: 16
        };
      default: // medium
        return {
          stepSize: 32,
          lineWidth: 2,
          fontSize: 12,
          descriptionSize: 10,
          timestampSize: 9,
          spacing: 12
        };
    }
  };

  const sizes = getSizes();
  const steps = getTimelineSteps();

  // Formater l'horodatage
  const formatTimestamp = (date?: Date) => {
    if (!date) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `Il y a ${hours}h${mins > 0 ? mins : ''}`;
  };

  // Rendu pour la variante verticale
  const renderVerticalTimeline = () => (
    <View style={styles.verticalContainer}>
      {steps.map((step, index) => (
        <View key={step.status} style={styles.verticalStep}>
          {/* Ligne de connexion (sauf pour le dernier élément) */}
          {index < steps.length - 1 && (
            <View
              style={[
                styles.verticalLine,
                {
                  width: sizes.lineWidth,
                  backgroundColor: step.isCompleted ? step.color : '#E0E0E0',
                  height: sizes.spacing + 4
                }
              ]}
            />
          )}
          
          {/* Cercle de l'étape */}
          <View
            style={[
              styles.stepCircle,
              {
                width: sizes.stepSize,
                height: sizes.stepSize,
                borderRadius: sizes.stepSize / 2,
                backgroundColor: step.isCompleted ? step.color : '#E0E0E0',
                borderColor: step.isCurrent ? step.color : '#E0E0E0',
                borderWidth: step.isCurrent ? 3 : 0
              }
            ]}
          >
            <Text style={[styles.stepIcon, { fontSize: sizes.stepSize * 0.5 }]}>
              {step.icon}
            </Text>
          </View>
          
          {/* Ligne de connexion (sauf pour le dernier élément) */}
          {index < steps.length - 1 && (
            <View
              style={[
                styles.verticalLine,
                {
                  width: sizes.lineWidth,
                  backgroundColor: step.isCompleted ? step.color : '#E0E0E0',
                  height: sizes.spacing + 4
                }
              ]}
            />
          )}
          
          {/* Informations de l'étape */}
          <View style={styles.stepInfo}>
            <Text
              style={[
                styles.stepLabel,
                {
                  fontSize: sizes.fontSize,
                  color: step.isCompleted ? step.color : '#666',
                  fontWeight: step.isCurrent ? 'bold' : '500'
                }
              ]}
            >
              {step.label}
            </Text>
            
            {showDescriptions && (
              <Text
                style={[
                  styles.stepDescription,
                  {
                    fontSize: sizes.descriptionSize,
                    color: step.isCompleted ? '#666' : '#999'
                  }
                ]}
                numberOfLines={2}
              >
                {step.description}
              </Text>
            )}
            
            {showTimestamps && step.timestamp && (
              <Text
                style={[
                  styles.stepTimestamp,
                  {
                    fontSize: sizes.timestampSize,
                    color: step.isCompleted ? step.color : '#999'
                  }
                ]}
              >
                {formatTimestamp(step.timestamp)}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );

  // Rendu pour la variante horizontale
  const renderHorizontalTimeline = () => (
    <View style={styles.horizontalContainer}>
      {steps.map((step, index) => (
        <View key={step.status} style={styles.horizontalStep}>
          {/* Cercle de l'étape */}
          <View
            style={[
              styles.stepCircle,
              {
                width: sizes.stepSize,
                height: sizes.stepSize,
                borderRadius: sizes.stepSize / 2,
                backgroundColor: step.isCompleted ? step.color : '#E0E0E0',
                borderColor: step.isCurrent ? step.color : '#E0E0E0',
                borderWidth: step.isCurrent ? 3 : 0
              }
            ]}
          >
            <Text style={[styles.stepIcon, { fontSize: sizes.stepSize * 0.5 }]}>
              {step.icon}
            </Text>
          </View>
          
          {/* Ligne de connexion (sauf pour le dernier élément) */}
          {index < steps.length - 1 && (
            <View
              style={[
                styles.horizontalLine,
                {
                  height: sizes.lineWidth,
                  backgroundColor: step.isCompleted ? step.color : '#E0E0E0',
                  flex: 1,
                  marginHorizontal: sizes.spacing / 2
                }
              ]}
            />
          )}
          
          {/* Informations de l'étape */}
          <View style={styles.horizontalStepInfo}>
            <Text
              style={[
                styles.stepLabel,
                {
                  fontSize: sizes.fontSize,
                  color: step.isCompleted ? step.color : '#666',
                  fontWeight: step.isCurrent ? 'bold' : '500',
                  textAlign: 'center'
                }
              ]}
              numberOfLines={1}
            >
              {step.label}
            </Text>
            
            {showTimestamps && step.timestamp && (
              <Text
                style={[
                  styles.stepTimestamp,
                  {
                    fontSize: sizes.timestampSize,
                    color: step.isCompleted ? step.color : '#999',
                    textAlign: 'center'
                  }
                ]}
                numberOfLines={1}
              >
                {formatTimestamp(step.timestamp)}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {variant === 'vertical' ? renderVerticalTimeline() : renderHorizontalTimeline()}
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Variante verticale
  verticalContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  verticalStep: {
    alignItems: 'center',
    position: 'relative',
  },
  verticalLine: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -1 }, { translateY: -1 }],
  },
  stepCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stepIcon: {
    textAlign: 'center',
  },
  stepInfo: {
    alignItems: 'center',
    marginTop: 8,
    maxWidth: 120,
  },
  stepLabel: {
    textAlign: 'center',
    marginBottom: 2,
  },
  stepDescription: {
    textAlign: 'center',
    lineHeight: 12,
  },
  stepTimestamp: {
    textAlign: 'center',
    marginTop: 2,
    fontStyle: 'italic',
  },
  // Variante horizontale
  horizontalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  horizontalStep: {
    alignItems: 'center',
    flex: 1,
  },
  horizontalLine: {
    borderRadius: 1,
  },
  horizontalStepInfo: {
    alignItems: 'center',
    marginTop: 8,
    flex: 1,
  },
});

export default OrderTimeline;


