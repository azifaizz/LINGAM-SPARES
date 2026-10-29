import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const AuthWrapper = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 1. While Firebase is checking the auth status, show a loading indicator.
  //    This is the crucial step that prevents the flash of unprotected content.
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <h2>Loading Application...</h2>
      </div>
    );
  }

  // 2. Define which routes are protected.
  const isProtectedRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/cashier');

  // 3. If the user is not logged in and is trying to access a protected route,
  //    redirect them to the home page.
  if (!user && isProtectedRoute) {
    // The `Navigate` component from react-router-dom will handle the redirect.
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // 4. If everything is okay (user is logged in OR they are on a public page),
  //    render the actual routes.
  return <>{children}</>;
};

export default AuthWrapper;