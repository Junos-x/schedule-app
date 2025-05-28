import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './HomePage';
import AnswerPage from './AnswerPage';
import ResultsPage from './ResultsPage'; // ResultsPageを読み込みます
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/event/:uniqueUrl" element={<AnswerPage />} />
          {/* ↓↓↓ この行を新しく追加します ↓↓↓ */}
          <Route path="/event/:uniqueUrl/results" element={<ResultsPage />} />
          {/* ↑↑↑ この行を新しく追加します ↑↑↑ */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;