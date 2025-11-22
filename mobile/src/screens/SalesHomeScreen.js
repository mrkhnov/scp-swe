import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function SalesHomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ pendingOrders: 0, openComplaints: 0, totalOrders: 0 });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [orders, complaints] = await Promise.all([
        api.getMyOrders(),
        api.getMyComplaints(),
      ]);
      setStats({
        pendingOrders: orders.filter(o => o.status === 'PENDING').length,
        openComplaints: complaints.filter(c => c.status === 'OPEN' || c.status === 'ESCALATED').length,
        totalOrders: orders.length,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          loadStats();
        }} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Sales Dashboard</Text>
          <Text style={styles.emailText}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, styles.pendingNumber]}>{stats.pendingOrders}</Text>
          <Text style={styles.statLabel}>Pending Orders</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, styles.complaintNumber]}>{stats.openComplaints}</Text>
          <Text style={styles.statLabel}>Active Issues</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalOrders}</Text>
          <Text style={styles.statLabel}>Total Orders</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Orders')}
        >
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionButtonText}>Manage Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Complaints')}
        >
          <Text style={styles.actionIcon}>⚠️</Text>
          <Text style={styles.actionButtonText}>Handle Complaints</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Chat')}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionButtonText}>Messages</Text>
        </TouchableOpacity>
      </View>

      {stats.pendingOrders > 0 && (
        <View style={styles.alertSection}>
          <Text style={styles.alertText}>
            ⚠️ You have {stats.pendingOrders} pending order{stats.pendingOrders > 1 ? 's' : ''} to review
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#5856D6',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  emailText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#5856D6',
    marginBottom: 4,
  },
  pendingNumber: {
    color: '#FF9500',
  },
  complaintNumber: {
    color: '#FF3B30',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  actionButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  alertSection: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  alertText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '500',
  },
});
