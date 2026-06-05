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
  Switch,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';
import {
  Bell,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Shield,
  CircleHelp as HelpCircle,
  UserPlus,
  Pill,
  Trash2,
  X,
  Check,
  Users,
  Cloud,
  Pencil,
  Settings,
  Mail,
  Star,
  MessageCircle,
  Lock,
  Eye,
  EyeOff,
  Smartphone,
  Info,
} from 'lucide-react-native';
import { useMedicineContext } from '../../context/MedicineContext';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../constants/theme';
import TimePickerModal from '../../components/TimePickerModal';

// ── Types ─────────────────────────────────────────────────────────────────────
type View =
  | 'main'
  | 'profiles'
  | 'notifications'
  | 'privacy'
  | 'help'
  | 'appSettings';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Row({
  icon,
  iconBg,
  label,
  value,
  onPress,
  right,
  danger,
  noBorder,
}: {
  icon: React.ReactNode;
  iconBg?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  noBorder?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, noBorder && styles.rowNoBorder]}
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg ?? Colors.primaryLight }]}>
        {icon}
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, danger && { color: Colors.danger }]}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={16} color={Colors.textMuted} /> : null)}
    </TouchableOpacity>
  );
}

function ToggleRow({
  icon,
  iconBg,
  label,
  subtitle,
  value,
  onChange,
  noBorder,
}: {
  icon: React.ReactNode;
  iconBg?: string;
  label: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  noBorder?: boolean;
}) {
  return (
    <View style={[styles.row, noBorder && styles.rowNoBorder]}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg ?? Colors.primaryLight }]}>
        {icon}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowValue}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor={Colors.white}
      />
    </View>
  );
}

function SubHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <Animated.View entering={FadeInRight.duration(250)} style={styles.subHeader}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <ChevronLeft size={20} color={Colors.primary} />
      </TouchableOpacity>
      <Text style={styles.subHeaderTitle}>{title}</Text>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const {
    users, activeUser, medicines,
    setActiveUser, addUser, deleteUser, isSyncing,
  } = useMedicineContext();
  const { user, profile, signOut, updateDisplayName } = useAuth();

  const [currentView, setCurrentView] = useState<View>('main');

  // Modals
  const [showNameModal, setShowNameModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [updatingName, setUpdatingName] = useState(false);

  // Add-profile form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Notification prefs
  const [notifReminders, setNotifReminders] = useState(true);
  const [notifExpiry, setNotifExpiry] = useState(true);
  const [notifStock, setNotifStock] = useState(true);
  const [notifInteractions, setNotifInteractions] = useState(true);

  // Do Not Disturb
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndStart, setDndStart] = useState('22:00'); // 10:00 PM
  const [dndEnd, setDndEnd] = useState('07:00');   // 7:00 AM
  const [showDndPicker, setShowDndPicker] = useState<'start' | 'end' | null>(null);

  // Format HH:MM → h:MM AM/PM
  const fmt12 = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return t;
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  // App settings
  const [darkMode, setDarkMode] = useState(false);
  const [biometrics, setBiometrics] = useState(false);
  const [autoSync, setAutoSync] = useState(true);

  // Privacy
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [crashReports, setCrashReports] = useState(true);

  // ── Computed ────────────────────────────────────────────────────────────
  const totalMeds = medicines.length;
  const activeMeds = medicines.filter(m => {
    const d = Math.ceil((new Date(m.expiryDate).getTime() - Date.now()) / 86400000);
    return d > 0 && m.currentQuantity > 0;
  }).length;
  const lowStockMeds = medicines.filter(m => (m.currentQuantity / m.totalQuantity) <= 0.2).length;

  const isViewingOtherProfile = activeUser && activeUser.id !== 'auth';
  const displayName = profile?.displayName || (user?.user_metadata?.display_name as string) || 'User';
  const displayEmail = user?.email || profile?.email || '';
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try { await signOut(); }
          catch { Alert.alert('Error', 'Failed to sign out. Please try again.'); }
          finally { setSigningOut(false); }
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

  const handleAddUser = () => {
    if (!newName.trim()) {
      Alert.alert('Name required', 'Please enter a name for the new profile.');
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
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    Alert.alert('Delete Profile', `Remove ${userName}? Their medicine data will be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteUser(userId) },
    ]);
  };

  const handleUserSwitch = async (userId: string) => {
    await setActiveUser(userId);
  };

  // ── View renderers ───────────────────────────────────────────────────────

  // ─── Notifications View ─────────────────────────────────────────────────
  const renderNotifications = () => (
    <Animated.View entering={FadeInRight.duration(280)}>
      <SectionLabel text="Reminders" />
      <Card>
        <ToggleRow
          icon={<Bell size={16} color={Colors.primary} />}
          label="Dose Reminders"
          subtitle="Get notified when it's time to take your medicine"
          value={notifReminders}
          onChange={setNotifReminders}
        />
        <ToggleRow
          icon={<Bell size={16} color={Colors.warning} />}
          iconBg={Colors.warningLight}
          label="Expiry Alerts"
          subtitle="Warn me 30 days before medicines expire"
          value={notifExpiry}
          onChange={setNotifExpiry}
        />
        <ToggleRow
          icon={<Bell size={16} color={Colors.danger} />}
          iconBg={Colors.dangerLight}
          label="Low Stock Alerts"
          subtitle="Alert when stock falls below 20%"
          value={notifStock}
          onChange={setNotifStock}
        />
        <ToggleRow
          icon={<Bell size={16} color={Colors.accent} />}
          iconBg={Colors.accentLight}
          label="Interaction Warnings"
          subtitle="Notify me of potential drug interactions"
          value={notifInteractions}
          onChange={setNotifInteractions}
          noBorder
        />
      </Card>

      <SectionLabel text="Quiet Hours" />
      <Card>
        <ToggleRow
          icon={<Bell size={16} color={Colors.textTertiary} />}
          iconBg={Colors.surfaceSecondary}
          label="Do Not Disturb"
          subtitle={dndEnabled ? `${fmt12(dndStart)} – ${fmt12(dndEnd)}` : 'Disabled'}
          value={dndEnabled}
          onChange={setDndEnabled}
          noBorder
        />
        {dndEnabled && (
          <View style={styles.dndTimeRow}>
            <View style={styles.dndTimeBlock}>
              <Text style={styles.dndTimeLabel}>From</Text>
              <TouchableOpacity
                style={styles.dndTimeBtn}
                onPress={() => setShowDndPicker('start')}
              >
                <Bell size={13} color={Colors.primary} />
                <Text style={styles.dndTimeBtnText}>{fmt12(dndStart)}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.dndTimeSep}>—</Text>
            <View style={styles.dndTimeBlock}>
              <Text style={styles.dndTimeLabel}>Until</Text>
              <TouchableOpacity
                style={styles.dndTimeBtn}
                onPress={() => setShowDndPicker('end')}
              >
                <Bell size={13} color={Colors.primary} />
                <Text style={styles.dndTimeBtnText}>{fmt12(dndEnd)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Card>
    </Animated.View>
  );

  // DND time picker modal (rendered at root so it sits above everything)
  const renderDndPickerModal = () => (
    <TimePickerModal
      visible={showDndPicker !== null}
      initialTime={showDndPicker === 'start' ? dndStart : dndEnd}
      onConfirm={(time) => {
        if (showDndPicker === 'start') setDndStart(time);
        else setDndEnd(time);
        setShowDndPicker(null);
      }}
      onCancel={() => setShowDndPicker(null)}
    />
  );

  // ─── Privacy View ────────────────────────────────────────────────────────
  const renderPrivacy = () => (
    <Animated.View entering={FadeInRight.duration(280)}>
      <SectionLabel text="Data & Analytics" />
      <Card>
        <ToggleRow
          icon={<Eye size={16} color={Colors.primary} />}
          label="Usage Analytics"
          subtitle="Help us improve the app with anonymous data"
          value={analyticsEnabled}
          onChange={setAnalyticsEnabled}
        />
        <ToggleRow
          icon={<Shield size={16} color={Colors.success} />}
          iconBg={Colors.successLight}
          label="Crash Reports"
          subtitle="Automatically send crash logs to our team"
          value={crashReports}
          onChange={setCrashReports}
          noBorder
        />
      </Card>

      <SectionLabel text="Account" />
      <Card>
        <Row
          icon={<Lock size={16} color={Colors.primary} />}
          label="Change Password"
          onPress={() =>
            Alert.alert(
              'Change Password',
              'A password reset link will be sent to your email.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Send Link',
                  onPress: () =>
                    Alert.alert('Email Sent', 'Check your inbox for the reset link.'),
                },
              ]
            )
          }
        />
        <Row
          icon={<EyeOff size={16} color={Colors.danger} />}
          iconBg={Colors.dangerLight}
          label="Delete Account"
          danger
          noBorder
          onPress={() =>
            Alert.alert(
              'Delete Account',
              'This will permanently delete your account and all data. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete', style: 'destructive',
                  onPress: () =>
                    Alert.alert('Contact Support', 'Please email support@medifill.app to delete your account.'),
                },
              ]
            )
          }
        />
      </Card>
    </Animated.View>
  );

  // ─── Help View ────────────────────────────────────────────────────────────
  const renderHelp = () => (
    <Animated.View entering={FadeInRight.duration(280)}>
      <SectionLabel text="Support" />
      <Card>
        <Row
          icon={<Mail size={16} color={Colors.primary} />}
          label="Email Support"
          value="We're working on it 🚧"
          onPress={() =>
            Alert.alert(
              'Coming Soon',
              "In-app support chat is coming soon. Stay tuned!",
              [{ text: 'OK' }]
            )
          }
        />
        <Row
          icon={<MessageCircle size={16} color={Colors.accent} />}
          iconBg={Colors.accentLight}
          label="Send Feedback"
          value="We're working on it 🚧"
          onPress={() =>
            Alert.alert(
              'Coming Soon',
              "An in-app feedback form is on the way!",
              [{ text: 'OK' }]
            )
          }
        />
        <Row
          icon={<Star size={16} color={Colors.warning} />}
          iconBg={Colors.warningLight}
          label="Rate MediFill"
          value="Enjoying the app? Leave a review!"
          noBorder
          onPress={() => {
            // Opens Play Store on Android, App Store on iOS
            const storeUrl =
              'https://play.google.com/store/apps/details?id=com.medifill.app';
            Linking.openURL(storeUrl).catch(() =>
              Alert.alert('Error', 'Could not open the store. Please search “MediFill” in your app store.')
            );
          }}
        />
      </Card>

      <SectionLabel text="Legal" />
      <Card>
        <Row
          icon={<Shield size={16} color={Colors.textTertiary} />}
          iconBg={Colors.surfaceSecondary}
          label="Privacy Policy"
          value="We're working on it 🚧"
          onPress={() =>
            Alert.alert(
              'Coming Soon',
              "Our Privacy Policy is being finalized. We'll notify you when it's live.",
              [{ text: 'OK' }]
            )
          }
        />
        <Row
          icon={<Info size={16} color={Colors.textTertiary} />}
          iconBg={Colors.surfaceSecondary}
          label="Terms of Service"
          value="We're working on it 🚧"
          noBorder
          onPress={() =>
            Alert.alert(
              'Coming Soon',
              "Our Terms of Service are being finalized. We'll notify you when they're live.",
              [{ text: 'OK' }]
            )
          }
        />
      </Card>
    </Animated.View>
  );

  // ─── App Settings View ────────────────────────────────────────────────────
  const renderAppSettings = () => (
    <Animated.View entering={FadeInRight.duration(280)}>
      <SectionLabel text="Appearance" />
      <Card>
        <ToggleRow
          icon={<Settings size={16} color={Colors.textTertiary} />}
          iconBg={Colors.surfaceSecondary}
          label="Dark Mode"
          subtitle="Coming soon"
          value={darkMode}
          onChange={v => {
            setDarkMode(v);
            if (v) Alert.alert('Dark Mode', 'Dark mode is coming in the next update!');
          }}
          noBorder
        />
      </Card>

      <SectionLabel text="Security" />
      <Card>
        <ToggleRow
          icon={<Smartphone size={16} color={Colors.primary} />}
          label="Biometric Lock"
          subtitle="Use Face ID / fingerprint to unlock"
          value={biometrics}
          onChange={v => {
            setBiometrics(v);
            if (v) Alert.alert('Biometrics', 'Biometric authentication will be available in a future update.');
          }}
          noBorder
        />
      </Card>

      <SectionLabel text="Sync" />
      <Card>
        <ToggleRow
          icon={<Cloud size={16} color={Colors.primary} />}
          label="Automatic Sync"
          subtitle="Keep your medicines synced to the cloud"
          value={autoSync}
          onChange={setAutoSync}
          noBorder
        />
      </Card>

      <SectionLabel text="Data" />
      <Card>
        <Row
          icon={<Trash2 size={16} color={Colors.danger} />}
          iconBg={Colors.dangerLight}
          label="Clear Local Cache"
          danger
          noBorder
          onPress={() =>
            Alert.alert(
              'Clear Cache',
              'This will remove cached data but keep your synced medicines.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: () => Alert.alert('Done', 'Cache cleared.') },
              ]
            )
          }
        />
      </Card>
    </Animated.View>
  );

  // ─── Profiles View ────────────────────────────────────────────────────────
  const renderProfiles = () => (
    <Animated.View entering={FadeInRight.duration(280)}>
      <SectionLabel text="Profiles" />
      <Card>
        {users.map((u, idx) => (
          <View key={u.id} style={[styles.profileRow, idx === users.length - 1 && styles.rowNoBorder]}>
            <View style={styles.profileAvatar}>
              {u.avatar ? (
                <Image source={{ uri: u.avatar }} style={styles.profileAvatarImg} />
              ) : (
                <Text style={styles.profileAvatarText}>{getInitials(u.name)}</Text>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{u.name}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{u.email}</Text>
            </View>
            <View style={styles.profileActions}>
              {u.isActive ? (
                <View style={styles.activePill}>
                  <Check size={11} color={Colors.success} />
                  <Text style={styles.activePillText}>Active</Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.switchPill}
                    onPress={() => handleUserSwitch(u.id)}
                  >
                    <Text style={styles.switchPillText}>Switch</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deletePill}
                    onPress={() => handleDeleteUser(u.id, u.name)}
                  >
                    <Trash2 size={13} color={Colors.danger} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ))}
      </Card>

      <SectionLabel text="Add New Profile" />
      <Card>
        <TextInput
          style={styles.input}
          placeholder="Full name *"
          placeholderTextColor={Colors.textMuted}
          value={newName}
          onChangeText={setNewName}
        />
        <TextInput
          style={[styles.input, { marginBottom: Spacing.md }]}
          placeholder="Email (optional)"
          placeholderTextColor={Colors.textMuted}
          value={newEmail}
          onChangeText={setNewEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.addBtn, !newName.trim() && { opacity: 0.4 }]}
          onPress={handleAddUser}
          disabled={!newName.trim()}
        >
          <UserPlus size={16} color={Colors.white} />
          <Text style={styles.addBtnText}>Add Profile</Text>
        </TouchableOpacity>
      </Card>
    </Animated.View>
  );

  // ─── Main View ────────────────────────────────────────────────────────────
  const renderMain = () => (
    <Animated.View entering={FadeInDown.duration(250)}>
      {/* Active profile banner */}
      {isViewingOtherProfile && (
        <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.activeBanner}>
          <Users size={14} color={Colors.white} />
          <Text style={styles.activeBannerText}>
            Viewing {activeUser?.name}'s medicines
          </Text>
          <TouchableOpacity style={styles.switchBackBtn} onPress={() => setActiveUser('auth')}>
            <Text style={styles.switchBackText}>Switch back</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Profile hero card */}
      <Animated.View entering={FadeInDown.delay(80).duration(380)} style={styles.heroCard}>
        {/* Avatar */}
        <View style={styles.heroAvatarWrap}>
          {profile?.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.heroAvatar} />
          ) : (
            <View style={styles.heroAvatarFallback}>
              <Text style={styles.heroAvatarText}>{getInitials(displayName)}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.editAvatarBtn}
            onPress={() => {
              setEditName(displayName === 'User' ? '' : displayName);
              setShowNameModal(true);
            }}
          >
            <Pencil size={13} color={Colors.white} />
          </TouchableOpacity>
        </View>

        <Text style={styles.heroName}>{displayName}</Text>
        <Text style={styles.heroEmail}>{displayEmail}</Text>
        {memberSince ? (
          <Text style={styles.heroSince}>Member since {memberSince}</Text>
        ) : null}

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{totalMeds}</Text>
            <Text style={styles.statLbl}>Medicines</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={[styles.statNum, { color: Colors.success }]}>{activeMeds}</Text>
            <Text style={styles.statLbl}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={[styles.statNum, { color: lowStockMeds > 0 ? Colors.danger : Colors.textMuted }]}>
              {lowStockMeds}
            </Text>
            <Text style={styles.statLbl}>Low Stock</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={[styles.statNum, { color: Colors.accent }]}>{users.length}</Text>
            <Text style={styles.statLbl}>Profiles</Text>
          </View>
        </View>
      </Animated.View>

      {/* Settings section */}
      <Animated.View entering={FadeInDown.delay(160).duration(380)}>
        <SectionLabel text="Account" />
        <Card>
          <Row
            icon={<Users size={16} color={Colors.primary} />}
            label="Manage Profiles"
            value={`${users.length} profile${users.length !== 1 ? 's' : ''}`}
            onPress={() => setCurrentView('profiles')}
          />
          <Row
            icon={<Bell size={16} color={Colors.warning} />}
            iconBg={Colors.warningLight}
            label="Notifications"
            value={notifReminders ? 'On' : 'Off'}
            onPress={() => setCurrentView('notifications')}
          />
          <Row
            icon={<Shield size={16} color={Colors.accent} />}
            iconBg={Colors.accentLight}
            label="Privacy & Security"
            onPress={() => setCurrentView('privacy')}
            noBorder
          />
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).duration(380)}>
        <SectionLabel text="Preferences" />
        <Card>
          <Row
            icon={<Settings size={16} color={Colors.textTertiary} />}
            iconBg={Colors.surfaceSecondary}
            label="App Settings"
            onPress={() => setCurrentView('appSettings')}
          />
          <Row
            icon={<HelpCircle size={16} color={Colors.textTertiary} />}
            iconBg={Colors.surfaceSecondary}
            label="Help & Support"
            onPress={() => setCurrentView('help')}
            noBorder
          />
        </Card>
      </Animated.View>

      {/* About */}
      <Animated.View entering={FadeInDown.delay(280).duration(380)}>
        <SectionLabel text="About" />
        <Card>
          <Row
            icon={<Pill size={16} color={Colors.primary} />}
            label="Version"
            right={<Text style={styles.rowValue}>2.0.0</Text>}
            noBorder
          />
        </Card>
      </Animated.View>

      {/* Sign out */}
      <Animated.View entering={FadeInDown.delay(340).duration(380)} style={{ marginBottom: 40 }}>
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator size="small" color={Colors.danger} />
          ) : (
            <LogOut size={18} color={Colors.danger} />
          )}
          <Text style={styles.signOutText}>{signingOut ? 'Signing out…' : 'Sign Out'}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );

  const viewTitles: Record<View, string> = {
    main: 'Profile',
    profiles: 'Manage Profiles',
    notifications: 'Notifications',
    privacy: 'Privacy & Security',
    help: 'Help & Support',
    appSettings: 'App Settings',
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        {currentView !== 'main' ? (
          <SubHeader title={viewTitles[currentView]} onBack={() => setCurrentView('main')} />
        ) : (
          <Animated.View entering={FadeIn.duration(300)} style={styles.mainHeader}>
            <Text style={styles.mainHeaderTitle}>Profile</Text>
            <View style={styles.syncChip}>
              <Cloud size={12} color={isSyncing ? Colors.primary : Colors.success} />
              <Text style={[styles.syncChipText, { color: isSyncing ? Colors.primary : Colors.success }]}>
                {isSyncing ? 'Syncing' : 'Synced'}
              </Text>
            </View>
          </Animated.View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {currentView === 'main' && renderMain()}
        {currentView === 'profiles' && renderProfiles()}
        {currentView === 'notifications' && renderNotifications()}
        {currentView === 'privacy' && renderPrivacy()}
        {currentView === 'help' && renderHelp()}
        {currentView === 'appSettings' && renderAppSettings()}
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal visible={showNameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInDown.duration(280)} style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Edit Display Name</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowNameModal(false)}
              >
                <X size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={Colors.textMuted}
              value={editName}
              onChangeText={setEditName}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.addBtn, (!editName.trim() || updatingName) && { opacity: 0.4 }]}
              onPress={handleUpdateName}
              disabled={!editName.trim() || updatingName}
            >
              {updatingName ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Check size={16} color={Colors.white} />
              )}
              <Text style={styles.addBtnText}>{updatingName ? 'Saving…' : 'Save Name'}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* DND Time Picker */}
      {renderDndPickerModal()}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F7F6' },
  scroll: { paddingHorizontal: Spacing.xxl, paddingBottom: 32 },

  // DND time row
  dndTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  dndTimeBlock: { alignItems: 'center', gap: 6 },
  dndTimeLabel: {
    fontSize: FontSize.xs, fontWeight: '600',
    color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  dndTimeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  dndTimeBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  dndTimeSep: { fontSize: 18, fontWeight: '700', color: Colors.textMuted, marginTop: 22 },

  // Top bar
  topBar: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  mainHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  mainHeaderTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  syncChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.white, paddingHorizontal: Spacing.md,
    paddingVertical: 6, borderRadius: BorderRadius.full, ...Shadow.sm,
  },
  syncChipText: { fontSize: FontSize.xs, fontWeight: '700' },

  // Sub-header
  subHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center',
    ...Shadow.sm,
  },
  subHeaderTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },

  // Section label
  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: '700', color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: Spacing.xl, marginBottom: Spacing.sm,
  },

  // Card
  card: {
    backgroundColor: Colors.white, borderRadius: 18,
    paddingHorizontal: Spacing.lg, ...Shadow.sm,
  },

  // Active banner
  activeBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14, padding: Spacing.md,
    gap: Spacing.sm, marginTop: Spacing.md,
  },
  activeBannerText: { flex: 1, fontSize: FontSize.xs, fontWeight: '600', color: Colors.white },
  switchBackBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: BorderRadius.full,
  },
  switchBackText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },

  // Hero card
  heroCard: {
    backgroundColor: Colors.white, borderRadius: 22,
    padding: Spacing.xxl, alignItems: 'center',
    marginTop: Spacing.md, ...Shadow.md,
  },
  heroAvatarWrap: { position: 'relative', marginBottom: Spacing.md },
  heroAvatar: { width: 80, height: 80, borderRadius: 40 },
  heroAvatarFallback: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  heroAvatarText: { fontSize: 28, fontWeight: '800', color: Colors.primary },
  editAvatarBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  heroName: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  heroEmail: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 3 },
  heroSince: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  statsStrip: {
    flexDirection: 'row', marginTop: Spacing.xl,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 14, paddingVertical: Spacing.md,
    width: '100%',
  },
  statCell: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary },
  statLbl: { fontSize: 10, color: Colors.textTertiary, fontWeight: '600', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  rowNoBorder: { borderBottomWidth: 0 },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginRight: Spacing.md,
  },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  rowValue: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 1 },

  // Profile row (in Manage Profiles)
  profileRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    gap: Spacing.sm,
  },
  profileAvatar: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  profileAvatarImg: { width: 44, height: 44, borderRadius: 14 },
  profileAvatarText: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  profileInfo: { flex: 1 },
  profileName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  profileEmail: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 1 },
  profileActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.successLight, paddingHorizontal: Spacing.sm,
    paddingVertical: 5, borderRadius: BorderRadius.full,
  },
  activePillText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success },
  switchPill: {
    backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.md,
    paddingVertical: 7, borderRadius: BorderRadius.full,
  },
  switchPillText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  deletePill: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.dangerLight,
    justifyContent: 'center', alignItems: 'center',
  },

  // Input & button
  input: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md, fontSize: FontSize.md,
    color: Colors.textPrimary, marginBottom: Spacing.sm,
  },
  addBtn: {
    flexDirection: 'row', backgroundColor: Colors.primary,
    borderRadius: 14, paddingVertical: Spacing.md,
    alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, ...Shadow.sm,
  },
  addBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },

  // Sign out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.dangerLight, borderRadius: 16,
    paddingVertical: Spacing.lg, gap: Spacing.sm, marginTop: Spacing.xl,
    borderWidth: 1, borderColor: Colors.danger + '33',
  },
  signOutText: { color: Colors.danger, fontWeight: '700', fontSize: FontSize.md },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.xxl, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg,
  },
  modalHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  modalCloseBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center',
  },
});