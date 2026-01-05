import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import DrivePage from './pages/DrivePage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/drive" element={<DrivePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<Navigate to="/auth" />} />
      </Routes>
    </Router>
  );
}

export default App;