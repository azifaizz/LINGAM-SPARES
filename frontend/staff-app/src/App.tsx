import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import LoginPage from '@/app/login/LoginPage';
import HomePage from '@/app/home/HomePage';
import CalendarPage from '@/app/calendar/CalendarPage';
import PayrollPage from '@/app/payroll/PayrollPage';
import ProfilePage from '@/app/profile/ProfilePage';
import BottomNav from '@/components/BottomNav';

const Splash = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg)' }}>
    <div className="spinner dark" style={{ width: 28, height: 28 }} />
  </div>
);

const AppContent = () => {
  const { user, loading, logout } = useAuth();
  const [tab, setTab] = useState('home');

  if (loading) return <Splash />;
  if (!user) return <LoginPage />;

  return (
    <div className="app-shell">
      <main className="app-content">
        <div className="page-container" key={tab}>
          {tab === 'home' && <HomePage />}
          {tab === 'calendar' && <CalendarPage />}
          {tab === 'payroll' && <PayrollPage />}
          {tab === 'profile' && <ProfilePage onLogout={logout} />}
        </div>
      </main>
      <BottomNav activeTab={tab} onNavigate={setTab} />
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;
