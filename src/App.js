import React, { useState, useEffect } from "react";
import { auth } from './firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import Navigation from './components/common/Navigation';
import './App.css';
import './styles/index.css';
import Sleep from './components/Sleep/Sleep';
import Fitness from './components/Fitness/Fitness';
import Hobbies from './components/Hobbies/Hobbies';
import School from './components/School/School';
import Chores from './components/Chores/Chores';
import Weight from './components/Weight/Weight';
import Overview from './components/Overview/Overview';

function App() {
    const [currentView, setCurrentView] = useState('sleep');
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const handleLogin = async () => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            setLoginError(error.message);
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
            case 'overview': return <Overview onNavigate={setCurrentView} />;
            default: return <Sleep />;
        }
    };

    if (loading) {
        return <div className="buffer">Loading...</div>;
    }

    if (!user) {
        return (
            <div className="app login-screen">
                <h1>Acorne</h1>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{ padding: '10px', fontSize: '16px', width: '250px', marginBottom: '8px' }}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ padding: '10px', fontSize: '16px', width: '250px', marginBottom: '8px' }}
                />
                {loginError && <p style={{ color: 'red', fontSize: '12px', maxWidth: '300px' }}>{loginError}</p>}
                <button onClick={handleLogin} className="login-button">
                    Sign in
                </button>
            </div>
        );
    }

    return (
        <div className="app">
            {/* Header Button */}
            <header className="app-header">
                <button 
                    className="header-logo-btn" 
                    onClick={() => setShowModal(!showModal)}
                >
                    Acorne
                </button>
            </header>

            {/* Floating Modal Overlay */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <p>Signed in as: <strong>{user.email}</strong></p>
                        <button onClick={handleLogout} className="modal-logout-btn">
                            Sign out
                        </button>
                    </div>
                </div>
            )}

            <Navigation currentView={currentView} onViewChange={setCurrentView} />
            <main className="main-content">
                {renderView()}
            </main>
            {/* <button onClick={handleLogout} className="logout-button">
                Sign out
            </button> */}
        </div>
    );
}

export default App;