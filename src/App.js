import React, { useState } from "react";
import Navigation from './components/common/Navigation'
import './App.css'
import './styles/index.css'
import Sleep from './components/Sleep'
import Fitness from './components/Fitness'
import Hobbies from './components/Hobbies'
import School from './components/School'
import Chores from './components/Chores'

function App() {
    const [currentView, setCurrentView] = useState('sleep');

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

export default App;
