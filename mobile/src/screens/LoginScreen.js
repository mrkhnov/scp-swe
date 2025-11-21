import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function LoginScreen({ navigation }) {
  const handleLogin = (role) => {
    if (role === 'consumer') {
      navigation.navigate('ConsumerHome');
    } else if (role === 'sales') {
      navigation.navigate('SalesHome');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to SCP</Text>
      <Text style={styles.subtitle}>Select your role to continue</Text>
      
      <TouchableOpacity 
        style={styles.button}
        onPress={() => handleLogin('consumer')}
      >
        <Text style={styles.buttonText}>Login as Consumer</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.button}
        onPress={() => handleLogin('sales')}
      >
        <Text style={styles.buttonText}>Login as Sales Representative</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 40,
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
