import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../../utils/storage';
import {
    format, parseISO, isToday, startOfMonth, endOfMonth,
    eachDayOfInterval, getDay, eachMonthOfInterval
} from 'date-fns';
import { Plus, Pencil, Trash2, X, MoreVertical, ChevronLeft, ChevronRight, BookOpen, Mail, NotebookPen, Palette, Music2, Code2,
        SendHorizontal, Mailbox, BookCheck
} from 'lucide-react';
import './Hobbies.css';

// ─── HELPERS ──────────────────────────────────────────────

const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const fmtDate = (s) => {
    if (!s) return '—';
    try { return format(parseISO(s), 'MMM d, yyyy'); } catch { return s; }
};

const YEAR = new Date().getFullYear();
const ALL_MONTHS = Array.from({ length: 12 }, (_, i) =>
    `${YEAR}-${String(i+1).padStart(2,'0')}`
);

const CODING_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Maintenance'];
const STATUS_COLORS = {
    'Not Started':  '#9ca3af',
    'In Progress':  '#f59e0b',
    'Completed':    '#22c55e',
    'Maintenance':  '#6366f1',
};

// ─── SHARED: ELLIPSIS MENU ────────────────────────────────

function EllipsisMenu({ items }) {
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
                <MoreVertical size={13} />
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

// ─── SHARED: YEAR CALENDAR (ticker) ───────────────────────

function YearCalendar({ 
    entries, 
    accentColor = '#6366f1', 
    onDayClick,        // called when empty day is clicked (for tick)
    buildPopup,        // builds popup sessions for active days
    getEntryIcon,      // (entry) => JSX icon — optional
    getEntryColor,     // (entries[]) => string color — optional
    singleEntryPerDay, // if true, clicking ticked day opens inline modal
    onTickDelete,      // (id) => void — for inline modal delete
    onTickNotesChange, // (id, notes) => void — auto-save notes
    instruments,
}) {
    const [popup, setPopup] = useState(null);
    const [inlineModal, setInlineModal] = useState(null); // { date, entry }
    const [inlineNotes, setInlineNotes] = useState('');
    const notesTimer = useRef(null);

    const year = new Date().getFullYear();
    const months = eachMonthOfInterval({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) });

    const byDate = {};
    entries.forEach(e => {
        const d = e.date;
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(e);
    });
    const activeDates = Object.keys(byDate).sort();

    const handleDayClick = (ds) => {
        const dayEntries = byDate[ds] || [];
        if (dayEntries.length === 0) {
            // Empty day — tick it
            if (onDayClick) onDayClick(ds);
        } else if (singleEntryPerDay) {
            // Already ticked — open inline modal
            setInlineNotes(dayEntries[0].notes || '');
            setInlineModal({ date: ds, entry: dayEntries[0] });
        } else if (buildPopup) {
            // Multi-entry day — open popup
            setPopup({ date: ds, sessions: buildPopup(dayEntries), activeDates });
        }
    };

    const handleNotesChange = (val) => {
        setInlineNotes(val);
        if (notesTimer.current) clearTimeout(notesTimer.current);
        notesTimer.current = setTimeout(() => {
            if (onTickNotesChange && inlineModal?.entry?.id) {
                onTickNotesChange(inlineModal.entry.id, val);
            }
        }, 600);
    };

    const navigateTo = (newDate) => {
        if (!byDate[newDate]) { setPopup(null); return; }
        setPopup({ date: newDate, sessions: buildPopup(byDate[newDate]), activeDates });
    };

    return (
        <>
            <div className="hob-cal-grid">
                {months.map(month => {
                    const mk = format(month, 'yyyy-MM');
                    const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
                    const offset = getDay(startOfMonth(month));
                    const monthCount = entries.filter(e => e.date?.startsWith(mk)).length;

                    return (
                        <div key={mk} className="hob-cal-month">
                            <div className="hob-cal-month-header">
                                <span>{format(month, 'MMM')}</span>
                                <span className="hob-cal-count">{monthCount > 0 ? monthCount : '—'}</span>
                            </div>
                            <div className="hob-cal-month-grid">
                                {['S','M','T','W','T','F','S'].map((d,i) => (
                                    <div key={i} className="hob-cal-weekday">{d}</div>
                                ))}
                                {Array.from({ length: offset }).map((_,i) => <div key={`e${i}`} />)}
                                {days.map(day => {
                                    const ds = format(day, 'yyyy-MM-dd');
                                    const dayEntries = byDate[ds] || [];
                                    const has = dayEntries.length > 0;
                                    const cellColor = has
                                        ? (getEntryColor ? getEntryColor(dayEntries) : accentColor)
                                        : null;
                                    const icon = has && getEntryIcon ? getEntryIcon(dayEntries[0]) : null;
                                    const isFuture = ds > getTodayStr();

                                    return (
                                        <div key={ds}
                                            className={`hob-cal-day ${has ? 'has-entry' : 'empty-day'} ${isToday(day) ? 'today' : ''} ${isFuture ? 'future-day' : ''}`}
                                            style={has ? { background: cellColor } : {}}
                                            onClick={() => !isFuture && handleDayClick(ds)}
                                            title={fmtDate(ds)}>
                                            <span className="hob-day-num" style={has ? { color: 'rgba(255,255,255,0.85)' } : {}}>{format(day, 'd')}</span>
                                            {has && (
                                                icon
                                                    ? <span className="hob-cal-icon">{icon}</span>
                                                    : <span className="hob-cal-check">✓</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Popup for multi-entry days */}
            {popup && buildPopup && (
                <DayPopup
                    date={popup.date}
                    sessions={popup.sessions}
                    activeDates={popup.activeDates}
                    onClose={(next) => {
                        if (next && byDate[next]) navigateTo(next);
                        else setPopup(null);
                    }}
                />
            )}

            {/* Inline modal for single-entry-per-day ticked days */}
            {inlineModal && (
                <div className="form-overlay" onClick={() => setInlineModal(null)}>
                    <div className="cal-detail-modal hob-day-modal" onClick={e => e.stopPropagation()}>
                        <div className="cal-detail-header">
                            <span className="cal-detail-type-badge">{fmtDate(inlineModal.date)}</span>
                            <button className="form-close-btn" onClick={() => setInlineModal(null)}><X size={14} /></button>
                        </div>
                        <div className="hob-inline-modal-body">
                            {inlineModal.entry.instrument && (
                                <div className="hob-popup-row">
                                    <span className="hob-tag" style={{ background: instruments?.find(i => (i.name||i) === inlineModal.entry.instrument)?.color || '#f59e0b', color: 'white' }}>
                                        {inlineModal.entry.instrument}
                                    </span>
                                </div>
                            )}
                            {inlineModal.entry.subject && (
                                <div className="hob-popup-row" style={{ marginBottom: 4 }}>
                                    <strong>{inlineModal.entry.subject}</strong>
                                </div>
                            )}
                            <textarea
                                placeholder="Notes (auto-saves)…"
                                value={inlineNotes}
                                onChange={e => handleNotesChange(e.target.value)}
                                rows={3}
                                autoFocus
                            />
                        </div>
                        <div className="hob-form-actions" style={{ marginTop: 8 }}>
                            <button className="hob-btn" style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                                onClick={() => {
                                    if (onTickDelete) onTickDelete(inlineModal.entry.id);
                                    setInlineModal(null);
                                }}>
                                <Trash2 size={12} /> Delete entry
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ─── SHARED: DAY POPUP ────────────────────────────────────

function DayPopup({ date, sessions, activeDates, onClose, extraActions }) {
    const sorted = [...activeDates].sort();
    const idx = sorted.indexOf(date);
    const hasPrev = idx > 0;
    const hasNext = idx < sorted.length - 1;

    return (
        <div className="form-overlay" onClick={() => onClose(null)}>
            <div className="cal-detail-modal hob-day-modal" onClick={e => e.stopPropagation()}>
                <div className="cal-detail-header">
                    <div className="hob-modal-nav">
                        <button className="hob-nav-btn" disabled={!hasPrev} onClick={() => onClose(sorted[idx-1])}>
                            <ChevronLeft size={14} />
                        </button>
                        <span className="cal-detail-type-badge">{fmtDate(date)}</span>
                        <button className="hob-nav-btn" disabled={!hasNext} onClick={() => onClose(sorted[idx+1])}>
                            <ChevronRight size={14} />
                        </button>
                    </div>
                    <button className="form-close-btn" onClick={() => onClose(null)}><X size={14} /></button>
                </div>
                <div className="hob-popup-body">
                    {sessions.map((s, i) => (
                        <div key={s.id || i} className="hob-popup-item">
                            {s._render ? s._render() : (
                                <>
                                    {s.title && <div className="hob-popup-title">{s.title}</div>}
                                    {s.subject && <div className="hob-popup-row"><span className="hob-tag">{s.subject}</span></div>}
                                    {s.instrument && <div className="hob-popup-row"><span className="hob-tag">{s.instrument}</span></div>}
                                    {s.notes && <div className="hob-popup-notes">{s.notes}</div>}
                                    {s.price && <div className="hob-popup-row">Postage: <strong>{s.price}</strong></div>}
                                </>
                            )}
                            {s._actions && (
                                <div className="hob-popup-actions">
                                    <EllipsisMenu items={s._actions} />
                                </div>
                            )}
                            {i < sessions.length - 1 && <hr className="hob-popup-divider" />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── SHARED: YEAR STATS PANEL ─────────────────────────────

function YearStats({ entries, label = 'entries', extraStats }) {
    const byMonth = {};
    ALL_MONTHS.forEach(m => { byMonth[m] = 0; });
    entries.forEach(e => {
        const m = e.date?.slice(0, 7);
        if (m && byMonth[m] !== undefined) byMonth[m]++;
    });
    const yearTotal = entries.filter(e => e.date?.startsWith(String(YEAR))).length;

    return (
        <div className="hob-stats-panel">
            <div className="hob-stat-total">
                <span className="hob-stat-big">{yearTotal}</span>
                <span className="hob-stat-label">{label} this year</span>
            </div>
            {extraStats}
            <table className="hob-stats-table">
                <thead><tr><th>Month</th><th>Count</th></tr></thead>
                <tbody>
                    {ALL_MONTHS.map(m => (
                        <tr key={m} className={byMonth[m] === 0 ? 'hob-row-empty' : ''}>
                            <td>{format(parseISO(m+'-01'), 'MMM yyyy')}</td>
                            <td>{byMonth[m] || '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── TAB: READING ─────────────────────────────────────────

function ReadingTab({ books, setBooks }) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [popup, setPopup] = useState(null);
    const emptyForm = { title: '', author: '', dateStarted: '', dateFinished: '', notes: '', status: 'Reading' };
    const [form, setForm] = useState(emptyForm);
    const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!form.title.trim()) return;
        if (editing) {
            await storage.updateBook(editing.id, form);
            setBooks(b => b.map(x => x.id === editing.id ? { ...form, id: editing.id } : x));
        } else {
            const id = await storage.addBook(form);
            setBooks(b => [...b, { ...form, id }]);
        }
        setShowForm(false); setEditing(null); setForm(emptyForm);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this book?')) return;
        await storage.deleteBook(id);
        setBooks(b => b.filter(x => x.id !== id));
    };

    // For calendar: use dateStarted as the date key
    const calEntries = books
        .filter(b => b.dateStarted)
        .map(b => ({ ...b, date: b.dateStarted.slice(0,10) }));

    const activeDates = [...new Set(calEntries.map(e => e.date))].sort();

    const buildPopup = (dayEntries) => dayEntries.map(b => ({
        ...b,
        _render: () => (
            <div>
                <div className="hob-popup-title">{b.title}</div>
                {b.author && <div className="hob-popup-row" style={{fontSize:'0.72rem',color:'var(--color-text-tertiary)'}}>by {b.author}</div>}
                <div className="hob-popup-row">
                    <span className="hob-tag">{b.status || 'Reading'}</span>
                    {b.dateStarted && <span>Started: {fmtDate(b.dateStarted.slice(0,10))}</span>}
                    {b.dateFinished && <span>Finished: {fmtDate(b.dateFinished.slice(0,10))}</span>}
                </div>
                {b.notes && <div className="hob-popup-notes">{b.notes}</div>}
            </div>
        ),
        _actions: [
            { label: 'Edit', icon: <Pencil size={11} />, onClick: () => { setEditing(b); setForm({...b}); setShowForm(true); } },
            { label: 'Delete', icon: <Trash2 size={11} />, danger: true, onClick: () => handleDelete(b.id) },
        ],
    }));

    const sorted = [...books].sort((a,b) => (b.dateStarted||'').localeCompare(a.dateStarted||''));
    const reading   = sorted.filter(b => b.status === 'Reading');
    const completed = sorted.filter(b => b.status === 'Completed');
    const tbr       = sorted.filter(b => b.status === 'To Read');

    return (
        <div className="hob-tab-layout">
            <div className="hob-tab-main">
                <div className="hob-section-header">
                    <h3>Reading</h3>
                    <button className="hob-btn-primary" onClick={() => { setForm(emptyForm); setEditing(null); setShowForm(true); }}>
                        <Plus size={13} /> Add Book
                    </button>
                </div>

                {showForm && (
                    <div className="hob-form">
                        <div className="hob-form-row">
                            <label>Title <input value={form.title} onChange={e => setF('title', e.target.value)} placeholder="Book title" autoFocus /></label>
                            <label>Author <input value={form.author} onChange={e => setF('author', e.target.value)} placeholder="Author name" /></label>
                            <label>Status
                                <select value={form.status} onChange={e => setF('status', e.target.value)}>
                                    {['To Read','Reading','Completed'].map(s => <option key={s}>{s}</option>)}
                                </select>
                            </label>
                        </div>
                        <div className="hob-form-row">
                            <label>Date Started <input type="date" value={form.dateStarted} onChange={e => setF('dateStarted', e.target.value)} /></label>
                            <label>Date Finished <input type="date" value={form.dateFinished} onChange={e => setF('dateFinished', e.target.value)} /></label>
                        </div>
                        <label>Notes <textarea value={form.notes} onChange={e => setF('notes', e.target.value)} rows={2} placeholder="Notes…" /></label>
                        <div className="hob-form-actions">
                            <button className="hob-btn-primary" onClick={handleSave}>Save</button>
                            <button className="hob-btn" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button>
                        </div>
                    </div>
                )}

                <YearCalendar
                    entries={calEntries}
                    accentColor="#8b5cf6"
                    buildPopup={buildPopup}
                    getEntryIcon={(entry) => {
                        if (entry.status === 'Completed' && entry.date === entry.dateFinished?.slice(0,10))
                            return <BookCheck size={7} color="white" />;
                        return <BookOpen size={7} color="white" />;
                    }}
                />

                {[{ label: 'Currently Reading', list: reading }, { label: 'To Read', list: tbr }, { label: 'Completed', list: completed }].map(({ label, list }) =>
                    list.length > 0 && (
                        <div key={label} className="hob-book-section">
                            <div className="hob-subsection-label">{label} ({list.length})</div>
                            {list.map(b => (
                                <div key={b.id} className="hob-book-card">
                                    <div className="hob-book-main">
                                        <div className="hob-book-title">{b.title}</div>
                                        {b.author && <div className="hob-book-author">by {b.author}</div>}
                                        <div className="hob-book-dates">
                                            {b.dateStarted && <span>Started {fmtDate(b.dateStarted.slice(0,10))}</span>}
                                            {b.dateFinished && <span>· Finished {fmtDate(b.dateFinished.slice(0,10))}</span>}
                                        </div>
                                        {b.notes && <div className="hob-book-notes">{b.notes}</div>}
                                    </div>
                                    <EllipsisMenu items={[
                                        { label: 'Edit', icon: <Pencil size={12} />, onClick: () => { setEditing(b); setForm({...b}); setShowForm(true); } },
                                        { label: 'Delete', icon: <Trash2 size={12} />, danger: true, onClick: () => handleDelete(b.id) },
                                    ]} />
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
            <YearStats entries={calEntries} label="books started"
                extraStats={
                    <div className="hob-reading-stats">
                        <div className="hob-mini-stat"><span>{books.filter(b=>b.status==='Reading').length}</span> reading</div>
                        <div className="hob-mini-stat"><span>{books.filter(b=>b.status==='Completed').length}</span> completed</div>
                        <div className="hob-mini-stat"><span>{books.filter(b=>b.status==='To Read').length}</span> to read</div>
                    </div>
                }
            />
        </div>
    );
}

// ─── TAB: LETTER WRITING ──────────────────────────────────

function LetterTab({ letters, setLetters, penpals, setPenpals }) {
    const [tab, setTab] = useState('letters'); // 'letters' | 'penpals'
    const [showLetterForm, setShowLetterForm] = useState(false);
    const [showPenpalForm, setShowPenpalForm] = useState(false);
    const [editingLetter, setEditingLetter] = useState(null);
    const [editingPenpal, setEditingPenpal] = useState(null);
    const [penpalModal, setPenpalModal] = useState(null);

    const emptyLetter = { type: 'sent', to: '', from: '', subject: '', dateSent: '', dateReceived: '', price: '', notes: '', penpalId: '' };
    const emptyPenpal = { name: '', addresses: [''], phones: [''], notes: '' };
    const [letterForm, setLetterForm] = useState(emptyLetter);
    const [penpalForm, setPenpalForm] = useState(emptyPenpal);
    const setLF = (k, v) => setLetterForm(f => ({ ...f, [k]: v }));
    const setPF = (k, v) => setPenpalForm(f => ({ ...f, [k]: v }));

    const handleSaveLetter = async () => {
        if (!letterForm.subject && !letterForm.to && !letterForm.from) return;
        if (editingLetter) {
            await storage.updateLetter(editingLetter.id, letterForm);
            setLetters(l => l.map(x => x.id === editingLetter.id ? { ...letterForm, id: editingLetter.id } : x));
        } else {
            const id = await storage.addLetter(letterForm);
            setLetters(l => [...l, { ...letterForm, id }]);
        }
        setShowLetterForm(false); setEditingLetter(null); setLetterForm(emptyLetter);
    };

    const handleDeleteLetter = async (id) => {
        if (!window.confirm('Delete letter?')) return;
        await storage.deleteLetter(id);
        setLetters(l => l.filter(x => x.id !== id));
    };

    const handleSavePenpal = async () => {
        if (!penpalForm.name.trim()) return;
        const cleaned = { ...penpalForm, addresses: penpalForm.addresses.filter(Boolean), phones: penpalForm.phones.filter(Boolean) };
        if (editingPenpal) {
            await storage.updatePenpal(editingPenpal.id, cleaned);
            setPenpals(p => p.map(x => x.id === editingPenpal.id ? { ...cleaned, id: editingPenpal.id } : x));
        } else {
            const id = await storage.addPenpal(cleaned);
            setPenpals(p => [...p, { ...cleaned, id }]);
        }
        setShowPenpalForm(false); setEditingPenpal(null); setPenpalForm(emptyPenpal);
    };

    const handleDeletePenpal = async (id) => {
        if (!window.confirm('Delete penpal?')) return;
        await storage.deletePenpal(id);
        setPenpals(p => p.filter(x => x.id !== id));
        setPenpalModal(null);
    };

    // Calendar entries: use dateSent or dateReceived
    const calEntries = letters.flatMap(l => {
        const entries = [];
        if (l.dateSent)     entries.push({ ...l, date: l.dateSent.slice(0,10),     _calType: 'sent' });
        if (l.dateReceived) entries.push({ ...l, date: l.dateReceived.slice(0,10), _calType: 'received' });
        return entries;
    });

    const buildPopup = (dayEntries) => dayEntries.map(l => ({
        ...l,
        _render: () => (
            <div>
                <div className="hob-popup-row">
                    <span className={`hob-tag ${l._calType === 'sent' ? 'hob-tag-sent' : 'hob-tag-received'}`}>
                        {l._calType === 'sent' ? '✉ Sent' : '📬 Received'}
                    </span>
                    {l.subject && <strong>{l.subject}</strong>}
                </div>
                {l.to   && <div className="hob-popup-row" style={{fontSize:'0.72rem'}}>To: {l.to}</div>}
                {l.from && <div className="hob-popup-row" style={{fontSize:'0.72rem'}}>From: {l.from}</div>}
                {l.price && <div className="hob-popup-row" style={{fontSize:'0.72rem'}}>Postage: {l.price}</div>}
                {l.notes && <div className="hob-popup-notes">{l.notes}</div>}
            </div>
        ),
        _actions: [
            { label: 'Edit', icon: <Pencil size={11} />, onClick: () => { setEditingLetter(l); setLetterForm({...l}); setShowLetterForm(true); setTab('letters'); } },
            { label: 'Delete', icon: <Trash2 size={11} />, danger: true, onClick: () => handleDeleteLetter(l.id) },
        ],
    }));

    const getPenpalLetterCount = (penpalId) => ({
        sent:     letters.filter(l => l.penpalId === penpalId && l.type === 'sent').length,
        received: letters.filter(l => l.penpalId === penpalId && l.type === 'received').length,
    });

    const sentLetters     = [...letters].filter(l => l.type === 'sent').sort((a,b) => (b.dateSent||'').localeCompare(a.dateSent||''));
    const receivedLetters = [...letters].filter(l => l.type === 'received').sort((a,b) => (b.dateReceived||'').localeCompare(a.dateReceived||''));

    return (
        <div className="hob-tab-layout">
            <div className="hob-tab-main">
                <div className="hob-section-header">
                    <div className="hob-subtabs">
                        <button className={tab === 'letters' ? 'active' : ''} onClick={() => setTab('letters')}>Letters</button>
                        <button className={tab === 'penpals' ? 'active' : ''} onClick={() => setTab('penpals')}>Penpals</button>
                    </div>
                    <button className="hob-btn-primary" onClick={() => {
                        if (tab === 'letters') { setLetterForm(emptyLetter); setEditingLetter(null); setShowLetterForm(true); }
                        else { setPenpalForm(emptyPenpal); setEditingPenpal(null); setShowPenpalForm(true); }
                    }}>
                        <Plus size={13} /> {tab === 'letters' ? 'Log Letter' : 'Add Penpal'}
                    </button>
                </div>

                {tab === 'letters' && (
                    <>
                        {showLetterForm && (
                            <div className="hob-form">
                                <div className="hob-form-row">
                                    <label>Type
                                        <select value={letterForm.type} onChange={e => setLF('type', e.target.value)}>
                                            <option value="sent">Sent</option>
                                            <option value="received">Received</option>
                                        </select>
                                    </label>
                                    <label>Penpal
                                        <select value={letterForm.penpalId} onChange={e => {
                                            const p = penpals.find(x => x.id === e.target.value);
                                            setLetterForm(f => ({ ...f, penpalId: e.target.value, to: letterForm.type === 'sent' ? p?.name || '' : f.to, from: letterForm.type === 'received' ? p?.name || '' : f.from }));
                                        }}>
                                            <option value="">— select —</option>
                                            {penpals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </label>
                                    <label>To <input value={letterForm.to} onChange={e => setLF('to', e.target.value)} placeholder="Recipient" /></label>
                                    <label>From <input value={letterForm.from} onChange={e => setLF('from', e.target.value)} placeholder="Sender" /></label>
                                </div>
                                <div className="hob-form-row">
                                    <label>Subject <input value={letterForm.subject} onChange={e => setLF('subject', e.target.value)} placeholder="Letter subject" /></label>
                                    <label>Date Sent <input type="date" value={letterForm.dateSent} onChange={e => setLF('dateSent', e.target.value)} /></label>
                                    <label>Date Received <input type="date" value={letterForm.dateReceived} onChange={e => setLF('dateReceived', e.target.value)} /></label>
                                    <label>Postage <input value={letterForm.price} onChange={e => setLF('price', e.target.value)} placeholder="e.g. ₱25" style={{width:80}} /></label>
                                </div>
                                <label>Notes <textarea value={letterForm.notes} onChange={e => setLF('notes', e.target.value)} rows={2} /></label>
                                <div className="hob-form-actions">
                                    <button className="hob-btn-primary" onClick={handleSaveLetter}>Save</button>
                                    <button className="hob-btn" onClick={() => { setShowLetterForm(false); setEditingLetter(null); }}>Cancel</button>
                                </div>
                            </div>
                        )}

                        <YearCalendar
                            entries={calEntries}
                            accentColor="#ec4899"
                            buildPopup={buildPopup}
                            getEntryIcon={(entry) =>
                                entry._calType === 'sent'
                                    ? <SendHorizontal size={7} color="white" />
                                    : <Mailbox size={7} color="white" />
                            }
                        />

                        {[{ label: 'Sent', list: sentLetters }, { label: 'Received', list: receivedLetters }].map(({ label, list }) =>
                            list.length > 0 && (
                                <div key={label} className="hob-book-section">
                                    <div className="hob-subsection-label">{label} ({list.length})</div>
                                    {list.map(l => (
                                        <div key={l.id} className="hob-letter-card">
                                            <div className="hob-letter-main">
                                                {l.subject && <div className="hob-book-title">{l.subject}</div>}
                                                <div className="hob-book-dates">
                                                    {l.to   && <span>To: {l.to}</span>}
                                                    {l.from && <span>From: {l.from}</span>}
                                                    {l.dateSent     && <span>Sent: {fmtDate(l.dateSent.slice(0,10))}</span>}
                                                    {l.dateReceived && <span>Received: {fmtDate(l.dateReceived.slice(0,10))}</span>}
                                                    {l.price && <span>· {l.price}</span>}
                                                </div>
                                                {l.notes && <div className="hob-book-notes">{l.notes}</div>}
                                            </div>
                                            <EllipsisMenu items={[
                                                { label: 'Edit', icon: <Pencil size={12} />, onClick: () => { setEditingLetter(l); setLetterForm({...l}); setShowLetterForm(true); } },
                                                { label: 'Delete', icon: <Trash2 size={12} />, danger: true, onClick: () => handleDeleteLetter(l.id) },
                                            ]} />
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </>
                )}

                {tab === 'penpals' && (
                    <>
                        {showPenpalForm && (
                            <div className="hob-form">
                                <div className="hob-form-row">
                                    <label>Name <input value={penpalForm.name} onChange={e => setPF('name', e.target.value)} placeholder="Penpal name" autoFocus /></label>
                                </div>
                                <div className="hob-penpal-list-inputs">
                                    <div className="hob-subsection-label">Addresses</div>
                                    {penpalForm.addresses.map((addr, i) => (
                                        <div key={i} className="hob-input-row">
                                            <input value={addr} onChange={e => {
                                                const a = [...penpalForm.addresses]; a[i] = e.target.value; setPF('addresses', a);
                                            }} placeholder={`Address ${i+1}`} />
                                            {penpalForm.addresses.length > 1 && (
                                                <button onClick={() => setPF('addresses', penpalForm.addresses.filter((_,j) => j !== i))}><X size={11} /></button>
                                            )}
                                        </div>
                                    ))}
                                    <button className="hob-add-field-btn" onClick={() => setPF('addresses', [...penpalForm.addresses, ''])}>+ Add Address</button>
                                </div>
                                <div className="hob-penpal-list-inputs">
                                    <div className="hob-subsection-label">Phone Numbers</div>
                                    {penpalForm.phones.map((ph, i) => (
                                        <div key={i} className="hob-input-row">
                                            <input value={ph} onChange={e => {
                                                const p = [...penpalForm.phones]; p[i] = e.target.value; setPF('phones', p);
                                            }} placeholder={`Phone ${i+1}`} />
                                            {penpalForm.phones.length > 1 && (
                                                <button onClick={() => setPF('phones', penpalForm.phones.filter((_,j) => j !== i))}><X size={11} /></button>
                                            )}
                                        </div>
                                    ))}
                                    <button className="hob-add-field-btn" onClick={() => setPF('phones', [...penpalForm.phones, ''])}>+ Add Phone</button>
                                </div>
                                <label>Notes <textarea value={penpalForm.notes} onChange={e => setPF('notes', e.target.value)} rows={2} /></label>
                                <div className="hob-form-actions">
                                    <button className="hob-btn-primary" onClick={handleSavePenpal}>Save</button>
                                    <button className="hob-btn" onClick={() => { setShowPenpalForm(false); setEditingPenpal(null); }}>Cancel</button>
                                </div>
                            </div>
                        )}

                        <div className="hob-penpal-grid">
                            {penpals.length === 0 && <p className="hob-empty">No penpals yet.</p>}
                            {penpals.map(p => {
                                const counts = getPenpalLetterCount(p.id);
                                return (
                                    <div key={p.id} className="hob-penpal-card" onClick={() => setPenpalModal(p)}>
                                        <div className="hob-penpal-name">{p.name}</div>
                                        <div className="hob-penpal-counts">
                                            <span>< SendHorizontal size={12} /> {counts.sent} sent</span>
                                            <span>< Mailbox size={12} /> {counts.received} received</span>
                                        </div>
                                        {(p.addresses||[]).filter(Boolean).length > 0 && (
                                            <div className="hob-penpal-addr">{p.addresses[0]}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            <YearStats entries={calEntries} label="letters"
                extraStats={
                    <div className="hob-reading-stats">
                        <div className="hob-mini-stat"><span>{sentLetters.length}</span> sent</div>
                        <div className="hob-mini-stat"><span>{receivedLetters.length}</span> received</div>
                        <div className="hob-mini-stat"><span>{penpals.length}</span> penpals</div>
                    </div>
                }
            />

            {/* Penpal detail modal */}
            {penpalModal && (
                <div className="form-overlay" onClick={() => setPenpalModal(null)}>
                    <div className="cal-detail-modal hob-penpal-modal" onClick={e => e.stopPropagation()}>
                        <div className="cal-detail-header">
                            <span className="cal-detail-type-badge">{penpalModal.name}</span>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <EllipsisMenu items={[
                                    { label: 'Edit', icon: <Pencil size={12} />, onClick: () => { setEditingPenpal(penpalModal); setPenpalForm({...penpalModal, addresses: penpalModal.addresses||[''], phones: penpalModal.phones||['']}); setShowPenpalForm(true); setPenpalModal(null); setTab('penpals'); } },
                                    { label: 'Delete', icon: <Trash2 size={12} />, danger: true, onClick: () => handleDeletePenpal(penpalModal.id) },
                                ]} />
                                <button className="form-close-btn" onClick={() => setPenpalModal(null)}><X size={14} /></button>
                            </div>
                        </div>
                        <div className="hob-penpal-modal-body">
                            {(() => {
                                const counts = getPenpalLetterCount(penpalModal.id);
                                const penpalLetters = letters.filter(l => l.penpalId === penpalModal.id).sort((a,b) => (b.dateSent||b.dateReceived||'').localeCompare(a.dateSent||a.dateReceived||''));
                                return (
                                    <>
                                        <div className="hob-reading-stats" style={{marginBottom: 8}}>
                                            <div className="hob-mini-stat"><span>{counts.sent}</span> sent</div>
                                            <div className="hob-mini-stat"><span>{counts.received}</span> received</div>
                                        </div>
                                        {(penpalModal.addresses||[]).filter(Boolean).length > 0 && (
                                            <div className="hob-penpal-section">
                                                <div className="hob-subsection-label">Addresses</div>
                                                {penpalModal.addresses.filter(Boolean).map((a,i) => <div key={i} className="hob-penpal-detail-row">{a}</div>)}
                                            </div>
                                        )}
                                        {(penpalModal.phones||[]).filter(Boolean).length > 0 && (
                                            <div className="hob-penpal-section">
                                                <div className="hob-subsection-label">Phone Numbers</div>
                                                {penpalModal.phones.filter(Boolean).map((p,i) => <div key={i} className="hob-penpal-detail-row">{p}</div>)}
                                            </div>
                                        )}
                                        {penpalModal.notes && <div className="hob-popup-notes">{penpalModal.notes}</div>}
                                        {penpalLetters.length > 0 && (
                                            <div className="hob-penpal-section">
                                                <div className="hob-subsection-label">Letter History</div>
                                                {penpalLetters.map(l => (
                                                    <div key={l.id} className="hob-letter-history-row">
                                                        <span className={`hob-tag ${l.type === 'sent' ? 'hob-tag-sent' : 'hob-tag-received'}`}>{l.type}</span>
                                                        <span>{l.subject || '(no subject)'}</span>
                                                        <span style={{color:'var(--color-text-tertiary)',fontSize:'0.65rem'}}>{fmtDate((l.dateSent||l.dateReceived||'').slice(0,10))}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── TAB: SIMPLE TICKER (Journalling, Drawing) ────────────

function SimpleTickerTab({ entries, setEntries, storageAdd, storageUpdate, storageDelete, label, accentColor, extraFormFields, buildExtraPopup }) {
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const emptyForm = { date: getTodayStr(), notes: '' };
    const [form, setForm] = useState(emptyForm);
    const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!form.date) return;
        if (editing) {
            await storageUpdate(editing.id, form);
            setEntries(e => e.map(x => x.id === editing.id ? { ...form, id: editing.id } : x));
        } else {
            const id = await storageAdd(form);
            setEntries(e => [...e, { ...form, id }]);
        }
        setShowForm(false); setEditing(null); setForm(emptyForm);
    };

    const handleDelete = async (id) => {
        if (!window.confirm(`Delete this ${label} entry?`)) return;
        await storageDelete(id);
        setEntries(e => e.filter(x => x.id !== id));
    };

    const buildPopup = (dayEntries) => dayEntries.map(e => ({
        ...e,
        _render: () => (
            <div>
                <div className="hob-popup-row"><span className="hob-tag">{label}</span></div>
                {buildExtraPopup && buildExtraPopup(e)}
                {e.notes && <div className="hob-popup-notes">{e.notes}</div>}
            </div>
        ),
        _actions: [
            { label: 'Edit', icon: <Pencil size={11} />, onClick: () => { setEditing(e); setForm({...e}); setShowForm(true); } },
            { label: 'Delete', icon: <Trash2 size={11} />, danger: true, onClick: () => handleDelete(e.id) },
        ],
    }));

    const yearTotal  = entries.filter(e => e.date?.startsWith(String(YEAR))).length;
    const monthKey   = format(new Date(), 'yyyy-MM');
    const monthTotal = entries.filter(e => e.date?.startsWith(monthKey)).length;

    return (
        <div className="hob-tab-layout">
            <div className="hob-tab-main">
                <div className="hob-section-header">
                    <h3>{label}</h3>
                    {/* <button className="hob-btn-primary" onClick={() => { setForm(emptyForm); setEditing(null); setShowForm(true); }}>
                        <Plus size={13} /> Log Entry
                    </button> */}
                </div>

                {showForm && (
                    <div className="hob-form">
                        <div className="hob-form-row">
                            <label>Date <input type="date" value={form.date} onChange={e => setF('date', e.target.value)} autoFocus /></label>
                            {extraFormFields && extraFormFields(form, setF)}
                        </div>
                        <label>Notes <textarea value={form.notes} onChange={e => setF('notes', e.target.value)} rows={2} placeholder="Notes (optional)" /></label>
                        <div className="hob-form-actions">
                            <button className="hob-btn-primary" onClick={handleSave}>Save</button>
                            <button className="hob-btn" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button>
                        </div>
                    </div>
                )}

                <YearCalendar
                    entries={entries}
                    accentColor={accentColor}
                    buildPopup={buildPopup}
                    singleEntryPerDay
                    onDayClick={async (ds) => {
                        // Only log if no entry exists for that day
                        const exists = entries.find(e => e.date === ds);
                        if (exists) return;
                        const newEntry = { date: ds, notes: '' };
                        const id = await storageAdd(newEntry);
                        setEntries(e => [...e, { ...newEntry, id }]);
                    }}
                    onTickDelete={async (id) => {
                        await storageDelete(id);
                        setEntries(e => e.filter(x => x.id !== id));
                    }}
                    onTickNotesChange={async (id, notes) => {
                        await storageUpdate(id, { notes });
                        setEntries(e => e.map(x => x.id === id ? { ...x, notes } : x));
                    }}
                />
            </div>
            <YearStats entries={entries} label="entries"
                extraStats={
                    <div className="hob-reading-stats">
                        <div className="hob-mini-stat"><span>{monthTotal}</span> this month</div>
                        <div className="hob-mini-stat"><span>{yearTotal}</span> this year</div>
                    </div>
                }
            />
        </div>
    );
}

// ─── TAB: MUSIC ───────────────────────────────────────────

function MusicTab({ entries, setEntries }) {
    const [instruments, setInstruments] = useState([
        { name: 'Piano', color: '#303030' },
        { name: 'Guitar', color: '#915519' },
    ]);
    const [showInstrumentForm, setShowInstrumentForm] = useState(false);
    const [newInstrument, setNewInstrument] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const emptyForm = { date: getTodayStr(), instrument: 'Piano', notes: '' };
    const [form, setForm] = useState(emptyForm);
    const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const [instrPopover, setInstrPopover] = useState(null); // { date }
    const [newInstrColor, setNewInstrColor] = useState('#f59e0b');

    useEffect(() => { storage.getMusicInstruments().then(setInstruments); }, []);

    const handleAddInstrument = async () => {
        if (!newInstrument.trim()) return;
        if (instruments.find(i => i.name === newInstrument.trim())) return;
        const updated = [...instruments, { name: newInstrument.trim(), color: newInstrColor }];
        setInstruments(updated);
        await storage.saveMusicInstruments(updated);
        setNewInstrument(''); setNewInstrColor('#f59e0b'); setShowInstrumentForm(false);
    };

    const handleSave = async () => {
        if (!form.date) return;
        if (editing) {
            await storage.updateMusicEntry(editing.id, form);
            setEntries(e => e.map(x => x.id === editing.id ? { ...form, id: editing.id } : x));
        } else {
            const id = await storage.addMusicEntry(form);
            setEntries(e => [...e, { ...form, id }]);
        }
        setShowForm(false); setEditing(null); setForm(emptyForm);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete entry?')) return;
        await storage.deleteMusicEntry(id);
        setEntries(e => e.filter(x => x.id !== id));
    };

    // Per-instrument stats
    const instrStats = instruments.map(instr => {
        const name = instr.name || instr;
        const instEntries = entries.filter(e => e.instrument === name);
        const monthKey = format(new Date(), 'yyyy-MM');
        return {
            name,
            color: instr.color || '#f59e0b',
            month: instEntries.filter(e => e.date?.startsWith(monthKey)).length,
            year:  instEntries.filter(e => e.date?.startsWith(String(YEAR))).length,
        };
    });

    const buildPopup = (dayEntries) => dayEntries.map(e => ({
        ...e,
        _render: () => (
            <div>
                <div className="hob-popup-row"><span className="hob-tag">{e.instrument}</span></div>
                {e.notes && <div className="hob-popup-notes">{e.notes}</div>}
            </div>
        ),
        _actions: [
            { label: 'Edit', icon: <Pencil size={11} />, onClick: () => { setEditing(e); setForm({...e}); setShowForm(true); } },
            { label: 'Delete', icon: <Trash2 size={11} />, danger: true, onClick: () => handleDelete(e.id) },
        ],
    }));

    return (
        <div className="hob-tab-layout">
            <div className="hob-tab-main">
                <div className="hob-section-header">
                    <h3>Music</h3>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button className="hob-btn" onClick={() => setShowInstrumentForm(v => !v)}>+ Instrument</button>
                        <button className="hob-btn-primary" onClick={() => { setForm(emptyForm); setEditing(null); setShowForm(true); }}>
                            <Plus size={13} /> Log Session
                        </button>
                    </div>
                </div>

                {showInstrumentForm && (
                    <div className="hob-form" style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <label style={{ flex: 1 }}>New Instrument
                            <input value={newInstrument} onChange={e => setNewInstrument(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddInstrument()}
                                placeholder="e.g. Violin" autoFocus />
                        </label>
                        <label>Color
                            <input type="color" value={newInstrColor}
                                onChange={e => setNewInstrColor(e.target.value)}
                                style={{ width: 40, height: 32, padding: 2, cursor: 'pointer' }} />
                        </label>
                        <button className="hob-btn-primary" onClick={handleAddInstrument}>Add</button>
                        <button className="hob-btn" onClick={() => setShowInstrumentForm(false)}>Cancel</button>
                    </div>
                )}

                {showForm && (
                    <div className="hob-form">
                        <div className="hob-form-row">
                            <label>Date <input type="date" value={form.date} onChange={e => setF('date', e.target.value)} /></label>
                            <label>Instrument
                                <select value={form.instrument} onChange={e => setF('instrument', e.target.value)}>
                                    {instruments.map(i => <option key={i.name || i} value={i.name || i}>{i.name || i}</option>)}
                                </select>
                            </label>
                        </div>
                        <label>Notes <textarea value={form.notes} onChange={e => setF('notes', e.target.value)} rows={2} /></label>
                        <div className="hob-form-actions">
                            <button className="hob-btn-primary" onClick={handleSave}>Save</button>
                            <button className="hob-btn" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button>
                        </div>
                    </div>
                )}

                <YearCalendar
                    entries={entries}
                    accentColor="#f59e0b"
                    buildPopup={buildPopup}
                    instruments={instruments}
                    getEntryColor={(dayEntries) => {
                        // Use the color of the first instrument logged that day
                        const instr = instruments.find(i => i.name === dayEntries[0]?.instrument);
                        return instr?.color || '#f59e0b';
                    }}
                    onDayClick={(ds) => setInstrPopover({ date: ds })}
                />

                {instrPopover && (
                    <div className="form-overlay" onClick={() => setInstrPopover(null)}>
                        <div className="hob-instr-popover" onClick={e => e.stopPropagation()}>
                            <div className="hob-instr-popover-title">Pick instrument — {fmtDate(instrPopover.date)}</div>
                            {instruments.map(instr => (
                                <button key={instr.name || instr}
                                    className="hob-instr-popover-btn"
                                    style={{ borderLeftColor: instr.color || '#f59e0b' }}
                                    onClick={async () => {
                                        const instrName = instr.name || instr;
                                        const newEntry = { date: instrPopover.date, instrument: instrName, notes: '' };
                                        const id = await storage.addMusicEntry(newEntry);
                                        setEntries(e => [...e, { ...newEntry, id }]);
                                        setInstrPopover(null);
                                    }}>
                                    {instr.name || instr}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="hob-stats-panel">
                <div className="hob-stat-total">
                    <span className="hob-stat-big">{entries.filter(e => e.date?.startsWith(String(YEAR))).length}</span>
                    <span className="hob-stat-label">sessions this year</span>
                </div>
                <div className="hob-subsection-label" style={{ marginTop: 8 }}>By Instrument</div>
                {instrStats.map(s => (
                    <div key={s.name} className="hob-instr-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0, display: 'inline-block' }} />
                            <span className="hob-instr-name">{s.name}</span>
                        </div>
                        <div className="hob-instr-stats">
                            <span>{s.month} mo</span>
                            <span>{s.year} yr</span>
                        </div>
                    </div>
                ))}
                <table className="hob-stats-table" style={{ marginTop: 8 }}>
                    <thead><tr><th>Month</th><th>Count</th></tr></thead>
                    <tbody>
                        {ALL_MONTHS.map(m => {
                            const c = entries.filter(e => e.date?.startsWith(m)).length;
                            return (
                                <tr key={m} className={c === 0 ? 'hob-row-empty' : ''}>
                                    <td>{format(parseISO(m+'-01'), 'MMM yyyy')}</td>
                                    <td>{c || '—'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── TAB: CODING ──────────────────────────────────────────

function CodingTab({ projects, setProjects, logs, setLogs }) {
    const [showProjectForm, setShowProjectForm] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);
    // const [showLogForm, setShowLogForm] = useState(false);
    // const [logForm, setLogForm] = useState({ date: getTodayStr(), notes: '' });

    const emptyProject = { name: '', status: 'Not Started', dateStarted: '', dateEnded: '', notes: '' };
    const [projectForm, setProjectForm] = useState(emptyProject);
    const setPF = (k, v) => setProjectForm(f => ({ ...f, [k]: v }));

    const handleSaveProject = async () => {
        if (!projectForm.name.trim()) return;
        if (editingProject) {
            await storage.updateCodingProject(editingProject.id, projectForm);
            setProjects(p => p.map(x => x.id === editingProject.id ? { ...projectForm, id: editingProject.id } : x));
        } else {
            const id = await storage.addCodingProject(projectForm);
            setProjects(p => [...p, { ...projectForm, id }]);
        }
        setShowProjectForm(false); setEditingProject(null); setProjectForm(emptyProject);
    };

    const handleDeleteProject = async (id) => {
        if (!window.confirm('Delete project and all its logs?')) return;
        await storage.deleteCodingProject(id);
        setProjects(p => p.filter(x => x.id !== id));
        const toDelete = logs.filter(l => l.projectId === id);
        await Promise.all(toDelete.map(l => storage.deleteCodingLog(l.id)));
        setLogs(l => l.filter(x => x.projectId !== id));
        if (selectedProject?.id === id) setSelectedProject(null);
    };

    // const handleLogSave = async () => {
    //     if (!logForm.date || !selectedProject) return;
    //     const log = { projectId: selectedProject.id, date: logForm.date, notes: logForm.notes };
    //     const id = await storage.addCodingLog(log);
    //     setLogs(l => [...l, { ...log, id }]);
    //     setShowLogForm(false); setLogForm({ date: getTodayStr(), notes: '' });
    // };

    const handleDeleteLog = async (id) => {
        if (!window.confirm('Delete this log?')) return;
        await storage.deleteCodingLog(id);
        setLogs(l => l.filter(x => x.id !== id));
    };

    const proj = selectedProject
        ? projects.find(p => p.id === selectedProject.id) || selectedProject
        : null;

    const projLogs = proj
        ? logs.filter(l => l.projectId === proj.id)
        : [];

    // const buildPopup = (dayEntries) => dayEntries.map(l => ({
    //     ...l,
    //     _render: () => (
    //         <div>
    //             <div className="hob-popup-row">
    //                 <span className="hob-tag">{proj?.name}</span>
    //             </div>
    //             {l.notes && <div className="hob-popup-notes">{l.notes}</div>}
    //         </div>
    //     ),
    //     _actions: [
    //         { label: 'Delete', icon: <Trash2 size={11} />, danger: true, onClick: () => handleDeleteLog(l.id) },
    //     ],
    // }));

    const allLogs = logs;
    // const allLogEntries = allLogs.map(l => ({ ...l }));

    return (
        <div className="hob-coding-layout">
            {/* Left: project list */}
            <div className="hob-coding-sidebar">
                <div className="hob-coding-sidebar-header">
                    <span>Projects</span>
                    <button className="hob-btn-primary hob-btn-xs"
                        onClick={() => { setProjectForm(emptyProject); setEditingProject(null); setShowProjectForm(true); }}>
                        <Plus size={11} />
                    </button>
                </div>

                {showProjectForm && (
                    <div className="hob-form" style={{ margin: '8px 0' }}>
                        <label>Name <input value={projectForm.name} onChange={e => setPF('name', e.target.value)} placeholder="Project name" autoFocus /></label>
                        <div className="hob-form-row">
                            <label>Status
                                <select value={projectForm.status} onChange={e => setPF('status', e.target.value)}>
                                    {CODING_STATUSES.map(s => <option key={s}>{s}</option>)}
                                </select>
                            </label>
                            <label>Start <input type="date" value={projectForm.dateStarted} onChange={e => setPF('dateStarted', e.target.value)} /></label>
                            <label>End <input type="date" value={projectForm.dateEnded} onChange={e => setPF('dateEnded', e.target.value)} /></label>
                        </div>
                        <label>Notes <textarea value={projectForm.notes} onChange={e => setPF('notes', e.target.value)} rows={2} /></label>
                        <div className="hob-form-actions">
                            <button className="hob-btn-primary" onClick={handleSaveProject}>Save</button>
                            <button className="hob-btn" onClick={() => { setShowProjectForm(false); setEditingProject(null); }}>Cancel</button>
                        </div>
                    </div>
                )}

                {projects.length === 0 && !showProjectForm && <p className="hob-empty" style={{ fontSize: '0.65rem' }}>No projects yet.</p>}

                {projects.map(p => (
                    <div key={p.id}
                        className={`hob-project-card ${selectedProject?.id === p.id ? 'active' : ''}`}
                        onClick={() => setSelectedProject(p)}>
                        <div className="hob-project-card-main">
                            <span className="hob-project-name">{p.name}</span>
                            <span className="hob-status-dot" style={{ background: STATUS_COLORS[p.status] }} title={p.status} />
                        </div>
                        <div className="hob-project-meta">
                            <span style={{ fontSize: '0.6rem', color: 'var(--color-text-tertiary)' }}>{p.status}</span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--color-text-tertiary)' }}>
                                {logs.filter(l => l.projectId === p.id).length} days logged
                            </span>
                        </div>
                        <EllipsisMenu items={[
                            { label: 'Edit', icon: <Pencil size={12} />, onClick: () => { setProjectForm({...p}); setEditingProject(p); setShowProjectForm(true); } },
                            { label: 'Delete', icon: <Trash2 size={12} />, danger: true, onClick: () => handleDeleteProject(p.id) },
                        ]} />
                    </div>
                ))}
            </div>

            {/* Right: selected project detail */}
            <div className="hob-coding-main">
                {!proj && (
                    <p className="hob-empty" style={{ paddingTop: 24 }}>Select a project to view its calendar and logs.</p>
                )}
                {proj && (
                    <>
                        <div className="hob-section-header">
                            <div>
                                <h3 style={{ margin: 0 }}>{proj.name}</h3>
                                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                    <span className="hob-tag" style={{ background: STATUS_COLORS[proj.status], color: 'white' }}>{proj.status}</span>
                                    {proj.dateStarted && <span className="hob-tag">Started {fmtDate(proj.dateStarted.slice(0,10))}</span>}
                                    {proj.dateEnded   && <span className="hob-tag">Ended {fmtDate(proj.dateEnded.slice(0,10))}</span>}
                                </div>
                            </div>
                        </div>

                        {/* {showLogForm && (
                            <div className="hob-form">
                                <div className="hob-form-row">
                                    <label>Date <input type="date" value={logForm.date} onChange={e => setLogForm(f => ({ ...f, date: e.target.value }))} /></label>
                                </div>
                                <label>Notes <textarea value={logForm.notes} onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="What did you work on?" /></label>
                                <div className="hob-form-actions">
                                    <button className="hob-btn-primary" onClick={handleLogSave}>Save</button>
                                    <button className="hob-btn" onClick={() => setShowLogForm(false)}>Cancel</button>
                                </div>
                            </div>
                        )} */}

                        {proj.notes && <div className="hob-book-notes" style={{ marginBottom: 8 }}>{proj.notes}</div>}

                        <YearCalendar
                            entries={projLogs}
                            accentColor="#6366f1"
                            singleEntryPerDay
                            onDayClick={async (ds) => {
                                const exists = projLogs.find(l => l.date === ds);
                                if (exists) return;
                                const log = { projectId: proj.id, date: ds, notes: '' };
                                const id = await storage.addCodingLog(log);
                                setLogs(l => [...l, { ...log, id }]);
                            }}
                            onTickDelete={async (id) => {
                                await storage.deleteCodingLog(id);
                                setLogs(l => l.filter(x => x.id !== id));
                            }}
                            onTickNotesChange={async (id, notes) => {
                                await storage.updateCodingLog(id, { notes });
                                setLogs(l => l.map(x => x.id === id ? { ...x, notes } : x));
                            }}
                        />

                        <div className="hob-coding-log-stats">
                            <span><strong>{projLogs.length}</strong> days logged</span>
                            <span><strong>{projLogs.filter(l => l.date?.startsWith(format(new Date(), 'yyyy-MM'))).length}</strong> this month</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── MAIN ─────────────────────────────────────────────────

const TABS = [
    { key: 'reading',  label: 'Reading',      icon: <BookOpen size={13} /> },
    { key: 'letters',  label: 'Letters',       icon: <Mail size={13} /> },
    { key: 'journal',  label: 'Journal',       icon: <NotebookPen size={13} /> },
    { key: 'drawing',  label: 'Drawing',       icon: <Palette size={13} /> },
    { key: 'music',    label: 'Music',         icon: <Music2 size={13} /> },
    { key: 'coding',   label: 'Coding',        icon: <Code2 size={13} /> },
];

function Hobbies() {
    const [tab, setTab]                   = useState('reading');
    const [books, setBooks]               = useState([]);
    const [letters, setLetters]           = useState([]);
    const [penpals, setPenpals]           = useState([]);
    const [journalEntries, setJournal]    = useState([]);
    const [drawingEntries, setDrawing]    = useState([]);
    const [musicEntries, setMusic]        = useState([]);
    const [codingProjects, setProjects]   = useState([]);
    const [codingLogs, setCodingLogs]     = useState([]);
    const [loading, setLoading]           = useState(true);

    useEffect(() => {
        Promise.all([
            storage.getBooks(),
            storage.getLetters(),
            storage.getPenpals(),
            storage.getJournalEntries(),
            storage.getDrawingEntries(),
            storage.getMusicEntries(),
            storage.getCodingProjects(),
            storage.getCodingLogs(),
        ]).then(([bk, lt, pp, jr, dr, mu, cp, cl]) => {
            setBooks(bk); setLetters(lt); setPenpals(pp);
            setJournal(jr); setDrawing(dr); setMusic(mu);
            setProjects(cp); setCodingLogs(cl);
            setLoading(false);
        });
    }, []);

    if (loading) return <div className="hob-loading">Loading…</div>;

    return (
        <div className="hobbies-view module-hobbies">
            <div className="hob-header">
                <h1>Hobbies</h1>
                <div className="hob-tabs">
                    {TABS.map(t => (
                        <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === 'reading' && <ReadingTab books={books} setBooks={setBooks} />}
            {tab === 'letters' && <LetterTab letters={letters} setLetters={setLetters} penpals={penpals} setPenpals={setPenpals} />}
            {tab === 'journal' && (
                <SimpleTickerTab
                    entries={journalEntries} setEntries={setJournal}
                    storageAdd={storage.addJournalEntry} storageUpdate={storage.updateJournalEntry} storageDelete={storage.deleteJournalEntry}
                    label="Journal" accentColor="#14b8a6"
                />
            )}
            {tab === 'drawing' && (
                <SimpleTickerTab
                    entries={drawingEntries} setEntries={setDrawing}
                    storageAdd={storage.addDrawingEntry} storageUpdate={storage.updateDrawingEntry} storageDelete={storage.deleteDrawingEntry}
                    label="Drawing" accentColor="#f97316"
                    extraFormFields={(form, setF) => (
                        <label>Subject <input value={form.subject||''} onChange={e => setF('subject', e.target.value)} placeholder="What did you draw?" /></label>
                    )}
                    buildExtraPopup={(e) => e.subject && <div className="hob-popup-row"><strong>{e.subject}</strong></div>}
                />
            )}
            {tab === 'music'   && <MusicTab entries={musicEntries} setEntries={setMusic} />}
            {tab === 'coding'  && <CodingTab projects={codingProjects} setProjects={setProjects} logs={codingLogs} setLogs={setCodingLogs} />}
        </div>
    );
}

export default Hobbies;