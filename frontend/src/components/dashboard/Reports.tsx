import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { billingApi, Bill, BillDetails, Product } from '@/lib/api';
import { Download, ShoppingCart, TrendingUp, Truck, Filter, Lock } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import { useGlobalData } from '@/context/GlobalDataContext';

type ReportTab = 'sales' | 'purchase' | 'profit';
type PaymentMethod = 'all' | 'cash' | 'card' | 'upi' | 'cash + upi' | 'partial' | 'other';

const Reports = () => {
  const { products: globalProducts, loading: globalLoading } = useGlobalData();
  const [bills, setBills] = useState<Bill[]>([]);
  const refreshBills = useCallback(async () => {
    try {
      const res = await billingApi.getAll();
      setBills(Array.isArray(res) ? res : (res as any)?.data || []);
    } catch (e) { console.error("Failed to load bills", e); }
  }, []);
  useEffect(() => { refreshBills(); }, [refreshBills]);
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const [data, setData] = useState<any[]>([]);
  const [totalBills, setTotalBills] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod>('all');

  // New State for Cancelled Bills
  const [cancelledBills, setCancelledBills] = useState<Bill[]>([]);
  const [showCancelledModal, setShowCancelledModal] = useState(false);

  // New State for Hidden Bills (Estimates)
  const [hiddenBills, setHiddenBills] = useState<Bill[]>([]);
  const [showHiddenBillsModal, setShowHiddenBillsModal] = useState(false);

  // New states for modal filter
  const [modalStartDate, setModalStartDate] = useState('');
  const [modalEndDate, setModalEndDate] = useState('');
  const [isCancelledLoading, setIsCancelledLoading] = useState(false);
  const [isHiddenLoading, setIsHiddenLoading] = useState(false);

  // Sync with main dates when modal opens
  useEffect(() => {
    if (showCancelledModal || showHiddenBillsModal) {
      setModalStartDate(startDate);
      setModalEndDate(endDate);
    }
  }, [showCancelledModal, showHiddenBillsModal]);

  const getDefaultDates = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  };

  const parseDateSafe = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return val;
    // Handle Firebase Timestamps {seconds, nanoseconds} or {_seconds, _nanoseconds}
    if (typeof val === 'object') {
      const s = val.seconds || val._seconds;
      if (s !== undefined) return new Date(s * 1000);
      if (typeof val.toDate === 'function') return val.toDate();
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const parseFloatSafe = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    // Handle strings, remove currency symbols and commas
    const cleaned = String(val).replace(/[₹,]/g, '').trim();
    return parseFloat(cleaned) || 0;
  };

  // Check if an item is valid (not on HOLD)
  const isValidItem = (item: BillDetails, bill?: Bill): boolean => {
    const itemPm = ((item as any).paymentMethod || '').toLowerCase().trim();
    if (itemPm) return itemPm !== 'hold';

    // Fallback to bill level if item level is missing
    const billPm = (bill?.paymentMethod || '').toLowerCase().trim();
    return billPm !== 'hold';
  };

  // Safely get payment method: item > bill > fallback
  const getPaymentMethod = (item: BillDetails, bill: Bill): string => {
    const status = (bill.status || '').toLowerCase().trim();
    if (status === 'partial') return 'partial';

    const itemPm = ((item as any).paymentMethod || '').toLowerCase().trim();
    if (itemPm && itemPm !== 'hold' && itemPm !== 'split payment') return itemPm;

    const billPm = (bill.paymentMethod || '').toLowerCase().trim();
    if (billPm && billPm !== 'hold' && billPm !== 'split payment') return billPm;

    // Backward compatibility for legacy "Split Payment" string
    if (billPm === 'split payment' || itemPm === 'split payment') return 'cash + upi';

    return 'other';
  };

  // Enhanced display: show split breakdown if CASH + UPI
  const getDisplayPaymentMethod = (item: BillDetails, bill: Bill): React.ReactNode => {
    const pm = getPaymentMethod(item, bill).toUpperCase();
    if (pm === 'CASH + UPI' || pm === 'SPLIT PAYMENT') {
      // Use type assertion to access dynamic fields that might be missing from strict type
      const b = bill as any;
      const cash = parseFloatSafe(b.cashAmount || b.splitCashAmount || 0);
      const online = parseFloatSafe(b.onlineAmount || b.splitOnlineAmount || 0);

      if (cash > 0 || online > 0) {
        return (
          <div className="text-xs">
            <div>CASH (₹{cash.toFixed(0)}) +</div>
            <div>UPI (₹{online.toFixed(0)})</div>
          </div>
        );
      }
    }
    return pm;
  };

  const fetchCancelledReportsOnly = async () => {
    setIsCancelledLoading(true);
    try {

      const start = modalStartDate ? new Date(modalStartDate) : null;
      const end = modalEndDate ? new Date(modalEndDate) : null;
      if (end) end.setHours(23, 59, 59, 999);

      const filtered = bills.filter(b => {
        const dateValue = b.createdAt || (b as any).date || (b as any).billDate;
        const d = parseDateSafe(dateValue);
        if (start && d && d < start) return false;
        if (end && d && d > end) return false;
        return (b.status || '').toUpperCase() === "CANCELLED" || (b.paymentMethod || '').toUpperCase() === "CANCELLED";
      });
      setCancelledBills(filtered);
    } catch (e) {
      console.error(e);
      toast.error("Failed to filter cancelled bills");
    } finally {
      setIsCancelledLoading(false);
    }
  };

  const fetchHiddenReportsOnly = async () => {
    setIsHiddenLoading(true);
    try {
      const start = modalStartDate ? new Date(modalStartDate) : null;
      const end = modalEndDate ? new Date(modalEndDate) : null;
      if (end) end.setHours(23, 59, 59, 999);

      // Filter for ESTIMATE bills (Hidden Bills)
      const estimates = bills.filter(bill => {
        const dateValue = bill.createdAt || (bill as any).date || (bill as any).billDate;
        const d = parseDateSafe(dateValue);
        if (start && d && d < start) return false;
        if (end && d && d > end) return false;

        const billPm = (bill.paymentMethod || '').toLowerCase().trim();
        const isCancelled = (bill.status || '').toUpperCase() === 'CANCELLED';
        return (
          bill.billType === 'ESTIMATE' &&
          (bill.status === 'PAID' || !bill.status) &&
          !isCancelled &&
          billPm !== 'hold'
        );
      });
      setHiddenBills(estimates);
    } catch (e) {
      console.error(e);
      toast.error("Failed to filter hidden bills");
    } finally {
      setIsHiddenLoading(false);
    }
  };

  const handleUncancelBill = async (billId: string) => {
    if (!window.confirm(`Restore cancelled bill ${billId}? Its number will become available for reuse.`)) return;
    try {
      await billingApi.uncancel(billId);
      toast.success('Bill restored!');
      await refreshBills();
      fetchCancelledReportsOnly();
    } catch (e) {
      console.error(e);
      toast.error('Failed to restore bill.');
    }
  };

  const downloadCancelledExcel = () => {
    if (!cancelledBills.length) return toast.error("No data to export");
    const rows: any[] = [];
    cancelledBills.forEach(bill => {
      if (!bill.items || bill.items.length === 0) {
        rows.push({
          'Bill ID': bill.id,
          'Date': new Date(bill.createdAt).toLocaleDateString('en-GB'),
          'Status': 'CANCELLED',
          'Product': '-',
          'Quantity': 0,
          'Price': 0,
          'Total': 0
        });
      } else {
        bill.items.forEach(item => {
          rows.push({
            'Bill ID': bill.id,
            'Date': new Date(bill.createdAt).toLocaleDateString('en-GB'),
            'Status': 'CANCELLED',
            'Product': item.productName,
            'Quantity': item.quantity,
            'Price': parseFloatSafe(item.unitPrice).toFixed(2),
            'Total': (item.netAmount || 0).toFixed(2)
          });
        });
      }
    });

    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Cancelled Bills");
    writeFile(wb, `Cancelled_Bills_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadHiddenExcel = () => {
    if (!hiddenBills.length) return toast.error("No hidden bills to export");
    const rows: any[] = [];
    hiddenBills.forEach(bill => {
      bill.items.forEach(item => {
        rows.push({
          'Bill ID': bill.id,
          'Date': new Date(bill.createdAt).toLocaleDateString('en-GB'),
          'Type': 'ESTIMATE',
          'Customer': bill.customerName || 'Walk-in',
          'Product': item.productName,
          'Quantity': item.quantity,
          'Price': parseFloatSafe(item.unitPrice).toFixed(2),
          'Total': (item.netAmount || 0).toFixed(2)
        });
      });
    });

    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Hidden Bills");
    writeFile(wb, `Hidden_Bills_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const fetchReports = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const products = globalProducts;

      // --- Filter Cancelled ---
      const cancelled = bills.filter(b =>
        (b.status || '').toUpperCase() === "CANCELLED" ||
        (b.paymentMethod || '').toUpperCase() === "CANCELLED"
      );
      setCancelledBills(cancelled);

      const productByName = new Map<string, Product>();
      products.forEach(p => {
        productByName.set(p.name, p);
      });

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      if (end) end.setHours(23, 59, 59, 999);

      const isWithinRange = (dateSource: any) => {
        const d = parseDateSafe(dateSource);
        if (!d) return true;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      };

      const filterByPayment = (item: BillDetails, bill: Bill) => {
        if (paymentFilter === 'all') return true;
        return getPaymentMethod(item, bill) === paymentFilter;
      };

      const uniqueBillIds = new Set<string>();
      const estimates: Bill[] = [];
      const validForReport: Bill[] = [];

      bills.forEach(bill => {
        const billPm = (bill.paymentMethod || '').toLowerCase().trim();
        const isCancelled = (bill.status || '').toUpperCase() === 'CANCELLED' || billPm === 'cancelled';
        const isHold = billPm === 'hold';
        const isEstimate = bill.billType === 'ESTIMATE';

        const dateValue = bill.createdAt || (bill as any).date || (bill as any).billDate;
        if (!isWithinRange(dateValue)) return;
        if (isCancelled) return;
        if (isHold) return;

        if (isEstimate) {
          estimates.push(bill);
          return;
        }

        const billItems = bill.items || (bill as any).billDetails || [];
        if (billItems.some(it => isValidItem(it, bill))) {
          validForReport.push(bill);
          uniqueBillIds.add(bill.id || (bill as any)._id);
        }
      });

      setTotalBills(uniqueBillIds.size);
      setHiddenBills(estimates);
      const validBills = validForReport;

      if (activeTab === 'sales') {
        let serial = 1;
        const salesData = validBills
          .sort((a, b) => {
            const dA = parseDateSafe(a.createdAt || (a as any).date || (a as any).billDate);
            const dB = parseDateSafe(b.createdAt || (b as any).date || (b as any).billDate);
            return (dB?.getTime() || 0) - (dA?.getTime() || 0);
          })
          .flatMap(bill => {
            const billItems = bill.items || (bill as any).billDetails || [];
            const parsedDate = parseDateSafe(bill.createdAt || (bill as any).date || (bill as any).billDate);
            return billItems
              .filter(item => isValidItem(item, bill))
              .filter(item => filterByPayment(item, bill))
              .map(item => {
                const unitPrice = parseFloatSafe(item.unitPrice);
                const subtotal = unitPrice * item.quantity;
                const discountAmount = parseFloatSafe(item.discountAmount || 0);
                const discountPercent = subtotal > 0 ? ((discountAmount / subtotal) * 100).toFixed(2) : '0.00';
                const totalExGst = subtotal - discountAmount;
                return {
                  'S.No': serial++,
                  'Bill ID': bill.id || (bill as any)._id || '',
                  Date: parsedDate ? parsedDate.toLocaleDateString('en-GB') : '-',
                  Product: item.productName,
                  Quantity: item.quantity,
                  Price: unitPrice.toFixed(2),
                  'Discount (₹)': discountAmount.toFixed(2),
                  'Discount (%)': discountPercent,
                  GST: parseFloatSafe(item.gstAmount || 0).toFixed(2),
                  Total: totalExGst.toFixed(0),
                  'Payment Method': getDisplayPaymentMethod(item, bill),
                };
              });
          });
        setData(salesData);
      } else if (activeTab === 'purchase') {
        let serial = 1;
        const purchaseData = products
          .filter(p => isWithinRange(p.createdAt))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map(p => {
            const cost = p.purchaseRate * p.stockQuantity;
            const gst = cost * (p.purchaseGst / 100);
            return {
              'S.No': serial++,
              Date: new Date(p.createdAt).toLocaleDateString('en-GB'),
              Supplier: p.vendorName,
              'Supplier ID': p.vendorId || '-',
              Product: p.name,
              'Product ID': p.id,
              Barcode: p.barcode || p.id,
              Category: p.category,
              Price: p.purchaseRate.toFixed(2),
              GST: gst.toFixed(2),
              Stock: p.stockQuantity,
              Total: cost.toFixed(0),
            };
          });
        setData(purchaseData);
      } else if (activeTab === 'profit') {
        let serial = 1;
        const profitData = validBills
          .sort((a, b) => {
            const dA = parseDateSafe(a.createdAt || (a as any).date || (a as any).billDate);
            const dB = parseDateSafe(b.createdAt || (b as any).date || (b as any).billDate);
            return (dB?.getTime() || 0) - (dA?.getTime() || 0);
          })
          .flatMap(bill => {
            const billItems = bill.items || (bill as any).billDetails || [];
            const parsedDate = parseDateSafe(bill.createdAt || (bill as any).date || (bill as any).billDate);
            return billItems
              .filter(item => isValidItem(item, bill))
              .filter(item => filterByPayment(item, bill))
              .map(item => {
                const product = productByName.get(item.productName) || ({} as Product);
                const unitPrice = parseFloatSafe(item.unitPrice);
                const soldExGst = parseFloatSafe(item.netAmount || 0) - parseFloatSafe(item.gstAmount || 0);
                const purchaseRate = parseFloatSafe(item.purchaseRate || product.purchaseRate || 0);
                const purchaseCost = purchaseRate * item.quantity;
                const subtotal = unitPrice * item.quantity;
                const discountAmount = parseFloatSafe(item.discountAmount || 0);
                const discountPercent = subtotal > 0 ? ((discountAmount / subtotal) * 100).toFixed(2) : '0.00';
                const profitAmount = soldExGst - purchaseCost;
                const profitPercent = purchaseCost > 0 ? ((profitAmount / purchaseCost) * 100).toFixed(2) : '0.00';
                return {
                  'S.No': serial++,
                  'Bill ID': bill.id || (bill as any)._id || '',
                  Date: parsedDate ? parsedDate.toLocaleDateString('en-GB') : '-',
                  Category: product.category || '-',
                  Product: item.productName,
                  Quantity: item.quantity,
                  Purchase: purchaseCost.toFixed(0),
                  Sold: soldExGst.toFixed(0),
                  'Discount (₹)': discountAmount.toFixed(0),
                  'Discount (%)': discountPercent,
                  'Profit (₹)': profitAmount.toFixed(0),
                  'Profit (%)': profitPercent + '%',
                  'Customer Mode': (bill as any).customerMode || 'WALK-IN',
                  Total: soldExGst.toFixed(0),
                  'Payment Method': getDisplayPaymentMethod(item, bill),
                };
              });
          });
        setData(profitData);
      }
    } catch (err: any) {
      console.error('Error fetching reports:', err);
      setError('Failed to load reports.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) fetchReports();
      else { setError('Please log in.'); setIsLoading(false); }
    });
    return () => unsubscribe();
  }, [activeTab, startDate, endDate, paymentFilter, bills, globalProducts]);

  const exportExcel = () => {
    if (!data.length) { toast.error('No data.'); return; }
    const numericKeys: string[] = activeTab === 'sales' ? ['Quantity', 'Price', 'Discount (₹)', 'GST', 'Total'] : activeTab === 'profit' ? ['Quantity', 'Purchase', 'Sold', 'Discount (₹)', 'Profit (₹)', 'Total'] : ['Stock', 'Price', 'GST', 'Total'];
    const totals: any = { 'S.No': 'Total' };
    data.forEach(row => numericKeys.forEach(key => {
      const val = parseFloat(String(row[key] ?? '0').replace('₹', '').replace('%', '').trim());
      if (!isNaN(val)) totals[key] = (totals[key] || 0) + val;
    }));
    numericKeys.forEach(key => totals[key] = parseFloat(totals[key].toFixed(2)));
    const processedData = [...data, totals].map(row => {
      const newRow = { ...row };
      Object.keys(newRow).forEach(key => {
        if (typeof newRow[key] === 'object' && newRow[key] !== null) {
          // If it's a React element (like the one from getDisplayPaymentMethod), 
          // we should use a string representation for Excel.
          if (key === 'Payment Method') {
            newRow[key] = 'CASH + UPI';
          }
        }
      });
      return newRow;
    });
    const ws = utils.json_to_sheet(processedData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, activeTab);
    writeFile(wb, `${activeTab}_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          Reports Dashboard
          <button onClick={() => setShowHiddenBillsModal(true)} className="opacity-20 hover:opacity-100 p-1 text-gray-400 hover:text-gray-800">
            <Lock size={16} />
          </button>
        </h1>
        <div className="flex gap-3">
          <button onClick={() => setShowCancelledModal(true)} className="px-5 py-2.5 bg-red-600 text-white rounded-lg flex items-center gap-2 hover:bg-red-700">
            <Filter size={18} /> View Cancelled
          </button>
          <button onClick={exportExcel} className="px-5 py-2.5 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700">
            <Download size={18} /> Export Excel
          </button>
        </div>
      </header>

      {showCancelledModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b bg-red-50 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-red-800">Cancelled Bills</h2>
              <button onClick={() => setShowCancelledModal(false)} className="text-gray-500 hover:text-red-600 text-2xl font-bold">&times;</button>
            </div>
            <div className="p-4 border-b flex flex-wrap gap-4 items-end">
              <div><label className="block text-xs font-semibold mb-1">From</label><input type="date" value={modalStartDate} onChange={e => setModalStartDate(e.target.value)} className="border rounded p-1" /></div>
              <div><label className="block text-xs font-semibold mb-1">To</label><input type="date" value={modalEndDate} onChange={e => setModalEndDate(e.target.value)} className="border rounded p-1" /></div>
              <button onClick={fetchCancelledReportsOnly} className="bg-blue-600 text-white px-4 py-1.5 rounded">Filter</button>
              <button onClick={downloadCancelledExcel} className="bg-green-600 text-white px-4 py-1.5 rounded">Export</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
               {cancelledBills.length === 0 ? <p className="text-center py-10">No records.</p> : cancelledBills.map(b => (
                <div key={b.id} className="border rounded p-4 mb-4 bg-red-50/20">
                  <div className="flex justify-between items-start">
                    <p className="font-bold">{b.id} - {new Date(b.createdAt).toLocaleString()}</p>
                    <button onClick={() => handleUncancelBill(b.id)} className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">Restore</button>
                  </div>
                  <table className="w-full mt-2 text-sm">
                    <tr className="border-b"><th>Item</th><th>Qty</th><th>Total</th></tr>
                    {b.items.map((it, idx) => <tr key={idx}><td>{it.productName}</td><td>{it.quantity}</td><td>₹{it.netAmount}</td></tr>)}
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showHiddenBillsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col border-2 border-slate-700">
            <div className="p-6 border-b bg-slate-100 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Hidden Bills (Estimates)</h2>
              <button onClick={() => setShowHiddenBillsModal(false)} className="text-gray-500 hover:text-slate-800 text-2xl font-bold">&times;</button>
            </div>
            <div className="p-4 border-b flex flex-wrap gap-4 items-end">
              <div><label className="block text-xs font-semibold mb-1">From</label><input type="date" value={modalStartDate} onChange={e => setModalStartDate(e.target.value)} className="border rounded p-1" /></div>
              <div><label className="block text-xs font-semibold mb-1">To</label><input type="date" value={modalEndDate} onChange={e => setModalEndDate(e.target.value)} className="border rounded p-1" /></div>
              <button onClick={fetchHiddenReportsOnly} className="bg-slate-700 text-white px-4 py-1.5 rounded">Filter</button>
              <button onClick={downloadHiddenExcel} className="bg-green-600 text-white px-4 py-1.5 rounded">Export</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {hiddenBills.map(b => (
                <div key={b.id} className="border rounded p-4 mb-4 bg-white shadow-sm">
                  <div className="flex justify-between font-bold"><span>{b.id}</span><span>₹{b.finalAmount}</span></div>
                  <p className="text-xs text-slate-500">{new Date(b.createdAt).toLocaleString()}</p>
                  <table className="w-full mt-2 text-sm">
                    {b.items.map((it, idx) => <tr key={idx}><td>{it.productName}</td><td>{it.quantity}</td><td className="text-right">₹{it.netAmount}</td></tr>)}
                  </table>
                </div>
              ))}
            </div>
            <div className="p-4 bg-slate-100 font-bold text-right text-xl px-8">Total: ₹{hiddenBills.reduce((s, b) => s + (b.finalAmount || 0), 0).toFixed(2)}</div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-sm flex flex-wrap items-end gap-6">
        <div><label className="block text-sm font-medium">From</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 border rounded p-2" /></div>
        <div><label className="block text-sm font-medium">To</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 border rounded p-2" /></div>
        <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value as any)} className="mt-1 border rounded p-2">
          <option value="all">All Payments</option>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="cash + upi">CASH + UPI</option>
          <option value="partial">PARTIAL</option>
          <option value="card">Card</option>
          <option value="other">Other</option>
        </select>
        <span className="ml-auto text-blue-900 font-extrabold text-2xl tracking-wide">Count: {totalBills}</span>
      </div>

      <div className="bg-white p-2 rounded-lg shadow-sm flex gap-2">
        <Tab icon={ShoppingCart} label="Sales" active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />
        <Tab icon={TrendingUp} label="Profit" active={activeTab === 'profit'} onClick={() => setActiveTab('profit')} />
        <Tab icon={Truck} label="Purchase" active={activeTab === 'purchase'} onClick={() => setActiveTab('purchase')} />
      </div>

      {isLoading ? <div className="text-center py-20">Loading...</div> : <ReportTable data={data} activeTab={activeTab} totalBills={totalBills} />}
    </div>
  );
};

const Tab = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex-1 py-3 px-4 rounded-md font-semibold flex items-center justify-center gap-2 transition ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
    <Icon size={18} /> {label}
  </button>
);

const ReportTable = ({ data, activeTab, totalBills }: { data: any[]; activeTab: ReportTab; totalBills: number }) => {
  if (!data.length) return <div className="text-center py-20">No data found.</div>;
  const headers = Object.keys(data[0]);
  const moneyCols = new Set(['Price', 'Discount (₹)', 'GST', 'Total', 'Purchase', 'Sold', 'Profit (₹)']);

  const totals: any = {};
  data.forEach(row => headers.forEach(h => {
    if (moneyCols.has(h) || h === 'Quantity' || h === 'Stock') {
      const val = parseFloat((row[h] || '0').toString().replace('₹', '').replace('%', '').trim());
      if (!isNaN(val)) totals[h] = (totals[h] || 0) + val;
    }
  }));

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-x-auto border mt-4">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 border-b"><tr>{headers.map(h => <th key={h} className="p-4">{h}</th>)}</tr></thead>
        <tbody>
          {data.map((row, i) => <tr key={i} className="border-t">
            {headers.map(h => <td key={h} className="p-4">{moneyCols.has(h) ? `₹${row[h]}` : row[h]}</td>)}
          </tr>)}
          <tr className="border-t font-bold bg-green-50">
            {headers.map(h => <td key={h} className="p-4">{h === 'S.No' ? 'TOTAL' : (moneyCols.has(h) || h === 'Quantity' || h === 'Stock') ? `₹${totals[h]?.toFixed(0) || 0}` : ''}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default Reports;