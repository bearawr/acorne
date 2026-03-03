import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../../utils/storage';
import {
    format, parseISO, isToday, startOfMonth, endOfMonth,
    eachDayOfInterval, getDay, startOfWeek, endOfWeek,
    eachMonthOfInterval
} from 'date-fns';
import { Plus, Pencil, Trash2, X, MoreVertical } from 'lucide-react';
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

// Convert "HH:MM" 24hr to "h:MM AM/PM"
const fmt12 = (timeStr) => {
    if (!timeStr) return '';
    try {
        const [h, m] = timeStr.split(':').map(Number);
        const period = h >= 12 ? 'PM' : 'AM';
        const hour = h % 12 || 12;
        return `${hour}:${String(m).padStart(2,'0')} ${period}`;
    } catch { return timeStr; }
};

// Format "yyyy-MM-dd" to "Mar 4, 2026"
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
    judo:   '#6366f1',
    gym:    '#10b981',
    bw:     '#f59e0b',
    unique: '#ef4444',
};

// ─── ELLIPSIS MENU ────────────────────────────────────────

function EllipsisMenu({ items }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, []);

    return (
        <div className="task-menu-container" ref={ref} onClick={e => e.stopPropagation()}>
            <button className="ellipsis-btn" onClick={() => setOpen(o => !o)}>
                <MoreVertical size={13} />
            </button>
            {open && (
                <div className="task-dropdown">
                    {items.map((item, i) => (
                        <button key={i}
                            className={item.danger ? 'delete-opt' : ''}
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

function DayPopup({ date, sessions, onClose, showRandori = false, type = 'session' }) {
    if (!date) return null;
    return (
        <div className="form-overlay" onClick={onClose}>
            <div className="cal-detail-modal" onClick={e => e.stopPropagation()}>
                <div className="cal-detail-header">
                    <span className="cal-detail-type-badge">{fmtDate(date)}</span>
                    <button className="form-close-btn" onClick={onClose}><X size={15} /></button>
                </div>
                {sessions.length === 0 && <p className="fit-empty">No sessions this day.</p>}
                {sessions.map((s, i) => (
                    <div key={s.id || i} className="fit-popup-session">
                        {s.startTime && s.endTime && (
                            <div className="fit-popup-row">
                                <strong>{fmt12(s.startTime)} – {fmt12(s.endTime)}</strong>
                                <span className="fit-session-dur">({fmtMins(calcMinutes(s.startTime, s.endTime))})</span>
                            </div>
                        )}
                        {showRandori && s.randori && (
                            <div className="fit-popup-row"><span className="fit-tag">{s.randori} randori</span></div>
                        )}
                        {s.title && <div className="fit-popup-row"><span className="fit-tag">{s.title}</span></div>}
                        {s.laps  && <div className="fit-popup-row"><span>{s.laps} laps</span></div>}
                        {s.reps  && <div className="fit-popup-row"><span>{s.reps} reps</span></div>}
                        {s.sets  && <div className="fit-popup-row"><span>{s.sets} sets</span></div>}
                        {s.value !== undefined && (
                            <div className="fit-popup-row"><span className="fit-bw-stat-val">{s.value} {s.unit}</span></div>
                        )}
                        {s.notes && <div className="fit-popup-notes">{s.notes}</div>}
                        {sessions.length > 1 && i < sessions.length - 1 && <hr className="fit-popup-divider" />}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── SESSION CALENDAR (Judo / Gym) ────────────────────────

function SessionCalendar({ sessions, showRandori = false }) {
    const [popup, setPopup] = useState(null); // { date, sessions }
    const year = new Date().getFullYear();
    const months = eachMonthOfInterval({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) });

    const sessionsByDate = {};
    sessions.forEach(s => {
        if (!sessionsByDate[s.date]) sessionsByDate[s.date] = [];
        sessionsByDate[s.date].push(s);
    });

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
                                <span className="fit-cal-month-count">{uniqueDays} days</span>
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
                                    return (
                                        <div key={ds}
                                            className={`fit-cal-day ${has ? 'has-session' : ''} ${isToday(day) ? 'today' : ''} ${has ? 'clickable' : ''}`}
                                            title={has ? `${daySessions.length} session(s)` : ''}
                                            onClick={() => has && setPopup({ date: ds, sessions: daySessions })}>
                                            {has && <span className="fit-cal-check">✓</span>}
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
                    showRandori={showRandori}
                    onClose={() => setPopup(null)}
                />
            )}
        </>
    );
}

// ─── BW HEATMAP ───────────────────────────────────────────

function BWHeatmap({ activity, logs }) {
    const [popup, setPopup] = useState(null);
    const year = new Date().getFullYear();
    const months = eachMonthOfInterval({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) });

    const actLogs = logs.filter(l => l.activityId === activity.id);

    // Build date -> total value map
    const dateMap = {};
    actLogs.forEach(l => {
        dateMap[l.date] = (dateMap[l.date] || 0) + l.value;
    });
    const values = Object.values(dateMap);
    const maxVal = values.length > 0 ? Math.max(...values) : 1;

    const getIntensity = (val) => {
        if (!val) return 0;
        return Math.max(0.15, val / maxVal);
    };

    const ul = activity.trackType === 'reps' ? 'reps' : activity.unit;

    return (
        <>
            <div className="fit-cal-grid-year">
                {months.map(month => {
                    const monthKey = format(month, 'yyyy-MM');
                    const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
                    const offset = getDay(startOfMonth(month));
                    const monthTotal = actLogs
                        .filter(l => l.date?.startsWith(monthKey))
                        .reduce((a, l) => a + l.value, 0);

                    return (
                        <div key={monthKey} className="fit-cal-month">
                            <div className="fit-cal-month-header">
                                <span>{format(month, 'MMM')}</span>
                                <span className="fit-cal-month-count">{monthTotal > 0 ? `${monthTotal} ${ul}` : '—'}</span>
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
                                    const dayLogs = actLogs.filter(l => l.date === ds);

                                    return (
                                        <div key={ds}
                                            className={`fit-cal-day fit-heatmap-day ${isToday(day) ? 'today' : ''} ${val > 0 ? 'clickable' : ''}`}
                                            style={val > 0 ? { background: `rgba(99,102,241,${intensity})`, color: intensity > 0.5 ? 'white' : 'inherit' } : {}}
                                            title={val > 0 ? `${val} ${ul}` : ''}
                                            onClick={() => val > 0 && setPopup({
                                                date: ds,
                                                sessions: dayLogs.map(l => ({ ...l, unit: ul }))
                                            })}>
                                            {val > 0 && <span className="fit-heatmap-val">{val}</span>}
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
                    onClose={() => setPopup(null)}
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
                <div><span className="fit-stat-big">{totalDays}</span> days trained</div>
                <div><span className="fit-stat-big">{fmtMins(totalMins)}</span> total</div>
            </div>
            <table className="fit-stats-table">
                <thead><tr><th>Month</th><th>Days</th><th>Hours</th></tr></thead>
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
                {showRandori && (
                    <label>Randori #<input type="number" min="0" value={form.randori} onChange={e => set('randori', e.target.value)} style={{ width: 60 }} /></label>
                )}
            </div>
            <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            <div className="fit-form-actions">
                <button className="fit-btn-primary" onClick={() => onSave(form)}>Save</button>
                <button className="fit-btn" onClick={onCancel}>Cancel</button>
            </div>
        </div>
    );
}

// ─── SESSION LIST ─────────────────────────────────────────

function SessionList({ sessions, onEdit, onDelete, showRandori = false }) {
    const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
    if (sorted.length === 0) return <p className="fit-empty">No sessions logged yet.</p>;
    return (
        <div className="fit-session-list">
            {sorted.map(s => (
                <div key={s.id} className="fit-session-row">
                    <div className="fit-session-main">
                        <span className="fit-session-date">{fmtDate(s.date)}</span>
                        {s.startTime && s.endTime && (
                            <span className="fit-session-time">
                                {fmt12(s.startTime)} – {fmt12(s.endTime)}
                                <span className="fit-session-dur"> ({fmtMins(calcMinutes(s.startTime, s.endTime))})</span>
                            </span>
                        )}
                        {showRandori && s.randori && (
                            <span className="fit-session-tag">{s.randori} randori</span>
                        )}
                    </div>
                    {s.notes && <div className="fit-session-notes">{s.notes}</div>}
                    <EllipsisMenu items={[
                        { label: 'Edit', icon: <Pencil size={12} />, onClick: () => onEdit(s) },
                        { label: 'Delete', icon: <Trash2 size={12} />, danger: true, onClick: () => onDelete(s.id) },
                    ]} />
                </div>
            ))}
        </div>
    );
}

// ─── LOG ROW (BW) ─────────────────────────────────────────

function LogRow({ log, ul, onDelete, onUpdate }) {
    const [editing, setEditing] = useState(false);
    const [editVal, setEditVal] = useState(log.value);
    const [editNote, setEditNote] = useState(log.note || '');

    const handleSave = () => {
        onUpdate(log.id, { value: Number(editVal), note: editNote });
        setEditing(false);
    };

    if (editing) {
        return (
            <div className="fit-log-row fit-log-row-editing">
                <span className="fit-log-date">{fmtDate(log.date)}</span>
                <input type="number" min="0" value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    style={{ width: 60 }} autoFocus />
                <input placeholder="Note" value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    style={{ flex: 1 }} />
                <button className="fit-btn-primary" style={{ padding: '2px 8px', fontSize: '0.68rem' }} onClick={handleSave}>Save</button>
                <button className="fit-btn" style={{ padding: '2px 8px', fontSize: '0.68rem' }} onClick={() => setEditing(false)}>✕</button>
            </div>
        );
    }

    return (
        <div className="fit-log-row">
            <span className="fit-log-date">{fmtDate(log.date)}</span>
            <span className="fit-log-val">{log.value} {ul}</span>
            {log.note && <span className="fit-log-note">{log.note}</span>}
            <EllipsisMenu items={[
                { label: 'Edit', icon: <Pencil size={12} />, onClick: () => setEditing(true) },
                { label: 'Delete', icon: <Trash2 size={12} />, danger: true, onClick: () => onDelete(log.id) },
            ]} />
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
                <SessionCalendar sessions={sessions} showRandori />
                <SessionList sessions={sessions} showRandori
                    onEdit={s => { setEditing(s); setShowForm(true); }}
                    onDelete={handleDelete} />
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
                <SessionCalendar sessions={sessions} />
                <SessionList sessions={sessions}
                    onEdit={s => { setEditing(s); setShowForm(true); }}
                    onDelete={handleDelete} />
            </div>
            <SessionStats sessions={sessions} />
        </div>
    );
}

// ─── TAB: BODY WEIGHT ─────────────────────────────────────

function BodyWeightTab({ activities, setActivities, logs, setLogs }) {
    const [showActivityForm, setShowActivityForm] = useState(false);
    const [editingActivity, setEditingActivity] = useState(null);
    const [logForms, setLogForms] = useState({});
    const [activityForm, setActivityForm] = useState({
        name: '', trackType: 'reps', unit: 'reps',
        goals: { daily: '', weekly: '', monthly: '', yearly: '' }
    });

    const resetActivityForm = () => setActivityForm({
        name: '', trackType: 'reps', unit: 'reps',
        goals: { daily: '', weekly: '', monthly: '', yearly: '' }
    });

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

    const handleLogSubmit = async (activity) => {
        const f = logForms[activity.id] || {};
        if (!f.value) return;
        const log = { activityId: activity.id, date: getTodayStr(), value: Number(f.value), note: f.note || '' };
        const id = await storage.addBWLog(log);
        setLogs(l => [...l, { ...log, id }]);
        setLogForms(f => ({ ...f, [activity.id]: { value: '', note: '' } }));
    };

    const handleDeleteLog = async (id) => {
        await storage.deleteBWLog(id);
        setLogs(l => l.filter(x => x.id !== id));
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

    return (
        <div className="fit-bw-layout">
            <div className="fit-section-header">
                <h3>Body Weight Activities</h3>
                <button className="fit-btn-primary" onClick={() => { resetActivityForm(); setEditingActivity(null); setShowActivityForm(true); }}>
                    <Plus size={13} /> Add Activity
                </button>
            </div>

            {showActivityForm && (
                <div className="fit-form">
                    <div className="fit-form-row">
                        <label>Name
                            <input value={activityForm.name} onChange={e => setActivityForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Push-ups" />
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
                        <label>Daily Goal    <input type="number" min="0" value={activityForm.goals.daily}   onChange={e => setActivityForm(f => ({ ...f, goals: { ...f.goals, daily:   e.target.value } }))} /></label>
                        <label>Weekly Goal   <input type="number" min="0" value={activityForm.goals.weekly}  onChange={e => setActivityForm(f => ({ ...f, goals: { ...f.goals, weekly:  e.target.value } }))} /></label>
                        <label>Monthly Goal  <input type="number" min="0" value={activityForm.goals.monthly} onChange={e => setActivityForm(f => ({ ...f, goals: { ...f.goals, monthly: e.target.value } }))} /></label>
                        <label>Yearly Goal   <input type="number" min="0" value={activityForm.goals.yearly}  onChange={e => setActivityForm(f => ({ ...f, goals: { ...f.goals, yearly:  e.target.value } }))} /></label>
                    </div>
                    <div className="fit-form-actions">
                        <button className="fit-btn-primary" onClick={handleSaveActivity}>Save</button>
                        <button className="fit-btn" onClick={() => { setShowActivityForm(false); setEditingActivity(null); }}>Cancel</button>
                    </div>
                </div>
            )}

            {activities.length === 0 && !showActivityForm && <p className="fit-empty">No activities yet. Add one above.</p>}

            {activities.map(act => {
                const stats = getActivityStats(act.id);
                const actLogs = logs.filter(l => l.activityId === act.id).sort((a,b) => b.date.localeCompare(a.date));
                const lf = logForms[act.id] || { value: '', note: '' };
                const ul = act.trackType === 'reps' ? 'reps' : act.unit;
                const weekDiff  = stats.weekTotal  - stats.lastWeekTotal;
                const monthDiff = stats.monthTotal - stats.lastMonthTotal;

                return (
                    <div key={act.id} className="fit-bw-card">
                        <div className="fit-bw-card-header">
                            <div className="fit-bw-card-title">
                                <strong>{act.name}</strong>
                                <span className="fit-tag">{act.trackType === 'reps' ? 'Reps' : `Duration (${act.unit})`}</span>
                            </div>
                            <EllipsisMenu items={[
                                { label: 'Edit', icon: <Pencil size={12} />, onClick: () => { setActivityForm({ ...act }); setEditingActivity(act); setShowActivityForm(true); } },
                                { label: 'Delete', icon: <Trash2 size={12} />, danger: true, onClick: () => handleDeleteActivity(act.id) },
                            ]} />
                        </div>

                        {/* Heatmap */}
                        <BWHeatmap activity={act} logs={logs} />

                        {/* Stats */}
                        <div className="fit-bw-stats">
                            <div className="fit-bw-stat">
                                <span className="fit-bw-stat-label">This week</span>
                                <span className="fit-bw-stat-val">{stats.weekTotal} {ul}</span>
                                {act.goals.weekly && <span className="fit-bw-stat-goal">/ {act.goals.weekly} goal</span>}
                                {stats.lastWeekTotal > 0 && (
                                    <span className={`fit-trend ${weekDiff >= 0 ? 'up' : 'down'}`}>
                                        {weekDiff >= 0 ? '▲' : '▼'} {Math.abs(weekDiff)} vs last week
                                    </span>
                                )}
                            </div>
                            <div className="fit-bw-stat">
                                <span className="fit-bw-stat-label">This month</span>
                                <span className="fit-bw-stat-val">{stats.monthTotal} {ul}</span>
                                {act.goals.monthly && <span className="fit-bw-stat-goal">/ {act.goals.monthly} goal</span>}
                                {stats.lastMonthTotal > 0 && (
                                    <span className={`fit-trend ${monthDiff >= 0 ? 'up' : 'down'}`}>
                                        {monthDiff >= 0 ? '▲' : '▼'} {Math.abs(monthDiff)} vs last month
                                    </span>
                                )}
                            </div>
                            <div className="fit-bw-stat">
                                <span className="fit-bw-stat-label">This year</span>
                                <span className="fit-bw-stat-val">{stats.yearTotal} {ul}</span>
                                {act.goals.yearly && <span className="fit-bw-stat-goal">/ {act.goals.yearly} goal</span>}
                            </div>
                        </div>

                        {act.goals.weekly && (
                            <div className="fit-progress-row">
                                <span>Weekly</span>
                                <div className="fit-progress-bg">
                                    <div className="fit-progress-fill" style={{ width: `${Math.min(100, (stats.weekTotal / act.goals.weekly) * 100)}%` }} />
                                </div>
                                <span>{Math.round((stats.weekTotal / act.goals.weekly) * 100)}%</span>
                            </div>
                        )}
                        {act.goals.monthly && (
                            <div className="fit-progress-row">
                                <span>Monthly</span>
                                <div className="fit-progress-bg">
                                    <div className="fit-progress-fill" style={{ width: `${Math.min(100, (stats.monthTotal / act.goals.monthly) * 100)}%` }} />
                                </div>
                                <span>{Math.round((stats.monthTotal / act.goals.monthly) * 100)}%</span>
                            </div>
                        )}

                        {/* Log input */}
                        <div className="fit-log-input-row">
                            <input type="number" min="0" placeholder={`Log ${ul} today`}
                                value={lf.value}
                                onChange={e => setLogForms(f => ({ ...f, [act.id]: { ...lf, value: e.target.value } }))}
                                onKeyDown={e => e.key === 'Enter' && handleLogSubmit(act)} />
                            <input placeholder="Note (optional)" value={lf.note}
                                onChange={e => setLogForms(f => ({ ...f, [act.id]: { ...lf, note: e.target.value } }))}
                                onKeyDown={e => e.key === 'Enter' && handleLogSubmit(act)} />
                            <button className="fit-btn-primary" onClick={() => handleLogSubmit(act)}>Add</button>
                        </div>

                        {actLogs.length > 0 && (
                            <div className="fit-log-list">
                                {actLogs.slice(0, 10).map(l => (
                                    <LogRow key={l.id} log={l} ul={ul}
                                        onDelete={handleDeleteLog}
                                        onUpdate={(id, updates) => {
                                            storage.updateBWLog(id, updates);
                                            setLogs(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x));
                                        }} />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── TAB: UNIQUE ──────────────────────────────────────────

function UniqueTab({ activities, setActivities }) {
    const [tags, setTags] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({
        title: '', date: getTodayStr(), startTime: '', endTime: '',
        laps: '', reps: '', sets: '', notes: '',
    });
    const [popup, setPopup] = useState(null);

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

    const year = new Date().getFullYear();
    const months = eachMonthOfInterval({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) });
    const actByDate = {};
    activities.forEach(a => {
        if (!actByDate[a.date]) actByDate[a.date] = [];
        actByDate[a.date].push(a);
    });

    return (
        <div className="fit-tab-layout">
            <div className="fit-tab-main">
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

                {/* Year calendar */}
                <div className="fit-cal-grid-year">
                    {months.map(month => {
                        const monthKey = format(month, 'yyyy-MM');
                        const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
                        const offset = getDay(startOfMonth(month));
                        const monthCount = activities.filter(a => a.date?.startsWith(monthKey)).length;

                        return (
                            <div key={monthKey} className="fit-cal-month">
                                <div className="fit-cal-month-header">
                                    <span>{format(month, 'MMM')}</span>
                                    <span className="fit-cal-month-count">{monthCount > 0 ? `${monthCount} activities` : '—'}</span>
                                </div>
                                <div className="fit-cal-month-grid">
                                    {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="fit-cal-weekday">{d}</div>)}
                                    {Array.from({ length: offset }).map((_,i) => <div key={`e${i}`} />)}
                                    {days.map(day => {
                                        const ds = format(day, 'yyyy-MM-dd');
                                        const dayActs = actByDate[ds] || [];
                                        return (
                                            <div key={ds}
                                                className={`fit-cal-day ${dayActs.length ? 'has-session clickable' : ''} ${isToday(day) ? 'today' : ''}`}
                                                title={dayActs.map(a => a.title).join(', ')}
                                                onClick={() => dayActs.length && setPopup({ date: ds, sessions: dayActs })}>
                                                {dayActs.length > 0 && (
                                                    <span className="fit-unique-label">{dayActs[0].title.slice(0,3)}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Activity list */}
                <div className="fit-session-list" style={{ marginTop: 16 }}>
                    {[...activities].sort((a,b) => b.date.localeCompare(a.date)).map(a => (
                        <div key={a.id} className="fit-session-row">
                            <div className="fit-session-main">
                                <span className="fit-session-date">{fmtDate(a.date)}</span>
                                <span className="fit-tag">{a.title}</span>
                                {a.startTime && a.endTime && (
                                    <span className="fit-session-time">
                                        {fmt12(a.startTime)} – {fmt12(a.endTime)}
                                        <span className="fit-session-dur"> ({fmtMins(calcMinutes(a.startTime, a.endTime))})</span>
                                    </span>
                                )}
                                {a.laps && <span className="fit-session-tag">{a.laps} laps</span>}
                                {a.reps && <span className="fit-session-tag">{a.reps} reps</span>}
                                {a.sets && <span className="fit-session-tag">{a.sets} sets</span>}
                            </div>
                            {a.notes && <div className="fit-session-notes">{a.notes}</div>}
                            <EllipsisMenu items={[
                                { label: 'Edit', icon: <Pencil size={12} />, onClick: () => { setEditing(a); setForm({ ...a }); setShowForm(true); } },
                                { label: 'Delete', icon: <Trash2 size={12} />, danger: true, onClick: () => handleDelete(a.id) },
                            ]} />
                        </div>
                    ))}
                    {activities.length === 0 && <p className="fit-empty">No activities logged yet.</p>}
                </div>
            </div>

            {/* Stats panel */}
            <div className="fit-stats-panel">
                <div className="fit-stat-total">
                    <div><span className="fit-stat-big">{activities.length}</span> total</div>
                </div>
                <table className="fit-stats-table">
                    <thead><tr><th>Month</th><th>Count</th><th>Hours</th></tr></thead>
                    <tbody>
                        {ALL_MONTHS.map(m => {
                            const mActs = activities.filter(a => a.date?.startsWith(m));
                            const mins = mActs.reduce((acc, a) => acc + calcMinutes(a.startTime, a.endTime), 0);
                            return (
                                <tr key={m} className={mActs.length === 0 ? 'fit-row-empty' : ''}>
                                    <td>{monthLabel(m)}</td>
                                    <td>{mActs.length || '—'}</td>
                                    <td>{fmtMins(mins)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {popup && (
                <DayPopup date={popup.date} sessions={popup.sessions} onClose={() => setPopup(null)} />
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
    const bwDays = {};
    bwLogs.forEach(l => {
        if (!bwDays[l.date]) bwDays[l.date] = [];
        bwDays[l.date].push(l);
    });
    Object.entries(bwDays).forEach(([date, ls]) => mark(date, 'bw', ls));

    const statModules = [
        { key: 'judo',   label: 'Judo',        color: MODULE_COLORS.judo,   sessions: judoSessions,     hasMins: true },
        { key: 'gym',    label: 'Gym',          color: MODULE_COLORS.gym,    sessions: gymSessions,      hasMins: true },
        { key: 'bw',     label: 'Body Weight',  color: MODULE_COLORS.bw,     sessions: [],               hasMins: false },
        { key: 'unique', label: 'Unique',       color: MODULE_COLORS.unique, sessions: uniqueActivities, hasMins: true },
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
                                                className={`fit-cal-day fit-all-day ${isToday(day) ? 'today' : ''} ${hasAny ? 'clickable' : ''}`}
                                                onClick={() => {
                                                    if (!hasAny) return;
                                                    const allSessions = [];
                                                    if (entry.data.judo) entry.data.judo.forEach(s => allSessions.push({ ...s, _type: 'Judo' }));
                                                    if (entry.data.gym)  entry.data.gym.forEach(s =>  allSessions.push({ ...s, _type: 'Gym' }));
                                                    if (entry.data.unique) entry.data.unique.forEach(s => allSessions.push({ ...s, _type: 'Unique' }));
                                                    if (entry.data.bw) allSessions.push({ _type: 'Body Weight', value: entry.data.bw.flat().reduce((a,l) => a+l.value, 0) });
                                                    setPopup({ date: ds, sessions: allSessions });
                                                }}>
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
                        ? Object.keys(bwDays).filter(d => d.startsWith(String(YEAR))).length
                        : new Set(m.sessions.filter(s => s.date?.startsWith(String(YEAR))).map(s => s.date)).size;
                    const totalMins = m.hasMins
                        ? m.sessions.reduce((a,s) => a + calcMinutes(s.startTime, s.endTime), 0) : 0;

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
                <DayPopup date={popup.date} sessions={popup.sessions} onClose={() => setPopup(null)} />
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