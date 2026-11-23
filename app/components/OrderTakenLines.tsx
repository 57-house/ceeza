import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { OrderItem } from '../types/order';

type OrderTakenLinesProps = {
  items: OrderItem[];
  style?: ViewStyle;
  lineStyle?: object;
  supplementStyle?: object;
};

export function OrderTakenLines({
  items,
  style,
  lineStyle,
  supplementStyle,
}: OrderTakenLinesProps) {
  if (!items.length) {
    return <Text style={[styles.empty, lineStyle]}>Aucun article</Text>;
  }

  return (
    <View style={style}>
      {items.map((item) => (
        <View key={item.id} style={styles.lineBlock}>
          <Text style={[styles.line, lineStyle]}>
            {item.quantity}× {item.menu_item_name}
          </Text>
          {(item.supplements || []).map((sup) => (
            <Text key={sup.id} style={[styles.supplement, supplementStyle]}>
              • {sup.menu_item_name}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lineBlock: {
    marginBottom: 4,
  },
  line: {
    fontSize: 13,
    color: '#555',
  },
  supplement: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
    marginTop: 2,
  },
  empty: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});
