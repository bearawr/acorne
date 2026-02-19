import React, { useState } from 'react';
import { Moon, Scale, Dumbbell, CheckSquare, BookOpen, Palette, Menu, X } from 'lucide-react';
import './Navigation.css';

const Navigation = ({ currentView, onViewChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { id: 'sleep', label: 'Sleep', icon: Moon },
    { id: 'weight', label: 'Weight', icon: Scale },
    { id: 'fitness', label: 'Fitness', icon: Dumbbell },
    { id: 'chores', label: 'Chores', icon: CheckSquare },
    { id: 'school', label: 'School', icon: BookOpen },
    { id: 'hobbies', label: 'Hobbies', icon: Palette }
  ];

  const handleNavClick = (id) => {
    onViewChange(id);
    setIsOpen(false);
  };

  const currentItem = navItems.find(item => item.id === currentView);

  return (
    <nav className="navigation">
      <div className="nav-brand">
        <h1>Acorne</h1>
        <p className="nav-subtitle">Your 2026 Journey</p>
      </div>
      
      {/* Desktop view */}
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

      {/* Mobile dropdown */}
      <div className="nav-dropdown-container">
        <button 
          className="nav-dropdown-trigger"
          onClick={() => setIsOpen(!isOpen)}
        >
          {currentItem && (
            <>
              {React.createElement(currentItem.icon, { size: 20 })}
              <span>{currentItem.label}</span>
            </>
          )}
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {isOpen && (
          <div className="nav-dropdown-menu">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`nav-dropdown-item ${currentView === item.id ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;