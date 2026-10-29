// src/components/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
  requiredRole?: "Admin" | "Cashier";
}

const ProtectedRoute = ({ requiredRole }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  const [showStuck, setShowStuck] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => setShowStuck(true), 3000);
    } else {
      setShowStuck(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center text-white gap-4">
        <div className="text-xl font-semibold">Authenticating...</div>
        {showStuck && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-gray-300 text-sm">This is taking longer than expected.</p>
            <button
              onClick={() => {
                // Force logout cleanup
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/';
              }}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-sm transition-colors mt-2"
            >
              Force Logout & Reset
            </button>
          </div>
        )}
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Role mismatch → BLOCK access
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
