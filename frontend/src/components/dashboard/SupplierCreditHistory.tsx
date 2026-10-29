import React, { useState, useEffect } from 'react';
import { vendorApi, productApi, CreditTransaction, PurchaseReturn } from '@/lib/api';
import { CreditCard, Download, Filter, Search, RefreshCw, X, RotateCcw } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import { startOfMonth, endOfMonth, format, startOfYear, endOfDay } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useGlobalData } from '@/context/GlobalDataContext';
import ViewProductsModal from './ViewProductsModal';

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

const formatDateSafe = (tx: CreditTransaction) => {
    const dateSource = tx.createdAt || tx.date;
    const d = parseDateSafe(dateSource);
    if (!d) return '-';

    // If it's exactly midnight (often from a date-only string), and we are seeing the 5:30 offset, 
    // it's better to hide the time or show it as is. 
    // But usually, if it's from a date picker, we only want the date.

    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0;

    // Special case for IST: if the date-only string was parsed as UTC 00:00, 
    // it often shows as 05:30 AM. If we see exactly 05:30:00 and minutes/seconds are 0, 
    // it's likely a date-only shift.
    const isIstMidnightShift = d.getHours() === 5 && d.getMinutes() === 30 && d.getSeconds() === 0;

    if (!hasTime || (isIstMidnightShift && !tx.createdAt)) {
        return format(d, 'dd MMM yyyy');
    }

    return format(d, 'dd MMM yyyy, hh:mm a');
};

