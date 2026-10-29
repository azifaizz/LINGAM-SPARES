import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Package, AlertTriangle, Download, Users, Check, X, Pencil,
  UserCheck, Award, Briefcase, Phone, FileText, Search, Filter, Sparkles, ChevronRight, Eye, User, Trophy, Percent, Wallet,
  ChevronLeft, Calendar, RotateCcw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  format, subDays, addDays, startOfDay, endOfDay,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, addMonths, subMonths,
  addYears, subYears, addWeeks, subWeeks,
  getDaysInMonth, getYear, getMonth, isSameMonth,
  isSameYear, isSameDay
} from 'date-fns';
import { billingApi, productApi, daybookApi, Bill, Product, Vendor, DayBookEntry, Staff } from '@/lib/api';
import { useGlobalData } from '@/context/GlobalDataContext';
import LowStockProductsModal from './LowStockProductsModal';

type DashboardPeriod = 'day' | 'week' | 'month' | 'year';

const DashboardOverview = () => {
  const { toast } = useToast();
  const { bills = [], products = [], vendors = [], staff = [], refreshProducts } = useGlobalData() as any;
    const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dashboardView, setDashboardView] = useState<DashboardPeriod>('month');
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);

  // Raw data
  const [expenses, setExpenses] = useState<DayBookEntry[]>([]);
  const [totalExpenseAmount, setTotalExpenseAmount] = useState<number>(0);
  const [chartDataFetched, setChartDataFetched] = useState<any[]>([]);

  // Period Navigation State & Constants
  const [chartReferenceDate, setChartReferenceDate] = useState<Date>(new Date());

  const MONTHS_LIST = [
    { label: 'January', value: 0 },
    { label: 'February', value: 1 },
    { label: 'March', value: 2 },
    { label: 'April', value: 3 },
    { label: 'May', value: 4 },
    { label: 'June', value: 5 },
    { label: 'July', value: 6 },
    { label: 'August', value: 7 },
    { label: 'September', value: 8 },
    { label: 'October', value: 9 },
    { label: 'November', value: 10 },
    { label: 'December', value: 11 },
  ];

  // Dynamic business running years derived from bills and expenses
  const businessYears = useMemo(() => {
    const yearsSet = new Set<number>();
    const currentYear = new Date().getFullYear();
    // Default fallback window around current year
    yearsSet.add(currentYear - 2);
    yearsSet.add(currentYear - 1);
    yearsSet.add(currentYear);
    yearsSet.add(currentYear + 1);

    bills.forEach((b: any) => {
      if (b.status === 'CANCELLED' || b.status === 'HOLD') return;
      const d = new Date(b.createdAt || new Date());
      if (!isNaN(d.getTime())) {
        yearsSet.add(d.getFullYear());
      }
    });

    expenses.forEach((e: any) => {
      const dStr = e.date || e.createdAt;
      if (dStr) {
        const d = new Date(dStr);
        if (!isNaN(d.getTime())) {
          yearsSet.add(d.getFullYear());
        }
      }
    });

    const sorted = Array.from(yearsSet).sort((a, b) => a - b);
    const minYear = sorted[0];
    const maxYear = sorted[sorted.length - 1];
    const consecutive: number[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      consecutive.push(y);
    }
    return consecutive;
  }, [bills, expenses]);

  const handlePrevPeriod = () => {
    if (dashboardView === 'year') {
      setChartReferenceDate(prev => subYears(prev, 1));
    } else if (dashboardView === 'month') {
      setChartReferenceDate(prev => subYears(prev, 1));
    } else { // 'day' or 'week'
      setChartReferenceDate(prev => subMonths(prev, 1));
    }
  };

  const handleNextPeriod = () => {
    if (dashboardView === 'year') {
      setChartReferenceDate(prev => addYears(prev, 1));
    } else if (dashboardView === 'month') {
      setChartReferenceDate(prev => addYears(prev, 1));
    } else { // 'day' or 'week'
      setChartReferenceDate(prev => addMonths(prev, 1));
    }
  };

  const handleTodayPeriod = () => {
    setChartReferenceDate(new Date());
  };

  const handleMonthSelect = (monthIndex: number) => {
    const updated = new Date(chartReferenceDate);
    updated.setMonth(monthIndex);
    setChartReferenceDate(updated);
  };

  const handleYearSelect = (yearVal: number) => {
    const updated = new Date(chartReferenceDate);
    updated.setFullYear(yearVal);
    setChartReferenceDate(updated);
  };

  const isCurrentPeriod = useMemo(() => {
    const now = new Date();
    if (dashboardView === 'year') return true;
    if (dashboardView === 'month') return isSameYear(chartReferenceDate, now);
    return isSameMonth(chartReferenceDate, now) && isSameYear(chartReferenceDate, now);
  }, [chartReferenceDate, dashboardView]);

  const chartActiveRange = useMemo(() => {
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

  const { periodTitle, periodBadge, periodSubtitle } = useMemo(() => {
    const yearStr = format(chartReferenceDate, 'yyyy');
    const monthStr = format(chartReferenceDate, 'MMMM');
    const daysCount = getDaysInMonth(chartReferenceDate);

    if (dashboardView === 'year') {
      const minYear = businessYears[0];
      const maxYear = businessYears[businessYears.length - 1];
      return {
        periodTitle: `${minYear} – ${maxYear}`,
        periodBadge: `${businessYears.length} Years`,
        periodSubtitle: `Multi-year business running performance (${businessYears.join(', ')})`
      };
    }
    if (dashboardView === 'month') {
      return {
        periodTitle: `Year ${yearStr}`,
        periodBadge: '12 Months',
        periodSubtitle: `Monthly breakdown of ${yearStr} (Jan – Dec)`
      };
    }
    if (dashboardView === 'week') {
      const weeksCount = daysCount > 28 ? 5 : 4;
      return {
        periodTitle: `${monthStr} ${yearStr}`,
        periodBadge: `${weeksCount} Weeks`,
        periodSubtitle: `Weekly breakdown of ${monthStr} ${yearStr} (W1 – W${weeksCount})`
      };
    }
    // 'day'
    return {
      periodTitle: `${monthStr} ${yearStr}`,
      periodBadge: `${daysCount} Days`,
      periodSubtitle: `Daily breakdown of ${monthStr} ${yearStr} (Day 1 – ${daysCount})`
    };
  }, [chartReferenceDate, dashboardView, businessYears]);

  // Staff Performance UI state
  const [selectedStaffDetails, setSelectedStaffDetails] = useState<any | null>(null);

  // Products UI state
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductCategory, setSelectedProductCategory] = useState("ALL");



  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const daybookRes = await daybookApi.getSummary(format(new Date(), 'yyyy-MM-dd'));
        if (daybookRes.data && daybookRes.data.entries) {
          setExpenses(daybookRes.data.entries.filter((e: any) => e.type === 'EXPENSE'));
        }
        
      } catch (error) {
        console.warn("DayBook summary unavailable, continuing with bills data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  // Filter bills based on time range (Global for charts)
  const dateFilteredBills = useMemo(() => {
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));

    return bills.filter(bill => {
      if (bill.status === 'CANCELLED' || bill.status === 'HOLD') return false;
      const billDate = new Date(bill.createdAt || new Date());
      return billDate >= start && billDate <= end;
    });
  }, [bills, startDate, endDate]);

