import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ShoppingCart, Printer, BarChart2, LogOut, Users, Briefcase, CalendarCheck, UserCheck, Calculator, MapPin, LayoutDashboard, Target, Settings } from 'lucide-react';
import SelfAttendanceModal from './SelfAttendanceModal';

const CashierSidebar = () => {
  const navigate = useNavigate();
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const handleLogout = () => navigate('/');

  const navItems = [
    { name: 'Dashboard', path: '/cashier/dashboard', icon: LayoutDashboard },
    { name: 'Billing', path: '/cashier', icon: ShoppingCart },
    { name: 'Products', path: '/cashier/products', icon: ShoppingCart },
    { name: 'Suppliers', path: '/cashier/suppliers', icon: Users },
    { name: 'Customers', path: '/cashier/customers', icon: Users },
    { name: 'Sales Rep', path: '/cashier/brokers', icon: Briefcase },
    { name: 'Staff Management', path: '/cashier/staff', icon: UserCheck },
    { name: 'Task and Target', path: '/cashier/tasks-targets', icon: Target },
    { name: 'Daily Actions', path: '/cashier/daily-actions', icon: CalendarCheck },
    { name: 'Bills History', path: '/cashier/printed-bills', icon: Printer },
    { name: 'Settings', path: '/cashier/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-blue-500 text-white flex flex-col p-4">
      {/* Logo / App Name & Notifications */}
      <div className="flex items-center justify-between mb-8 px-4 pt-2">
        <div className="text-2xl font-bold">Lingam Spares</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 overflow-y-auto min-h-0 pr-1 custom-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-700 shadow-inner' : 'hover:bg-blue-600'
              }`
            }
          >
            <item.icon size={20} />
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Action Buttons */}
      <div className="mt-4 pt-4 border-t border-blue-400/50 space-y-2">
        <button
          onClick={() => setShowAttendanceModal(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 transition-colors shadow-sm font-bold text-white"
        >
          <MapPin size={20} />
          <span>Punch In</span>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-blue-600 transition-colors text-blue-100 hover:text-white"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
        <div className="flex items-center gap-3 mt-4 px-2">
          <img src="/FlipFlex.jpg" alt="Logo" className="w-10 h-10 rounded-full object-cover border-2 border-white/20 shadow-sm" />
          <div className="text-xs text-blue-100 font-medium">
            &copy; FlipFlex 2026
          </div>
        </div>
      </div>
      <SelfAttendanceModal isOpen={showAttendanceModal} onClose={() => setShowAttendanceModal(false)} />
    </aside>
  );
};

export default CashierSidebar;
