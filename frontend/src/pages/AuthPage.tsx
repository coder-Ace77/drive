import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../service/authService';
import AuthBackground from '../components/auth/AuthBackground';
import AuthHeader from '../components/auth/AuthHeader';
import AuthErrorMessage from '../components/auth/AuthErrorMessage';
import AuthForm from '../components/auth/AuthForm';
import AuthFooter from '../components/auth/AuthFooter';

const AuthPage = () => {
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const response = await authService.login({
          username: formData.username,
          password: formData.password
        });

        localStorage.setItem('token', response.access_token);
        navigate('/drive');
      } else {
        await authService.register({
          username: formData.username,
          password: formData.password
        });
        setIsLogin(true);
        setError('Account created! Please sign in.');
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      const message = err.response?.data?.detail || "Something went wrong. Please try again.";
      setError(typeof message === 'string' ? message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthBackground>
      <AuthHeader />

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-slate-200/60 p-8 border border-white">
        <h2 className="text-xl font-semibold text-slate-800 mb-6">
          {isLogin ? 'Welcome back' : 'Create an account'}
        </h2>

        <AuthErrorMessage error={error} />

        <AuthForm
          username={formData.username}
          password={formData.password}
          onUsernameChange={(val) => setFormData({ ...formData, username: val })}
          onPasswordChange={(val) => setFormData({ ...formData, password: val })}
          onSubmit={handleSubmit}
          loading={loading}
          isLogin={isLogin}
        />

        <AuthFooter
          isLogin={isLogin}
          onToggle={() => {
            setIsLogin(!isLogin);
            setError('');
          }}
        />
      </div>

      <p className="text-center text-slate-400 text-xs mt-8 uppercase tracking-widest font-semibold">
        Secure End-to-End Encryption
      </p>
    </AuthBackground>
  );
};

export default AuthPage;