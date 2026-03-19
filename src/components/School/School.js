import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../../utils/storage';
import { format, parseISO, isToday, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, getDay } from 'date-fns';
import { 
    Target, Goal, MoreVertical, Pin, PinOff,
    Pencil, Trash2, X, ChevronUp, ChevronDown, CheckCircle2, Plus, Maximize2
} from 'lucide-react';
import './School.css';

const PRIORITIES = ['P1', 'P2', 'P3', 'None'];
const STATUSES = ['Not Started', 'In Progress', 'Done'];
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_COLOR = {
    'Not Started': { bg: '#f3f4f6', text: '#6b7280', dot: '#9ca3af', border: '#d1d5db' },
    'In Progress': { bg: '#fef9c3', text: '#92400e', dot: '#ffdd00', border: '#ffdd00' },
    'Done':        { bg: '#dcfce7', text: '#166534', dot: '#22c55e', border: '#22c55e' },
};

const emptyTask = {
    title: '', subject: '', dueDate: '', deadline: '',
    priority: 'None', status: 'Not Started', subtasks: [], pinned: false, description: '',
};
const emptySubtask = { title: '', dueDate: '', deadline: '', priority: 'P2', status: 'Not Started', description: '' };

// ─── HELPERS ───────────────────────────────────────────

const fmt  = (d) => { try { return format(parseISO(d), "MMM d · h:mm a"); } catch { return d; } };
const fmtS = (d) => { try { return format(parseISO(d), "MMM d"); } catch { return d; } };

