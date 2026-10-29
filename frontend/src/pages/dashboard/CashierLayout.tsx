import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import CashierSidebar from '@/components/dashboard/CashierSidebar';

const CashierLayout = () => {
  const [timeStr, setTimeStr] = useState(() => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-screen bg-slate-100/90 font-sans flex overflow-hidden">
      {/* Sidebar */}
      <CashierSidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white border-b border-slate-200/80 px-6 flex justify-between items-center z-30 h-14 flex-shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-black text-slate-800 tracking-wider uppercase">Lingam Spares POS</span>
            <span className="text-slate-300">|</span>
            <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Counter Terminal #1</span>
          </div>

          <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
            <span className="text-slate-500 font-medium">
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 font-bold text-slate-700">
              {timeStr}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="text-blue-600 font-mono font-bold">[F8]</span> Scan
              <span className="text-slate-300">•</span>
              <span className="text-emerald-600 font-mono font-bold">[F2]</span> Checkout
              <span className="text-slate-300">•</span>
              <span className="text-amber-600 font-mono font-bold">[F4]</span> Hold
            </div>
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <img src="/FlipFlex.jpg" alt="Logo" className="w-7 h-7 rounded-full object-cover border border-slate-200 shadow-xs" />
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider hidden sm:inline">
                &copy; FlipFlex 2026
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-5 xl:p-6 overflow-y-auto custom-scrollbar">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default CashierLayout;
