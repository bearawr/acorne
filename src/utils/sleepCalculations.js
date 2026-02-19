import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, differenceInMinutes, getDay } from 'date-fns';

// Calculate hours slept between bedtime and wake time
export const calculateSleepHours = (bedTime, wakeTime) => {
    if (!bedTime || !wakeTime) return 0;

    const [bedHour, bedMin] = bedTime.split(':').map(Number);
    const [wakeHour, wakeMin] = wakeTime.split(':').map(Number);

    let totalMinutes;

    if (wakeHour < bedHour || (wakeHour === bedHour && wakeMin < bedMin)) {
        const minutesToMidnight = (24 - bedHour) * 60 - bedMin;
        const minutesFromMidnight = wakeHour * 60 + wakeMin;
        totalMinutes = minutesToMidnight + minutesFromMidnight;
    } else {
        totalMinutes = (wakeHour - bedHour) * 60 + (wakeMin - bedMin);
    }

    return (totalMinutes / 60).toFixed(1);
};

// Get sleep data for a specific date range
export const getSleepInRange = (sleepData, startDate, endDate) => {
    return sleepData.filter(entry => {
        const entryDate = parseISO(entry.date);
        return entryDate >= startDate && entryDate <= endDate;
    });
};

// Calculates MEDIAN sleep hours
export const calculateMedianSleep = (sleepData) => {
    if (!sleepData || sleepData.length === 0) return 0;
    const hours = sleepData.map(e => parseFloat(e.hoursSlept || 0)).sort((a, b) => a - b);
    const mid = Math.floor(hours.length / 2);
    return hours.length % 2 === 0
    ? ((hours[mid - 1] + hours[mid]) / 2).toFixed(1)
    : hours[mid].toFixed(1);
};

// Calculate median bedtime
export const calculateMedianBedtime = (sleepData) => {
    if (!sleepData || sleepData.length === 0) return '--:--';
    const minutes = sleepData.filter(e => e.bedTime).map( e => {
        const [h, m] = e.bedTime.split(':').map(Number);
        return (h >= 0 && h < 12)
            ? (h + 24) * 60 + m
            : h * 60 + m;
    }).sort((a, b) => a - b);
    if (minutes.length === 0)
        return '--:--';
    const mid = Math.floor(minutes.length / 2);
    const med = minutes.length % 2 === 0
        ? Math.round((minutes[mid - 1] + minutes[mid]) / 2)
        : minutes[mid];
    const h = Math.floor(med / 60) % 24;
    const m = med % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Calculate median wake time
export const calculateMedianWakeTime = (sleepData) => {
    if (!sleepData || sleepData.length === 0) return '--:--';
    const minutes = sleepData.filter(e => e.wakeTime).map(e => {
        const [h, m] = e.wakeTime.split(':').map(Number);
        return h * 60 + m;
    }).sort((a, b) => a - b);
    if (minutes.length === 0) return '--:--';
    const mid = Math.floor(minutes.length / 2);
    const med = minutes.length % 2 === 0
        ? Math.round((minutes[mid - 1] + minutes[mid]) / 2)
        : minutes[mid];
    const h = Math.floor(med / 60);
    const m = med % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
