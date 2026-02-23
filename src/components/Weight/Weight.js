import React, { useState, useEffect } from 'react';
import { storage } from '../../utils/storage';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ReferenceLine, ResponsiveContainer
} from 'recharts';
import './Weight.css';

function Weight() {
    const [view, setView] = useState('goals'); // 'goals' | 'detail' | 'overview'
    const [goals, setGoals] = useState([]);
    const [selectedGoal, setSelectedGoal] = useState(null);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState('');
    const [showNewGoalForm, setShowNewGoalForm] = useState(false);
    const [newGoal, setNewGoal] = useState({ title: '', startWeight: '', targetWeight: '', startDate: '', deadline: '' });
    const [todayWeight, setTodayWeight] = useState('');
    const [overview2026, setOverview2026] = useState([]);

    // Load goals on mount
    useEffect(() => {
        const load = async () => {
            const data = await storage.getWeightGoals();
            setGoals(data);
            setLoading(false);
        };
        load();
    }, []);

    // Load entries when a goal is selected
    useEffect(() => {
        if (!selectedGoal) return;
        const load = async () => {
            const data = await storage.getWeightEntries(selectedGoal.id);
            setEntries(data);
        };
        load();
    }, [selectedGoal]);

    // Load 2026 overview
    useEffect(() => {
        if (view !== 'overview') return;
        const load = async () => {
            const data = await storage.getAllWeightEntries2026();
            setOverview2026(data);
        };
        load();
    }, [view]);

    // ─── GOAL CRUD ─────────────────────────────────────────
    const handleCreateGoal = async () => {
        if (!newGoal.title || !newGoal.startWeight || !newGoal.targetWeight || !newGoal.startDate || !newGoal.deadline) {
            alert('Please fill in all fields');
            return;
        }
        const id = await storage.addWeightGoal({
            ...newGoal,
            startWeight: parseFloat(newGoal.startWeight),
            targetWeight: parseFloat(newGoal.targetWeight),
        });
        const created = { id, ...newGoal, startWeight: parseFloat(newGoal.startWeight), targetWeight: parseFloat(newGoal.targetWeight) };
        setGoals([...goals, created]);
        setNewGoal({ title: '', startWeight: '', targetWeight: '', startDate: '', deadline: '' });
        setShowNewGoalForm(false);
    };

    const handleDeleteGoal = async (id) => {
        if (!window.confirm('Delete this goal and all its data?')) return;
        await storage.deleteWeightGoal(id);
        setGoals(goals.filter(g => g.id !== id));
        if (selectedGoal?.id === id) { setSelectedGoal(null); setView('goals'); }
    };

    const handleUpdateTitle = async () => {
        await storage.updateWeightGoal(selectedGoal.id, { title: titleInput });
        const updated = { ...selectedGoal, title: titleInput };
        setSelectedGoal(updated);
        setGoals(goals.map(g => g.id === selectedGoal.id ? updated : g));
        setEditingTitle(false);
    };

    // ─── ENTRY CRUD ────────────────────────────────────────
    const handleLogWeight = async () => {
        if (!todayWeight) return;
        const today = new Date().toISOString().split('T')[0];
        const existing = entries.find(e => e.date === today);
        if (existing) {
            await storage.updateWeightEntry(selectedGoal.id, existing.id, { weight: parseFloat(todayWeight) });
        } else {
            await storage.addWeightEntry(selectedGoal.id, { date: today, weight: parseFloat(todayWeight) });
        }
        const updated = await storage.getWeightEntries(selectedGoal.id);
        setEntries(updated);
        setTodayWeight('');
    };

    const handleDeleteEntry = async (entryId) => {
        await storage.deleteWeightEntry(selectedGoal.id, entryId);
        setEntries(entries.filter(e => e.id !== entryId));
    };

    // ─── CHART DATA ────────────────────────────────────────
    const buildChartData = () => {
        if (!selectedGoal || entries.length === 0) return [];

        // Build planned pace line
        const start = new Date(selectedGoal.startDate);
        const end = new Date(selectedGoal.deadline);
        const totalDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
        const weightDiff = selectedGoal.targetWeight - selectedGoal.startWeight;

        return entries.map(entry => {
            const entryDate = new Date(entry.date);
            const dayNum = Math.round((entryDate - start) / (1000 * 60 * 60 * 24));
            const planned = selectedGoal.startWeight + (weightDiff / totalDays) * dayNum;
            return {
                date: entry.date.slice(5), // show MM-DD
                weight: entry.weight,
                planned: parseFloat(planned.toFixed(2)),
            };
        });
    };

    // Build week reference lines
    const buildWeekLines = () => {
        if (!selectedGoal || entries.length === 0) return [];
        const start = new Date(selectedGoal.startDate);
        const lines = [];
        for (let w = 1; w <= 12; w++) {
            const weekDate = new Date(start);
            weekDate.setDate(start.getDate() + w * 7);
            const label = `${String(weekDate.getMonth() + 1).padStart(2, '0')}-${String(weekDate.getDate()).padStart(2, '0')}`;
            lines.push(label);
        }
        return lines;
    };

    // ─── PROGRESS TABLE ────────────────────────────────────
    const buildTableData = () => {
        return entries.map((entry, i) => {
            const prev = entries[i - 1];
            const daily = prev ? parseFloat((entry.weight - prev.weight).toFixed(2)) : null;

            // Weekly progress — find start of this week
            const entryDate = new Date(entry.date);
            const dayOfWeek = entryDate.getDay(); // 0=Sun
            const weekStart = new Date(entryDate);
            weekStart.setDate(entryDate.getDate() - dayOfWeek); // go back to Sunday
            const weekStartEntry = entries.find(e => e.date === weekStart.toISOString().split('T')[0]);
            const weekly = weekStartEntry ? parseFloat((entry.weight - weekStartEntry.weight).toFixed(2)) : null;

            return { ...entry, daily, weekly };
        }).reverse(); // newest first
    };

    const colorClass = (val) => {
        if (val === null) return '';
        if (val < 0) return 'progress-good';
        if (val > 0) return 'progress-bad';
        return '';
    };

    // ─── RENDER ────────────────────────────────────────────
    if (loading) return <div className="weight-view"><p>Loading...</p></div>;

    // Goals list view
    if (view === 'goals') return (
        <div className="weight-view">
            <div className="weight-header">
                <h1>Weight Tracker</h1>
                <div>
                    <button onClick={() => setView('overview')}>2026 Overview</button>
                    <button onClick={() => setShowNewGoalForm(true)}>+ New Goal</button>
                </div>
            </div>

            {goals.length === 0 && !showNewGoalForm && <p>No goals yet. Create one!</p>}

            {goals.map(goal => {
                const left = (goal.targetWeight - goal.startWeight);
                return (
                    <div key={goal.id} className="goal-card" onClick={() => { setSelectedGoal(goal); setView('detail'); }}>
                        <div className="goal-card-row">
                            <strong>{goal.title}</strong>
                            <button onClick={e => { e.stopPropagation(); handleDeleteGoal(goal.id); }}>Delete</button>
                        </div>
                        <p>{goal.startWeight}kg → {goal.targetWeight}kg · Deadline: {goal.deadline}</p>
                    </div>
                );
            })}

            {showNewGoalForm && (
                <div className="new-goal-form">
                    <h3>New Goal</h3>
                    <input placeholder="Title" value={newGoal.title} onChange={e => setNewGoal({ ...newGoal, title: e.target.value })} />
                    <input type="number" placeholder="Start weight (kg)" value={newGoal.startWeight} onChange={e => setNewGoal({ ...newGoal, startWeight: e.target.value })} />
                    <input type="number" placeholder="Target weight (kg)" value={newGoal.targetWeight} onChange={e => setNewGoal({ ...newGoal, targetWeight: e.target.value })} />
                    <input type="date" placeholder="Start date" value={newGoal.startDate} onChange={e => setNewGoal({ ...newGoal, startDate: e.target.value })} />
                    <input type="date" placeholder="Deadline" value={newGoal.deadline} onChange={e => setNewGoal({ ...newGoal, deadline: e.target.value })} />
                    <div>
                        <button onClick={handleCreateGoal}>Create</button>
                        <button onClick={() => setShowNewGoalForm(false)}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );

    // 2026 overview
    if (view === 'overview') return (
        <div className="weight-view">
            <div className="weight-header">
                <button onClick={() => setView('goals')}>← Back</button>
                <h1>2026 Overview</h1>
            </div>
            {overview2026.length === 0 ? <p>No data yet.</p> : (
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={overview2026.map(e => ({ date: e.date.slice(5), weight: e.weight }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={['auto', 'auto']} />
                        <Tooltip />
                        <Line type="monotone" dataKey="weight" dot={false} strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );

    // Goal detail view
    const chartData = buildChartData();
    const weekLines = buildWeekLines();
    const tableData = buildTableData();
    const latestWeight = entries.length > 0 ? entries[entries.length - 1].weight : null;
    const leftToGoal = latestWeight ? parseFloat((latestWeight - selectedGoal.targetWeight).toFixed(2)) : null;

    return (
        <div className="weight-view">
            <div className="weight-header">
                <button onClick={() => setView('goals')}>← Back</button>

                {editingTitle ? (
                    <div>
                        <input value={titleInput} onChange={e => setTitleInput(e.target.value)} />
                        <button onClick={handleUpdateTitle}>Save</button>
                        <button onClick={() => setEditingTitle(false)}>Cancel</button>
                    </div>
                ) : (
                    <h1 onClick={() => { setTitleInput(selectedGoal.title); setEditingTitle(true); }}>
                        {selectedGoal.title} ✎
                    </h1>
                )}
            </div>

            {/* Quick stats */}
            <div className="weight-stats-row">
                <div><p>Start</p><strong>{selectedGoal.startWeight}kg</strong></div>
                <div><p>Current</p><strong>{latestWeight ?? '—'}kg</strong></div>
                <div><p>Goal</p><strong>{selectedGoal.targetWeight}kg</strong></div>
                <div><p>Left</p><strong style={{ color: leftToGoal <= 0 ? 'green' : 'inherit' }}>{leftToGoal ?? '—'}kg</strong></div>
                <div><p>Deadline</p><strong>{selectedGoal.deadline}</strong></div>
            </div>

            {/* Log weight */}
            <div className="weight-log-row">
                <input
                    type="number"
                    step="0.1"
                    placeholder="Today's weight (kg)"
                    value={todayWeight}
                    onChange={e => setTodayWeight(e.target.value)}
                />
                <button onClick={handleLogWeight}>Log</button>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={['auto', 'auto']} />
                        <Tooltip />
                        {/* Goal line */}
                        <ReferenceLine y={selectedGoal.targetWeight} stroke="green" strokeDasharray="4 4" label={{ value: `Goal ${selectedGoal.targetWeight}kg`, fill: 'green', fontSize: 11 }} />
                        {/* Safe zone line — 1kg above goal */}
                        <ReferenceLine y={selectedGoal.targetWeight + 1} stroke="blue" strokeDasharray="4 4" label={{ value: `${selectedGoal.targetWeight + 1}kg`, fill: 'blue', fontSize: 11 }} />
                        {/* Week dividers */}
                        {weekLines.map(w => (
                            <ReferenceLine key={w} x={w} stroke="#888" strokeDasharray="2 4" />
                        ))}
                        {/* Actual weight */}
                        <Line type="monotone" dataKey="weight" stroke="#fff" strokeWidth={2} dot={{ r: 3 }} />
                        {/* Planned pace */}
                        <Line type="monotone" dataKey="planned" stroke="#f97316" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            )}

            {/* Daily log table */}
            {tableData.length > 0 && (
                <table className="weight-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Weight</th>
                            <th>Daily</th>
                            <th>Weekly</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.map(entry => (
                            <tr key={entry.id}>
                                <td>{entry.date}</td>
                                <td>{entry.weight}kg</td>
                                <td className={colorClass(entry.daily)}>{entry.daily !== null ? (entry.daily > 0 ? '+' : '') + entry.daily : '—'}</td>
                                <td className={colorClass(entry.weekly)}>{entry.weekly !== null ? (entry.weekly > 0 ? '+' : '') + entry.weekly : '—'}</td>
                                <td><button onClick={() => handleDeleteEntry(entry.id)}>×</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default Weight;