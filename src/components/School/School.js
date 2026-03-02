import React, { useState, useEffect } from 'react';
import { storage } from '../../utils/storage';
import { format, parseISO, isToday, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, getDay } from 'date-fns';
import { 
    Target, Crosshair, MoreVertical, Pin, PinOff,
    Pencil, Trash2, X, ChevronUp, ChevronDown, CheckCircle2, Plus
} from 'lucide-react';
import './School.css';

const PRIORITIES = ['P1', 'P2', 'P3', 'None'];
const STATUSES = ['Not Started', 'In Progress', 'Done'];
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_COLOR = {
    'Not Started': { bg: '#f3f4f6', text: '#6b7280', dot: '#9ca3af', border: '#d1d5db' },
    'In Progress': { bg: '#fef9c3', text: '#92400e', dot: '#f59e0b', border: '#f59e0b' },
    'Done':        { bg: '#dcfce7', text: '#166534', dot: '#22c55e', border: '#22c55e' },
};

const emptyTask = {
    title: '', subject: '', dueDate: '', deadline: '',
    priority: 'P2', status: 'Not Started', subtasks: [], pinned: false,
};
const emptySubtask = { title: '', dueDate: '', deadline: '', priority: 'P2', status: 'Not Started' };

// ─── HELPERS ───────────────────────────────────────────

const fmt  = (d) => { try { return format(parseISO(d), "MMM d · h:mm a"); } catch { return d; } };
const fmtS = (d) => { try { return format(parseISO(d), "MMM d"); } catch { return d; } };

const countdown = (dateStr) => {
    if (!dateStr) return null;
    const diff = Math.ceil((parseISO(dateStr) - new Date()) / 86400000);
    if (diff < 0)  return { label: `${Math.abs(diff)}d ago`, urgent: true };
    if (diff === 0) return { label: 'Today', urgent: true };
    if (diff <= 3)  return { label: `${diff}d`, urgent: true };
    return { label: `${diff}d`, urgent: false };
};

const sortByUrgency = (t) => [...t].sort((a, b) =>
    (a.deadline || a.dueDate || '9999').localeCompare(b.deadline || b.dueDate || '9999'));

const sortTasks = (tasks) => {
    const p = { P1: 0, P2: 1, P3: 2, None: 3 };
    return [...tasks].sort((a, b) => {
        if (p[a.priority] !== p[b.priority]) return p[a.priority] - p[b.priority];
        if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
        return 0;
    });
};

const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ─── COMPONENT ─────────────────────────────────────────