const SupplierCreditHistory = () => {
    const { vendors, products, purchaseReturns, mutatePurchaseReturns, refreshPurchaseReturns } = useGlobalData();
    const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [selectedVendor, setSelectedVendor] = useState('ALL');
    const [dateRange, setDateRange] = useState({
        start: format(startOfYear(new Date()), 'yyyy-MM-dd'),
        end: format(endOfDay(new Date()), 'yyyy-MM-dd')
    });
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [billSearch, setBillSearch] = useState('');

    // Payment Modal State
    const [payModal, setPayModal] = useState<{ open: boolean; tx: CreditTransaction | null }>({
        open: false,
        tx: null
    });
    const [historyModal, setHistoryModal] = useState<{ open: boolean; tx: CreditTransaction | null }>({
        open: false,
        tx: null
    });
    const [productsModal, setProductsModal] = useState<{ open: boolean; tx: CreditTransaction | null }>({
        open: false,
        tx: null
    });
    const [paymentData, setPaymentData] = useState({
        amount: 0,
        mode: 'CASH' as 'CASH' | 'UPI' | 'ONLINE' | 'CHEQUE',
        remarks: ''
    });
    const [isProcessing, setIsProcessing] = useState(false);

    // Purchase Return Modal State
    const [returnModal, setReturnModal] = useState<{ open: boolean; tab: 'search' | 'history' }>({ open: false, tab: 'search' });
    const [returnSearch, setReturnSearch] = useState('');
    const [returnSearchResults, setReturnSearchResults] = useState<CreditTransaction[]>([]);
    const [selectedReturnTx, setSelectedReturnTx] = useState<CreditTransaction | null>(null);
    const [returnProducts, setReturnProducts] = useState<{ productId: string; name: string; maxQty: number; returnQty: number; purchaseRate: number }[]>([]);
    const [returnRemarks, setReturnRemarks] = useState('');
    const [isProcessingReturn, setIsProcessingReturn] = useState(false);
    const [returnDateRange, setReturnDateRange] = useState({
        start: format(startOfYear(new Date()), 'yyyy-MM-dd'),
        end: format(endOfDay(new Date()), 'yyyy-MM-dd')
    });
    const [returnHistorySearch, setReturnHistorySearch] = useState('');

    useEffect(() => {
        fetchTransactions();
    }, [dateRange]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await vendorApi.getCreditsRange(dateRange.start, dateRange.end);
            setTransactions(res.data || []);
        } catch (error) {
            console.warn("getCreditsRange failed, falling back to fetching per vendor", error);
            try {
                if (vendors.length === 0) {
                    setTransactions([]);
                    return;
                }
                const allTxPromises = vendors.map(v => vendorApi.getCredits(v.id).catch(() => ({ data: [] })));
                const results = await Promise.all(allTxPromises);
                let allTx = results.flatMap(r => r.data || []);
                
                // Filter by date range manually
                const startDate = new Date(dateRange.start);
                const endDate = new Date(dateRange.end);
                endDate.setHours(23, 59, 59, 999);
                
                allTx = allTx.filter(tx => {
                    const d = parseDateSafe(tx.createdAt || tx.date);
                    if (!d) return true; // keep if no date
                    return d >= startDate && d <= endDate;
                });
                
                // Sort by date descending
                allTx.sort((a, b) => {
                    const da = parseDateSafe(a.createdAt || a.date)?.getTime() || 0;
                    const db = parseDateSafe(b.createdAt || b.date)?.getTime() || 0;
                    return db - da;
                });
                
                setTransactions(allTx);
            } catch (err) {
                console.error("Failed to load transactions", err);
                toast.error("Failed to load credit history");
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePaymentSubmit = async () => {
        if (!payModal.tx || !payModal.tx.id) return;
        if (paymentData.amount <= 0 || paymentData.amount > payModal.tx.balance) {
            toast.error("Invalid payment amount");
            return;
        }

        setIsProcessing(true);
        try {
            await vendorApi.recordPayment(
                payModal.tx.id,
                paymentData.amount,
                paymentData.mode,
                paymentData.remarks
            );

            // Inline update
            setTransactions(prev => prev.map(t => {
                if (t.id === payModal.tx?.id) {
                    const newPaid = t.paidAmount + paymentData.amount;
                    const newBal = t.amount - newPaid;
                    return {
                        ...t,
                        paidAmount: newPaid,
                        balance: newBal,
                        status: newBal <= 0 ? 'PAID' : 'PARTIAL',
                        paymentMode: paymentData.mode as any,
                        paymentRemarks: paymentData.remarks,
                        lastPaymentDate: new Date().toISOString()
                    };
                }
                return t;
            }));

            toast.success("Payment recorded successfully");
            setPayModal({ open: false, tx: null });
            setPaymentData({ amount: 0, mode: 'CASH', remarks: '' });
        } catch (error) {
            console.error("Payment failed", error);
            toast.error("Failed to record payment");
        } finally {
            setIsProcessing(false);
        }
    };

    const getVendorName = (id: string) => {
        return vendors.find(v => v.id === id)?.name || 'Unknown Vendor';
    };

    // ------------------------------------------------------------------
    // Purchase Return helpers
    // ------------------------------------------------------------------
    const handleReturnSearch = (query: string) => {
        setReturnSearch(query);
        const q = query.toLowerCase().trim();
        if (!q) {
            setReturnSearchResults([]);
            return;
        }
        const results = transactions.filter(tx => {
            const vendorName = getVendorName(tx.vendorId).toLowerCase();
            const billNo = (tx.invoice || '').toLowerCase();
            return vendorName.includes(q) || billNo.includes(q);
        });
        setReturnSearchResults(results);
    };

    const handleSelectReturnTx = (tx: CreditTransaction) => {
        setSelectedReturnTx(tx);
        // Prefer the products still attached to this transaction, else match the
        // product master by the transaction they were purchased on.
        const attached = (tx.products || []).map(p => ({
            productId: p.id,
            name: p.name,
            maxQty: Number(p.stockQuantity) || 0,
            returnQty: 0,
            purchaseRate: Number(p.purchaseRate) || 0
        }));

        if (attached.length > 0) {
            setReturnProducts(attached);
        } else {
            const billProducts = (products || []).filter(p => p.creditTransactionId === tx.id);
            setReturnProducts(billProducts.map(p => ({
                productId: p.id,
                name: p.name,
                maxQty: Number(p.stockQuantity) || 0,
                returnQty: 0,
                purchaseRate: Number(p.purchaseRate) || 0
            })));
        }
        setReturnRemarks('');
    };

    const handleReturnQtyChange = (index: number, qty: number) => {
        setReturnProducts(prev => prev.map((p, i) => {
            if (i === index) {
                const clampedQty = Math.max(0, Math.min(qty, p.maxQty));
                return { ...p, returnQty: clampedQty };
            }
            return p;
        }));
    };

    const totalReturnAmount = returnProducts.reduce((sum, p) => sum + (p.returnQty * p.purchaseRate), 0);

    const handleProcessReturn = async () => {
        if (!selectedReturnTx || !selectedReturnTx.id) return;

        const productsToReturn = returnProducts.filter(p => p.returnQty > 0);
        if (productsToReturn.length === 0) {
            toast.error("Please select at least one product to return");
            return;
        }

        const totalAmount = productsToReturn.reduce((sum, p) => sum + (p.returnQty * p.purchaseRate), 0);

        setIsProcessingReturn(true);
        try {
            const purchaseReturn: PurchaseReturn = {
                transactionId: selectedReturnTx.id,
                vendorId: selectedReturnTx.vendorId || '',
                vendorName: getVendorName(selectedReturnTx.vendorId),
                invoice: selectedReturnTx.invoice || '',
                returnDate: new Date().toISOString(),
                returnedProducts: productsToReturn.map(p => ({
                    productId: p.productId,
                    name: p.name,
                    returnedQty: p.returnQty,
                    purchaseRate: p.purchaseRate,
                    amount: p.returnQty * p.purchaseRate
                })),
                totalReturnAmount: totalAmount,
                previousAmount: selectedReturnTx.amount,
                newAmount: Math.max(0, selectedReturnTx.amount - totalAmount),
                previousBalance: selectedReturnTx.balance,
                newBalance: Math.max(0, selectedReturnTx.balance - totalAmount),
                status: 'COMPLETED',
                remarks: returnRemarks
            };

            const res = await vendorApi.addPurchaseReturn(purchaseReturn);
            const prId = res.data?.id || `PR-${Date.now()}`;

            // Deduct stock for each returned product
            for (const p of productsToReturn) {
                try {
                    await productApi.updateStock(p.productId, -p.returnQty, null);
                } catch (err) {
                    console.error(`Failed to update stock for product ${p.productId}`, err);
                }
            }

            // Optimistically add to cached purchase returns
            mutatePurchaseReturns(prev => [{ ...purchaseReturn, id: prId }, ...(prev || [])]);

            // Update local transaction state
            const newAmount = Math.max(0, selectedReturnTx.amount - totalAmount);
            const newBalance = Math.max(0, selectedReturnTx.balance - totalAmount);
            setTransactions(prev => prev.map(t => {
                if (t.id === selectedReturnTx.id) {
                    return {
                        ...t,
                        amount: newAmount,
                        balance: newBalance,
                        status: newBalance <= 0 ? 'PAID' : t.status
                    };
                }
                return t;
            }));

            toast.success(`Purchase return of ₹${totalAmount.toLocaleString()} processed successfully`);
            setSelectedReturnTx(null);
            setReturnProducts([]);
            setReturnRemarks('');
        } catch (error) {
            console.error("Purchase return failed", error);
            toast.error("Failed to process purchase return");
        } finally {
            setIsProcessingReturn(false);
        }
    };

    const filteredTransactions = transactions.filter(tx => {
        if (selectedVendor !== 'ALL' && tx.vendorId !== selectedVendor) return false;
        if (statusFilter !== 'ALL' && tx.status !== statusFilter) return false;

        if (billSearch.trim()) {
            const searchLower = billSearch.toLowerCase().trim();
            const invoiceMatch = tx.invoice?.toLowerCase().includes(searchLower);
            const descMatch = tx.description?.toLowerCase().includes(searchLower);
            if (!invoiceMatch && !descMatch) return false;
        }

        return true;
    });

    const handleOpenHistory = async (tx: CreditTransaction) => {
        setLoading(true);
        try {
            const res = await vendorApi.getCredits(tx.vendorId);
            const vendorTransactions = res.data || [];
            
            // Update the main transactions list with this vendor's fresh data
            setTransactions(prev => prev.map(t => {
                const fresh = vendorTransactions.find(vt => vt.id === t.id);
                return fresh ? fresh : t;
            }));

            // Find the updated version of this transaction
            const freshTx = vendorTransactions.find(t => t.id === tx.id) || tx;
            setHistoryModal({ open: true, tx: freshTx });
        } catch (error) {
            console.error("Failed to refresh history", error);
            toast.error("Failed to refresh latest history");
            setHistoryModal({ open: true, tx });
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = () => {
        const data = filteredTransactions.map(tx => ({
            Date: formatDateSafe(tx),
            Vendor: getVendorName(tx.vendorId),
            Description: tx.description,
            'Purchase Amount': tx.amount,
            'Paid Amount': tx.paidAmount,
            Balance: tx.balance,
            Status: tx.status,
            Mode: tx.paymentMode
        }));

        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Credit History");
        writeFile(wb, `Credit_History_${dateRange.start}_to_${dateRange.end}.xlsx`);
    };

    // Summary logic
    const totalPurchase = filteredTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalPaid = filteredTransactions.reduce((sum, t) => sum + (Number(t.paidAmount) || 0), 0);
    const netDue = totalPurchase - totalPaid;

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Supplier Credit History</h1>
                    <p className="text-gray-500 mt-1">Global view of all supplier transactions and outstanding debts</p>
                </div>
                <div className="flex space-x-2">
                    <button onClick={fetchTransactions} className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">
                        <RefreshCw size={20} />
                    </button>
                    <button
                        onClick={() => {
                            setReturnModal({ open: true, tab: 'search' });
                            setReturnSearch('');
                            setReturnSearchResults([]);
                            setSelectedReturnTx(null);
                            setReturnProducts([]);
                        }}
                        className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm"
                    >
                        <RotateCcw size={20} />
                        <span>Purchase Return</span>
                    </button>
                    <button onClick={exportToExcel} className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-sm">
                        <Download size={20} />
                        <span>Export Excel</span>
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 uppercase">Total Purchases (Period)</p>
                        <h3 className="text-2xl font-bold text-gray-800 mt-1">₹{totalPurchase.toLocaleString()}</h3>
                    </div>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <CreditCard size={24} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 uppercase">Total Payments (Period)</p>
                        <h3 className="text-2xl font-bold text-green-600 mt-1">₹{totalPaid.toLocaleString()}</h3>
                    </div>
                    <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                        <Download size={24} className="rotate-180" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 uppercase">Net Balance Change</p>
                        <h3 className={`text-2xl font-bold mt-1 ${netDue > 0 ? 'text-red-600' : 'text-gray-600'}`}>₹{netDue.toLocaleString()}</h3>
                    </div>
                    <div className="p-3 bg-red-50 text-red-600 rounded-lg">
                        <Filter size={24} />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Date Range</label>
                    <div className="flex items-center space-x-2">
                        <input
                            type="date"
                            className="border rounded-lg p-2 text-sm"
                            value={dateRange.start}
                            onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                        />
                        <span className="text-gray-400">-</span>
                        <input
                            type="date"
                            className="border rounded-lg p-2 text-sm"
                            value={dateRange.end}
                            onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                        />
                    </div>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Filter by Vendor</label>
                    <select
                        className="w-full border rounded-lg p-2 text-sm"
                        value={selectedVendor}
                        onChange={e => setSelectedVendor(e.target.value)}
                    >
                        <option value="ALL">All Vendors</option>
                        {vendors.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                    </select>
                </div>
                <div className="min-w-[150px]">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                    <select
                        className="w-full border rounded-lg p-2 text-sm"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="PAID">Paid</option>
                        <option value="PENDING">Pending</option>
                        <option value="PARTIAL">Partial</option>
                    </select>
                </div>
                <div className="flex-grow min-w-[250px]">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Search Bill No / Description</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            className="w-full border rounded-lg pl-9 pr-9 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                            placeholder="Type to search..."
                            value={billSearch}
                            onChange={e => setBillSearch(e.target.value)}
                        />
                        {billSearch && (
                            <button
                                onClick={() => setBillSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">SUPPLIER</th>
                                <th className="px-6 py-4">Bill Number</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4 text-right">Purchase</th>
                                <th className="px-6 py-4 text-right">Paid</th>
                                <th className="px-6 py-4 text-center">Mode</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-center">History</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className="text-center py-10">Loading transactions...</td></tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-10 text-gray-400">No transactions found in this period.</td></tr>
                            ) : (
                                filteredTransactions.map((tx, idx) => (
                                    <tr key={idx} className="bg-white border-b hover:bg-slate-50/80 transition-colors duration-150">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                            {formatDateSafe(tx)}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-blue-600">{getVendorName(tx.vendorId)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-gray-600">{tx.invoice || '-'}</span>
                                                <button 
                                                    onClick={() => setProductsModal({ open: true, tx })}
                                                    className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 font-bold hover:bg-blue-600 hover:text-white transition-all"
                                                >
                                                    View Products
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>{tx.description || '-'}</div>
                                            {tx.paymentRemarks && <div className="text-[10px] text-gray-400 mt-1 italic">Last Pay: {tx.paymentRemarks}</div>}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-900">{tx.amount > 0 ? `₹${tx.amount.toLocaleString()}` : '-'}</td>
                                        <td className="px-6 py-4 text-right text-green-600 font-semibold">{tx.paidAmount > 0 ? `₹${tx.paidAmount.toLocaleString()}` : '₹0'}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-gray-100 text-gray-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-gray-200">
                                                {tx.paymentMode || 'CREDIT'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                disabled={isProcessing || tx.status === 'PAID'}
                                                onClick={() => setPayModal({ open: true, tx })}
                                                title={tx.status === 'PAID' ? 'Fully Paid' : 'Click to record payment'}
                                                className={`text-[10px] px-2 py-0.5 rounded border font-black uppercase transition-all
                                                    ${tx.status === 'PAID'
                                                        ? 'bg-green-50 text-green-700 border-green-200 cursor-default'
                                                        : tx.status === 'PENDING'
                                                            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 cursor-pointer'
                                                            : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 cursor-pointer'
                                                    }
                                                    ${isProcessing ? 'opacity-50 cursor-wait' : ''}`}
                                            >
                                                {tx.status}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => handleOpenHistory(tx)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                title="View payment history"
                                            >
                                                <RefreshCw size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Payment Modal */}
            {payModal.open && payModal.tx && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 transition-all duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 p-6 text-white relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <CreditCard size={80} />
                            </div>
                            <h2 className="text-xl font-bold relative z-10 tracking-tight">Record Payment</h2>
                            <p className="text-blue-50 text-sm mt-1 relative z-10 opacity-90">{getVendorName(payModal.tx.vendorId)} • {payModal.tx.invoice || 'No Invoice'}</p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Amount</p>
                                    <p className="text-lg font-bold text-slate-800 font-mono">₹{payModal.tx.amount.toLocaleString()}</p>
                                </div>
                                <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 shadow-sm">
                                    <p className="text-[10px] text-rose-500 uppercase font-bold tracking-wider">Outstanding</p>
                                    <p className="text-lg font-bold text-rose-700 font-mono">₹{(payModal.tx.balance).toLocaleString()}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Payment Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                    <input
                                        type="number"
                                        className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-xl pl-8 pr-4 py-3 focus:bg-white focus:border-blue-500 focus:ring-0 outline-none transition-all font-bold text-lg"
                                        value={paymentData.amount || ''}
                                        autoFocus
                                        placeholder="0.00"
                                        onChange={e => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="flex justify-between mt-1">
                                    <p className="text-[10px] text-gray-400">Enter amount to pay</p>
                                    <button
                                        onClick={() => setPaymentData({ ...paymentData, amount: payModal.tx!.balance })}
                                        className="text-[10px] text-blue-600 font-bold hover:underline"
                                    >
                                        Pay Full Balance
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Payment Mode</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['CASH', 'UPI', 'ONLINE', 'CHEQUE'].map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setPaymentData({ ...paymentData, mode: mode as any })}
                                            className={`py-2 px-3 rounded-lg text-xs font-bold border-2 transition-all duration-200 ${paymentData.mode === mode
                                                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-600 text-blue-700 shadow-sm'
                                                : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600'
                                                }`}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Remarks (Optional)</label>
                                <textarea
                                    className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-xl p-3 text-sm focus:bg-white focus:border-blue-500 focus:ring-0 outline-none transition-all min-h-[80px]"
                                    placeholder="Add payment notes here..."
                                    value={paymentData.remarks}
                                    onChange={e => setPaymentData({ ...paymentData, remarks: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handlePaymentSubmit();
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => setPayModal({ open: false, tx: null })}
                                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200/50 transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePaymentSubmit}
                                disabled={isProcessing || paymentData.amount <= 0 || paymentData.amount > (payModal.tx?.balance || 0)}
                                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-200/50 flex items-center justify-center gap-2"
                            >
                                {isProcessing ? <RefreshCw size={18} className="animate-spin" /> : 'Confirm Payment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* History Modal */}
            {historyModal.open && historyModal.tx && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 transition-all duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">

                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-50 via-white to-white px-6 py-5 flex justify-between items-center border-b border-indigo-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                            <div className="relative z-10">
                                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                                    <RefreshCw size={20} className="text-blue-600" />
                                    <span>Payment History</span>
                                </h2>
                                <p className="text-slate-500 text-sm mt-0.5 font-medium">
                                    {getVendorName(historyModal.tx.vendorId)} <span className="mx-2 text-slate-300">•</span> Invoice: <span className="font-mono text-blue-600 font-bold">{historyModal.tx.invoice || 'N/A'}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setHistoryModal({ open: false, tx: null })}
                                className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all duration-200"
                            >
                                <X size={18} strokeWidth={3} />
                            </button>
                        </div>

                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-6 px-6 py-6 border-b bg-slate-50/50">
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                <p className="text-[10px] text-slate-500 uppercase font-extrabold tracking-widest mb-1">Total Bill</p>
                                <p className="text-xl font-black text-slate-800 font-mono">
                                    ₹{historyModal.tx.amount.toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 shadow-sm">
                                <p className="text-[10px] text-green-600 uppercase font-extrabold tracking-widest mb-1">Total Paid</p>
                                <p className="text-xl font-black text-green-600 font-mono">
                                    ₹{historyModal.tx.paidAmount.toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 shadow-sm">
                                <p className="text-[10px] text-rose-600 uppercase font-extrabold tracking-widest mb-1">Outstanding</p>
                                <p className="text-xl font-black text-rose-600 font-mono">
                                    ₹{historyModal.tx.balance.toLocaleString()}
                                </p>
                            </div>
                        </div>

                        {/* Ledger Table */}
                        <div className="max-h-[420px] overflow-y-auto">
                            {!historyModal.tx.paymentHistory || historyModal.tx.paymentHistory.length === 0 ? (
                                <div className="p-12 text-center text-gray-400 text-sm">
                                    No payment records available for this transaction.
                                </div>
                            ) : (
                                <table className="w-full text-sm border-collapse">
                                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs sticky top-0 z-10">
                                        <tr>
                                            <th className="px-5 py-3 text-left">Date</th>
                                            <th className="px-5 py-3 text-right">Paid Amount</th>
                                            <th className="px-5 py-3 text-center">Mode</th>
                                            <th className="px-5 py-3 text-right">Balance After</th>
                                            <th className="px-5 py-3 text-left">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historyModal.tx.paymentHistory.map((entry, i) => (
                                            <tr
                                                key={i}
                                                className="border-b hover:bg-indigo-50/40 transition-colors duration-150"
                                            >
                                                <td className="px-5 py-3 text-gray-800 font-medium">
                                                    {format(
                                                        parseDateSafe(entry.paymentDate) || new Date(),
                                                        'dd MMM yyyy, hh:mm a'
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 text-right font-bold text-green-600">
                                                    ₹{entry.amount.toLocaleString()}
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <span className="px-3 py-1 text-[10px] font-bold rounded-full border bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border-slate-200 uppercase tracking-tighter">
                                                        {entry.paymentMode}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-right font-semibold text-gray-800">
                                                    ₹{entry.balanceAfterPayment.toLocaleString()}
                                                </td>
                                                <td className="px-5 py-3 text-gray-600 text-xs">
                                                    {entry.description || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-5 bg-gradient-to-t from-slate-50/80 to-white border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setHistoryModal({ open: false, tx: null })}
                                className="px-10 py-2.5 text-sm font-bold bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 transition-all duration-200 shadow-sm"
                            >
                                Close Ledger
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Purchase Return Modal */}
            {returnModal.open && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 transition-all duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[85vw] max-h-[92vh] overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200 flex flex-col">

                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 px-6 py-5 text-white relative flex-shrink-0">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <RotateCcw size={80} />
                            </div>
                            <div className="flex justify-between items-start">
                                <div className="relative z-10">
                                    <h2 className="text-xl font-bold tracking-tight">Purchase Return</h2>
                                    <p className="text-blue-100 text-sm mt-1 opacity-90">Search purchases and process returns</p>
                                </div>
                                <button
                                    onClick={() => setReturnModal({ open: false, tab: 'search' })}
                                    className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-all duration-200"
                                >
                                    <X size={18} strokeWidth={3} />
                                </button>
                            </div>
                            <div className="flex space-x-2 mt-4 relative z-10">
                                <button
                                    onClick={() => setReturnModal({ ...returnModal, tab: 'search' })}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${returnModal.tab === 'search'
                                        ? 'bg-white text-blue-600 shadow-lg'
                                        : 'bg-white/20 text-white hover:bg-white/30'
                                        }`}
                                >
                                    Search & Return
                                </button>
                                <button
                                    onClick={() => {
                                        setReturnModal({ ...returnModal, tab: 'history' });
                                        refreshPurchaseReturns();
                                    }}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${returnModal.tab === 'history'
                                        ? 'bg-white text-blue-600 shadow-lg'
                                        : 'bg-white/20 text-white hover:bg-white/30'
                                        }`}
                                >
                                    Return History
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {returnModal.tab === 'search' ? (
                                <div>
                                    {/* Search Input */}
                                    {!selectedReturnTx && (
                                        <div className="mb-6">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                                <input
                                                    type="text"
                                                    className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-xl pl-10 pr-4 py-3 focus:bg-white focus:border-blue-500 focus:ring-0 outline-none transition-all text-sm"
                                                    placeholder="Search by bill number or supplier name..."
                                                    autoFocus
                                                    value={returnSearch}
                                                    onChange={e => handleReturnSearch(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Search Results Table */}
                                    {returnSearchResults.length > 0 && !selectedReturnTx && (
                                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left text-gray-500">
                                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                                        <tr>
                                                            <th className="px-4 py-3">Date</th>
                                                            <th className="px-4 py-3">Supplier</th>
                                                            <th className="px-4 py-3">Bill No</th>
                                                            <th className="px-4 py-3 text-right">Amount</th>
                                                            <th className="px-4 py-3 text-right">Paid</th>
                                                            <th className="px-4 py-3 text-right">Balance</th>
                                                            <th className="px-4 py-3 text-center">Status</th>
                                                            <th className="px-4 py-3 text-center">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {returnSearchResults.map((tx, idx) => (
                                                            <tr key={idx} className="bg-white border-b hover:bg-slate-50/80 transition-colors duration-150">
                                                                <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                                                                    {formatDateSafe(tx)}
                                                                </td>
                                                                <td className="px-4 py-3 font-medium text-blue-600">{getVendorName(tx.vendorId)}</td>
                                                                <td className="px-4 py-3 font-mono text-gray-600">{tx.invoice || '-'}</td>
                                                                <td className="px-4 py-3 text-right text-gray-900">₹{tx.amount.toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-right text-green-600 font-semibold">₹{tx.paidAmount.toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-right text-red-600 font-semibold">₹{tx.balance.toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className={`text-[10px] px-2 py-0.5 rounded border font-black uppercase ${tx.status === 'PAID'
                                                                        ? 'bg-green-50 text-green-700 border-green-200'
                                                                        : tx.status === 'PENDING'
                                                                            ? 'bg-red-50 text-red-700 border-red-200'
                                                                            : 'bg-orange-50 text-orange-700 border-orange-200'
                                                                        }`}>
                                                                        {tx.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <button
                                                                        onClick={() => handleSelectReturnTx(tx)}
                                                                        className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition shadow-sm"
                                                                    >
                                                                        Select
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Selected Transaction Return Form */}
                                    {selectedReturnTx && (
                                        <div>
                                            {/* Summary Cards */}
                                            <div className="grid grid-cols-4 gap-4 mb-6">
                                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                                                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Bill</p>
                                                    <p className="text-lg font-bold text-slate-800 font-mono">₹{selectedReturnTx.amount.toLocaleString()}</p>
                                                </div>
                                                <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 shadow-sm">
                                                    <p className="text-[10px] text-green-600 uppercase font-bold tracking-wider">Paid</p>
                                                    <p className="text-lg font-bold text-green-600 font-mono">₹{selectedReturnTx.paidAmount.toLocaleString()}</p>
                                                </div>
                                                <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 shadow-sm">
                                                    <p className="text-[10px] text-rose-600 uppercase font-bold tracking-wider">Pending</p>
                                                    <p className="text-lg font-bold text-rose-600 font-mono">₹{selectedReturnTx.balance.toLocaleString()}</p>
                                                </div>
                                                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 shadow-sm">
                                                    <p className="text-[10px] text-blue-600 uppercase font-bold tracking-wider">Last Payment</p>
                                                    <p className="text-lg font-bold text-blue-600 font-mono">{selectedReturnTx.paymentMode || 'CREDIT'}</p>
                                                </div>
                                            </div>

                                            {/* Supplier Info Bar */}
                                            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mb-6 flex items-center justify-between">
                                                <div>
                                                    <span className="text-sm font-bold text-blue-800">{getVendorName(selectedReturnTx.vendorId)}</span>
                                                    <span className="mx-2 text-blue-300">•</span>
                                                    <span className="text-sm font-mono text-blue-600">Bill: {selectedReturnTx.invoice || 'N/A'}</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setSelectedReturnTx(null);
                                                        setReturnProducts([]);
                                                        setReturnRemarks('');
                                                    }}
                                                    className="text-xs text-blue-600 font-bold hover:underline"
                                                >
                                                    Change Selection
                                                </button>
                                            </div>

                                            {/* Products Table */}
                                            {returnProducts.length > 0 ? (
                                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm text-left text-gray-500">
                                                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                                                <tr>
                                                                    <th className="px-4 py-3">Product Name</th>
                                                                    <th className="px-4 py-3 text-right">Purchase Rate</th>
                                                                    <th className="px-4 py-3 text-center">Available Stock</th>
                                                                    <th className="px-4 py-3 text-center">Return Qty</th>
                                                                    <th className="px-4 py-3 text-right">Return Amount</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {returnProducts.map((p, idx) => (
                                                                    <tr key={idx} className="bg-white border-b hover:bg-slate-50/80 transition-colors duration-150">
                                                                        <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                                                                        <td className="px-4 py-3 text-right font-mono text-gray-600">₹{p.purchaseRate.toLocaleString()}</td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-0.5 rounded">
                                                                                {p.maxQty}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <input
                                                                                type="number"
                                                                                min={0}
                                                                                max={p.maxQty}
                                                                                value={p.returnQty || ''}
                                                                                placeholder="0"
                                                                                className="w-20 border-2 border-slate-100 bg-slate-50/50 rounded-lg px-3 py-1.5 text-center text-sm focus:bg-white focus:border-blue-500 focus:ring-0 outline-none transition-all font-bold"
                                                                                onChange={e => handleReturnQtyChange(idx, parseInt(e.target.value) || 0)}
                                                                            />
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right font-bold text-blue-600 font-mono">
                                                                            ₹{(p.returnQty * p.purchaseRate).toLocaleString()}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-center text-yellow-700 text-sm mb-6">
                                                    No products found for this transaction. Please select a transaction with recorded products.
                                                </div>
                                            )}

                                            {/* Remarks */}
                                            <div className="mb-6">
                                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Remarks (Optional)</label>
                                                <textarea
                                                    className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-xl p-3 text-sm focus:bg-white focus:border-blue-500 focus:ring-0 outline-none transition-all min-h-[80px]"
                                                    placeholder="Add notes about this return..."
                                                    value={returnRemarks}
                                                    onChange={e => setReturnRemarks(e.target.value)}
                                                />
                                            </div>

                                            {/* Bottom Bar */}
                                            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-gray-600">Total Return:</span>
                                                    <span className="text-xl font-black text-blue-600 font-mono">₹{totalReturnAmount.toLocaleString()}</span>
                                                </div>
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedReturnTx(null);
                                                            setReturnProducts([]);
                                                            setReturnRemarks('');
                                                        }}
                                                        className="px-6 py-2.5 text-sm font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={handleProcessReturn}
                                                        disabled={isProcessingReturn || totalReturnAmount <= 0}
                                                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-200/50 flex items-center gap-2"
                                                    >
                                                        {isProcessingReturn ? <RefreshCw size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                                        Process Return
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Empty State */}
                                    {!returnSearch && !selectedReturnTx && (
                                        <div className="text-center py-16">
                                            <RotateCcw size={48} className="mx-auto text-gray-300 mb-4" />
                                            <h3 className="text-lg font-bold text-gray-500 mb-2">Search for a Purchase</h3>
                                            <p className="text-sm text-gray-400">Type a bill number or supplier name above to find purchases to return</p>
                                        </div>
                                    )}

                                    {returnSearch && returnSearchResults.length === 0 && !selectedReturnTx && (
                                        <div className="text-center py-16">
                                            <Search size={48} className="mx-auto text-gray-300 mb-4" />
                                            <h3 className="text-lg font-bold text-gray-500 mb-2">No Results Found</h3>
                                            <p className="text-sm text-gray-400">No transactions match your search. Try a different bill number or supplier name.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Return History Tab */
                                <div>
                                    {/* Date Range + Search + Load Button */}
                                    <div className="flex flex-wrap gap-4 items-end mb-6">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Date Range</label>
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="date"
                                                    className="border rounded-lg p-2 text-sm"
                                                    value={returnDateRange.start}
                                                    onChange={e => setReturnDateRange({ ...returnDateRange, start: e.target.value })}
                                                />
                                                <span className="text-gray-400">-</span>
                                                <input
                                                    type="date"
                                                    className="border rounded-lg p-2 text-sm"
                                                    value={returnDateRange.end}
                                                    onChange={e => setReturnDateRange({ ...returnDateRange, end: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Filter Returns</label>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                <input
                                                    type="text"
                                                    className="w-full border rounded-lg pl-9 pr-4 py-2 text-sm"
                                                    placeholder="Filter by supplier or bill number..."
                                                    value={returnHistorySearch}
                                                    onChange={e => setReturnHistorySearch(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => refreshPurchaseReturns()}
                                            className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition shadow-sm"
                                        >
                                            Load History
                                        </button>
                                    </div>

                                    {/* Returns Table */}
                                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left text-gray-500">
                                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                                    <tr>
                                                        <th className="px-4 py-3">Date</th>
                                                        <th className="px-4 py-3">Supplier</th>
                                                        <th className="px-4 py-3">Bill No</th>
                                                        <th className="px-4 py-3">Returned Products</th>
                                                        <th className="px-4 py-3 text-right">Return Amount</th>
                                                        <th className="px-4 py-3 text-right">New Bill Total</th>
                                                        <th className="px-4 py-3 text-right">New Balance</th>
                                                        <th className="px-4 py-3 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {purchaseReturns.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={8} className="text-center py-10 text-gray-400">
                                                                No purchase returns found for this period. Click "Load History" to fetch.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        purchaseReturns
                                                            .filter(pr => {
                                                                if (!returnHistorySearch) return true;
                                                                const q = returnHistorySearch.toLowerCase();
                                                                return (pr.vendorName || '').toLowerCase().includes(q) || (pr.invoice || '').toLowerCase().includes(q);
                                                            })
                                                            .map((pr, idx) => (
                                                                <tr key={idx} className="bg-white border-b hover:bg-slate-50/80 transition-colors duration-150">
                                                                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                                                                        {pr.returnDate ? format(parseDateSafe(pr.returnDate) || new Date(), 'dd MMM yyyy') : '-'}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-medium text-blue-600">{pr.vendorName}</td>
                                                                    <td className="px-4 py-3 font-mono text-gray-600">{pr.invoice || '-'}</td>
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {pr.returnedProducts?.map((p, i) => (
                                                                                <span key={i} className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">
                                                                                    {p.name} x{p.returnedQty}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-bold text-red-600 font-mono">
                                                                        -₹{pr.totalReturnAmount.toLocaleString()}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-semibold text-gray-800 font-mono">
                                                                        ₹{pr.newAmount.toLocaleString()}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-semibold text-gray-800 font-mono">
                                                                        ₹{pr.newBalance.toLocaleString()}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <span className="bg-green-50 text-green-700 text-[10px] px-2 py-0.5 rounded border border-green-200 font-black uppercase">
                                                                            {pr.status}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Summary Bar */}
                                    {purchaseReturns.length > 0 && (
                                        <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                            <span className="text-sm font-bold text-gray-600">
                                                Total Returns: <span className="text-blue-600">{purchaseReturns.length}</span>
                                            </span>
                                            <span className="text-sm font-bold text-gray-600">
                                                Total Return Amount: <span className="text-red-600 font-mono">₹{purchaseReturns.reduce((sum, pr) => sum + pr.totalReturnAmount, 0).toLocaleString()}</span>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* View Products Modal */}
            <ViewProductsModal 
                isOpen={productsModal.open}
                onClose={() => setProductsModal({ open: false, tx: null })}
                transaction={productsModal.tx}
            />

        </div>
    );
};

export default SupplierCreditHistory;
