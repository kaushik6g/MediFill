import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { findInteractionsForMedicine, MEDICINE_INTERACTIONS } from '../constants/interactions';
import {
  saveMedicineToCloud,
  saveAllMedicinesToCloud,
  deleteMedicineFromCloud,
  subscribeMedicines,
} from '../services/firestoreSync';
import {
  scheduleMedicineReminders,
  cancelMedicineReminders,
  sendInstantNotification,
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
  interactions?: string[]; // List of medicine names that interact with this medicine
  timeToTake?: string[]; // Array of times to take the medicine
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

// Medicine interactions are now imported from constants/interactions.ts

// Default users
const DEFAULT_USERS: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john.doe@example.com',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    isActive: true,
  },
  {
    id: '2',
    name: 'Mom',
    email: 'mom@example.com',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    isActive: false,
  },
  {
    id: '3',
    name: 'Dad',
    email: 'dad@example.com',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    isActive: false,
  }
];

const MedicineContext = createContext<MedicineContextType | undefined>(undefined);

export const useMedicineContext = () => {
  const context = useContext(MedicineContext);
  if (!context) {
    throw new Error('useMedicineContext must be used within a MedicineProvider');
  }
  return context;
};

export const MedicineProvider: React.FC<{ children: React.ReactNode; firebaseUid?: string | null }> = ({ children, firebaseUid }) => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [users, setUsers] = useState<User[]>(DEFAULT_USERS);
  const [activeUser, setActiveUser] = useState<User | null>(DEFAULT_USERS[0]);
  const [processedAlertIds, setProcessedAlertIds] = useState<Set<string>>(new Set());
  const [isGeneratingAlerts, setIsGeneratingAlerts] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load data from storage on initial render
  useEffect(() => {
    loadMedicines();
    loadAlerts();
    loadUsers();
  }, []);

  // ── Firestore real-time sync ───────────────────────────────────────────────
  useEffect(() => {
    if (!firebaseUid) return;

    // Upload current local medicines to cloud on first auth
    (async () => {
      const storedMedicines = await AsyncStorage.getItem('medicines');
      if (storedMedicines) {
        const local: Medicine[] = JSON.parse(storedMedicines);
        if (local.length > 0) {
          setIsSyncing(true);
          await saveAllMedicinesToCloud(firebaseUid, local);
          setIsSyncing(false);
        }
      }
    })();

    // Subscribe to cloud changes
    const unsubscribe = subscribeMedicines(
      firebaseUid,
      (cloudMedicines) => {
        // Merge: cloud is source of truth when online
        if (cloudMedicines.length > 0) {
          setMedicines(cloudMedicines as Medicine[]);
          AsyncStorage.setItem('medicines', JSON.stringify(cloudMedicines));
        }
      },
      (error) => console.warn('Firestore sync error:', error)
    );

    return () => unsubscribe();
  }, [firebaseUid]);

  // Generate alerts whenever medicines change
  useEffect(() => {
    if (medicines.length > 0) {
      generateAlerts();
    }
  }, [medicines]);

  const loadMedicines = async () => {
    try {
      const storedMedicines = await AsyncStorage.getItem('medicines');
      if (storedMedicines) {
        setMedicines(JSON.parse(storedMedicines));
      }
    } catch (error) {
      console.error('Error loading medicines:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      const storedAlerts = await AsyncStorage.getItem('alerts');
      if (storedAlerts) {
        // Ensure alerts have unique IDs to prevent duplicate keys
        const parsedAlerts = JSON.parse(storedAlerts);
        const uniqueAlerts = Array.from(
          new Map(parsedAlerts.map((alert: Alert) => [alert.id, alert])).values()
        );
        setAlerts(uniqueAlerts);
      }
      
      const storedProcessedAlertIds = await AsyncStorage.getItem('processedAlertIds');
      if (storedProcessedAlertIds) {
        setProcessedAlertIds(new Set(JSON.parse(storedProcessedAlertIds)));
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const storedUsers = await AsyncStorage.getItem('users');
      if (storedUsers) {
        setUsers(JSON.parse(storedUsers));
      } else {
        // If no users are stored, save the default users
        await AsyncStorage.setItem('users', JSON.stringify(DEFAULT_USERS));
      }
      
      const activeUserId = await AsyncStorage.getItem('activeUserId');
      if (activeUserId) {
        const active = DEFAULT_USERS.find(user => user.id === activeUserId) || DEFAULT_USERS[0];
        setActiveUser(active);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const saveMedicines = async (updatedMedicines: Medicine[]) => {
    try {
      await AsyncStorage.setItem('medicines', JSON.stringify(updatedMedicines));
    } catch (error) {
      console.error('Error saving medicines:', error);
    }
  };

  const saveAlerts = async (updatedAlerts: Alert[]) => {
    try {
      // Ensure alerts have unique IDs before saving
      const uniqueAlerts = Array.from(
        new Map(updatedAlerts.map(alert => [alert.id, alert])).values()
      );
      await AsyncStorage.setItem('alerts', JSON.stringify(uniqueAlerts));
    } catch (error) {
      console.error('Error saving alerts:', error);
    }
  };

  const saveProcessedAlertIds = async (ids: Set<string>) => {
    try {
      await AsyncStorage.setItem('processedAlertIds', JSON.stringify([...ids]));
    } catch (error) {
      console.error('Error saving processed alert IDs:', error);
    }
  };

  const saveUsers = async (updatedUsers: User[]) => {
    try {
      await AsyncStorage.setItem('users', JSON.stringify(updatedUsers));
    } catch (error) {
      console.error('Error saving users:', error);
    }
  };

  const addMedicine = async (medicine: Medicine) => {
    // Check for interactions with existing medicines
    const interactions = findInteractions(medicine.name);
    const medicineWithInteractions = {
      ...medicine,
      interactions: interactions.length > 0 ? interactions : undefined
    };
    
    const updatedMedicines = [...medicines, medicineWithInteractions];
    setMedicines(updatedMedicines);
    await saveMedicines(updatedMedicines);

    // Sync to Firestore
    if (firebaseUid) {
      saveMedicineToCloud(firebaseUid, medicineWithInteractions);
    }

    // Schedule push notifications for medicine reminder times
    if (medicine.timeToTake && medicine.timeToTake.length > 0) {
      scheduleMedicineReminders({
        medicineId: medicine.id,
        medicineName: medicine.name,
        dosage: medicine.dosage,
        times: medicine.timeToTake,
      });
    }
  };

  const updateMedicine = async (updatedMedicine: Medicine) => {
    // Cancel old reminders before scheduling new ones
    const oldMedicine = medicines.find(m => m.id === updatedMedicine.id);
    if (oldMedicine?.timeToTake && oldMedicine.timeToTake.length > 0) {
      cancelMedicineReminders(oldMedicine.id, oldMedicine.timeToTake);
    }

    const updatedMedicines = medicines.map(medicine => 
      medicine.id === updatedMedicine.id ? updatedMedicine : medicine
    );
    setMedicines(updatedMedicines);
    await saveMedicines(updatedMedicines);

    // Sync to Firestore
    if (firebaseUid) {
      saveMedicineToCloud(firebaseUid, updatedMedicine);
    }

    // Schedule new reminders
    if (updatedMedicine.timeToTake && updatedMedicine.timeToTake.length > 0) {
      scheduleMedicineReminders({
        medicineId: updatedMedicine.id,
        medicineName: updatedMedicine.name,
        dosage: updatedMedicine.dosage,
        times: updatedMedicine.timeToTake,
      });
    }
  };

  const deleteMedicine = async (id: string) => {
    // Cancel scheduled notifications for this medicine
    const medicine = medicines.find(m => m.id === id);
    if (medicine?.timeToTake && medicine.timeToTake.length > 0) {
      cancelMedicineReminders(id, medicine.timeToTake);
    }

    // Remove the medicine from the medicines list
    const updatedMedicines = medicines.filter(medicine => medicine.id !== id);
    setMedicines(updatedMedicines);
    await saveMedicines(updatedMedicines);
    
    // Sync to Firestore
    if (firebaseUid) {
      deleteMedicineFromCloud(firebaseUid, id);
    }
    
    // Remove any alerts related to this medicine
    const updatedAlerts = alerts.filter(alert => {
      // Keep alerts that don't reference this medicine at all
      return !alert.medicineIds.includes(id);
    });
    
    setAlerts(updatedAlerts);
    await saveAlerts(updatedAlerts);
    
    // Also clean up any processed alert IDs that might reference this medicine
    const newProcessedIds = new Set(processedAlertIds);
    for (const alertId of processedAlertIds) {
      if (alertId.includes(id)) {
        newProcessedIds.delete(alertId);
      }
    }
    
    setProcessedAlertIds(newProcessedIds);
    await saveProcessedAlertIds(newProcessedIds);
  };

  const markAlertAsRead = async (id: string) => {
    const updatedAlerts = alerts.map(alert => 
      alert.id === id ? { ...alert, read: true } : alert
    );
    setAlerts(updatedAlerts);
    await saveAlerts(updatedAlerts);
  };

  const addUser = async (user: User) => {
    const updatedUsers = [...users, user];
    setUsers(updatedUsers);
    await saveUsers(updatedUsers);
  };

  const updateUser = async (updatedUser: User) => {
    const updatedUsers = users.map(user => 
      user.id === updatedUser.id ? updatedUser : user
    );
    setUsers(updatedUsers);
    await saveUsers(updatedUsers);
    
    // If the active user was updated, update the active user state
    if (activeUser && activeUser.id === updatedUser.id) {
      setActiveUser(updatedUser);
    }
  };

  const deleteUser = async (id: string) => {
    // Don't allow deleting the last user
    if (users.length <= 1) {
      return;
    }
    
    const updatedUsers = users.filter(user => user.id !== id);
    setUsers(updatedUsers);
    await saveUsers(updatedUsers);
    
    // If the active user was deleted, set the first user as active
    if (activeUser && activeUser.id === id) {
      const newActiveUser = updatedUsers[0];
      setActiveUser(newActiveUser);
      await AsyncStorage.setItem('activeUserId', newActiveUser.id);
      
      // Update isActive flags
      const usersWithActiveFlag = updatedUsers.map(user => ({
        ...user,
        isActive: user.id === newActiveUser.id
      }));
      setUsers(usersWithActiveFlag);
      await saveUsers(usersWithActiveFlag);
    }
  };

  const setActiveUserById = async (userId: string) => {
    // Update the active user
    const user = users.find(u => u.id === userId);
    if (user) {
      // Update isActive flags for all users
      const updatedUsers = users.map(u => ({
        ...u,
        isActive: u.id === userId
      }));
      
      setUsers(updatedUsers);
      setActiveUser(user);
      await saveUsers(updatedUsers);
      await AsyncStorage.setItem('activeUserId', userId);
    }
  };

  // Find medicines that interact with the given medicine
  const findInteractions = (medicineName: string): string[] => {
    const existingNames = medicines.map(m => m.name);
    return findInteractionsForMedicine(medicineName, existingNames);
  };

  // Generate alerts based on medicine data
  const generateAlerts = async () => {
    // Prevent multiple simultaneous alert generations
    if (isGeneratingAlerts) return;
    setIsGeneratingAlerts(true);
    
    try {
      const newAlerts: Alert[] = [];
      const today = new Date();
      const currentProcessedIds = new Set(processedAlertIds);
      
      // Check for expiry alerts
      medicines.forEach(medicine => {
        const expiryDate = new Date(medicine.expiryDate);
        const diffTime = expiryDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Generate a unique ID for this alert
        const expiryAlertId = `expiry-${medicine.id}-${diffDays}`;
        
        // Only create the alert if we haven't processed it before
        if (!currentProcessedIds.has(expiryAlertId)) {
          // Alert if medicine will expire within 30 days
          if (diffDays > 0 && diffDays <= 30) {
            // Calculate if medicine will be used up before expiry
            const dailyUsage = calculateDailyUsage(medicine.frequency);
            const daysOfSupply = medicine.currentQuantity / dailyUsage;
            
            if (diffDays < daysOfSupply) {
              // Medicine will expire before it's used up
              const wasteAmount = Math.round(medicine.currentQuantity - (dailyUsage * diffDays));
              
              newAlerts.push({
                id: expiryAlertId,
                type: 'expiry',
                title: 'Medicine Will Expire Before Use',
                description: `${medicine.name} will expire in ${diffDays} days. Approximately ${wasteAmount} ${wasteAmount === 1 ? 'unit' : 'units'} will be wasted.`,
                medicineIds: [medicine.id],
                createdAt: new Date().toISOString(),
                read: false,
              });
            } else {
              // Standard expiry alert
              newAlerts.push({
                id: expiryAlertId,
                type: 'expiry',
                title: 'Medicine Expiring Soon',
                description: `${medicine.name} will expire in ${diffDays} days.`,
                medicineIds: [medicine.id],
                createdAt: new Date().toISOString(),
                read: false,
              });
            }
            
            // Add this alert ID to the processed set
            currentProcessedIds.add(expiryAlertId);
          }
        }
        
        // Check for low stock alerts
        const percentRemaining = (medicine.currentQuantity / medicine.totalQuantity) * 100;
        const stockAlertId = `stock-${medicine.id}-${Math.round(percentRemaining)}`;
        
        if (!currentProcessedIds.has(stockAlertId) && percentRemaining <= 20) {
          newAlerts.push({
            id: stockAlertId,
            type: 'stock',
            title: 'Medicine Running Low',
            description: `${medicine.name} is running low (${Math.round(percentRemaining)}% remaining).`,
            medicineIds: [medicine.id],
            createdAt: new Date().toISOString(),
            read: false,
          });
          
          // Add this alert ID to the processed set
          currentProcessedIds.add(stockAlertId);
        }
      });
      
      // Check for medicine interactions
      const checkedPairs = new Set<string>();
      
      medicines.forEach(medicine1 => {
        medicines.forEach(medicine2 => {
          if (medicine1.id !== medicine2.id) {
            // Create a unique key for this pair to avoid duplicate checks
            const pairKey = [medicine1.id, medicine2.id].sort().join('-');
            const interactionAlertId = `interaction-${pairKey}`;
            
            if (!checkedPairs.has(pairKey) && !currentProcessedIds.has(interactionAlertId)) {
              checkedPairs.add(pairKey);
              
              // Check if these medicines interact
              const med1Interactions = MEDICINE_INTERACTIONS[medicine1.name.toLowerCase()] || [];
              if (med1Interactions.includes(medicine2.name.toLowerCase())) {
                newAlerts.push({
                  id: interactionAlertId,
                  type: 'interaction',
                  title: 'Medicine Interaction Warning',
                  description: `${medicine1.name} and ${medicine2.name} may interact with each other. Please consult your doctor.`,
                  medicineIds: [medicine1.id, medicine2.id],
                  createdAt: new Date().toISOString(),
                  read: false,
                });
                
                // Add this alert ID to the processed set
                currentProcessedIds.add(interactionAlertId);
              }
            }
          }
        });
      });
      
      // Check for medicine reminder alerts
      medicines.forEach(medicine => {
        if (medicine.timeToTake && medicine.timeToTake.length > 0) {
          medicine.timeToTake.forEach(time => {
            const [hours, minutes] = time.split(':').map(Number);
            const now = new Date();
            const reminderTime = new Date();
            reminderTime.setHours(hours, minutes, 0, 0);
            
            // Create a unique ID for this reminder that includes the date
            const reminderAlertId = `reminder-${medicine.id}-${time}-${now.toISOString().split('T')[0]}`;
            
            // Only create the reminder if we haven't processed it before
            if (!currentProcessedIds.has(reminderAlertId)) {
              // Check if it's time for the reminder (within the last hour)
              const timeDiff = Math.abs(now.getTime() - reminderTime.getTime());
              const diffMinutes = Math.floor(timeDiff / (1000 * 60));
              
              if (diffMinutes <= 60 && now.getTime() >= reminderTime.getTime()) {
                newAlerts.push({
                  id: reminderAlertId,
                  type: 'reminder',
                  title: 'Time to Take Medicine',
                  description: `It's time to take ${medicine.name} (${medicine.dosage}).`,
                  medicineIds: [medicine.id],
                  createdAt: new Date().toISOString(),
                  read: false,
                });
                
                // Add this alert ID to the processed set
                currentProcessedIds.add(reminderAlertId);
              }
            }
          });
        }
      });
      
      // If we have new alerts, add them to the state and save them
      if (newAlerts.length > 0) {
        // Ensure we don't have duplicate alerts by using a Map with alert IDs as keys
        const allAlerts = [...alerts, ...newAlerts];
        const uniqueAlerts = Array.from(
          new Map(allAlerts.map(alert => [alert.id, alert])).values()
        );
        
        setAlerts(uniqueAlerts);
        await saveAlerts(uniqueAlerts);
        setProcessedAlertIds(currentProcessedIds);
        await saveProcessedAlertIds(currentProcessedIds);
      }
    } catch (error) {
      console.error('Error generating alerts:', error);
    } finally {
      setIsGeneratingAlerts(false);
    }
  };
  
  // Helper function to calculate daily usage based on frequency
  const calculateDailyUsage = (frequency: string): number => {
    const lowerFreq = frequency.toLowerCase();
    
    if (lowerFreq.includes('once daily') || lowerFreq.includes('daily') || lowerFreq.includes('day')) {
      return 1;
    } else if (lowerFreq.includes('twice daily') || lowerFreq.includes('two times')) {
      return 2;
    } else if (lowerFreq.includes('three times')) {
      return 3;
    } else if (lowerFreq.includes('four times')) {
      return 4;
    } else if (lowerFreq.includes('every other day') || lowerFreq.includes('alternate day')) {
      return 0.5;
    } else if (lowerFreq.includes('weekly') || lowerFreq.includes('once a week')) {
      return 1/7;
    } else {
      // Default to once daily if we can't determine
      return 1;
    }
  };
  
  // Filter alerts by type
  const getInteractionAlerts = () => alerts.filter(alert => alert.type === 'interaction');
  const getExpiryAlerts = () => alerts.filter(alert => alert.type === 'expiry');
  const getStockAlerts = () => alerts.filter(alert => alert.type === 'stock');

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
        setActiveUser: setActiveUserById,
      }}
    >
      {children}
    </MedicineContext.Provider>
  );
};