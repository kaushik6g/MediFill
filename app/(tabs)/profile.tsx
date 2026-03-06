import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  Settings,
  Bell,
  LogOut,
  ChevronRight,
  Shield,
  CircleHelp as HelpCircle,
  UserPlus,
  Pill,
  Trash2,
  X,
  Check,
  Users,
  Cloud,
  CloudOff,
  Pencil,
} from 'lucide-react-native';
import { useMedicineContext } from '../../context/MedicineContext';
import { useAuth } from '../../context/AuthContext';
import {
  Colors,
  Spacing,
  FontSize,
  BorderRadius,
  Shadow,
} from '../../constants/theme';

export default function ProfileScreen() {
  const { users, activeUser, medicines, setActiveUser, addUser, deleteUser, isSyncing } =
    useMedicineContext();
  const { user, profile, signOut, updateDisplayName } = useAuth();

  const [showUserModal, setShowUserModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [editName, setEditName] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [updatingName, setUpdatingName] = useState(false);

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  const handleUpdateName = async () => {
    if (!editName.trim()) return;
    setUpdatingName(true);
    try {
      await updateDisplayName(editName.trim());
      setShowNameModal(false);
      setEditName('');
    } catch {
      Alert.alert('Error', 'Failed to update name.');
    } finally {
      setUpdatingName(false);
    }
  };

  const handleUserSwitch = async (userId: string) => {
    await setActiveUser(userId);
    Alert.alert('Switched', 'Now managing medicines for this user.');
  };

  const handleAddUser = () => {
    if (!newName.trim()) {
      Alert.alert('Name required', 'Please enter a name for the new user.');
      return;
    }
    addUser({
      id: Date.now().toString(),
      name: newName.trim(),
      email: newEmail.trim() || `${newName.trim().toLowerCase().replace(/\s/g, '.')}@medifill.app`,
      isActive: false,
    });
    setNewName('');
    setNewEmail('');
    setShowUserModal(false);
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    Alert.alert('Delete User', `Remove ${userName}? Their data will be lost.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteUser(userId),
      },
    ]);
  };

  // Stats for active user
  const totalMeds = medicines.length;
  const activeMeds = medicines.filter((m) => {
    const d = Math.ceil(
      (new Date(m.expiryDate).getTime() - Date.now()) / 86400000
    );
    return d > 0 && m.currentQuantity > 0;
  }).length;

  const displayName = profile?.displayName || user?.displayName || 'User';
  const displayEmail = user?.email || '';
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : '';

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        {isSyncing ? (
          <View style={styles.syncBadge}>
            <Cloud size={14} color={Colors.primary} />
            <Text style={styles.syncText}>Syncing…</Text>
          </View>
        ) : (
          <View style={styles.syncBadge}>
            <Cloud size={14} color={Colors.success} />
            <Text style={[styles.syncText, { color: Colors.success }]}>Synced</Text>
          </View>
        )}
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Account Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.userCard}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {getInitials(displayName)}
              </Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{displayName}</Text>
              <TouchableOpacity
                style={styles.editNameBtn}
                onPress={() => {
                  setEditName(displayName === 'User' ? '' : displayName);
                  setShowNameModal(true);
                }}
              >
                <Pencil size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.userEmail}>{displayEmail}</Text>
            {memberSince ? (
              <Text style={styles.memberSince}>Member since {memberSince}</Text>
            ) : null}
          </View>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{totalMeds}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: Colors.success }]}>
                {activeMeds}
              </Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: Colors.accent }]}>
                {users.length}
              </Text>
              <Text style={styles.statLabel}>Profiles</Text>
            </View>
          </View>
        </Animated.View>

        {/* Settings */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Settings</Text>

          <MenuItem
            icon={<Users size={20} color={Colors.primary} />}
            text="Manage Profiles"
            onPress={() => setShowUserModal(true)}
            badge={String(users.length)}
          />
          <MenuItem
            icon={<Bell size={20} color={Colors.primary} />}
            text="Notifications"
          />
          <MenuItem
            icon={<Shield size={20} color={Colors.primary} />}
            text="Privacy & Security"
          />
          <MenuItem
            icon={<HelpCircle size={20} color={Colors.primary} />}
            text="Help & Support"
          />
          <MenuItem
            icon={<Settings size={20} color={Colors.primary} />}
            text="App Settings"
            isLast
          />
        </Animated.View>

        {/* About */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(400)}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>2.0.0</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Built with</Text>
            <Text style={styles.aboutValue}>React Native + Expo</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Cloud sync</Text>
            <Text style={styles.aboutValue}>Firebase</Text>
          </View>
        </Animated.View>

        {/* Logout */}
        <Animated.View entering={FadeInDown.delay(350).duration(400)}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? (
              <ActivityIndicator size="small" color={Colors.danger} />
            ) : (
              <LogOut size={18} color={Colors.danger} />
            )}
            <Text style={styles.logoutText}>
              {signingOut ? 'Signing Out…' : 'Sign Out'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* User Management Modal */}
      <Modal visible={showUserModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Profiles</Text>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <X size={24} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Current Users */}
            <ScrollView style={{ maxHeight: 280 }}>
              {users.map((u) => (
                <View key={u.id} style={styles.userRow}>
                  {u.avatar ? (
                    <Image source={{ uri: u.avatar }} style={styles.userRowAvatar} />
                  ) : (
                    <View style={styles.userRowAvatarPlaceholder}>
                      <Text style={styles.userRowAvatarText}>
                        {getInitials(u.name)}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userRowName}>{u.name}</Text>
                    <Text style={styles.userRowEmail}>{u.email}</Text>
                  </View>
                  {u.isActive ? (
                    <View style={styles.activeBadge}>
                      <Check size={14} color={Colors.success} />
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  ) : (
                    <View style={styles.userRowActions}>
                      <TouchableOpacity
                        style={styles.switchBtn}
                        onPress={() => handleUserSwitch(u.id)}
                      >
                        <Text style={styles.switchBtnText}>Switch</Text>
                      </TouchableOpacity>
                      {users.length > 1 && (
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => handleDeleteUser(u.id, u.name)}
                        >
                          <Trash2 size={14} color={Colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            {/* Add New User */}
            <View style={styles.addUserSection}>
              <Text style={styles.addUserTitle}>Add New Profile</Text>
              <TextInput
                style={styles.addInput}
                placeholder="Name"
                placeholderTextColor={Colors.textTertiary}
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                style={styles.addInput}
                placeholder="Email (optional)"
                placeholderTextColor={Colors.textTertiary}
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.addUserBtn, !newName.trim() && { opacity: 0.5 }]}
                onPress={handleAddUser}
                disabled={!newName.trim()}
              >
                <UserPlus size={16} color={Colors.white} />
                <Text style={styles.addUserBtnText}>Add Profile</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Edit Display Name Modal */}
      <Modal visible={showNameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[styles.modalContent, { maxHeight: '40%' }]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Name</Text>
              <TouchableOpacity onPress={() => setShowNameModal(false)}>
                <X size={24} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.addInput}
              placeholder="Display name"
              placeholderTextColor={Colors.textTertiary}
              value={editName}
              onChangeText={setEditName}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.addUserBtn, (!editName.trim() || updatingName) && { opacity: 0.5 }]}
              onPress={handleUpdateName}
              disabled={!editName.trim() || updatingName}
            >
              {updatingName ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Check size={16} color={Colors.white} />
              )}
              <Text style={styles.addUserBtnText}>
                {updatingName ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MenuItem({
  icon,
  text,
  onPress,
  badge,
  isLast,
}: {
  icon: React.ReactNode;
  text: string;
  onPress?: () => void;
  badge?: string;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, !isLast && styles.menuItemBorder]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={styles.menuIcon}>{icon}</View>
      <Text style={styles.menuText}>{text}</Text>
      {badge && (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{badge}</Text>
        </View>
      )}
      <ChevronRight size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.xl,
    gap: 4,
    ...Shadow.sm,
  },
  syncText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  editNameBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberSince: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  // User Card
  userCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.xxl,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadow.sm,
  },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: Colors.primary },
  userInfo: { alignItems: 'center', marginTop: Spacing.md },
  userName: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  userEmail: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 2 },
  statsContainer: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  statItem: { alignItems: 'center', paddingHorizontal: Spacing.lg },
  statDivider: { width: 1, backgroundColor: Colors.border },
  statNumber: { fontSize: 20, fontWeight: '700', color: Colors.primary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  // Section
  section: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.xxl,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  // Menu
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  menuText: { flex: 1, fontSize: FontSize.md, color: Colors.textSecondary },
  menuBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: Spacing.sm,
  },
  menuBadgeText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  // About
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  aboutLabel: { fontSize: FontSize.sm, color: Colors.textTertiary },
  aboutValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '500' },
  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dangerLight,
    marginHorizontal: Spacing.xxl,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  logoutText: {
    color: Colors.danger,
    fontWeight: '600',
    fontSize: FontSize.md,
    marginLeft: Spacing.sm,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxxl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  // User rows
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  userRowAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: Spacing.md },
  userRowAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  userRowAvatarText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  userRowName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  userRowEmail: { fontSize: FontSize.xs, color: Colors.textTertiary },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  activeBadgeText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: '600' },
  userRowActions: { flexDirection: 'row', gap: Spacing.sm },
  switchBtn: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  switchBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  deleteBtn: {
    backgroundColor: Colors.dangerLight,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Add user
  addUserSection: {
    marginTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.lg,
  },
  addUserTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  addInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  addUserBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  addUserBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
});