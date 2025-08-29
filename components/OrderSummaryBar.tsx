import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';

// Types pour la barre de résumé
interface OrderSummaryBarProps {
  total: number;
  itemCount: number;
  onSend: () => void;
  onCancel: () => void;
  onSaveDraft?: () => void;
  isSending?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'compact' | 'expanded';
}

const OrderSummaryBar: React.FC<OrderSummaryBarProps> = ({
  total,
  itemCount,
  onSend,
  onCancel,
  onSaveDraft,
  isSending = false,
  size = 'medium',
  variant = 'default'
}) => {
  // Déterminer la taille des éléments selon la prop size
  const getSizes = () => {
    switch (size) {
      case 'small':
        return {
          container: 60,
          title: 14,
          total: 18,
          button: 36,
          buttonText: 12
        };
      case 'large':
        return {
          container: 80,
          title: 18,
          total: 24,
          button: 48,
          buttonText: 16
        };
      default: // medium
        return {
          container: 70,
          title: 16,
          total: 20,
          button: 42,
          buttonText: 14
        };
    }
  };

  const sizes = getSizes();

  // Déterminer le layout selon la variante
  const getLayout = () => {
    switch (variant) {
      case 'compact':
        return {
          flexDirection: 'row' as const,
          justifyContent: 'space-between' as const,
          alignItems: 'center' as const
        };
      case 'expanded':
        return {
          flexDirection: 'column' as const,
          justifyContent: 'space-between' as const,
          alignItems: 'stretch' as const
        };
      default: // default
        return {
          flexDirection: 'row' as const,
          justifyContent: 'space-between' as const,
          alignItems: 'center' as const
        };
    }
  };

  const layout = getLayout();

  // Formater le total avec la devise
  const formatTotal = (amount: number) => {
    return `${amount.toFixed(2)} €`;
  };

  // Formater le compteur d'articles
  const formatItemCount = (count: number) => {
    if (count === 0) return 'Aucun article';
    if (count === 1) return '1 article';
    return `${count} articles`;
  };

  // Déterminer la couleur du total selon le montant
  const getTotalColor = () => {
    if (total === 0) return '#999';
    if (total < 50) return '#4CAF50'; // Vert pour petits montants
    if (total < 100) return '#FF9800'; // Orange pour montants moyens
    return '#F44336'; // Rouge pour gros montants
  };

  return (
    <View style={[
      styles.container,
      {
        padding: sizes.container * 0.15,
        ...layout
      }
    ]}>
      {/* Informations de la commande */}
      <View style={styles.summaryInfo}>
        <Text style={[
          styles.itemCount,
          { fontSize: sizes.title }
        ]}>
          {formatItemCount(itemCount)}
        </Text>
        
        <Text style={[
          styles.total,
          {
            fontSize: sizes.total,
            color: getTotalColor()
          }
        ]}>
          {formatTotal(total)}
        </Text>
      </View>

      {/* Boutons d'action */}
      <View style={[
        styles.actionButtons,
        variant === 'expanded' && styles.actionButtonsExpanded
      ]}>
        {/* Bouton Annuler */}
        <TouchableOpacity
          style={[
            styles.cancelButton,
            {
              height: sizes.button,
              paddingHorizontal: sizes.button * 0.4
            }
          ]}
          onPress={onCancel}
          disabled={isSending}
        >
          <Text style={[
            styles.cancelButtonText,
            { fontSize: sizes.buttonText }
          ]}>
            Annuler
          </Text>
        </TouchableOpacity>

        {/* Bouton Sauvegarder (optionnel) */}
        {onSaveDraft && (
          <TouchableOpacity
            style={[
              styles.saveDraftButton,
              {
                height: sizes.button,
                paddingHorizontal: sizes.button * 0.4
              }
            ]}
            onPress={onSaveDraft}
            disabled={isSending}
          >
            <Text style={[
              styles.saveDraftButtonText,
              { fontSize: sizes.buttonText }
            ]}>
              Sauvegarder
            </Text>
          </TouchableOpacity>
        )}

        {/* Bouton Envoyer */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              height: sizes.button,
              paddingHorizontal: sizes.button * 0.4,
              opacity: (itemCount > 0 && !isSending) ? 1 : 0.5
            }
          ]}
          onPress={onSend}
          disabled={itemCount === 0 || isSending}
        >
          <Text style={[
            styles.sendButtonText,
            { fontSize: sizes.buttonText }
          ]}>
            {isSending ? 'Envoi...' : 'Envoyer'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  summaryInfo: {
    alignItems: 'flex-start',
  },
  itemCount: {
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  total: {
    fontWeight: 'bold',
    marginBottom: 0,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonsExpanded: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 12,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  saveDraftButton: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  saveDraftButtonText: {
    color: '#1976d2',
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default OrderSummaryBar;


