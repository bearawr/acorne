import React, { useState, useEffect } from 'react';
import { storage } from '../../utils/storage';
import './School.css';

const PRIORITIES = ['P1', 'P2', 'P3'];
const STATUSES = ['Not Started', 'In Progress', 'Done'];

const emptyTask = {
    title: '',
    subject: '',
    dueDate: '',
    deadline: '',
    priority: 'P2',
    status: 'Not Started',
    subtasks: [],
    pinned: false,
};

const emptySubtask = {
    title: '',
    dueDate: '',
    deadline: '',
    priority: 'P2',
};

// ─── HELPERS ───────────────────────────────────────────

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

const sortTasks = (tasks) => {
    const pOrder = { P1: 0, P2: 1, P3: 2 };
    return [...tasks].sort((a, b) => {
        if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
        if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
        return 0;
    });
};

function School() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('all');
    const [filterStatus, setFilterStatus] = useState('All');
    const [showForm, setShowForm] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [form, setForm] = useState(emptyTask);
    const [expandedTask, setExpandedTask] = useState(null);
    const [newSubtask, setNewSubtask] = useState(emptySubtask);
    const [editingSubtask, setEditingSubtask] = useState(null);
    const [subtaskEditForm, setSubtaskEditForm] = useState(emptySubtask);
    const [subjectOrder, setSubjectOrder] = useState([]);
    const [editingSubject, setEditingSubject] = useState(null);
    const [subjectRenameInput, setSubjectRenameInput] = useState('');

    useEffect(() => {
        const load = async () => {
            const data = await storage.getSchoolTasks();
            const order = await storage.getSubjectOrder();
            setTasks(data);
            setSubjectOrder(order);
            setLoading(false);
        };
        load();
    }, []);

    // ─── COMPUTED ──────────────────────────────────────────

    const filteredTasks = tasks.filter(t =>
        filterStatus === 'All' || t.status === filterStatus
    );

    const pinnedTasks = sortTasks(tasks.filter(t => t.pinned)).slice(0, 3);
    const unpinnedTasks = sortTasks(filteredTasks.filter(t => !t.pinned));

    const getOrderedSubjects = () => {
        const allSubjects = [...new Set(tasks.map(t => t.subject || 'No Subject'))];
        const ordered = subjectOrder.filter(s => allSubjects.includes(s));
        const remaining = allSubjects.filter(s => !ordered.includes(s));
        return [...ordered, ...remaining];
    };

    // ─── FORM HANDLERS ─────────────────────────────────────

    const openNewForm = () => {
        setForm(emptyTask);
        setEditingTask(null);
        setShowForm(true);
    };

    const openEditForm = (task) => {
        setForm({ ...task });
        setEditingTask(task);
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingTask(null);
        setForm(emptyTask);
    };

    // ─── SUBJECT HANDLERS ──────────────────────────────────

    const handleRenameSubject = async (oldName) => {
        if (!subjectRenameInput.trim()) return;
        const newName = subjectRenameInput.trim();
        const tasksToUpdate = tasks.filter(t => (t.subject || 'No Subject') === oldName);
        await Promise.all(tasksToUpdate.map(t =>
            storage.updateSchoolTask(t.id, { ...t, subject: newName })
        ));
        setTasks(tasks.map(t =>
            (t.subject || 'No Subject') === oldName ? { ...t, subject: newName } : t
        ));
        const newOrder = subjectOrder.map(s => s === oldName ? newName : s);
        setSubjectOrder(newOrder);
        await storage.saveSubjectOrder(newOrder);
        setEditingSubject(null);
    };

    const handleMoveSubject = async (subject, direction) => {
        const ordered = getOrderedSubjects();
        const idx = ordered.indexOf(subject);
        if (direction === 'up' && idx === 0) return;
        if (direction === 'down' && idx === ordered.length - 1) return;
        const newOrder = [...ordered];
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
        setSubjectOrder(newOrder);
        await storage.saveSubjectOrder(newOrder);
    };

    // ─── TASK CRUD ─────────────────────────────────────────

    const handleSaveTask = async () => {
        if (!form.title) { alert('Title is required'); return; }
        if (editingTask) {
            await storage.updateSchoolTask(editingTask.id, form);
            setTasks(tasks.map(t => t.id === editingTask.id ? { ...form, id: editingTask.id } : t));
        } else {
            const id = await storage.addSchoolTask({ ...form, subtasks: [] });
            setTasks([...tasks, { ...form, subtasks: [], id }]);
        }
        closeForm();
    };

    const handleDeleteTask = async (id) => {
        if (!window.confirm('Delete this task?')) return;
        await storage.deleteSchoolTask(id);
        setTasks(tasks.filter(t => t.id !== id));
        if (expandedTask === id) setExpandedTask(null);
    };

    const handleStatusChange = async (task, newStatus) => {
        const updated = { ...task, status: newStatus };
        await storage.updateSchoolTask(task.id, updated);
        setTasks(tasks.map(t => t.id === task.id ? updated : t));
    };

    const handleTogglePin = async (task) => {
        const pinned = tasks.filter(t => t.pinned);
        if (!task.pinned && pinned.length >= 3) {
            alert('Max 3 pinned tasks. Unpin one first.');
            return;
        }
        const updated = { ...task, pinned: !task.pinned };
        await storage.updateSchoolTask(task.id, updated);
        setTasks(tasks.map(t => t.id === task.id ? updated : t));
    };

    // ─── SUBTASK CRUD ──────────────────────────────────────

    const handleAddSubtask = async (task) => {
        if (!newSubtask.title) return;
        const sub = { ...newSubtask, done: false, id: Date.now().toString() };
        const updatedSubtasks = [...(task.subtasks || []), sub];
        await storage.updateSchoolTask(task.id, { subtasks: updatedSubtasks });
        setTasks(tasks.map(t => t.id === task.id ? { ...t, subtasks: updatedSubtasks } : t));
        setNewSubtask(emptySubtask);
    };

    const handleToggleSubtask = async (task, subtaskId) => {
        const updatedSubtasks = task.subtasks.map(s =>
            s.id === subtaskId ? { ...s, done: !s.done } : s
        );
        await storage.updateSchoolTask(task.id, { subtasks: updatedSubtasks });
        setTasks(tasks.map(t => t.id === task.id ? { ...t, subtasks: updatedSubtasks } : t));
    };

    const handleDeleteSubtask = async (task, subtaskId) => {
        const updatedSubtasks = task.subtasks.filter(s => s.id !== subtaskId);
        await storage.updateSchoolTask(task.id, { subtasks: updatedSubtasks });
        setTasks(tasks.map(t => t.id === task.id ? { ...t, subtasks: updatedSubtasks } : t));
    };

    const startEditSubtask = (task, sub) => {
        setEditingSubtask({ taskId: task.id, subtaskId: sub.id });
        setSubtaskEditForm({ title: sub.title, dueDate: sub.dueDate || '', deadline: sub.deadline || '', priority: sub.priority || 'P2' });
    };

    const handleSaveSubtask = async (task) => {
        const updatedSubtasks = task.subtasks.map(s =>
            s.id === editingSubtask.subtaskId ? { ...s, ...subtaskEditForm } : s
        );
        await storage.updateSchoolTask(task.id, { subtasks: updatedSubtasks });
        setTasks(tasks.map(t => t.id === task.id ? { ...t, subtasks: updatedSubtasks } : t));
        setEditingSubtask(null);
    };

    // ─── RENDER HELPERS ────────────────────────────────────

    const renderCountdown = (dateStr, label) => {
        if (!dateStr) return null;
        const cd = countdown(dateStr);
        return (
            <span className={`countdown ${cd.urgent ? 'urgent' : ''}`}>
                {label}: {cd.label}
            </span>
        );
    };

    const renderTaskCard = (task) => {
        const isExpanded = expandedTask === task.id;
        return (
            <div key={task.id} className="task-card">
                <div className="task-card-header">
                    <div>
                        <div
                            className={`task-title ${task.status === 'Done' ? 'done' : ''}`}
                            onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                        >
                            [{task.priority}] {task.title}
                        </div>
                        <div className="task-meta">
                            {task.dueDate && (
                                <span>
                                    Due: {task.dueDate} {renderCountdown(task.dueDate, 'ideal')}
                                </span>
                            )}
                            {task.deadline && (
                                <span className="deadline">
                                    Deadline: {task.deadline} {renderCountdown(task.deadline, 'deadline')}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="task-actions">
                        <select
                            value={task.status}
                            onChange={e => handleStatusChange(task, e.target.value)}
                        >
                            {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                        <button
                            className={`pin-btn ${task.pinned ? 'pinned' : ''}`}
                            onClick={() => handleTogglePin(task)}
                            title="Pin to priorities"
                        >
                            {task.pinned ? '📌' : '📍'}
                        </button>
                        <button onClick={() => openEditForm(task)}>Edit</button>
                        <button onClick={() => handleDeleteTask(task.id)}>Delete</button>
                    </div>
                </div>

                {isExpanded && (
                    <div className="subtasks-section">
                        <strong style={{ fontSize: '13px' }}>Subtasks</strong>
                        {(task.subtasks || []).map(sub => (
                            <div key={sub.id} className={`subtask-row ${editingSubtask?.subtaskId === sub.id ? 'editing' : ''}`}>
                                {editingSubtask?.subtaskId === sub.id ? (
                                    <div className="subtask-edit-form">
                                        <input value={subtaskEditForm.title} onChange={e => setSubtaskEditForm({ ...subtaskEditForm, title: e.target.value })} />
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <label style={{ fontSize: '12px' }}>Due <input type="datetime-local" value={subtaskEditForm.dueDate} onChange={e => setSubtaskEditForm({ ...subtaskEditForm, dueDate: e.target.value })} /></label>
                                            <label style={{ fontSize: '12px' }}>Deadline <input type="datetime-local" value={subtaskEditForm.deadline} onChange={e => setSubtaskEditForm({ ...subtaskEditForm, deadline: e.target.value })} /></label>
                                            <select value={subtaskEditForm.priority} onChange={e => setSubtaskEditForm({ ...subtaskEditForm, priority: e.target.value })}>
                                                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                                            </select>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => handleSaveSubtask(task)}>Save</button>
                                            <button onClick={() => setEditingSubtask(null)}>Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <input type="checkbox" checked={sub.done} onChange={() => handleToggleSubtask(task, sub.id)} />
                                        <span style={{ textDecoration: sub.done ? 'line-through' : 'none' }}>
                                            [{sub.priority}] {sub.title}
                                        </span>
                                        {sub.dueDate && <span style={{ fontSize: '11px', color: '#666' }}>Due: {sub.dueDate}</span>}
                                        {sub.deadline && <span style={{ fontSize: '11px', color: 'red' }}>Deadline: {sub.deadline}</span>}
                                        <button onClick={() => startEditSubtask(task, sub)}>Edit</button>
                                        <button onClick={() => handleDeleteSubtask(task, sub.id)}>×</button>
                                    </>
                                )}
                            </div>
                        ))}
                        <div className="add-subtask-form">
                            <input
                                placeholder="Subtask title"
                                value={newSubtask.title}
                                onChange={e => setNewSubtask({ ...newSubtask, title: e.target.value })}
                            />
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <label style={{ fontSize: '12px' }}>Due <input type="datetime-local" value={newSubtask.dueDate} onChange={e => setNewSubtask({ ...newSubtask, dueDate: e.target.value })} /></label>
                                <label style={{ fontSize: '12px' }}>Deadline <input type="datetime-local" value={newSubtask.deadline} onChange={e => setNewSubtask({ ...newSubtask, deadline: e.target.value })} /></label>
                                <select value={newSubtask.priority} onChange={e => setNewSubtask({ ...newSubtask, priority: e.target.value })}>
                                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                                </select>
                            </div>
                            <button onClick={() => handleAddSubtask(task)}>+ Add Subtask</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ─── RENDER ────────────────────────────────────────────

    if (loading) return <div>Loading...</div>;

    return (
        <div className="school-view">
            <div className="school-header">
                <h1>School</h1>
                <button onClick={openNewForm}>+ New Task</button>
            </div>

            <div className="school-tabs">
                <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>All</button>
                <button className={tab === 'priorities' ? 'active' : ''} onClick={() => setTab('priorities')}>Priorities</button>
            </div>

            {showForm && (
                <div className="task-form">
                    <h3>{editingTask ? 'Edit Task' : 'New Task'}</h3>
                    <input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                    <input placeholder="Subject" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
                    <div className="form-row">
                        <label>Due Date & Time
                            <input type="datetime-local" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                        </label>
                        <label>Deadline
                            <input type="datetime-local" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
                        </label>
                    </div>
                    <div className="form-row">
                        <label>Priority
                            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                            </select>
                        </label>
                        <label>Status
                            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                {STATUSES.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </label>
                    </div>
                    <div className="form-actions">
                        <button onClick={handleSaveTask}>Save</button>
                        <button onClick={closeForm}>Cancel</button>
                    </div>
                </div>
            )}

            {tab === 'all' && (
                <div>
                    <div className="status-filters">
                        {['All', ...STATUSES].map(s => (
                            <button
                                key={s}
                                className={filterStatus === s ? 'active' : ''}
                                onClick={() => setFilterStatus(s)}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    {getOrderedSubjects().length === 0 && <p>No tasks yet.</p>}
                    {getOrderedSubjects().map((subject, idx) => {
                        const subjectTasks = sortTasks(
                            filteredTasks.filter(t => (t.subject || 'No Subject') === subject)
                        );
                        if (subjectTasks.length === 0) return null;
                        const orderedSubjects = getOrderedSubjects();
                        return (
                            <div key={subject} className="subject-group">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <button onClick={() => handleMoveSubject(subject, 'up')} disabled={idx === 0} style={{ padding: '2px 6px', fontSize: '12px' }}>↑</button>
                                    <button onClick={() => handleMoveSubject(subject, 'down')} disabled={idx === orderedSubjects.length - 1} style={{ padding: '2px 6px', fontSize: '12px' }}>↓</button>
                                    {editingSubject === subject ? (
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <input
                                                value={subjectRenameInput}
                                                onChange={e => setSubjectRenameInput(e.target.value)}
                                                style={{ padding: '2px 6px', fontSize: '13px' }}
                                                onKeyDown={e => { if (e.key === 'Enter') handleRenameSubject(subject); }}
                                                autoFocus
                                            />
                                            <button onClick={() => handleRenameSubject(subject)} style={{ fontSize: '12px' }}>Save</button>
                                            <button onClick={() => setEditingSubject(null)} style={{ fontSize: '12px' }}>Cancel</button>
                                        </div>
                                    ) : (
                                        <h3
                                            style={{ cursor: 'pointer', margin: 0 }}
                                            onClick={() => { setEditingSubject(subject); setSubjectRenameInput(subject); }}
                                            title="Click to rename"
                                        >
                                            {subject} ✎
                                        </h3>
                                    )}
                                </div>
                                {subjectTasks.map(task => renderTaskCard(task))}
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === 'priorities' && (
                <div className="priorities-layout">
                    <div className="priorities-column">
                        <h2>📌 Pinned ({pinnedTasks.length}/3)</h2>
                        {pinnedTasks.length === 0 && <p style={{ fontSize: '13px', color: '#999' }}>Pin up to 3 tasks using the 📍 button.</p>}
                        {pinnedTasks.map(task => renderTaskCard(task))}
                    </div>
                    <div className="priorities-column">
                        <h2>Everything Else</h2>
                        {unpinnedTasks.length === 0 && <p style={{ fontSize: '13px', color: '#999' }}>No other tasks.</p>}
                        {unpinnedTasks.map(task => renderTaskCard(task))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default School;