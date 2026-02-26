import React, { useState, useEffect } from 'react';
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
    done: false,
    lastCompleted: null,
    completionHistory: [] // Track history for heatmap
};

// ─── HELPERS ───────────────────────────────────────────

const getYearDays = () => {
    const days = [];
    const start = new Date(new Date().getFullYear(), 0, 1);
    // Fill 53 weeks worth of days to ensure a full grid
    for (let i = 0; i < 371; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        if (d.getFullYear() > start.getFullYear()) break;
        days.push(d.toISOString().split('T')[0]);
    }
    return days;
};

const daysSince = (isoStr) => {
    if (!isoStr) return null;
    const diff = Math.floor((new Date() - new Date(isoStr)) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return '1 day ago';
    return `${diff} days ago`;
};

const isScheduledToday = (chore) => {
    return chore.scheduledDays?.includes(TODAY_LABEL);
};

function Chores() {
    const [chores, setChores] = useState([]);
    const [choreTypes, setChoreTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingChore, setEditingChore] = useState(null);
    const [form, setForm] = useState(emptyChore);
    const [filterDone, setFilterDone] = useState('All');
    const [newTypeName, setNewTypeName] = useState('');
    const [editingTypeId, setEditingTypeId] = useState(null);
    const [typeRenameInput, setTypeRenameInput] = useState('');
    const [showTypeManager, setShowTypeManager] = useState(false);
    const [viewMode, setViewMode] = useState('list'); 
    const [selectedDate, setSelectedDate] = useState(null);

    // Group the year's days by month
    const monthsData = MONTHS.map((monthName, monthIdx) => {
        const year = new Date().getFullYear();
        const daysInMonth = [];
        // Loop through days 1 to 31
        for (let d = 1; d <= 31; d++) {
            const date = new Date(year, monthIdx, d);
            // Ensure we don't bleed into the next month (e.g., Feb 30)
            if (date.getMonth() === monthIdx) {
                daysInMonth.push(date.toISOString().split('T')[0]);
            }
        }
        return { name: monthName, days: daysInMonth };
    });

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

    // ─── COMPUTED DATA ─────────────────────────────────────

    const dayDetailMap = chores.reduce((acc, chore) => {
        (chore.completionHistory || []).forEach(date => {
            if (!acc[date]) acc[date] = [];
            acc[date].push(chore.name);
        });
        return acc;
    }, {});

    const yearDays = getYearDays();

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
        if (!form.name) { alert('Name is required'); return; }
        if (editingChore) {
            await storage.updateChore(editingChore.id, form);
            setChores(chores.map(c => c.id === editingChore.id ? { ...form, id: editingChore.id } : c));
        } else {
            const id = await storage.addChore(form);
            setChores([...chores, { ...form, id }]);
        }
        closeForm();
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

    // ─── STATISTICS CALCULATIONS ───────────────────────────

    const currentMonth = new Date().getMonth(); // 0-11
    const currentYear = new Date().getFullYear();

    const stats = choreTypes.map(type => {
        const choresInType = chores.filter(c => c.typeId === type.id);
        
        let yearlyCount = 0;
        let monthlyCount = 0;

        choresInType.forEach(chore => {
            (chore.completionHistory || []).forEach(dateStr => {
                const date = new Date(dateStr);
                if (date.getFullYear() === currentYear) {
                    yearlyCount++;
                    if (date.getMonth() === currentMonth) {
                        monthlyCount++;
                    }
                }
            });
        });

        return { name: type.name, monthlyCount, yearlyCount };
    });

    // Calculate "Uncategorized" separately
    const uncategorizedChores = chores.filter(c => !c.typeId);
    let uncatYearly = 0;
    let uncatMonthly = 0;
    uncategorizedChores.forEach(c => {
        (c.completionHistory || []).forEach(dateStr => {
            const date = new Date(dateStr);
            if (date.getFullYear() === currentYear) {
                uncatYearly++;
                if (date.getMonth() === currentMonth) uncatMonthly++;
            }
        });
    });
    if (uncatYearly > 0) stats.push({ name: 'Uncategorized', monthlyCount: uncatMonthly, yearlyCount: uncatYearly });

    // (Generic handlers)
    const openNewForm = () => { setForm(emptyChore); setEditingChore(null); setShowForm(true); };
    const openEditForm = (chore) => { setForm({ ...chore }); setEditingChore(chore); setShowForm(true); };
    const closeForm = () => { setShowForm(false); setEditingChore(null); setForm(emptyChore); };
    const toggleDay = (day) => {
        const days = form.scheduledDays.includes(day) ? form.scheduledDays.filter(d => d !== day) : [...form.scheduledDays, day];
        setForm({ ...form, scheduledDays: days });
    };
    const handleAddType = async () => {
        if (!newTypeName.trim()) return;
        const id = await storage.addChoreType(newTypeName.trim());
        setChoreTypes([...choreTypes, { id, name: newTypeName.trim() }]);
        setNewTypeName('');
    };
    const handleRenameType = async (id) => {
        await storage.updateChoreType(id, typeRenameInput.trim());
        setChoreTypes(choreTypes.map(t => t.id === id ? { ...t, name: typeRenameInput.trim() } : t));
        setEditingTypeId(null);
    };
    const handleDeleteType = async (id) => {
        if (!window.confirm('Delete type?')) return;
        await storage.deleteChoreType(id);
        setChoreTypes(choreTypes.filter(t => t.id !== id));
    };
    const handleDelete = async (id) => {
        if (!window.confirm('Delete chore?')) return;
        await storage.deleteChore(id);
        setChores(chores.filter(c => c.id !== id));
    };

    // ─── RENDER CALENDAR ───────────────────────────────────

    const renderCalendar = () => {
        // We must return the JSX inside the curly braces
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
                                            title={`${date}: ${tasksDone.length} chores`}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Selected Day Panel - Compact & Uniform */}
                <div className="day-detail-panel-compact">
                    {selectedDate ? (
                        <div className="detail-content">
                            <strong>{format(parseISO(selectedDate), 'MMM d')}:</strong>
                            <div className="pill-container">
                                {dayDetailMap[selectedDate]?.map((name, i) => (
                                    <span key={i} className="task-pill">✨ {name}</span>
                                )) || <span className="empty-text">No activity</span>}
                            </div>
                        </div>
                    ) : (
                        <p className="empty-text-hint">Select a day to see completed tasks</p>
                    )}
                </div>

                {/* Legend for context */}
                <div className="calendar-footer-legend">
                    <span>Less</span>
                    <div className="heat-square" data-level="0"></div>
                    <div className="heat-square" data-level="1"></div>
                    <div className="heat-square" data-level="2"></div>
                    <div className="heat-square" data-level="3"></div>
                    <div className="heat-square" data-level="4"></div>
                    <span>More</span>
                </div>

                {/* Statistics Table */}
                <div className="stats-section">
                    <h4>Type Statistics ({currentYear})</h4>
                    <table className="stats-table">
                        <thead>
                            <tr>
                                <th>Chore Type</th>
                                <th>This Month ({MONTHS[currentMonth]})</th>
                                <th>Year Total</th>
                            </tr>
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

    // ─── RENDER LIST ───────────────────────────────────────

    const todayChores = chores.filter(isScheduledToday);
    const todayDone = todayChores.filter(c => c.done).length;
    const progressPct = todayChores.length === 0 ? 0 : Math.round((todayDone / todayChores.length) * 100);

    const filteredChores = chores
        .filter(c => {
            if (filterDone === 'Pending') return !c.done;
            if (filterDone === 'Done') return c.done;
            if (filterDone === 'Today') return isScheduledToday(c);
            return true;
        })
        .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));

    const grouped = {};
    filteredChores.forEach(chore => {
        const type = choreTypes.find(t => t.id === chore.typeId);
        const key = type ? type.name : 'Uncategorized';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(chore);
    });

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="chores-view">
            <div className="chores-header">
                <h1>Chores</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="view-toggle" onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}>
                        {viewMode === 'list' ? '📅 Year Overview' : '📋 List View'}
                    </button>
                    <button onClick={openNewForm}>+ New Chore</button>
                    <button onClick={() => setShowTypeManager(!showTypeManager)}>Types</button>
                </div>
            </div>

            {viewMode === 'calendar' ? renderCalendar() : (
                <>
                    {todayChores.length > 0 && (
                        <div className="clean-house-bar">
                            <div className="clean-house-label">
                                <span>🏠 Today — {todayDone}/{todayChores.length} done</span>
                                <span>{progressPct}%</span>
                            </div>
                            <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
                            </div>
                            <button className="reset-btn" onClick={handleResetToday}>Reset Today</button>
                        </div>
                    )}

                    <div className="chores-filters">
                        {['All', 'Today', 'Pending', 'Done'].map(f => (
                            <button key={f} className={filterDone === f ? 'active' : ''} onClick={() => setFilterDone(f)}>{f}</button>
                        ))}
                    </div>

                    {Object.entries(grouped).map(([typeName, typeChores]) => (
                        <div key={typeName} className="chore-group">
                            <div className="chore-group-header"><h3>{typeName}</h3></div>
                            {typeChores.map(chore => (
                                <div key={chore.id} className={`chore-card ${chore.done ? 'done' : ''}`}>
                                    <div className="chore-left">
                                        <input type="checkbox" checked={chore.done} onChange={() => handleToggleDone(chore)} />
                                        <div>
                                            <div className="chore-name">{chore.name}</div>
                                            <div className="chore-meta">
                                                {chore.lastCompleted && <span>Last: {daysSince(chore.lastCompleted)}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="chore-actions">
                                        <button onClick={() => openEditForm(chore)}>Edit</button>
                                        <button onClick={() => handleDelete(chore.id)}>Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </>
            )}

            {showForm && (
                <div className="chore-form">
                    <h3>{editingChore ? 'Edit' : 'New'} Chore</h3>
                    <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    <select value={form.typeId} onChange={e => setForm({ ...form, typeId: e.target.value })}>
                        <option value="">No Type</option>
                        {choreTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <div className="days-picker">
                        {DAYS.map(d => (
                            <button key={d} className={form.scheduledDays.includes(d) ? 'selected' : ''} onClick={() => toggleDay(d)}>{d}</button>
                        ))}
                    </div>
                    <div className="chore-form-actions">
                        <button onClick={handleSave}>Save</button>
                        <button onClick={closeForm}>Cancel</button>
                    </div>
                </div>
            )}

            {showTypeManager && (
                <div className="chore-types-manager">
                    <h3>Manage Types</h3>
                    <div className="chore-type-list">
                        {choreTypes.map(type => (
                            <div key={type.id} className="chore-type-tag">
                                {editingTypeId === type.id ? (
                                    <>
                                        <input value={typeRenameInput} onChange={e => setTypeRenameInput(e.target.value)} autoFocus />
                                        <button onClick={() => handleRenameType(type.id)}>✓</button>
                                    </>
                                ) : (
                                    <span onClick={() => { setEditingTypeId(type.id); setTypeRenameInput(type.name); }}>{type.name}</span>
                                )}
                                <button onClick={() => handleDeleteType(type.id)}>✕</button>
                            </div>
                        ))}
                    </div>
                    <div className="add-type-row">
                        <input placeholder="New Type" value={newTypeName} onChange={e => setNewTypeName(e.target.value)} />
                        <button onClick={handleAddType}>Add</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Chores;