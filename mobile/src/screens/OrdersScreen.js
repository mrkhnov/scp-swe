import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { COLORS } from '../constants/colors';

export default function OrdersScreen({ navigation }) {
  const { user } = useAuth();
  
  if (!user) return null;

  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const data = await api.getMyOrders();
      setOrders(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUpdateStatus = async (orderId, status) => {
    try {
      await api.updateOrderStatus(orderId, status);
      loadOrders();
      Alert.alert('Success', `Order ${status.toLowerCase()}`);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update order');
    }
  };

  const renderOrder = ({ item }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>Order #{item.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: COLORS.status[item.status] || COLORS.text.secondary }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <Text style={styles.orderDetail}>
        {user.role === 'CONSUMER' ? 'Supplier' : 'Consumer'} ID: {user.role === 'CONSUMER' ? item.supplier_id : item.consumer_id}
      </Text>
      <Text style={styles.orderTotal}>Total: ₸{item.total_amount.toFixed(2)}</Text>

      {item.items && item.items.length > 0 && (
        <View style={styles.itemsContainer}>
          <Text style={styles.itemsTitle}>Items:</Text>
          {item.items.map((orderItem, index) => (
            <Text key={index} style={styles.itemText}>
              • Product #{orderItem.product_id} - Qty: {orderItem.quantity} @ ₸{orderItem.unit_price_at_time}
            </Text>
          ))}
        </View>
      )}

      {user.role !== 'CONSUMER' && item.status === 'PENDING' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleUpdateStatus(item.id, 'ACCEPTED')}
          >
            <Text style={styles.actionButtonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleUpdateStatus(item.id, 'REJECTED')}
          >
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}

      {user.role !== 'CONSUMER' && item.status === 'ACCEPTED' && (
        <TouchableOpacity 
          style={[styles.actionButton, styles.deliveryButton]}
          onPress={() => handleUpdateStatus(item.id, 'IN_DELIVERY')}
        >
          <Text style={styles.actionButtonText}>Mark as In Delivery</Text>
        </TouchableOpacity>
      )}

      {user.role !== 'CONSUMER' && item.status === 'IN_DELIVERY' && (
        <TouchableOpacity 
          style={[styles.actionButton, styles.completeButton]}
          onPress={() => handleUpdateStatus(item.id, 'COMPLETED')}
        >
          <Text style={styles.actionButtonText}>Mark as Completed</Text>
        </TouchableOpacity>
      )}

      {user.role === 'CONSUMER' && ['PENDING', 'ACCEPTED'].includes(item.status) && (
        <TouchableOpacity 
          style={[styles.actionButton, styles.cancelButton]}
          onPress={() => handleUpdateStatus(item.id, 'CANCELLED')}
        >
          <Text style={styles.actionButtonText}>Cancel Order</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>
      <View style={styles.container}>
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={item => item.id.toString()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {
              setRefreshing(true);
              loadOrders();
            }} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {loading ? 'Loading orders...' : 'No orders yet'}
            </Text>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  orderCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text.primary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  orderDetail: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  orderTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.secondary,
    marginBottom: 12,
  },
  itemsContainer: {
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: COLORS.text.primary,
  },
  itemText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  acceptButton: {
    backgroundColor: COLORS.success,
  },
  rejectButton: {
    backgroundColor: COLORS.danger,
  },
  deliveryButton: {
    backgroundColor: COLORS.primary,
  },
  completeButton: {
    backgroundColor: COLORS.secondary,
  },
  cancelButton: {
    backgroundColor: COLORS.danger,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: COLORS.text.secondary,
  },
});
