import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  Camera,
  Calendar,
  Clock,
  Pill,
  Package,
  ScanLine,
  ChevronDown,
} from 'lucide-react-native';
import { useMedicineContext } from '../../context/MedicineContext';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '../../components/DateTimePicker';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../constants/theme';

const FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every other day',
  'Once a week',
  'As needed',
];

export default function AddMedicineScreen() {
  const { addMedicine } = useMedicineContext();
  const params = useLocalSearchParams<{
    ocrName?: string;
    ocrDosage?: string;
    ocrExpiry?: string;
    ocrQuantity?: string;
    ocrRawText?: string;
  }>();

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const [totalQuantity, setTotalQuantity] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [timesToTake, setTimesToTake] = useState<string[]>(['08:00']);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const [errors, setErrors] = useState({
    name: false,
    dosage: false,
    frequency: false,
    totalQuantity: false,
    currentQuantity: false,
    expiryDate: false,
  });

  // Apply OCR results when they arrive via navigation params
  useEffect(() => {
    if (params.ocrName) setName(params.ocrName);
    if (params.ocrDosage) setDosage(params.ocrDosage);
    if (params.ocrQuantity) {
      setTotalQuantity(params.ocrQuantity);
      setCurrentQuantity(params.ocrQuantity);
    }
    if (params.ocrExpiry) {
      try {
        const date = new Date(params.ocrExpiry);
        if (!isNaN(date.getTime())) {
          setExpiryDate(date);
        }
      } catch (e) {
        // Invalid date, ignore
      }
    }
    if (params.ocrRawText) {
      setNotes(`Scanned text:\n${params.ocrRawText}`);
    }
  }, [params.ocrName, params.ocrDosage, params.ocrQuantity, params.ocrExpiry]);

  const handleScanMedicine = () => {
    router.push('/camera');
  };

  const handleImagePick = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera permissions to make this work!');
        return;
      }
    }

    try {
      if (Platform.OS === 'web') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
        if (!result.canceled) {
          Alert.alert(
            'Image Selected',
            'OCR processing is available on mobile devices. Please enter details manually on web.',
            [{ text: 'OK' }]
          );
        }
        return;
      }
      handleScanMedicine();
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'There was an error. Please try again.');
    }
  };

  const validateForm = () => {
    const newErrors = {
      name: !name.trim(),
      dosage: !dosage.trim(),
      frequency: !frequency.trim(),
      totalQuantity: !totalQuantity.trim() || isNaN(Number(totalQuantity)),
      currentQuantity:
        !currentQuantity.trim() ||
        isNaN(Number(currentQuantity)) ||
        Number(currentQuantity) > Number(totalQuantity),
      expiryDate: false,
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error);
  };

  const handleAddTimeToTake = () => {
    setTimesToTake([...timesToTake, '12:00']);
  };

  const handleRemoveTimeToTake = (index: number) => {
    const newTimes = [...timesToTake];
    newTimes.splice(index, 1);
    setTimesToTake(newTimes);
  };

  const handleTimeChange = (index: number, time: string) => {
    const newTimes = [...timesToTake];
    newTimes[index] = time;
    setTimesToTake(newTimes);
  };

  const handleTimePickerOpen = (index: number) => {
    setCurrentTimeIndex(index);
    setShowTimePicker(true);
  };

  const handleTimePickerChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      handleTimeChange(currentTimeIndex, `${hours}:${minutes}`);
    }
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const newMedicine = {
      id: Date.now().toString(),
      name,
      dosage,
      frequency,
      totalQuantity: Number(totalQuantity),
      currentQuantity: Number(currentQuantity),
      expiryDate: expiryDate.toISOString(),
      notes,
      timeToTake: timesToTake,
      createdAt: new Date().toISOString(),
    };

    addMedicine(newMedicine);

    if (Platform.OS === 'web') {
      alert('Medicine added successfully!');
    } else {
      Alert.alert('Success', 'Medicine added successfully!', [
        { text: 'OK', onPress: () => router.navigate('/') },
      ]);
    }

    resetForm();
  };

  const resetForm = () => {
    setName('');
    setDosage('');
    setFrequency('');
    setTotalQuantity('');
    setCurrentQuantity('');
    setExpiryDate(new Date());
    setNotes('');
    setTimesToTake(['08:00']);
    setErrors({ name: false, dosage: false, frequency: false, totalQuantity: false, currentQuantity: false, expiryDate: false });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <Text style={styles.title}>Add Medicine</Text>
          <Text style={styles.subtitle}>Scan a label or enter details manually</Text>
        </Animated.View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
          <View style={styles.formContainer}>
            {/* Scan Button */}
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <TouchableOpacity style={styles.scanButton} onPress={handleScanMedicine}>
                <View style={styles.scanIconContainer}>
                  <ScanLine size={28} color={Colors.primary} />
                </View>
                <View style={styles.scanTextContainer}>
                  <Text style={styles.scanButtonTitle}>Scan Medicine Label</Text>
                  <Text style={styles.scanButtonSubtitle}>Auto-fill details using your camera</Text>
                </View>
                <Camera size={20} color={Colors.textTertiary} />
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or enter manually</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Medicine Name */}
            <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.inputContainer}>
              <Text style={styles.label}>Medicine Name <Text style={styles.required}>*</Text></Text>
              <View style={[styles.inputWrapper, errors.name && styles.inputError]}>
                <Pill size={18} color={errors.name ? Colors.danger : Colors.textTertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Paracetamol, Amoxicillin"
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </View>
              {errors.name && <Text style={styles.errorText}>Medicine name is required</Text>}
            </Animated.View>

            {/* Dosage */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.inputContainer}>
              <Text style={styles.label}>Dosage <Text style={styles.required}>*</Text></Text>
              <View style={[styles.inputWrapper, errors.dosage && styles.inputError]}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 500mg, 5ml, 10mcg"
                  placeholderTextColor={Colors.textMuted}
                  value={dosage}
                  onChangeText={setDosage}
                />
              </View>
              {errors.dosage && <Text style={styles.errorText}>Dosage is required</Text>}
            </Animated.View>

            {/* Frequency Picker */}
            <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.inputContainer}>
              <Text style={styles.label}>Frequency <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity
                style={[styles.inputWrapper, errors.frequency && styles.inputError]}
                onPress={() => setShowFrequencyPicker(!showFrequencyPicker)}
              >
                <Text style={[styles.pickerText, !frequency && { color: Colors.textMuted }]}>
                  {frequency || 'Select frequency'}
                </Text>
                <ChevronDown size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
              {showFrequencyPicker && (
                <Animated.View entering={FadeInDown.duration(200)} style={styles.frequencyList}>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.frequencyOption, frequency === option && styles.frequencyOptionSelected]}
                      onPress={() => { setFrequency(option); setShowFrequencyPicker(false); }}
                    >
                      <Text style={[styles.frequencyOptionText, frequency === option && styles.frequencyOptionTextSelected]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </Animated.View>
              )}
              {errors.frequency && <Text style={styles.errorText}>Frequency is required</Text>}
            </Animated.View>

            {/* Times to Take */}
            <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.inputContainer}>
              <Text style={styles.label}>Times to Take</Text>
              {timesToTake.map((time, index) => (
                <View key={`time-${index}`} style={styles.timeInputRow}>
                  <TouchableOpacity style={styles.timePickerButton} onPress={() => handleTimePickerOpen(index)}>
                    <Clock size={18} color={Colors.primary} />
                    <Text style={styles.timePickerButtonText}>{time}</Text>
                  </TouchableOpacity>
                  {timesToTake.length > 1 && (
                    <TouchableOpacity style={styles.removeTimeButton} onPress={() => handleRemoveTimeToTake(index)}>
                      <Text style={styles.removeTimeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity style={styles.addTimeButton} onPress={handleAddTimeToTake}>
                <Text style={styles.addTimeButtonText}>+ Add Another Time</Text>
              </TouchableOpacity>
              {showTimePicker && (
                <DateTimePicker
                  value={(() => { const [h, m] = timesToTake[currentTimeIndex].split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d; })()}
                  mode="time"
                  display="default"
                  onChange={handleTimePickerChange}
                />
              )}
            </Animated.View>

            {/* Quantity Row */}
            <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.rowContainer}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: Spacing.sm }]}>
                <Text style={styles.label}>Total Qty <Text style={styles.required}>*</Text></Text>
                <View style={[styles.inputWrapper, errors.totalQuantity && styles.inputError]}>
                  <Package size={18} color={Colors.textTertiary} />
                  <TextInput style={styles.input} placeholder="30" placeholderTextColor={Colors.textMuted} value={totalQuantity} onChangeText={setTotalQuantity} keyboardType="numeric" />
                </View>
                {errors.totalQuantity && <Text style={styles.errorText}>Required</Text>}
              </View>
              <View style={[styles.inputContainer, { flex: 1, marginLeft: Spacing.sm }]}>
                <Text style={styles.label}>Current Qty <Text style={styles.required}>*</Text></Text>
                <View style={[styles.inputWrapper, errors.currentQuantity && styles.inputError]}>
                  <Package size={18} color={Colors.textTertiary} />
                  <TextInput style={styles.input} placeholder="28" placeholderTextColor={Colors.textMuted} value={currentQuantity} onChangeText={setCurrentQuantity} keyboardType="numeric" />
                </View>
                {errors.currentQuantity && <Text style={styles.errorText}>Must be ≤ total</Text>}
              </View>
            </Animated.View>

            {/* Expiry Date */}
            <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.inputContainer}>
              <Text style={styles.label}>Expiry Date <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowDatePicker(true)}>
                <Calendar size={18} color={Colors.primary} />
                <Text style={styles.dateText}>{expiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={expiryDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => { setShowDatePicker(false); if (selectedDate) setExpiryDate(selectedDate); }}
                />
              )}
            </Animated.View>

            {/* Notes */}
            <Animated.View entering={FadeInDown.delay(450).duration(400)} style={styles.inputContainer}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.inputWrapper, styles.textArea]}
                placeholder="Side effects, special instructions, etc."
                placeholderTextColor={Colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
              />
            </Animated.View>

            {/* Submit */}
            <Animated.View entering={FadeInUp.delay(500).duration(400)}>
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Pill size={20} color={Colors.white} />
                <Text style={styles.submitButtonText}>Add Medicine</Text>
              </TouchableOpacity>
            </Animated.View>

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.xl, paddingBottom: Spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: Spacing.xs },
  scrollView: { flex: 1 },
  formContainer: { padding: Spacing.xxl },
  scanButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1.5,
    borderColor: Colors.primary, borderStyle: 'dashed',
  },
  scanIconContainer: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.white,
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md, ...Shadow.sm,
  },
  scanTextContainer: { flex: 1 },
  scanButtonTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  scanButtonSubtitle: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: Spacing.md, fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500' },
  inputContainer: { marginBottom: Spacing.lg },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm },
  required: { color: Colors.danger },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, minHeight: 48, ...Shadow.sm,
  },
  inputError: { borderColor: Colors.danger, borderWidth: 1.5 },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, paddingVertical: Spacing.md, paddingLeft: Spacing.sm },
  errorText: { color: Colors.danger, fontSize: FontSize.xs, marginTop: Spacing.xs },
  pickerText: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, paddingVertical: Spacing.md },
  frequencyList: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.border, ...Shadow.md },
  frequencyOption: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  frequencyOptionSelected: { backgroundColor: Colors.primaryLight },
  frequencyOptionText: { fontSize: FontSize.md, color: Colors.textSecondary },
  frequencyOptionTextSelected: { color: Colors.primary, fontWeight: '600' },
  textArea: { minHeight: 100, alignItems: 'flex-start', paddingTop: Spacing.md, paddingBottom: Spacing.md, textAlignVertical: 'top' },
  rowContainer: { flexDirection: 'row' },
  dateText: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, paddingVertical: Spacing.md, paddingLeft: Spacing.sm },
  timeInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  timePickerButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, ...Shadow.sm,
  },
  timePickerButtonText: { marginLeft: Spacing.sm, fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  removeTimeButton: { marginLeft: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.dangerLight },
  removeTimeButtonText: { color: Colors.dangerDark, fontWeight: '600', fontSize: FontSize.xs },
  addTimeButton: { paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, backgroundColor: Colors.primaryLight, alignItems: 'center', marginTop: Spacing.xs },
  addTimeButtonText: { color: Colors.primary, fontWeight: '600', fontSize: FontSize.sm },
  submitButton: {
    flexDirection: 'row', backgroundColor: Colors.primary, borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg, alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.md, ...Shadow.md,
  },
  submitButtonText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700', marginLeft: Spacing.sm },
});