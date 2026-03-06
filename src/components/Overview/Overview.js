import React, { useState, useEffect, useRef, useCallback } from 'react';
import { storage } from '../../utils/storage';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';
import {
    CheckCircle2, Circle, Pin, BookOpen, Dumbbell, Moon,
    Scale, Heart, Home, Plus, X, Zap, LayoutGrid, Minus, Music, Code,
    NotebookPen, Users, Star, Pencil, Trash2,
    MoreVertical, ArrowUpRight, ChevronLeft, ChevronRight, GripVertical
} from 'lucide-react';
import './Overview.css';

// ─── HELPERS ──────────────────────────────────────────────

const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const fmtS = (d) => { try { return format(parseISO(d), 'MMM d'); } catch { return d; } };

const countdown = (dateStr) => {
    if (!dateStr) return null;
    const diff = Math.ceil((parseISO(dateStr) - new Date()) / 86400000);
    if (diff < 0)   return { label: `${Math.abs(diff)}d ago`, urgent: true };
    if (diff === 0) return { label: 'Today', urgent: true };
    if (diff <= 3)  return { label: `${diff}d`, urgent: true };
    return { label: `${diff}d`, urgent: false };
};

const FlagIcon = ({ size = 9, color = '#ef4444' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
);
const TargetIcon = ({ size = 9, color = '#3b82f6' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
);

const MODULE_META = {
    school:  { label: 'School',  icon: BookOpen, color: '#2563EB', bg: '#EFF6FF' },
    fitness: { label: 'Fitness', icon: Dumbbell, color: '#0891B2', bg: '#F0FDFF' },
    sleep:   { label: 'Sleep',   icon: Moon,     color: '#9A86E0', bg: '#F5F3FF' },
    weight:  { label: 'Weight',  icon: Scale,    color: '#92400E', bg: '#FDF6EE' },
    hobbies: { label: 'Hobbies', icon: Heart,    color: '#DB2777', bg: '#FDF2F8' },
    chores:  { label: 'Chores',  icon: Home,     color: '#D97706', bg: '#FFFBEB' },
    general: { label: 'General', icon: Star,     color: '#6b7280', bg: '#f9fafb' },
};

const STATUS_COLOR = {
    'Not Started': { bg: '#f3f4f6', text: '#6b7280' },
    'In Progress': { bg: '#fef9c3', text: '#92400e' },
    'Done':        { bg: '#dcfce7', text: '#166534' },
};

const PRIORITY_ORDER = { P1: 0, P2: 1, P3: 2, None: 3 };

// ─── CONFETTI BURST ───────────────────────────────────────

const PARTICLES = [
    { color: '#f59e0b', tx: -26, ty: -30, rot: 45  },
    { color: '#ef4444', tx: 26,  ty: -30, rot: -45 },
    { color: '#22c55e', tx: -32, ty: 0,   rot: 20  },
    { color: '#3b82f6', tx: 32,  ty: 0,   rot: -20 },
    { color: '#a855f7', tx: -20, ty: 26,  rot: 60  },
    { color: '#ec4899', tx: 20,  ty: 26,  rot: -60 },
    { color: '#f97316', tx: 0,   ty: -34, rot: 0   },
    { color: '#14b8a6', tx: 6,   ty: 30,  rot: 90  },
];

function ConfettiBurst() {
    return (
        <div className="ov-confetti-burst" aria-hidden="true">
            {PARTICLES.map((p, i) => (
                <span key={i} className="ov-confetti-particle"
                    style={{ background: p.color, '--tx': `${p.tx}px`, '--ty': `${p.ty}px`, '--rot': `${p.rot}deg`, animationDelay: `${i * 35}ms` }} />
            ))}
        </div>
    );
}


// ─── CELL STYLE HELPER FOR FAMILY CALENDAR ────────────────

const getFamilyCellStyle = (greet, call) => {
    if (greet && call) return { background: '#e11d48' };
    if (greet) return { background: 'linear-gradient(135deg, #e11d48 50%, #fce7f3 50%)' };
    if (call)  return { background: 'linear-gradient(135deg, #fce7f3 50%, #fb7185 50%)' };
    return {};
};

// ─── TASK DETAIL OVERLAY (centered) ───────────────────────

function TaskDetailOverlay({ item, task, onClose, onNavigate }) {
    const mod     = MODULE_META[item.module] || MODULE_META.general;
    const ModIcon = mod.icon;
    const sc      = STATUS_COLOR[task?.status] || STATUS_COLOR['Not Started'];
    const cd      = countdown(task?.deadline || task?.dueDate);

    return (
        <div className="ov-overlay-backdrop" onClick={onClose}>
            <div className="ov-overlay-panel" onClick={e => e.stopPropagation()}>
                <div className="ov-overlay-header" style={{ borderTopColor: mod.color }}>
                    <div className="ov-overlay-module-tag" style={{ color: mod.color, background: mod.bg }}>
                        <ModIcon size={11} /><span>{mod.label}</span>
                    </div>
                    <div className="ov-overlay-header-actions">
                        <button className="ov-overlay-nav-btn"
                            style={{ color: mod.color, borderColor: mod.color + '40', background: mod.bg }}
                            onClick={() => { onNavigate?.(item.module); onClose(); }}>
                            <ArrowUpRight size={13} /><span>Open in {mod.label}</span>
                        </button>
                        <button className="ov-overlay-close" onClick={onClose}><X size={14} /></button>
                    </div>
                </div>
                <div className="ov-overlay-title">{item.title}</div>
                <div className="ov-overlay-tags">
                    {item.done && <span className="ov-overlay-tag" style={{ background: '#dcfce7', color: '#166534' }}><CheckCircle2 size={10} /> Done</span>}
                    {task?.status && <span className="ov-overlay-tag" style={{ background: sc.bg, color: sc.text }}>{task.status}</span>}
                    {task?.priority && task.priority !== 'None' && <span className="ov-priority-chip" data-priority={task.priority}>{task.priority}</span>}
                    {task?.subject && <span className="ov-subject-chip">{task.subject}</span>}
                    {task?.pinned && <span className="ov-overlay-tag" style={{ background: '#ede9fe', color: '#7c3aed' }}><Pin size={9} /> Pinned</span>}
                </div>
                {(task?.deadline || task?.dueDate) && (
                    <div className="ov-overlay-row">
                        <span className="ov-overlay-row-label">Due date</span>
                        <span className="ov-overlay-row-val">
                            {task.deadline
                                ? <><FlagIcon size={10} color="#ef4444" /> {fmtS(task.deadline)}</>
                                : <><TargetIcon size={10} color="#3b82f6" /> {fmtS(task.dueDate)}</>}
                            {cd && <span className={`ov-countdown ${cd.urgent ? 'urgent' : ''}`} style={{ marginLeft: 6 }}>{cd.label}</span>}
                        </span>
                    </div>
                )}
                {task?.completedDate && (
                    <div className="ov-overlay-row">
                        <span className="ov-overlay-row-label">Completed</span>
                        <span className="ov-overlay-row-val">{fmtS(task.completedDate)}</span>
                    </div>
                )}
                {item.createdDate && (
                    <div className="ov-overlay-row">
                        <span className="ov-overlay-row-label">Added to queue</span>
                        <span className="ov-overlay-row-val">{fmtS(item.createdDate)}</span>
                    </div>
                )}
                {task?.description && (
                    <div className="ov-overlay-section">
                        <div className="ov-overlay-section-label">Description</div>
                        <div className="ov-overlay-description">{task.description}</div>
                    </div>
                )}
                {task?.subtasks?.length > 0 && (
                    <div className="ov-overlay-section">
                        <div className="ov-overlay-section-label">
                            Subtasks
                            <span className="ov-overlay-section-count">{task.subtasks.filter(s=>s.done).length}/{task.subtasks.length}</span>
                        </div>
                        <div className="ov-overlay-subtasks">
                            {task.subtasks.map((s,i) => (
                                <div key={i} className={`ov-overlay-subtask ${s.done ? 'done' : ''}`}>
                                    {s.done ? <CheckCircle2 size={12} color="#22c55e" /> : <Circle size={12} color="#9ca3af" />}
                                    <span>{s.title || s.text || s.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {!task && (
                    <div className="ov-overlay-no-detail">This task was added manually — no linked record.</div>
                )}
            </div>
        </div>
    );
}

// ─── GENERAL TASKS CALENDAR MODAL ─────────────────────────

function GenCalendarModal({ tasks, onClose, onToggle, onDelete, onEdit, onAdd }) {
    const [calMonth,  setCalMonth]  = useState(new Date());
    const [filter,    setFilter]    = useState('all');
    const [sort,      setSort]      = useState('newest');
    const [genInput,  setGenInput]  = useState('');
    const [showForm,  setShowForm]  = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [openMenu,  setOpenMenu]  = useState(null);
    const [selDay,    setSelDay]    = useState(null);
    const todayStr = getTodayStr();
    const menuRef  = useRef(null);

    useEffect(() => {
        const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const monthStart  = startOfMonth(calMonth);
    const days        = eachDayOfInterval({ start: monthStart, end: endOfMonth(calMonth) });
    const startPad    = getDay(monthStart);
    const doneDateMap = {};
    tasks.forEach(t => { if (t.doneDate) doneDateMap[t.doneDate] = (doneDateMap[t.doneDate] || 0) + 1; });

    const filtered = tasks
        .filter(t => filter === 'done' ? t.done : filter === 'undone' ? !t.done : true)
        .filter(t => {
            if (!selDay) return true;
            const ds = format(selDay, 'yyyy-MM-dd');
            return (t.done && t.doneDate === ds) || (!t.done && t.createdDate === ds);
        })
        .sort((a,b) => {
            if (sort === 'az')     return (a.title||'').localeCompare(b.title||'');
            if (sort === 'oldest') return (a.createdDate||'').localeCompare(b.createdDate||'');
            return (b.createdDate||'').localeCompare(a.createdDate||'');
        });

    const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];

    return (
        <div className="ov-overlay-backdrop" onClick={onClose}>
            <div className="ov-cal-modal" onClick={e => e.stopPropagation()}>
                <div className="ov-cal-modal-header">
                    <div className="ov-cal-modal-title">
                        <Star size={14} color="#6b7280" /><span>General Tasks</span>
                        <span className="ov-cal-task-count">{tasks.length} tasks · {tasks.filter(t=>t.done).length} done</span>
                    </div>
                    <button className="ov-overlay-close" onClick={onClose}><X size={14} /></button>
                </div>
                <div className="ov-cal-modal-body">
                    <div className="ov-cal-section">
                        <div className="ov-cal-nav">
                            <button className="ov-cal-nav-btn" onClick={() => setCalMonth(m => subMonths(m,1))}><ChevronLeft size={14} /></button>
                            <span className="ov-cal-month-label">{format(calMonth,'MMMM yyyy')}</span>
                            <button className="ov-cal-nav-btn" onClick={() => setCalMonth(m => addMonths(m,1))}><ChevronRight size={14} /></button>
                        </div>
                        <div className="ov-cal-grid">
                            {DOW.map(d => <div key={d} className="ov-cal-dow">{d}</div>)}
                            {Array.from({ length: startPad }).map((_,i) => <div key={`p${i}`} className="ov-cal-day empty" />)}
                            {days.map(day => {
                                const ds    = format(day,'yyyy-MM-dd');
                                const count = doneDateMap[ds] || 0;
                                const isTd  = ds === todayStr;
                                const isSel = selDay && format(selDay,'yyyy-MM-dd') === ds;
                                return (
                                    <button key={ds} className={`ov-cal-day ${isTd?'today':''} ${isSel?'selected':''} ${count>0?'has-done':''}`}
                                        onClick={() => setSelDay(isSel ? null : day)}>
                                        <span className="ov-cal-day-num">{format(day,'d')}</span>
                                        {count > 0 && <span className="ov-cal-day-dot">{count > 1 ? count : ''}</span>}
                                    </button>
                                );
                            })}
                        </div>
                        {selDay && (
                            <div className="ov-cal-day-hint">
                                <span>Showing tasks for <strong>{format(selDay,'MMM d')}</strong></span>
                                <button className="ov-cal-clear-day" onClick={() => setSelDay(null)}>Clear</button>
                            </div>
                        )}
                        <div className="ov-cal-legend"><span className="ov-cal-legend-dot" /> completed on that day</div>
                    </div>
                    <div className="ov-cal-list-section">
                        <div className="ov-cal-controls">
                            <div className="ov-cal-filter-tabs">
                                {[['all','All'],['undone','Undone'],['done','Done']].map(([k,l]) => (
                                    <button key={k} className={`ov-cal-filter-tab ${filter===k?'active':''}`} onClick={() => setFilter(k)}>{l}</button>
                                ))}
                            </div>
                            <select className="ov-cal-sort-select" value={sort} onChange={e => setSort(e.target.value)}>
                                <option value="newest">Newest</option>
                                <option value="oldest">Oldest</option>
                                <option value="az">A → Z</option>
                            </select>
                        </div>
                        <div className="ov-cal-task-list" ref={menuRef}>
                            {filtered.length === 0 && (
                                <div className="ov-source-empty">{selDay ? `No tasks for ${format(selDay,'MMM d')}` : 'No tasks match this filter'}</div>
                            )}
                            {filtered.map(task => (
                                editingId === task.id ? (
                                    <div key={task.id} className="ov-gen-edit-row" style={{ borderBottom:'1px solid #f0ede9', padding:'5px 4px' }}>
                                        <input className="ov-add-input" autoFocus value={editTitle}
                                            onChange={e => setEditTitle(e.target.value)}
                                            onKeyDown={e => { if (e.key==='Enter'){onEdit(task.id,editTitle.trim());setEditingId(null);} if (e.key==='Escape') setEditingId(null); }} />
                                        <button className="ov-add-confirm" onClick={() => {onEdit(task.id,editTitle.trim());setEditingId(null);}}>Save</button>
                                        <button className="ov-add-cancel" onClick={() => setEditingId(null)}><X size={13} /></button>
                                    </div>
                                ) : (
                                    <div key={task.id} className={`ov-cal-task-row ${task.done?'done':''}`}>
                                        <div className="ov-queue-check" onClick={() => onToggle(task.id)}>
                                            {task.done ? <CheckCircle2 size={15} color="#22c55e" /> : <Circle size={15} color="#9ca3af" />}
                                        </div>
                                        <div className="ov-cal-task-body">
                                            <span className={`ov-gen-title ${task.done?'done':''}`}>{task.title}</span>
                                            {task.done && task.doneDate && <span className="ov-cal-task-meta">done {fmtS(task.doneDate)}</span>}
                                            {!task.done && task.createdDate && <span className="ov-cal-task-meta">added {fmtS(task.createdDate)}</span>}
                                        </div>
                                        <div className="ov-ellipsis-wrap">
                                            <button className="ov-ellipsis-btn" onClick={e => { e.stopPropagation(); setOpenMenu(openMenu===task.id?null:task.id); }}><MoreVertical size={13} /></button>
                                            {openMenu === task.id && (
                                                <div className="ov-ellipsis-menu">
                                                    <button onClick={() => { setEditingId(task.id); setEditTitle(task.title); setOpenMenu(null); }}><Pencil size={11} /> Edit</button>
                                                    <button className="danger" onClick={() => { onDelete(task.id); setOpenMenu(null); }}><Trash2 size={11} /> Delete</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            ))}
                        </div>
                        {showForm ? (
                            <div className="ov-gen-add-row" style={{ marginTop: 8 }}>
                                <input className="ov-add-input" autoFocus placeholder="New task…" value={genInput}
                                    onChange={e => setGenInput(e.target.value)}
                                    onKeyDown={e => { if (e.key==='Enter'){onAdd(genInput.trim());setGenInput('');setShowForm(false);} if(e.key==='Escape'){setShowForm(false);setGenInput('');} }} />
                                <button className="ov-add-confirm" onClick={() => { onAdd(genInput.trim()); setGenInput(''); setShowForm(false); }}>Add</button>
                                <button className="ov-add-cancel" onClick={() => { setShowForm(false); setGenInput(''); }}><X size={13} /></button>
                            </div>
                        ) : (
                            <button className="ov-add-trigger ov-add-trigger-sm" style={{ marginTop: 8 }} onClick={() => setShowForm(true)}>
                                <Plus size={12} /> New task
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── FAMILY YEAR CALENDAR MODAL ────────────────────────────

function FamilyCalendarModal({ history, checkins, onClose }) {
    const todayStr  = getTodayStr();
    const year      = new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd   = new Date(year, 11, 31);
    const allDays   = eachDayOfInterval({ start: yearStart, end: yearEnd });
    const firstDow  = getDay(yearStart);

    const effectiveHistory = {
        ...history,
        [todayStr]: {
            greetGrandparents: checkins.greetGrandparents === true,
            callParents:       checkins.callParents === true,
        },
    };

    const paddedDays = [...Array(firstDow).fill(null), ...allDays];
    const weeks = [];
    for (let i = 0; i < paddedDays.length; i += 7) {
        weeks.push(paddedDays.slice(i, Math.min(i + 7, paddedDays.length)));
        while (weeks[weeks.length - 1].length < 7) weeks[weeks.length - 1].push(null);
    }

    const monthLabels = {};
    let lastMonth = -1;
    allDays.forEach((day, i) => {
        const m = day.getMonth();
        if (m !== lastMonth) { monthLabels[Math.floor((firstDow + i) / 7)] = format(day, 'MMM'); lastMonth = m; }
    });

    let greetCount = 0, callCount = 0;
    Object.values(effectiveHistory).forEach(d => {
        if (d?.greetGrandparents) greetCount++;
        if (d?.callParents)       callCount++;
    });

    const DOW_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

    return (
        <div className="ov-overlay-backdrop" onClick={onClose}>
            <div className="ov-family-modal" onClick={e => e.stopPropagation()}>
                <div className="ov-family-modal-header">
                    <div className="ov-family-modal-title"><Users size={15} color="#e11d48" /><span>Family · {year}</span></div>
                    <button className="ov-overlay-close" onClick={onClose}><X size={14} /></button>
                </div>
                <div className="ov-family-modal-body">
                    <div className="ov-family-stats">
                        <div className="ov-family-stat">
                            <span className="ov-family-stat-swatch" style={{ background: '#e11d48' }} />
                            <span>Greeted grandparents — <strong>{greetCount}</strong> {greetCount === 1 ? 'day' : 'days'}</span>
                        </div>
                        <div className="ov-family-stat">
                            <span className="ov-family-stat-swatch" style={{ background: '#fb7185' }} />
                            <span>Called parents — <strong>{callCount}</strong> {callCount === 1 ? 'day' : 'days'}</span>
                        </div>
                    </div>
                    <div className="ov-family-calendar-wrap">
                        <div className="ov-family-dow-col">
                            <div className="ov-family-month-spacer" />
                            {DOW_LABELS.map((d, i) => (
                                <div key={i} className="ov-family-dow-label">{i % 2 === 1 ? d : ''}</div>
                            ))}
                        </div>
                        <div className="ov-family-grid-scroll">
                            <div className="ov-family-month-row">
                                {weeks.map((_, wi) => <div key={wi} className="ov-family-month-label">{monthLabels[wi] || ''}</div>)}
                            </div>
                            <div className="ov-family-grid">
                                {weeks.map((week, wi) => (
                                    <div key={wi} className="ov-family-week-col">
                                        {week.map((day, di) => {
                                            if (!day) return <div key={di} className="ov-family-cell empty" />;
                                            const ds      = format(day, 'yyyy-MM-dd');
                                            const d       = effectiveHistory[ds] || {};
                                            const isToday = ds === todayStr;
                                            const greet   = !!d.greetGrandparents;
                                            const call    = !!d.callParents;
                                            const title   = [greet ? '✓ Greeted grandparents' : '', call ? '✓ Called parents' : ''].filter(Boolean).join(', ') || format(day, 'MMM d');
                                            return (
                                                <div key={di}
                                                    className={`ov-family-cell ${isToday ? 'today' : ''} ${(greet||call) ? 'has-data' : ''}`}
                                                    title={`${format(day,'MMM d')}: ${title}`}
                                                    style={getFamilyCellStyle(greet, call)} />
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="ov-family-legend">
                        <div className="ov-family-legend-item"><div className="ov-family-cell has-data" style={getFamilyCellStyle(true, false)} /><span>Greeted grandparents only</span></div>
                        <div className="ov-family-legend-item"><div className="ov-family-cell has-data" style={getFamilyCellStyle(false, true)} /><span>Called parents only</span></div>
                        <div className="ov-family-legend-item"><div className="ov-family-cell has-data" style={getFamilyCellStyle(true, true)} /><span>Both done</span></div>
                        <div className="ov-family-legend-item"><div className="ov-family-cell" /><span>None</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── DAILY CHECK-IN CARD ──────────────────────────────────

function DailyCheckCard({ icon: Icon, label, color, bg, items, onToggle, onSkip, onCardClick }) {
    const actionable = items.filter(i => i.state !== 'skip');
    const done    = actionable.filter(i => i.state === true).length;
    const total   = actionable.length;
    const pct     = total === 0 ? 0 : Math.round((done / total) * 100);
    const allDone = total > 0 && done === total;

    return (
        <div className="ov-check-card" style={{ '--card-color': color, '--card-bg': bg }}>
            <div className={`ov-check-card-header ${onCardClick ? 'clickable' : ''}`} onClick={onCardClick}>
                <div className="ov-check-card-title">
                    <div className="ov-check-icon-wrap" style={{ background: bg, border: `1.5px solid ${color}30` }}>
                        <Icon size={14} color={color} />
                    </div>
                    <span>{label}</span>
                    {allDone && <span className="ov-all-done-badge">✓</span>}
                </div>
                <div className="ov-check-meta">
                    <span className="ov-check-count" style={{ color }}>{done}/{total}</span>
                    {onCardClick && <span className="ov-card-nav-hint">↗</span>}
                </div>
            </div>
            {total > 0 && (
                <div className="ov-progress-track">
                    <div className="ov-progress-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
            )}
            <div className="ov-check-items">
                {items.map(item => {
                    const isDone = item.state === true;
                    const isSkip = item.state === 'skip';
                    return (
                        <div key={item.id}
                            className={`ov-check-item ${isDone?'done':''} ${isSkip?'skipped':''}`}
                            onClick={e => { e.stopPropagation(); onToggle(item.id); }}
                            onDoubleClick={e => { e.preventDefault(); e.stopPropagation(); onSkip(item.id); }}
                            title={isSkip ? 'Double-click to restore' : 'Double-click to skip'}>
                            <div className={`ov-check-box ${isSkip?'is-skip':''}`} style={{ borderColor: isDone ? color : '#d1d5db' }}>
                                {isDone && <div className="ov-check-fill" style={{ background: color }} />}
                                {isSkip && <Minus size={9} color="#9ca3af" strokeWidth={2.5} />}
                            </div>
                            <span className="ov-check-label">{item.label}</span>
                            {item.meta && <span className="ov-check-item-meta">{item.meta}</span>}
                            {isSkip && <span className="ov-skip-label">skipped</span>}
                        </div>
                    );
                })}
                {items.length === 0 && <div className="ov-check-empty">Nothing to log</div>}
            </div>
        </div>
    );
}

// ─── QUEUE ITEM ───────────────────────────────────────────


function QueueItem({ item, index, onToggle, onDelete, isTop3,
    onClick, isDragOver, isCompleting, taskDetail,
    onDragStart, onDragOver, onDragEnd, onDrop }) {
    const mod = MODULE_META[item.module] || MODULE_META.general;
    const effectiveDate = taskDetail?.deadline || taskDetail?.dueDate || null;
    const cd = countdown(effectiveDate);


    return (
        <div className={`ov-queue-item ${item.done?'done':''} ${isTop3?'focus':''} ${isDragOver?'drag-over':''} ${isCompleting?'completing':''}`}
            draggable
            onDragStart={onDragStart}
            onDragOver={e => { e.preventDefault(); onDragOver?.(); }}
            onDragEnd={onDragEnd}
            onDrop={e => { e.preventDefault(); onDrop?.(); }}>
            {isCompleting && <ConfettiBurst />}
            {isTop3 && <div className="ov-focus-badge">#{index + 1}</div>}
            <span className="ov-drag-handle"><GripVertical size={12} /></span>
            <div className="ov-queue-check" onClick={e => { e.stopPropagation(); onToggle(); }}>
                {(item.done || isCompleting) ? <CheckCircle2 size={16} color="#22c55e" /> : <Circle size={16} color="#9ca3af" />}
            </div>
            <div className="ov-queue-body" onClick={onClick} title="View details">
                <span className={`ov-queue-title ${item.done?'done':''}`}>{item.title}</span>
                <div className="ov-queue-chips">
                    {taskDetail?.priority && taskDetail.priority !== 'None' &&
                        <span className="ov-priority-chip" data-priority={taskDetail.priority}>{taskDetail.priority}</span>}
                    {taskDetail?.subject &&
                        <span className="ov-subject-chip">{taskDetail.subject}</span>}
                    {taskDetail?.deadline
                        ? <span className="ov-date-chip"><FlagIcon size={9} color="#ef4444" /> {fmtS(taskDetail.deadline)}</span>
                        : effectiveDate
                            ? <span className="ov-date-chip"><TargetIcon size={9} color="#3b82f6" /> {fmtS(effectiveDate)}</span>
                            : null}
                    {cd && <span className={`ov-countdown ${cd.urgent?'urgent':''}`}>{cd.label}</span>}
                    <span className="ov-queue-module-tag" style={{ color: mod.color, background: mod.bg }}>{mod.label}</span>
                </div>
            </div>
            <button className="ov-delete-btn" onClick={e => { e.stopPropagation(); onDelete(); }}><X size={11} /></button>
        </div>
    );
}

// ─── SOURCE TASK ROW ──────────────────────────────────────
// chipsRight=true  → title left | chips right   (School)
// chipsRight=false → all inline wrapping         (Chores, General)

function SourceTaskRow({ task, inQueue, onAddToQueue, moduleColor = '#2563EB', moduleBg = '#EFF6FF',
    showSubject, showAddBtn = false, onDragStart, onItemClick, chipsRight = false, scheduleLabel = null }) {

    const effectiveDate = task.deadline || task.dueDate || null;
    const cd = countdown(effectiveDate);

    const chips = (
        <>
            {task.priority && task.priority !== 'None' && <span className="ov-priority-chip" data-priority={task.priority}>{task.priority}</span>}
            {showSubject && task.subject && <span className="ov-subject-chip">{task.subject}</span>}
            {/* Date chip for School */}
            {task.deadline
                ? <span className="ov-date-chip"><FlagIcon size={9} color="#ef4444" /> {fmtS(task.deadline)}</span>
                : effectiveDate
                    ? <span className="ov-date-chip"><TargetIcon size={9} color="#3b82f6" /> {fmtS(effectiveDate)}</span>
                    : null}
            {cd && <span className={`ov-countdown ${cd.urgent?'urgent':''}`}>{cd.label}</span>}
            {/* Schedule chip for Chores */}
            {scheduleLabel && <span className="ov-schedule-chip">{scheduleLabel}</span>}
        </>
    );


    const addBtn = showAddBtn
        ? (
            <button className={`ov-source-add-btn ${inQueue?'added':''}`}
                onClick={() => !inQueue && onAddToQueue(task)} disabled={inQueue}
                style={inQueue ? {} : { '--hover-color': moduleColor, '--hover-bg': moduleBg }}>
                {inQueue ? <CheckCircle2 size={13} color="#22c55e" /> : <Plus size={13} />}
            </button>
        )
        : (!showAddBtn && inQueue ? <CheckCircle2 size={13} color="#22c55e" style={{ flexShrink: 0 }} /> : null);

    // FIX 2: chipsRight layout for School — title pinned left, chips grouped right
    if (chipsRight) {
        return (
            <div className={`ov-source-row ${inQueue?'in-queue':''}`}
                draggable={!inQueue}
                onDragStart={!inQueue ? onDragStart : undefined}>
                <span className="ov-drag-handle" style={{ opacity: inQueue ? 0.2 : 0.5 }}><GripVertical size={11} /></span>
                <div className="ov-source-row-inner"
                    onClick={onItemClick}
                    style={{ cursor: onItemClick ? 'pointer' : 'default' }}>
                    <span className="ov-source-title">{task.title}</span>
                    <div className="ov-source-chips-right">{chips}</div>
                </div>
                {addBtn}
            </div>
        );
    }

    return (
        <div className={`ov-source-row ${inQueue?'in-queue':''}`}
            draggable={!inQueue}
            onDragStart={!inQueue ? onDragStart : undefined}>
            <span className="ov-drag-handle" style={{ opacity: inQueue ? 0.2 : 0.5 }}><GripVertical size={11} /></span>
            <div className="ov-source-body"
                onClick={onItemClick}
                style={{ cursor: onItemClick ? 'pointer' : 'default' }}>
                <span className="ov-source-title">{task.title}</span>
                {chips}
            </div>
            {addBtn}
        </div>
    );
    
}

// ─── SOURCE GROUP HEADER ──────────────────────────────────

function SourceGroupHeader({ icon: Icon, label, color, bg, count, onGroupClick }) {
    return (
        <div className={`ov-source-group-header ${onGroupClick ? 'clickable' : ''}`}
            style={{ '--sg-color': color, '--sg-bg': bg }}
            onClick={onGroupClick}>
            <div className="ov-source-group-title">
                <Icon size={12} color={color} />
                <span>{label}</span>
                <span className="ov-source-group-count">{count}</span>
            </div>
            {onGroupClick && <span className="ov-source-group-hint">tap to view all ↗</span>}
        </div>
    );
}

// ─── GENERAL TASK ROW (ellipsis menu) ────────────────────

function GeneralTaskRow({ task, onToggle, onDelete, onEdit, openMenu, onMenuToggle }) {
    return (
        <div className={`ov-gen-row ${task.done?'done':''}`}>
            <div className="ov-queue-check" onClick={() => onToggle(task.id)}>
                {task.done ? <CheckCircle2 size={15} color="#22c55e" /> : <></>}
            </div>
            <span className={`ov-gen-title ${task.done?'done':''}`}>{task.title}</span>
            <div className="ov-ellipsis-wrap">
                <button className="ov-ellipsis-btn" onClick={e => { e.stopPropagation(); onMenuToggle(openMenu===task.id?null:task.id); }}>
                    <MoreVertical size={13} />
                </button>
                {openMenu === task.id && (
                    <div className="ov-ellipsis-menu">
                        <button onClick={() => { onEdit(task); onMenuToggle(null); }}><Pencil size={11} /> Edit</button>
                        <button className="danger" onClick={() => { onDelete(task.id); onMenuToggle(null); }}><Trash2 size={11} /> Delete</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── MAIN ─────────────────────────────────────────────────

function Overview({ onNavigate }) {
    const today    = new Date();
    const todayStr = getTodayStr();

    const [schoolTasks,    setSchoolTasks]    = useState([]);
    const [choreTasks,     setChoreTasks]     = useState([]);
    const [bwActivities,   setBwActivities]   = useState([]);
    const [bwLogs,         setBwLogs]         = useState([]);
    const [gymSessions,    setGymSessions]    = useState([]);
    const [journalEntries, setJournalEntries] = useState([]);
    const [codingLogs,     setCodingLogs]     = useState([]);
    const [musicEntries,   setMusicEntries]   = useState([]);
    const [drawingEntries, setDrawingEntries] = useState([]); // FIX 3

    const [generalTasks, setGeneralTasks] = useState([]);
    const [genInput,     setGenInput]     = useState('');
    const [editingGen,   setEditingGen]   = useState(null);
    const [showGenForm,  setShowGenForm]  = useState(false);
    const [openGenMenu,  setOpenGenMenu]  = useState(null);

    const [selectedQueueItem,  setSelectedQueueItem]  = useState(null);
    const [selectedSourceItem, setSelectedSourceItem] = useState(null);
    const [showGenCalendar,    setShowGenCalendar]    = useState(false);
    const [familyModalOpen,    setFamilyModalOpen]    = useState(false);
    const [familyHistory,      setFamilyHistory]      = useState({});

    const [simpleCheckins, setSimpleCheckins] = useState({ sleep: false, weight: false });
    const [gymChecked,     setGymChecked]     = useState(false);
    const [bwChecked,      setBwChecked]      = useState({});
    // FIX 3: drawing added to hobbyCheckins
    const [hobbyCheckins,  setHobbyCheckins]  = useState({ journal: false, coding: false, music: false, drawing: false });
    const [familyCheckins, setFamilyCheckins] = useState({ greetGrandparents: false, callParents: false });

    const [queueItems,    setQueueItems]    = useState([]);
    const [activeSection, setActiveSection] = useState('queue');
    const [loading,       setLoading]       = useState(true);

    const [completingItems, setCompletingItems] = useState(new Set());
    const [glowQueue,       setGlowQueue]       = useState(false);
    const completionTimers = useRef({});

    const dragSrcIndex     = useRef(null);
    const dragSrcType      = useRef(null);
    const dragOverIndexRef = useRef(null);
    const [dragOverIndex,  setDragOverIndex]  = useState(null);
    const dropZoneCounter  = useRef(0);
    const [isPoolDragOver, setIsPoolDragOver] = useState(false);

    const genMenuRef = useRef(null);
    useEffect(() => {
        const h = e => { if (genMenuRef.current && !genMenuRef.current.contains(e.target)) setOpenGenMenu(null); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    useEffect(() => {
        return () => Object.values(completionTimers.current).forEach(clearTimeout);
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const choreLoader =
                    storage.getChores      ? storage.getChores()      :
                    storage.getChoreItems  ? storage.getChoreItems()  :
                    storage.getChoresList  ? storage.getChoresList()  :
                    storage.getChoreTasks  ? storage.getChoreTasks()  :
                    Promise.resolve([]);

                // FIX 3: drawing entries added to load
                const [tasks, rawChores, bwa, bwl, gym, journal, coding, music, drawing] = await Promise.all([
                    storage.getSchoolTasks(),
                    choreLoader,
                    storage.getBWActivities(),
                    storage.getBWLogs(),
                    storage.getGymSessions(),
                    storage.getJournalEntries ? storage.getJournalEntries() : Promise.resolve([]),
                    storage.getCodingLogs     ? storage.getCodingLogs()     : Promise.resolve([]),
                    storage.getMusicEntries   ? storage.getMusicEntries()   : Promise.resolve([]),
                    storage.getDrawingEntries ? storage.getDrawingEntries() : Promise.resolve([]),
                ]);

                const DONE_STATUSES = ['Done','Complete','Completed','done','complete','completed'];

                // FIX 1: normalize chore date fields → dueDate so chips render in SourceTaskRow
                const normalizedChores = (Array.isArray(rawChores) ? rawChores : []).map(c => ({
                    ...c,
                    title:  c.title || c.name || c.label || '(untitled)',
                    status: (DONE_STATUSES.includes(c.status) || c.done === true || c.checked === true || c.completed === true)
                    ? 'Done'
                    : 'Not Started',
                    dueDate: c.dueDate || c.scheduleDate || c.nextDue || c.schedule || null,
                }));

                setSchoolTasks(tasks);       setChoreTasks(normalizedChores);
                setBwActivities(bwa);        setBwLogs(bwl);
                setGymSessions(gym);         setJournalEntries(journal);
                setCodingLogs(coding);       setMusicEntries(music);
                setDrawingEntries(drawing);  // FIX 3

                const bwInit = {};
                bwa.forEach(a => { bwInit[a.id] = bwl.some(l => l.activityId === a.id && l.date === todayStr); });
                setBwChecked(bwInit);
                setGymChecked(gym.some(s => s.date === todayStr));
                setHobbyCheckins({
                    journal: journal.some(e => e.date === todayStr || e.createdAt?.startsWith(todayStr)),
                    coding:  coding.some(l => l.date === todayStr),
                    music:   music.some(e => e.date === todayStr),
                    drawing: drawing.some(e => e.date === todayStr || e.createdAt?.startsWith(todayStr)), // FIX 3
                });

                const [savedQueue, savedCheckins, savedGeneral, savedFamilyHistory] = await Promise.all([
                    storage.getOverviewQueue(),
                    storage.getOverviewCheckins(),
                    storage.getOverviewGeneralTasks ? storage.getOverviewGeneralTasks() : Promise.resolve([]),
                    storage.getFamilyHistory        ? storage.getFamilyHistory()        : Promise.resolve({}),
                ]);

                const rawGeneral = (savedGeneral || []).map(t => ({
                    ...t,
                    done: t.doneDate === todayStr ? t.done : false,
                }));
                setGeneralTasks(rawGeneral);
                if (savedFamilyHistory) setFamilyHistory(savedFamilyHistory);

                // FIX 4: silently remove queue items whose linked task is already Done on load
                const cleanedQueue = (savedQueue || [])
                    .filter(item => {
                        if (item.schoolTaskId) {
                            const t = tasks.find(t => t.id === item.schoolTaskId);
                            if (t && DONE_STATUSES.includes(t.status)) return false;
                        }
                        if (item.choreTaskId) {
                            const t = normalizedChores.find(t => t.id === item.choreTaskId);
                            if (t && t.status === 'Done') return false;
                        }
                        if (item.generalTaskId) {
                            const t = rawGeneral.find(t => t.id === item.generalTaskId);
                            if (t && t.done) return false;
                        }
                        return true;
                    })
                    .map(i => ({ ...i, done: i.doneDate === todayStr ? i.done : false }));

                setQueueItems(cleanedQueue);
                // Write back if anything was pruned so stale items don't reappear
                if ((savedQueue || []).length !== cleanedQueue.length) {
                    storage.saveOverviewQueue(cleanedQueue);
                }

                if (savedCheckins?.date === todayStr) {
                    const d = savedCheckins.data || {};
                    if (d.simple) setSimpleCheckins(d.simple);
                    if (d.gym !== undefined) setGymChecked(d.gym);
                    if (d.bw)    setBwChecked(p => ({ ...p, ...d.bw }));
                    // FIX 3: spread so drawing key is preserved even if old saves don't have it
                    if (d.hobby) setHobbyCheckins(prev => ({ ...prev, ...d.hobby }));
                    if (d.family) setFamilyCheckins(d.family);
                }
            } catch (e) { console.warn('Overview load error:', e); }
            setLoading(false);
        };
        load();
    }, []);

    const persistCheckins = (s, bw, gym, hobby, family) =>
        storage.saveOverviewCheckins({ date: todayStr, data: { simple: s, bw, gym, hobby, family } });
    const persistGeneral       = t => { if (storage.saveOverviewGeneralTasks) storage.saveOverviewGeneralTasks(t); };
    const persistFamilyHistory = h => { if (storage.saveFamilyHistory) storage.saveFamilyHistory(h); };

    const cycle   = v => v === true ? false : true;
    const skipVal = v => v === 'skip' ? false : 'skip';

    const toggleSimple = k => { const u = { ...simpleCheckins, [k]: cycle(simpleCheckins[k]) }; setSimpleCheckins(u); persistCheckins(u, bwChecked, gymChecked, hobbyCheckins, familyCheckins); };
    const skipSimple   = k => { const u = { ...simpleCheckins, [k]: skipVal(simpleCheckins[k]) }; setSimpleCheckins(u); persistCheckins(u, bwChecked, gymChecked, hobbyCheckins, familyCheckins); };
    const toggleGym    = () => { const v = cycle(gymChecked); setGymChecked(v); persistCheckins(simpleCheckins, bwChecked, v, hobbyCheckins, familyCheckins); };
    const skipGym      = () => { const v = skipVal(gymChecked); setGymChecked(v); persistCheckins(simpleCheckins, bwChecked, v, hobbyCheckins, familyCheckins); };
    const toggleBW     = id => { const u = { ...bwChecked, [id]: cycle(bwChecked[id]??false) }; setBwChecked(u); persistCheckins(simpleCheckins, u, gymChecked, hobbyCheckins, familyCheckins); };
    const skipBW       = id => { const u = { ...bwChecked, [id]: skipVal(bwChecked[id]??false) }; setBwChecked(u); persistCheckins(simpleCheckins, u, gymChecked, hobbyCheckins, familyCheckins); };
    const toggleHobby  = k => { const u = { ...hobbyCheckins, [k]: cycle(hobbyCheckins[k]) }; setHobbyCheckins(u); persistCheckins(simpleCheckins, bwChecked, gymChecked, u, familyCheckins); };
    const skipHobby    = k => { const u = { ...hobbyCheckins, [k]: skipVal(hobbyCheckins[k]) }; setHobbyCheckins(u); persistCheckins(simpleCheckins, bwChecked, gymChecked, u, familyCheckins); };

    const toggleFamily = k => {
        const u = { ...familyCheckins, [k]: cycle(familyCheckins[k]) };
        setFamilyCheckins(u);
        persistCheckins(simpleCheckins, bwChecked, gymChecked, hobbyCheckins, u);
        const hist = {
            ...familyHistory,
            [todayStr]: {
                greetGrandparents: u.greetGrandparents === true,
                callParents:       u.callParents === true,
            },
        };
        setFamilyHistory(hist);
        persistFamilyHistory(hist);
    };
    const skipFamily = k => {
        const u = { ...familyCheckins, [k]: skipVal(familyCheckins[k]) };
        setFamilyCheckins(u);
        persistCheckins(simpleCheckins, bwChecked, gymChecked, hobbyCheckins, u);
    };

    const triggerCompletion = useCallback((itemId) => {
        setCompletingItems(prev => new Set([...prev, itemId]));
        setGlowQueue(true);
        setTimeout(() => setGlowQueue(false), 700);
        completionTimers.current[itemId] = setTimeout(() => {
            setQueueItems(prev => {
                const u = prev.filter(i => i.id !== itemId);
                storage.saveOverviewQueue(u);
                return u;
            });
            setCompletingItems(prev => { const n = new Set(prev); n.delete(itemId); return n; });
            delete completionTimers.current[itemId];
        }, 1500);
    }, []);

    const handleSchoolStatus = async (task, newStatus) => {
        const upd = { ...task, status: newStatus, priority: newStatus === 'Done' ? 'None' : task.priority, completedDate: newStatus === 'Done' ? todayStr : (task.completedDate || null) };
        await storage.updateSchoolTask(task.id, upd);
        setSchoolTasks(p => p.map(t => t.id === task.id ? upd : t));
        if (newStatus === 'Done') queueItems.filter(i => i.schoolTaskId === task.id).forEach(i => triggerCompletion(i.id));
    };
    const handleChoreStatus = async (task, newStatus) => {
        const upd = { ...task, status: newStatus, completedDate: newStatus === 'Done' ? todayStr : (task.completedDate || null) };
        if (storage.updateChore) await storage.updateChore(task.id, upd);
        setChoreTasks(p => p.map(t => t.id === task.id ? upd : t));
        if (newStatus === 'Done') queueItems.filter(i => i.choreTaskId === task.id).forEach(i => triggerCompletion(i.id));
    };

    const addGeneralTask = (title) => {
        const t = (typeof title === 'string' ? title : genInput).trim();
        if (!t) return;
        const task = { id: Date.now().toString(), title: t, done: false, doneDate: null, createdDate: todayStr };
        const u = [...generalTasks, task]; setGeneralTasks(u); persistGeneral(u);
        setGenInput(''); setShowGenForm(false);
    };
    const toggleGeneralTask = id => {
        const u = generalTasks.map(t => t.id === id ? { ...t, done: !t.done, doneDate: !t.done ? todayStr : null } : t);
        setGeneralTasks(u); persistGeneral(u);
    };
    const deleteGeneralTask = id => { const u = generalTasks.filter(t => t.id !== id); setGeneralTasks(u); persistGeneral(u); };
    const saveEditGeneral = (idOrNull, titleOrNull) => {
        if (idOrNull && titleOrNull) { const u = generalTasks.map(t => t.id === idOrNull ? { ...t, title: titleOrNull } : t); setGeneralTasks(u); persistGeneral(u); return; }
        if (!editingGen?.title?.trim()) return;
        const u = generalTasks.map(t => t.id === editingGen.id ? { ...t, title: editingGen.title.trim() } : t);
        setGeneralTasks(u); persistGeneral(u); setEditingGen(null);
    };
    const addGeneralToQueue = task => {
        if (queueItems.some(i => i.generalTaskId === task.id)) return;
        const item = { id: Date.now().toString(), title: task.title, module: 'general', generalTaskId: task.id, done: false, doneDate: null, createdDate: todayStr };
        const u = [...queueItems, item]; setQueueItems(u); storage.saveOverviewQueue(u);
    };
    const addSchoolTaskToQueue = task => {
        if (queueItems.some(i => i.schoolTaskId === task.id)) return;
        const item = { id: Date.now().toString(), title: task.title, module: 'school', schoolTaskId: task.id, done: false, doneDate: null, createdDate: todayStr };
        const u = [...queueItems, item]; setQueueItems(u); storage.saveOverviewQueue(u);
    };
    const addChoreToQueue = task => {
        if (queueItems.some(i => i.choreTaskId === task.id)) return;
        const item = { id: Date.now().toString(), title: task.title, module: 'chores', choreTaskId: task.id, done: false, doneDate: null, createdDate: todayStr };
        const u = [...queueItems, item]; setQueueItems(u); storage.saveOverviewQueue(u);
    };
    const toggleQueue = id => {
        const u = queueItems.map(i => i.id === id ? { ...i, done: !i.done, doneDate: !i.done ? todayStr : null } : i);
        setQueueItems(u); storage.saveOverviewQueue(u);
    };
    const deleteQueue = id => { const u = queueItems.filter(i => i.id !== id); setQueueItems(u); storage.saveOverviewQueue(u); };

    const handleQDragStart = idx => { dragSrcIndex.current = idx; dragSrcType.current = 'queue'; };
    const handleQDragOver  = idx => { if (dragOverIndexRef.current !== idx) { dragOverIndexRef.current = idx; setDragOverIndex(idx); } };
    const handleQDragEnd   = ()  => { dragSrcIndex.current = null; dragSrcType.current = null; dragOverIndexRef.current = null; setDragOverIndex(null); setIsPoolDragOver(false); dropZoneCounter.current = 0; };
    const handleQDrop = targetIdx => {
        if (dragSrcType.current !== 'queue') return; // ← pool drags: don't interfere, let event bubble
        const src = dragSrcIndex.current;
        if (src === null || src === targetIdx) { handleQDragEnd(); return; }
        const u = [...queueItems]; const [removed] = u.splice(src, 1); u.splice(targetIdx, 0, removed);
        setQueueItems(u); storage.saveOverviewQueue(u); handleQDragEnd();
    };
    const handleSrcDragStart = (e, task, module) => {
        dragSrcType.current = 'pool';
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/json', JSON.stringify({ taskId: task.id, module }));
    };
    const handleDropZoneDragEnter = e => { e.preventDefault(); if (dragSrcType.current === 'pool') { dropZoneCounter.current += 1; setIsPoolDragOver(true); } };
    const handleDropZoneDragLeave = () => { if (dragSrcType.current === 'pool') { dropZoneCounter.current -= 1; if (dropZoneCounter.current <= 0) { dropZoneCounter.current = 0; setIsPoolDragOver(false); } } };
    const handleDropZoneDragOver  = e => e.preventDefault();
    const handleDropZoneDrop      = e => {
        e.preventDefault(); dropZoneCounter.current = 0; setIsPoolDragOver(false);
        if (dragSrcType.current !== 'pool') return;
        try {
            const { taskId, module } = JSON.parse(e.dataTransfer.getData('application/json') || '{}');
            if (module === 'school')  { const t = schoolTasks.find(t => t.id === taskId);  if (t) addSchoolTaskToQueue(t); }
            if (module === 'chores')  { const t = choreTasks.find(t => t.id === taskId);   if (t) addChoreToQueue(t); }
            if (module === 'general') { const t = generalTasks.find(t => t.id === taskId); if (t) addGeneralToQueue(t); }
        } catch {}
    };

    const handleQueueCheck = useCallback((id) => {
        const item = queueItems.find(i => i.id === id);
        if (!item) return;
        if (item.done) {
            if (completionTimers.current[id]) {
                clearTimeout(completionTimers.current[id]);
                delete completionTimers.current[id];
            }
            setCompletingItems(prev => { const n = new Set(prev); n.delete(id); return n; });
            const u = queueItems.map(i => i.id === id ? { ...i, done: false, doneDate: null } : i);
            setQueueItems(u); storage.saveOverviewQueue(u);
    
            // Also un-check the linked general task
            if (item.generalTaskId) {
                const u2 = generalTasks.map(t => t.id === item.generalTaskId ? { ...t, done: false, doneDate: null } : t);
                setGeneralTasks(u2); persistGeneral(u2);
            }
        } else {
            // Mark linked source task as done before triggering animation
            if (item.generalTaskId) {
                const u2 = generalTasks.map(t => t.id === item.generalTaskId
                    ? { ...t, done: true, doneDate: todayStr }
                    : t
                );
                setGeneralTasks(u2); persistGeneral(u2);
            }
            if (item.schoolTaskId) {
                const t = schoolTasks.find(t => t.id === item.schoolTaskId);
                if (t) handleSchoolStatus(t, 'Done');
            }
            if (item.choreTaskId) {
                const t = choreTasks.find(t => t.id === item.choreTaskId);
                if (t) handleChoreStatus(t, 'Done');
            }
            triggerCompletion(id);
        }
    }, [queueItems, generalTasks, schoolTasks, choreTasks, triggerCompletion, todayStr]);

    const getTaskDetail = item => {
        if (item.schoolTaskId)  return schoolTasks.find(t => t.id === item.schoolTaskId)   || null;
        if (item.choreTaskId)   return choreTasks.find(t => t.id === item.choreTaskId)     || null;
        if (item.generalTaskId) return generalTasks.find(t => t.id === item.generalTaskId) || null;
        return null;
    };

    const pendingSchool  = schoolTasks.filter(t => t.status !== 'Done').sort((a,b) => {
        if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        return (a.deadline||a.dueDate||'9999').localeCompare(b.deadline||b.dueDate||'9999');
    });
    const pendingChores  = choreTasks.filter(t => t.status !== 'Done');
    const pendingGeneral = generalTasks.filter(t => !t.done);

    const visibleSchool  = pendingSchool.filter(t => !queueItems.some(i => i.schoolTaskId  === t.id));
    const visibleChores  = pendingChores.filter(t => !queueItems.some(i => i.choreTaskId   === t.id));
    const visibleGeneral = pendingGeneral.filter(t => !queueItems.some(i => i.generalTaskId === t.id));

    const doneTodayTasks = schoolTasks.filter(t => t.completedDate === todayStr && t.status === 'Done');
    const schoolDueToday = schoolTasks.filter(t => t.dueDate?.startsWith(todayStr) || t.deadline?.startsWith(todayStr));
    const top3  = queueItems.slice(0, 3);
    const rest  = queueItems.slice(3);
    const qDone = queueItems.filter(i => i.done).length;

    const sleepItems  = [{ id: 'sleep',  label: "Log tonight's sleep", state: simpleCheckins.sleep  }];
    const weightItems = [{ id: 'weight', label: "Log today's weight",  state: simpleCheckins.weight }];
    const gymItems    = [{ id: 'gym',    label: 'Log gym session',      state: gymChecked             }];
    const bwItems     = bwActivities.map(a => ({ id: a.id, label: a.name, state: bwChecked[a.id] ?? false, meta: a.goals?.daily ? `Goal: ${a.goals.daily}` : null }));
    // FIX 3: drawing item included in Hobbies
    const hobbyItems  = [
        { id: 'journal', label: 'Write journal entry', state: hobbyCheckins.journal },
        { id: 'coding',  label: 'Log coding session',  state: hobbyCheckins.coding  },
        { id: 'drawing', label: 'Log drawing session', state: hobbyCheckins.drawing },
        { id: 'music',   label: 'Log music practice',  state: hobbyCheckins.music   },
    ];
    const familyItems = [
        { id: 'greetGrandparents', label: 'Greet grandparents', state: familyCheckins.greetGrandparents },
        { id: 'callParents',       label: 'Call parents',       state: familyCheckins.callParents       },
    ];
    const allCheckinItems  = [...sleepItems, ...weightItems, ...gymItems, ...bwItems, ...hobbyItems, ...familyItems];
    const checkinRemaining = allCheckinItems.filter(i => i.state !== true && i.state !== 'skip').length;
    const checkinAllDone   = checkinRemaining === 0;

    const stats = [
        { label: 'Pending',   value: pendingSchool.length,      sub: `${doneTodayTasks.length} done today`, color: '#2563EB', Icon: BookOpen },
        { label: 'Due Today', value: schoolDueToday.length,     sub: `${schoolDueToday.filter(t=>t.status==='Done').length} done`, color: schoolDueToday.length > 0 ? '#ef4444' : '#22c55e', Icon: () => <TargetIcon size={12} color={schoolDueToday.length > 0 ? '#ef4444' : '#22c55e'} /> },
        { label: 'Queue',     value: queueItems.length - qDone, sub: `${qDone} done`, color: '#7c3aed', Icon: Zap },
        { label: 'Check-ins', value: checkinRemaining,          sub: checkinAllDone ? 'all done ✓' : 'remaining', color: checkinAllDone ? '#22c55e' : '#f59e0b', Icon: CheckCircle2 },
    ];

    if (loading) return <div className="ov-loading">Loading…</div>;

    const sourceItemToOverlay = (module, task) => ({
        id: task.id, title: task.title, module,
        schoolTaskId: module === 'school' ? task.id : undefined,
        choreTaskId:  module === 'chores' ? task.id : undefined,
        done: task.status === 'Done',
    });

    return (
        <div className="overview-view module-overview">

            {selectedQueueItem && (
                <TaskDetailOverlay item={selectedQueueItem} task={getTaskDetail(selectedQueueItem)}
                    onClose={() => setSelectedQueueItem(null)} onNavigate={onNavigate} />
            )}
            {selectedSourceItem && (
                <TaskDetailOverlay
                    item={sourceItemToOverlay(selectedSourceItem.module, selectedSourceItem.task)}
                    task={selectedSourceItem.task}
                    onClose={() => setSelectedSourceItem(null)} onNavigate={onNavigate} />
            )}
            {showGenCalendar && (
                <GenCalendarModal tasks={generalTasks} onClose={() => setShowGenCalendar(false)}
                    onToggle={toggleGeneralTask} onDelete={deleteGeneralTask}
                    onEdit={saveEditGeneral} onAdd={addGeneralTask} />
            )}
            {familyModalOpen && (
                <FamilyCalendarModal history={familyHistory} checkins={familyCheckins}
                    onClose={() => setFamilyModalOpen(false)} />
            )}

            {/* Header */}
            <div className="ov-header">
                <div className="ov-date-block">
                    <span className="ov-day-name">{format(today, 'EEEE')}</span>
                    <span className="ov-date-full">{format(today, 'MMMM d, yyyy')}</span>
                </div>
                <div className="ov-tabs">
                    {[
                        { key: 'queue',    label: 'Queue',     Icon: Zap,          badge: null },
                        { key: 'checkins', label: 'Check-ins', Icon: CheckCircle2, badge: checkinAllDone ? null : checkinRemaining },
                    ].map(({ key, label, Icon, badge }) => (
                        <button key={key} className={`ov-tab ${activeSection===key?'active':''}`} onClick={() => setActiveSection(key)}>
                            <Icon size={12} /><span>{label}</span>
                            {badge != null && <span className="ov-tab-badge">{badge}</span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stat bar */}
            <div className="ov-stat-bar">
                {stats.map((s, i) => (
                    <div key={i} className="ov-stat-pill" style={{ '--pill-color': s.color }}>
                        <s.Icon size={12} color={s.color} />
                        <div className="ov-stat-text">
                            <span className="ov-stat-val" style={{ color: s.color }}>{s.value}</span>
                            <span className="ov-stat-label">{s.label}</span>
                        </div>
                        <span className="ov-stat-sub">{s.sub}</span>
                    </div>
                ))}
            </div>

            <div className="ov-body">

                {/* ══ QUEUE TAB ══ */}
                {activeSection === 'queue' && (
                    <div className="ov-queue-layout">
                        <div className="ov-queue-top"
                            onDragEnter={handleDropZoneDragEnter}
                            onDragLeave={handleDropZoneDragLeave}
                            onDragOver={handleDropZoneDragOver}
                            onDrop={handleDropZoneDrop}>

                            <div className={`ov-focus-section ${glowQueue ? 'glow' : ''}`}>
                                <div className="ov-section-header">
                                    <div className="ov-section-title">
                                        <Pin size={13} color="#7c3aed" /><span>Top 3 Focus</span>
                                        <span className="ov-section-hint">{Math.min(top3.length,3)}/3</span>
                                    </div>
                                </div>
                                {top3.length === 0 && (
                                    <div className={`ov-focus-empty ${isPoolDragOver?'drag-active':''}`}>
                                        <Zap size={20} color="#c4b5fd" />
                                        <span>Drag tasks from below to add to queue</span>
                                    </div>
                                )}
                                {top3.map((item, i) => (
                                    <QueueItem key={item.id} item={item} index={i} isTop3
                                        taskDetail={(() => { const d = getTaskDetail(item); console.log('taskDetail for', item.title, d); return d; })()}
                                        isDragOver={dragOverIndex === i}
                                        isCompleting={completingItems.has(item.id)}
                                        onClick={() => setSelectedQueueItem(item)}
                                        onToggle={() => handleQueueCheck(item.id)}
                                        onDelete={() => deleteQueue(item.id)}
                                        onDragStart={() => handleQDragStart(i)}
                                        onDragOver={() => handleQDragOver(i)}
                                        onDragEnd={handleQDragEnd}
                                        onDrop={() => handleQDrop(i)} />
                                ))}
                            </div>

                            {(rest.length > 0 || isPoolDragOver) && (
                                <div className={`ov-rest-section ${isPoolDragOver && rest.length === 0 ? 'drop-hint-only' : ''}`}>
                                    {rest.length > 0 && (
                                        <>
                                            <div className="ov-section-header">
                                                <div className="ov-section-title"><LayoutGrid size={12} color="#6b7280" /><span>Up Next</span></div>
                                            </div>
                                            {rest.map((item, i) => (
                                                <QueueItem key={item.id} item={item} index={i+3} isTop3={false}
                                                    taskDetail={getTaskDetail(item)}
                                                    isDragOver={dragOverIndex === i+3}
                                                    isCompleting={completingItems.has(item.id)}
                                                    onClick={() => setSelectedQueueItem(item)}
                                                    onToggle={() => handleQueueCheck(item.id)}
                                                    onDelete={() => deleteQueue(item.id)}
                                                    onDragStart={() => handleQDragStart(i+3)}
                                                    onDragOver={() => handleQDragOver(i+3)}
                                                    onDragEnd={handleQDragEnd}
                                                    onDrop={() => handleQDrop(i+3)} />
                                            ))}
                                        </>
                                    )}
                                    {isPoolDragOver && <div className="ov-drop-hint">↓ Drop to add to queue</div>}
                                </div>
                            )}
                        </div>

                        {/* ── Source pools ── */}
                        <div className="ov-source-section">

                            {/* FIX 2: chipsRight=true for School */}
                            <div className="ov-source-group">
                                <SourceGroupHeader icon={BookOpen} label="School" color="#2563EB" bg="#EFF6FF" count={visibleSchool.length} />
                                <div className="ov-source-pool">
                                    {visibleSchool.length === 0
                                        ? <div className="ov-source-empty">All school tasks done!</div>
                                        : visibleSchool.map(task => (
                                            <SourceTaskRow key={task.id} task={task} showSubject chipsRight showAddBtn={false}
                                                moduleColor="#2563EB" moduleBg="#EFF6FF"
                                                inQueue={queueItems.some(i => i.schoolTaskId === task.id)}
                                                onAddToQueue={addSchoolTaskToQueue}
                                                onItemClick={() => setSelectedSourceItem({ module: 'school', task })}
                                                onDragStart={e => handleSrcDragStart(e, task, 'school')} />
                                        ))
                                    }
                                </div>
                            </div>

                            <div className="ov-source-group-divider" />

                            {/* FIX 1: Chores now show date chip via normalized dueDate */}
                            <div className="ov-source-group">
                                <SourceGroupHeader icon={Home} label="Chores" color="#D97706" bg="#FFFBEB"
                                    count={visibleChores.length} />
                                <div className="ov-source-pool">
                                    {visibleChores.length === 0
                                        ? <div className="ov-source-empty">No pending chores!</div>
                                        : visibleChores.map(task => {
                                            const scheduleLabel = task.routine === 'Daily' && task.scheduledDays?.length > 0
                                                ? task.scheduledDays.join(' · ')
                                                : task.routine || null;
                                            return (
                                                <SourceTaskRow key={task.id} task={task} showAddBtn={false}
                                                    scheduleLabel={scheduleLabel}
                                                    moduleColor="#D97706" moduleBg="#FFFBEB"
                                                    inQueue={false}
                                                    onAddToQueue={addChoreToQueue}
                                                    onItemClick={() => setSelectedSourceItem({ module: 'chores', task })}
                                                    onDragStart={e => handleSrcDragStart(e, task, 'chores')} />
                                            );
                                        })
                                    }
                                </div>
                            </div>

                            <div className="ov-source-group-divider" />

                            {/* General Tasks */}
                            <div className="ov-source-group" ref={genMenuRef}>
                                <SourceGroupHeader icon={Star} label="General Tasks" color="#6b7280" bg="#f9fafb"
                                    count={visibleGeneral.length} onGroupClick={() => setShowGenCalendar(true)} />
                                <div className="ov-source-pool">
                                    {visibleGeneral.length === 0 && !showGenForm && (
                                        <div className="ov-source-empty">No pending general tasks</div>
                                    )}
                                    {visibleGeneral.map(task => (
                                        editingGen?.id === task.id ? (
                                            <div key={task.id} className="ov-gen-edit-row">
                                                <input className="ov-add-input" autoFocus value={editingGen.title}
                                                    onChange={e => setEditingGen({ ...editingGen, title: e.target.value })}
                                                    onKeyDown={e => { if (e.key==='Enter') saveEditGeneral(); if (e.key==='Escape') setEditingGen(null); }} />
                                                <button className="ov-add-confirm" onClick={() => saveEditGeneral()}>Save</button>
                                                <button className="ov-add-cancel" onClick={() => setEditingGen(null)}><X size={13} /></button>
                                            </div>
                                        ) : (
                                            <div key={task.id} className="ov-source-row"
                                                draggable onDragStart={e => handleSrcDragStart(e, task, 'general')}>
                                                <span className="ov-drag-handle" style={{ opacity: 0.5 }}><GripVertical size={11} /></span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <GeneralTaskRow task={task}
                                                        onToggle={toggleGeneralTask}
                                                        onDelete={deleteGeneralTask}
                                                        openMenu={openGenMenu}
                                                        onMenuToggle={setOpenGenMenu}
                                                        onEdit={t => setEditingGen({ id: t.id, title: t.title })} />
                                                </div>
                                                <button
                                                    className={`ov-source-add-btn ${queueItems.some(i => i.generalTaskId === task.id) ? 'added' : ''}`}
                                                    onClick={() => addGeneralToQueue(task)}
                                                    disabled={queueItems.some(i => i.generalTaskId === task.id)}
                                                    title="Add to queue"
                                                    style={{ '--hover-color': '#6b7280', '--hover-bg': '#f3f4f6' }}>
                                                    {queueItems.some(i => i.generalTaskId === task.id)
                                                        ? <CheckCircle2 size={13} color="#22c55e" />
                                                        : <></>}
                                                </button>
                                            </div>
                                        )
                                    ))}
                                    {showGenForm ? (
                                        <div className="ov-gen-add-row">
                                            <input className="ov-add-input" autoFocus placeholder="e.g. Message Jake about the project…"
                                                value={genInput} onChange={e => setGenInput(e.target.value)}
                                                onKeyDown={e => { if (e.key==='Enter') addGeneralTask(); if (e.key==='Escape'){setShowGenForm(false);setGenInput('');} }} />
                                            <button className="ov-add-confirm" onClick={() => addGeneralTask()}>Add</button>
                                            <button className="ov-add-cancel" onClick={() => { setShowGenForm(false); setGenInput(''); }}><X size={13} /></button>
                                        </div>
                                    ) : (
                                        <button className="ov-add-trigger ov-add-trigger-sm" onClick={() => setShowGenForm(true)}>
                                            <Plus size={12} /> New general task
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══ CHECK-INS TAB ══ */}
                {activeSection === 'checkins' && (
                    <div className="ov-checkins-view">
                        <div className={`ov-checkin-banner ${checkinAllDone?'all-done':''}`}>
                        {checkinAllDone && (
                            <>
                                <CheckCircle2 size={14} color="#166534" /> 
                                <span>All check-ins complete for today!</span>
                            </>
                        )}
                        </div>
                        <div className="ov-checkins-grid">
                            <DailyCheckCard icon={Moon}     label="Sleep"       color="#9A86E0" bg="#F5F3FF" items={sleepItems}   onToggle={() => toggleSimple('sleep')}  onSkip={() => skipSimple('sleep')}  onCardClick={() => onNavigate?.('sleep')}   />
                            <DailyCheckCard icon={Scale}    label="Weight"      color="#92400E" bg="#FDF6EE" items={weightItems}  onToggle={() => toggleSimple('weight')} onSkip={() => skipSimple('weight')} onCardClick={() => onNavigate?.('weight')}  />
                            <DailyCheckCard icon={Dumbbell} label="Gym"         color="#0891B2" bg="#F0FDFF" items={gymItems}     onToggle={toggleGym}                    onSkip={skipGym}                    onCardClick={() => onNavigate?.('fitness')} />
                            <DailyCheckCard icon={Dumbbell} label="Body Weight" color="#0e7490" bg="#ecfeff" items={bwItems}      onToggle={id => toggleBW(id)}           onSkip={id => skipBW(id)}           onCardClick={() => onNavigate?.('fitness')} />
                            {/* FIX 3: Hobbies now includes drawing */}
                            <DailyCheckCard icon={Heart}    label="Hobbies"     color="#DB2777" bg="#FDF2F8" items={hobbyItems}   onToggle={id => toggleHobby(id)}        onSkip={id => skipHobby(id)}        onCardClick={() => onNavigate?.('hobbies')} />
                            <DailyCheckCard icon={Users}    label="Family"      color="#e11d48" bg="#fff1f2" items={familyItems}  onToggle={id => toggleFamily(id)}       onSkip={id => skipFamily(id)}       onCardClick={() => setFamilyModalOpen(true)} />
                        </div>
                        <div className="ov-module-nav">
                            <div className="ov-section-header">
                                <div className="ov-section-title"><LayoutGrid size={12} color="#6b7280" /><span>Quick Navigate</span></div>
                            </div>
                            <div className="ov-module-grid">
                                {Object.entries(MODULE_META).filter(([k]) => k !== 'general').map(([key, m]) => (
                                    <button key={key} className="ov-module-btn" style={{ '--m-color': m.color, '--m-bg': m.bg }}
                                        onClick={() => onNavigate?.(key)}>
                                        <div className="ov-module-btn-icon"><m.icon size={15} color={m.color} /></div>
                                        <span>{m.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Overview;