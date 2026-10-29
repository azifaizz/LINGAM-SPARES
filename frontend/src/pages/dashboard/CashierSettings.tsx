import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { User, ShieldCheck } from 'lucide-react';
import AttendanceAppDownloadCard from '@/components/dashboard/AttendanceAppDownloadCard';

const CashierSettings = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your account preferences and access application downloads.
        </p>
      </div>

      {/* Account Info Card */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <User size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Account Details</h2>
            <p className="text-xs text-gray-500">Currently logged in account information</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg bg-gray-50 p-4 rounded-lg border border-gray-100">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Email / Username</span>
            <div className="text-sm font-semibold text-gray-800 mt-0.5">{user?.email || 'Cashier'}</div>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Assigned Role</span>
            <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-blue-700">
              <ShieldCheck size={16} />
              <span>{user?.role || 'Cashier'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Mobile App APK Distribution */}
      <AttendanceAppDownloadCard />
    </div>
  );
};

export default CashierSettings;
