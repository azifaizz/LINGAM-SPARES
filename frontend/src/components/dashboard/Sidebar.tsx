import { NavLink, useNavigate } from 'react-router-dom';
import { ShoppingCart, Package, Users, BarChart2, Settings, LogOut, Printer, ClipboardList, PiggyBank, Briefcase, CreditCard, Calculator, LayoutDashboard, Target } from 'lucide-react';

const Sidebar = () => {
  const navigate = useNavigate();
  const handleLogout = () => navigate('/');

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Billing', path: '/admin/billing', icon: ShoppingCart },
    { name: 'Stock / Products', path: '/admin/products', icon: Package },
    { name: 'Suppliers', path: '/admin/suppliers', icon: Users },
    { name: 'Supplier Credits', path: '/admin/supplier-credits', icon: CreditCard },
    { name: 'Bills History', path: '/admin/printed-bills', icon: Printer },
    { name: 'Sales Rep', path: '/admin/brokers', icon: Users },
    { name: 'Customer Details', path: '/admin/customers', icon: Users },
    { name: 'Daily Actions', path: '/admin/daily-actions', icon: ClipboardList },
    { name: 'Staff Management', path: '/admin/staff', icon: Briefcase },
    { name: 'Task and Target', path: '/admin/tasks-targets', icon: Target },
    { name: 'Reports', path: '/admin/reports', icon: BarChart2 },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-blue-500 text-white flex flex-col p-4 overflow-y-auto hide-scrollbar">
      <div className="flex items-center justify-between mb-8 px-4 pt-2">
        <div className="text-2xl font-bold">Lingam Spares</div>
      </div>
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
      <div className="mt-4 pt-4 border-t border-blue-400/50">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-blue-600 transition-colors"
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
    </aside>
  );
};

export default Sidebar;