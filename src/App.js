import React, { useState } from "react";
    /*
        Imports 'default export'.
        useState is a function that allows us to add a state to the
        functional component. 'state' enables dynamic webs for data that changes,
        else, it would be a static page
    */
import Navigation from './components/common/Navigation';
import './App.css';
import './styles/index.css';
import Sleep from './components/Sleep/Sleep';
import Fitness from './components/Fitness/Fitness';
import Hobbies from './components/Hobbies/Hobbies';
import School from './components/School/School';
import Chores from './components/Chores/Chores';
import Weight from './components/Weight/Weight';

function App() {
    const [currentView, setCurrentView] = useState('sleep');

    // Decides which components to return
    const renderView = () => {
        switch(currentView) {
            case 'sleep': return <Sleep />;
            case 'weight': return <Weight />;
            case 'fitness': return <Fitness />;
            case 'chores': return <Chores />;
            case 'school': return <School />;
            case 'hobbies': return <Hobbies />;
            default: return <Sleep />;
        }
    };

    return (
        <div className="app">
            <Navigation currentView={currentView} onViewChange={setCurrentView} />
            <main className="main-content">
                {renderView()}
            </main>
        </div>
    );
}

export default App; // makes available to index.js
