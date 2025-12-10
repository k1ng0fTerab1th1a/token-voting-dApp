import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

import DeployPage from './pages/DeployPage';
import VotePage from './pages/VotePage';
import ResultsPage from './pages/ResultsPage';

import './App.css';

function App() {
  return (
    <Router>
      <div className="app-layout">
        <header className="app-header">
          <nav className="app-nav">
            <Link to="/" className="nav-link">
              Deploy
            </Link>
            <Link to="/vote" className="nav-link">
              Vote
            </Link>
            <Link to="/results" className="nav-link">
              Results
            </Link>
          </nav>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<DeployPage />} />
            <Route path="/vote" element={<VotePage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/results/:address" element={<ResultsPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;