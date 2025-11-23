import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { COLORS } from '../constants/colors';

export default function ComplaintsScreen({ navigation }) {
  const { user } = useAuth();
  
  if (!user) return null;

  const [complaints, setComplaints] = useState([]);
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [description, setDescription] = useState('');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);

  useEffect(() => {
    loadComplaints();
    loadOrders();
  }, []);

  const loadComplaints = async () => {
    try {
      const data = await api.getMyComplaints();
      setComplaints(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load complaints');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadOrders = async () => {
    try {
      const data = await api.getMyOrders();
      setOrders(data);
    } catch (error) {
      console.error('Failed to load orders');
    }
  };

  const handleCreateComplaint = async () => {
    if (!selectedOrderId) {
      Alert.alert('Error', 'Please select an order');
      return;
    }

    if (!description.trim() || description.trim().length < 10) {
      Alert.alert('Error', 'Description must be at least 10 characters long');
      return;
    }

    try {
      await api.createComplaint({
        order_id: selectedOrderId,
        description: description.trim(),
      });
      Alert.alert('Success', 'Complaint created');
      setShowCreateModal(false);
      setDescription('');
      setSelectedOrderId(null);
      loadComplaints();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create complaint');
    }
  };

  const handleResolve = async (id) => {
    Alert.alert(
      'Resolve Complaint',
      'Are you sure you want to mark this complaint as resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: async () => {
            try {
              await api.resolveComplaint(id);
              loadComplaints();
              setDetailModalVisible(false);
              Alert.alert('Success', 'Complaint resolved');
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to resolve');
            }
          },
        },
      ]
    );
  };

  const handleEscalate = async (id) => {
    Alert.alert(
      'Escalate Complaint',
      'This will escalate the complaint to a manager. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Escalate',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.escalateComplaint(id);
              loadComplaints();
              setDetailModalVisible(false);
              Alert.alert('Success', 'Complaint escalated to manager');
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to escalate');
            }
          },
        },
      ]
    );
  };

  const handleAssign = async (id) => {
    try {
      await api.assignComplaint(id);
      loadComplaints();
      Alert.alert('Success', 'Complaint assigned to you');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to assign');
    }
  };

  const handleReplyInChat = (complaint) => {
    navigation.navigate('Chat', {
      selectedUserId: complaint.created_by,
      complaintId: complaint.id,
      complaintText: `Regarding Order #${complaint.order_id} - ${complaint.description}`
    });
    setDetailModalVisible(false);
  };

  const getStatusColor = (status) => {
    return COLORS.status[status] || COLORS.text.secondary;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        // Try parsing manually if standard parsing fails (e.g. for some ISO formats on Android)
        return dateString.split('T')[0];
      }
      return date.toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString.replace('T', ' ').split('.')[0];
      }
      return date.toLocaleString();
    } catch (e) {
      return dateString;
    }
  };

  const renderComplaint = ({ item }) => (
    <TouchableOpacity
      style={styles.complaintCard}
      onPress={() => {
        setSelectedComplaint(item);
        setDetailModalVisible(true);
      }}
    >
      <View style={styles.complaintHeader}>
        <Text style={styles.complaintId}>Order #{item.order_id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <Text style={styles.complaintDescription} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.complaintFooter}>
        <Text style={styles.complaintDate}>
          {formatDate(item.created_at)}
        </Text>
        {item.handler_name && (
          <Text style={styles.assignedText}>
            Assigned to: {item.handler_name}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderDetailModal = () => {
    if (!selectedComplaint) return null;

    const isConsumer = user.role === 'CONSUMER';
    const isSales = user.role === 'SUPPLIER_SALES';
    const isManager = user.role === 'SUPPLIER_MANAGER' || user.role === 'SUPPLIER_OWNER';
    
    const canAssign = isSales && selectedComplaint.status === 'OPEN' && !selectedComplaint.handler_id;
    const canResolve = (isSales || isManager) && selectedComplaint.status !== 'RESOLVED';
    
    // Consumer can escalate ONLY if resolved (not satisfied)
    // Sales can escalate if NOT resolved (needs manager)
    const canEscalate = isConsumer 
      ? selectedComplaint.status === 'RESOLVED'
      : (isSales && selectedComplaint.status !== 'RESOLVED' && selectedComplaint.status !== 'ESCALATED');

    return (
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModal}>
            <ScrollView>
              <View style={styles.modalHeaderBar}>
                <Text style={styles.detailModalTitle}>Complaint Details</Text>
                <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Order ID</Text>
                <Text style={styles.detailValue}>#{selectedComplaint.order_id}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedComplaint.status) }]}>
                  <Text style={styles.statusText}>{selectedComplaint.status}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.detailValue}>{selectedComplaint.description}</Text>
              </View>

              {selectedComplaint.handler_name && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Assigned To</Text>
                  <Text style={styles.detailValue}>{selectedComplaint.handler_name} ({selectedComplaint.handler_role})</Text>
                </View>
              )}

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Created</Text>
                <Text style={styles.detailValue}>
                  {formatDateTime(selectedComplaint.created_at)}
                </Text>
              </View>

              {selectedComplaint.status === 'RESOLVED' && selectedComplaint.resolved_at && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Resolved</Text>
                  <Text style={styles.detailValue}>
                    {formatDateTime(selectedComplaint.resolved_at)}
                  </Text>
                </View>
              )}

              <View style={styles.actionButtonsDetail}>
                {isSales && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.replyButton]}
                    onPress={() => handleReplyInChat(selectedComplaint)}
                  >
                    <Text style={styles.actionButtonText}>Reply in Chat</Text>
                  </TouchableOpacity>
                )}

                {canAssign && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.assignButton]}
                    onPress={() => handleAssign(selectedComplaint.id)}
                  >
                    <Text style={styles.actionButtonText}>Assign to Me</Text>
                  </TouchableOpacity>
                )}

                {canResolve && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.resolveButton]}
                    onPress={() => handleResolve(selectedComplaint.id)}
                  >
                    <Text style={styles.actionButtonText}>Resolve</Text>
                  </TouchableOpacity>
                )}

                {canEscalate && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.escalateButton]}
                    onPress={() => handleEscalate(selectedComplaint.id)}
                  >
                    <Text style={styles.actionButtonText}>
                      {isConsumer && selectedComplaint.status === 'RESOLVED' ? 'Not Satisfied - Escalate' : 'Escalate'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complaints</Text>
      </View>
      <View style={styles.container}>
        {user.role === 'CONSUMER' && (
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.createButtonText}>+ File New Complaint</Text>
          </TouchableOpacity>
        )}

      <FlatList
        data={complaints}
        renderItem={renderComplaint}
        keyExtractor={item => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            loadComplaints();
          }} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {loading ? 'Loading complaints...' : 'No complaints'}
          </Text>
        }
      />

      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.keyboardAvoidingView}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>File a Complaint</Text>

                <Text style={styles.label}>Select Order</Text>
                <View style={styles.ordersList}>
                  {orders.map(order => (
                    <TouchableOpacity
                      key={order.id}
                      style={[
                        styles.orderOption,
                        selectedOrderId === order.id && styles.orderOptionSelected
                      ]}
                      onPress={() => setSelectedOrderId(order.id)}
                    >
                      <Text>Order #{order.id} - ${order.total_amount.toFixed(2)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Describe the issue..."
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowCreateModal(false)}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.submitButton]}
                    onPress={handleCreateComplaint}
                  >
                    <Text style={styles.modalButtonText}>Submit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {renderDetailModal()}
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
  createButton: {
    backgroundColor: COLORS.primary,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  complaintCard: {
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
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  complaintId: {
    fontSize: 16,
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
  complaintDescription: {
    fontSize: 14,
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  complaintFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  complaintDate: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  assignedText: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  actionButtonsDetail: {
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  replyButton: {
    backgroundColor: COLORS.primary,
  },
  assignButton: {
    backgroundColor: COLORS.success,
  },
  resolveButton: {
    backgroundColor: COLORS.success,
  },
  escalateButton: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: COLORS.text.primary,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: COLORS.text.primary,
  },
  ordersList: {
    maxHeight: 150,
    marginBottom: 16,
  },
  orderOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 8,
  },
  orderOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  textArea: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
    color: COLORS.text.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.text.secondary,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  detailModal: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  detailModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text.primary,
  },
  closeButton: {
    fontSize: 24,
    color: COLORS.text.secondary,
    fontWeight: 'bold',
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: COLORS.text.primary,
  },
  keyboardAvoidingView: {
    width: '100%',
  },
});
