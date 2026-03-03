import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Trash2, Save } from 'lucide-react';
import { calculateSleepHours } from '../../utils/sleepCalculations';
import './SleepInputModal.css';

const SleepInputModal = ({ date, existingEntry, onSave, onDelete, onClose }) => {
    const [bedTime, setBedTime] = useState('');
    const [wakeTime, setWakeTime] = useState('');
    const [notes, setNotes] = useState('');

    const formatHoursToHM = (decimalHours) => {
        if (!decimalHours || decimalHours === 0) return '0h';
        const h = Math.floor(parseFloat(decimalHours));
        const m = Math.round((parseFloat(decimalHours) - h) * 60);
        if (m === 0) return `${h}h`;
        if (h === 0) return `${m}m`;
        return `${h}h ${m}m`;
    };

    useEffect(() => {
        if (existingEntry) {
            setBedTime(existingEntry.bedTime || '');
            setWakeTime(existingEntry.wakeTime || '');
            setNotes(existingEntry.notes || '');
        }
    }, [existingEntry]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!bedTime || !wakeTime) {
            alert('Enter BOTH bedtime and wake time');
            return;
        }
        const hoursSlept = calculateSleepHours(bedTime, wakeTime);
        const entryDate = date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

        onSave({
            date: entryDate,
            bedTime,
            wakeTime,
            hoursSlept,
            notes
        });
    };

    const handleDelete = () => {
        if (window.confirm('Delete this sleep entry?')) {
            const entryDate = date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
            onDelete(entryDate);
            onClose();
        }
    };

    const calculatedHours = bedTime && wakeTime ? calculateSleepHours(bedTime, wakeTime) : null;
    const displayDate = date ? format(date, 'EEEE, MMMM d, yyyy') : format(new Date(), 'EEEE, MMMM d, yyyy');

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2>Sleep Entry</h2>
                        <p className="modal-date">{displayDate}</p>
                    </div>
                    <button className="btn-icon" onClick={onClose} type="button">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="sleep-form">
                    {/* NEW WRAPPER: This puts the inputs and the calc box in one row */}
                    <div className="form-main-row">
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="bedTime">Bedtime</label>
                                <input
                                    type="time"
                                    id="bedTime"
                                    value={bedTime}
                                    onChange={e => setBedTime(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="wakeTime">Wake Time</label>
                                <input
                                    type="time"
                                    id="wakeTime"
                                    value={wakeTime}
                                    onChange={e => setWakeTime(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {calculatedHours !== null && (
                            <div className="calculated-hours">
                                <p>Total</p>
                                <strong>{formatHoursToHM(calculatedHours)}</strong>
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label htmlFor="notes">Notes</label>
                        <textarea
                            id="notes"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="How was sleep?"
                            rows={3} // Adjusted from 10 to 6 to save vertical space
                        />
                    </div>

                    <div className="modal-actions">
                        {existingEntry && (
                            <button type="button" className="btn-danger" onClick={handleDelete}>
                                <Trash2 size={18} />
                                Delete
                            </button>
                        )}
                        <div className="action-group">
                            <button type="button" className="btn-secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="btn-primary">
                                <Save size={18} />
                                Save Entry
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SleepInputModal;