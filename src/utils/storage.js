import { db, auth } from '../firebase';
import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
} from 'firebase/firestore';

// Helper to get the current user's ID
const getUserId = () => {
    const user = auth.currentUser;
    if (!user) throw new Error('No user logged in');
    return user.uid;
};

// Helper to get a user's subcollection reference
const userCollection = (collectionName) => {
    const uid = getUserId();
    return collection(db, 'users', uid, collectionName);
};

export const storage = {

    // ─── SLEEP ───────────────────────────────────────────────
    getSleepData: async () => {
        try {
            const ref = userCollection('sleep');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting sleep data:', error);
            return [];
        }
    },

    addSleepEntry: async (entry) => {
        try {
            const ref = userCollection('sleep');
            await addDoc(ref, entry);
            return true;
        } catch (error) {
            console.error('Error adding sleep entry:', error);
            return false;
        }
    },

    updateSleepEntry: async (id, updatedEntry) => {
        try {
            const uid = getUserId();
            const ref = doc(db, 'users', uid, 'sleep', id);
            await updateDoc(ref, updatedEntry);
            return true;
        } catch (error) {
            console.error('Error updating sleep entry:', error);
            return false;
        }
    },

    deleteSleepEntry: async (id) => {
        try {
            const uid = getUserId();
            const ref = doc(db, 'users', uid, 'sleep', id);
            await deleteDoc(ref);
            return true;
        } catch (error) {
            console.error('Error deleting sleep entry:', error);
            return false;
        }
    },

    // ─── PLACEHOLDERS (ready to fill in later) ───────────────
    getWeightData: async () => [],
    getFitnessData: async () => [],
    getSchoolData: async () => [],
    getHobbiesData: async () => [],
    getChoresData: async () => [],
};

export default storage;
