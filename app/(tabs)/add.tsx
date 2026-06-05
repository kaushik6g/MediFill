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
  Plus,
  X,
  FileText,
  ChevronRight,
} from 'lucide-react-native';
import { useMedicineContext } from '../../context/MedicineContext';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '../../components/DateTimePicker';
import TimePickerModal from '../../components/TimePickerModal';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../constants/theme';

// ── Constants ─────────────────────────────────────────────────────────────────
const FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every other day',
  'Once a week',
  'As needed',
];

// ── Section header helper ─────────────────────────────────────────────────────
function SectionCard({
  title,
  icon,
  delay = 0,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>{icon}</View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </Animated.View>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({
  label,
  required,
  error,
  errorMsg,
  children,
}: {
  label: string;
  required?: boolean;
  error?: boolean;
  errorMsg?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
      {error && errorMsg && <Text style={styles.errorText}>⚠ {errorMsg}</Text>}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
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

  // ── Apply OCR params (unchanged) ──────────────────────────────────────────
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
        if (!isNaN(date.getTime())) setExpiryDate(date);
      } catch (_) {}
    }
    if (params.ocrRawText) {
      setNotes(`Scanned text:\n${params.ocrRawText}`);
    }
  }, [params.ocrName, params.ocrDosage, params.ocrQuantity, params.ocrExpiry]);

  // ── Scan / image handlers (unchanged) ─────────────────────────────────────
  const handleScanMedicine = () => router.push('/camera');

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
      Alert.alert('Error', 'There was an error. Please try again.');
    }
  };

  // ── Validation (unchanged) ─────────────────────────────────────────────────
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
    return !Object.values(newErrors).some(Boolean);
  };

  // ── Time helpers (unchanged) ───────────────────────────────────────────────
  const handleAddTimeToTake = () => setTimesToTake([...timesToTake, '12:00']);
  const handleRemoveTimeToTake = (index: number) => {
    const t = [...timesToTake];
    t.splice(index, 1);
    setTimesToTake(t);
  };
  const handleTimeChange = (index: number, time: string) => {
    const t = [...timesToTake];
    t[index] = time;
    setTimesToTake(t);
  };
  const handleTimePickerOpen = (index: number) => {
    setCurrentTimeIndex(index);
    setShowTimePicker(true);
  };
  // handleTimePickerChange is now handled by TimePickerModal's onConfirm

  // ── Submit (unchanged) ─────────────────────────────────────────────────────
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

  // ── Progress indicator ─────────────────────────────────────────────────────
  const filledCount = [name, dosage, frequency, totalQuantity, currentQuantity].filter(Boolean).length;
  const progress = filledCount / 5;

  // ── Format HH:MM → "H:MM AM/PM" for display ───────────────────────────────
  const formatDisplayTime = (t: string) => {
    if (!t || !t.includes(':')) return t;
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return t;
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <View>
            <Text style={styles.title}>Add Medicine</Text>
            <Text style={styles.subtitle}>Scan a label or enter details manually</Text>
          </View>
          {/* Form completion indicator */}
          <View style={styles.progressWrap}>
            <Text style={styles.progressLabel}>{Math.round(progress * 100)}%</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
            </View>
          </View>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Scan banner ── */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <TouchableOpacity style={styles.scanCard} onPress={handleScanMedicine} activeOpacity={0.85}>
              <View style={styles.scanLeft}>
                <View style={styles.scanIconBg}>
                  <ScanLine size={26} color={Colors.white} />
                </View>
                <View>
                  <Text style={styles.scanTitle}>Scan Medicine Label</Text>
                  <Text style={styles.scanSub}>Auto-fill details with your camera</Text>
                </View>
              </View>
              <View style={styles.scanArrow}>
                <Camera size={16} color={Colors.white} />
                <ChevronRight size={16} color={Colors.white} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Divider */}
          <Animated.View entering={FadeInDown.delay(120).duration(300)} style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or fill in manually</Text>
            <View style={styles.orLine} />
          </Animated.View>

          {/* ── Section 1: Basic Info ── */}
          <SectionCard
            title="Basic Information"
            icon={<Pill size={16} color={Colors.primary} />}
            delay={160}
          >
            <Field label="Medicine Name" required error={errors.name} errorMsg="Medicine name is required">
              <View style={[styles.inputRow, errors.name && styles.inputRowError]}>
                <Pill size={16} color={errors.name ? Colors.danger : Colors.textTertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Paracetamol, Amoxicillin"
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </Field>

            <Field label="Dosage" required error={errors.dosage} errorMsg="Dosage is required">
              <View style={[styles.inputRow, errors.dosage && styles.inputRowError]}>
                <TextInput
                  style={[styles.input, { paddingLeft: 0 }]}
                  placeholder="e.g., 500mg, 5ml, 10mcg"
                  placeholderTextColor={Colors.textMuted}
                  value={dosage}
                  onChangeText={setDosage}
                />
              </View>
            </Field>
          </SectionCard>

          {/* ── Section 2: Schedule ── */}
          <SectionCard
            title="Schedule"
            icon={<Clock size={16} color={Colors.primary} />}
            delay={220}
          >
            {/* Frequency pills */}
            <Field label="Frequency" required error={errors.frequency} errorMsg="Please select a frequency">
              <View style={styles.pillGrid}>
                {FREQUENCY_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.freqPill, frequency === opt && styles.freqPillActive]}
                    onPress={() => setFrequency(opt)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.freqPillText, frequency === opt && styles.freqPillTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>

            {/* Time chips */}
            <Field label="Times to Take">
              <View style={styles.timeChipsWrap}>
                {timesToTake.map((time, index) => (
                  <View key={`t-${index}`} style={styles.timeChip}>
                    <TouchableOpacity
                      style={styles.timeChipInner}
                      onPress={() => handleTimePickerOpen(index)}
                    >
                      <Clock size={13} color={Colors.primary} />
                      <Text style={styles.timeChipText}>
                        {formatDisplayTime(time)}
                      </Text>
                    </TouchableOpacity>
                    {timesToTake.length > 1 && (
                      <TouchableOpacity
                        style={styles.timeChipRemove}
                        onPress={() => handleRemoveTimeToTake(index)}
                      >
                        <X size={12} color={Colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity style={styles.addTimeChip} onPress={handleAddTimeToTake}>
                  <Plus size={14} color={Colors.primary} />
                  <Text style={styles.addTimeChipText}>Add</Text>
                </TouchableOpacity>
              </View>
            </Field>
          </SectionCard>

          {/* ── Section 3: Quantity & Expiry ── */}
          <SectionCard
            title="Quantity & Expiry"
            icon={<Package size={16} color={Colors.primary} />}
            delay={280}
          >
            <View style={styles.qtyRow}>
              <Field
                label="Total Qty"
                required
                error={errors.totalQuantity}
                errorMsg="Required"
              >
                <View style={[styles.inputRow, errors.totalQuantity && styles.inputRowError]}>
                  <Package size={16} color={errors.totalQuantity ? Colors.danger : Colors.textTertiary} />
                  <TextInput
                    style={styles.input}
                    placeholder="30"
                    placeholderTextColor={Colors.textMuted}
                    value={totalQuantity}
                    onChangeText={setTotalQuantity}
                    keyboardType="numeric"
                  />
                </View>
              </Field>
              <View style={styles.qtyDivider} />
              <Field
                label="Current Qty"
                required
                error={errors.currentQuantity}
                errorMsg="Must be ≤ total"
              >
                <View style={[styles.inputRow, errors.currentQuantity && styles.inputRowError]}>
                  <Package size={16} color={errors.currentQuantity ? Colors.danger : Colors.textTertiary} />
                  <TextInput
                    style={styles.input}
                    placeholder="28"
                    placeholderTextColor={Colors.textMuted}
                    value={currentQuantity}
                    onChangeText={setCurrentQuantity}
                    keyboardType="numeric"
                  />
                </View>
              </Field>
            </View>

            {/* Stock bar preview */}
            {totalQuantity && currentQuantity && !isNaN(Number(totalQuantity)) && !isNaN(Number(currentQuantity)) && (
              <View style={styles.stockPreview}>
                <Text style={styles.stockPreviewLabel}>
                  Stock level: {Math.round((Number(currentQuantity) / Number(totalQuantity)) * 100)}%
                </Text>
                <View style={styles.stockTrack}>
                  <View
                    style={[
                      styles.stockFill,
                      {
                        width: `${Math.min(100, (Number(currentQuantity) / Number(totalQuantity)) * 100)}%` as any,
                        backgroundColor:
                          Number(currentQuantity) / Number(totalQuantity) <= 0.2
                            ? Colors.danger
                            : Number(currentQuantity) / Number(totalQuantity) <= 0.5
                            ? Colors.warning
                            : Colors.success,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            <Field label="Expiry Date" required>
              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={16} color={Colors.primary} />
                <Text style={[styles.input, { color: Colors.textPrimary, paddingVertical: Spacing.md }]}>
                  {expiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={expiryDate}
                  mode="date"
                  display="default"
                  onChange={(_event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) setExpiryDate(selectedDate);
                  }}
                />
              )}
            </Field>
          </SectionCard>

          {/* ── Section 4: Notes ── */}
          <SectionCard
            title="Notes"
            icon={<FileText size={16} color={Colors.primary} />}
            delay={340}
          >
            <TextInput
              style={styles.textArea}
              placeholder="Side effects, special instructions, or doctor's notes…"
              placeholderTextColor={Colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </SectionCard>

          {/* ── Submit ── */}
          <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.submitWrap}>
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} activeOpacity={0.85}>
              <Pill size={20} color={Colors.white} />
              <Text style={styles.submitText}>Add Medicine</Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Custom Time Picker Modal ── */}
      <TimePickerModal
        visible={showTimePicker}
        initialTime={timesToTake[currentTimeIndex] ?? '08:00'}
        onConfirm={(time) => {
          handleTimeChange(currentTimeIndex, time);
          setShowTimePicker(false);
        }}
        onCancel={() => setShowTimePicker(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F7F6' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xxl, paddingBottom: 20 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4 },
  subtitle: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },

  // Progress
  progressWrap: { alignItems: 'flex-end', gap: 4 },
  progressLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  progressTrack: { width: 56, height: 5, borderRadius: 3, backgroundColor: Colors.border },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: Colors.primary },

  // Scan card
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  scanLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  scanIconBg: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  scanTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  scanSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  scanArrow: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  // Or divider
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md, gap: Spacing.md },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500' },

  // Section card
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sectionIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },

  // Field
  field: { marginBottom: Spacing.lg },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textTertiary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  required: { color: Colors.danger },
  errorText: { fontSize: FontSize.xs, color: Colors.danger, marginTop: 4 },

  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    minHeight: 50,
    gap: Spacing.sm,
  },
  inputRowError: { borderColor: Colors.danger },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, paddingVertical: Spacing.md },

  // Frequency pills
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  freqPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  freqPillActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  freqPillText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textTertiary },
  freqPillTextActive: { color: Colors.primary },

  // Time chips
  timeChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'center' },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    overflow: 'hidden',
  },
  timeChipInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 8, gap: 6 },
  timeChipText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  timeChipRemove: { paddingHorizontal: Spacing.sm, paddingVertical: 8, borderLeftWidth: 1, borderLeftColor: Colors.primary },
  addTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    gap: 4,
  },
  addTimeChipText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  // Quantity row
  qtyRow: { flexDirection: 'row', gap: Spacing.md },
  qtyDivider: { width: 1, backgroundColor: Colors.borderLight, marginTop: 22 },

  // Stock preview
  stockPreview: { marginBottom: Spacing.lg },
  stockPreviewLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500', marginBottom: 6 },
  stockTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.borderLight },
  stockFill: { height: 6, borderRadius: 3 },

  // Text area
  textArea: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    minHeight: 100,
  },

  // Submit
  submitWrap: { marginTop: Spacing.sm },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadow.md,
  },
  submitText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700', letterSpacing: 0.3 },
});