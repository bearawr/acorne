import { db, auth } from '../firebase';
import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    setDoc,
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

    // ─── WEIGHT ───────────────────────────────────────────────

    // Goals
    getWeightGoals: async () => {
        try {
            const ref = userCollection('weightGoals');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (error) {
            console.error('Error getting weight goals:', error);
            return [];
        }
    },

    addWeightGoal: async (goal) => {
        try {
            const ref = userCollection('weightGoals');
            const docRef = await addDoc(ref, goal);
            return docRef.id;
        } catch (error) {
            console.error('Error adding weight goal:', error);
            return null;
        }
    },

    updateWeightGoal: async (id, updates) => {
        try {
            const uid = getUserId();
            const ref = doc(db, 'users', uid, 'weightGoals', id);
            await updateDoc(ref, updates);
            return true;
        } catch (error) {
            console.error('Error updating weight goal:', error);
            return false;
        }
    },

    deleteWeightGoal: async (id) => {
        try {
            const uid = getUserId();
            const ref = doc(db, 'users', uid, 'weightGoals', id);
            await deleteDoc(ref);
            return true;
        } catch (error) {
            console.error('Error deleting weight goal:', error);
            return false;
        }
    },

    // Entries
    getWeightEntries: async (goalId) => {
        try {
            const uid = getUserId();
            const ref = collection(db, 'users', uid, 'weightGoals', goalId, 'entries');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.date.localeCompare(b.date));
        } catch (error) {
            console.error('Error getting weight entries:', error);
            return [];
        }
    },

    addWeightEntry: async (goalId, entry) => {
        try {
            const uid = getUserId();
            const ref = collection(db, 'users', uid, 'weightGoals', goalId, 'entries');
            await addDoc(ref, entry);
            return true;
        } catch (error) {
            console.error('Error adding weight entry:', error);
            return false;
        }
    },

    updateWeightEntry: async (goalId, entryId, updates) => {
        try {
            const uid = getUserId();
            const ref = doc(db, 'users', uid, 'weightGoals', goalId, 'entries', entryId);
            await updateDoc(ref, updates);
            return true;
        } catch (error) {
            console.error('Error updating weight entry:', error);
            return false;
        }
    },

    deleteWeightEntry: async (goalId, entryId) => {
        try {
            const uid = getUserId();
            const ref = doc(db, 'users', uid, 'weightGoals', goalId, 'entries', entryId);
            await deleteDoc(ref);
            return true;
        } catch (error) {
            console.error('Error deleting weight entry:', error);
            return false;
        }
    },

    // 2026 Overview — all entries across all goals
    getAllWeightEntries2026: async () => {
        try {
            const goals = await storage.getWeightGoals();
            const allEntries = await Promise.all(
                goals.map(g => storage.getWeightEntries(g.id))
            );
            return allEntries.flat().filter(e => e.date.startsWith('2026')).sort((a, b) => a.date.localeCompare(b.date));
        } catch (error) {
            console.error('Error getting 2026 weight entries:', error);
            return [];
        }
    },

    getWeightData: async () => [],

    // ─── SCHOOL ───────────────────────────────────────────────

    getSchoolTasks: async () => {
        try {
            const ref = userCollection('schoolTasks');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (error) {
            console.error('Error getting school tasks:', error);
            return [];
        }
    },

    addSchoolTask: async (task) => {
        try {
            const ref = userCollection('schoolTasks');
            const docRef = await addDoc(ref, task);
            return docRef.id;
        } catch (error) {
            console.error('Error adding school task:', error);
            return null;
        }
    },

    updateSchoolTask: async (id, updates) => {
        try {
            const uid = getUserId();
            const ref = doc(db, 'users', uid, 'schoolTasks', id);
            await updateDoc(ref, updates);
            return true;
        } catch (error) {
            console.error('Error updating school task:', error);
            return false;
        }
    },

    deleteSchoolTask: async (id) => {
        try {
            const uid = getUserId();
            const ref = doc(db, 'users', uid, 'schoolTasks', id);
            await deleteDoc(ref);
            return true;
        } catch (error) {
            console.error('Error deleting school task:', error);
            return false;
        }
    },

    getSubjectOrder: async () => {
        try {
            const uid = getUserId();
            const ref = collection(db, 'users', uid, 'schoolMeta');
            const snap = await getDocs(ref);
            const found = snap.docs.find(d => d.id === 'subjectOrder');
            return found ? found.data().order : [];
        } catch (error) {
            console.error('Error getting subject order:', error);
            return [];
        }
    },
    
    saveSubjectOrder: async (order) => {
        try {
            const uid = getUserId();
            const ref = doc(db, 'users', uid, 'schoolMeta', 'subjectOrder');
            await setDoc(ref, { order });
            return true;
        } catch (error) {
            console.error('Error saving subject order:', error);
            return false;
        }
    },

    // ─── CHORES ───────────────────────────────────────────────

    getChores: async () => {
        try {
            const ref = userCollection('chores');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (error) {
            console.error('Error getting chores:', error);
            return [];
        }
    },

    addChore: async (chore) => {
        try {
            const ref = userCollection('chores');
            const docRef = await addDoc(ref, chore);
            return docRef.id;
        } catch (error) {
            console.error('Error adding chore:', error);
            return null;
        }
    },

    updateChore: async (id, updates) => {
        try {
            const uid = getUserId();
            const ref = doc(db, 'users', uid, 'chores', id);
            await updateDoc(ref, updates);
            return true;
        } catch (error) {
            console.error('Error updating chore:', error);
            return false;
        }
    },

    deleteChore: async (id) => {
        try {
            const uid = getUserId();
            const ref = doc(db, 'users', uid, 'chores', id);
            await deleteDoc(ref);
            return true;
        } catch (error) {
            console.error('Error deleting chore:', error);
            return false;
        }
    },

    // ─── CHORE TYPES ──────────────────────────────────────────

    getChoreTypes: async () => {
        try {
            const ref = userCollection('choreTypes');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (error) {
            console.error('Error getting chore types:', error);
            return [];
        }
    },

    addChoreType: async (name) => {
        try {
            const ref = userCollection('choreTypes');
            const docRef = await addDoc(ref, { name });
            return docRef.id;
        } catch (error) {
            console.error('Error adding chore type:', error);
            return null;
        }
    },

    updateChoreType: async (id, name) => {
        try {
            const uid = getUserId();
            const ref = doc(db, 'users', uid, 'choreTypes', id);
            await updateDoc(ref, { name });
            return true;
        } catch (error) {
            console.error('Error updating chore type:', error);
            return false;
        }
    },

    deleteChoreType: async (id) => {
        try {
            const uid = getUserId();
            const ref = doc(db, 'users', uid, 'choreTypes', id);
            await deleteDoc(ref);
            return true;
        } catch (error) {
            console.error('Error deleting chore type:', error);
            return false;
        }
    },

        // ─── FITNESS: JUDO ────────────────────────────────────────

    getJudoSessions: async () => {
        try {
            const ref = userCollection('fitnessJudo');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (error) { console.error(error); return []; }
    },
    addJudoSession: async (session) => {
        try {
            const ref = userCollection('fitnessJudo');
            const docRef = await addDoc(ref, session);
            return docRef.id;
        } catch (error) { console.error(error); return null; }
    },
    updateJudoSession: async (id, updates) => {
        try {
            const uid = getUserId();
            await updateDoc(doc(db, 'users', uid, 'fitnessJudo', id), updates);
            return true;
        } catch (error) { console.error(error); return false; }
    },
    deleteJudoSession: async (id) => {
        try {
            const uid = getUserId();
            await deleteDoc(doc(db, 'users', uid, 'fitnessJudo', id));
            return true;
        } catch (error) { console.error(error); return false; }
    },

    // ─── FITNESS: GYM ─────────────────────────────────────────

    getGymSessions: async () => {
        try {
            const ref = userCollection('fitnessGym');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (error) { console.error(error); return []; }
    },
    addGymSession: async (session) => {
        try {
            const ref = userCollection('fitnessGym');
            const docRef = await addDoc(ref, session);
            return docRef.id;
        } catch (error) { console.error(error); return null; }
    },
    updateGymSession: async (id, updates) => {
        try {
            const uid = getUserId();
            await updateDoc(doc(db, 'users', uid, 'fitnessGym', id), updates);
            return true;
        } catch (error) { console.error(error); return false; }
    },
    deleteGymSession: async (id) => {
        try {
            const uid = getUserId();
            await deleteDoc(doc(db, 'users', uid, 'fitnessGym', id));
            return true;
        } catch (error) { console.error(error); return false; }
    },

    // ─── FITNESS: BODY WEIGHT ACTIVITY DEFINITIONS ────────────

    getBWActivities: async () => {
        try {
            const ref = userCollection('fitnessBWActivities');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (error) { console.error(error); return []; }
    },
    addBWActivity: async (activity) => {
        // shape: { name, trackType: 'reps'|'duration', unit: 'reps'|'seconds'|'minutes', goals: { daily, weekly, monthly, yearly } }
        try {
            const ref = userCollection('fitnessBWActivities');
            const docRef = await addDoc(ref, activity);
            return docRef.id;
        } catch (error) { console.error(error); return null; }
    },
    updateBWActivity: async (id, updates) => {
        try {
            const uid = getUserId();
            await updateDoc(doc(db, 'users', uid, 'fitnessBWActivities', id), updates);
            return true;
        } catch (error) { console.error(error); return false; }
    },
    deleteBWActivity: async (id) => {
        try {
            const uid = getUserId();
            await deleteDoc(doc(db, 'users', uid, 'fitnessBWActivities', id));
            return true;
        } catch (error) { console.error(error); return false; }
    },

    // ─── FITNESS: BODY WEIGHT LOGS ────────────────────────────

    getBWLogs: async () => {
        try {
            const ref = userCollection('fitnessBWLogs');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (error) { console.error(error); return []; }
    },
    addBWLog: async (log) => {
        // shape: { activityId, date: 'yyyy-MM-dd', value: number, note: string }
        try {
            const ref = userCollection('fitnessBWLogs');
            const docRef = await addDoc(ref, log);
            return docRef.id;
        } catch (error) { console.error(error); return null; }
    },
    updateBWLog: async (id, updates) => {
        try {
            const uid = getUserId();
            await updateDoc(doc(db, 'users', uid, 'fitnessBWLogs', id), updates);
            return true;
        } catch (error) { console.error(error); return false; }
    },
    deleteBWLog: async (id) => {
        try {
            const uid = getUserId();
            await deleteDoc(doc(db, 'users', uid, 'fitnessBWLogs', id));
            return true;
        } catch (error) { console.error(error); return false; }
    },

    // ─── FITNESS: UNIQUE ACTIVITIES ───────────────────────────

    getUniqueActivities: async () => {
        try {
            const ref = userCollection('fitnessUnique');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (error) { console.error(error); return []; }
    },
    addUniqueActivity: async (activity) => {
        // shape: { title, date, startTime, endTime, laps, reps, sets, notes }
        try {
            const ref = userCollection('fitnessUnique');
            const docRef = await addDoc(ref, activity);
            return docRef.id;
        } catch (error) { console.error(error); return null; }
    },
    updateUniqueActivity: async (id, updates) => {
        try {
            const uid = getUserId();
            await updateDoc(doc(db, 'users', uid, 'fitnessUnique', id), updates);
            return true;
        } catch (error) { console.error(error); return false; }
    },
    deleteUniqueActivity: async (id) => {
        try {
            const uid = getUserId();
            await deleteDoc(doc(db, 'users', uid, 'fitnessUnique', id));
            return true;
        } catch (error) { console.error(error); return false; }
    },

    // Unique activity title tags (for dropdown)
    getUniqueTags: async () => {
        try {
            const uid = getUserId();
            const snap = await getDocs(collection(db, 'users', uid, 'fitnessMeta'));
            const found = snap.docs.find(d => d.id === 'uniqueTags');
            return found ? found.data().tags : [];
        } catch (error) { console.error(error); return []; }
    },
    saveUniqueTags: async (tags) => {
        try {
            const uid = getUserId();
            await setDoc(doc(db, 'users', uid, 'fitnessMeta', 'uniqueTags'), { tags });
            return true;
        } catch (error) { console.error(error); return false; }
    },

    getFitnessData: async () => [],

    // ─── HOBBIES: READING ─────────────────────────────────────

    getBooks: async () => {
        try {
            const ref = userCollection('hBooks');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error(e); return []; }
    },
    addBook: async (book) => {
        try {
            const ref = userCollection('hBooks');
            const docRef = await addDoc(ref, book);
            return docRef.id;
        } catch (e) { console.error(e); return null; }
    },
    updateBook: async (id, updates) => {
        try {
            const uid = getUserId();
            await updateDoc(doc(db, 'users', uid, 'hBooks', id), updates);
            return true;
        } catch (e) { console.error(e); return false; }
    },
    deleteBook: async (id) => {
        try {
            const uid = getUserId();
            await deleteDoc(doc(db, 'users', uid, 'hBooks', id));
            return true;
        } catch (e) { console.error(e); return false; }
    },

    // ─── HOBBIES: LETTERS ─────────────────────────────────────

    getLetters: async () => {
        try {
            const ref = userCollection('hLetters');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error(e); return []; }
    },
    addLetter: async (letter) => {
        try {
            const ref = userCollection('hLetters');
            const docRef = await addDoc(ref, letter);
            return docRef.id;
        } catch (e) { console.error(e); return null; }
    },
    updateLetter: async (id, updates) => {
        try {
            const uid = getUserId();
            await updateDoc(doc(db, 'users', uid, 'hLetters', id), updates);
            return true;
        } catch (e) { console.error(e); return false; }
    },
    deleteLetter: async (id) => {
        try {
            const uid = getUserId();
            await deleteDoc(doc(db, 'users', uid, 'hLetters', id));
            return true;
        } catch (e) { console.error(e); return false; }
    },

    // ─── HOBBIES: PENPALS ─────────────────────────────────────

    getPenpals: async () => {
        try {
            const ref = userCollection('hPenpals');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error(e); return []; }
    },
    addPenpal: async (penpal) => {
        try {
            const ref = userCollection('hPenpals');
            const docRef = await addDoc(ref, penpal);
            return docRef.id;
        } catch (e) { console.error(e); return null; }
    },
    updatePenpal: async (id, updates) => {
        try {
            const uid = getUserId();
            await updateDoc(doc(db, 'users', uid, 'hPenpals', id), updates);
            return true;
        } catch (e) { console.error(e); return false; }
    },
    deletePenpal: async (id) => {
        try {
            const uid = getUserId();
            await deleteDoc(doc(db, 'users', uid, 'hPenpals', id));
            return true;
        } catch (e) { console.error(e); return false; }
    },

    // ─── HOBBIES: JOURNAL ─────────────────────────────────────

    getJournalEntries: async () => {
        try {
            const ref = userCollection('hJournal');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error(e); return []; }
    },
    addJournalEntry: async (entry) => {
        try {
            const ref = userCollection('hJournal');
            const docRef = await addDoc(ref, entry);
            return docRef.id;
        } catch (e) { console.error(e); return null; }
    },
    updateJournalEntry: async (id, updates) => {
        try {
            const uid = getUserId();
            await updateDoc(doc(db, 'users', uid, 'hJournal', id), updates);
            return true;
        } catch (e) { console.error(e); return false; }
    },
    deleteJournalEntry: async (id) => {
        try {
            const uid = getUserId();
            await deleteDoc(doc(db, 'users', uid, 'hJournal', id));
            return true;
        } catch (e) { console.error(e); return false; }
    },

    // ─── HOBBIES: DRAWING ─────────────────────────────────────

    getDrawingEntries: async () => {
        try {
            const ref = userCollection('hDrawing');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error(e); return []; }
    },
    addDrawingEntry: async (entry) => {
        try {
            const ref = userCollection('hDrawing');
            const docRef = await addDoc(ref, entry);
            return docRef.id;
        } catch (e) { console.error(e); return null; }
    },
    updateDrawingEntry: async (id, updates) => {
        try {
            const uid = getUserId();
            await updateDoc(doc(db, 'users', uid, 'hDrawing', id), updates);
            return true;
        } catch (e) { console.error(e); return false; }
    },
    deleteDrawingEntry: async (id) => {
        try {
            const uid = getUserId();
            await deleteDoc(doc(db, 'users', uid, 'hDrawing', id));
            return true;
        } catch (e) { console.error(e); return false; }
    },

    // ─── HOBBIES: MUSIC ───────────────────────────────────────

    getMusicEntries: async () => {
        try {
            const ref = userCollection('hMusic');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error(e); return []; }
    },
    addMusicEntry: async (entry) => {
        try {
            const ref = userCollection('hMusic');
            const docRef = await addDoc(ref, entry);
            return docRef.id;
        } catch (e) { console.error(e); return null; }
    },
    updateMusicEntry: async (id, updates) => {
        try {
            const uid = getUserId();
            await updateDoc(doc(db, 'users', uid, 'hMusic', id), updates);
            return true;
        } catch (e) { console.error(e); return false; }
    },
    deleteMusicEntry: async (id) => {
        try {
            const uid = getUserId();
            await deleteDoc(doc(db, 'users', uid, 'hMusic', id));
            return true;
        } catch (e) { console.error(e); return false; }
    },
    getMusicInstruments: async () => {
        try {
            const uid = getUserId();
            const snap = await getDocs(collection(db, 'users', uid, 'hMusicMeta'));
            const found = snap.docs.find(d => d.id === 'instruments');
            return found ? found.data().list : ['Piano', 'Guitar'];
        } catch (e) { console.error(e); return ['Piano', 'Guitar']; }
    },
    saveMusicInstruments: async (list) => {
        try {
            const uid = getUserId();
            await setDoc(doc(db, 'users', uid, 'hMusicMeta', 'instruments'), { list });
            return true;
        } catch (e) { console.error(e); return false; }
    },

    // ─── HOBBIES: CODING ──────────────────────────────────────

    getCodingProjects: async () => {
        try {
            const ref = userCollection('hCodingProjects');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error(e); return []; }
    },
    addCodingProject: async (project) => {
        try {
            const ref = userCollection('hCodingProjects');
            const docRef = await addDoc(ref, project);
            return docRef.id;
        } catch (e) { console.error(e); return null; }
    },
    updateCodingProject: async (id, updates) => {
        try {
            const uid = getUserId();
            await updateDoc(doc(db, 'users', uid, 'hCodingProjects', id), updates);
            return true;
        } catch (e) { console.error(e); return false; }
    },
    deleteCodingProject: async (id) => {
        try {
            const uid = getUserId();
            await deleteDoc(doc(db, 'users', uid, 'hCodingProjects', id));
            return true;
        } catch (e) { console.error(e); return false; }
    },
    getCodingLogs: async () => {
        try {
            const ref = userCollection('hCodingLogs');
            const snapshot = await getDocs(ref);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error(e); return []; }
    },
    addCodingLog: async (log) => {
        // shape: { projectId, date, notes }
        try {
            const ref = userCollection('hCodingLogs');
            const docRef = await addDoc(ref, log);
            return docRef.id;
        } catch (e) { console.error(e); return null; }
    },
    updateCodingLog: async (id, updates) => {
        try {
            const uid = getUserId();
            await updateDoc(doc(db, 'users', uid, 'hCodingLogs', id), updates);
            return true;
        } catch (e) { console.error(e); return false; }
    },
    deleteCodingLog: async (id) => {
        try {
            const uid = getUserId();
            await deleteDoc(doc(db, 'users', uid, 'hCodingLogs', id));
            return true;
        } catch (e) { console.error(e); return false; }
    },

    getHobbiesData: async () => [],


    // ─── PLACEHOLDERS (ready to fill in later) ───────────────
    // ─── OVERVIEW ─────────────────────────────────────────────

    getOverviewData: async () => [],

    getOverviewQueue: async () => {
        try {
            const uid = getUserId();
            const snap = await getDocs(collection(db, 'users', uid, 'overviewMeta'));
            const found = snap.docs.find(d => d.id === 'queue');
            return found ? found.data().items : [];
        } catch (error) {
            console.error('Error getting overview queue:', error);
            return [];
        }
    },

    saveOverviewQueue: async (items) => {
        try {
            const uid = getUserId();
            await setDoc(doc(db, 'users', uid, 'overviewMeta', 'queue'), { items });
            return true;
        } catch (error) {
            console.error('Error saving overview queue:', error);
            return false;
        }
    },

    getOverviewCheckins: async () => {
        try {
            const uid = getUserId();
            const snap = await getDocs(collection(db, 'users', uid, 'overviewMeta'));
            const found = snap.docs.find(d => d.id === 'checkins');
            return found ? found.data() : null;
        } catch (error) {
            console.error('Error getting overview checkins:', error);
            return null;
        }
    },

    saveOverviewCheckins: async (obj) => {
        try {
            const uid = getUserId();
            await setDoc(doc(db, 'users', uid, 'overviewMeta', 'checkins'), obj);
            return true;
        } catch (error) {
            console.error('Error saving overview checkins:', error);
            return false;
        }
    },

    getOverviewGeneralTasks: async () => {
        try {
            const uid = getUserId();
            const snap = await getDocs(collection(db, 'users', uid, 'overviewMeta'));
            const found = snap.docs.find(d => d.id === 'generalTasks');
            return found ? found.data().items : [];
        } catch (error) {
            console.error('Error getting overview general tasks:', error);
            return [];
        }
    },

    saveOverviewGeneralTasks: async (items) => {
        try {
            const uid = getUserId();
            await setDoc(doc(db, 'users', uid, 'overviewMeta', 'generalTasks'), { items });
            return true;
        } catch (error) {
            console.error('Error saving overview general tasks:', error);
            return false;
        }
    },

    getFamilyHistory: async () => {
        try {
            const uid = getUserId();
            const snap = await getDocs(collection(db, 'users', uid, 'overviewMeta'));
            const found = snap.docs.find(d => d.id === 'familyHistory');
            return found ? found.data().history : {};
        } catch (error) {
            console.error('Error getting family history:', error);
            return {};
        }
    },

    saveFamilyHistory: async (history) => {
        try {
            const uid = getUserId();
            await setDoc(doc(db, 'users', uid, 'overviewMeta', 'familyHistory'), { history });
            return true;
        } catch (error) {
            console.error('Error saving family history:', error);
            return false;
        }
    },

};

export default storage;
