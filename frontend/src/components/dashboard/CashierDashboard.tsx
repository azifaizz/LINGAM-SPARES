import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, ShoppingCart, Package, Users,
  PlusCircle, CreditCard, Banknote, Calendar, ChevronLeft, ChevronRight,
  Eye, Phone, AlertTriangle, ArrowUpRight, ArrowDownRight, Layers, Award
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend
} from 'recharts';
import {
  format, subDays, startOfDay, endOfDay,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, addMonths, subMonths,
  addYears, subYears, getDaysInMonth, getYear, getMonth,
  isSameMonth, isSameYear
} from 'date-fns';
import { useGlobalData } from '@/context/GlobalDataContext';
import { daybookApi, staffApi, StaffTarget, StaffTask } from '@/lib/api';
import LowStockProductsModal from './LowStockProductsModal';
import { useNavigate } from 'react-router-dom';

type DashboardPeriod = 'day' | 'week' | 'month' | 'year';

const CashierDashboard = () => {
  const { bills = [], products = [], staff = [], loading: globalLoading } = useGlobalData() as any;
  const navigate = useNavigate();

  const [dashboardView, setDashboardView] = useState<DashboardPeriod>('month');
  const [chartReferenceDate, setChartReferenceDate] = useState<Date>(new Date());
  const [expenses, setExpenses] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);
  const [targets, setTargets] = useState<StaffTarget[]>([]);
  const [tasks, setTasks] = useState<StaffTask[]>([]);

  useEffect(() => {
    staffApi.getAllTargets().then(res => setTargets(res.data || [])).catch(() => {});
    staffApi.getAllTasks().then(res => setTasks(res.data || [])).catch(() => {});
  }, []);

  // Compute business running years from bills and current year
  const businessYears = useMemo(() => {
    const yearsSet = new Set<number>();
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear - 1);
    yearsSet.add(currentYear);
    yearsSet.add(currentYear + 1);

    bills.forEach((b: any) => {
      if (b.status === 'CANCELLED' || b.status === 'HOLD') return;
      const d = new Date(b.createdAt || new Date());
      if (!isNaN(d.getTime())) yearsSet.add(d.getFullYear());
    });

    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [bills]);

  // Compute active date range based on selected period
  const activeRange = useMemo(() => {
    if (dashboardView === 'year') {
      const minYear = businessYears[0];
      const maxYear = businessYears[businessYears.length - 1];
      return {
        start: startOfYear(new Date(minYear, 0, 1)),
        end: endOfYear(new Date(maxYear, 11, 31))
      };
    } else if (dashboardView === 'month') {
      return {
        start: startOfYear(chartReferenceDate),
        end: endOfYear(chartReferenceDate)
      };
    } else { // 'day' or 'week'
      return {
        start: startOfMonth(chartReferenceDate),
        end: endOfMonth(chartReferenceDate)
      };
    }
  }, [dashboardView, chartReferenceDate, businessYears]);

  // Fetch or calculate expenses for active range
  useEffect(() => {
    const fetchExpenses = async () => {
      const rangeStartStr = format(activeRange.start, 'yyyy-MM-dd');
      const rangeEndStr = format(activeRange.end, 'yyyy-MM-dd');

      try {
        const res = await daybookApi.getRange(rangeStartStr, rangeEndStr);
        const fetched = res.data?.chartData || res.data?.dailyBreakdown || [];
        setExpenses(fetched);
      } catch (e) {
        // Fallback: estimate from daybook range
        setExpenses([]);
      }
    };

    fetchExpenses();
  }, [activeRange]);

  // Period Navigation Handlers
  const handlePrevPeriod = () => {
    if (dashboardView === 'year') {
      setChartReferenceDate(prev => subYears(prev, 1));
    } else if (dashboardView === 'month') {
      setChartReferenceDate(prev => subYears(prev, 1));
    } else {
      setChartReferenceDate(prev => subMonths(prev, 1));
    }
  };

  const handleNextPeriod = () => {
    if (dashboardView === 'year') {
      setChartReferenceDate(prev => addYears(prev, 1));
    } else if (dashboardView === 'month') {
      setChartReferenceDate(prev => addYears(prev, 1));
    } else {
      setChartReferenceDate(prev => addMonths(prev, 1));
    }
  };

  const handleTodayPeriod = () => {
    setChartReferenceDate(new Date());
  };

  // Human-readable titles explaining WHICH date, WHICH week, WHICH month, WHICH year
  const periodInfo = useMemo(() => {
    const yearStr = format(chartReferenceDate, 'yyyy');
    const monthStr = format(chartReferenceDate, 'MMMM');
    const monthAbbr = format(chartReferenceDate, 'MMM');
    const daysCount = getDaysInMonth(chartReferenceDate);

    if (dashboardView === 'year') {
      const minYear = businessYears[0];
      const maxYear = businessYears[businessYears.length - 1];
      return {
        title: `Annual Performance (${minYear} – ${maxYear})`,
        subtitle: `Aggregated sales income and expenses across ${businessYears.join(', ')}`
      };
    }
    if (dashboardView === 'month') {
      return {
        title: `Year ${yearStr} (Monthly: Jan – Dec)`,
        subtitle: `Monthly revenue vs operating expenses throughout ${yearStr}`
      };
    }
    if (dashboardView === 'week') {
      const weeksCount = daysCount > 28 ? 5 : 4;
      return {
        title: `${monthStr} ${yearStr} (Weekly: W1 – W${weeksCount})`,
        subtitle: `Calendar week breakdown for ${monthStr} ${yearStr} with explicit date ranges`
      };
    }
    // 'day'
    return {
      title: `${monthStr} ${yearStr} (Daily: 1 – ${daysCount} ${monthAbbr})`,
      subtitle: `Day-by-day transaction totals and operational costs for ${monthStr} ${yearStr}`
    };
  }, [dashboardView, chartReferenceDate, businessYears]);

  // Aggregate Chart Data by Days, Weeks, Month, Year
  useEffect(() => {
    const targetYear = getYear(chartReferenceDate);
    const targetMonth = getMonth(chartReferenceDate);
    const monthAbbr = format(chartReferenceDate, 'MMM');
    const daysInMonth = getDaysInMonth(chartReferenceDate);

    // Map raw daily income from bills
    const dailyIncomeMap = new Map<string, number>();
    bills.forEach((b: any) => {
      if (b.status === 'CANCELLED' || b.status === 'HOLD') return;
      const bDate = new Date(b.createdAt || new Date());
      if (!isNaN(bDate.getTime())) {
        const dStr = format(bDate, 'yyyy-MM-dd');
        const amt = Number(b.finalAmount || b.amountPaid || 0);
        dailyIncomeMap.set(dStr, (dailyIncomeMap.get(dStr) || 0) + amt);
      }
    });

    // Map raw daily expense
    const dailyExpenseMap = new Map<string, number>();
    expenses.forEach((e: any) => {
      const dStr = e.date || e.createdAt;
      if (dStr) {
        const amt = Number(e.expense || e.amount || 0);
        dailyExpenseMap.set(dStr, (dailyExpenseMap.get(dStr) || 0) + amt);
      }
    });

    if (dashboardView === 'year') {
      const yearlyAgg: Record<number, { income: number; expense: number }> = {};
      businessYears.forEach(y => { yearlyAgg[y] = { income: 0, expense: 0 }; });

      bills.forEach((b: any) => {
        if (b.status === 'CANCELLED' || b.status === 'HOLD') return;
        const bDate = new Date(b.createdAt || new Date());
        if (!isNaN(bDate.getTime())) {
          const y = bDate.getFullYear();
          if (yearlyAgg[y]) yearlyAgg[y].income += Number(b.finalAmount || b.amountPaid || 0);
        }
      });

      expenses.forEach((e: any) => {
        const d = new Date(e.date || e.createdAt || new Date());
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          if (yearlyAgg[y]) yearlyAgg[y].expense += Number(e.expense || e.amount || 0);
        }
      });

      const result = businessYears.map(y => {
        const inc = yearlyAgg[y].income;
        const exp = yearlyAgg[y].expense;
        return {
          label: y.toString(),
          fullLabel: `Calendar Year ${y}`,
          income: inc,
          expense: exp,
          net: inc - exp
        };
      });
      setChartData(result);
    } else if (dashboardView === 'month') {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const fullMonthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const monthlyAgg: Record<number, { income: number; expense: number }> = {};
      for (let m = 0; m < 12; m++) monthlyAgg[m] = { income: 0, expense: 0 };

      bills.forEach((b: any) => {
        if (b.status === 'CANCELLED' || b.status === 'HOLD') return;
        const bDate = new Date(b.createdAt || new Date());
        if (!isNaN(bDate.getTime()) && bDate.getFullYear() === targetYear) {
          const m = bDate.getMonth();
          monthlyAgg[m].income += Number(b.finalAmount || b.amountPaid || 0);
        }
      });

      expenses.forEach((e: any) => {
        const d = new Date(e.date || e.createdAt || new Date());
        if (!isNaN(d.getTime()) && d.getFullYear() === targetYear) {
          const m = d.getMonth();
          monthlyAgg[m].expense += Number(e.expense || e.amount || 0);
        }
      });

      const result = months.map((m, idx) => {
        const inc = monthlyAgg[idx].income;
        const exp = monthlyAgg[idx].expense;
        return {
          label: m,
          fullLabel: `${fullMonthNames[idx]} ${targetYear}`,
          income: inc,
          expense: exp,
          net: inc - exp
        };
      });
      setChartData(result);
    } else if (dashboardView === 'week') {
      const weeksConfig = [
        { label: `W1 (1-7 ${monthAbbr})`, fullLabel: `Week 1: 1 - 7 ${monthAbbr} ${targetYear}`, startDay: 1, endDay: 7, income: 0, expense: 0 },
        { label: `W2 (8-14 ${monthAbbr})`, fullLabel: `Week 2: 8 - 14 ${monthAbbr} ${targetYear}`, startDay: 8, endDay: 14, income: 0, expense: 0 },
        { label: `W3 (15-21 ${monthAbbr})`, fullLabel: `Week 3: 15 - 21 ${monthAbbr} ${targetYear}`, startDay: 15, endDay: 21, income: 0, expense: 0 },
        { label: `W4 (22-28 ${monthAbbr})`, fullLabel: `Week 4: 22 - 28 ${monthAbbr} ${targetYear}`, startDay: 22, endDay: 28, income: 0, expense: 0 },
      ];

      if (daysInMonth > 28) {
        weeksConfig.push({
          label: `W5 (29-${daysInMonth} ${monthAbbr})`,
          fullLabel: `Week 5: 29 - ${daysInMonth} ${monthAbbr} ${targetYear}`,
          startDay: 29,
          endDay: daysInMonth,
          income: 0,
          expense: 0
        });
      }

      bills.forEach((b: any) => {
        if (b.status === 'CANCELLED' || b.status === 'HOLD') return;
        const bDate = new Date(b.createdAt || new Date());
        if (!isNaN(bDate.getTime()) && bDate.getFullYear() === targetYear && bDate.getMonth() === targetMonth) {
          const day = bDate.getDate();
          const wk = weeksConfig.find(w => day >= w.startDay && day <= w.endDay);
          if (wk) wk.income += Number(b.finalAmount || b.amountPaid || 0);
        }
      });

      expenses.forEach((e: any) => {
        const d = new Date(e.date || e.createdAt || new Date());
        if (!isNaN(d.getTime()) && d.getFullYear() === targetYear && d.getMonth() === targetMonth) {
          const day = d.getDate();
          const wk = weeksConfig.find(w => day >= w.startDay && day <= w.endDay);
          if (wk) wk.expense += Number(e.expense || e.amount || 0);
        }
      });

      const result = weeksConfig.map(w => ({
        label: w.label,
        fullLabel: w.fullLabel,
        income: w.income,
        expense: w.expense,
        net: w.income - w.expense
      }));
      setChartData(result);
    } else { // 'day'
      const dailyResult = [];
      for (let i = 1; i <= daysInMonth; i++) {
        const dayDate = new Date(targetYear, targetMonth, i);
        const dStr = format(dayDate, 'yyyy-MM-dd');
        const inc = dailyIncomeMap.get(dStr) || 0;
        const exp = dailyExpenseMap.get(dStr) || 0;

        dailyResult.push({
          label: `${i} ${monthAbbr}`,
          fullLabel: format(dayDate, 'dd MMMM yyyy (EEEE)'),
          income: inc,
          expense: exp,
          net: inc - exp
        });
      }
      setChartData(dailyResult);
    }
  }, [dashboardView, chartReferenceDate, bills, expenses, businessYears]);

  // Financial KPIs for the currently viewed period
  const periodKpis = useMemo(() => {
    const totalIncome = chartData.reduce((sum, d) => sum + (d.income || 0), 0);
    const totalExpense = chartData.reduce((sum, d) => sum + (d.expense || 0), 0);
    const netProfit = totalIncome - totalExpense;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    // Filter bills in activeRange for transaction counts
    const periodBills = bills.filter((b: any) => {
      if (b.status === 'CANCELLED' || b.status === 'HOLD') return false;
      const bDate = new Date(b.createdAt || new Date());
      return bDate >= activeRange.start && bDate <= activeRange.end;
    });

    const txCount = periodBills.length;
    const aov = txCount > 0 ? totalIncome / txCount : 0;

    // Payment methods
    const splitMap = { cash: 0, digital: 0 };
    periodBills.forEach((b: any) => {
      const method = (b.paymentMethod || 'Cash').toUpperCase();
      const amt = Number(b.finalAmount || b.amountPaid || 0);
      if (method.includes('CASH')) {
        splitMap.cash += amt;
      } else {
        splitMap.digital += amt;
      }
    });

    const cashPct = totalIncome > 0 ? (splitMap.cash / totalIncome) * 100 : 0;
    const digitalPct = totalIncome > 0 ? (splitMap.digital / totalIncome) * 100 : 0;

    return {
      totalIncome,
      totalExpense,
      netProfit,
      profitMargin,
      txCount,
      aov,
      cashPct,
      digitalPct
    };
  }, [chartData, bills, activeRange]);

  // Top Performing Staff (ranked by revenue & bill count)
  const topStaff = useMemo(() => {
    const staffMap = new Map<string, any>();

    (staff || []).forEach((s: any) => {
      if (!s.id) return;
      staffMap.set(s.id, {
        id: s.id,
        name: s.name || 'Staff Member',
        role: s.role || 'Sales Associate',
        phone: s.phone || '',
        invoicesCount: 0,
        unitsSold: 0,
        totalRevenue: 0,
        avgBillValue: 0
      });
    });

    // Attribute sales from period bills
    bills.forEach((b: any) => {
      if (b.status === 'CANCELLED' || b.status === 'HOLD') return;
      const bDate = new Date(b.createdAt || new Date());
      if (bDate < activeRange.start || bDate > activeRange.end) return;

      const sId = b.staffId;
      if (!sId) return;

      let entry = staffMap.get(sId);
      if (!entry) {
        entry = {
          id: sId,
          name: b.staffName || 'Staff Member',
          role: 'Sales Associate',
          phone: '',
          invoicesCount: 0,
          unitsSold: 0,
          totalRevenue: 0,
          avgBillValue: 0
        };
        staffMap.set(sId, entry);
      }

      const rev = Number(b.finalAmount || b.amountPaid || 0);
      const units = b.items?.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0) || 0;

      entry.invoicesCount += 1;
      entry.unitsSold += units;
      entry.totalRevenue += rev;
    });

    const list = Array.from(staffMap.values()).map(s => ({
      ...s,
      avgBillValue: s.invoicesCount > 0 ? s.totalRevenue / s.invoicesCount : 0
    }));

    return list
      .filter(s => s.invoicesCount > 0 || s.totalRevenue > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);
  }, [staff, bills, activeRange]);

  // Top Selling Products (ranked by volume & revenue)
  const topProducts = useMemo(() => {
    const prodMap = new Map<string, any>();

    // Prepopulate catalog
    (products || []).forEach((p: any) => {
      const key = p.id || p.name;
      if (!key) return;
      prodMap.set(key, {
        id: p.id || '',
        name: p.name || 'Unnamed Product',
        category: p.category || 'General',
        sellingPrice: Number(p.sellingPrice || p.price || 0),
        stock: Number(p.stockQuantity ?? p.stock ?? 0),
        unitsSold: 0,
        totalRevenue: 0
      });
    });

    bills.forEach((b: any) => {
      if (b.status === 'CANCELLED' || b.status === 'HOLD') return;
      const bDate = new Date(b.createdAt || new Date());
      if (bDate < activeRange.start || bDate > activeRange.end) return;

      (b.items || []).forEach((item: any) => {
        const key = item.productId || item.productName;
        if (!key) return;

        let entry = prodMap.get(key);
        if (!entry) {
          for (const val of prodMap.values()) {
            if (val.name.toLowerCase() === (item.productName || '').toLowerCase()) {
              entry = val;
              break;
            }
          }
        }

        const qty = Number(item.quantity || 0);
        const unitPrice = Number(item.unitPrice || 0);
        const total = Number(item.netAmount || (qty * unitPrice) || 0);

        if (!entry) {
          entry = {
            id: item.productId || 'N/A',
            name: item.productName || 'Unknown Product',
            category: 'General',
            sellingPrice: unitPrice,
            stock: 0,
            unitsSold: 0,
            totalRevenue: 0
          };
          prodMap.set(key, entry);
        }

        entry.unitsSold += qty;
        entry.totalRevenue += total;
      });
    });

    return Array.from(prodMap.values())
      .filter(p => p.unitsSold > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue || b.unitsSold - a.unitsSold)
      .slice(0, 5);
  }, [products, bills, activeRange]);

  // Today's Recent Transactions & Low Stock Alerts
  const todayBills = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return bills.filter((b: any) => {
      const bDate = new Date(b.createdAt || new Date());
      return format(bDate, 'yyyy-MM-dd') === todayStr && b.status !== 'CANCELLED' && b.status !== 'HOLD';
    });
  }, [bills]);

  const recentBills = todayBills.slice(0, 5);
  const lowStockProducts = (products || []).filter((p: any) => (p.stockQuantity ?? p.stock ?? 0) <= 5);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Header: Clean, Typography-Driven */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cashier Financial Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Real-time income, operating expenses, and sales metrics for Lingam Spares
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/cashier')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors active:scale-95"
          >
            <PlusCircle size={15} />
            <span>New Bill</span>
          </button>
          <button
            onClick={() => navigate('/cashier/products')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <Package size={15} />
            <span>Products</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: High-Signal, Type-Driven, Anti-Slop per taste-skill */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Gross Income */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Gross Revenue</span>
            <span className="text-emerald-600 font-bold text-[11px] bg-emerald-50 px-2 py-0.5 rounded-md">Income</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              ₹{periodKpis.totalIncome.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {periodKpis.txCount} completed {periodKpis.txCount === 1 ? 'sale' : 'sales'} in period
            </p>
          </div>
        </div>

        {/* KPI 2: Operating Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Operating Expenses</span>
            <span className="text-rose-600 font-bold text-[11px] bg-rose-50 px-2 py-0.5 rounded-md">Cost</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              ₹{periodKpis.totalExpense.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Daybook entries & vendor payables
            </p>
          </div>
        </div>

        {/* KPI 3: Net Operating Margin */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Net Margin</span>
            <span className={`font-bold text-[11px] px-2 py-0.5 rounded-md ${periodKpis.netProfit >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
              {periodKpis.profitMargin.toFixed(1)}%
            </span>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-bold font-mono tracking-tight ${periodKpis.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {periodKpis.netProfit >= 0 ? '+' : ''}₹{periodKpis.netProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Gross Income minus Total Expenses
            </p>
          </div>
        </div>

        {/* KPI 4: Average Order Value & Split */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Avg Order Value</span>
            <span className="text-blue-600 font-bold text-[11px] bg-blue-50 px-2 py-0.5 rounded-md">Ticket Size</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              ₹{periodKpis.aov.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 font-medium">
              <span>Cash: <strong className="text-slate-700">{periodKpis.cashPct.toFixed(0)}%</strong></span>
              <span>•</span>
              <span>Digital: <strong className="text-slate-700">{periodKpis.digitalPct.toFixed(0)}%</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Visual Representation: Income vs Expense with Time-Period Selector */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Controls Bar: Time Tabs & Navigation */}
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">{periodInfo.title}</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {dashboardView}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">{periodInfo.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Segmented Control */}
            <div className="flex p-1 bg-slate-200/70 rounded-xl text-xs font-semibold">
              {(['day', 'week', 'month', 'year'] as DashboardPeriod[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setDashboardView(period)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all duration-150 ${
                    dashboardView === period
                      ? 'bg-white text-slate-900 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {period === 'day' ? 'Days' : period === 'week' ? 'Weeks' : period === 'month' ? 'Month' : 'Year'}
                </button>
              ))}
            </div>

            {/* Date Navigation Buttons */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
              <button
                onClick={handlePrevPeriod}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                title="Previous Period"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleTodayPeriod}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Current
              </button>
              <button
                onClick={handleNextPeriod}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                title="Next Period"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Visual Chart Canvas */}
        <div className="p-5">
          <div className="h-[320px] w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-semibold text-slate-400">
                No financial transactions recorded for this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 15, right: 15, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    dx={-6}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        const inc = Number(item.income || 0);
                        const exp = Number(item.expense || 0);
                        const net = inc - exp;
                        return (
                          <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-xl text-xs space-y-1.5 min-w-[200px]">
                            <p className="font-bold text-slate-900 border-b border-slate-100 pb-1 text-xs">
                              {item.fullLabel || item.label}
                            </p>
                            <div className="flex justify-between items-center text-emerald-600 font-semibold">
                              <span>Income:</span>
                              <span className="font-mono">₹{inc.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-rose-500 font-semibold">
                              <span>Expenses:</span>
                              <span className="font-mono">₹{exp.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center font-bold pt-1 border-t border-slate-100">
                              <span className="text-slate-600">Net Profit:</span>
                              <span className={`font-mono ${net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {net >= 0 ? '+' : ''}₹{net.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '15px' }}
                    verticalAlign="bottom"
                    formatter={(val) => <span className="text-xs font-semibold text-slate-700 mr-4">{val}</span>}
                  />
                  <Bar dataKey="income" name="Income (Sales)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="expense" name="Operating Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Line type="monotone" dataKey="net" name="Net Margin" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3, fill: '#2563eb' }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Side-by-Side: Top Performing Staff & Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module 1: Top Performing Staff */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Top Performing Staff</h2>
              <p className="text-xs text-slate-500 font-medium">Ranked by revenue billed in active period</p>
            </div>
            <span className="text-xs font-bold text-slate-400 font-mono">Top 5</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="pb-2.5 text-center">Rank</th>
                  <th className="pb-2.5">Staff</th>
                  <th className="pb-2.5 text-center">Invoices</th>
                  <th className="pb-2.5 text-right">Revenue</th>
                  <th className="pb-2.5 text-right">Avg Ticket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topStaff.map((s, idx) => (
                  <tr key={s.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${
                        idx === 0 ? 'bg-amber-100 text-amber-900' :
                        idx === 1 ? 'bg-slate-200 text-slate-800' :
                        idx === 2 ? 'bg-orange-100 text-orange-900' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="font-semibold text-slate-900 text-xs">{s.name}</div>
                      <div className="text-[10px] text-slate-400">{s.role}</div>
                    </td>
                    <td className="py-3 text-center text-xs font-semibold text-slate-700">
                      {s.invoicesCount}
                    </td>
                    <td className="py-3 text-right text-xs font-bold font-mono text-slate-900">
                      ₹{s.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 text-right text-xs font-medium text-slate-600 font-mono">
                      ₹{s.avgBillValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
                {topStaff.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs font-semibold text-slate-400">
                      No staff sales recorded in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Module 2: Top Selling Products */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Top Selling Products</h2>
              <p className="text-xs text-slate-500 font-medium">Ranked by volume & revenue generated</p>
            </div>
            <span className="text-xs font-bold text-slate-400 font-mono">Top 5</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="pb-2.5 text-center">Rank</th>
                  <th className="pb-2.5">Product Name</th>
                  <th className="pb-2.5 text-center">Sold</th>
                  <th className="pb-2.5 text-right">Revenue</th>
                  <th className="pb-2.5 text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProducts.map((p, idx) => (
                  <tr key={p.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${
                        idx === 0 ? 'bg-amber-100 text-amber-900' :
                        idx === 1 ? 'bg-slate-200 text-slate-800' :
                        idx === 2 ? 'bg-orange-100 text-orange-900' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="font-semibold text-slate-900 text-xs truncate max-w-[180px]">{p.name}</div>
                      <div className="text-[10px] text-slate-400">{p.category}</div>
                    </td>
                    <td className="py-3 text-center text-xs font-semibold text-slate-700">
                      {p.unitsSold}
                    </td>
                    <td className="py-3 text-right text-xs font-bold font-mono text-slate-900">
                      ₹{p.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.stock <= 5 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {p.stock} left
                      </span>
                    </td>
                  </tr>
                ))}
                {topProducts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs font-semibold text-slate-400">
                      No product sales recorded in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Operational Section: Recent Register Activity & Stock Watch */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Transactions Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Today's Transactions</h2>
              <p className="text-xs text-slate-500 font-medium">{todayBills.length} invoices registered today</p>
            </div>
            <button
              onClick={() => navigate('/cashier/printed-bills')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
            >
              View All Bills →
            </button>
          </div>

          {recentBills.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="pb-2.5">Invoice #</th>
                    <th className="pb-2.5">Customer</th>
                    <th className="pb-2.5 text-right">Amount</th>
                    <th className="pb-2.5 text-right">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentBills.map((b: any) => (
                    <tr key={b.id} className="hover:bg-slate-50/60 transition-colors text-xs">
                      <td className="py-2.5 font-mono font-bold text-slate-700">#{b.id?.slice(-6) || 'BILL'}</td>
                      <td className="py-2.5 font-semibold text-slate-900">{b.customerName || 'Walk-in Customer'}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                        ₹{(b.finalAmount || b.amountPaid || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                          {b.paymentMethod || 'Cash'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs font-semibold text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No transactions recorded today yet.
            </div>
          )}
        </div>

        {/* Low Stock Watch */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                <span>Stock Watch</span>
              </h2>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                {lowStockProducts.length} Alert{lowStockProducts.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4 font-medium">
              Products with 5 or fewer items remaining in inventory.
            </p>

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto custom-scrollbar">
              {lowStockProducts.slice(0, 4).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl text-xs">
                  <div className="truncate max-w-[150px]">
                    <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-400">Stock: {p.stockQuantity ?? p.stock ?? 0} units</div>
                  </div>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md">
                    Low Stock
                  </span>
                </div>
              ))}
              {lowStockProducts.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400 font-semibold">
                  All inventory healthy. No low stock alerts.
                </div>
              )}
            </div>
          </div>

          {lowStockProducts.length > 0 && (
            <button
              onClick={() => setIsLowStockModalOpen(true)}
              className="w-full mt-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              View All Low Stock Items ({lowStockProducts.length})
            </button>
          )}
        </div>
      </div>

      <LowStockProductsModal
        isOpen={isLowStockModalOpen}
        onClose={() => setIsLowStockModalOpen(false)}
        lowStockProducts={lowStockProducts}
      />
    </div>
  );
};

export default CashierDashboard;
