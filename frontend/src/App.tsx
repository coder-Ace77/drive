import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import DrivePage from './pages/DrivePage';
import EditorPage from './pages/EditorPage';
import { BackendDisclaimer } from './components/BackendDisclaimer';

function App() {
  return (
    <Router>
      <BackendDisclaimer />
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/drive" element={<DrivePage />} />
          <Route path="/editor/:id" element={<EditorPage />} />
        </Route>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<Navigate to="/drive" replace />} />
      </Routes>
    </Router>
  );
}

export default App;