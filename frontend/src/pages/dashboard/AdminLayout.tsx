// src/pages/dashboard/AdminLayout.tsx
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '@/components/dashboard/Sidebar';
import NotificationBell from '@/components/dashboard/NotificationBell';

const AdminLayout = () => {
  const location = useLocation();
  const isDashboard = location.pathname === '/admin/dashboard';

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-y-auto h-screen relative">
        <header className="bg-white/80 backdrop-blur-md border-b px-8 flex justify-end items-center sticky top-0 z-30 min-h-[72px] gap-6">
          <NotificationBell />
          <div className="flex items-center gap-3">
            <img src="/FlipFlex.jpg" alt="Logo" className="w-8 h-8 rounded-full object-cover border-2 border-gray-100 shadow-sm" />
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              &copy; FlipFlex 2026
            </div>
          </div>
        </header>
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
export default AdminLayout;