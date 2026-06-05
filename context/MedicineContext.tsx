import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { findInteractionsForMedicine, MEDICINE_INTERACTIONS } from '../constants/interactions';
import type { UserProfile } from './AuthContext';
import {
  saveMedicineToCloud,
  saveAllMedicinesToCloud,
  deleteMedicineFromCloud,
  subscribeMedicines,
} from '../services/firestoreSync';
import {
  scheduleMedicineReminders,
  cancelMedicineReminders,
} from '../services/notificationService';

export interface Medicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  totalQuantity: number;
  currentQuantity: number;
  expiryDate: string;
  notes?: string;
  createdAt: string;
  interactions?: string[];
  timeToTake?: string[];
}

export interface Alert {
  id: string;
  type: 'expiry' | 'stock' | 'interaction' | 'reminder';
  title: string;
  description: string;
  medicineIds: string[];
  createdAt: string;
  read: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isActive: boolean;
}

interface MedicineContextType {
  medicines: Medicine[];
  alerts: Alert[];
  users: User[];
  activeUser: User | null;
  isSyncing: boolean;
  addMedicine: (medicine: Medicine) => Promise<void>;
  updateMedicine: (medicine: Medicine) => Promise<void>;
  deleteMedicine: (id: string) => Promise<void>;
  loadMedicines: () => Promise<void>;
  markAlertAsRead: (id: string) => Promise<void>;
  getInteractionAlerts: () => Alert[];
  getExpiryAlerts: () => Alert[];
  getStockAlerts: () => Alert[];
  addUser: (user: User) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  setActiveUser: (userId: string) => Promise<void>;
}

const PLACEHOLDER_USERS: User[] = [
  { id: 'auth', name: 'Me', email: '', isActive: true },
];

function profileToUser(profile: UserProfile): User {
  return {
    id: 'auth',
    name: profile.displayName || profile.email?.split('@')[0] || 'Me',
    email: profile.email ?? '',
    avatar: profile.photoURL,
    isActive: true,
  };
}

// ── Per-profile storage keys ───────────────────────────────────────────────────
const medicinesKey = (profileId: string) => `medicines_${profileId}`;
const alertsKey    = (profileId: string) => `alerts_${profileId}`;
const alertIdsKey  = (profileId: string) => `processedAlertIds_${profileId}`;

const MedicineContext = createContext<MedicineContextType | undefined>(undefined);

export const useMedicineContext = () => {
  const context = useContext(MedicineContext);
  if (!context) throw new Error('useMedicineContext must be used within a MedicineProvider');
  return context;
};

