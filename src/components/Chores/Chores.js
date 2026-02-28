import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../../utils/storage';
import { format, parseISO } from 'date-fns';
import './Chores.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TODAY_LABEL = DAYS[new Date().getDay()];

const emptyChore = {
    name: '',
    typeId: '',
    scheduledDays: [],
    repeating: false,      // NEW: false = one-time task for today, true = recurring
    routine: 'Daily',      // only used when repeating = true
    order: 1,
    done: false,
    lastCompleted: null,
    completionHistory: []
};

// ─── HELPERS ───────────────────────────────────────────

const daysSince = (isoStr) => {
    if (!isoStr) return null;
    const diff = Math.floor((new Date() - new Date(isoStr)) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return '1 day ago';
    return `${diff} days ago`;
};

const isScheduledToday = (chore) => {
    if (!chore.repeating) {
        // Non-repeating: show only if created today (not yet done) or done today
        const today = new Date().toISOString().split('T')[0];
        const createdToday = chore.createdDate === today;
        const doneToday = chore.completionHistory?.includes(today);
        return createdToday || doneToday;
    }
    return chore.scheduledDays?.includes(TODAY_LABEL);
};

// ─── STOPWATCH COMPONENT ───────────────────────────────

function Stopwatch() {
    const [running, setRunning] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (running) {
            intervalRef.current = setInterval(() => {
                setElapsed(e => e + 1);
            }, 1000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [running]);

    const reset = () => {
        setRunning(false);
        setElapsed(0);
    };

    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    const display = h > 0
        ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    return (
        <div className="stopwatch">
            <span className="stopwatch-time">{display}</span>
            <div className="stopwatch-controls">
                <button
                    className={`stopwatch-btn ${running ? 'pause' : 'play'}`}
                    onClick={() => setRunning(r => !r)}
                    title={running ? 'Pause' : 'Start'}
                >
                    {running ? '⏸' : '▶'}
                </button>
                <button className="stopwatch-btn reset" onClick={reset} title="Reset">↺</button>
            </div>
        </div>
    );
}

// ─── MAIN COMPONENT ────────────────────────────────────

function Chores() {
    const [chores, setChores] = useState([]);
    const [choreTypes, setChoreTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingChore, setEditingChore] = useState(null);
    const [form, setForm] = useState(emptyChore);
    const [filterDone, setFilterDone] = useState('Today');
    const [newTypeName, setNewTypeName] = useState('');
    const [editingTypeId, setEditingTypeId] = useState(null);
    const [typeRenameInput, setTypeRenameInput] = useState('');
    const [showTypeManager, setShowTypeManager] = useState(false);
    const [viewMode, setViewMode] = useState('list');
    const [selectedDate, setSelectedDate] = useState(null);
    const [activeMenu, setActiveMenu] = useState(null);

    // ─── EFFECTS ──────────────────────────────────────────

    useEffect(() => {
        const load = async () => {
            const [choreData, typeData] = await Promise.all([
                storage.getChores(),
                storage.getChoreTypes(),
            ]);
            setChores(choreData);
            setChoreTypes(typeData);
            setLoading(false);
        };
        load();
    }, []);

    useEffect(() => {
        const closeMenu = () => setActiveMenu(null);
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    // ─── COMPUTED DATA ─────────────────────────────────────

    const monthsData = MONTHS.map((monthName, monthIdx) => {
        const year = new Date().getFullYear();
        const daysInMonth = [];
        for (let d = 1; d <= 31; d++) {
            const date = new Date(year, monthIdx, d);
            if (date.getMonth() === monthIdx) {
                daysInMonth.push(date.toISOString().split('T')[0]);
            }
        }
        return { name: monthName, days: daysInMonth };
    });

    const dayDetailMap = chores.reduce((acc, chore) => {
        (chore.completionHistory || []).forEach(date => {
            if (!acc[date]) acc[date] = [];
            acc[date].push(chore.name);
        });
        return acc;
    }, {});

    // Filtering
    const filteredChores = chores
        .filter(c => {
            if (filterDone === 'Pending') return !c.done;
            if (filterDone === 'Done') return c.done;
            if (filterDone === 'Today') return isScheduledToday(c);
            return true;
        })
        .sort((a, b) => (a.order || 1) - (b.order || 1));

    // Group into "Today's Tasks" vs repeating routines
    const todayOnceChores = filteredChores.filter(c => !c.repeating);
    const repeatingChores = filteredChores.filter(c => c.repeating);

    // ─── ORDERING ──────────────────────────────────────────

    const moveChore = async (chore, direction, list) => {
        const idx = list.findIndex(c => c.id === chore.id);
        const swapIdx = idx + direction;
        if (swapIdx < 0 || swapIdx >= list.length) return;

        const a = list[idx];
        const b = list[swapIdx];
        const aOrder = a.order || idx + 1;
        const bOrder = b.order || swapIdx + 1;

        const updatedA = { ...a, order: bOrder };
        const updatedB = { ...b, order: aOrder };

        await Promise.all([
            storage.updateChore(a.id, updatedA),
            storage.updateChore(b.id, updatedB),
        ]);

        setChores(chores.map(c => {
            if (c.id === a.id) return updatedA;
            if (c.id === b.id) return updatedB;
            return c;
        }));
    };

    // ─── HANDLERS ──────────────────────────────────────────

    const handleToggleDone = async (chore) => {
        const now = new Date().toISOString();
        const dateOnly = now.split('T')[0];
        const history = chore.completionHistory || [];
        const isChecking = !chore.done;
        const updatedHistory = isChecking
            ? [...new Set([...history, dateOnly])]
            : history.filter(d => d !== dateOnly);

        const updated = {
            ...chore,
            done: isChecking,
            lastCompleted: isChecking ? now : chore.lastCompleted,
            completionHistory: updatedHistory
        };
        await storage.updateChore(chore.id, updated);
        setChores(chores.map(c => c.id === chore.id ? updated : c));
    };

    const handleSave = async () => {
        if (!form.name) return;
        const today = new Date().toISOString().split('T')[0];
        const choreData = {
            ...form,
            createdDate: editingChore ? (editingChore.createdDate || today) : today,
            order: editingChore ? form.order : (chores.length + 1),
        };

        if (editingChore) {
            await storage.updateChore(editingChore.id, choreData);
            setChores(chores.map(c => c.id === editingChore.id ? { ...choreData, id: editingChore.id } : c));
        } else {
            const id = await storage.addChore(choreData);
            setChores([...chores, { ...choreData, id }]);
        }
        closeForm();
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete chore?')) return;
        await storage.deleteChore(id);
        setChores(chores.filter(c => c.id !== id));
    };

    const handleResetToday = async () => {
        if (!window.confirm("Reset today's progress?")) return;
        const updated = await Promise.all(chores.map(async c => {
            if (isScheduledToday(c) && c.done) {
                const reset = { ...c, done: false };
                await storage.updateChore(c.id, reset);
                return reset;
            }
            return c;
        }));
        setChores(updated);
    };

    // Type manager handlers
    const handleAddType = async () => {
        if (!newTypeName.trim()) return;
        const id = await storage.addChoreType({ name: newTypeName.trim() });
        setChoreTypes([...choreTypes, { id, name: newTypeName.trim() }]);
        setNewTypeName('');
    };

    const handleDeleteType = async (id) => {
        if (!window.confirm('Delete this type?')) return;
        await storage.deleteChoreType(id);
        setChoreTypes(choreTypes.filter(t => t.id !== id));
    };

    const handleRenameType = async (id) => {
        if (!typeRenameInput.trim()) return;
        await storage.updateChoreType(id, { name: typeRenameInput.trim() });
        setChoreTypes(choreTypes.map(t => t.id === id ? { ...t, name: typeRenameInput.trim() } : t));
        setEditingTypeId(null);
        setTypeRenameInput('');
    };

    const openNewForm = () => { setForm(emptyChore); setEditingChore(null); setShowForm(true); };
    const openEditForm = (chore) => { setForm({ ...chore }); setEditingChore(chore); setShowForm(true); };
    const closeForm = () => { setShowForm(false); setEditingChore(null); setForm(emptyChore); };

    const toggleDay = (day) => {
        const days = form.scheduledDays.includes(day)
            ? form.scheduledDays.filter(d => d !== day)
            : [...form.scheduledDays, day];
        setForm({ ...form, scheduledDays: days });
    };

    // ─── RENDER CALENDAR ───────────────────────────────────

    const renderCalendar = () => {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const stats = choreTypes.map(type => {
            const choresInType = chores.filter(c => c.typeId === type.id);
            let yearlyCount = 0; let monthlyCount = 0;
            choresInType.forEach(chore => {
                (chore.completionHistory || []).forEach(dateStr => {
                    const date = new Date(dateStr);
                    if (date.getFullYear() === currentYear) {
                        yearlyCount++;
                        if (date.getMonth() === currentMonth) monthlyCount++;
                    }
                });
            });
            return { name: type.name, monthlyCount, yearlyCount };
        });

        return (
            <div className="eagle-eye-container">
                <div className="months-dashboard">
                    {monthsData.map(month => (
                        <div key={month.name} className="month-block">
                            <span className="month-label">{month.name}</span>
                            <div className="month-grid">
                                {month.days.map(date => {
                                    const tasksDone = dayDetailMap[date] || [];
                                    const level = Math.min(tasksDone.length, 4);
                                    return (
                                        <button
                                            key={date}
                                            className={`heat-square ${selectedDate === date ? 'selected' : ''}`}
                                            data-level={level}
                                            onClick={() => setSelectedDate(date)}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="day-detail-panel-compact">
                    {selectedDate ? (
                        <div className="detail-content">
                            <strong>{format(parseISO(selectedDate), 'MMM d')}:</strong>
                            <div className="pill-container">
                                {dayDetailMap[selectedDate]?.map((name, i) => (
                                    <span key={i} className="task-pill">{name}</span>
                                )) || <span className="empty-text">No activity</span>}
                            </div>
                        </div>
                    ) : <p className="empty-text-hint">Select a day for details</p>}
                </div>

                <div className="stats-section">
                    <h4>Type Statistics ({currentYear})</h4>
                    <table className="stats-table">
                        <thead>
                            <tr><th>Type</th><th>Month</th><th>Year</th></tr>
                        </thead>
                        <tbody>
                            {stats.map(s => (
                                <tr key={s.name}>
                                    <td>{s.name}</td>
                                    <td><strong>{s.monthlyCount}</strong></td>
                                    <td><strong>{s.yearlyCount}</strong></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // ─── CHORE CARD ────────────────────────────────────────

    const renderChoreCard = (chore, list) => {
        const idx = list.findIndex(c => c.id === chore.id);
        return (
            <div key={chore.id} className={`chore-card ${chore.done ? 'done' : ''}`}>
                <div className="order-buttons">
                    <button
                        className="order-btn"
                        onClick={() => moveChore(chore, -1, list)}
                        disabled={idx === 0}
                        title="Move up"
                    >▲</button>
                    <button
                        className="order-btn"
                        onClick={() => moveChore(chore, 1, list)}
                        disabled={idx === list.length - 1}
                        title="Move down"
                    >▼</button>
                </div>

                <div className="chore-left">
                    <input type="checkbox" checked={chore.done} onChange={() => handleToggleDone(chore)} />
                    <div>
                        <div className="chore-name">{chore.name}</div>
                        <div className="chore-meta">
                            {chore.lastCompleted && <span>Last: {daysSince(chore.lastCompleted)}</span>}
                            {chore.repeating && chore.scheduledDays?.length > 0 && (
                                <span className="chore-days">{chore.scheduledDays.join(' · ')}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="chore-menu-container" onClick={(e) => e.stopPropagation()}>
                    <button className="ellipsis-btn" onClick={() => setActiveMenu(activeMenu === chore.id ? null : chore.id)}>⋮</button>
                    {activeMenu === chore.id && (
                        <div className="dropdown-menu">
                            <button onClick={() => openEditForm(chore)}>Edit</button>
                            <button onClick={() => handleDelete(chore.id)} className="delete-opt">Delete</button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ─── MAIN RENDER ───────────────────────────────────────

    const todayChores = chores.filter(isScheduledToday);
    const todayDone = todayChores.filter(c => c.done).length;
    const progressPct = todayChores.length === 0 ? 0 : Math.round((todayDone / todayChores.length) * 100);

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="chores-view">
            <div className="chores-header">
                <h1>Chores</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="view-toggle" onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}>
                        {viewMode === 'list' ? 'Year View' : 'List View'}
                    </button>
                    <button onClick={() => setShowTypeManager(!showTypeManager)}>Types</button>
                </div>
            </div>

            {viewMode === 'calendar' ? renderCalendar() : (
                <>
                    {todayChores.length > 0 && (
                        <div className="clean-house-bar">
                            <div className="clean-house-progress">
                                <div className="clean-house-label">
                                    <span>Today — {todayDone}/{todayChores.length} done</span>
                                    <span>{progressPct}%</span>
                                </div>
                                <div className="progress-bar-bg">
                                    <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
                                </div>
                                <button className="reset-btn" onClick={handleResetToday}>Reset Today</button>
                            </div>
                            <Stopwatch />
                        </div>
                    )}

                    <div className="chores-filters">
                        {['Today', 'All', 'Pending', 'Done'].map(f => (
                            <button key={f} className={filterDone === f ? 'active' : ''} onClick={() => setFilterDone(f)}>{f}</button>
                        ))}
                    </div>

                    {/* TODAY'S TASKS (non-repeating) */}
                    {todayOnceChores.length > 0 && (
                        <div className="routine-group">
                            <div className="routine-header"><h3>Today's Tasks</h3></div>
                            {todayOnceChores.map(chore => renderChoreCard(chore, todayOnceChores))}
                        </div>
                    )}

                    {/* REPEATING ROUTINES grouped by routine type */}
                    {['Daily', 'Weekly', 'Monthly'].map(routineKey => {
                        const routineChores = repeatingChores.filter(c => c.routine === routineKey);
                        if (routineChores.length === 0) return null;
                        return (
                            <div key={routineKey} className="routine-group">
                                <div className="routine-header"><h3>{routineKey} Routine</h3></div>
                                {routineChores.map(chore => renderChoreCard(chore, routineChores))}
                            </div>
                        );
                    })}

                    {filteredChores.length === 0 && (
                        <div className="empty-state">
                            <p>No chores here yet!</p>
                        </div>
                    )}
                </>
            )}

            {/* TYPE MANAGER */}
            {showTypeManager && (
                <div className="type-manager">
                    <h3>Manage Types</h3>
                    <div className="type-add-row">
                        <input
                            placeholder="New type name..."
                            value={newTypeName}
                            onChange={e => setNewTypeName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddType()}
                        />
                        <button onClick={handleAddType}>Add</button>
                    </div>
                    {choreTypes.map(type => (
                        <div key={type.id} className="type-row">
                            {editingTypeId === type.id ? (
                                <>
                                    <input value={typeRenameInput} onChange={e => setTypeRenameInput(e.target.value)} />
                                    <button onClick={() => handleRenameType(type.id)}>Save</button>
                                    <button onClick={() => setEditingTypeId(null)}>Cancel</button>
                                </>
                            ) : (
                                <>
                                    <span>{type.name}</span>
                                    <button onClick={() => { setEditingTypeId(type.id); setTypeRenameInput(type.name); }}>Rename</button>
                                    <button onClick={() => handleDeleteType(type.id)} className="delete-opt">Delete</button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* FORM MODAL */}
            {showForm && (
                <div className="form-overlay" onClick={closeForm}>
                    <div className="chore-form" onClick={e => e.stopPropagation()}>
                        <h3>{editingChore ? 'Edit' : 'New'} Chore</h3>
                        <input
                            placeholder="Chore name..."
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            autoFocus
                        />

                        {/* Repeating toggle */}
                        <div className="repeat-toggle-row">
                            <span>Repeating task?</span>
                            <button
                                className={`toggle-btn ${form.repeating ? 'on' : 'off'}`}
                                onClick={() => setForm({ ...form, repeating: !form.repeating })}
                            >
                                {form.repeating ? 'Yes' : 'No — just today'}
                            </button>
                        </div>

                        {form.repeating && (
                            <>
                                <select value={form.routine} onChange={e => setForm({ ...form, routine: e.target.value })}>
                                    <option value="Daily">Daily</option>
                                    <option value="Weekly">Weekly</option>
                                    <option value="Monthly">Monthly</option>
                                </select>

                                <div className="days-picker">
                                    {DAYS.map(d => (
                                        <button
                                            key={d}
                                            className={form.scheduledDays.includes(d) ? 'selected' : ''}
                                            onClick={() => toggleDay(d)}
                                        >{d}</button>
                                    ))}
                                </div>
                            </>
                        )}

                        <select value={form.typeId} onChange={e => setForm({ ...form, typeId: e.target.value })}>
                            <option value="">No Type</option>
                            {choreTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>

                        <div className="chore-form-actions">
                            <button className="save-btn" onClick={handleSave}>Save</button>
                            <button onClick={closeForm}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* FLOATING ADD BUTTON */}
            <button className="fab-add" onClick={openNewForm} title="Add new chore">
                +
            </button>
        </div>
    );
}

export default Chores;