function School() {
    const [tasks, setTasks]               = useState([]);
    const [loading, setLoading]           = useState(true);
    const [tab, setTab]                   = useState('all');
    const [filterStatus, setFilterStatus] = useState('All');
    const [showForm, setShowForm]         = useState(false);
    const [editingTask, setEditingTask]   = useState(null);
    const [form, setForm]                 = useState(emptyTask);
    const [expandedTask, setExpandedTask] = useState(null);
    const [newSubtask, setNewSubtask]     = useState(emptySubtask);
    const [editingSubtask, setEditingSubtask]   = useState(null);
    const [subtaskEditForm, setSubtaskEditForm] = useState(emptySubtask);
    const [subjectOrder, setSubjectOrder]       = useState([]);
    const [editingSubject, setEditingSubject]   = useState(null);
    const [subjectRenameInput, setSubjectRenameInput] = useState('');
    const [activeMenu, setActiveMenu]           = useState(null);
    const [completedResetDate, setCompletedResetDate] = useState(getTodayStr());
    const [calModal, setCalModal]               = useState(null);
    const [calMenuOpen, setCalMenuOpen]         = useState(false);
    const [hideDone, setHideDone]               = useState(false);
    const [focusSubject, setFocusSubject]       = useState(null); // for subject nav click
    const [showSubtaskInput, setShowSubtaskInput] = useState(null); // holds task.id

    useEffect(() => {
        const id = setInterval(() => {
            const t = getTodayStr();
            if (t !== completedResetDate) setCompletedResetDate(t);
        }, 60000);
        return () => clearInterval(id);
    }, [completedResetDate]);

    useEffect(() => {
        const close = () => setActiveMenu(null);
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, []);

    useEffect(() => {
        const load = async () => {
            const [data, order] = await Promise.all([storage.getSchoolTasks(), storage.getSubjectOrder()]);
            const today = new Date().toISOString();
            const migrated = await Promise.all(data.map(async t => {
                if (t.status === 'Done' && !t.completedDate) {
                    const updated = { ...t, completedDate: today };
                    await storage.updateSchoolTask(t.id, updated);
                    return updated;
                }
                return t;
            }));
            setTasks(migrated);
            setSubjectOrder(order);
            setLoading(false);
        };
        load();
    }, []);

    // ── computed ──
    const today    = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    // Global filter applied across ALL tabs
    const applyFilters = (taskList) => taskList.filter(t =>
        (filterStatus === 'All' || t.status === filterStatus) &&
        (!hideDone || t.status !== 'Done')
    );

    const filteredTasks    = applyFilters(tasks);
    const pinnedTasks      = sortTasks(tasks.filter(t => t.pinned)).slice(0, 3);
    const unpinnedTasks    = sortTasks(applyFilters(tasks.filter(t => !t.pinned)));
    const tasksDueToday    = tasks.filter(t => (t.dueDate?.startsWith(todayStr)) || (t.deadline?.startsWith(todayStr)));
    const doneTodayCount   = tasksDueToday.filter(t => t.status === 'Done').length;
    const progressPct      = tasksDueToday.length === 0 ? 0 : Math.round((doneTodayCount / tasksDueToday.length) * 100);
    // const completedToday   = tasks.filter(t =>
    //     t.status === 'Done' && t.completedDate?.startsWith(getTodayStr())
    // );

    const completedToday = [
        ...tasks.filter(t => t.status === 'Done' && t.completedDate?.startsWith(getTodayStr()))
            .map(t => ({ ...t, isSubtask: false })),
        ...tasks.flatMap(t =>
            (t.subtasks || [])
                .filter(s => s.status === 'Done' && s.completedDate?.startsWith(getTodayStr()))
                .map(s => ({ ...s, isSubtask: true, parentTitle: t.title }))
        )
    ];

    const allSubjects = [...new Set(tasks.map(t => t.subject).filter(Boolean))];

    const getOrderedSubjects = () => {
        const ordered   = subjectOrder.filter(s => allSubjects.includes(s));
        const remaining = allSubjects.filter(s => !ordered.includes(s));
        return [...ordered, ...remaining];
    };

    // Subject navigator data: undone count per subject
    const subjectNavData = getOrderedSubjects().map(subject => {
        const undone = tasks.filter(t =>
            (t.subject || 'No Subject') === subject && t.status !== 'Done'
        ).length;
        const total = tasks.filter(t => (t.subject || 'No Subject') === subject).length;
        return { subject, undone, total };
    });

    const months = [];
    let cur = startOfMonth(today);
    for (let i = 0; i < 13; i++) { months.push(cur); cur = addMonths(cur, 1); }

    // ── handlers ──
    const openNewForm  = () => { setForm(emptyTask); setEditingTask(null); setShowForm(true); };
    const openEditForm = (task) => { setForm({ ...task }); setEditingTask(task); setShowForm(true); setActiveMenu(null); };
    const closeForm    = () => { setShowForm(false); setEditingTask(null); setForm(emptyTask); };

    const handleRenameSubject = async (old) => {
        if (!subjectRenameInput.trim()) return;
        const n = subjectRenameInput.trim();
        await Promise.all(tasks.filter(t => (t.subject || 'No Subject') === old)
            .map(t => storage.updateSchoolTask(t.id, { ...t, subject: n })));
        setTasks(tasks.map(t => (t.subject || 'No Subject') === old ? { ...t, subject: n } : t));
        const newOrder = subjectOrder.map(s => s === old ? n : s);
        setSubjectOrder(newOrder);
        await storage.saveSubjectOrder(newOrder);
        setEditingSubject(null);
    };

    const handleMoveSubject = async (subject, dir) => {
        const ord = getOrderedSubjects();
        const idx = ord.indexOf(subject);
        if (dir === 'up' && idx === 0) return;
        if (dir === 'down' && idx === ord.length - 1) return;
        const newOrd = [...ord];
        const swap = dir === 'up' ? idx - 1 : idx + 1;
        [newOrd[idx], newOrd[swap]] = [newOrd[swap], newOrd[idx]];
        setSubjectOrder(newOrd);
        await storage.saveSubjectOrder(newOrd);
    };

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
        setActiveMenu(null);
        setCalModal(null);
    };

    const handleStatusChange = async (task, newStatus) => {
        const completedDate = newStatus === 'Done' ? getTodayStr() : (task.completedDate || null);
        const priority = newStatus === 'Done' ? 'None' : task.priority;
        const updated = { ...task, status: newStatus, completedDate, priority };
        await storage.updateSchoolTask(task.id, updated);
        setTasks(tasks.map(t => t.id === task.id ? updated : t));
    };

    const handleTogglePin = async (task) => {
        if (!task.pinned && tasks.filter(t => t.pinned).length >= 3) { alert('Max 3 pinned.'); return; }
        const updated = { ...task, pinned: !task.pinned };
        await storage.updateSchoolTask(task.id, updated);
        setTasks(tasks.map(t => t.id === task.id ? updated : t));
    };

    const handleToggleSubtask = async (task, subId) => {
        const updated = task.subtasks.map(s => s.id === subId
            ? { 
                ...s, 
                done: !s.done,
                status: !s.done ? 'Done' : 'Not Started',
                completedDate: !s.done ? getTodayStr() : null
              }
            : s
        );
        await storage.updateSchoolTask(task.id, { subtasks: updated });
        setTasks(tasks.map(t => t.id === task.id ? { ...t, subtasks: updated } : t));
        if (calModal?.task?.id === task.id) setCalModal(c => ({ ...c, task: { ...c.task, subtasks: updated } }));
    };

    const handleDeleteSubtask = async (task, subId) => {
        const updated = task.subtasks.filter(s => s.id !== subId);
        await storage.updateSchoolTask(task.id, { subtasks: updated });
        setTasks(tasks.map(t => t.id === task.id ? { ...t, subtasks: updated } : t));
    };

    const handleAddSubtask = async (task) => {
        if (!newSubtask.title) return;
        const sub = { ...newSubtask, done: false, id: Date.now().toString() };
        const updated = [...(task.subtasks || []), sub];
        await storage.updateSchoolTask(task.id, { subtasks: updated });
        setTasks(tasks.map(t => t.id === task.id ? { ...t, subtasks: updated } : t));
        setNewSubtask(emptySubtask);
        setShowSubtaskInput(null);
    };

    const startEditSubtask = (task, sub) => {
        setEditingSubtask({ taskId: task.id, subtaskId: sub.id });
        setSubtaskEditForm({ 
            title: sub.title, 
            dueDate: sub.dueDate || '', 
            deadline: sub.deadline || '', 
            priority: sub.priority || 'P2',
            status: sub.status || 'Not Started'  // ← add this
        });
    };

    const handleSaveSubtask = async (task) => {
        const updated = task.subtasks.map(s => s.id === editingSubtask.subtaskId ? { ...s, ...subtaskEditForm } : s);
        await storage.updateSchoolTask(task.id, { subtasks: updated });
        setTasks(tasks.map(t => t.id === task.id ? { ...t, subtasks: updated } : t));
        setEditingSubtask(null);
    };

    // Subject nav click: switch to All tab and focus that subject
    const handleSubjectNavClick = (subject) => {
        setTab('all');
        setFocusSubject(subject);
        setTimeout(() => {
            const el = document.getElementById(`subject-${subject}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    };

    // ── render helpers ──

    const renderCd = (dateStr) => {
        const cd = countdown(dateStr);
        if (!cd) return null;
        return <span className={`countdown ${cd.urgent ? 'urgent' : ''}`}>{cd.label}</span>;
    };

    const renderSubtasks = (task) => {
        console.log('subtasks for', task.title, task.subtasks);

        return (
            <div className="subtasks-section">
                {(task.subtasks || []).map(sub => (
                    <div key={sub.id} className={`subtask-row ${editingSubtask?.subtaskId === sub.id ? 'editing' : ''}`}>
                        {editingSubtask?.subtaskId === sub.id ? (
                            <div className="subtask-edit-form">
                                <input value={subtaskEditForm.title} onChange={e => setSubtaskEditForm({ ...subtaskEditForm, title: e.target.value })} />
                                <div className="subtask-edit-row">
                                    <label>Do<input type="datetime-local" value={subtaskEditForm.dueDate} onChange={e => setSubtaskEditForm({ ...subtaskEditForm, dueDate: e.target.value })} /></label>
                                    <label>Deadline<input type="datetime-local" value={subtaskEditForm.deadline} onChange={e => setSubtaskEditForm({ ...subtaskEditForm, deadline: e.target.value })} /></label>
                                    <select value={subtaskEditForm.priority} onChange={e => setSubtaskEditForm({ ...subtaskEditForm, priority: e.target.value })}>
                                        {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                                    </select>
                                    <select value={subtaskEditForm.status} onChange={e => setSubtaskEditForm({ ...subtaskEditForm, status: e.target.value })}>
                                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => handleSaveSubtask(task)}>Save</button>
                                    <button onClick={() => setEditingSubtask(null)}>Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <input type="checkbox" checked={sub.done} onChange={() => handleToggleSubtask(task, sub.id)} />
                                <span className={`subtask-title ${sub.done ? 'done' : ''}`}>[{sub.priority}] {sub.title}</span>
                                {sub.dueDate && <span className="subtask-meta">{fmtS(sub.dueDate)}</span>}
                                {sub.deadline && <span className="subtask-meta deadline">⚠ {fmtS(sub.deadline)}</span>}
                                <select
                                    className="status-select"
                                    value={sub.status || 'Not Started'}
                                    style={{ background: STATUS_COLOR[sub.status || 'Not Started'].bg, color: STATUS_COLOR[sub.status || 'Not Started'].text }}
                                    onChange={e => {
                                        const newStatus = e.target.value;
                                        const updated = task.subtasks.map(s => s.id === sub.id
                                            ? { ...s, status: newStatus, done: newStatus === 'Done', completedDate: newStatus === 'Done' ? getTodayStr() : null }
                                            : s
                                        );
                                        storage.updateSchoolTask(task.id, { subtasks: updated });
                                        setTasks(tasks.map(t => t.id === task.id ? { ...t, subtasks: updated } : t));
                                    }}
                                >
                                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                                </select>
                                <div className="task-menu-container" onClick={e => e.stopPropagation()}>
                                    <button className="ellipsis-btn" onClick={() => setActiveMenu(`sub-${sub.id}`)}>⋮</button>
                                    {activeMenu === `sub-${sub.id}` && (
                                        <div className="task-dropdown">
                                            <button onClick={() => startEditSubtask(task, sub)}><Pencil size={12} /> Edit</button>
                                            <button className="delete-opt" onClick={() => handleDeleteSubtask(task, sub.id)}><Trash2 size={12} /> Delete</button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                ))}
    
                {/* Add subtask toggle */}
                {showSubtaskInput === task.id ? (
                    <div className="add-subtask-form">
                        <input
                            placeholder="Subtask title"
                            value={newSubtask.title}
                            onChange={e => setNewSubtask({ ...newSubtask, title: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && handleAddSubtask(task)}
                            autoFocus
                        />
                        <button onClick={() => handleAddSubtask(task)}>Add</button>
                        <button onClick={() => { setShowSubtaskInput(null); setNewSubtask(emptySubtask); }}>✕</button>
                    </div>
                ) : null}
            </div>
        );
    };

    // ── compact task card ──
    const renderTaskCard = (task) => {
        const isExpanded = expandedTask === task.id;
        const menuOpen   = activeMenu === task.id;
        const sc         = STATUS_COLOR[task.status] || STATUS_COLOR['Not Started'];
        const cd         = countdown(task.deadline || task.dueDate);

        return (
            <div key={task.id} className="task-card" style={{ borderLeftColor: sc.border }}
    onDoubleClick={() => setShowSubtaskInput(task.id)}>
                <div className="task-row">
                    <span className="task-status-dot" style={{ background: sc.dot }} title={task.status} />
                    <span className={`task-title ${task.status === 'Done' ? 'done' : ''}`}
                        onClick={e => { if (e.detail === 1) setExpandedTask(isExpanded ? null : task.id); }}>
                        {task.priority !== 'None' && <span className="priority-tag">{task.priority}</span>}
                        {task.title}
                    </span>
                    <span className="task-inline-meta">
                        {task.subject && <span className="subject-chip">{task.subject}</span>}
                        {(task.deadline || task.dueDate) && (
                            <span className="date-chip">
                                {task.deadline
                                    ? <><Target size={9} color="#ef4444" /> {fmtS(task.deadline)}</>
                                    : <><Crosshair size={9} color="#3b82f6" /> {fmtS(task.dueDate)}</>}
                            </span>
                        )}
                        {cd && <span className={`countdown ${cd.urgent ? 'urgent' : ''}`}>{cd.label}</span>}
                    </span>
                    <div className="task-actions" onClick={e => e.stopPropagation()}>
                        <select className="status-select" value={task.status}
                            onChange={e => handleStatusChange(task, e.target.value)}
                            style={{ background: sc.bg, color: sc.text }}>
                            {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                        <button className={`pin-btn ${task.pinned ? 'pinned' : ''}`} onClick={() => handleTogglePin(task)}>
                            {task.pinned ? <Pin size={13} /> : <PinOff size={13} />}
                        </button>
                        <div className="task-menu-container">
                            <button className="ellipsis-btn" onClick={() => setActiveMenu(menuOpen ? null : task.id)}>⋮</button>
                            {menuOpen && (
                                <div className="task-dropdown">
                                    <button onClick={() => { 
                                        setShowSubtaskInput(task.id); 
                                        setExpandedTask(task.id); // expand so dates are visible too
                                        setActiveMenu(null); 
                                    }}>
                                        <Plus size={12} /> Add Subtask
                                    </button>
                                    <button onClick={() => openEditForm(task)}><Pencil size={12} /> Edit</button>
                                    <button className="delete-opt" onClick={() => handleDeleteTask(task.id)}><Trash2 size={12} /> Delete</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {isExpanded && (
                    <div className="task-expanded">
                        <div className="task-dates">
                            {task.dueDate && <span className="task-date-row"><Crosshair size={10} color="#3b82f6" /> Do: {fmt(task.dueDate)}</span>}
                            {task.deadline && <span className="task-date-row deadline-text"><Target size={10} color="#ef4444" /> Deadline: {fmt(task.deadline)}</span>}
                        </div>
                    </div>
                )}
                 {renderSubtasks(task)}
            </div>
        );
    };

    // ── global status filter bar ──
    const renderFilterBar = () => (
        <div className="status-filters">
            {['All', ...STATUSES].map(s => (
                <button key={s} className={filterStatus === s ? 'active' : ''} onClick={() => setFilterStatus(s)}>
                    {s !== 'All' && <span className="filter-dot" style={{ background: STATUS_COLOR[s]?.dot }} />}
                    {s}
                </button>
            ))}
            <button className={hideDone ? 'active' : ''} onClick={() => setHideDone(h => !h)}>
                <CheckCircle2 size={11} />
                {hideDone ? 'Show Done' : 'Hide Done'}
            </button>
        </div>
    );

    // ── calendar ──
    const renderCalendar = () => {
        const tasksByDate = {};
        filteredTasks.forEach(task => {
            const add = (dateStr, type) => {
                if (!dateStr) return;
                const key = dateStr.split('T')[0];
                if (!tasksByDate[key]) tasksByDate[key] = [];
                if (!tasksByDate[key].find(e => e.task.id === task.id && e.type === type))
                    tasksByDate[key].push({ task, type, dateStr });
            };
            add(task.dueDate, 'due');
            add(task.deadline, 'deadline');
        });

        return (
            <div className="calendar-view">
                {months.map(month => {
                    const monthKey = format(month, 'yyyy-MM');
                    const hasItems = Object.keys(tasksByDate).some(k => k.startsWith(monthKey));
                    if (!hasItems) return null;
                    const days   = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
                    const offset = getDay(startOfMonth(month));
                    return (
                        <div key={monthKey} className="calendar-month">
                            <div className="calendar-month-title">{format(month, 'MMMM yyyy')}</div>
                            <div className="calendar-grid">
                                {WEEK_DAYS.map(d => <div key={d} className="calendar-weekday">{d}</div>)}
                                {Array.from({ length: offset }).map((_, i) => <div key={`b${i}`} className="calendar-cell empty" />)}
                                {days.map(day => {
                                    const key   = format(day, 'yyyy-MM-dd');
                                    const items = tasksByDate[key] || [];
                                    return (
                                        <div key={key} className={`calendar-cell ${isToday(day) ? 'today' : ''} ${items.length ? 'has-items' : ''}`}>
                                            <div className="calendar-cell-day">{format(day, 'd')}</div>
                                            {items.length > 0 && (
                                                <div className="calendar-cell-dots">
                                                    {items.some(i => i.type === 'due') && <span className="cal-dot due" />}
                                                    {items.some(i => i.type === 'deadline') && <span className="cal-dot deadline" />}
                                                </div>
                                            )}
                                            <div className="calendar-cell-tasks">
                                                {items.map((item, idx) => (
                                                    <button key={idx}
                                                        className={`calendar-cell-task ${item.type} ${item.task.status === 'Done' ? 'done' : ''}`}
                                                        onClick={() => setCalModal(item)}
                                                        title={item.task.title}>
                                                        <span className="cal-task-icon">
                                                            {item.type === 'deadline'
                                                                ? <Target size={8} color="#ef4444" />
                                                                : <Crosshair size={8} color="#3b82f6" />}
                                                        </span>
                                                        <span className="cal-task-name">{item.task.title}</span>
                                                    </button>
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
        );
    };

    // ── calendar detail modal ──
    const renderCalModal = () => {
        if (!calModal) return null;
        const { task, type } = calModal;
        const sc = STATUS_COLOR[task.status] || STATUS_COLOR['Not Started'];
        const doneSubs = (task.subtasks || []).filter(s => s.done).length;

        return (
            <div className="form-overlay" onClick={() => { setCalModal(null); setCalMenuOpen(false); }}>
                <div className="cal-detail-modal" onClick={e => e.stopPropagation()}>
                    <div className="cal-detail-header">
                        <span className={`cal-detail-type-badge ${type}`}>
                            {type === 'deadline'
                                ? <><Target size={11} color="#ef4444" /> Deadline</>
                                : <><Crosshair size={11} color="#3b82f6" /> Do</>}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div className="task-menu-container" onClick={e => e.stopPropagation()}>
                                <button className="ellipsis-btn" onClick={() => setCalMenuOpen(o => !o)}>
                                    <MoreVertical size={15} />
                                </button>
                                {calMenuOpen && (
                                    <div className="task-dropdown">
                                        <button onClick={() => { setCalMenuOpen(false); setCalModal(null); openEditForm(task); }}>
                                            <Pencil size={12} /> Edit
                                        </button>
                                        <button className="delete-opt" onClick={() => { setCalMenuOpen(false); handleDeleteTask(task.id); }}>
                                            <Trash2 size={12} /> Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button className="form-close-btn" onClick={() => { setCalModal(null); setCalMenuOpen(false); }}>
                                <X size={15} />
                            </button>
                        </div>
                    </div>
                    <div className="cal-detail-title">
                        {task.priority !== 'None' && <span className="priority-tag">{task.priority}</span>}
                        <span className={task.status === 'Done' ? 'done' : ''}>{task.title}</span>
                    </div>
                    <div className="cal-detail-chips">
                        {task.subject && <span className="subject-chip-visible">{task.subject}</span>}
                        <span className="status-badge" style={{ background: sc.bg, color: sc.text }}>
                            <span className="status-dot" style={{ background: sc.dot }} />{task.status}
                        </span>
                        {task.pinned && <span className="subject-chip-visible"><Pin size={10} /></span>}
                    </div>
                    <div className="cal-detail-dates">
                        {task.dueDate && (
                            <div className="cal-detail-date-row">
                                <Crosshair size={11} color="#3b82f6" />
                                <span>Due: <strong>{fmt(task.dueDate)}</strong></span>
                                {renderCd(task.dueDate)}
                            </div>
                        )}
                        {task.deadline && (
                            <div className="cal-detail-date-row deadline-text">
                                <Target size={11} color="#ef4444" />
                                <span>Deadline: <strong>{fmt(task.deadline)}</strong></span>
                                {renderCd(task.deadline)}
                            </div>
                        )}
                    </div>
                    {(task.subtasks || []).length > 0 && (
                        <div className="cal-detail-subtasks">
                            <div className="cal-detail-subtask-label">
                                Subtasks — {doneSubs}/{task.subtasks.length} done
                            </div>
                            {task.subtasks.map(sub => (
                                <div key={sub.id} className="cal-subtask-row">
                                    <input type="checkbox" checked={sub.done} onChange={() => handleToggleSubtask(task, sub.id)} />
                                    <span className={sub.done ? 'done' : ''}>{sub.title}</span>
                                    {sub.dueDate && <span className="subtask-meta">{fmtS(sub.dueDate)}</span>}
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="cal-detail-actions">
                        <select className="status-select full"
                            value={task.status}
                            onChange={e => handleStatusChange(task, e.target.value)}
                            style={{ background: sc.bg, color: sc.text }}>
                            {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
            </div>
        );
    };

    // ── subject navigator (right panel) ──
    const renderSubjectNav = () => {
        if (subjectNavData.length === 0) return null;
        return (
            <div className="subject-nav-panel">
                <div className="subject-nav-title">Subjects</div>
                <div className="subject-nav-grid">
                    {subjectNavData.map(({ subject, undone, total }) => (
                        <button
                            key={subject}
                            className={`subject-nav-card ${focusSubject === subject ? 'active' : ''} ${undone === 0 ? 'all-done' : ''}`}
                            onClick={() => handleSubjectNavClick(subject)}
                        >
                            <span className="subject-nav-name">{subject}</span>
                            <span className="subject-nav-count">
                                {undone > 0
                                    ? <><strong>{undone}</strong> left</>
                                    : <span className="all-done-label">✓ done</span>}
                            </span>
                            <div className="subject-nav-bar">
                                <div
                                    className="subject-nav-bar-fill"
                                    style={{ width: `${total > 0 ? ((total - undone) / total) * 100 : 0}%` }}
                                />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    // ── main render ──
    if (loading) return <div className="loading">Loading…</div>;

    return (
        <div className="school-view module-school">
            {/* Header */}
            <div className="school-header">
                <div className="header-left">
                    <h1>School</h1>
                    <div className="school-tabs">
                        {['all', 'urgent', 'calendar', 'priorities'].map(t => (
                            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
                <button className="new-task-btn" onClick={openNewForm}>+ New Task</button>
            </div>

            {/* Global filter bar — always visible */}
            {renderFilterBar()}

            <div className="school-main">
                {/* Sidebar */}
                <div className="school-sidebar">
                    <div className="sidebar-card">
                        <div className="sidebar-date">{format(today, 'EEE, MMM d')}</div>
                        <div className="sidebar-progress-label">
                            <span>{doneTodayCount}/{tasksDueToday.length} today</span>
                            <span>{progressPct}%</span>
                        </div>
                        <div className="sidebar-progress-bg">
                            <div className="sidebar-progress-fill" style={{ width: `${progressPct}%` }} />
                        </div>
                    </div>

                    <div className="sidebar-card sidebar-stats">
                        <div className="sidebar-section-label">Overview</div>
                        <div className="stat-row"><span>Total</span><strong>{tasks.length}</strong></div>
                        {STATUSES.map(s => {
                            const c = STATUS_COLOR[s];
                            return (
                                <div key={s} className="stat-row clickable"
                                    onClick={() => setFilterStatus(s)}>
                                    <span><span className="status-dot" style={{ background: c.dot }} />{s}</span>
                                    <strong>{tasks.filter(t => t.status === s).length}</strong>
                                </div>
                            );
                        })}
                    </div>

                    {completedToday.length > 0 && (
                        <div className="sidebar-card">
                            <div className="sidebar-section-label">
                                <CheckCircle2 size={10} /> Done today
                            </div>
                            {completedToday.map(t => (
                                <div key={t.id} className="sidebar-completed-item">
                                    <span className="completed-title">
                                        {t.isSubtask && <span className="subtask-parent-label">{t.parentTitle} › </span>}
                                        {t.title}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Main content */}
                <div className="school-content">
                    {tab === 'all' && (
                        <div>
                            {getOrderedSubjects().length === 0 && <p className="empty-msg">No tasks yet.</p>}
                            {getOrderedSubjects().map((subject, idx) => {
                                const subjectTasks = sortTasks(filteredTasks.filter(t => (t.subject || 'No Subject') === subject));
                                if (subjectTasks.length === 0) return null;
                                const ordSubs = getOrderedSubjects();
                                return (
                                    <div key={subject} id={`subject-${subject}`} className={`subject-group ${focusSubject === subject ? 'focused' : ''}`}>
                                        <div className="subject-group-header">
                                            {editingSubject === subject ? (
                                                <div className="subject-rename-row">
                                                    <input value={subjectRenameInput}
                                                        onChange={e => setSubjectRenameInput(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleRenameSubject(subject)} autoFocus />
                                                    <button onClick={() => handleRenameSubject(subject)}>Save</button>
                                                    <button onClick={() => setEditingSubject(null)}>✕</button>
                                                </div>
                                            ) : (
                                                <h3 onClick={() => { setEditingSubject(subject); setSubjectRenameInput(subject); }}>
                                                    {subject} <span className="rename-hint"><Pencil size={10} /></span>
                                                    <span className="subject-count">{subjectTasks.length}</span>
                                                </h3>
                                            )}
                                            <div className="subject-move-btns">
                                                <button onClick={() => handleMoveSubject(subject, 'up')} disabled={idx === 0}><ChevronUp size={12} /></button>
                                                <button onClick={() => handleMoveSubject(subject, 'down')} disabled={idx === ordSubs.length - 1}><ChevronDown size={12} /></button>
                                            </div>
                                        </div>
                                        {subjectTasks.map(task => renderTaskCard(task))}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {tab === 'urgent' && (
                        <div className="urgent-list">
                            {sortByUrgency(applyFilters(tasks.filter(t => t.status !== 'Done'))).length === 0 && <p className="empty-msg" style={{padding: '14px 10px'}}>No pending tasks!</p>}
                            {sortByUrgency(applyFilters(tasks.filter(t => t.status !== 'Done'))).map(task => renderTaskCard(task))}
                            {!hideDone && applyFilters(tasks.filter(t => t.status === 'Done')).length > 0 && (
                                <>
                                    <div className="urgent-section-label">Done</div>
                                    {applyFilters(tasks.filter(t => t.status === 'Done')).map(task => renderTaskCard(task))}
                                </>
                            )}
                        </div>
                    )}

                    {tab === 'calendar' && renderCalendar()}

                    {tab === 'priorities' && (
                        <div className="priorities-layout">
                            <div className="priorities-column">
                                <h2><Pin size={12} /> Pinned ({pinnedTasks.length}/3)</h2>
                                {pinnedTasks.length === 0 && <p className="empty-msg">Pin up to 3 tasks using 📍.</p>}
                                {pinnedTasks.map(task => renderTaskCard(task))}
                            </div>
                            <div className="priorities-column">
                                <h2>Everything Else</h2>
                                {unpinnedTasks.length === 0 && <p className="empty-msg">No other tasks.</p>}
                                {unpinnedTasks.map(task => renderTaskCard(task))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right panel: subject navigator */}
                {renderSubjectNav()}
            </div>

            {/* Form modal */}
            {showForm && (
                <div className="form-overlay" onClick={closeForm}>
                    <div className="task-form-modal" onClick={e => e.stopPropagation()}>
                        <div className="form-modal-header">
                            <h3>{editingTask ? 'Edit Task' : 'New Task'}</h3>
                            <button className="form-close-btn" onClick={closeForm}><X size={15} /></button>
                        </div>
                        <input placeholder="Title *" value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })} autoFocus />
                        <label>Subject
                            <input list="subject-options" placeholder="e.g. Math, History…"
                                value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
                            <datalist id="subject-options">{allSubjects.map(s => <option key={s} value={s} />)}</datalist>
                        </label>
                        <div className="form-row">
                            <label>Due Date & Time<input type="datetime-local" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></label>
                            <label>Deadline<input type="datetime-local" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></label>
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
                            <button className="save-btn" onClick={handleSaveTask}>Save</button>
                            <button onClick={closeForm}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            {renderCalModal()}
        </div>
    );
}

export default School;