const filteredBills = dateFilteredBills;

const filteredProducts = products;

  // Helper to aggregate chart data with dynamic calendar days & accurate date ranges
  const aggregateChartData = (view: DashboardPeriod, rawData: any[], refDate: Date = chartReferenceDate) => {
    const targetYear = getYear(refDate);
    const targetMonth = getMonth(refDate);
    const monthAbbr = format(refDate, 'MMM');
    const daysInMonth = getDaysInMonth(refDate);

    if (view === 'year') {
      // Show all business running years (e.g. 2024, 2025, 2026, 2027)
      const yearlyAgg: Record<number, { income: number; expense: number }> = {};
      businessYears.forEach(y => {
        yearlyAgg[y] = { income: 0, expense: 0 };
      });

      rawData.forEach((d: any) => {
        const dDate = new Date(d.date);
        if (!isNaN(dDate.getTime())) {
          const y = getYear(dDate);
          if (yearlyAgg[y]) {
            yearlyAgg[y].income += (d.income || 0);
            yearlyAgg[y].expense += (d.expense || 0);
          }
        }
      });

      return businessYears.map(y => ({
        date: y.toString(),
        fullDate: `Year ${y}`,
        income: yearlyAgg[y].income,
        expense: yearlyAgg[y].expense
      }));
    } else if (view === 'month') {
      // Show monthly details (Jan, Feb, Mar, ..., Dec) for the selected year
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const fullMonthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const monthlyAgg: Record<number, { income: number; expense: number }> = {};
      for (let m = 0; m < 12; m++) {
        monthlyAgg[m] = { income: 0, expense: 0 };
      }

      rawData.forEach((d: any) => {
        const dDate = new Date(d.date);
        if (!isNaN(dDate.getTime()) && getYear(dDate) === targetYear) {
          const mIdx = dDate.getMonth();
          if (monthlyAgg[mIdx]) {
            monthlyAgg[mIdx].income += (d.income || 0);
            monthlyAgg[mIdx].expense += (d.expense || 0);
          }
        }
      });

      return months.map((m, idx) => ({
        date: m,
        fullDate: `${fullMonthNames[idx]} ${targetYear}`,
        income: monthlyAgg[idx].income,
        expense: monthlyAgg[idx].expense
      }));
    } else if (view === 'week') {
      // Show weekly details for the selected month (W1, W2, W3, W4, W5)
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

      rawData.forEach((d: any) => {
        const dDate = new Date(d.date);
        if (!isNaN(dDate.getTime()) && getYear(dDate) === targetYear && getMonth(dDate) === targetMonth) {
          const dayNum = dDate.getDate();
          const targetWk = weeksConfig.find(w => dayNum >= w.startDay && dayNum <= w.endDay);
          if (targetWk) {
            targetWk.income += (d.income || 0);
            targetWk.expense += (d.expense || 0);
          }
        }
      });

      return weeksConfig.map(w => ({
        date: w.label,
        fullDate: w.fullLabel,
        income: w.income,
        expense: w.expense
      }));
    } else { // 'day'
      // Show daily details (Day 1 to daysInMonth) for the selected month
      const dataMap = new Map<number, { income: number; expense: number }>();

      rawData.forEach((d: any) => {
        const dDate = new Date(d.date);
        if (!isNaN(dDate.getTime()) && getYear(dDate) === targetYear && getMonth(dDate) === targetMonth) {
          const dayNum = dDate.getDate();
          const curr = dataMap.get(dayNum) || { income: 0, expense: 0 };
          curr.income += (d.income || 0);
          curr.expense += (d.expense || 0);
          dataMap.set(dayNum, curr);
        }
      });

      const fullMonthData = [];
      for (let i = 1; i <= daysInMonth; i++) {
        const dayData = dataMap.get(i);
        const dayDate = new Date(targetYear, targetMonth, i);
        fullMonthData.push({
          date: i.toString(),
          fullDate: format(dayDate, 'dd MMMM yyyy (EEEE)'),
          displayLabel: `${i} ${monthAbbr}`,
          income: dayData?.income || 0,
          expense: dayData?.expense || 0
        });
      }
      return fullMonthData;
    }
  };

  const [allPeriodsData, setAllPeriodsData] = useState<Record<DashboardPeriod, any[]>>({
    day: [], week: [], month: [], year: []
  });

  useEffect(() => {
    const fetchChartData = async () => {
      let rawData: any[] = [];
      let totalExp = 0;

      const rangeStartStr = format(chartActiveRange.start, 'yyyy-MM-dd');
      const rangeEndStr = format(chartActiveRange.end, 'yyyy-MM-dd');

      try {
        const res = await daybookApi.getRange(rangeStartStr, rangeEndStr);
        rawData = res.data?.chartData || res.data?.dailyBreakdown || [];
        totalExp = res.data?.totalExpense !== undefined 
          ? res.data.totalExpense 
          : rawData.reduce((sum: number, d: any) => sum + (d.expense || 0), 0);
      } catch (err) {
        // Fallback: Compute chart data directly from bills and expenses
        const rangeStart = startOfDay(chartActiveRange.start);
        const rangeEnd = endOfDay(chartActiveRange.end);

        const dailyMap = new Map<string, { date: string; income: number; expense: number }>();

        bills.forEach((b: any) => {
          if (b.status === 'CANCELLED' || b.status === 'HOLD') return;
          const bDate = new Date(b.createdAt || new Date());
          if (bDate >= rangeStart && bDate <= rangeEnd) {
            const d = format(bDate, 'yyyy-MM-dd');
            const amt = Number(b.finalAmount || b.amountPaid || 0);
            const curr = dailyMap.get(d) || { date: d, income: 0, expense: 0 };
            curr.income += amt;
            dailyMap.set(d, curr);
          }
        });

        expenses.forEach((e: any) => {
          const dateStr = e.date || e.createdAt;
          if (!dateStr) return;
          const eDate = new Date(dateStr);
          if (!isNaN(eDate.getTime()) && eDate >= rangeStart && eDate <= rangeEnd) {
            const d = format(eDate, 'yyyy-MM-dd');
            const amt = Number(e.amount || 0);
            totalExp += amt;
            const curr = dailyMap.get(d) || { date: d, income: 0, expense: 0 };
            curr.expense += amt;
            dailyMap.set(d, curr);
          }
        });

        rawData = Array.from(dailyMap.values());
      }

      setTotalExpenseAmount(totalExp);

      const dayData = aggregateChartData('day', rawData, chartReferenceDate);
      const weekData = aggregateChartData('week', rawData, chartReferenceDate);
      const monthData = aggregateChartData('month', rawData, chartReferenceDate);
      const yearData = aggregateChartData('year', rawData, chartReferenceDate);

      setAllPeriodsData({ day: dayData, week: weekData, month: monthData, year: yearData });

      // Update the main chart view
      if (dashboardView === 'day') setChartDataFetched(dayData);
      else if (dashboardView === 'week') setChartDataFetched(weekData);
      else if (dashboardView === 'month') setChartDataFetched(monthData);
      else if (dashboardView === 'year') setChartDataFetched(yearData);
    };

    fetchChartData();
  }, [dashboardView, chartReferenceDate, chartActiveRange, bills, expenses, businessYears]);



  // KPIs
  const { totalRevenue, totalTransactions, totalProfit, totalCOGS } = useMemo(() => {
    let rev = 0;
    let profit = 0;
    let cogs = 0;

    // Create a product map for quick lookup using ALL products
    const combinedProducts = products;
    const productMap = new Map(combinedProducts.map(p => [p.name, p]));
    const productIdMap = new Map(combinedProducts.map(p => [p.id, p]));

    filteredBills.forEach(bill => {
      const finalAmt = bill.finalAmount || bill.amountPaid || 0;
      rev += finalAmt;

      // Estimate profit and COGS
      let billCost = 0;
      bill.items?.forEach(item => {
        const prod = productIdMap.get(item.productId) || productMap.get(item.productName);
        if (prod) {
          billCost += (prod.purchaseRate || 0) * item.quantity;
        } else {
          // rough estimate if product not found (30% margin)
          billCost += item.unitPrice * item.quantity * 0.7;
        }
      });
      cogs += billCost;
      profit += (finalAmt - billCost);
    });

    return {
      totalRevenue: rev,
      totalTransactions: filteredBills.length,
      totalProfit: Math.abs(profit) < 0.01 ? 0 : profit,
      totalCOGS: Math.abs(cogs) < 0.01 ? 0 : cogs
    };
  }, [filteredBills, filteredProducts]);

  // Transaction Stats for Dropdown
  const txStats = useMemo(() => {
    let upi = 0, cash = 0, card = 0, split = 0, partial = 0;
    filteredBills.forEach(b => {
      const method = (b.paymentMethod || 'Cash').toLowerCase();
      if (method.includes('upi') || method.includes('online')) upi++;
      else if (method.includes('split') || method.includes('mixed')) split++;
      else if (method.includes('card')) card++;
      else if (method.includes('partial')) partial++;
      else cash++;
    });
    return { upi, cash, card, split, partial };
  }, [filteredBills]);

  // Staff Performance Analytics
  const staffPerformance = useMemo(() => {
    const staffMap = new Map<string, any>();

    // 1. Pre-populate strictly with all registered staff from database
    (staff || []).forEach((s: any) => {
      const id = s.id || '';
      if (!id) return;
      staffMap.set(id, {
        id,
        name: s.name || s.id,
        role: s.role || 'Staff Member',
        phone: s.phone || 'N/A',
        profilePicUrl: s.profilePicUrl,
        active: s.active ?? s.isActive ?? true,
        baseSalary: s.baseSalary || 0,
        invoicesCount: 0,
        itemsSold: 0,
        totalRevenue: 0,
        totalCommission: 0,
        paidCommission: 0,
        unpaidCommission: 0,
        avgBillValue: 0,
        bills: []
      });
    });

    // 2. Iterate filteredBills and attribute strictly to registered staff
    filteredBills.forEach((bill: any) => {
      if (bill.status === 'CANCELLED' || bill.status === 'HOLD') return;

      const staffId = bill.staffId;
      if (!staffId) return;

      const entry = staffMap.get(staffId);
      if (!entry) return;

      const billRev = bill.finalAmount || bill.amountPaid || 0;
      const units = bill.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;

      // Commission calculation: direct staffCommissionAmount or from percentage
      let commAmt = 0;
      if (bill.staffCommissionAmount !== undefined && bill.staffCommissionAmount !== null && Number(bill.staffCommissionAmount) > 0) {
        commAmt = Number(bill.staffCommissionAmount);
      } else if (bill.staffCommissionPercentage !== undefined && bill.staffCommissionPercentage !== null && Number(bill.staffCommissionPercentage) > 0) {
        commAmt = (billRev * Number(bill.staffCommissionPercentage)) / 100;
      }

      entry.invoicesCount += 1;
      entry.itemsSold += units;
      entry.totalRevenue += billRev;
      entry.totalCommission += commAmt;
      if (bill.staffCommissionStatus === 'PAID') {
        entry.paidCommission += commAmt;
      } else {
        entry.unpaidCommission += commAmt;
      }
      entry.bills.push(bill);
    });

    // 3. Compute average bill value & sort by revenue
    const list = Array.from(staffMap.values()).map(item => ({
      ...item,
      avgBillValue: item.invoicesCount > 0 ? item.totalRevenue / item.invoicesCount : 0
    }));

    return list.sort((a, b) => b.totalRevenue - a.totalRevenue || b.invoicesCount - a.invoicesCount);
  }, [staff, filteredBills]);

  const top5Staff = useMemo(() => {
    return staffPerformance
      .filter(s => s.invoicesCount > 0 || s.totalRevenue > 0)
      .slice(0, 5);
  }, [staffPerformance]);

  const totalStaffRevenue = useMemo(() => {
    return staffPerformance.reduce((acc, s) => acc + s.totalRevenue, 0);
  }, [staffPerformance]);

  // Product Performance Analytics
  const productPerformance = useMemo(() => {
    const prodMap = new Map<string, any>();

    // Pre-populate with catalog products
    (products || []).forEach((p: any) => {
      const key = p.id || p.name;
      if (!key) return;
      prodMap.set(key, {
        id: p.id || '',
        name: p.name || 'Unnamed Product',
        category: p.category || 'General',
        sellingPrice: Number(p.sellingPrice || p.price || 0),
        purchaseRate: Number(p.purchaseRate || 0),
        stock: Number(p.stockQuantity ?? p.stock ?? 0),
        vendorName: p.vendorName || p.weaverName || 'N/A',
        barcode: p.barcode || '',
        unitsSold: 0,
        invoicesCount: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        profitMargin: 0
      });
    });

    // Attribute sales from filtered bills
    filteredBills.forEach((bill: any) => {
      if (bill.status === 'CANCELLED' || bill.status === 'HOLD') return;

      const seenProductsInBill = new Set<string>();

      (bill.items || []).forEach((item: any) => {
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
        const itemTotal = Number(item.netAmount || (qty * unitPrice) || 0);
        const itemCost = entry ? (entry.purchaseRate * qty) : (Number(item.purchaseRate || 0) * qty || (itemTotal * 0.7));

        if (!entry) {
          entry = {
            id: item.productId || 'N/A',
            name: item.productName || 'Unknown Product',
            category: 'General',
            sellingPrice: unitPrice,
            purchaseRate: Number(item.purchaseRate || 0),
            stock: 0,
            vendorName: 'N/A',
            barcode: '',
            unitsSold: 0,
            invoicesCount: 0,
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0,
            profitMargin: 0
          };
          prodMap.set(key, entry);
        }

        entry.unitsSold += qty;
        entry.totalRevenue += itemTotal;
        entry.totalCost += itemCost;

        if (!seenProductsInBill.has(entry.name || key)) {
          entry.invoicesCount += 1;
          seenProductsInBill.add(entry.name || key);
        }
      });
    });

    const list = Array.from(prodMap.values()).map(p => {
      const profit = p.totalRevenue - p.totalCost;
      const margin = p.totalRevenue > 0 ? (profit / p.totalRevenue) * 100 : 0;
      return {
        ...p,
        totalProfit: Math.max(0, profit),
        profitMargin: Math.max(0, margin)
      };
    });

    return list.sort((a, b) => b.totalRevenue - a.totalRevenue || b.unitsSold - a.unitsSold);
  }, [products, filteredBills]);

  const availableProductCategories = useMemo(() => {
    const cats = new Set<string>();
    productPerformance.forEach(p => {
      if (p.category && p.category !== 'General') cats.add(p.category);
    });
    return Array.from(cats);
  }, [productPerformance]);

  const filteredProductsList = useMemo(() => {
    return productPerformance
      .filter(p => p.unitsSold > 0 || p.totalRevenue > 0)
      .filter(p => {
        const q = productSearch.toLowerCase();
        const matchesQuery = p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q);
        const matchesCat = selectedProductCategory === 'ALL' || p.category === selectedProductCategory;
        return matchesQuery && matchesCat;
      });
  }, [productPerformance, productSearch, selectedProductCategory]);

  const totalProductSales = useMemo(() => {
    return productPerformance.reduce((acc, p) => acc + p.totalRevenue, 0);
  }, [productPerformance]);

  const totalProductsSold = useMemo(() => {
    return productPerformance.reduce((acc, p) => acc + p.unitsSold, 0);
  }, [productPerformance]);

  // Keep lowStockProducts independent of productPerformance
  const lowStockProducts = useMemo(() => {
    return (products || []).filter((p: any) => {
      const stock = p.stockQuantity ?? p.stock ?? 0;
      return Number(stock) <= 5;
    }).map((p: any) => ({
      id: p.id || '',
      name: p.name || 'Unnamed',
      category: p.category || 'N/A',
      vendorName: p.vendorName || p.weaverName || 'N/A',
      vendorId: p.vendorId || p.weaverId || 'N/A',
      purchaseRate: p.purchaseRate || 0,
      sellingPrice: p.sellingPrice || 0,
      stock: p.stockQuantity ?? p.stock ?? 0,
      purchaseDate: p.purchaseDate || p.createdAt || '',
      qtySold: 0
    }));
  }, [products]);



  // Helper to calculate pie data
  const getPieDataForRange = (start: Date, end: Date, overrideExpense?: number) => {
    let revenue = 0;
    let cogs = 0;

    const filteredRangeBills = bills.filter(bill => {
      if (bill.status === 'CANCELLED' || bill.status === 'HOLD') return false;
      const billDate = new Date(bill.createdAt || new Date());
      return billDate >= start && billDate <= end;
    });

    const combinedProducts = products;
    const productMap = new Map(combinedProducts.map(p => [p.name, p]));
    const productIdMap = new Map(combinedProducts.map(p => [p.id, p]));

    filteredRangeBills.forEach(bill => {
      revenue += (bill.finalAmount || bill.amountPaid || 0);
      bill.items?.forEach(item => {
        const prod = productIdMap.get(item.productId) || productMap.get(item.productName);
        cogs += prod ? ((prod.purchaseRate || 0) * item.quantity) : (item.unitPrice * item.quantity * 0.7);
      });
    });

    const filteredRangeExpenses = expenses.filter((entry: any) => {
      const dateStr = entry.date || entry.createdAt;
      if (!dateStr) return false;
      const expenseDate = new Date(dateStr);
      return !isNaN(expenseDate.getTime()) && expenseDate >= start && expenseDate <= end;
    });

    const profit = revenue - cogs;
    const expenseAmount = overrideExpense !== undefined ? overrideExpense : filteredRangeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    return [
      { name: 'Revenue', value: revenue, color: '#3b82f6' },
      { name: 'Profit', value: profit, color: '#10b981' },
      { name: 'Cost of Goods', value: cogs, color: '#facc15' },
      { name: 'Expenses', value: expenseAmount, color: '#ef4444' }
    ];
  };

  const pieData = useMemo(() => {
    return getPieDataForRange(startOfDay(chartActiveRange.start), endOfDay(chartActiveRange.end));
  }, [bills, expenses, products, chartActiveRange]);

  const allPieData = useMemo(() => {
    const now = new Date();
    return {
      day: getPieDataForRange(startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 })),
      week: getPieDataForRange(startOfMonth(now), endOfMonth(now)),
      month: getPieDataForRange(startOfMonth(now), endOfMonth(now)),
      year: getPieDataForRange(startOfYear(now), endOfYear(now))
    };
  }, [bills, expenses, products]);



  const handleDownloadReport = async () => {
    const element = document.getElementById("report-container");
    if (!element) return;

    // Temporarily make it visible for capture (off-screen)
    element.style.display = "block";
    element.style.position = "absolute";
    element.style.left = "-9999px";
    element.style.top = "0";

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 1200 // Ensure consistent width for report
    });

    element.style.display = "none";

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const imgWidth = 210;
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`Business_Dashboard_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);

    toast({ title: "Success", description: "Report downloaded successfully" });
  };

  // Helper to aggregate data for report
  const getReportData = () => {
    // Current date range stats
    const reportKpis = [
      { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}` },
      { label: 'Total Profit', value: `₹${totalProfit.toLocaleString()}` },
      { label: 'Total Expense', value: `₹${totalExpenseAmount.toLocaleString()}` },
      { label: 'Total Transactions', value: totalTransactions },
      { label: 'Low Stock Count', value: lowStockProducts.length }
    ];

    // Top 5 Staff for report
    const topStaffReport = staffPerformance
      .filter(s => s.invoicesCount > 0 || s.totalRevenue > 0)
      .slice(0, 5)
      .map((s, i) => ({
      rank: i + 1,
      staffId: s.id,
      name: s.name,
      role: s.role,
      phone: s.phone,
      invoices: s.invoicesCount,
      unitsSold: s.itemsSold,
      revenue: `₹${s.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      commission: `₹${s.totalCommission.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      avgBill: `₹${s.avgBillValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    }));

    // Top 5 Products for report
    const topProductsReport = productPerformance
      .filter(p => p.unitsSold > 0 || p.totalRevenue > 0)
      .slice(0, 5)
      .map((p, i) => ({
        rank: i + 1,
        productId: p.id,
        name: p.name,
        category: p.category,
        unitsSold: p.unitsSold,
        sellingPrice: `₹${p.sellingPrice.toLocaleString()}`,
        revenue: `₹${p.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        profit: `₹${p.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        stock: p.stock
      }));

    return { reportKpis, topStaffReport, topProductsReport };
  };

  const { reportKpis, topStaffReport, topProductsReport } = getReportData();

  if (loading && totalRevenue === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-full space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Business performance and analytics</p>
        </div>
        <div className="flex gap-4 items-center">


          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-slate-200 rounded-lg text-xs bg-slate-50 focus:ring-blue-500 px-3 py-1.5 border outline-none font-bold"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-slate-200 rounded-lg text-xs bg-slate-50 focus:ring-blue-500 px-3 py-1.5 border outline-none font-bold"
              />
            </div>
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Download size={16} /> Download Report
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Revenue */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Revenue</p>
            <h3 className="text-xl font-bold text-slate-800">₹{totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
          </div>
          <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
            <DollarSign size={18} />
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Profit</p>
            <h3 className="text-xl font-bold text-slate-800">₹{totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
          </div>
          <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
            <TrendingUp size={18} />
          </div>
        </div>

        {/* Total Expense */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Expense</p>
            <h3 className="text-xl font-bold text-slate-800">₹{totalExpenseAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
          </div>
          <div className="w-9 h-9 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
            <TrendingDown size={18} />
          </div>
        </div>

        {/* Mode of Transactions */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm hover:shadow-md transition">
          <div className="flex items-start justify-between mb-1">
            <p className="text-xs font-medium text-slate-500">Transactions</p>
            <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
              <ShoppingCart size={18} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <div className="flex items-center justify-between text-xs text-slate-600"><span>UPI:</span> <span className="font-bold">{txStats.upi}</span></div>
            <div className="flex items-center justify-between text-xs text-slate-600"><span>Cash:</span> <span className="font-bold">{txStats.cash}</span></div>
            <div className="flex items-center justify-between text-xs text-slate-600"><span>Card:</span> <span className="font-bold">{txStats.card}</span></div>
            <div className="flex items-center justify-between text-xs text-slate-600"><span>Split:</span> <span className="font-bold">{txStats.split}</span></div>
            <div className="flex items-center justify-between text-xs text-purple-600 font-bold"><span>Partial:</span> <span className="font-bold">{txStats.partial}</span></div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div
          className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition cursor-pointer"
          onClick={() => setIsLowStockModalOpen(true)}
        >
          <div>
            <p className="text-xs font-medium text-slate-500">Low Stock</p>
            <h3 className="text-xl font-bold text-slate-800">
              {lowStockProducts.length}
            </h3>
          </div>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${(lowStockProducts.length) > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle size={18} />
          </div>
        </div>
      </div>

      <LowStockProductsModal
        isOpen={isLowStockModalOpen}
        onClose={() => setIsLowStockModalOpen(false)}
        lowStockProducts={lowStockProducts}
      />

      {/* Unified Financial Analytics Container */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden mb-6">
        {/* Header: Period Navigator & View Toggles */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-slate-50/60">
          {/* Left: Interactive Period Navigator */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Prev Button */}
            {dashboardView !== 'year' && (
              <button
                onClick={handlePrevPeriod}
                className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all hover:scale-105 active:scale-95 shadow-2xs cursor-pointer"
                title={`Previous ${dashboardView}`}
                aria-label={`Previous ${dashboardView}`}
              >
                <ChevronLeft size={16} />
              </button>
            )}

            {/* Period Title & Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
              <Calendar size={15} className="text-blue-600" />
              <span className="font-bold text-slate-800 text-sm tracking-tight">{periodTitle}</span>
              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                {periodBadge}
              </span>
            </div>

            {/* Next Button */}
            {dashboardView !== 'year' && (
              <button
                onClick={handleNextPeriod}
                className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all hover:scale-105 active:scale-95 shadow-2xs cursor-pointer"
                title={`Next ${dashboardView}`}
                aria-label={`Next ${dashboardView}`}
              >
                <ChevronRight size={16} />
              </button>
            )}

            {/* "Today" Jump Button (shown if not currently on current period) */}
            {!isCurrentPeriod && (
              <button
                onClick={handleTodayPeriod}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                title="Jump to current date"
              >
                <RotateCcw size={13} />
                <span>Current</span>
              </button>
            )}

            {/* Quick Selectors for Month and Year */}
            <div className="flex items-center gap-1.5 sm:ml-1">
              {(dashboardView === 'day' || dashboardView === 'week') && (
                <select
                  value={getMonth(chartReferenceDate)}
                  onChange={(e) => handleMonthSelect(Number(e.target.value))}
                  className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:bg-slate-50 transition-colors"
                  title="Select month"
                >
                  {MONTHS_LIST.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              )}

              {dashboardView !== 'year' && (
                <select
                  value={getYear(chartReferenceDate)}
                  onChange={(e) => handleYearSelect(Number(e.target.value))}
                  className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:bg-slate-50 transition-colors"
                  title="Select year"
                >
                  {businessYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Right: Period View Toggles (DAY / WEEK / MONTH / YEAR) */}
          <div className="flex items-center self-end md:self-auto bg-slate-200/70 p-1 rounded-xl border border-slate-200 gap-1">
            {(['day', 'week', 'month', 'year'] as const).map(view => (
              <button
                key={view}
                onClick={() => setDashboardView(view)}
                className={`px-3.5 py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${dashboardView === view ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {view.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Combined Charts Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          {/* Section 1: Income vs Expenses */}
          <div className="p-6 lg:col-span-2 flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Income vs Expenses</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{periodSubtitle}</p>
              </div>
              <div className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
                {dashboardView.toUpperCase()} VIEW
              </div>
            </div>

            <div className="h-[300px]">
              {chartDataFetched.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 font-medium">
                  No transactions for {periodTitle}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataFetched} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: dashboardView === 'day' ? 10 : 11 }}
                      dy={10}
                      angle={dashboardView === 'day' ? -45 : dashboardView === 'week' ? -20 : 0}
                      textAnchor={dashboardView === 'day' || dashboardView === 'week' ? 'end' : 'middle'}
                      height={dashboardView === 'day' ? 50 : dashboardView === 'week' ? 45 : 35}
                      interval={0}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                      dx={-10}
                    />
                    <RechartsTooltip
                      cursor={{ fill: '#f8fafc' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const inc = Number(data.income || 0);
                          const exp = Number(data.expense || 0);
                          const net = inc - exp;
                          return (
                            <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-xl text-xs space-y-1.5 min-w-[190px]">
                              <p className="font-bold text-slate-800 border-b border-slate-100 pb-1.5 text-xs">
                                {data.fullDate || data.date}
                              </p>
                              <div className="flex justify-between items-center text-emerald-600 font-semibold">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Income:
                                </span>
                                <span>₹{inc.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center text-rose-500 font-semibold">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> Expenses:
                                </span>
                                <span>₹{exp.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center font-bold pt-1.5 border-t border-slate-100 text-xs">
                                <span className="text-slate-600">Net:</span>
                                <span className={net >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                  {net >= 0 ? '+' : ''}₹{net.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} verticalAlign="top" />
                    <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Section 2: Revenue Distribution */}
          <div className="p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Revenue Distribution</h3>
                <p className="text-xs text-slate-400 font-medium">Synced with {periodTitle}</p>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <span className="text-[10px] font-black text-blue-600 px-2 py-1 bg-white rounded shadow-xs">SYNCED VIEW</span>
              </div>
            </div>
            <div className="h-[300px] flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={65} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 10px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="bottom" height={40} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Performance Leaderboard */}
      <div className="grid grid-cols-1 gap-6">

        {/* Top Performing Staff Table */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <div>
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Award size={22} className="text-amber-500" />
                Top Performing Staff Leaderboard
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Staff ranked by sales revenue and bills handled in selected period
              </p>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[420px] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50">
                  <th className="p-3 font-bold text-center">Rank</th>
                  <th className="p-3 font-bold">Staff Member</th>
                  <th className="p-3 font-bold">Role</th>
                  <th className="p-3 font-bold">Contact</th>
                  <th className="p-3 font-bold text-center">Invoices Handled</th>
                  <th className="p-3 font-bold text-center">Units Sold</th>
                  <th className="p-3 font-bold whitespace-nowrap">Sales Revenue</th>
                  <th className="p-3 font-bold whitespace-nowrap">Commission</th>
                  <th className="p-3 font-bold whitespace-nowrap">Avg Invoice</th>
                  <th className="p-3 font-bold text-center">Revenue Share</th>
                  <th className="p-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {top5Staff.map((s, i) => {
                  const badge = `#${i + 1}`;

                  let badgeClasses = "inline-flex items-center justify-center font-black px-2.5 py-1 rounded-full shadow-sm text-xs whitespace-nowrap border ";
                  if (i === 0) badgeClasses += "bg-amber-100 text-amber-900 border-amber-300";
                  else if (i === 1) badgeClasses += "bg-slate-200 text-slate-800 border-slate-300";
                  else if (i === 2) badgeClasses += "bg-orange-100 text-orange-900 border-orange-300";
                  else badgeClasses += "bg-slate-50 text-slate-600 border-slate-200";

                  const isTop3 = i < 3;
                  const sharePct = totalStaffRevenue > 0 ? (s.totalRevenue / totalStaffRevenue) * 100 : 0;

                  return (
                    <tr
                      key={s.id || i}
                      onClick={() => setSelectedStaffDetails(s)}
                      className={`group cursor-pointer transition-colors ${isTop3 ? 'bg-amber-50/20 hover:bg-amber-50/60' : 'hover:bg-slate-50/50'}`}
                    >
                      <td className="p-3 text-center">
                        <span className={badgeClasses} title={`Rank ${i + 1}`}>
                          {badge}
                        </span>
                      </td>
                      <td className="p-3 min-w-[180px]">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold flex items-center justify-center text-xs shadow-sm flex-shrink-0 overflow-hidden">
                            {s.profilePicUrl ? (
                              <img src={s.profilePicUrl} alt={s.name} className="w-full h-full object-cover" />
                            ) : (
                              s.name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-black text-slate-800 text-sm leading-tight group-hover:text-blue-600 transition-colors">
                              {s.name}
                            </p>
                            <p className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">
                              ID: {s.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {s.role}
                        </span>
                      </td>
                      <td className="p-3 text-xs font-bold text-slate-500 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Phone size={12} className="text-slate-400" />
                          {s.phone}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100/60 inline-block">
                          {s.invoicesCount} Bills
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg inline-block">
                          {s.itemsSold}
                        </span>
                      </td>
                      <td className="p-3 text-sm font-black text-slate-900 whitespace-nowrap">
                        ₹{s.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-xs font-bold whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-1 rounded-lg text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold">
                          ₹{s.totalCommission.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-3 text-xs font-bold text-slate-600 whitespace-nowrap">
                        ₹{s.avgBillValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, sharePct))}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-slate-600">{sharePct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedStaffDetails(s)}
                          className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <Eye size={13} />
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {top5Staff.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400 font-medium">
                      No staff performance data recorded for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

            {/* Top Selling Products Leaderboard */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <div>
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Package size={22} className="text-blue-600" />
                Top Selling Products
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Highest velocity inventory ranked by revenue and units sold in selected period
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400 font-mono">Top 5 Products</span>
          </div>

          <div className="overflow-x-auto max-h-[420px] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50">
                  <th className="p-3 font-bold text-center">Rank</th>
                  <th className="p-3 font-bold">Product Name</th>
                  <th className="p-3 font-bold">Category</th>
                  <th className="p-3 font-bold text-center">Units Sold</th>
                  <th className="p-3 font-bold text-right">Selling Price</th>
                  <th className="p-3 font-bold text-right">Total Revenue</th>
                  <th className="p-3 font-bold text-right">Estimated Profit</th>
                  <th className="p-3 font-bold text-center">Inventory Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productPerformance.filter(p => p.unitsSold > 0).slice(0, 5).map((p, i) => (
                  <tr key={p.id || i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center justify-center font-bold w-6 h-6 rounded-full text-xs ${
                        i === 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                        i === 1 ? 'bg-slate-200 text-slate-800' :
                        i === 2 ? 'bg-orange-100 text-orange-900' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        #{i + 1}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-900 text-sm">
                      {p.name}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                        {p.category}
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold text-slate-800 text-sm">
                      {p.unitsSold}
                    </td>
                    <td className="p-3 text-right font-mono font-medium text-slate-700 text-sm">
                      ₹{p.sellingPrice.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-slate-900 text-sm">
                      ₹{p.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600 text-sm">
                      +₹{p.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                        p.stock <= 5 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {p.stock} units
                      </span>
                    </td>
                  </tr>
                ))}
                {productPerformance.filter(p => p.unitsSold > 0).length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                      No product sales recorded in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Staff Performance Details Modal */}
      {selectedStaffDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black flex items-center justify-center text-xl shadow-md overflow-hidden">
                  {selectedStaffDetails.profilePicUrl ? (
                    <img src={selectedStaffDetails.profilePicUrl} alt={selectedStaffDetails.name} className="w-full h-full object-cover" />
                  ) : (
                    selectedStaffDetails.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-slate-900">{selectedStaffDetails.name}</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                      {selectedStaffDetails.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-500 mt-1">
                    <span className="font-mono text-slate-400">ID: {selectedStaffDetails.id}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Phone size={12} /> {selectedStaffDetails.phone}
                    </span>
                    {selectedStaffDetails.baseSalary > 0 && (
                      <>
                        <span>•</span>
                        <span>Base Salary: ₹{selectedStaffDetails.baseSalary.toLocaleString()}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedStaffDetails(null)}
                className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-rose-500 hover:border-rose-100 transition-all hover:rotate-90"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100">
                  <p className="text-[10px] uppercase font-black text-blue-600">Total Sales Revenue</p>
                  <p className="text-xl font-black text-slate-900 mt-1">
                    ₹{selectedStaffDetails.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-[10px] uppercase font-black text-slate-400">Invoices Handled</p>
                  <p className="text-xl font-black text-slate-800 mt-1">{selectedStaffDetails.invoicesCount}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-[10px] uppercase font-black text-slate-400">Total Units Sold</p>
                  <p className="text-xl font-black text-slate-800 mt-1">{selectedStaffDetails.itemsSold}</p>
                </div>
                <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] uppercase font-black text-emerald-600">Total Commission</p>
                  <p className="text-xl font-black text-emerald-700 mt-1">
                    ₹{selectedStaffDetails.totalCommission.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-emerald-600 font-bold mt-0.5">
                    Paid: ₹{selectedStaffDetails.paidCommission.toLocaleString()} | Unpaid: ₹{selectedStaffDetails.unpaidCommission.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Bills Handled by this Staff */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                    <FileText size={16} className="text-blue-500" />
                    Invoices Handled ({selectedStaffDetails.bills?.length || 0})
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    Period: {format(new Date(startDate), 'dd MMM')} - {format(new Date(endDate), 'dd MMM yyyy')}
                  </span>
                </div>
                <div className="max-h-[340px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-white shadow-sm z-10 text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <tr>
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Items</th>
                        <th className="p-3">Payment</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3 text-right">Commission</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {selectedStaffDetails.bills?.map((b: any, idx: number) => {
                        const billTotal = b.finalAmount || b.amountPaid || 0;
                        let comm = 0;
                        if (b.staffCommissionAmount !== undefined && b.staffCommissionAmount !== null && Number(b.staffCommissionAmount) > 0) {
                          comm = Number(b.staffCommissionAmount);
                        } else if (b.staffCommissionPercentage) {
                          comm = (billTotal * b.staffCommissionPercentage) / 100;
                        }

                        return (
                          <tr key={b.id || idx} className="hover:bg-blue-50/20 transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-600">
                              {b.invoiceNumber || b.invoiceId || b.id?.slice(-8) || `BILL-${idx + 1}`}
                            </td>
                            <td className="p-3 text-slate-500 whitespace-nowrap">
                              {b.createdAt ? format(new Date(b.createdAt), 'dd MMM yyyy, hh:mm a') : 'N/A'}
                            </td>
                            <td className="p-3 font-bold text-slate-800">
                              <div>{b.customerName || 'Walk-in Customer'}</div>
                              {b.customerPhone && <div className="text-[10px] text-slate-400 font-normal">PH: {b.customerPhone}</div>}
                            </td>
                            <td className="p-3">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                                {b.items?.length || 0} items
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 font-bold uppercase text-[11px]">
                              {b.paymentMethod || 'Cash'}
                            </td>
                            <td className="p-3 text-right font-black text-slate-900">
                              ₹{billTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-600">
                              ₹{comm.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                b.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {b.status || 'PAID'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {(!selectedStaffDetails.bills || selectedStaffDetails.bills.length === 0) && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400 font-bold italic">
                            No bills found for this staff member in this date range
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedStaffDetails(null)}
                className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-900 transition"
              >
                Close Details
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Top Performing Products Section */}
      <div className="pb-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm font-sans">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div>
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                <Package size={22} className="text-blue-600" />
                Top Performing Products
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Products ranked by sales revenue, units sold, and profit contribution
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {/* Category filter */}
              <div className="relative">
                <select
                  value={selectedProductCategory}
                  onChange={(e) => setSelectedProductCategory(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  {availableProductCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Search input */}
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  placeholder="Search products by name, ID, category..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                />
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400">Total Products Sold</p>
              <p className="text-lg font-black text-slate-800 mt-0.5">{totalProductsSold} Units</p>
            </div>
            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/60">
              <p className="text-[10px] uppercase font-bold text-blue-600">Active Selling Products</p>
              <p className="text-lg font-black text-blue-700 mt-0.5">
                {productPerformance.filter(p => p.unitsSold > 0).length}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400">Total Product Sales</p>
              <p className="text-lg font-black text-slate-800 mt-0.5">₹{totalProductSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/60">
              <p className="text-[10px] uppercase font-bold text-emerald-600">Top Seller Revenue</p>
              <p className="text-lg font-black text-emerald-700 mt-0.5">
                ₹{(filteredProductsList[0]?.totalRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Products Table */}
          <div className="max-h-[500px] overflow-auto custom-scrollbar border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs shadow-2xs z-10">
                <tr className="text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-200">
                  <th className="p-3.5 text-center">Rank</th>
                  <th className="p-3.5">Product Details</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5 text-center">Units Sold</th>
                  <th className="p-3.5 text-center">Orders</th>
                  <th className="p-3.5 whitespace-nowrap">Price (₹)</th>
                  <th className="p-3.5 whitespace-nowrap">Total Sales (₹)</th>
                  <th className="p-3.5 whitespace-nowrap">Est. Profit (₹)</th>
                  <th className="p-3.5 text-center">Stock</th>
                  <th className="p-3.5 text-center">Sales Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProductsList.map((p, idx) => {
                  const badge = `#${idx + 1}`;

                  let badgeClasses = "inline-flex items-center justify-center font-black px-2.5 py-0.5 rounded-full text-[10px] border ";
                  if (idx === 0) badgeClasses += "bg-amber-100 text-amber-900 border-amber-300";
                  else if (idx === 1) badgeClasses += "bg-slate-200 text-slate-800 border-slate-300";
                  else if (idx === 2) badgeClasses += "bg-orange-100 text-orange-900 border-orange-300";
                  else badgeClasses += "bg-slate-50 text-slate-500 border-slate-200";

                  const isTop3 = idx < 3;
                  const sharePct = totalProductSales > 0 ? (p.totalRevenue / totalProductSales) * 100 : 0;

                  return (
                    <tr
                      key={p.id || idx}
                      className={`transition-colors group ${isTop3 ? 'bg-amber-50/20 hover:bg-amber-50/50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="p-3.5 text-center">
                        <span className={badgeClasses} title={`Rank ${idx + 1}`}>
                          {badge}
                        </span>
                      </td>
                      <td className="p-3.5 min-w-[200px]">
                        <div>
                          <p className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                            {p.name}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 font-bold mt-0.5">
                            ID: {p.id || 'N/A'} {p.barcode ? `• Barcode: ${p.barcode}` : ''}
                          </p>
                        </div>
                      </td>
                      <td className="p-3.5 text-xs font-bold text-slate-600">
                        <span className="inline-block px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px]">
                          {p.category}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100/60 inline-block">
                          {p.unitsSold}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md inline-block">
                          {p.invoicesCount}
                        </span>
                      </td>
                      <td className="p-3.5 text-xs font-bold text-slate-600 whitespace-nowrap">
                        ₹{p.sellingPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 font-black text-slate-900 text-sm whitespace-nowrap">
                        ₹{p.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-xs font-bold whitespace-nowrap">
                        <span className="text-emerald-600 font-bold">
                          ₹{p.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                        {p.profitMargin > 0 && (
                          <div className="text-[9px] text-emerald-600 font-medium">
                            {p.profitMargin.toFixed(1)}% margin
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.stock <= 0 ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                          p.stock <= 5 ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {p.stock <= 0 ? 'Out of Stock' : p.stock <= 5 ? `${p.stock} Low` : `${p.stock} In Stock`}
                        </span>
                      </td>
                      <td className="p-3.5 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, sharePct))}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-slate-600">{sharePct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredProductsList.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-10 text-center text-slate-400 font-medium">
                      No products match the selected filters or have recorded sales in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Hidden Report Container */}
      <div id="report-container" style={{ display: 'none', width: '1000px', backgroundColor: 'white', color: 'black', padding: '40px', fontFamily: 'Inter, sans-serif' }}>
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid #f1f5f9', paddingBottom: '20px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0' }}>Business Dashboard Report</h1>
          <p style={{ color: '#64748b', marginTop: '10px', fontSize: '16px' }}>
            Period: {format(new Date(startDate), 'dd MMM yyyy')} - {format(new Date(endDate), 'dd MMM yyyy')}
          </p>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>
            Generated on: {format(new Date(), 'dd MMM yyyy, hh:mm a')}
          </p>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', marginBottom: '40px' }}>
          {reportKpis.map((kpi, i) => (
            <div key={i} style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
              <p style={{ fontSize: '14px', color: '#64748b', fontWeight: 'medium', marginBottom: '8px' }}>{kpi.label}</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Charts Sections */}
        {(['day', 'week', 'month', 'year'] as const).map((view) => (
          <div key={view} style={{ 
            marginBottom: '40px', 
            breakBefore: (view === 'month' || view === 'year') ? 'page' : 'auto',
            paddingTop: (view === 'month' || view === 'year') ? '20px' : '0' 
          }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', borderLeft: '4px solid #3b82f6', paddingLeft: '15px', color: '#1e293b', textTransform: 'capitalize' }}>
              {view === 'day' ? 'Daily' : view === 'week' ? 'Weekly' : view === 'month' ? 'Monthly' : 'Yearly'} Analytics
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ border: '1px solid #f1f5f9', borderRadius: '12px', padding: '15px', backgroundColor: '#fff' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center', marginBottom: '10px' }}>Revenue vs Expenses</h3>
                <BarChart width={440} height={220} data={allPeriodsData[view]} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{fontSize: 9}} />
                  <YAxis tick={{fontSize: 9}} tickFormatter={(v) => `₹${v/1000}k`} />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </div>
              <div style={{ border: '1px solid #f1f5f9', borderRadius: '12px', padding: '15px', backgroundColor: '#fff' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center', marginBottom: '10px' }}>Revenue Distribution</h3>
                <PieChart width={440} height={220}>
                  <Pie data={allPieData[view]} innerRadius={35} outerRadius={65} dataKey="value" stroke="#fff" strokeWidth={2}>
                    {allPieData[view].map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{fontSize: '9px'}} />
                </PieChart>
              </div>
            </div>
          </div>
        ))}

        {/* Top Performing Products Section */}
        <div style={{ marginBottom: '40px', breakBefore: 'page', paddingTop: '20px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', borderLeft: '4px solid #3b82f6', paddingLeft: '15px', color: '#1e293b' }}>
            Top Performing Products
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <thead style={{ backgroundColor: '#f8fafc', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase' }}>
              <tr>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Rank</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Product ID</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Product Name</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Category</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>Units Sold</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Unit Price (₹)</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Total Sales (₹)</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Est. Profit (₹)</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>Stock</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '10px' }}>
              {topProductsReport.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px' }}>#{p.rank}</td>
                  <td style={{ padding: '10px', fontFamily: 'monospace' }}>{p.productId}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.name}</td>
                  <td style={{ padding: '10px' }}>{p.category}</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{p.unitsSold}</td>
                  <td style={{ padding: '10px' }}>{p.sellingPrice}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#1e293b' }}>{p.revenue}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#059669' }}>{p.profit}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{p.stock}</td>
                </tr>
              ))}
              {topProductsReport.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No product sales recorded for this period</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Top Performing Staff */}
        <div style={{ marginBottom: '40px', breakBefore: 'page' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', borderLeft: '4px solid #10b981', paddingLeft: '15px' }}>Top Performing Staff</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <thead style={{ backgroundColor: '#f8fafc', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase' }}>
              <tr>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Rank</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Staff ID</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Staff Name</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Role</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Phone</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>Invoices</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>Units Sold</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Total Sales (₹)</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Commission (₹)</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Avg Invoice (₹)</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '10px' }}>
              {topStaffReport.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px' }}>#{s.rank}</td>
                  <td style={{ padding: '10px', fontFamily: 'monospace' }}>{s.staffId}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{s.name}</td>
                  <td style={{ padding: '10px' }}>{s.role}</td>
                  <td style={{ padding: '10px' }}>{s.phone}</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{s.invoices}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{s.unitsSold}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#1e293b' }}>{s.revenue}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#059669' }}>{s.commission}</td>
                  <td style={{ padding: '10px' }}>{s.avgBill}</td>
                </tr>
              ))}
              {topStaffReport.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No staff performance data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Low Stock Products Section */}
        <div style={{ marginBottom: '50px', breakBefore: 'page' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', borderLeft: '4px solid #ef4444', paddingLeft: '15px', color: '#1e293b' }}>
            Low Stock Products Details
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <thead style={{ backgroundColor: '#fef2f2' }}>
              <tr style={{ textAlign: 'left', fontSize: '9px', textTransform: 'uppercase', color: '#64748b' }}>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>S.No</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Date</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Supplier Name</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Supplier ID</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Product Name</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Series</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Product ID</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Category</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Purchase Price</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Total Qty</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Sold Out (qty sold)</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Available Stock</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '9px' }}>
              {lowStockProducts.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: p.stock === 0 ? '#fff1f2' : 'transparent' }}>
                  <td style={{ padding: '8px' }}>{i + 1}</td>
                  <td style={{ padding: '8px' }}>{p.purchaseDate ? format(new Date(p.purchaseDate), 'dd MMM yyyy') : 'N/A'}</td>
                  <td style={{ padding: '8px' }}>{p.vendorName || 'N/A'}</td>
                  <td style={{ padding: '8px', fontFamily: 'monospace' }}>#{p.vendorId?.slice(-8) || 'N/A'}</td>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>{p.name}</td>
                  <td style={{ padding: '8px' }}>#{p.hashtagNumber || 'N/A'}</td>
                  <td style={{ padding: '8px', fontFamily: 'monospace' }}>{p.id}</td>
                  <td style={{ padding: '8px' }}>{p.category || 'N/A'}</td>
                  <td style={{ padding: '8px' }}>₹{p.purchaseRate.toLocaleString()}</td>
                  <td style={{ padding: '8px' }}>{(p.qtySold || 0) + (p.stock || 0)}</td>
                  <td style={{ padding: '8px', color: '#059669', fontWeight: 'bold' }}>{p.qtySold || 0}</td>
                  <td style={{ padding: '8px', color: '#ef4444', fontWeight: 'bold' }}>{p.stock}</td>
                </tr>
              ))}
              {lowStockProducts.length === 0 && <tr><td colSpan={10} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No low stock products</td></tr>}
            </tbody>
          </table>
        </div>


      </div>
    </div>
  );
};

export default DashboardOverview;

