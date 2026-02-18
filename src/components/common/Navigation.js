import React from 'react';
import { Moon, Scale, Dumbbell, CheckSquare, BookOpen, Palette } from 'lucide-react';
import './Navigation.css';

const Navigation = ({ currentView, onViewChange }) => {
  const navItems = [
    { id: 'sleep', label: 'Sleep', icon: Moon },
    { id: 'weight', label: 'Weight', icon: Scale },
    { id: 'fitness', label: 'Fitness', icon: Dumbbell },
    { id: 'chores', label: 'Chores', icon: CheckSquare },
    { id: 'school', label: 'School', icon: BookOpen },
    { id: 'hobbies', label: 'Hobbies', icon: Palette }
  ];

  return (
    <nav className="navigation">
      <div className="nav-brand">
        <h1>Acorne</h1>
        <p className="nav-subtitle">Your 2026 Journey</p>
      </div>
      
      <div className="nav-items">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => onViewChange(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navigation;
