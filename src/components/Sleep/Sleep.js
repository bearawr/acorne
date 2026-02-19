import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfWeek, endOfWeek, addWeeks, getDaysInMonth, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns';
import { Calendar, BarChart3, ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';
import SleepInputModal from './SleepInputModal';
import { storage } from '../../utils/storage';
import {
calculateMedianBedtime,
calculateMedianWakeTime,
getSleepInRange,
calculateMedianSleep
} from '../../utils/sleepCalculations';
import './Sleep.css';

const CURRENT_YEAR = 2026;

// Format decimal hours to "1h 30m"
const formatHoursToHM = (decimalHours) => {
if (!decimalHours || decimalHours === 0) return '0h';
const h = Math.floor(parseFloat(decimalHours));
const m = Math.round((parseFloat(decimalHours) - h) * 60);
if (m === 0) return `${h}h`;
if (h === 0) return `${m}m`;
return `${h}h ${m}m`;
};

// Convert 24h to 12h format
const formatTo12Hour = (time24) => {
if (!time24 || time24 === '--:--') return '--:--';
try {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
} catch {
    return time24;
}
};

// Get color for year grid based on hours slept
const getYearGridColor = (hours) => {
if (!hours) return null;
const h = parseFloat(hours);
if (h < 5)  return '#ef4444'; // Red
if (h < 7)  return '#f97316'; // Orange
if (h < 8)  return '#a3e635'; // Yellow-green
if (h <= 10) return '#22c55e'; // Green
return '#8b5cf6';              // Purple
};

// Get bar color based on hours slept
const getBarColor = (hours) => {
const h = parseFloat(hours);
if (h >= 8) return { bg: 'linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)', shadow: 'rgba(76,175,80,0.3)' };
if (h >= 7) return { bg: 'linear-gradient(135deg, #9CCC65 0%, #AED581 100%)', shadow: 'rgba(156,204,101,0.3)' };
return { bg: 'linear-gradient(135deg, #FF9800 0%, #FFB74D 100%)', shadow: 'rgba(255,152,0,0.3)' };
};

function Sleep() {
const [currentDate, setCurrentDate] = useState(new Date());
const [viewMode, setViewMode] = useState('calendar');
const [isModalOpen, setIsModalOpen] = useState(false);
const [selectedDate, setSelectedDate] = useState(null);
const [editingEntry, setEditingEntry] = useState(null);
const [sleepData, setSleepData] = useState(storage.getSleepData());

const monthStart = startOfMonth(currentDate);
const monthEnd = endOfMonth(currentDate);
const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

// --- Stats calculations ---
const weeklyMedian = useMemo(() => {
const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
const weekEnd = endOfWeek(new Date(), { weekStartsOn: 0 });
return calculateMedianSleep(getSleepInRange(sleepData, weekStart, weekEnd));
}, [sleepData]);

const medianBedtime  = useMemo(() => formatTo12Hour(calculateMedianBedtime(sleepData)), [sleepData]);
const medianWakeTime = useMemo(() => formatTo12Hour(calculateMedianWakeTime(sleepData)), [sleepData]);

// Monthly sleep fraction for each month of the year
const monthlyFractions = useMemo(() => {
    const yearStart = new Date(CURRENT_YEAR, 0, 1);
    const yearEnd   = new Date(CURRENT_YEAR, 11, 31);
    return eachMonthOfInterval({ start: yearStart, end: yearEnd }).map(monthDate => {
    const mStart = startOfMonth(monthDate);
    const mEnd   = endOfMonth(monthDate);
    const daysInM = getDaysInMonth(monthDate);
    const ideal   = daysInM * 8; // 8h ideal per day
    const monthData = getSleepInRange(sleepData, mStart, mEnd);
    const actual = monthData.reduce((sum, e) => sum + parseFloat(e.hoursSlept || 0), 0);
    const pct = ideal > 0 ? Math.min((actual / ideal) * 100, 100) : 0;
    return { label: format(monthDate, 'MMM'), actual: actual.toFixed(1), ideal, pct: pct.toFixed(0), daysTracked: monthData.length };
    });
}, [sleepData]);

// Sleep duration distribution (all-time)
const sleepDistribution = useMemo(() => {
    const dist = {};
    for (let i = 0; i <= 11; i++) dist[i] = 0;
    sleepData.forEach(entry => {
    const h = Math.floor(parseFloat(entry.hoursSlept || 0));
    if (h >= 0 && h <= 11) dist[h]++;
    });
    return dist;
}, [sleepData]);

const maxDistCount = useMemo(() => Math.max(...Object.values(sleepDistribution), 1), [sleepDistribution]);

// Year grid data
const yearGridMonths = useMemo(() => {
    return eachMonthOfInterval({ start: new Date(CURRENT_YEAR, 0, 1), end: new Date(CURRENT_YEAR, 11, 31) }).map(monthDate => {
    const days = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
    return {
        label: format(monthDate, 'MMM'),
        firstDayOfWeek: startOfMonth(monthDate).getDay(),
        days: days.map(day => {
        const key = format(day, 'yyyy-MM-dd');
        const entry = sleepData.find(e => e.date === key);
        return { dayNum: format(day, 'd'), color: entry ? getYearGridColor(entry.hoursSlept) : null };
        })
    };
    });
}, [sleepData]);

// Handlers
const handlePreviousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
const handleNextMonth     = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

const handleDayClick = (day) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const existing = sleepData.find(e => e.date === dateKey);
    if (existing) setEditingEntry(existing); else setSelectedDate(day);
    setIsModalOpen(true);
};

const handleSaveSleep = (sleepEntry) => {
    const idx = sleepData.findIndex(e => e.date === sleepEntry.date);
    const updated = idx >= 0
    ? sleepData.map((e, i) => i === idx ? sleepEntry : e)
    : [...sleepData, sleepEntry];
    storage.saveSleepData(updated);
    setSleepData(updated);
    setIsModalOpen(false); setSelectedDate(null); setEditingEntry(null);
};

const handleDeleteEntry = (dateKey) => {
    storage.deleteSleepEntry(dateKey);
    setSleepData(storage.getSleepData());
    setIsModalOpen(false); setEditingEntry(null);
};

const handleCloseModal = () => {
    setIsModalOpen(false); setSelectedDate(null); setEditingEntry(null);
};

const getSleepForDay = (day) => sleepData.find(e => e.date === format(day, 'yyyy-MM-dd'));
const isBedtimeAfterMidnight = (t) => { if (!t) return false; const [h] = t.split(':').map(Number); return h >= 0 && h < 6; };

// ---- CALENDAR VIEW ----
const renderCalendarView = () => {
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const paddingDays = Array(monthStart.getDay()).fill(null);

    return (
    <div className="calendar-section">
        <div className="calendar-header">
        <h2>{format(currentDate, 'MMMM yyyy')}</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button onClick={handlePreviousMonth}><ChevronLeft size={20} /></button>
            <button onClick={handleNextMonth}><ChevronRight size={20} /></button>
        </div>
        </div>
        <div className="calendar-grid">
        {weekDays.map(d => <div key={d} className="calendar-day-header">{d}</div>)}
        {paddingDays.map((_, i) => <div key={`p-${i}`} className="calendar-day" style={{ opacity: 0, pointerEvents: 'none' }} />)}
        {daysInMonth.map(day => {
            const entry = getSleepForDay(day);
            const hasData = !!entry;
            const afterMidnight = entry ? isBedtimeAfterMidnight(entry.bedTime) : false;
            const barColor = entry ? getBarColor(entry.hoursSlept) : null;
            return (
            <div
                key={day.toString()}
                className={`calendar-day ${isToday(day) ? 'today' : ''} ${hasData ? 'has-data' : ''}`}
                onClick={() => handleDayClick(day)}
            >
                <span className="day-number">{format(day, 'd')}</span>
                {hasData && (
                <>
                    <div className="sleep-times">
                    <div className="time-row">
                        <Moon size={10} color={afterMidnight ? '#e51414' : '#619ce5'} />
                        <span className={`time-text ${afterMidnight ? 'red' : 'blue'}`}>{formatTo12Hour(entry.bedTime)}</span>
                    </div>
                    <div className="time-row">
                        <Sun size={10} color="#e89300" />
                        <span className="time-text orange">{formatTo12Hour(entry.wakeTime)}</span>
                    </div>
                    </div>
                    <div className="sleep-bar">
                    <div className="sleep-bar-fill" style={{
                        width: `${Math.min((parseFloat(entry.hoursSlept) / 9) * 100, 100)}%`,
                        background: barColor.bg,
                        boxShadow: `0 2px 6px ${barColor.shadow}`
                    }} />
                    <span className="sleep-bar-text">{formatHoursToHM(entry.hoursSlept)}</span>
                    </div>
                </>
                )}
            </div>
            );
        })}
        </div>
    </div>
    );
};

// ---- YEAR STATS VIEW ----
const renderStatsView = () => (
    <div className="stats-section">

    {/* 1. Monthly Sleep Fraction
    <div className="stats-card">
        <h3>Monthly Sleep vs Ideal ({CURRENT_YEAR})</h3>
        <p className="stat-subtitle">Actual sleep / Ideal (8h/day × days in month)</p>
        <div className="monthly-fractions">
        {monthlyFractions.map(m => (
            <div key={m.label} className="month-fraction-row">
            <span className="month-fraction-label">{m.label}</span>
            <div className="month-fraction-bar-track">
                <div className="month-fraction-bar-fill" style={{ width: `${m.pct}%` }} />
            </div>
            <span className="month-fraction-pct">{m.pct}%</span>
            <span className="month-fraction-detail">{formatHoursToHM(m.actual)} / {m.ideal}h</span>
            </div>
        ))}
        </div>
    </div> */}

    {/* 2. Sleep Duration Distribution */}
    <div className="stats-card">
        <h3>Sleep Duration Count</h3>
        <p className="stat-subtitle">Number of nights slept per duration (all time)</p>
        <div className="sleep-distribution">
        {Object.entries(sleepDistribution).map(([hours, count]) => (
            <div key={hours} className="distribution-bar">
            <span className="distribution-label">{hours}h</span>
            <div className="distribution-visual">
                {count > -1 ? (
                <div
                    className="distribution-fill"
                    style={{ width: `${(count / 10) * 100}%` }}
                >
                    {count}
                </div>
                ) : (
                <span className="distribution-count">0</span>
                )}
            </div>
            </div>
        ))}
        </div>
    </div>

    {/* 3. Year Grid Calendar */}
    <div className="stats-card">
        <h3>{CURRENT_YEAR} Sleep Calendar</h3>
        <div className="year-legend">
        <span className="legend-item"><span className="legend-dot" style={{ background: '#ef4444' }} />{'< 5h'}</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#f97316' }} />5–6h</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#a3e635' }} />7–8h</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#22c55e' }} />8–10h</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#8b5cf6' }} />10h+</span>
        </div>
        {/* Day of week headers - repeating across all 31 columns */}
        <div className="year-month-row">
            <span className="year-month-label" />
                <div className="year-month-days">
                    {Array.from({ length: 37 }, (_, i) => (
                    <div key={i} className="year-day-cell year-dow-header">
                        <span className="year-dow-label">
                        {['Su','M','T','W','TH','F','Sa'][i % 7]}
                        </span>
                    </div>
                    ))}
                </div>
            </div>
        <div className="year-grid-container">
        {yearGridMonths.map(month => (
            <div key={month.label} className="year-month-row">
            <span className="year-month-label">{month.label}</span>
            <div className="year-month-days">
                {Array(month.firstDayOfWeek).fill(null).map((_, i) => (
                <div key={`pad-${i}`} className="year-day-cell empty" />
                ))}
                {month.days.map((day, i) => (
                <div
                    key={i}
                    className="year-day-cell"
                    style={{ background: day.color || 'var(--color-bg-secondary)' }}
                    title={`${month.label} ${day.dayNum}`}
                >
                    <span className="year-day-num">{day.dayNum}</span>
                </div>
                ))}
            </div>
            </div>
        ))}
        </div>
    </div>

    </div>
);

return (
    <div className="sleep-view">
    <div className="view-header">
        <h1>Sleep Tracker</h1>
        <div className="header-actions">
        <div className="view-mode-toggle">
            <button className={viewMode === 'calendar' ? 'active' : ''} onClick={() => setViewMode('calendar')}>
            <Calendar size={16} /> Calendar
            </button>
            <button className={viewMode === 'stats' ? 'active' : ''} onClick={() => setViewMode('stats')}>
            <BarChart3 size={16} /> Year Stats
            </button>
        </div>
        </div>
    </div>

    <div className="quick-stats">
        <div className="stat-card">
        <p className="stat-label">Weekly Median</p>
        <p className="stat-value">{formatHoursToHM(weeklyMedian)}</p>
        </div>
        <div className="stat-card">
        <p className="stat-label">Median Bedtime</p>
        <p className="stat-value">{medianBedtime}</p>
        </div>
        <div className="stat-card">
        <p className="stat-label">Median Wake Time</p>
        <p className="stat-value">{medianWakeTime}</p>
        </div>
    </div>

    {viewMode === 'calendar' ? renderCalendarView() : renderStatsView()}

    {isModalOpen && (
        <SleepInputModal
        date={selectedDate || (editingEntry ? new Date(editingEntry.date) : new Date())}
        existingEntry={editingEntry}
        onSave={handleSaveSleep}
        onDelete={handleDeleteEntry}
        onClose={handleCloseModal}
        />
    )}
    </div>
);
}

export default Sleep;
