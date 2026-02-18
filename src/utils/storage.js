// Storage utility using localStorage
// Will try swap with something like Supabase later

// Unique string identifiers to store data
const STORAGE_KEYS = {
    SLEEP: 'acorne_sleep_data',
    WEIGHT: 'acorne_weight_data',
    FITNESS: 'acorne_fitness_data',
    CHORES: 'acorne_chores_data',
    HOBBIES: 'acorne_hobbies_data',
    SCHOOL: 'acorne_school data'
};

// storage = 'how to talk to browser'
export const storage = {
    get: (key) => {
        try {
            const data = localStorage.getItem(key);
            // condition ? value_if_true : value_if_false
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error reading from storage:', error);
            return null;
        }
    },
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Error writing from stage:', error);
            return false;
        }
    },

    // Sleep data functions
    getSleepData: () => {
        return storage.get(STORAGE_KEYS.SLEEP) || [];
    },
    saveSleepData: (data) => {
        return storage.set(STORAGE_KEYS.SLEEP, data);
    },
    addSleepEntry: (entry) => {
        const data = storage.getSleepData();
        const newData = [...data, entry];
        return storage.saveSleepData(newData);
    },
    updateSleepEntry: (date, updatedEntry) => {
        const data = storage.getSleepData();
        const newData = data.map(entry => entry.date === date ? { ...entry, ...updatedEntry } : entry);
        return storage.saveSleepData(newData);
    },
    deleteSleepEntry: (date) => {
        const data = storage.getSleepData();
        const newData = data.filter(entry => entry.date !== date);
        return storage.saveSleepData(newData);
    },

    //Placeholder functions for the other modules
    getWeightData: () => storage.get(STORAGE_KEYS.WEIGHT) || [],
    getFitnessData: () => storage.get(STORAGE_KEYS.FITNESS) || [],
    getSchoolData: () => storage.get(STORAGE_KEYS.SCHOOL) || [],
    getHobbiesData: () => storage.get(STORAGE_KEYS.HOBBIES) || [],
    getChoresData: () => storage.get(STORAGE_KEYS.CHORES) || [],
};

export default storage;
