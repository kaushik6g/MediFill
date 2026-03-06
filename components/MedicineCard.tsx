import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  Layout,
  SlideOutLeft,
} from 'react-native-reanimated';
import {
  Pill,
  CircleAlert as AlertCircle,
  Calendar,
  Trash2,
  Edit3,
  X,
  Save,
  Clock,
  TrendingDown,
} from 'lucide-react-native';
import { Medicine, useMedicineContext } from '../context/MedicineContext';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../constants/theme';

interface MedicineCardProps {
  medicine: Medicine;
}

const MedicineCard: React.FC<MedicineCardProps> = ({ medicine }) => {
  const { deleteMedicine, updateMedicine } = useMedicineContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: medicine.name,
    dosage: medicine.dosage,
    currentQuantity: String(medicine.currentQuantity),
    notes: medicine.notes || '',
  });

  const daysUntilExpiry = () => {
    const expiryDate = new Date(medicine.expiryDate);
    const today = new Date();
    return Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const percentageRemaining = () =>
    (medicine.currentQuantity / medicine.totalQuantity) * 100;

  const isExpired = daysUntilExpiry() <= 0;
  const isExpiringSoon = daysUntilExpiry() <= 30 && daysUntilExpiry() > 0;
  const isRunningLow = percentageRemaining() <= 20;
  const hasInteractions =
    medicine.interactions && medicine.interactions.length > 0;

  const handleDelete = () => {
    Alert.alert(
      'Delete Medicine',
      `Are you sure you want to delete ${medicine.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: () => deleteMedicine(medicine.id),
          style: 'destructive',
        },
      ]
    );
  };

  const handleSaveEdit = () => {
    const qty = Number(editData.currentQuantity);
    if (isNaN(qty) || qty < 0 || qty > medicine.totalQuantity) {
      Alert.alert('Invalid', 'Current quantity must be between 0 and total quantity.');
      return;
    }

    updateMedicine({
      ...medicine,
      name: editData.name.trim() || medicine.name,
      dosage: editData.dosage.trim() || medicine.dosage,
      currentQuantity: qty,
      notes: editData.notes,
    });
    setIsEditing(false);
  };

  const getExpiryColor = () => {
    if (isExpired) return Colors.danger;
    if (isExpiringSoon) return Colors.warning;
    return Colors.success;
  };

  const getStockColor = () => {
    const pct = percentageRemaining();
    if (pct <= 10) return Colors.danger;
    if (pct <= 20) return Colors.warning;
    return Colors.primary;
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={SlideOutLeft.duration(300)}
      layout={Layout.springify()}
    >
      <TouchableOpacity style={styles.card} activeOpacity={0.95}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, isExpired && styles.iconContainerDanger]}>
            <Pill size={22} color={isExpired ? Colors.danger : Colors.primary} />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {medicine.name}
            </Text>
            <Text style={styles.subtitle}>{medicine.dosage}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
              <Edit3 size={16} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Trash2 size={16} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Row */}
        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Frequency</Text>
            <Text style={styles.infoValue}>{medicine.frequency}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Quantity</Text>
            <Text style={[styles.infoValue, { color: getStockColor() }]}>
              {medicine.currentQuantity} / {medicine.totalQuantity}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Expiry</Text>
            <Text style={[styles.infoValue, { color: getExpiryColor() }]}>
              {isExpired
                ? 'Expired'
                : `${daysUntilExpiry()}d left`}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${Math.min(percentageRemaining(), 100)}%`,
                backgroundColor: getStockColor(),
              },
            ]}
          />
        </View>

        {/* Schedule times */}
        {medicine.timeToTake && medicine.timeToTake.length > 0 && (
          <View style={styles.timesRow}>
            <Clock size={14} color={Colors.textTertiary} />
            <Text style={styles.timesText}>
              {medicine.timeToTake
                .map((t) => {
                  const [h, m] = t.split(':').map(Number);
                  const period = h >= 12 ? 'PM' : 'AM';
                  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
                })
                .join(', ')}
            </Text>
          </View>
        )}

        {/* Alerts */}
        {(isExpired || isExpiringSoon || isRunningLow || hasInteractions) && (
          <View style={styles.alertContainer}>
            {isExpired && (
              <View style={[styles.alert, styles.alertDanger]}>
                <Calendar size={14} color={Colors.danger} />
                <Text style={styles.alertTextDanger}>
                  Expired — dispose safely
                </Text>
              </View>
            )}
            {isExpiringSoon && !isExpired && (
              <View style={[styles.alert, styles.alertWarn]}>
                <Calendar size={14} color={Colors.warning} />
                <Text style={styles.alertTextWarn}>
                  Expires in {daysUntilExpiry()} days
                </Text>
              </View>
            )}
            {isRunningLow && (
              <View style={[styles.alert, styles.alertDanger]}>
                <TrendingDown size={14} color={Colors.danger} />
                <Text style={styles.alertTextDanger}>
                  Low stock ({Math.round(percentageRemaining())}%)
                </Text>
              </View>
            )}
            {hasInteractions && (
              <View style={[styles.alert, styles.alertDanger]}>
                <AlertCircle size={14} color={Colors.danger} />
                <Text style={styles.alertTextDanger}>
                  Interacts with: {medicine.interactions?.join(', ')}
                </Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* Edit Modal */}
      <Modal visible={isEditing} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Medicine</Text>
              <TouchableOpacity onPress={() => setIsEditing(false)}>
                <X size={24} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Name</Text>
              <TextInput
                style={styles.modalInput}
                value={editData.name}
                onChangeText={(v) => setEditData({ ...editData, name: v })}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Dosage</Text>
              <TextInput
                style={styles.modalInput}
                value={editData.dosage}
                onChangeText={(v) => setEditData({ ...editData, dosage: v })}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>
                Current Quantity (max {medicine.totalQuantity})
              </Text>
              <TextInput
                style={styles.modalInput}
                value={editData.currentQuantity}
                onChangeText={(v) =>
                  setEditData({ ...editData, currentQuantity: v })
                }
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Notes</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={editData.notes}
                onChangeText={(v) => setEditData({ ...editData, notes: v })}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
              <Save size={18} color={Colors.white} />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  iconContainer: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md,
  },
  iconContainerDanger: { backgroundColor: Colors.dangerLight },
  titleContainer: { flex: 1 },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  editButton: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  deleteButton: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.dangerLight,
    justifyContent: 'center', alignItems: 'center',
  },
  infoContainer: { flexDirection: 'row', marginBottom: Spacing.md },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginBottom: 2 },
  infoValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  progressBarContainer: {
    height: 6, backgroundColor: Colors.borderLight, borderRadius: 3,
    marginBottom: Spacing.sm, overflow: 'hidden',
  },
  progressBar: { height: '100%', borderRadius: 3 },
  timesRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs, marginBottom: Spacing.xs },
  timesText: { fontSize: FontSize.xs, color: Colors.textTertiary, marginLeft: Spacing.xs },
  alertContainer: { marginTop: Spacing.sm, gap: Spacing.xs },
  alert: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.sm,
  },
  alertDanger: { backgroundColor: Colors.dangerLight },
  alertWarn: { backgroundColor: Colors.warningLight },
  alertTextDanger: { fontSize: FontSize.xs, color: Colors.dangerDark, marginLeft: Spacing.xs, fontWeight: '500' },
  alertTextWarn: { fontSize: FontSize.xs, color: Colors.warning, marginLeft: Spacing.xs, fontWeight: '500' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl, padding: Spacing.xl,
    paddingBottom: Spacing.xxxxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  modalField: { marginBottom: Spacing.lg },
  modalLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs },
  modalInput: {
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary,
  },
  modalTextArea: { minHeight: 80, textAlignVertical: 'top' },
  saveButton: {
    flexDirection: 'row', backgroundColor: Colors.primary, borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg, alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.sm, ...Shadow.md,
  },
  saveButtonText: {
    color: Colors.white, fontSize: FontSize.md, fontWeight: '700', marginLeft: Spacing.sm,
  },
});

export default MedicineCard;