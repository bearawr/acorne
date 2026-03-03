import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../../utils/storage';
import {
    format, parseISO, isToday, startOfMonth, endOfMonth,
    eachDayOfInterval, getDay, startOfWeek, endOfWeek,
    eachMonthOfInterval,
} from 'date-fns';
import { Plus, Pencil, Trash2, X, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import './Fitness.css';

// ─── HELPERS ──────────────────────────────────────────────

const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const calcMinutes = (start, end) => {
    if (!start || !end) return 0;
    try {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        return diff > 0 ? diff : 0;
    } catch { return 0; }
};

const fmtMins = (mins) => {
    if (!mins || mins <= 0) return '—';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins/60)}h${mins%60 > 0 ? ` ${mins%60}m` : ''}`;
};

const fmt12 = (timeStr) => {
    if (!timeStr) return '';
    try {
        const [h, m] = timeStr.split(':').map(Number);
        const period = h >= 12 ? 'PM' : 'AM';
        const hour = h % 12 || 12;
        return `${hour}:${String(m).padStart(2,'0')} ${period}`;
    } catch { return timeStr; }
};

const fmtDate = (dateStr) => {
    if (!dateStr) return '';
    try { return format(parseISO(dateStr), 'MMM d, yyyy'); } catch { return dateStr; }
};

const monthLabel = (dateStr) => {
    try { return format(parseISO(dateStr + '-01'), 'MMM yyyy'); } catch { return dateStr; }
};

const YEAR = new Date().getFullYear();
const ALL_MONTHS = Array.from({ length: 12 }, (_, i) =>
    `${YEAR}-${String(i+1).padStart(2,'0')}`
);

const MODULE_COLORS = {
    judo:   '#0047AB',
    gym:    '#6E38D5',
    bw:     '#03fca5',
    unique: '#ff8ad6',
};

// ─── ELLIPSIS MENU ────────────────────────────────────────

function EllipsisMenu({ items, small = false }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        window.addEventListener('click', h);
        return () => window.removeEventListener('click', h);
    }, []);
    return (
        <div className="task-menu-container" ref={ref} onClick={e => e.stopPropagation()}>
            <button className="ellipsis-btn" onClick={() => setOpen(o => !o)}>
                <MoreVertical size={small ? 12 : 13} />
            </button>
            {open && (
                <div className="task-dropdown">
                    {items.map((item, i) => (
                        <button key={i} className={item.danger ? 'delete-opt' : ''}
                            onClick={() => { item.onClick(); setOpen(false); }}>
                            {item.icon} {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── DAY POPUP MODAL ──────────────────────────────────────

function DayPopup({ date, sessions, activeDates, onClose, onEdit, onDelete, showRandori = false }) {
    const [currentDate] = useState(date);
    const [currentSessions, setCurrentSessions] = useState(sessions);

    // sorted active dates for navigation
    const sorted = [...activeDates].sort();
    const idx = sorted.indexOf(currentDate);

    // When parent updates sessions for navigation, update local
    useEffect(() => {
        if (currentDate === date) setCurrentSessions(sessions);
    }, [sessions, date, currentDate]);

    const hasPrev = idx > 0;
    const hasNext = idx < sorted.length - 1;

    return (
        <div className="form-overlay" onClick={onClose}>
            <div className="cal-detail-modal fit-day-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="cal-detail-header">
                    <div className="fit-modal-nav">
                        <button className="fit-nav-btn" disabled={!hasPrev}
                            onClick={() => onClose(sorted[idx - 1])}>
                            <ChevronLeft size={15} />
                        </button>
                        <span className="cal-detail-type-badge">{fmtDate(currentDate)}</span>
                        <button className="fit-nav-btn" disabled={!hasNext}
                            onClick={() => onClose(sorted[idx + 1])}>
                            <ChevronRight size={15} />
                        </button>
                    </div>
                    <button className="form-close-btn" onClick={() => onClose(null)}>
                        <X size={15} />
                    </button>
                </div>

                {/* Sessions */}
                {currentSessions.length === 0 && <p className="fit-empty">No sessions this day.</p>}
                {currentSessions.map((s, i) => (
                    <div key={s.id || i} className="fit-popup-session">
                        <div className="fit-popup-session-header">
                            <div className="fit-popup-row">
                                {s._type && <span className="fit-tag">{s._type}</span>}
                                {s.title && <span className="fit-tag">{s.title}</span>}
                                {s.startTime && s.endTime && (
                                    <span className="fit-session-time">
                                        {fmt12(s.startTime)} – {fmt12(s.endTime)}
                                        <span className="fit-session-dur"> ({fmtMins(calcMinutes(s.startTime, s.endTime))})</span>
                                    </span>
                                )}
                            </div>
                            {onEdit && onDelete && s.id && (
                                <EllipsisMenu small items={[
                                    { label: 'Edit',   icon: <Pencil size={11} />, onClick: () => { onClose(null); onEdit(s); } },
                                    { label: 'Delete', icon: <Trash2 size={11} />, danger: true, onClick: () => { onDelete(s.id); onClose(null); } },
                                ]} />
                            )}
                        </div>
                        {showRandori && s.randori && <div className="fit-popup-row"><span className="fit-tag">{s.randori} randori</span></div>}
                        {s.laps  && <div className="fit-popup-row"><span>{s.laps} laps</span></div>}
                        {s.reps  && <div className="fit-popup-row"><span>{s.reps} reps</span></div>}
                        {s.sets  && <div className="fit-popup-row"><span>{s.sets} sets</span></div>}
                        {s.value !== undefined && <div className="fit-popup-row"><span className="fit-bw-stat-val">{s.value} {s.unit}</span></div>}
                        {s.note  && <div className="fit-popup-notes">{s.note}</div>}
                        {s.notes && <div className="fit-popup-notes">{s.notes}</div>}
                        {currentSessions.length > 1 && i < currentSessions.length - 1 && <hr className="fit-popup-divider" />}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── SESSION CALENDAR ─────────────────────────────────────

function SessionCalendar({ sessions, onEdit, onDelete, showRandori = false, accentColor = '#6366f1' }) {
    const [popupDate, setPopupDate] = useState(null);

    const year = new Date().getFullYear();
    const months = eachMonthOfInterval({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) });

    const sessionsByDate = {};
    sessions.forEach(s => {
        if (!sessionsByDate[s.date]) sessionsByDate[s.date] = [];
        sessionsByDate[s.date].push(s);
    });
    const activeDates = Object.keys(sessionsByDate).sort();

    const handlePopupClose = (nextDate) => {
        if (nextDate) setPopupDate(nextDate);
        else setPopupDate(null);
    };

    return (
        <>
            <div className="fit-cal-grid-year">
                {months.map(month => {
                    const monthKey = format(month, 'yyyy-MM');
                    const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
                    const offset = getDay(startOfMonth(month));
                    const uniqueDays = new Set(sessions.filter(s => s.date?.startsWith(monthKey)).map(s => s.date)).size;

                    return (
                        <div key={monthKey} className="fit-cal-month">
                            <div className="fit-cal-month-header">
                                <span>{format(month, 'MMM')}</span>
                                <span className="fit-cal-month-count">{uniqueDays > 0 ? `${uniqueDays}d` : '—'}</span>
                            </div>
                            <div className="fit-cal-month-grid">
                                {['S','M','T','W','T','F','S'].map((d,i) => (
                                    <div key={i} className="fit-cal-weekday">{d}</div>
                                ))}
                                {Array.from({ length: offset }).map((_,i) => <div key={`e${i}`} />)}
                                {days.map(day => {
                                    const ds = format(day, 'yyyy-MM-dd');
                                    const daySessions = sessionsByDate[ds] || [];
                                    const has = daySessions.length > 0;
                                    const dayNum = format(day, 'd');
                                    return (
                                        <div key={ds}
                                            className={`fit-cal-day ${has ? 'has-session' : 'empty-day'} ${isToday(day) ? 'today' : ''}`}
                                            style={has ? { background: accentColor } : {}}
                                            onClick={() => has && setPopupDate(ds)}
                                            title={fmtDate(ds)}>
                                            <span className="fit-day-num">{dayNum}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {popupDate && sessionsByDate[popupDate] && (
                <DayPopup
                    date={popupDate}
                    sessions={sessionsByDate[popupDate]}
                    activeDates={activeDates}
                    onClose={handlePopupClose}
                    onEdit={(s) => { onEdit && onEdit(s); }}
                    onDelete={(id) => { onDelete && onDelete(id); }}
                    showRandori={showRandori}
                />
            )}
        </>
    );
}

// ─── BW HEATMAP ───────────────────────────────────────────

function BWHeatmap({ activity, logs, onEditLog, onDeleteLog }) {
    const [popupDate, setPopupDate] = useState(null);
    const year = new Date().getFullYear();
    const months = eachMonthOfInterval({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) });

    const actLogs = logs.filter(l => l.activityId === activity.id);
    const ul = activity.trackType === 'reps' ? 'reps' : activity.unit;

    const dateMap = {};
    actLogs.forEach(l => { dateMap[l.date] = (dateMap[l.date] || 0) + l.value; });
    const logsByDate = {};
    actLogs.forEach(l => {
        if (!logsByDate[l.date]) logsByDate[l.date] = [];
        logsByDate[l.date].push({ ...l, unit: ul });
    });

    const values = Object.values(dateMap);
    const maxVal = values.length > 0 ? Math.max(...values) : 1;
    const activeDates = Object.keys(logsByDate).sort();

    const getIntensity = (val) => val ? Math.max(0.18, val / maxVal) : 0;

    const handlePopupClose = (nextDate) => {
        if (nextDate) setPopupDate(nextDate);
        else setPopupDate(null);
    };

    return (
        <>
            <div className="fit-cal-grid-year">
                {months.map(month => {
                    const monthKey = format(month, 'yyyy-MM');
                    const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
                    const offset = getDay(startOfMonth(month));
                    const monthTotal = actLogs.filter(l => l.date?.startsWith(monthKey)).reduce((a,l) => a+l.value, 0);

                    return (
                        <div key={monthKey} className="fit-cal-month">
                            <div className="fit-cal-month-header">
                                <span>{format(month, 'MMM')}</span>
                                <span className="fit-cal-month-count">{monthTotal > 0 ? `${monthTotal}` : '—'}</span>
                            </div>
                            <div className="fit-cal-month-grid">
                                {['S','M','T','W','T','F','S'].map((d,i) => (
                                    <div key={i} className="fit-cal-weekday">{d}</div>
                                ))}
                                {Array.from({ length: offset }).map((_,i) => <div key={`e${i}`} />)}
                                {days.map(day => {
                                    const ds = format(day, 'yyyy-MM-dd');
                                    const val = dateMap[ds] || 0;
                                    const intensity = getIntensity(val);
                                    const has = val > 0;
                                    const dayNum = format(day, 'd');
                                    return (
                                        <div key={ds}
                                            className={`fit-cal-day fit-heatmap-day ${has ? 'has-session' : 'empty-day'} ${isToday(day) ? 'today' : ''}`}
                                            style={has ? { background: `rgba(99,102,241,${intensity})` } : {}}
                                            onClick={() => has && setPopupDate(ds)}
                                            title={has ? `${val} ${ul}` : fmtDate(ds)}>
                                            <span className="fit-day-num" style={intensity > 0.5 ? { color: 'white' } : {}}>{dayNum}</span>
                                            {has && <span className="fit-heatmap-val" style={intensity > 0.5 ? { color: 'white' } : {}}>{val}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {popupDate && logsByDate[popupDate] && (
                <DayPopup
                    date={popupDate}
                    sessions={logsByDate[popupDate]}
                    activeDates={activeDates}
                    onClose={handlePopupClose}
                    onEdit={onEditLog}
                    onDelete={onDeleteLog}
                />
            )}
        </>
    );
}

// ─── SESSION STATS ────────────────────────────────────────

function SessionStats({ sessions }) {
    const byMonth = {};
    ALL_MONTHS.forEach(m => { byMonth[m] = { days: new Set(), mins: 0 }; });
    sessions.forEach(s => {
        const m = s.date?.slice(0, 7);
        if (!m || !byMonth[m]) return;
        byMonth[m].days.add(s.date);
        byMonth[m].mins += calcMinutes(s.startTime, s.endTime);
    });
    const totalDays = new Set(sessions.map(s => s.date)).size;
    const totalMins = sessions.reduce((a, s) => a + calcMinutes(s.startTime, s.endTime), 0);

    return (
        <div className="fit-stats-panel">
            <div className="fit-stat-total">
                <div><span className="fit-stat-big">{totalDays}</span> days</div>
                <div><span className="fit-stat-big">{fmtMins(totalMins)}</span> total</div>
            </div>
            <table className="fit-stats-table">
                <thead><tr><th>Month</th><th>Days</th><th>Hrs</th></tr></thead>
                <tbody>
                    {ALL_MONTHS.map(m => (
                        <tr key={m} className={byMonth[m].days.size === 0 ? 'fit-row-empty' : ''}>
                            <td>{monthLabel(m)}</td>
                            <td>{byMonth[m].days.size || '—'}</td>
                            <td>{fmtMins(byMonth[m].mins)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── SESSION FORM ─────────────────────────────────────────

function SessionForm({ onSave, onCancel, initial = {}, showRandori = false }) {
    const [form, setForm] = useState({
        date: getTodayStr(), startTime: '', endTime: '', randori: '', notes: '',
        ...initial,
    });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    return (
        <div className="fit-form">
            <div className="fit-form-row">
                <label>Date<input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></label>
                <label>Start<input type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} /></label>
                <label>End<input type="time" value={form.endTime} onChange={e => set('endTime', e.target.value)} /></label>
                {showRandori && <label>Randori #<input type="number" min="0" value={form.randori} onChange={e => set('randori', e.target.value)} style={{ width: 60 }} /></label>}
            </div>
            <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            <div className="fit-form-actions">
                <button className="fit-btn-primary" onClick={() => onSave(form)}>Save</button>
                <button className="fit-btn" onClick={onCancel}>Cancel</button>
            </div>
        </div>
    );
}

// ─── LOG INPUT MODAL ──────────────────────────────────────

function LogInputModal({ activity, onSave, onClose }) {
    const ul = activity.trackType === 'reps' ? 'reps' : activity.unit;
    const [value, setValue] = useState('');
    const [note, setNote] = useState('');
    return (
        <div className="form-overlay" onClick={onClose}>
            <div className="cal-detail-modal fit-log-modal" onClick={e => e.stopPropagation()}>
                <div className="cal-detail-header">
                    <span className="cal-detail-type-badge">Log — {activity.name}</span>
                    <button className="form-close-btn" onClick={onClose}><X size={15} /></button>
                </div>
                <div className="fit-log-modal-body">
                    <input
                        type="number" min="0" autoFocus
                        placeholder={`Enter ${ul}`}
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && value && onSave(Number(value), note)}
                    />
                    <input
                        placeholder="Note (optional)"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                    />
                </div>
                <div className="fit-form-actions">
                    <button className="fit-btn-primary" onClick={() => value && onSave(Number(value), note)}>Save</button>
                    <button className="fit-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

// ─── TAB: JUDO ────────────────────────────────────────────

function JudoTab({ sessions, setSessions }) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);

    const handleSave = async (form) => {
        if (editing) {
            await storage.updateJudoSession(editing.id, form);
            setSessions(s => s.map(x => x.id === editing.id ? { ...form, id: editing.id } : x));
        } else {
            const id = await storage.addJudoSession(form);
            setSessions(s => [...s, { ...form, id }]);
        }
        setShowForm(false); setEditing(null);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete session?')) return;
        await storage.deleteJudoSession(id);
        setSessions(s => s.filter(x => x.id !== id));
    };

    return (
        <div className="fit-tab-layout">
            <div className="fit-tab-main">
                <div className="fit-section-header">
                    <h3>Judo Sessions</h3>
                    <button className="fit-btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
                        <Plus size={13} /> Log Session
                    </button>
                </div>
                {showForm && (
                    <SessionForm showRandori initial={editing || {}}
                        onSave={handleSave}
                        onCancel={() => { setShowForm(false); setEditing(null); }} />
                )}
                <SessionCalendar
                    sessions={sessions}
                    showRandori
                    accentColor={MODULE_COLORS.judo}
                    onEdit={s => { setEditing(s); setShowForm(true); }}
                    onDelete={handleDelete}
                />
            </div>
            <SessionStats sessions={sessions} />
        </div>
    );
}

// ─── TAB: GYM ─────────────────────────────────────────────

function GymTab({ sessions, setSessions }) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);

    const handleSave = async (form) => {
        if (editing) {
            await storage.updateGymSession(editing.id, form);
            setSessions(s => s.map(x => x.id === editing.id ? { ...form, id: editing.id } : x));
        } else {
            const id = await storage.addGymSession(form);
            setSessions(s => [...s, { ...form, id }]);
        }
        setShowForm(false); setEditing(null);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete session?')) return;
        await storage.deleteGymSession(id);
        setSessions(s => s.filter(x => x.id !== id));
    };

    return (
        <div className="fit-tab-layout">
            <div className="fit-tab-main">
                <div className="fit-section-header">
                    <h3>Gym Sessions</h3>
                    <button className="fit-btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
                        <Plus size={13} /> Log Session
                    </button>
                </div>
                {showForm && (
                    <SessionForm initial={editing || {}}
                        onSave={handleSave}
                        onCancel={() => { setShowForm(false); setEditing(null); }} />
                )}
                <SessionCalendar
                    sessions={sessions}
                    accentColor={MODULE_COLORS.gym}
                    onEdit={s => { setEditing(s); setShowForm(true); }}
                    onDelete={handleDelete}
                />
            </div>
            <SessionStats sessions={sessions} />
        </div>
    );
}

// ─── TAB: BODY WEIGHT ─────────────────────────────────────

function BodyWeightTab({ activities, setActivities, logs, setLogs }) {
    const [showActivityForm, setShowActivityForm] = useState(false);
    const [editingActivity, setEditingActivity] = useState(null);
    const [logModal, setLogModal] = useState(null); // activity to log for
    const [editingLog, setEditingLog] = useState(null);
    const [activityForm, setActivityForm] = useState({
        name: '', trackType: 'reps', unit: 'reps',
        goals: { daily: '', weekly: '', monthly: '', yearly: '' }
    });

    const resetActivityForm = () => setActivityForm({
        name: '', trackType: 'reps', unit: 'reps',
        goals: { daily: '', weekly: '', monthly: '', yearly: '' }
    });

    // Auto-calculate goals from daily
    const setDailyGoal = (val) => {
        const n = Number(val);
        setActivityForm(f => ({
            ...f,
            goals: {
                daily:   val,
                weekly:  val ? String(Math.round(n * 7))   : '',
                monthly: val ? String(Math.round(n * 30))  : '',
                yearly:  val ? String(Math.round(n * 365)) : '',
            }
        }));
    };

    const handleSaveActivity = async () => {
        if (!activityForm.name.trim()) return;
        if (editingActivity) {
            await storage.updateBWActivity(editingActivity.id, activityForm);
            setActivities(a => a.map(x => x.id === editingActivity.id ? { ...activityForm, id: editingActivity.id } : x));
        } else {
            const id = await storage.addBWActivity(activityForm);
            setActivities(a => [...a, { ...activityForm, id }]);
        }
        setShowActivityForm(false); setEditingActivity(null); resetActivityForm();
    };

    const handleDeleteActivity = async (id) => {
        if (!window.confirm('Delete activity and all its logs?')) return;
        await storage.deleteBWActivity(id);
        setActivities(a => a.filter(x => x.id !== id));
        const toDelete = logs.filter(l => l.activityId === id);
        await Promise.all(toDelete.map(l => storage.deleteBWLog(l.id)));
        setLogs(l => l.filter(x => x.activityId !== id));
    };

    const handleLogSave = async (activity, value, note) => {
        const log = { activityId: activity.id, date: getTodayStr(), value, note: note || '' };
        const id = await storage.addBWLog(log);
        setLogs(l => [...l, { ...log, id }]);
        setLogModal(null);
    };

    const handleDeleteLog = async (id) => {
        if (!window.confirm('Delete this log entry?')) return;
        await storage.deleteBWLog(id);
        setLogs(l => l.filter(x => x.id !== id));
    };

    const handleUpdateLog = async (id, updates) => {
        await storage.updateBWLog(id, updates);
        setLogs(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x));
    };

    const getTodayTotal = (activityId) => {
        const today = getTodayStr();
        return logs.filter(l => l.activityId === activityId && l.date === today)
            .reduce((a, l) => a + l.value, 0);
    };

    const getActivityStats = (activityId) => {
        const actLogs = logs.filter(l => l.activityId === activityId);
        const now = new Date();
        const weekStart  = format(startOfWeek(now), 'yyyy-MM-dd');
        const weekEnd    = format(endOfWeek(now), 'yyyy-MM-dd');
        const monthKey   = format(now, 'yyyy-MM');
        const lastWeekStart = format(startOfWeek(new Date(now.getTime() - 7*86400000)), 'yyyy-MM-dd');
        const lastWeekEnd   = format(endOfWeek(new Date(now.getTime() - 7*86400000)), 'yyyy-MM-dd');
        const lastMonthKey  = format(new Date(now.getFullYear(), now.getMonth()-1, 1), 'yyyy-MM');
        return {
            weekTotal:      actLogs.filter(l => l.date >= weekStart && l.date <= weekEnd).reduce((a,l) => a+l.value, 0),
            monthTotal:     actLogs.filter(l => l.date?.startsWith(monthKey)).reduce((a,l) => a+l.value, 0),
            yearTotal:      actLogs.filter(l => l.date?.startsWith(String(YEAR))).reduce((a,l) => a+l.value, 0),
            lastWeekTotal:  actLogs.filter(l => l.date >= lastWeekStart && l.date <= lastWeekEnd).reduce((a,l) => a+l.value, 0),
            lastMonthTotal: actLogs.filter(l => l.date?.startsWith(lastMonthKey)).reduce((a,l) => a+l.value, 0),
        };
    };

    const scrollToActivity = (id) => {
        const el = document.getElementById(`bw-activity-${id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="fit-bw-outer">
            {/* Left nav card */}
            <div className="fit-bw-nav-card">
                <div className="fit-bw-nav-header">
                    <span>Activities</span>
                    <button className="fit-btn-primary fit-btn-xs"
                        onClick={() => { resetActivityForm(); setEditingActivity(null); setShowActivityForm(true); }}>
                        <Plus size={11} />
                    </button>
                </div>
                {activities.length === 0 && <p className="fit-empty" style={{ fontSize: '0.65rem' }}>None yet.</p>}
                {activities.map(act => {
                    const todayTotal = getTodayTotal(act.id);
                    const ul = act.trackType === 'reps' ? 'reps' : act.unit;
                    return (
                        <div key={act.id} className="fit-bw-nav-item">
                            <button className="fit-bw-nav-label" onClick={() => scrollToActivity(act.id)}>
                                {act.name}
                            </button>
                            <button
                                className={`fit-bw-today-btn ${todayTotal > 0 ? 'has-log' : ''}`}
                                onClick={() => setLogModal(act)}
                                title={`Today: ${todayTotal} ${ul}. Click to log.`}>
                                {todayTotal > 0 ? todayTotal : '0'}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Right: activity detail area */}
            <div className="fit-bw-main">
                {showActivityForm && (
                    <div className="fit-form" style={{ marginBottom: 12 }}>
                        <div className="fit-form-row">
                            <label>Name
                                <input value={activityForm.name}
                                    onChange={e => setActivityForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Push-ups" />
                            </label>
                            <label>Track Type
                                <select value={activityForm.trackType} onChange={e => {
                                    const t = e.target.value;
                                    setActivityForm(f => ({ ...f, trackType: t, unit: t === 'reps' ? 'reps' : 'seconds' }));
                                }}>
                                    <option value="reps">Reps</option>
                                    <option value="duration">Duration</option>
                                </select>
                            </label>
                            {activityForm.trackType === 'duration' && (
                                <label>Unit
                                    <select value={activityForm.unit} onChange={e => setActivityForm(f => ({ ...f, unit: e.target.value }))}>
                                        <option value="seconds">Seconds</option>
                                        <option value="minutes">Minutes</option>
                                    </select>
                                </label>
                            )}
                        </div>
                        <div className="fit-form-row">
                            <label>Daily Goal
                                <input type="number" min="0" value={activityForm.goals.daily}
                                    onChange={e => setDailyGoal(e.target.value)} />
                            </label>
                            <label style={{ opacity: 0.6 }}>Weekly (auto)
                                <input type="number" value={activityForm.goals.weekly} readOnly />
                            </label>
                            <label style={{ opacity: 0.6 }}>Monthly (auto)
                                <input type="number" value={activityForm.goals.monthly} readOnly />
                            </label>
                            <label style={{ opacity: 0.6 }}>Yearly (auto)
                                <input type="number" value={activityForm.goals.yearly} readOnly />
                            </label>
                        </div>
                        <div className="fit-form-actions">
                            <button className="fit-btn-primary" onClick={handleSaveActivity}>Save</button>
                            <button className="fit-btn" onClick={() => { setShowActivityForm(false); setEditingActivity(null); }}>Cancel</button>
                        </div>
                    </div>
                )}

                {activities.length === 0 && !showActivityForm && (
                    <p className="fit-empty">Add an activity using the panel on the left.</p>
                )}

                {activities.map(act => {
                    const stats = getActivityStats(act.id);
                    const ul = act.trackType === 'reps' ? 'reps' : act.unit;
                    const weekDiff  = stats.weekTotal  - stats.lastWeekTotal;
                    const monthDiff = stats.monthTotal - stats.lastMonthTotal;

                    return (
                        <div key={act.id} id={`bw-activity-${act.id}`} className="fit-bw-card">
                            <div className="fit-bw-card-header">
                                <div className="fit-bw-card-title">
                                    <strong>{act.name}</strong>
                                    <span className="fit-tag">{act.trackType === 'reps' ? 'Reps' : `Duration (${act.unit})`}</span>
                                </div>
                                <EllipsisMenu items={[
                                    { label: 'Edit', icon: <Pencil size={12} />, onClick: () => {
                                        setActivityForm({ ...act, goals: act.goals || { daily:'', weekly:'', monthly:'', yearly:'' } });
                                        setEditingActivity(act); setShowActivityForm(true);
                                    }},
                                    { label: 'Delete', icon: <Trash2 size={12} />, danger: true, onClick: () => handleDeleteActivity(act.id) },
                                ]} />
                            </div>

                            <BWHeatmap
                                activity={act}
                                logs={logs}
                                onEditLog={(log) => setEditingLog(log)}
                                onDeleteLog={handleDeleteLog}
                            />

                            <div className="fit-bw-stats">
                                <div className="fit-bw-stat">
                                    <span className="fit-bw-stat-label">Week</span>
                                    <span className="fit-bw-stat-val">{stats.weekTotal} {ul}</span>
                                    {act.goals?.weekly && <span className="fit-bw-stat-goal">/ {act.goals.weekly}</span>}
                                    {stats.lastWeekTotal > 0 && (
                                        <span className={`fit-trend ${weekDiff >= 0 ? 'up' : 'down'}`}>
                                            {weekDiff >= 0 ? '▲' : '▼'} {Math.abs(weekDiff)}
                                        </span>
                                    )}
                                </div>
                                <div className="fit-bw-stat">
                                    <span className="fit-bw-stat-label">Month</span>
                                    <span className="fit-bw-stat-val">{stats.monthTotal} {ul}</span>
                                    {act.goals?.monthly && <span className="fit-bw-stat-goal">/ {act.goals.monthly}</span>}
                                    {stats.lastMonthTotal > 0 && (
                                        <span className={`fit-trend ${monthDiff >= 0 ? 'up' : 'down'}`}>
                                            {monthDiff >= 0 ? '▲' : '▼'} {Math.abs(monthDiff)}
                                        </span>
                                    )}
                                </div>
                                <div className="fit-bw-stat">
                                    <span className="fit-bw-stat-label">Year</span>
                                    <span className="fit-bw-stat-val">{stats.yearTotal} {ul}</span>
                                    {act.goals?.yearly && <span className="fit-bw-stat-goal">/ {act.goals.yearly}</span>}
                                </div>
                            </div>

                            {act.goals?.weekly && (
                                <div className="fit-progress-row">
                                    <span>Wk</span>
                                    <div className="fit-progress-bg">
                                        <div className="fit-progress-fill" style={{ width: `${Math.min(100,(stats.weekTotal/act.goals.weekly)*100)}%` }} />
                                    </div>
                                    <span>{Math.round((stats.weekTotal/act.goals.weekly)*100)}%</span>
                                </div>
                            )}
                            {act.goals?.monthly && (
                                <div className="fit-progress-row">
                                    <span>Mo</span>
                                    <div className="fit-progress-bg">
                                        <div className="fit-progress-fill" style={{ width: `${Math.min(100,(stats.monthTotal/act.goals.monthly)*100)}%` }} />
                                    </div>
                                    <span>{Math.round((stats.monthTotal/act.goals.monthly)*100)}%</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Log modal */}
            {logModal && (
                <LogInputModal
                    activity={logModal}
                    onSave={(value, note) => handleLogSave(logModal, value, note)}
                    onClose={() => setLogModal(null)}
                />
            )}

            {/* Edit log modal */}
            {editingLog && (
                <div className="form-overlay" onClick={() => setEditingLog(null)}>
                    <div className="cal-detail-modal fit-log-modal" onClick={e => e.stopPropagation()}>
                        <div className="cal-detail-header">
                            <span className="cal-detail-type-badge">Edit Log — {fmtDate(editingLog.date)}</span>
                            <button className="form-close-btn" onClick={() => setEditingLog(null)}><X size={15} /></button>
                        </div>
                        <div className="fit-log-modal-body">
                            <input type="number" min="0" autoFocus
                                value={editingLog.value}
                                onChange={e => setEditingLog(l => ({ ...l, value: Number(e.target.value) }))} />
                            <input placeholder="Note"
                                value={editingLog.note || ''}
                                onChange={e => setEditingLog(l => ({ ...l, note: e.target.value }))} />
                        </div>
                        <div className="fit-form-actions">
                            <button className="fit-btn-primary" onClick={() => {
                                handleUpdateLog(editingLog.id, { value: editingLog.value, note: editingLog.note });
                                setEditingLog(null);
                            }}>Save</button>
                            <button className="fit-btn" onClick={() => setEditingLog(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── TAB: UNIQUE ──────────────────────────────────────────

function UniqueTab({ activities, setActivities }) {
    const [tags, setTags] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [popup, setPopup] = useState(null);
    const [form, setForm] = useState({
        title: '', date: getTodayStr(), startTime: '', endTime: '',
        laps: '', reps: '', sets: '', notes: '',
    });

    useEffect(() => { storage.getUniqueTags().then(setTags); }, []);

    const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!form.title.trim() || !form.date) return;
        if (!tags.includes(form.title.trim())) {
            const newTags = [...tags, form.title.trim()];
            setTags(newTags);
            await storage.saveUniqueTags(newTags);
        }
        if (editing) {
            await storage.updateUniqueActivity(editing.id, form);
            setActivities(a => a.map(x => x.id === editing.id ? { ...form, id: editing.id } : x));
        } else {
            const id = await storage.addUniqueActivity(form);
            setActivities(a => [...a, { ...form, id }]);
        }
        setShowForm(false); setEditing(null);
        setForm({ title: '', date: getTodayStr(), startTime: '', endTime: '', laps: '', reps: '', sets: '', notes: '' });
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete activity?')) return;
        await storage.deleteUniqueActivity(id);
        setActivities(a => a.filter(x => x.id !== id));
    };

    // Group activities by title
    const grouped = {};
    activities.forEach(a => {
        if (!grouped[a.title]) grouped[a.title] = [];
        grouped[a.title].push(a);
    });
    const groupTitles = Object.keys(grouped).sort();

    // Build calendar data for each group
    const year = new Date().getFullYear();
    const months = eachMonthOfInterval({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) });

    return (
        <div className="fit-bw-outer">
            {/* Left nav card */}
            <div className="fit-bw-nav-card">
                <div className="fit-bw-nav-header">
                    <span>Activities</span>
                    <button className="fit-btn-primary fit-btn-xs"
                        onClick={() => { setEditing(null); setShowForm(true); }}>
                        <Plus size={11} />
                    </button>
                </div>
                {groupTitles.length === 0 && <p className="fit-empty" style={{ fontSize: '0.65rem' }}>None yet.</p>}
                {groupTitles.map(title => {
                    const count = grouped[title].length;
                    const monthCount = grouped[title].filter(a => a.date?.startsWith(format(new Date(), 'yyyy-MM'))).length;
                    return (
                        <div key={title} className="fit-bw-nav-item">
                            <button className="fit-bw-nav-label"
                                onClick={() => {
                                    const el = document.getElementById(`unique-group-${title}`);
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}>
                                {title}
                            </button>
                            <span className="fit-bw-today-btn" title={`${monthCount} this month · ${count} total`}
                                style={{ cursor: 'default', minWidth: 28 }}>
                                {count}
                            </span>
                        </div>
                    );
                })}
            </div>
    
            {/* Right: main content */}
            <div className="fit-unique-layout">
                <div className="fit-section-header">
                    <h3>Unique Activities</h3>
                    <button className="fit-btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
                        <Plus size={13} /> Log Activity
                    </button>
                </div>
    
                {showForm && (
                    <div className="fit-form">
                        <div className="fit-form-row">
                            <label>Activity
                                <input list="unique-tags" value={form.title} onChange={e => setF('title', e.target.value)} placeholder="e.g. Hiking" />
                                <datalist id="unique-tags">{tags.map(t => <option key={t} value={t} />)}</datalist>
                            </label>
                            <label>Date<input type="date" value={form.date} onChange={e => setF('date', e.target.value)} /></label>
                            <label>Start<input type="time" value={form.startTime} onChange={e => setF('startTime', e.target.value)} /></label>
                            <label>End<input type="time" value={form.endTime} onChange={e => setF('endTime', e.target.value)} /></label>
                        </div>
                        <div className="fit-form-row">
                            <label>Laps<input type="number" min="0" value={form.laps} onChange={e => setF('laps', e.target.value)} style={{ width: 70 }} /></label>
                            <label>Reps<input type="number" min="0" value={form.reps} onChange={e => setF('reps', e.target.value)} style={{ width: 70 }} /></label>
                            <label>Sets<input type="number" min="0" value={form.sets} onChange={e => setF('sets', e.target.value)} style={{ width: 70 }} /></label>
                        </div>
                        <textarea placeholder="Notes" value={form.notes} onChange={e => setF('notes', e.target.value)} rows={2} />
                        <div className="fit-form-actions">
                            <button className="fit-btn-primary" onClick={handleSave}>Save</button>
                            <button className="fit-btn" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button>
                        </div>
                    </div>
                )}
    
                {groupTitles.length === 0 && !showForm && <p className="fit-empty">No activities logged yet.</p>}
    
                {groupTitles.map(title => {
                    const group = grouped[title].sort((a,b) => b.date.localeCompare(a.date));
                    const byDate = {};
                    group.forEach(a => {
                        if (!byDate[a.date]) byDate[a.date] = [];
                        byDate[a.date].push(a);
                    });
                    const activeDates = Object.keys(byDate).sort();
                    const now = new Date();
                    const monthKey = format(now, 'yyyy-MM');
                    const monthCount = group.filter(a => a.date?.startsWith(monthKey)).length;
                    const yearCount  = group.filter(a => a.date?.startsWith(String(YEAR))).length;
                    const totalMins  = group.reduce((a,s) => a + calcMinutes(s.startTime, s.endTime), 0);
    
                    return (
                        <div key={title} id={`unique-group-${title}`} className="fit-unique-group">
                            <div className="fit-unique-group-header">
                                <div className="fit-unique-group-title">
                                    <strong>{title}</strong>
                                    <span className="fit-tag">{monthCount} this month</span>
                                    <span className="fit-tag">{yearCount} this year</span>
                                    {totalMins > 0 && <span className="fit-tag">{fmtMins(totalMins)} total</span>}
                                </div>
                                <button className="fit-btn-primary fit-btn-xs"
                                    onClick={() => { setForm(f => ({ ...f, title })); setEditing(null); setShowForm(true); }}>
                                    <Plus size={11} />
                                </button>
                            </div>
    
                            <div className="fit-cal-grid-year">
                                {months.map(month => {
                                    const monthKey = format(month, 'yyyy-MM');
                                    const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
                                    const offset = getDay(startOfMonth(month));
                                    const mCount = group.filter(a => a.date?.startsWith(monthKey)).length;
                                    return (
                                        <div key={monthKey} className="fit-cal-month">
                                            <div className="fit-cal-month-header">
                                                <span>{format(month, 'MMM')}</span>
                                                <span className="fit-cal-month-count">{mCount > 0 ? mCount : '—'}</span>
                                            </div>
                                            <div className="fit-cal-month-grid">
                                                {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="fit-cal-weekday">{d}</div>)}
                                                {Array.from({ length: offset }).map((_,i) => <div key={`e${i}`} />)}
                                                {days.map(day => {
                                                    const ds = format(day, 'yyyy-MM-dd');
                                                    const dayActs = byDate[ds] || [];
                                                    const has = dayActs.length > 0;
                                                    return (
                                                        <div key={ds}
                                                            className={`fit-cal-day ${has ? 'has-session' : 'empty-day'} ${isToday(day) ? 'today' : ''}`}
                                                            style={has ? { background: MODULE_COLORS.unique } : {}}
                                                            onClick={() => has && setPopup({ date: ds, sessions: dayActs, activeDates, title })}
                                                            title={fmtDate(ds)}>
                                                            <span className="fit-day-num" style={has ? { color: 'white' } : {}}>{format(day, 'd')}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
    
            {popup && (
                <DayPopup
                    date={popup.date}
                    sessions={popup.sessions}
                    activeDates={popup.activeDates}
                    onClose={(next) => {
                        if (next) {
                            const byDate = {};
                            (grouped[popup.title] || []).forEach(a => {
                                if (!byDate[a.date]) byDate[a.date] = [];
                                byDate[a.date].push(a);
                            });
                            setPopup(p => ({ ...p, date: next, sessions: byDate[next] || [] }));
                        } else {
                            setPopup(null);
                        }
                    }}
                    onEdit={(a) => { setEditing(a); setForm({ ...a }); setShowForm(true); }}
                    onDelete={handleDelete}
                />
            )}
        </div>
    );
}

// ─── TAB: ALL ─────────────────────────────────────────────

function AllTab({ judoSessions, gymSessions, bwLogs, uniqueActivities }) {
    const [popup, setPopup] = useState(null);
    const year = new Date().getFullYear();
    const months = eachMonthOfInterval({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) });

    const dayMap = {};
    const mark = (date, type, data) => {
        if (!date) return;
        if (!dayMap[date]) dayMap[date] = { types: new Set(), data: {} };
        dayMap[date].types.add(type);
        if (!dayMap[date].data[type]) dayMap[date].data[type] = [];
        dayMap[date].data[type].push(data);
    };
    judoSessions.forEach(s => mark(s.date, 'judo', s));
    gymSessions.forEach(s => mark(s.date, 'gym', s));
    uniqueActivities.forEach(a => mark(a.date, 'unique', a));
    const bwByDate = {};
    bwLogs.forEach(l => { if (!bwByDate[l.date]) bwByDate[l.date] = []; bwByDate[l.date].push(l); });
    Object.entries(bwByDate).forEach(([date, ls]) => mark(date, 'bw', ls));

    const activeDates = Object.keys(dayMap).sort();

    const buildPopupSessions = (ds) => {
        const entry = dayMap[ds];
        if (!entry) return [];
        const all = [];
        if (entry.data.judo)   entry.data.judo.forEach(s => all.push({ ...s, _type: 'Judo' }));
        if (entry.data.gym)    entry.data.gym.forEach(s =>  all.push({ ...s, _type: 'Gym' }));
        if (entry.data.unique) entry.data.unique.forEach(s => all.push({ ...s, _type: 'Unique', title: s.title }));
        if (entry.data.bw)     all.push({ _type: 'Body Weight', value: entry.data.bw.flat().reduce((a,l) => a+l.value, 0), unit: 'total' });
        return all;
    };

    const statModules = [
        { key: 'judo',   label: 'Judo',       color: MODULE_COLORS.judo,   sessions: judoSessions,     hasMins: true },
        { key: 'gym',    label: 'Gym',         color: MODULE_COLORS.gym,    sessions: gymSessions,      hasMins: true },
        { key: 'bw',     label: 'Body Weight', color: MODULE_COLORS.bw,     sessions: [],               hasMins: false },
        { key: 'unique', label: 'Unique',      color: MODULE_COLORS.unique, sessions: uniqueActivities, hasMins: true },
    ];

    return (
        <div className="fit-all-layout">
            <div className="fit-all-calendar">
                <div className="fit-all-legend">
                    {statModules.map(m => (
                        <span key={m.key} className="fit-legend-item">
                            <span className="fit-legend-dot" style={{ background: m.color }} />{m.label}
                        </span>
                    ))}
                </div>
                <div className="fit-cal-grid-year">
                    {months.map(month => {
                        const monthKey = format(month, 'yyyy-MM');
                        const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
                        const offset = getDay(startOfMonth(month));
                        return (
                            <div key={monthKey} className="fit-cal-month">
                                <div className="fit-cal-month-header">
                                    <span>{format(month, 'MMM yyyy')}</span>
                                </div>
                                <div className="fit-cal-month-grid">
                                    {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="fit-cal-weekday">{d}</div>)}
                                    {Array.from({ length: offset }).map((_,i) => <div key={`e${i}`} />)}
                                    {days.map(day => {
                                        const ds = format(day, 'yyyy-MM-dd');
                                        const entry = dayMap[ds];
                                        const types = entry ? [...entry.types] : [];
                                        const hasAny = types.length > 0;
                                        return (
                                            <div key={ds}
                                                className={`fit-cal-day fit-all-day ${isToday(day) ? 'today' : ''} ${hasAny ? '' : 'empty-day'}`}
                                                onClick={() => hasAny && setPopup({ date: ds, sessions: buildPopupSessions(ds) })}
                                                title={fmtDate(ds)}>
                                                <span className="fit-day-num">{format(day, 'd')}</span>
                                                <div className="fit-all-day-dots">
                                                    {['judo','gym','bw','unique'].map(type => (
                                                        <span key={type} className="fit-all-dot"
                                                            style={{ background: types.includes(type) ? MODULE_COLORS[type] : 'transparent' }} />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="fit-all-stats">
                {statModules.map(m => {
                    const totalDays = m.key === 'bw'
                        ? new Set(bwLogs.filter(l => l.date?.startsWith(String(YEAR))).map(l => l.date)).size
                        : new Set(m.sessions.filter(s => s.date?.startsWith(String(YEAR))).map(s => s.date)).size;
                    const totalMins = m.hasMins ? m.sessions.reduce((a,s) => a + calcMinutes(s.startTime, s.endTime), 0) : 0;
                    return (
                        <div key={m.key} className="fit-all-stat-card" style={{ borderLeftColor: m.color }}>
                            <div className="fit-all-stat-title" style={{ color: m.color }}>{m.label}</div>
                            <div className="fit-all-stat-row">{totalDays} days this year</div>
                            {totalMins > 0 && <div className="fit-all-stat-row">{fmtMins(totalMins)} this year</div>}
                            <table className="fit-stats-table fit-stats-table-sm">
                                <thead><tr><th>Mo</th><th>Days</th>{m.hasMins && <th>Hrs</th>}</tr></thead>
                                <tbody>
                                    {ALL_MONTHS.map(mo => {
                                        let days, mins;
                                        if (m.key === 'bw') {
                                            days = new Set(bwLogs.filter(l => l.date?.startsWith(mo)).map(l => l.date)).size;
                                            mins = 0;
                                        } else {
                                            const mS = m.sessions.filter(s => s.date?.startsWith(mo));
                                            days = new Set(mS.map(s => s.date)).size;
                                            mins = mS.reduce((a,s) => a + calcMinutes(s.startTime, s.endTime), 0);
                                        }
                                        return (
                                            <tr key={mo} className={days === 0 ? 'fit-row-empty' : ''}>
                                                <td>{format(parseISO(mo+'-01'), 'MMM')}</td>
                                                <td>{days || '—'}</td>
                                                {m.hasMins && <td>{fmtMins(mins)}</td>}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    );
                })}
            </div>

            {popup && (
                <DayPopup
                    date={popup.date}
                    sessions={popup.sessions}
                    activeDates={activeDates}
                    onClose={(next) => {
                        if (next) setPopup({ date: next, sessions: buildPopupSessions(next) });
                        else setPopup(null);
                    }}
                />
            )}
        </div>
    );
}

// ─── MAIN ─────────────────────────────────────────────────

function Fitness() {
    const [tab, setTab] = useState('judo');
    const [judoSessions,     setJudoSessions]     = useState([]);
    const [gymSessions,      setGymSessions]      = useState([]);
    const [bwLogs,           setBwLogs]           = useState([]);
    const [bwActivities,     setBwActivities]     = useState([]);
    const [uniqueActivities, setUniqueActivities] = useState([]);
    const [loading,          setLoading]          = useState(true);

    useEffect(() => {
        Promise.all([
            storage.getJudoSessions(),
            storage.getGymSessions(),
            storage.getBWLogs(),
            storage.getBWActivities(),
            storage.getUniqueActivities(),
        ]).then(([judo, gym, bwl, bwa, uniq]) => {
            setJudoSessions(judo);
            setGymSessions(gym);
            setBwLogs(bwl);
            setBwActivities(bwa);
            setUniqueActivities(uniq);
            setLoading(false);
        });
    }, []);

    const TABS = ['judo', 'gym', 'bodyweight', 'unique', 'all'];
    if (loading) return <div className="fit-loading">Loading…</div>;

    return (
        <div className="fitness-view module-fitness">
            <div className="fit-header">
                <h1>Fitness</h1>
                <div className="fit-tabs">
                    {TABS.map(t => (
                        <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                            {t === 'bodyweight' ? 'Body Weight' : t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>
            </div>
            {tab === 'judo'       && <JudoTab sessions={judoSessions} setSessions={setJudoSessions} />}
            {tab === 'gym'        && <GymTab  sessions={gymSessions}  setSessions={setGymSessions} />}
            {tab === 'bodyweight' && <BodyWeightTab activities={bwActivities} setActivities={setBwActivities} logs={bwLogs} setLogs={setBwLogs} />}
            {tab === 'unique'     && <UniqueTab activities={uniqueActivities} setActivities={setUniqueActivities} />}
            {tab === 'all'        && <AllTab judoSessions={judoSessions} gymSessions={gymSessions} bwLogs={bwLogs} uniqueActivities={uniqueActivities} />}
        </div>
    );
}

export default Fitness;