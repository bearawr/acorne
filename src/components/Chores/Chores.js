import React, { useState, useEffect } from 'react';
import { storage } from '../../utils/storage';
import './Chores.css';

const RECURRENCE = ['none', 'daily', 'weekly'];

const emptyChore = {
    name: '',
    dueDate: '',
    done: false,
    recurring: 'none',
    lastCompleted: null,
};

const countdown = (dateStr) => {
    if (!dateStr) return null;
    const now = new Date();
    const target = new Date(dateStr);
    const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: `⚠️ ${Math.abs(diff)}d ago`, urgent: true };
    if (diff === 0) return { label: '⚠️ Today', urgent: true };
    if (diff <= 3) return { label: `⚠️ ${diff}d`, urgent: true };
    return { label: `⚠️ ${diff}d`, urgent: false };
};

const shouldReset = (chore) => {
    if (!chore.lastCompleted || chore.recurring === 'none') return false;
    const last = new Date(chore.lastCompleted);
    const now = new Date();
    if (chore.recurring === 'daily') return last.toDateString() !== now.toDateString();
    if (chore.recurring === 'weekly') return Math.floor((now - last) / (1000 * 60 * 60 * 24)) >= 7;
    return false;
};

function Chores() {
    const [chores, setChores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingChore, setEditingChore] = useState(null);
    const [form, setForm] = useState(emptyChore);
    const [filterDone, setFilterDone] = useState('All');

    useEffect(() => {
        const load = async () => {
            const data = await storage.getChores();
            const updated = await Promise.all(data.map(async chore => {
                if (chore.done && shouldReset(chore)) {
                    const reset = { ...chore, done: false };
                    await storage.updateChore(chore.id, reset);
                    return reset;
                }
                return chore;
            }));
            setChores(updated);
            setLoading(false);
        };
        load();
    }, []);

    const filteredChores = chores
        .filter(c => {
            if (filterDone === 'Pending') return !c.done;
            if (filterDone === 'Done') return c.done;
            return true;
        })
        .sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
            return 0;
        });

    const openNewForm = () => { setForm(emptyChore); setEditingChore(null); setShowForm(true); };
    const openEditForm = (chore) => { setForm({ ...chore }); setEditingChore(chore); setShowForm(true); };
    const closeForm = () => { setShowForm(false); setEditingChore(null); setForm(emptyChore); };

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

    if (loading) return <div>Loading...</div>;

    return (
        <div className="chores-view">
            <div className="chores-header">
                <h1>Chores</h1>
                <button onClick={openNewForm}>+ New Chore</button>
            </div>

            <div className="chores-filters">
                {['All', 'Pending', 'Done'].map(f => (
                    <button
                        key={f}
                        className={filterDone === f ? 'active' : ''}
                        onClick={() => setFilterDone(f)}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {showForm && (
                <div className="chore-form">
                    <h3>{editingChore ? 'Edit Chore' : 'New Chore'}</h3>
                    <input
                        placeholder="Chore name *"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                    />
                    <label>Due Date & Time
                        <input
                            type="datetime-local"
                            value={form.dueDate}
                            onChange={e => setForm({ ...form, dueDate: e.target.value })}
                        />
                    </label>
                    <label>Recurring
                        <select
                            value={form.recurring}
                            onChange={e => setForm({ ...form, recurring: e.target.value })}
                        >
                            {RECURRENCE.map(r => <option key={r}>{r}</option>)}
                        </select>
                    </label>
                    <div className="chore-form-actions">
                        <button onClick={handleSave}>Save</button>
                        <button onClick={closeForm}>Cancel</button>
                    </div>
                </div>
            )}

            <div className="chore-list">
                {filteredChores.length === 0 && <p>No chores here!</p>}
                {filteredChores.map(chore => {
                    const cd = chore.dueDate ? countdown(chore.dueDate) : null;
                    return (
                        <div key={chore.id} className={`chore-card ${chore.done ? 'done' : ''}`}>
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
                                        {chore.recurring !== 'none' && <span>🔁 {chore.recurring}</span>}
                                        {chore.dueDate && <span>Due: {chore.dueDate}</span>}
                                        {cd && <span className={cd.urgent ? 'urgent' : ''}>{cd.label}</span>}
                                        {chore.lastCompleted && <span>Last done: {new Date(chore.lastCompleted).toLocaleDateString()}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="chore-actions">
                                <button onClick={() => openEditForm(chore)}>Edit</button>
                                <button onClick={() => handleDelete(chore.id)}>Delete</button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default Chores;