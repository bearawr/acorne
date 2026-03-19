import React, { useState, useEffect } from 'react';
import { storage } from '../../utils/storage';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ReferenceLine, ResponsiveContainer
} from 'recharts';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import './Weight.css';

function Weight() {
    const [view, setView] = useState('goals');
    const [goals, setGoals] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newGoal, setNewGoal] = useState({
        title: '',
        startWeight: '',
        targetWeight: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        deadline: format(addDays(new Date(), 30), 'yyyy-MM-dd')
    });
    const [selectedGoal, setSelectedGoal] = useState(null);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [todayWeight, setTodayWeight] = useState('');
    const [logDate, setLogDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [editingGoalId, setEditingGoalId] = useState(null);
    const [editData, setEditData] = useState({});
    const [editingEntry, setEditingEntry] = useState(null);
    const [editEntryWeight, setEditEntryWeight] = useState('');
    const [menuOpen, setMenuOpen] = useState(null);

    // ─── DATA LOADING ───────────────────────────────────────
    
    useEffect(() => {
        const loadGoals = async () => {
            const data = await storage.getWeightGoals();
            setGoals(data);
            setLoading(false);
        };
        loadGoals();
    }, []);

    useEffect(() => {
        if (!selectedGoal) return;
        const loadEntries = async () => {
            const data = await storage.getWeightEntries(selectedGoal.id);
            const sorted = data.sort((a, b) => a.date.localeCompare(b.date));
            setEntries(sorted);
        };
        loadEntries();
    }, [selectedGoal]);

    // ─── HELPERS ───────────────────────────────────────────
    
    const getSafeDate = (dateStr) => parseISO(dateStr);

    const colorClass = (val) => {
        if (val === null || val === undefined) return '';
        if (val < 0) return 'progress-good'; 
        if (val > 0) return 'progress-bad';  
        return '';
    };

    const calculateTrendline = (data, floorWeight = 55) => {
        const loggedEntries = data.filter(p => p.Weight !== null);
        const n = loggedEntries.length;
        
        if (n < 2) return data;
    
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        loggedEntries.forEach((p, i) => {
            sumX += i;
            sumY += p.Weight;
            sumXY += i * p.Weight;
            sumXX += i * i;
        });
    
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
    
        return data.map((p, i) => {
            const trendValue = slope * i + intercept;
            return {
                ...p,
                Trend: trendValue >= floorWeight ? parseFloat(trendValue.toFixed(2)) : null
            };
        });
    };

    // ─── HANDLERS ──────────────────────────────────────────
    
    const handleCreateGoal = async () => {
        if (!newGoal.title || !newGoal.startWeight || !newGoal.targetWeight) {
            alert("Please fill in all fields");
            return;
        }
    
        const goalData = {
            title: newGoal.title,
            startWeight: parseFloat(newGoal.startWeight),
            targetWeight: parseFloat(newGoal.targetWeight),
            startDate: newGoal.startDate,
            deadline: newGoal.deadline, // Ensure this matches g.deadline in your JSX
            createdAt: new Date().toISOString()
        };
    
        // 1. Send to Firebase
        const newId = await storage.addWeightGoal(goalData);
        
        if (newId) {
            // 2. Add the ID to our local object so we can click it immediately
            const finalGoal = { ...goalData, id: newId };
            setGoals([...goals, finalGoal]);
            setIsCreating(false);
            // Reset form...
        } else {
            alert("Failed to save goal to database.");
        }
    };

    const handleLogWeight = async () => {
        if (!todayWeight || !logDate) return;
        
        await storage.addWeightEntry(selectedGoal.id, { 
            date: logDate, // Uses the date from the input
            weight: parseFloat(todayWeight) 
        });
    
        const updated = await storage.getWeightEntries(selectedGoal.id);
        setEntries(updated.sort((a, b) => a.date.localeCompare(b.date)));
        setTodayWeight('');
        // Optionally reset date to today after logging
        setLogDate(format(new Date(), 'yyyy-MM-dd'));
    };

    const handleDeleteGoal = async (id) => {
        if (!window.confirm('Delete this goal?')) return;
        await storage.deleteWeightGoal(id);
        setGoals(goals.filter(g => g.id !== id));
        if (selectedGoal?.id === id) setView('goals');
    };

    const startEditing = (e, goal) => {
        e.stopPropagation(); // Prevents opening the detail view
        setEditingGoalId(goal.id);
        setEditData({ ...goal });
    };
    
    const handleSaveEdit = async (e) => {
        e.stopPropagation();
        // Update the goal in storage (assuming your storage utility has an update method)
        // For now, let's update the local state
        const updatedGoals = goals.map(g => g.id === editingGoalId ? editData : g);
        setGoals(updatedGoals);
        await storage.updateWeightGoal(updatedGoals); // Update this to match your storage helper
        setEditingGoalId(null);
    };

    // ─── DATA BUILDERS ─────────────────────────────────────

    const buildChartData = () => {
        if (!selectedGoal) return [];
    
        const start = getSafeDate(selectedGoal.startDate);
        const end = getSafeDate(selectedGoal.deadline);
        const totalGoalDays = differenceInDays(end, start);
        
        const chartPoints = [];
        
        for (let i = 0; i <= totalGoalDays; i++) {
            const currentDate = addDays(start, i);
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            
            let plannedWeight;
            const isEndOfFeb = currentDate <= getSafeDate('2026-02-28');
            const isFirstWeekMarch = currentDate <= getSafeDate('2026-03-07');
    
            if (isEndOfFeb) {
                const febDays = differenceInDays(getSafeDate('2026-02-28'), start) || 1;
                const weightToLose = selectedGoal.startWeight - 57;
                plannedWeight = selectedGoal.startWeight - (weightToLose / febDays) * i;
            } else if (isFirstWeekMarch) {
                const marchStart = getSafeDate('2026-02-28');
                const daysIntoMarch = differenceInDays(currentDate, marchStart);
                plannedWeight = 57 - (1 / 7) * daysIntoMarch; 
            } else {
                const marchEnd = getSafeDate('2026-03-07');
                const remainingDays = differenceInDays(end, marchEnd) || 1;
                const daysSinceMarch = differenceInDays(currentDate, marchEnd);
                const remainingWeightToLose = 56 - selectedGoal.targetWeight;
                plannedWeight = 56 - (remainingWeightToLose / remainingDays) * daysSinceMarch;
            }
    
            const entry = entries.find(e => e.date === dateStr);

            chartPoints.push({
                // Changed 'MMM dd' to 'EEE, MMM dd' (e.g., Mon, Feb 23)
                dateLabel: format(currentDate, 'EEE, MMM dd'), 
                Weight: entry ? entry.weight : null,
                Plan: parseFloat(plannedWeight.toFixed(2)),
                dateStr: dateStr,
                isStartOfWeek: currentDate.getDay() === 1 
            });
        }

        return calculateTrendline(chartPoints, 55);
    };

    const buildTableData = () => {
        return entries.map((entry, i) => {
            const prev = entries[i - 1];
            const daily = prev ? parseFloat((entry.weight - prev.weight).toFixed(2)) : null;

            const d = getSafeDate(entry.date);
            const weekAgoDate = format(addDays(d, -7), 'yyyy-MM-dd');
            const weekAgoEntry = entries.find(e => e.date === weekAgoDate);
            const weekly = weekAgoEntry ? parseFloat((entry.weight - weekAgoEntry.weight).toFixed(2)) : null;

            return { ...entry, daily, weekly };
        }).reverse();
    };

    const buildWeeklySummary = () => {
        if (!selectedGoal || entries.length === 0) return [];
        
        const summary = [];
        const startOfGoal = getSafeDate(selectedGoal.startDate); // Jan 19
        
        // We want to show Week 1 (Jan 26), Week 2 (Feb 2), etc.
        for (let w = 1; w <= 12; w++) {
            // Calculate the Monday of this week
            const currentMonday = addDays(startOfGoal, w * 7);
            const currentMondayStr = format(currentMonday, 'yyyy-MM-dd');
    
            // Calculate the Monday of the previous week
            const prevMonday = addDays(currentMonday, -7);
            const prevMondayStr = format(prevMonday, 'yyyy-MM-dd');
    
            // Find actual entries for those specific Mondays
            const currentEntry = entries.find(e => e.date === currentMondayStr);
            const prevEntry = entries.find(e => e.date === prevMondayStr);
    
            // Fallback: If it's Week 1 and there's no Jan 19 log, use startWeight
            const baselineWeight = prevEntry ? prevEntry.weight : (w === 1 ? selectedGoal.startWeight : null);
            const currentWeight = currentEntry ? currentEntry.weight : null;
    
            let progress = null;
            if (currentWeight && baselineWeight) {
                progress = parseFloat((currentWeight - baselineWeight).toFixed(2));
            }
    
            // Only add to summary if we have reached this date in real life
            // or keep it empty if you want to see the future weeks placeholders
            summary.push({
                date: format(currentMonday, 'MMM dd'),
                label: `Week ${w}`,
                weight: currentWeight,
                progress: progress
            });
        }
        return summary;
    };

    const buildGridData = () => {
        if (!selectedGoal) return [];
        const grid = [];
        const startOfGoal = getSafeDate(selectedGoal.startDate);
    
        for (let w = 0; w <= 11; w++) {
            const weekRow = { weekNum: w, days: [] };
            
            for (let d = 0; d < 7; d++) {
                const currentDay = addDays(startOfGoal, (w * 7) + d);
                const dateStr = format(currentDay, 'yyyy-MM-dd');
                const entry = entries.find(e => e.date === dateStr);
                const currentWeight = entry ? entry.weight : null;
    
                let progress = null;
                if (w === 0) {
                    // Week 0 has no "previous week" to compare to
                    progress = null;
                } else {
                    // Find the weight from exactly 7 days ago (the cell directly above)
                    const prevWeekDay = addDays(currentDay, -7);
                    const prevWeekStr = format(prevWeekDay, 'yyyy-MM-dd');
                    const prevEntry = entries.find(e => e.date === prevWeekStr);
                    
                    if (currentWeight && prevEntry) {
                        progress = parseFloat((currentWeight - prevEntry.weight).toFixed(2));
                    }
                }
    
                weekRow.days.push({
                    weight: currentWeight,
                    progress: progress
                });
            }
            grid.push(weekRow);
        }
        return grid;
    };

    // ─── RENDER ───────────────────────────────────────────

    if (loading) return <div className="weight-view">Loading...</div>;

    if (view === 'goals') {
        return (
            <div className="weight-view module-weight">
                <header className="weight-header">
                    <h1>Weight Tracker</h1>
                    <button onClick={() => setIsCreating('true')}>+ New Goal</button>
                </header>

                {isCreating && (
                <div className="new-goal-form">
                    <h3>Add New Goal</h3>
                    <input
                        placeholder="Goal Title (e.g. Summer Shred)" 
                        value={newGoal.title}
                        onChange={e => setNewGoal({...newGoal, title: e.target.value})}
                    />
                    <div className="input-group">
                        <label>Starting Weight (kg)</label>
                        <input 
                            type="number" 
                            value={newGoal.startWeight}
                            onChange={e => setNewGoal({...newGoal, startWeight: e.target.value})}
                        />
                    </div>
                    <div className="input-group">
                        <label>Target Weight (kg)</label>
                        <input 
                            type="number" 
                            value={newGoal.targetWeight}
                            onChange={e => setNewGoal({...newGoal, targetWeight: e.target.value})}
                        />
                    </div>
                    <div className="input-group">
                        <label>Start Date</label>
                        <input 
                            type="date" 
                            value={newGoal.startDate}
                            onChange={e => setNewGoal({...newGoal, startDate: e.target.value})}
                        />
                    </div>
                    <div className="input-group">
                        <label>Deadline</label>
                        <input 
                            type="date" 
                            value={newGoal.deadline}
                            onChange={e => setNewGoal({...newGoal, deadline: e.target.value})}
                        />
                    </div>
                    <div className="edit-actions" style={{marginTop: '10px'}}>
                        <button className="cancel-btn" onClick={() => setIsCreating(false)}>Cancel</button>
                        <button className="save-btn" onClick={handleCreateGoal}>Add</button>
                    </div>
                </div>
            )}

                <div className="goals-list">
                    {goals.map(g => (
                        <div key={g.id} className="goal-card" onClick={() => editingGoalId !== g.id && (setSelectedGoal(g), setView('detail'))}>
                        {editingGoalId === g.id ? (
                            <div className="edit-menu" onClick={(e) => e.stopPropagation()}>
                                <input 
                                    type="text" 
                                    value={editData.title} 
                                    onChange={e => setEditData({...editData, title: e.target.value})} 
                                />
                                <div className="edit-actions">
                                    <button className="delete-btn" onClick={() => handleDeleteGoal(g.id)}>Delete</button>
                                    <button className="cancel-btn" onClick={() => setEditingGoalId(null)}>Cancel</button>
                                    <button className="save-btn" onClick={handleSaveEdit}>Save</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h3>{g.title}</h3>
                                <p><strong>Weight Goal:</strong> {g.startWeight}kg → {g.targetWeight}kg</p>
                                <p><strong>Period: </strong>{format(parseISO(g.startDate), 'MMM dd')} → {format(parseISO(g.deadline), 'MMM dd, yyyy')}</p>
                                <button className="edit-btn" onClick={(e) => startEditing(e, g)}>Edit</button>
                            </>
                        )}
                    </div>
                    ))}
                </div>
            </div>
        );
    }

    const tableData = buildTableData();
    const chartData = buildChartData();

    const latestEntry = entries[entries.length - 1];
    const latest = latestEntry ? latestEntry.weight : selectedGoal.startWeight;

    // Calculation for Total Lost
    const totalLost = parseFloat((selectedGoal.startWeight - latest).toFixed(1));

    // 1. Calculate the weight gap for the progress bar
    const totalGap = selectedGoal.startWeight - selectedGoal.targetWeight;
    const covered = selectedGoal.startWeight - latest;
    
    // 2. Calculate weight percentage (clamped between 0 and 100)
    const progressPercent = totalGap > 0 
        ? Math.min(Math.max(parseFloat(((covered / totalGap) * 100).toFixed(1)), 0), 100) 
        : 0;
    
    // 3. Calculate Days (Merged into one definition)
    // We use + 1 so the start date is "Day 1"
    const daysSinceStart = selectedGoal 
        ? differenceInDays(new Date(), getSafeDate(selectedGoal.startDate)) + 1 
        : 0;
    
    // 4. Total days allocated for this goal
    const totalGoalDays = selectedGoal
        ? differenceInDays(getSafeDate(selectedGoal.deadline), getSafeDate(selectedGoal.startDate))
        : 0;

    return (
        <div className="weight-view module-weight">
            <button className="back-btn" onClick={() => setView('goals')}>←</button>
            <h2>{selectedGoal.title}</h2>

            <div className="weight-stats-row">
                <div>
                    <small>Total Lost</small><br/>
                    <strong>{totalLost}kg</strong>
                    <span className="day-count">(Day {daysSinceStart}/{totalGoalDays} days)</span>
                </div>
                <div>
                    <small>Current</small><br/>
                    <strong>{latest}kg</strong>
                </div>
                <div>
                    <small>Target</small><br/>
                    <strong>{selectedGoal.targetWeight}kg</strong>
                </div>
                <div>
                    <small>Remaining</small><br/>
                    <strong>{(latest - selectedGoal.targetWeight).toFixed(1)}kg</strong>
                </div>
            </div>

            <div className="goal-progress-container">
                <div className="progress-label">
                    <span>Goal Progress</span>
                    <span>{progressPercent}%</span>
                </div>
                <div className="progress-bar-bg">
                    <div 
                        className="progress-bar-fill" 
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                </div>
            </div>

            <div className="weight-log-row">
                <input 
                    type="date" 
                    value={logDate} 
                    onChange={e => setLogDate(e.target.value)}
                    className="date-input"
                />
                <input 
                    type="number" 
                    step="0.1" 
                    value={todayWeight} 
                    onChange={e => setTodayWeight(e.target.value)} 
                    placeholder="Weight (kg)" 
                    className="weight-input"
                />
                <button onClick={handleLogWeight}>Log Weight</button>
            </div>

            {chartData.length > 0 && (
                <div className="chart-container" style={{ height: 350, marginTop: '20px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                            <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                            <YAxis
                                domain={[54, 'dataMax + 1']}
                                ticks={[54, 55, 56, 57, 58, 59, 60, 61, 62]}
                                tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }}
                                tickFormatter={(value) => `${value}kg`}
                                axisLine={{ stroke: '#cbd5e1' }}
                                tickLine={false}
                            />
                            <Tooltip />

                            <ReferenceLine
                                y={selectedGoal.targetWeight}
                                stroke="#059669"
                                strokeWidth={1}
                                label={{ value: `Goal: ${selectedGoal.targetWeight}kg`, position: 'insideTopLeft', fill: '#059669', fontSize: 12 }}
                            />

                            <ReferenceLine
                                y={57}
                                stroke="#3b82f6"
                                strokeDasharray="3 3"
                                label={{ value: '57 kg', position: 'insideTopLeft', fill: '#3b82f6', fontSize: 11 }}
                            />

                            {/* Weekly Vertical Lines */}
                            {chartData
                                .filter(entry => entry.isStartOfWeek)
                                .map((entry, index) => (
                                    <ReferenceLine
                                        key={`week-${index}`}
                                        x={entry.dateLabel}
                                        stroke="#cbd5e1" 
                                        strokeDasharray="4 4"
                                        strokeWidth={1}
                                        label={{ 
                                            value: `W${index + 0}`, 
                                            position: 'insideBottomLeft', 
                                            fill: '#94a3b8', 
                                            fontSize: 9 
                                        }} 
                                    />
                                ))
                            }

                            <Line type="monotone" dataKey="Plan" stroke="#f97316" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                            <Line type="linear" dataKey="Trend" stroke="#c4c4c4" strokeWidth={2} strokeDasharray="3 3" dot={false} connectNulls />
                            <Line type="inear" dataKey="Weight" stroke="#1e293b" strokeWidth={1} dot={{ r: 2 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            <div className='weight-tables'>
                <h3>Weekly Comparison Grid</h3>
                <div className="table-container" style={{ overflowX: 'auto' }}>
                    <table className="weight-grid-expanded">
                        <thead>
                            <tr>
                                <th rowSpan="2">Week</th>
                                <th colSpan="2">Mon</th>
                                <th colSpan="2">Tue</th>
                                <th colSpan="2">Wed</th>
                                <th colSpan="2">Thu</th>
                                <th colSpan="2">Fri</th>
                                <th colSpan="2">Sat</th>
                                <th colSpan="2">Sun</th>
                            </tr>
                            <tr>
                                {/* Sub-headers for Weight and Progress */}
                                {[...Array(7)].map((_, i) => (
                                    <React.Fragment key={i}>
                                        <th className="sub-head">Kg</th>
                                        <th className="sub-head">+/-</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {buildGridData().map((row) => (
                                <tr key={row.weekNum}>
                                    <td className="week-label">W{row.weekNum}</td>
                                    {row.days.map((day, i) => (
                                        <React.Fragment key={i}>
                                            <td className="weight-cell">{day.weight || '—'}</td>
                                            <td className={`progress-cell ${colorClass(day.progress)}`}>
                                                {day.progress !== null ? (day.progress > 0 ? `+${day.progress}` : day.progress) : '--'}
                                            </td>
                                        </React.Fragment>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h3>Weekly Summary</h3>
                <table className="weight-table weekly-summary">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Week</th>
                            <th>Progress</th>
                            <th>Weight</th>
                        </tr>
                    </thead>
                    <tbody>
                        {buildWeeklySummary().map((row, i) => (
                            <tr key={i}>
                                <td>{row.date}</td>
                                <td>{row.label}</td>
                                <td className={colorClass(row.progress)}>
                                    {row.progress !== null ? (row.progress > 0 ? `+${row.progress}` : row.progress) : '--'}
                                </td>
                                <td>{row.weight ? `${row.weight}kg` : '--'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <h3>History</h3>
                <table className="weight-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Weight</th>
                            <th>Daily</th>
                            <th>Weekly</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.map((row) => (
                            <tr key={row.id}>
                                <td>{format(getSafeDate(row.date), 'EEE, MMM dd')}</td>
                                <td>
                                    {editingEntry === row.id ? (
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={editEntryWeight}
                                            onChange={(e) => setEditEntryWeight(e.target.value)}
                                            style={{ width: '70px', padding: '2px 4px' }}
                                            autoFocus
                                        />
                                    ) : (
                                        `${row.weight}kg`
                                    )}
                                </td>
                                <td className={colorClass(row.daily)}>{row.daily ?? '--'}</td>
                                <td className={colorClass(row.weekly)}>{row.weekly ?? '--'}</td>

                                {/* Clean Action Column with Menu */}
                                <td style={{ position: 'relative', textAlign: 'center' }} onMouseLeave={() => setMenuOpen(null)}>
                                    {editingEntry === row.id ? (
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button 
                                                style={{ color: 'green', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                                                onClick={async () => {
                                                    await storage.updateWeightEntry(selectedGoal.id, row.id, { weight: parseFloat(editEntryWeight) });
                                                    const updated = await storage.getWeightEntries(selectedGoal.id);
                                                    setEntries(updated.sort((a, b) => a.date.localeCompare(b.date)));
                                                    setEditingEntry(null);
                                                }}
                                            >
                                                ✓
                                            </button>
                                            <button 
                                                style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                                                onClick={() => setEditingEntry(null)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <button 
                                                onClick={() => setMenuOpen(menuOpen === row.id ? null : row.id)}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 8px' }}
                                            >
                                                ⋮
                                            </button>

                                            {menuOpen === row.id && (
                                                <div style={{
                                                    position: 'absolute',
                                                    right: '10px',
                                                    top: '10px',
                                                    zIndex: 100,
                                                    background: 'white',
                                                    border: '1px solid #eee',
                                                    borderRadius: '6px',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    minWidth: '100px',
                                                    overflow: 'hidden'
                                                }}>
                                                    <button 
                                                        style={{ padding: '10px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px' }}
                                                        onClick={() => { 
                                                            setEditingEntry(row.id); 
                                                            setEditEntryWeight(row.weight); 
                                                            setMenuOpen(null); 
                                                        }}
                                                    >
                                                        Edit Entry
                                                    </button>
                                                    <button 
                                                        style={{ padding: '10px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', color: '#ff4d4f', fontSize: '14px', borderTop: '1px solid #f5f5f5' }}
                                                        onClick={async () => {
                                                            if (window.confirm('Delete this entry?')) {
                                                                await storage.deleteWeightEntry(selectedGoal.id, row.id);
                                                                const updated = await storage.getWeightEntries(selectedGoal.id);
                                                                setEntries(updated.sort((a, b) => a.date.localeCompare(b.date)));
                                                            }
                                                            setMenuOpen(null);
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
        
            </div>
        </div>
    );
}

export default Weight;