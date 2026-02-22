import React, { useState, useEffect } from "react";
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
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
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });
        return unsubscribe; // cleanup on unmount
    }, []);

    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error('Login error:', error);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

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

    // Still checking auth state
    if (loading) {
        return <div className="app">Loading...</div>;
    }

    // Not logged in — show login screen
    if (!user) {
        return (
            <div className="app login-screen">
                <h1>Acorne</h1>
                <p>Please sign in to continue</p>
                <button onClick={handleLogin} className="login-button">
                    Sign in with Google
                </button>
            </div>
        );
    }

    // Logged in — show the app
    return (
        <div className="app">
            <Navigation currentView={currentView} onViewChange={setCurrentView} />
            <main className="main-content">
                {renderView()}
            </main>
            <button onClick={handleLogout} className="logout-button">
                Sign out
            </button>
        </div>
    );
}

export default App;