export const MedicineProvider: React.FC<{
  children: React.ReactNode;
  firebaseUid?: string | null;
  userProfile?: UserProfile | null;
}> = ({ children, firebaseUid, userProfile }) => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [users, setUsers] = useState<User[]>(PLACEHOLDER_USERS);
  const [activeUser, setActiveUserState] = useState<User | null>(PLACEHOLDER_USERS[0]);
  const [processedAlertIds, setProcessedAlertIds] = useState<Set<string>>(new Set());
  const [isGeneratingAlerts, setIsGeneratingAlerts] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // ── Active profile ID helper ──────────────────────────────────────────────
  const activeProfileId = activeUser?.id ?? 'auth';

  // ── Load medicines for a specific profile ─────────────────────────────────
  const loadMedicinesForProfile = useCallback(async (profileId: string) => {
    try {
      // Migrate old key on first load for the auth user
      if (profileId === 'auth') {
        const legacy = await AsyncStorage.getItem('medicines');
        if (legacy) {
          const parsed: Medicine[] = JSON.parse(legacy);
          if (parsed.length > 0) {
            await AsyncStorage.setItem(medicinesKey('auth'), legacy);
            await AsyncStorage.removeItem('medicines'); // clean up legacy key
          }
        }
      }
      const stored = await AsyncStorage.getItem(medicinesKey(profileId));
      setMedicines(stored ? JSON.parse(stored) : []);
    } catch (e) {
      console.error('Error loading medicines for profile:', e);
      setMedicines([]);
    }
  }, []);

  const loadAlertsForProfile = useCallback(async (profileId: string) => {
    try {
      const stored = await AsyncStorage.getItem(alertsKey(profileId));
      if (stored) {
        const parsed: Alert[] = JSON.parse(stored);
        const unique = Array.from(new Map(parsed.map(a => [a.id, a])).values());
        setAlerts(unique);
      } else {
        setAlerts([]);
      }
      const storedIds = await AsyncStorage.getItem(alertIdsKey(profileId));
      setProcessedAlertIds(storedIds ? new Set(JSON.parse(storedIds)) : new Set());
    } catch (e) {
      console.error('Error loading alerts for profile:', e);
      setAlerts([]);
      setProcessedAlertIds(new Set());
    }
  }, []);

  // ── Sync real auth user into first slot ───────────────────────────────────
  useEffect(() => {
    if (!userProfile) return;
    const authUser = profileToUser(userProfile);
    setUsers(prev => {
      const rest = prev.filter(u => u.id !== 'auth');
      return [authUser, ...rest];
    });
    setActiveUserState(prev => (prev?.id === 'auth' || prev === null ? authUser : prev));
  }, [userProfile]);

  // ── When activeUser changes, reload their medicines + alerts ──────────────
  useEffect(() => {
    if (!activeUser) return;
    loadMedicinesForProfile(activeUser.id);
    loadAlertsForProfile(activeUser.id);
  }, [activeUser?.id]);

  // ── Load users list from storage ──────────────────────────────────────────
  useEffect(() => {
    loadUsers();
  }, []);

  // ── Firestore real-time sync (auth user only) ─────────────────────────────
  useEffect(() => {
    if (!firebaseUid) return;

    (async () => {
      const stored = await AsyncStorage.getItem(medicinesKey('auth'));
      if (stored) {
        const local: Medicine[] = JSON.parse(stored);
        if (local.length > 0) {
          setIsSyncing(true);
          await saveAllMedicinesToCloud(firebaseUid, local);
          setIsSyncing(false);
        }
      }
    })();

    const unsubscribe = subscribeMedicines(
      firebaseUid,
      cloudMedicines => {
        if (cloudMedicines.length > 0 && activeUser?.id === 'auth') {
          setMedicines(cloudMedicines as Medicine[]);
          AsyncStorage.setItem(medicinesKey('auth'), JSON.stringify(cloudMedicines));
        }
      },
      error => console.warn('Firestore sync error:', error)
    );

    return () => unsubscribe();
  }, [firebaseUid]);

  // ── Alert generation whenever medicines change ────────────────────────────
  useEffect(() => {
    if (medicines.length > 0) generateAlerts();
  }, [medicines]);

  // ── Storage helpers ───────────────────────────────────────────────────────
  const saveMedicines = async (updated: Medicine[]) => {
    await AsyncStorage.setItem(medicinesKey(activeProfileId), JSON.stringify(updated));
  };

  const saveAlerts = async (updated: Alert[]) => {
    const unique = Array.from(new Map(updated.map(a => [a.id, a])).values());
    await AsyncStorage.setItem(alertsKey(activeProfileId), JSON.stringify(unique));
  };

  const saveProcessedAlertIds = async (ids: Set<string>) => {
    await AsyncStorage.setItem(alertIdsKey(activeProfileId), JSON.stringify([...ids]));
  };

  const loadUsers = async () => {
    try {
      const stored = await AsyncStorage.getItem('users');
      if (stored) {
        const parsed: User[] = JSON.parse(stored);
        const extra = parsed.filter(u => u.id !== 'auth' && u.id !== '1' && u.id !== '2' && u.id !== '3');
        if (extra.length > 0) {
          setUsers(prev => {
            const authSlot = prev.find(u => u.id === 'auth');
            return authSlot ? [authSlot, ...extra] : [...PLACEHOLDER_USERS, ...extra];
          });
        }
      }
    } catch (e) {
      console.error('Error loading users:', e);
    }
  };

  const saveUsers = async (updated: User[]) => {
    await AsyncStorage.setItem('users', JSON.stringify(updated));
  };

  // ── Public load (for pull-to-refresh) ────────────────────────────────────
  const loadMedicines = async () => {
    await loadMedicinesForProfile(activeProfileId);
  };

  // ── Medicine CRUD ──────────────────────────────────────────────────────────
  const addMedicine = async (medicine: Medicine) => {
    const existingNames = medicines.map(m => m.name);
    const interactions = findInteractionsForMedicine(medicine.name, existingNames);
    const med = { ...medicine, interactions: interactions.length > 0 ? interactions : undefined };

    const updated = [...medicines, med];
    setMedicines(updated);
    await saveMedicines(updated);

    if (firebaseUid && activeUser?.id === 'auth') {
      saveMedicineToCloud(firebaseUid, med);
    }

    if (medicine.timeToTake?.length) {
      scheduleMedicineReminders({
        medicineId: medicine.id,
        medicineName: medicine.name,
        dosage: medicine.dosage,
        times: medicine.timeToTake,
      });
    }
  };

  const updateMedicine = async (updatedMedicine: Medicine) => {
    const old = medicines.find(m => m.id === updatedMedicine.id);
    if (old?.timeToTake?.length) cancelMedicineReminders(old.id, old.timeToTake);

    const updated = medicines.map(m => m.id === updatedMedicine.id ? updatedMedicine : m);
    setMedicines(updated);
    await saveMedicines(updated);

    if (firebaseUid && activeUser?.id === 'auth') {
      saveMedicineToCloud(firebaseUid, updatedMedicine);
    }

    if (updatedMedicine.timeToTake?.length) {
      scheduleMedicineReminders({
        medicineId: updatedMedicine.id,
        medicineName: updatedMedicine.name,
        dosage: updatedMedicine.dosage,
        times: updatedMedicine.timeToTake,
      });
    }
  };

  const deleteMedicine = async (id: string) => {
    const med = medicines.find(m => m.id === id);
    if (med?.timeToTake?.length) cancelMedicineReminders(id, med.timeToTake);

    const updated = medicines.filter(m => m.id !== id);
    setMedicines(updated);
    await saveMedicines(updated);

    if (firebaseUid && activeUser?.id === 'auth') {
      deleteMedicineFromCloud(firebaseUid, id);
    }

    const updatedAlerts = alerts.filter(a => !a.medicineIds.includes(id));
    setAlerts(updatedAlerts);
    await saveAlerts(updatedAlerts);

    const newIds = new Set(processedAlertIds);
    [...processedAlertIds].filter(aid => aid.includes(id)).forEach(aid => newIds.delete(aid));
    setProcessedAlertIds(newIds);
    await saveProcessedAlertIds(newIds);
  };

  const markAlertAsRead = async (id: string) => {
    const updated = alerts.map(a => a.id === id ? { ...a, read: true } : a);
    setAlerts(updated);
    await saveAlerts(updated);
  };

  // ── User management ───────────────────────────────────────────────────────
  const addUser = async (user: User) => {
    const updated = [...users, user];
    setUsers(updated);
    await saveUsers(updated);
  };

  const updateUser = async (updatedUser: User) => {
    const updated = users.map(u => u.id === updatedUser.id ? updatedUser : u);
    setUsers(updated);
    await saveUsers(updated);
    if (activeUser?.id === updatedUser.id) setActiveUserState(updatedUser);
  };

  const deleteUser = async (id: string) => {
    if (users.length <= 1) return;
    // Clean up their medicine storage
    await AsyncStorage.removeItem(medicinesKey(id));
    await AsyncStorage.removeItem(alertsKey(id));
    await AsyncStorage.removeItem(alertIdsKey(id));

    const updated = users.filter(u => u.id !== id);
    setUsers(updated);
    await saveUsers(updated);

    if (activeUser?.id === id) {
      await switchActiveUser(updated[0].id, updated);
    }
  };

  // ── Core profile switch logic ─────────────────────────────────────────────
  const switchActiveUser = async (userId: string, userList: User[] = users) => {
    const target = userList.find(u => u.id === userId);
    if (!target) return;

    const updated = userList.map(u => ({ ...u, isActive: u.id === userId }));
    setUsers(updated);
    setActiveUserState(target);
    await saveUsers(updated);
    await AsyncStorage.setItem('activeUserId', userId);

    // Load medicines + alerts for the new profile
    await loadMedicinesForProfile(userId);
    await loadAlertsForProfile(userId);
  };

  const setActiveUser = async (userId: string) => switchActiveUser(userId);

  // ── Alert generation ──────────────────────────────────────────────────────
  const findInteractions = (name: string): string[] =>
    findInteractionsForMedicine(name, medicines.map(m => m.name));

  const generateAlerts = async () => {
    if (isGeneratingAlerts) return;
    setIsGeneratingAlerts(true);

    try {
      const newAlerts: Alert[] = [];
      const currentProcessedIds = new Set(processedAlertIds);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      medicines.forEach(medicine => {
        const expiryDate = new Date(medicine.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / 86400000);

        // ── Already expired alert ──
        if (diffDays < 0) {
          const expiredAlertId = `expired-${medicine.id}`;
          if (!currentProcessedIds.has(expiredAlertId)) {
            newAlerts.push({
              id: expiredAlertId, type: 'expiry',
              title: 'Medicine Expired',
              description: `${medicine.name} expired ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} ago and has been removed from your schedule.`,
              medicineIds: [medicine.id],
              createdAt: new Date().toISOString(), read: false,
            });
            currentProcessedIds.add(expiredAlertId);
          }
          return; // skip all other alerts for expired medicines
        }

        // ── Expiring soon alert (1–30 days) ──
        const expiryAlertId = `expiry-${medicine.id}-${diffDays}`;
        if (!currentProcessedIds.has(expiryAlertId) && diffDays > 0 && diffDays <= 30) {
          const dailyUsage = calculateDailyUsage(medicine.frequency);
          const daysOfSupply = medicine.currentQuantity / dailyUsage;
          const desc = diffDays < daysOfSupply
            ? `${medicine.name} will expire in ${diffDays} days. ~${Math.round(medicine.currentQuantity - dailyUsage * diffDays)} units will be wasted.`
            : `${medicine.name} will expire in ${diffDays} days.`;
          const title = diffDays < daysOfSupply ? 'Medicine Will Expire Before Use' : 'Medicine Expiring Soon';

          newAlerts.push({ id: expiryAlertId, type: 'expiry', title, description: desc, medicineIds: [medicine.id], createdAt: new Date().toISOString(), read: false });
          currentProcessedIds.add(expiryAlertId);
        }

        // ── Low stock alert (skip if already zero) ──
        const pct = (medicine.currentQuantity / medicine.totalQuantity) * 100;
        const stockAlertId = `stock-${medicine.id}-${Math.round(pct)}`;
        if (!currentProcessedIds.has(stockAlertId) && pct <= 20 && medicine.currentQuantity > 0) {
          newAlerts.push({ id: stockAlertId, type: 'stock', title: 'Medicine Running Low', description: `${medicine.name} is running low (${Math.round(pct)}% remaining).`, medicineIds: [medicine.id], createdAt: new Date().toISOString(), read: false });
          currentProcessedIds.add(stockAlertId);
        }

        // ── Out of stock alert ──
        if (medicine.currentQuantity === 0) {
          const emptyId = `empty-${medicine.id}`;
          if (!currentProcessedIds.has(emptyId)) {
            newAlerts.push({ id: emptyId, type: 'stock', title: 'Medicine Out of Stock', description: `${medicine.name} is out of stock. Please refill your prescription.`, medicineIds: [medicine.id], createdAt: new Date().toISOString(), read: false });
            currentProcessedIds.add(emptyId);
          }
        }
      });

      const checkedPairs = new Set<string>();
      medicines.forEach(m1 => {
        medicines.forEach(m2 => {
          if (m1.id === m2.id) return;
          const pairKey = [m1.id, m2.id].sort().join('-');
          const iid = `interaction-${pairKey}`;
          if (!checkedPairs.has(pairKey) && !currentProcessedIds.has(iid)) {
            checkedPairs.add(pairKey);
            const m1Ints = MEDICINE_INTERACTIONS[m1.name.toLowerCase()] || [];
            if (m1Ints.includes(m2.name.toLowerCase())) {
              newAlerts.push({ id: iid, type: 'interaction', title: 'Medicine Interaction Warning', description: `${m1.name} and ${m2.name} may interact. Please consult your doctor.`, medicineIds: [m1.id, m2.id], createdAt: new Date().toISOString(), read: false });
              currentProcessedIds.add(iid);
            }
          }
        });
      });

      // ── Reminder alerts — only for active (non-expired, in-stock) medicines ──
      const now = new Date();
      medicines.forEach(medicine => {
        // Skip expired or empty medicines
        const expiry = new Date(medicine.expiryDate);
        expiry.setHours(0, 0, 0, 0);
        if (expiry < today || medicine.currentQuantity <= 0) return;

        medicine.timeToTake?.forEach(time => {
          const [hours, minutes] = time.split(':').map(Number);
          const reminderTime = new Date();
          reminderTime.setHours(hours, minutes, 0, 0);
          const rid = `reminder-${medicine.id}-${time}-${now.toISOString().split('T')[0]}`;
          if (!currentProcessedIds.has(rid)) {
            const diff = Math.floor(Math.abs(now.getTime() - reminderTime.getTime()) / 60000);
            if (diff <= 60 && now.getTime() >= reminderTime.getTime()) {
              newAlerts.push({ id: rid, type: 'reminder', title: 'Time to Take Medicine', description: `It's time to take ${medicine.name} (${medicine.dosage}).`, medicineIds: [medicine.id], createdAt: new Date().toISOString(), read: false });
              currentProcessedIds.add(rid);
            }
          }
        });
      });

      if (newAlerts.length > 0) {
        const all = [...alerts, ...newAlerts];
        const unique = Array.from(new Map(all.map(a => [a.id, a])).values());
        setAlerts(unique);
        await saveAlerts(unique);
        setProcessedAlertIds(currentProcessedIds);
        await saveProcessedAlertIds(currentProcessedIds);
      }
    } catch (e) {
      console.error('Error generating alerts:', e);
    } finally {
      setIsGeneratingAlerts(false);
    }
  };

  const calculateDailyUsage = (frequency: string): number => {
    const f = frequency.toLowerCase();
    if (f.includes('twice daily') || f.includes('two times')) return 2;
    if (f.includes('three times')) return 3;
    if (f.includes('four times')) return 4;
    if (f.includes('every other day') || f.includes('alternate day')) return 0.5;
    if (f.includes('weekly') || f.includes('once a week')) return 1 / 7;
    return 1;
  };

  const getInteractionAlerts = () => alerts.filter(a => a.type === 'interaction');
  const getExpiryAlerts = () => alerts.filter(a => a.type === 'expiry');
  const getStockAlerts = () => alerts.filter(a => a.type === 'stock');

  return (
    <MedicineContext.Provider
      value={{
        medicines,
        alerts,
        users,
        activeUser,
        isSyncing,
        addMedicine,
        updateMedicine,
        deleteMedicine,
        loadMedicines,
        markAlertAsRead,
        getInteractionAlerts,
        getExpiryAlerts,
        getStockAlerts,
        addUser,
        updateUser,
        deleteUser,
        setActiveUser,
      }}
    >
      {children}
    </MedicineContext.Provider>
  );
};