const countdown = (dateStr) => {
    if (!dateStr) return null;

    const now    = new Date();
    const target = parseISO(dateStr);

    // Strip time — compare calendar days only
    const nowDay    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());

    const diff = Math.round((targetDay - nowDay) / 86400000);

    if (diff < 0)   return { label: `${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'day' : 'days'} ago`, urgent: true };
    if (diff === 0) return { label: 'Today', urgent: true };
    if (diff === 1) return { label: 'Tomorrow', urgent: true };
    if (diff <= 6)  return { label: `${diff} days`, urgent: diff <= 3 };
    if (diff === 7) return { label: 'Next week', urgent: false };

    const weeks = Math.floor(diff / 7);
    const days  = diff % 7;
    return { label: days > 0 ? `${weeks}w ${days}d` : `${weeks}w`, urgent: false };
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
    const [hideDone, setHideDone]               = useState(true);
    const [focusSubject, setFocusSubject]       = useState(null);
    const [showSubtaskInput, setShowSubtaskInput] = useState(null);
    const [taskModal, setTaskModal]       = useState(null);
    const [modalForm, setModalForm]       = useState(null);
    const [inlineEditCell, setInlineEditCell] = useState(null);
    const modalSaveTimer = useRef(null);
    const [subtaskModal, setSubtaskModal]       = useState(null); // { task, sub }
    const [subtaskModalForm, setSubtaskModalForm] = useState(null);
    const subtaskModalSaveTimer = useRef(null);

    useEffect(() => {
        const id = setInterval(() => {
            const t = getTodayStr();
            if (t !== completedResetDate) setCompletedResetDate(t);
        }, 60000);
        return () => clearInterval(id);
    }, [completedResetDate]);

    useEffect(() => {
        const close = () => { setActiveMenu(null); setInlineEditCell(null); };
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

    // ── task modal auto-save ──
    useEffect(() => {
        if (!modalForm || !taskModal) return;
        const id = taskModal.id;
        clearTimeout(modalSaveTimer.current);
        modalSaveTimer.current = setTimeout(async () => {
            const updated = { ...modalForm, id };
            await storage.updateSchoolTask(id, updated);
            setTasks(prev => prev.map(t => t.id === id ? updated : t));
        }, 600);
        return () => clearTimeout(modalSaveTimer.current);
    }, [modalForm]); // eslint-disable-line

    const openTaskModal = (task) => {
        setTaskModal(task);
        setModalForm({ ...task });
    };

    const closeTaskModal = async () => {
        if (modalForm && taskModal) {
            clearTimeout(modalSaveTimer.current);
            const updated = { ...modalForm, id: taskModal.id };
            await storage.updateSchoolTask(taskModal.id, updated);
            setTasks(prev => prev.map(t => t.id === taskModal.id ? updated : t));
        }
        setTaskModal(null);
        setModalForm(null);
    };

    useEffect(() => {
        if (!subtaskModalForm || !subtaskModal) return;
        clearTimeout(subtaskModalSaveTimer.current);
        subtaskModalSaveTimer.current = setTimeout(async () => {
            const updated = subtaskModal.task.subtasks.map(s =>
                s.id === subtaskModal.sub.id ? { ...subtaskModalForm, id: s.id } : s
            );
            await storage.updateSchoolTask(subtaskModal.task.id, { subtasks: updated });
            setTasks(prev => prev.map(t =>
                t.id === subtaskModal.task.id ? { ...t, subtasks: updated } : t
            ));
        }, 600);
        return () => clearTimeout(subtaskModalSaveTimer.current);
    }, [subtaskModalForm]); // eslint-disable-line
    
    const openSubtaskModal = (task, sub) => {
        setSubtaskModal({ task, sub });
        setSubtaskModalForm({ ...sub });
    };
    
    const closeSubtaskModal = async () => {
        if (subtaskModalForm && subtaskModal) {
            clearTimeout(subtaskModalSaveTimer.current);
            const updated = subtaskModal.task.subtasks.map(s =>
                s.id === subtaskModal.sub.id ? { ...subtaskModalForm, id: s.id } : s
            );
            await storage.updateSchoolTask(subtaskModal.task.id, { subtasks: updated });
            setTasks(prev => prev.map(t =>
                t.id === subtaskModal.task.id ? { ...t, subtasks: updated } : t
            ));
        }
        setSubtaskModal(null);
        setSubtaskModalForm(null);
    };

    // ── computed ──
    const today    = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    const applyFilters = (taskList) => taskList.filter(t =>
        (filterStatus === 'All' || t.status === filterStatus) &&
        (!hideDone || t.status !== 'Done')
    );

    const filteredTasks  = applyFilters(tasks);
    const pinnedTasks    = sortTasks(tasks.filter(t => t.pinned)).slice(0, 3);
    const unpinnedTasks  = sortTasks(applyFilters(tasks.filter(t => !t.pinned)));
    const tasksDueToday  = tasks.filter(t => t.dueDate?.startsWith(todayStr) || t.deadline?.startsWith(todayStr));
    const todayTasks     = tasksDueToday; // alias for Today tab
    const doneTodayCount = tasksDueToday.filter(t => t.status === 'Done').length;
    const progressPct    = tasksDueToday.length === 0 ? 0 : Math.round((doneTodayCount / tasksDueToday.length) * 100);

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
            ? { ...s, done: !s.done, status: !s.done ? 'Done' : 'Not Started', completedDate: !s.done ? getTodayStr() : null }
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
            status: sub.status || 'Not Started',
            description: sub.description || '',
        });
    };

    const handleInlineFieldSave = async (task, field, value) => {
        const updated = { ...task, [field]: value };
        await storage.updateSchoolTask(task.id, updated);
        setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
        setInlineEditCell(null);
    };

    const handleSubtaskInlineFieldSave = async (task, subtaskId, field, value) => {
        const updated = task.subtasks.map(s =>
            s.id === subtaskId ? { ...s, [field]: value } : s
        );
        await storage.updateSchoolTask(task.id, { subtasks: updated });
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, subtasks: updated } : t));
        setInlineEditCell(null);
    };

    const handleSaveSubtask = async (task) => {
        const updated = task.subtasks.map(s => s.id === editingSubtask.subtaskId ? { ...s, ...subtaskEditForm } : s);
        await storage.updateSchoolTask(task.id, { subtasks: updated });
        setTasks(tasks.map(t => t.id === task.id ? { ...t, subtasks: updated } : t));
        setEditingSubtask(null);
    };

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

    // ─── MINI CALENDAR ────────────────────────────────────
    const SidebarCalendar = ({ tasks, onDateClick }) => {
        const today = new Date();
        const start = startOfMonth(today);
        const end   = endOfMonth(today);
        const days  = eachDayOfInterval({ start, end });
        const offset = getDay(start);

        const taskDates = tasks.reduce((acc, task) => {
            [task.dueDate, task.deadline].forEach(d => {
                if (d) acc[d.split('T')[0]] = true;
            });
            return acc;
        }, {});

        return (
            <div className="mini-calendar">
                <div className="mini-calendar-header">{format(today, 'MMMM yyyy')}</div>
                <div className="mini-calendar-grid">
                    {['S','M','T','W','T','F','S'].map((d, i) => (
                        <div key={i} className="mini-cal-weekday">{d}</div>
                    ))}
                    {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
                    {days.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const hasTask = taskDates[dateStr];
                        const isCurrent = isToday(day);
                        return (
                            <div key={dateStr} className={`mini-cal-day ${isCurrent ? 'today' : ''} ${hasTask ? 'has-task' : ''}`}>
                                {format(day, 'd')}
                                {hasTask && <span className="mini-cal-dot" />}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // ─── SUBTASKS ─────────────────────────────────────────
    const renderSubtasks = (task) => (
        <div className="subtasks-section">
            {/* Subtask column headers */}
            {(task.subtasks || []).length > 0 && (
                <div className="subtask-table-header">
                    <div className="col-check" />
                    <div className="col-title">Subtask</div>
                    <div className="col-priority">Priority</div>
                    <div className="col-status">Status</div>
                    <div className="col-date">Due</div>
                    <div className="col-actions" />
                </div>
            )}
    
            {(task.subtasks || []).map(sub => (
                <div key={sub.id} className="subtask-row-wrap">
                    {editingSubtask?.subtaskId === sub.id ? (
                        <div className="subtask-edit-form">
                            <input value={subtaskEditForm.title}
                                onChange={e => setSubtaskEditForm({ ...subtaskEditForm, title: e.target.value })} />
                            <div className="subtask-edit-row">
                                <label>Do<input type="datetime-local" value={subtaskEditForm.dueDate}
                                    onChange={e => setSubtaskEditForm({ ...subtaskEditForm, dueDate: e.target.value })} /></label>
                                <label>Deadline<input type="datetime-local" value={subtaskEditForm.deadline}
                                    onChange={e => setSubtaskEditForm({ ...subtaskEditForm, deadline: e.target.value })} /></label>
                                <select value={subtaskEditForm.priority}
                                    onChange={e => setSubtaskEditForm({ ...subtaskEditForm, priority: e.target.value })}>
                                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                                </select>
                                <select value={subtaskEditForm.status}
                                    onChange={e => setSubtaskEditForm({ ...subtaskEditForm, status: e.target.value })}>
                                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                            <textarea placeholder="Description…" value={subtaskEditForm.description || ''}
                                onChange={e => setSubtaskEditForm({ ...subtaskEditForm, description: e.target.value })}
                                rows={2}
                                style={{ resize: 'vertical', fontSize: 12, fontFamily: 'inherit', width: '100%', marginTop: 4 }} />
                            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                <button onClick={() => handleSaveSubtask(task)}>Save</button>
                                <button onClick={() => setEditingSubtask(null)}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="subtask-row">
                                {/* Checkbox */}
                                <div className="col-check">
                                    <input type="checkbox" className="task-checkbox"
                                        checked={sub.done}
                                        onChange={() => handleToggleSubtask(task, sub.id)} />
                                </div>

                                {/* Title */}
                                <div className="col-title">
                                    <span className={`task-title ${sub.done ? 'done' : ''}`}>{sub.title}</span>
                                </div>

                                {/* Priority — click to edit */}
                                {(() => {
                                    const editing = inlineEditCell?.taskId === task.id && inlineEditCell?.subtaskId === sub.id && inlineEditCell?.field === 'priority';
                                    return (
                                        <div className="col-priority"
                                            onClick={e => { e.stopPropagation(); if (!editing) setInlineEditCell({ taskId: task.id, subtaskId: sub.id, field: 'priority' }); }}>
                                            {editing ? (
                                                <select autoFocus className="inline-select"
                                                    value={sub.priority || 'P2'}
                                                    onChange={e => handleSubtaskInlineFieldSave(task, sub.id, 'priority', e.target.value)}
                                                    onBlur={() => setInlineEditCell(null)}>
                                                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                                                </select>
                                            ) : sub.priority && sub.priority !== 'None'
                                                ? <span className="priority-tag col-clickable" data-priority={sub.priority}>{sub.priority}</span>
                                                : <span className="col-empty col-clickable">—</span>}
                                        </div>
                                    );
                                })()}

                                {/* Status — click to edit */}
                                {(() => {
                                    const editing = inlineEditCell?.taskId === task.id && inlineEditCell?.subtaskId === sub.id && inlineEditCell?.field === 'status';
                                    const ssc = STATUS_COLOR[sub.status || 'Not Started'];
                                    return (
                                        <div className="col-status"
                                            onClick={e => { e.stopPropagation(); if (!editing) setInlineEditCell({ taskId: task.id, subtaskId: sub.id, field: 'status' }); }}>
                                            {editing ? (
                                                <select autoFocus className="inline-select"
                                                    value={sub.status || 'Not Started'}
                                                    onChange={e => handleSubtaskInlineFieldSave(task, sub.id, 'status', e.target.value)}
                                                    onBlur={() => setInlineEditCell(null)}>
                                                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                                                </select>
                                            ) : (
                                                <span className="status-pill col-clickable" style={{ background: ssc.bg, color: ssc.text }}>
                                                    <span className="status-pill-dot" style={{ background: ssc.dot }} />
                                                    {sub.status || 'Not Started'}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Due date — click to edit */}
                                {(() => {
                                    const editingDL  = inlineEditCell?.taskId === task.id && inlineEditCell?.subtaskId === sub.id && inlineEditCell?.field === 'deadline';
                                    const editingDue = inlineEditCell?.taskId === task.id && inlineEditCell?.subtaskId === sub.id && inlineEditCell?.field === 'dueDate';
                                    return (
                                        <div className="col-date">
                                            {editingDL ? (
                                                <input autoFocus type="datetime-local" className="inline-date-input"
                                                    defaultValue={sub.deadline || ''}
                                                    onBlur={e => handleSubtaskInlineFieldSave(task, sub.id, 'deadline', e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleSubtaskInlineFieldSave(task, sub.id, 'deadline', e.target.value);
                                                        if (e.key === 'Escape') setInlineEditCell(null);
                                                    }} />
                                            ) : editingDue ? (
                                                <input autoFocus type="datetime-local" className="inline-date-input"
                                                    defaultValue={sub.dueDate || ''}
                                                    onBlur={e => handleSubtaskInlineFieldSave(task, sub.id, 'dueDate', e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleSubtaskInlineFieldSave(task, sub.id, 'dueDate', e.target.value);
                                                        if (e.key === 'Escape') setInlineEditCell(null);
                                                    }} />
                                            ) : (
                                                <>
                                                    {sub.deadline
                                                        ? <span className="date-chip col-clickable"
                                                            onClick={e => { e.stopPropagation(); setInlineEditCell({ taskId: task.id, subtaskId: sub.id, field: 'deadline' }); }}>
                                                            <Goal size={9} color="#ef4444" /> {fmtS(sub.deadline)}
                                                        </span>
                                                        : sub.dueDate
                                                            ? <span className="date-chip col-clickable"
                                                                onClick={e => { e.stopPropagation(); setInlineEditCell({ taskId: task.id, subtaskId: sub.id, field: 'dueDate' }); }}>
                                                                <Target size={9} color="#3b82f6" /> {fmtS(sub.dueDate)}
                                                            </span>
                                                            : <span className="col-empty col-clickable"
                                                                onClick={e => { e.stopPropagation(); setInlineEditCell({ taskId: task.id, subtaskId: sub.id, field: 'dueDate' }); }}>—</span>}
                                                </>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Actions */}
                                <div className="col-actions" onClick={e => e.stopPropagation()}>
                                    <button className="expand-btn" title="Open subtask"
                                        onClick={() => openSubtaskModal(task, sub)}>
                                        <Maximize2 size={12} />
                                    </button>
                                </div>
                            </div>
    
                            {/* Description — shown below the row if present */}
                            {sub.description && (
                                <div className="subtask-description">{sub.description}</div>
                            )}
                        </>
                    )}
                </div>
            ))}
    
            {/* Add subtask input */}
            {showSubtaskInput === task.id && (
                <div className="add-subtask-form">
                    <input placeholder="Subtask title" value={newSubtask.title}
                        onChange={e => setNewSubtask({ ...newSubtask, title: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && handleAddSubtask(task)}
                        autoFocus />
                    <button onClick={() => handleAddSubtask(task)}>Add</button>
                    <button onClick={() => { setShowSubtaskInput(null); setNewSubtask(emptySubtask); }}>✕</button>
                </div>
            )}
        </div>
    );

    // ─── TASK CARD (clean Notion/Todoist style) ───────────
    const renderTaskCard = (task) => {
        const isExpanded = expandedTask === task.id;
        const sc  = STATUS_COLOR[task.status] || STATUS_COLOR['Not Started'];
        const cd  = countdown(task.deadline || task.dueDate);
        const iec = inlineEditCell;
        const editingStatus   = iec?.taskId === task.id && iec?.field === 'status';
        const editingPriority = iec?.taskId === task.id && iec?.field === 'priority';
        const editingDeadline = iec?.taskId === task.id && iec?.field === 'deadline';
        const editingDueDate  = iec?.taskId === task.id && iec?.field === 'dueDate';
    
        return (
            <div key={task.id}
                className={`task-row-wrap status-${task.status.replace(/ /g, '-').toLowerCase()} ${task.status === 'Done' ? 'is-done' : ''}`}
                style={{ borderLeft: `3px solid ${sc.border}` }}>
                <div className="task-row">
    
                    {/* Checkbox */}
                    <div className="col-check">
                        <input type="checkbox" className="task-checkbox"
                            checked={task.status === 'Done'}
                            onChange={e => handleStatusChange(task, e.target.checked ? 'Done' : 'Not Started')}
                            onClick={e => e.stopPropagation()} />
                    </div>
    
                    {/* Title */}
                    <div className="col-title" onClick={() => setExpandedTask(isExpanded ? null : task.id)}>
                        <span className={`task-title ${task.status === 'Done' ? 'done' : ''}`}>{task.title}</span>
                        {(task.subtasks || []).length > 0 && (
                            <span className="subtask-count-chip">
                                {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
                            </span>
                        )}
                    </div>
    
                    {/* Priority — click to edit */}
                    <div className="col-priority"
                        onClick={e => { e.stopPropagation(); if (!editingPriority) setInlineEditCell({ taskId: task.id, field: 'priority' }); }}>
                        {editingPriority ? (
                            <select autoFocus className="inline-select"
                                value={task.priority}
                                onChange={e => handleInlineFieldSave(task, 'priority', e.target.value)}
                                onBlur={() => setInlineEditCell(null)}>
                                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                            </select>
                        ) : task.priority !== 'None'
                            ? <span className="priority-tag" data-priority={task.priority} style={{ cursor: 'pointer' }}>{task.priority}</span>
                            : <span className="col-empty col-clickable">—</span>}
                    </div>
    
                    {/* Status — click to edit */}
                    <div className="col-status"
                        onClick={e => { e.stopPropagation(); if (!editingStatus) setInlineEditCell({ taskId: task.id, field: 'status' }); }}>
                        {editingStatus ? (
                            <select autoFocus className="inline-select"
                                value={task.status}
                                onChange={e => { handleStatusChange(task, e.target.value); setInlineEditCell(null); }}
                                onBlur={() => setInlineEditCell(null)}>
                                {STATUSES.map(s => <option key={s}>{s}</option>)}
                            </select>
                        ) : (
                            <span className="status-pill" style={{ background: sc.bg, color: sc.text, cursor: 'pointer' }}>
                                <span className="status-pill-dot" style={{ background: sc.dot }} />
                                {task.status}
                            </span>
                        )}
                    </div>
    
                    {/* Due date — click chip to edit that specific field */}
                    <div className="col-date">
                        {editingDeadline ? (
                            <input autoFocus type="datetime-local" className="inline-date-input"
                                defaultValue={task.deadline || ''}
                                onBlur={e => handleInlineFieldSave(task, 'deadline', e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleInlineFieldSave(task, 'deadline', e.target.value);
                                    if (e.key === 'Escape') setInlineEditCell(null);
                                }} />
                        ) : editingDueDate ? (
                            <input autoFocus type="datetime-local" className="inline-date-input"
                                defaultValue={task.dueDate || ''}
                                onBlur={e => handleInlineFieldSave(task, 'dueDate', e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleInlineFieldSave(task, 'dueDate', e.target.value);
                                    if (e.key === 'Escape') setInlineEditCell(null);
                                }} />
                        ) : (
                            <>
                                {task.deadline
                                    ? <span className="date-chip" style={{ cursor: 'pointer' }}
                                        onClick={e => { e.stopPropagation(); setInlineEditCell({ taskId: task.id, field: 'deadline' }); }}>
                                        <Goal size={9} color="#ef4444" /> {fmtS(task.deadline)}
                                      </span>
                                    : task.dueDate
                                        ? <span className="date-chip" style={{ cursor: 'pointer' }}
                                            onClick={e => { e.stopPropagation(); setInlineEditCell({ taskId: task.id, field: 'dueDate' }); }}>
                                            <Target size={9} color="#3b82f6" /> {fmtS(task.dueDate)}
                                          </span>
                                        : <span className="col-empty col-clickable"
                                            onClick={e => { e.stopPropagation(); setInlineEditCell({ taskId: task.id, field: 'dueDate' }); }}>—</span>}
                                {cd && <span className={`countdown ${cd.urgent ? 'urgent' : ''}`}>{cd.label}</span>}
                            </>
                        )}
                    </div>
    
                    {/* Actions */}
                    <div className="col-actions" onClick={e => e.stopPropagation()}>
                        <button className={`pin-btn ${task.pinned ? 'pinned' : ''}`} onClick={() => handleTogglePin(task)}>
                            {task.pinned ? <Pin size={12} /> : <PinOff size={12} />}
                        </button>
                        <button className="add-subtask-inline-btn" title="Add subtask"
                            onClick={() => { setShowSubtaskInput(task.id); setExpandedTask(task.id); }}>
                            <Plus size={12} />
                        </button>
                        <button className="expand-btn" title="Open task" onClick={() => openTaskModal(task)}>
                            <Maximize2 size={12} />
                        </button>
                    </div>
                </div>
    
                {/* Expanded subtask/description row */}
                {isExpanded && (
                    <div className="task-expanded">
                        {(task.description || task.dueDate || task.deadline) && (
                            <div className="task-expanded-meta">
                                {task.dueDate && <span className="task-date-row"><Target size={10} color="#3b82f6" /> {fmt(task.dueDate)}</span>}
                                {task.deadline && <span className="task-date-row deadline-text"><Goal size={10} color="#ef4444" /> {fmt(task.deadline)}</span>}
                            </div>
                        )}
                        {task.description && <div className="task-description">{task.description}</div>}
                        {renderSubtasks(task)}
                    </div>
                )}
                {!isExpanded && showSubtaskInput === task.id && renderSubtasks(task)}
            </div>
        );
    };

    // ── filter bar ──
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
                                                                ? <Goal size={8} color="#ef4444" />
                                                                : <Target size={8} color="#3b82f6" />}
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
                                ? <><Goal size={11} color="#ef4444" /> Deadline</>
                                : <><Target size={11} color="#3b82f6" /> Do</>}
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
                        {task.priority !== 'None' && <span className="priority-tag" data-priority={task.priority}>{task.priority}</span>}
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
                                <Target size={11} color="#3b82f6" />
                                <span>Due: <strong>{fmt(task.dueDate)}</strong></span>
                                {renderCd(task.dueDate)}
                            </div>
                        )}
                        {task.deadline && (
                            <div className="cal-detail-date-row deadline-text">
                                <Goal size={11} color="#ef4444" />
                                <span>Deadline: <strong>{fmt(task.deadline)}</strong></span>
                                {renderCd(task.deadline)}
                            </div>
                        )}
                    </div>
                    {task.description && (
                        <div className="task-description" style={{ margin: '8px 0' }}>{task.description}</div>
                    )}
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

    // ── subject navigator (now in sidebar) ──
    const renderSubjectNav = () => {
        if (subjectNavData.length === 0) return null;
        return (
            <>
                <div className="sidebar-section-label">Subjects</div>
                <div className="subject-nav-grid">
                    {subjectNavData.map(({ subject, undone, total }) => (
                        <button key={subject}
                            className={`subject-nav-card ${focusSubject === subject ? 'active' : ''} ${undone === 0 ? 'all-done' : ''}`}
                            onClick={() => handleSubjectNavClick(subject)}>
                            <span className="subject-nav-name">{subject}</span>
                            <span className="subject-nav-count">
                                {undone > 0
                                    ? <><strong>{undone}</strong> left</>
                                    : <span className="all-done-label">✓ done</span>}
                            </span>
                            <div className="subject-nav-bar">
                                <div className="subject-nav-bar-fill"
                                    style={{ width: `${total > 0 ? ((total - undone) / total) * 100 : 0}%` }} />
                            </div>
                        </button>
                    ))}
                </div>
            </>
        );
    };

    // ─── SUBTASK MODAL ────────────────────────────────────
    const renderSubtaskModal = () => {
        if (!subtaskModal || !subtaskModalForm) return null;
        const { task } = subtaskModal;
        const sc  = STATUS_COLOR[subtaskModalForm.status || 'Not Started'];
        const ptc = STATUS_COLOR[task.status] || STATUS_COLOR['Not Started'];

        return (
            <div className="form-overlay" onClick={closeSubtaskModal}>
                <div className="task-modal-panel" onClick={e => e.stopPropagation()}>

                    {/* Header */}
                    <div className="task-modal-header">
                        <span className="task-modal-hint">Auto-saving</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button className="form-close-btn task-modal-delete-btn"
                                title="Delete subtask"
                                onClick={() => { closeSubtaskModal(); handleDeleteSubtask(task, subtaskModal.sub.id); }}>
                                <Trash2 size={14} />
                            </button>
                            <button className="form-close-btn" onClick={closeSubtaskModal}>
                                <X size={15} />
                            </button>
                        </div>
                    </div>

                    {/* Parent task breadcrumb */}
                    <div className="subtask-modal-parent">
                        <span className="subtask-modal-parent-label">Parent task</span>
                        <span className="subtask-modal-parent-title">
                            <span className="status-pill" style={{ background: ptc.bg, color: ptc.text, fontSize: '0.62rem' }}>
                                <span className="status-pill-dot" style={{ background: ptc.dot }} />
                                {task.status}
                            </span>
                            {task.subject && <span className="subject-chip-visible">{task.subject}</span>}
                            <span>{task.title}</span>
                        </span>
                    </div>

                    {/* Subtask title */}
                    <input className="task-modal-title"
                        value={subtaskModalForm.title || ''}
                        onChange={e => setSubtaskModalForm({ ...subtaskModalForm, title: e.target.value })}
                        placeholder="Subtask title…" />

                    {/* Properties */}
                    <div className="task-modal-props">
                        <div className="task-modal-prop-row">
                            <span className="task-modal-prop-label"><Target size={11} color="#3b82f6" /> Due</span>
                            <input type="datetime-local" className="task-modal-prop-input"
                                value={subtaskModalForm.dueDate || ''}
                                onChange={e => setSubtaskModalForm({ ...subtaskModalForm, dueDate: e.target.value })} />
                        </div>
                        <div className="task-modal-prop-row">
                            <span className="task-modal-prop-label"><Goal size={11} color="#ef4444" /> Deadline</span>
                            <input type="datetime-local" className="task-modal-prop-input"
                                value={subtaskModalForm.deadline || ''}
                                onChange={e => setSubtaskModalForm({ ...subtaskModalForm, deadline: e.target.value })} />
                        </div>
                        <div className="task-modal-prop-row">
                            <span className="task-modal-prop-label">Priority</span>
                            <select className="task-modal-prop-select"
                                value={subtaskModalForm.priority || 'P2'}
                                onChange={e => setSubtaskModalForm({ ...subtaskModalForm, priority: e.target.value })}>
                                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                            </select>
                        </div>
                        <div className="task-modal-prop-row">
                            <span className="task-modal-prop-label">Status</span>
                            <select className="task-modal-prop-select"
                                value={subtaskModalForm.status || 'Not Started'}
                                style={{ background: sc.bg, color: sc.text }}
                                onChange={e => setSubtaskModalForm({ ...subtaskModalForm, status: e.target.value })}>
                                {STATUSES.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="task-modal-desc-label">Description</div>
                    <textarea className="task-modal-desc"
                        value={subtaskModalForm.description || ''}
                        onChange={e => setSubtaskModalForm({ ...subtaskModalForm, description: e.target.value })}
                        placeholder="Notes…" />
                </div>
            </div>
        );
    };

    // ─── TASK MODAL ───────────────────────────────────────
    const renderTaskModal = () => {
        if (!taskModal || !modalForm) return null;
        const sc = STATUS_COLOR[modalForm.status] || STATUS_COLOR['Not Started'];

        return (
            <div className="form-overlay" onClick={closeTaskModal}>
                <div className="task-modal-panel" onClick={e => e.stopPropagation()}>

                    {/* Header */}
                    <div className="task-modal-header">
                        <span className="task-modal-hint">Auto-saving</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button className="form-close-btn task-modal-delete-btn"
                                title="Delete task"
                                onClick={() => { closeTaskModal(); handleDeleteTask(taskModal.id); }}>
                                <Trash2 size={14} />
                            </button>
                            <button className="form-close-btn" onClick={closeTaskModal}>
                                <X size={15} />
                            </button>
                        </div>
                    </div>

                    {/* Title */}
                    <input className="task-modal-title"
                        value={modalForm.title}
                        onChange={e => setModalForm({ ...modalForm, title: e.target.value })}
                        placeholder="Task title…" />

                    {/* Subject */}
                    <input className="task-modal-subject"
                        list="subject-options-modal"
                        value={modalForm.subject || ''}
                        onChange={e => setModalForm({ ...modalForm, subject: e.target.value })}
                        placeholder="Subject…" />
                    <datalist id="subject-options-modal">
                        {allSubjects.map(s => <option key={s} value={s} />)}
                    </datalist>

                    {/* Properties */}
                    <div className="task-modal-props">
                        <div className="task-modal-prop-row">
                            <span className="task-modal-prop-label"><Target size={11} color="#3b82f6" /> Due</span>
                            <input type="datetime-local" className="task-modal-prop-input"
                                value={modalForm.dueDate || ''}
                                onChange={e => setModalForm({ ...modalForm, dueDate: e.target.value })} />
                        </div>
                        <div className="task-modal-prop-row">
                            <span className="task-modal-prop-label"><Goal size={11} color="#ef4444" /> Deadline</span>
                            <input type="datetime-local" className="task-modal-prop-input"
                                value={modalForm.deadline || ''}
                                onChange={e => setModalForm({ ...modalForm, deadline: e.target.value })} />
                        </div>
                        <div className="task-modal-prop-row">
                            <span className="task-modal-prop-label">Priority</span>
                            <select className="task-modal-prop-select"
                                value={modalForm.priority}
                                onChange={e => setModalForm({ ...modalForm, priority: e.target.value })}>
                                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                            </select>
                        </div>
                        <div className="task-modal-prop-row">
                            <span className="task-modal-prop-label">Status</span>
                            <select className="task-modal-prop-select"
                                value={modalForm.status}
                                style={{ background: sc.bg, color: sc.text }}
                                onChange={e => setModalForm({ ...modalForm, status: e.target.value })}>
                                {STATUSES.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="task-modal-desc-label">Description</div>
                    <textarea className="task-modal-desc"
                        value={modalForm.description || ''}
                        onChange={e => setModalForm({ ...modalForm, description: e.target.value })}
                        placeholder="Notes, links, bullet points…" />

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
                        {['all', 'today', 'urgent', 'calendar', 'priorities'].map(t => (
                            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
                <button className="new-task-btn" onClick={openNewForm}>+ New Task</button>
            </div>

            {/* Global filter bar */}
            {renderFilterBar()}

            <div className="school-main">
                {/* Sidebar */}
                <div className="school-sidebar">
                    <div className="sidebar-card calendar-card">
                        <SidebarCalendar tasks={tasks} />
                    </div>

                    <div className="sidebar-card">
                        <div className="day-stat">
                            <div className="sidebar-date">{format(today, 'EEE, MMM d')}</div>
                            <div className="sidebar-progress-label">
                                <span>{doneTodayCount}/{tasksDueToday.length} today</span>
                                <span>{progressPct}%</span>
                            </div>
                            <div className="sidebar-progress-bg">
                                <div className="sidebar-progress-fill" style={{ width: `${progressPct}%` }} />
                            </div>
                        </div>
                    </div>

                    <div className="sidebar-card sidebar-stats">
                        <div className="sidebar-section-label">Overview</div>
                        <div className="stat-row"><span>Total</span><strong>{tasks.length}</strong></div>
                        {STATUSES.map(s => {
                            const c = STATUS_COLOR[s];
                            return (
                                <div key={s} className="stat-row clickable" onClick={() => setFilterStatus(s)}>
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

                    {/* Subjects — desktop only */}
                    <div className="sidebar-card sidebar-subjects-wrap">
                        {renderSubjectNav()}
                    </div>
                </div>

                {/* Main content */}
                <div className="school-content">

                    {/* ALL TAB */}
                    {tab === 'all' && (
                        <div>
                            {getOrderedSubjects().length === 0 && <p className="empty-msg">No tasks yet.</p>}
                            {getOrderedSubjects().map((subject, idx) => {
                                const subjectTasks = sortTasks(filteredTasks.filter(t => (t.subject || 'No Subject') === subject));
                                if (subjectTasks.length === 0) return null;
                                const ordSubs = getOrderedSubjects();
                                return (
                                    <div key={subject} id={`subject-${subject}`}
                                        className={`subject-group ${focusSubject === subject ? 'focused' : ''}`}>
                                        <div className="subject-group-header">
                                            {editingSubject === subject ? (
                                                <div className="subject-rename-row">
                                                    <input value={subjectRenameInput}
                                                        onChange={e => setSubjectRenameInput(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleRenameSubject(subject)}
                                                        autoFocus />
                                                    <button onClick={() => handleRenameSubject(subject)}>Save</button>
                                                    <button onClick={() => setEditingSubject(null)}>✕</button>
                                                </div>
                                            ) : (
                                                <h3 onClick={() => { setEditingSubject(subject); setSubjectRenameInput(subject); }}>
                                                    {subject}
                                                    <span className="rename-hint"><Pencil size={10} /></span>
                                                    <span className="subject-count">{subjectTasks.length}</span>
                                                </h3>
                                            )}
                                            <div className="subject-header-actions">
                                                {/* Plus button to add task directly to this subject
                                                <button className="subject-add-btn" title={`Add task to ${subject}`}
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        setForm({ ...emptyTask, subject });
                                                        setEditingTask(null);
                                                        setShowForm(true);
                                                    }}>
                                                    <Plus size={13} />
                                                </button> */}
                                                <div className="subject-move-btns">
                                                    <button onClick={() => handleMoveSubject(subject, 'up')} disabled={idx === 0}>
                                                        <ChevronUp size={12} />
                                                    </button>
                                                    <button onClick={() => handleMoveSubject(subject, 'down')} disabled={idx === ordSubs.length - 1}>
                                                        <ChevronDown size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        {subjectTasks.length > 0 && (
                                            <div className="task-table-header">
                                                <div className="col-check" />
                                                <div className="col-title">Task</div>
                                                <div className="col-priority">Priority</div>
                                                <div className="col-status">Status</div>
                                                <div className="col-date">Due</div>
                                                <div className="col-actions" />
                                            </div>
                                        )}
                                        {subjectTasks.map(task => renderTaskCard(task))}
                                        {/* Plus button to add task directly to this subject */}
                                        <div className ="add-bottom-row">
                                                <button className="subject-add-btn" title={`Add task to ${subject}`}
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        setForm({ ...emptyTask, subject });
                                                        setEditingTask(null);
                                                        setShowForm(true);
                                                    }}>
                                                    <Plus size={13} />
                                                </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* TODAY TAB */}
                    {tab === 'today' && (
                        <div className="urgent-list">
                            {applyFilters(todayTasks).length === 0
                                ? <p className="empty-msg" style={{ padding: '14px 10px' }}>Nothing due today!</p>
                                : applyFilters(todayTasks).map(task => renderTaskCard(task))
                            }
                        </div>
                    )}

                    {/* URGENT TAB */}
                    {tab === 'urgent' && (
                        <div className="urgent-list">
                            {sortByUrgency(applyFilters(tasks.filter(t => t.status !== 'Done'))).length === 0 &&
                                <p className="empty-msg" style={{ padding: '14px 10px' }}>No pending tasks!</p>}
                            {sortByUrgency(applyFilters(tasks.filter(t => t.status !== 'Done'))).map(task => renderTaskCard(task))}
                            {!hideDone && applyFilters(tasks.filter(t => t.status === 'Done')).length > 0 && (
                                <>
                                    <div className="urgent-section-label">Done</div>
                                    {applyFilters(tasks.filter(t => t.status === 'Done')).map(task => renderTaskCard(task))}
                                </>
                            )}
                        </div>
                    )}

                    {/* CALENDAR TAB */}
                    {tab === 'calendar' && renderCalendar()}

                    {/* PRIORITIES TAB */}
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
            </div>

            {/* New / Edit Task Form Modal */}
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
                            <datalist id="subject-options">
                                {allSubjects.map(s => <option key={s} value={s} />)}
                            </datalist>
                        </label>
                        <label>Description
                            <textarea
                                placeholder="Notes, links, bullet points…"
                                value={form.description || ''}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                rows={3}
                                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                            />
                        </label>
                        <div className="form-row">
                            <label>Due Date & Time
                                <input type="datetime-local" value={form.dueDate}
                                    onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                            </label>
                            <label>Deadline
                                <input type="datetime-local" value={form.deadline}
                                    onChange={e => setForm({ ...form, deadline: e.target.value })} />
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
                            <button className="save-btn" onClick={handleSaveTask}>Save</button>
                            <button onClick={closeForm}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            {renderSubtaskModal()}
            {renderTaskModal()}
            {renderCalModal()}
        </div>
    );
}

export default School;