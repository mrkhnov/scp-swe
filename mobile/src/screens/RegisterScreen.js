import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('CONSUMER');
  const [companyType, setCompanyType] = useState('CONSUMER');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    console.log('Register button pressed');
    console.log('Form values:', { email, password, confirmPassword, companyName, role, companyType });
    
    if (!email || !password || !companyName) {
      console.log('Validation failed: missing required fields');
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    if (password !== confirmPassword) {
      console.log('Validation failed: passwords do not match');
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      console.log('Validation failed: password too short');
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    console.log('Sending registration request:', { email, role, company_name: companyName, company_type: companyType });
    
    try {
      await register({
        email,
        password,
        role,
        company_name: companyName,
        company_type: companyType,
      });
      console.log('Registration successful');
      Alert.alert(
        'Success', 
        'Account created successfully! Please log in.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Registration Failed', error.message || 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.form}>
          <Text style={styles.header}>Create Account</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Company Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Your Company Name"
              value={companyName}
              onChangeText={setCompanyName}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Account Type *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={companyType}
                onValueChange={(value) => {
                  setCompanyType(value);
                  setRole(value === 'CONSUMER' ? 'CONSUMER' : 'SUPPLIER_SALES');
                }}
                style={styles.picker}
              >
                <Picker.Item label="Consumer" value="CONSUMER" />
                <Picker.Item label="Supplier" value="SUPPLIER" />
              </Picker>
            </View>
          </View>

          {companyType === 'SUPPLIER' && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Your Role *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={role}
                  onValueChange={setRole}
                  style={styles.picker}
                >
                  <Picker.Item label="Owner" value="SUPPLIER_OWNER" />
                  <Picker.Item label="Manager" value="SUPPLIER_MANAGER" />
                  <Picker.Item label="Sales Representative" value="SUPPLIER_SALES" />
                </Picker>
              </View>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="At least 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkTextBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pickerContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#666',
    fontSize: 14,
  },
  linkTextBold: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
