import React, { useState, useEffect } from 'react';
import { storage } from '../../utils/storage';
import './Chores.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TODAY_IDX = new Date().getDay(); // 0=Sun
const TODAY_LABEL = DAYS[TODAY_IDX];

const emptyChore = {
    name: '',
    typeId: '',
    scheduledDays: [],
    done: false,
    lastCompleted: null,
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
    if (!chore.scheduledDays || chore.scheduledDays.length === 0) return false;
    return chore.scheduledDays.includes(TODAY_LABEL);
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

    // ─── PROGRESS BAR ──────────────────────────────────────

    const todayChores = chores.filter(isScheduledToday);
    const todayDone = todayChores.filter(c => c.done).length;
    const todayTotal = todayChores.length;
    const progressPct = todayTotal === 0 ? 0 : Math.round((todayDone / todayTotal) * 100);
    const isCleanHouse = todayTotal > 0 && todayDone === todayTotal;

    const handleResetToday = async () => {
        if (!window.confirm('Reset all of today\'s chores?')) return;
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

    // ─── CHORE TYPE HANDLERS ───────────────────────────────

    const handleAddType = async () => {
        if (!newTypeName.trim()) return;
        const id = await storage.addChoreType(newTypeName.trim());
        setChoreTypes([...choreTypes, { id, name: newTypeName.trim() }]);
        setNewTypeName('');
    };

    const handleRenameType = async (id) => {
        if (!typeRenameInput.trim()) return;
        await storage.updateChoreType(id, typeRenameInput.trim());
        setChoreTypes(choreTypes.map(t => t.id === id ? { ...t, name: typeRenameInput.trim() } : t));
        setEditingTypeId(null);
    };

    const handleDeleteType = async (id) => {
        if (!window.confirm('Delete this type? Chores under it will become untyped.')) return;
        await storage.deleteChoreType(id);
        setChoreTypes(choreTypes.filter(t => t.id !== id));
        const updated = chores.map(c => c.typeId === id ? { ...c, typeId: '' } : c);
        await Promise.all(updated.filter(c => c.typeId === '').map(c => storage.updateChore(c.id, c)));
        setChores(updated);
    };

    // ─── CHORE HANDLERS ────────────────────────────────────

    const openNewForm = () => { setForm(emptyChore); setEditingChore(null); setShowForm(true); };
    const openEditForm = (chore) => { setForm({ ...chore }); setEditingChore(chore); setShowForm(true); };
    const closeForm = () => { setShowForm(false); setEditingChore(null); setForm(emptyChore); };

    const toggleDay = (day) => {
        const days = form.scheduledDays.includes(day)
            ? form.scheduledDays.filter(d => d !== day)
            : [...form.scheduledDays, day];
        setForm({ ...form, scheduledDays: days });
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

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this chore?')) return;
        await storage.deleteChore(id);
        setChores(chores.filter(c => c.id !== id));
    };

    const handleToggleDone = async (chore) => {
        const now = new Date().toISOString();
        const updated = {
            ...chore,
            done: !chore.done,
            lastCompleted: !chore.done ? now : chore.lastCompleted,
        };
        await storage.updateChore(chore.id, updated);
        setChores(chores.map(c => c.id === chore.id ? updated : c));
    };

    // ─── COMPUTED ──────────────────────────────────────────

    const filteredChores = chores
        .filter(c => {
            if (filterDone === 'Pending') return !c.done;
            if (filterDone === 'Done') return c.done;
            if (filterDone === 'Today') return isScheduledToday(c);
            return true;
        })
        .sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            return 0;
        });

    // Group by type
    const grouped = {};
    filteredChores.forEach(chore => {
        const type = choreTypes.find(t => t.id === chore.typeId);
        const key = type ? type.name : 'Uncategorized';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(chore);
    });

    if (loading) return <div>Loading...</div>;

    return (
        <div className="chores-view">
            <div className="chores-header">
                <h1>Chores</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setShowTypeManager(!showTypeManager)}>
                        {showTypeManager ? 'Hide Types' : 'Manage Types'}
                    </button>
                    <button onClick={openNewForm}>+ New Chore</button>
                </div>
            </div>

            {/* Progress Bar */}
            {todayTotal > 0 && (
                <div className="clean-house-bar">
                    <div className="clean-house-label">
                        <span>🏠 Clean House — {todayDone}/{todayTotal} today</span>
                        <span>{progressPct}%</span>
                    </div>
                    <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                    {isCleanHouse && <div className="clean-house-complete">🏠✨ Clean House!</div>}
                    <button className="reset-btn" onClick={handleResetToday}>Reset Today</button>
                </div>
            )}

            {/* Type Manager */}
            {showTypeManager && (
                <div className="chore-types-manager">
                    <h3>Chore Types</h3>
                    <div className="chore-type-list">
                        {choreTypes.map(type => (
                            <div key={type.id} className="chore-type-tag">
                                {editingTypeId === type.id ? (
                                    <>
                                        <input
                                            value={typeRenameInput}
                                            onChange={e => setTypeRenameInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleRenameType(type.id); }}
                                            autoFocus
                                        />
                                        <button onClick={() => handleRenameType(type.id)}>✓</button>
                                        <button onClick={() => setEditingTypeId(null)}>✕</button>
                                    </>
                                ) : (
                                    <>
                                        <span
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => { setEditingTypeId(type.id); setTypeRenameInput(type.name); }}
                                        >
                                            {type.name} ✎
                                        </span>
                                        <button onClick={() => handleDeleteType(type.id)}>✕</button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="add-type-row">
                        <input
                            placeholder="New type name"
                            value={newTypeName}
                            onChange={e => setNewTypeName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAddType(); }}
                        />
                        <button onClick={handleAddType}>+ Add</button>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="chores-filters">
                {['All', 'Today', 'Pending', 'Done'].map(f => (
                    <button
                        key={f}
                        className={filterDone === f ? 'active' : ''}
                        onClick={() => setFilterDone(f)}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Chore Form */}
            {showForm && (
                <div className="chore-form">
                    <h3>{editingChore ? 'Edit Chore' : 'New Chore'}</h3>
                    <input
                        placeholder="Chore name *"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                    />
                    <label>Type
                        <select
                            value={form.typeId}
                            onChange={e => setForm({ ...form, typeId: e.target.value })}
                        >
                            <option value="">-- No Type --</option>
                            {choreTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </label>
                    <label>Scheduled Days
                        <div className="days-picker">
                            {DAYS.map(day => (
                                <button
                                    key={day}
                                    type="button"
                                    className={form.scheduledDays.includes(day) ? 'selected' : ''}
                                    onClick={() => toggleDay(day)}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    </label>
                    <div className="chore-form-actions">
                        <button onClick={handleSave}>Save</button>
                        <button onClick={closeForm}>Cancel</button>
                    </div>
                </div>
            )}

            {/* Chore List grouped by type */}
            {Object.keys(grouped).length === 0 && <p>No chores here!</p>}
            {Object.entries(grouped).map(([typeName, typeChores]) => (
                <div key={typeName} className="chore-group">
                    <div className="chore-group-header">
                        <h3>{typeName}</h3>
                        <span style={{ fontSize: '12px', color: '#999' }}>{typeChores.filter(c => c.done).length}/{typeChores.length}</span>
                    </div>
                    {typeChores.map(chore => (
                        <div key={chore.id} className={`chore-card ${chore.done ? 'done' : ''} ${!isScheduledToday(chore) && filterDone === 'All' ? 'not-today' : ''}`}>
                            <div className="chore-left">
                                <input
                                    type="checkbox"
                                    checked={chore.done}
                                    onChange={() => handleToggleDone(chore)}
                                />
                                <div>
                                    <div className={`chore-name ${chore.done ? 'done' : ''}`}>
                                        {chore.name}
                                    </div>
                                    <div className="chore-meta">
                                        {chore.scheduledDays?.length > 0 && (
                                            <span>🔁 {chore.scheduledDays.join(', ')}</span>
                                        )}
                                        {chore.lastCompleted && (
                                            <span>Last done: {daysSince(chore.lastCompleted)}</span>
                                        )}
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
        </div>
    );
}

export default Chores;