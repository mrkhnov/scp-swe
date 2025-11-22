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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { COLORS } from '../constants/colors';



export default function SuppliersScreen({ navigation }) {
  const [links, setLinks] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('Loading suppliers and links...');
      const [linksData, suppliersData] = await Promise.all([
        api.getMyLinks(),
        api.searchSuppliers('') // Load all suppliers
      ]);
      console.log('Links:', linksData);
      console.log('Suppliers:', suppliersData);
      setLinks(linksData || []);
      setSuppliers(suppliersData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', 'Failed to load suppliers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await api.searchSuppliers(searchQuery);
      console.log('Search results:', results);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      Alert.alert('Error', 'Search failed');
    }
  };

  const handleRequestLink = async (supplierId) => {
    try {
      await api.requestLink(supplierId);
      Alert.alert('Success', 'Connection request sent');
      loadData();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to send request');
    }
  };

  const getLinkStatus = (supplierId) => {
    const link = links.find(l => l.supplier_id === supplierId);
    return link?.status || null;
  };

  const renderSupplier = ({ item }) => {
    const linkStatus = getLinkStatus(item.id);
    
    return (
      <View style={styles.linkCard}>
        <View style={styles.linkHeader}>
          <View>
            <Text style={styles.supplierName}>{item.name}</Text>
            {item.kyb_status && <Text style={styles.verifiedBadge}>✓ Verified</Text>}
          </View>
          {linkStatus ? (
            <View style={[styles.statusBadge, { backgroundColor: COLORS.status[linkStatus] || COLORS.text.secondary }]}>
              <Text style={styles.statusText}>{linkStatus}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => handleRequestLink(item.id)}
            >
              <Text style={styles.connectButtonText}>Connect</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderLink = ({ item }) => (
    <View style={styles.linkCard}>
      <View style={styles.linkHeader}>
        <Text style={styles.supplierName}>Supplier #{item.supplier_id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: COLORS.status[item.status] || COLORS.text.secondary }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      {item.status === 'APPROVED' && (
        <Text style={styles.approvedText}>✓ Active connection</Text>
      )}
      {item.status === 'PENDING' && (
        <Text style={styles.pendingText}>⏳ Awaiting approval</Text>
      )}
    </View>
  );

  const renderSearchResult = ({ item }) => {
    const existing = links.find(l => l.supplier_id === item.id);
    
    return (
      <View style={styles.searchCard}>
        <View style={styles.searchInfo}>
          <Text style={styles.searchName}>{item.name}</Text>
          <Text style={styles.searchType}>{item.type}</Text>
        </View>
        {existing ? (
          <Text style={styles.existingLink}>{existing.status}</Text>
        ) : (
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => handleRequestLink(item.id)}
          >
            <Text style={styles.connectButtonText}>Connect</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Suppliers</Text>
      </View>
      <View style={styles.container}>
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search suppliers..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>🔍</Text>
          </TouchableOpacity>
        </View>

      {searchResults.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>Search Results</Text>
          <FlatList
            data={searchResults}
            renderItem={renderSupplier}
            keyExtractor={item => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      <Text style={styles.sectionTitle}>Available Suppliers</Text>
      <FlatList
        data={suppliers}
        renderItem={renderSupplier}
        keyExtractor={item => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            loadData();
          }} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {loading ? 'Loading suppliers...' : 'No suppliers available'}
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
  searchSection: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 8,
    color: COLORS.text.primary,
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchButtonText: {
    fontSize: 20,
  },
  resultsSection: {
    padding: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    color: COLORS.text.primary,
  },
  searchCard: {
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
    marginRight: 12,
    width: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchInfo: {
    flex: 1,
  },
  searchName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: COLORS.text.primary,
  },
  searchType: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  connectButton: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  existingLink: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  linkCard: {
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
  linkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  verifiedBadge: {
    fontSize: 12,
    color: COLORS.success,
    marginTop: 4,
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
  approvedText: {
    color: COLORS.success,
    fontSize: 14,
  },
  pendingText: {
    color: COLORS.warning,
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: COLORS.text.secondary,
  },
});
