import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Trash2, PlusCircle, X, Upload, Users, Loader2, Clock, MapPin, Phone, FileText, Search, User, Mail } from 'lucide-react';
import { customerService, customerApi, Customer, CustomerPurchase, billingApi, Bill } from '@/lib/api';
import { useGlobalData } from '@/context/GlobalDataContext';
import Papa from 'papaparse';
import { parseExcelFile } from '@/utils/excelParser';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useConfirm } from '@/hooks/useConfirm';
import { useLocation } from 'react-router-dom';

const StatusBadge = ({ label, onClick, disabled }: { label: string; onClick?: () => void; disabled?: boolean }) => {
    const s = label?.toUpperCase() || 'PAID';
    let theme = "from-slate-50 to-slate-100 text-slate-700 border-slate-200";
    if (s === 'PAID') theme = "from-green-50 to-green-100 text-green-700 border-green-200";
    if (s === 'PARTIAL') theme = "from-amber-50 to-amber-100 text-amber-700 border-amber-200 hover:from-amber-100 hover:to-amber-200";
    if (s === 'PENDING') theme = "from-red-50 to-red-100 text-red-700 border-red-200 hover:from-red-100 hover:to-red-200";
    if (s === 'CANCELLED') theme = "from-red-100 to-red-200 text-red-800 border-red-300";
    if (s === 'HOLD') theme = "from-blue-50 to-blue-100 text-blue-700 border-blue-200 hover:from-blue-100 hover:to-blue-200";

    const isClickable = onClick && s !== 'CANCELLED';

    return (
        <button
            onClick={(e) => { e.stopPropagation(); if (isClickable && onClick) onClick(); }}
            disabled={disabled || !isClickable}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-full border bg-gradient-to-r uppercase tracking-tight shadow-sm transition-all ${theme} ${isClickable ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
        >
            {label}
        </button>
    );
};

const PaymentModal = ({ customerId, bill, onClose, onPaymentRecorded }: { customerId: string; bill: CustomerPurchase; onClose: () => void; onPaymentRecorded: () => void }) => {
    const [amount, setAmount] = useState<number>(bill.balance || 0);
    const [mode, setMode] = useState<'CASH' | 'UPI' | 'ONLINE' | 'CHEQUE'>('CASH');
    const [remarks, setRemarks] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handlePaymentSubmit = async () => {
        if (!bill.id) return;
        if (amount <= 0 || amount > (bill.balance || 0)) {
            toast.error("Invalid payment amount");
            return;
        }

        setIsProcessing(true);
        try {
            await customerApi.recordPayment(customerId, bill.id, {
                amount,
                paymentMode: mode,
                description: remarks,
                date: new Date().toISOString()
            });
            toast.success("Payment recorded successfully");
            onPaymentRecorded();
            onClose();
        } catch (error) {
            console.error("Payment failed", error);
            toast.error("Failed to record payment");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[80] flex items-center justify-center p-4 transition-all duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 p-6 text-white relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Users size={80} />
                    </div>
                    <h2 className="text-xl font-bold relative z-10 tracking-tight">Record Payment</h2>
                    <p className="text-blue-50 text-sm mt-1 relative z-10 opacity-90">Bill #{bill.id}</p>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Bill</p>
                            <p className="text-lg font-bold text-slate-800 font-mono">₹{bill.amount?.toLocaleString()}</p>
                        </div>
                        <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 shadow-sm">
                            <p className="text-[10px] text-rose-500 uppercase font-bold tracking-wider">Balance Due</p>
                            <p className="text-lg font-bold text-rose-700 font-mono">₹{bill.balance?.toLocaleString()}</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Payment Amount</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                            <input
                                type="number"
                                className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-xl pl-8 pr-4 py-3 focus:bg-white focus:border-blue-500 focus:ring-0 outline-none transition-all font-bold text-lg"
                                value={amount || ''}
                                autoFocus
                                placeholder="0.00"
                                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="flex justify-between mt-1">
                            <p className="text-[10px] text-gray-400">Enter amount to pay</p>
                            <button
                                onClick={() => setAmount(bill.balance || 0)}
                                className="text-[10px] text-blue-600 font-bold hover:underline"
                            >
                                Pay Full Balance
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Payment Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['CASH', 'UPI', 'ONLINE', 'CHEQUE'].map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMode(m as any)}
                                    className={`py-2 px-3 rounded-lg text-xs font-bold border-2 transition-all duration-200 ${mode === m
                                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-600 text-blue-700 shadow-sm'
                                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600'
                                        }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Remarks (Optional)</label>
                        <textarea
                            className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-xl p-3 text-sm focus:bg-white focus:border-blue-500 focus:ring-0 outline-none transition-all min-h-[80px]"
                            placeholder="Add payment notes here..."
                            value={remarks}
                            onChange={e => setRemarks(e.target.value)}
                        />
                    </div>
                </div>

                <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200/50 transition-all duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handlePaymentSubmit}
                        disabled={isProcessing || amount <= 0 || amount > (bill.balance || 0)}
                        className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-200/50 flex items-center justify-center gap-2"
                    >
                        {isProcessing ? <Loader2 size={18} className="animate-spin" /> : 'Confirm Payment'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const HistoryModal = ({ bill, onClose }: { bill: CustomerPurchase; onClose: () => void }) => {
    if (!bill) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4 sm:p-6 transition-all duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-indigo-50">
                {/* Header - Matching Supplier Credit UI */}
                <div className="bg-gradient-to-r from-blue-50 via-white to-white px-8 py-6 flex justify-between items-center border-b border-indigo-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50/30 rounded-full -mr-24 -mt-24 blur-3xl text-indigo-500"></div>
                    <div className="relative z-10">
                        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                            <Clock size={24} className="text-blue-600" />
                            <span>Payment History</span>
                        </h2>
                        <p className="text-slate-500 text-sm font-medium mt-1">
                            Bill Reference: <span className="font-mono font-bold text-blue-600">#{bill.id}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="relative z-10 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200"
                    >
                        <X size={24} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar bg-slate-50/30">
                    {/* Summary Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Bill Amount</div>
                            <div className="text-xl font-black text-slate-800 text-center">₹{bill.amount?.toLocaleString() || '0'}</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-t-4 border-t-green-500">
                            <div className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-1 text-center">Paid So Far</div>
                            <div className="text-xl font-black text-green-600 text-center">₹{bill.paidAmount?.toLocaleString() || '0'}</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-t-4 border-t-red-500">
                            <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1 text-center">Balance Due</div>
                            <div className="text-xl font-black text-red-600 text-center">₹{bill.balance?.toLocaleString() || '0'}</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-t-4 border-t-blue-500">
                            <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1 text-center">Status</div>
                            <div className="flex justify-center mt-1">
                                <StatusBadge label={bill.status} />
                            </div>
                        </div>
                    </div>

                    {/* Timeline Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200">
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Payment Date</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Method</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Balance After</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {bill.paymentHistory && bill.paymentHistory.length > 0 ? (
                                    bill.paymentHistory.map((entry, idx) => (
                                        <tr key={idx} className="hover:bg-indigo-50/30 transition-colors duration-150">
                                            <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                                {new Date(entry.paymentDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-green-600 text-right">
                                                ₹{entry.amount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-0.5 text-[9px] font-black rounded border bg-slate-50 text-slate-600 border-slate-200 uppercase tracking-tighter">
                                                    {entry.paymentMode}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-800 text-right">
                                                ₹{entry.balanceAfterPayment.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500 truncate max-w-[150px]">
                                                {entry.description || '-'}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                                            No payment timeline recorded for this bill.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-10 py-3 text-sm font-bold bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 hover:text-blue-600 hover:border-blue-200 transition-all duration-200 shadow-sm"
                    >
                        Close History
                    </button>
                </div>
            </div>
        </div>
    );
};

const Customers = () => {
    const { customers, loading: globalLoading, refreshCustomers, mutateCustomers, isSyncing } = useGlobalData();
    const [bills, setBills] = useState<Bill[]>([]);
    const refreshBills = useCallback(async () => {
        try {
            const res = await billingApi.getAll();
            setBills(Array.isArray(res) ? res : (res as any)?.data || []);
        } catch (e) { console.error("Failed to load bills", e); }
    }, []);
    useEffect(() => { refreshBills(); }, [refreshBills]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [history, setHistory] = useState<CustomerPurchase[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false); // For CSV
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedBill, setSelectedBill] = useState<CustomerPurchase | null>(null);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [billToPay, setBillToPay] = useState<CustomerPurchase | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { confirm: showConfirmation, ConfirmationDialog } = useConfirm();

    const location = useLocation();
    const query = new URLSearchParams(location.search);
    const urlCustomerId = query.get("id") || query.get("customerId");
    const urlBillId = query.get("billId");

    // Data already loaded by GlobalDataContext on login — no need to refresh bills on mount.

    // Fetch history when selected customer changes
    useEffect(() => {
        if (selectedCustomer) {
            fetchHistory();
        } else {
            setHistory([]);
        }
    }, [selectedCustomer, bills]);

    // Deep link auto-open logic
    useEffect(() => {
        if (urlBillId && history.length > 0) {
            const bill = history.find(h => h.id === urlBillId);
            if (bill) {
                setSelectedBill(bill);
                setIsHistoryModalOpen(true);
                setTimeout(() => {
                    const el = document.getElementById(`bill-${urlBillId}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 500);
            }
        }
    }, [urlBillId, history]);

    // Sync selectedCustomer with global customers list to ensure stats/history refresh
    useEffect(() => {
        if (selectedCustomer) {
            const updated = customers.find(c => c.id === selectedCustomer.id);
            // Update if found and reference is different (implying an update occurred)
            if (updated && updated !== selectedCustomer) {
                setSelectedCustomer(updated);
            }
        }
    }, [customers]);

    // Auto-select customer from URL
    useEffect(() => {
        if (!urlCustomerId || customers.length === 0) return;

        const match = customers.find(c => c.id === urlCustomerId);
        if (match) {
            setSelectedCustomer(match);
            setTimeout(() => {
                const el = document.getElementById(`customer-${match.id}`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 200);
        }
    }, [urlCustomerId, customers]);

    const fetchHistory = async () => {
        if (!selectedCustomer) return;

        setIsHistoryLoading(true);
        try {
            const res = await customerApi.getHistory(selectedCustomer.id);
            setHistory(res.data || []);
        } catch (error) {
            console.error("Failed to load history", error);
            // Fallback to local filtering if API fails
            const customerBills = (bills || []).filter((b: any) => {
                if ((b.customerId && b.customerId === selectedCustomer.id) ||
                    (b.customer_id && b.customer_id === selectedCustomer.id)) return true;
                if (selectedCustomer.phone) {
                    const cPhone = selectedCustomer.phone.toString().replace(/\D/g, '');
                    const bPhone = (b.customerPhone || '').toString().replace(/\D/g, '');
                    if (cPhone.length > 5 && bPhone.length > 5 && cPhone === bPhone) return true;
                }
                return false;
            });
            setHistory(customerBills.map((b: any) => ({
                id: b.id || b.invoiceNumber,
                date: b.createdAt || b.date,
                amount: b.finalAmount || b.totalAmount || 0,
                paidAmount: b.amountPaid,
                balance: (b.finalAmount || b.totalAmount || 0) - (b.amountPaid || 0),
                paymentMethod: b.paymentMethod,
                status: b.status,
                items: b.items,
                paymentHistory: b.paymentHistory
            })));
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const handleSaveCustomer = async (customer: Omit<Customer, 'id'> & { id?: string }) => {
        if (!customer.id) {
            const isDuplicate = customers.some(
                c => c.name.trim().toLowerCase() === customer.name.trim().toLowerCase() ||
                    (c.phone && c.phone === customer.phone)
            );
            if (isDuplicate) {
                showConfirmation(`Customer "${customer.name}" or phone "${customer.phone}" might already exist. Continue?`, () => {
                    saveCustomerLogic(customer);
                });
                return;
            }
        }
        await saveCustomerLogic(customer);
    };

    const saveCustomerLogic = async (customer: any) => {
        setIsSaving(true);
        try {
            const payload: any = {
                name: customer.name,
                phone: customer.phone,
                address: customer.address,
                gstin: customer.gstNo || customer.gstin, // Normalize to gstin
                email: customer.email,
            };

            const savedId = customer.id;
            if (customer.id) {
                await customerApi.update(customer.id, payload);
                toast.success('Customer updated!');
            } else {
                const res = await customerApi.add(payload);
                // savedId = res.data?.id; // backend might return id
                toast.success('Customer added!');
            }
            await refreshCustomers();
            handleCloseModal();

            // If we were editing the selected customer, update the selection to reflect changes
            if (selectedCustomer && selectedCustomer.id === customer.id) {
                // We need to find the updated customer from the list or just merge local
                setSelectedCustomer({ ...selectedCustomer, ...payload, gstNo: payload.gstin });
            }
        } catch (err: any) {
            console.error("Save failed", err);
            toast.error(err.response?.data?.error || 'Save failed.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCustomer = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation(); // Prevent row click
        if (!id) return;

        showConfirmation('Delete this customer? This action cannot be undone.', async () => {
            setDeletingId(id);
            try {
                await customerApi.delete(id);
                mutateCustomers(prev => prev.filter(c => c.id !== id));
                toast.success('Deleted!');
                if (selectedCustomer?.id === id) {
                    setSelectedCustomer(null);
                }
            } catch (err: any) {
                console.error("Delete failed", err);
                toast.error(err.response?.data?.error || 'Delete failed.');
            } finally {
                setDeletingId(null);
            }
        });
    };

    // CSV Upload
    const handleUploadClick = () => fileInputRef.current?.click();

    const processRows = async (rows: any[]) => {
        if (rows.length === 0) {
            toast.error('File is empty.');
            setLoading(false);
            return;
        }

        let success = 0;
        let failed = 0;
        let skipped = 0;

        for (const row of rows) {
            // Normalize all keys to lowercase and remove extra spaces
            const normalizedRow: Record<string, any> = {};
            for (const [key, value] of Object.entries(row)) {
                const cleanKey = (key || '')
                    .toLowerCase()
                    .trim()
                    .replace(/\s+/g, ' ')           // normalize spaces
                    .replace(/[^a-z0-9]/g, '');     // remove special chars → easier matching

                normalizedRow[cleanKey] = value;
            }

            // Extract using flexible matching
            let name =
                normalizedRow.name ||
                normalizedRow.customername ||
                normalizedRow.fullname ||
                row.NAME ||
                row['NAME '] ||
                row.Name ||
                '';

            let phone =
                normalizedRow.phone ||
                normalizedRow.phonenumber ||
                normalizedRow.contact ||
                row['PHONE NUMBER'] ||
                row.PhoneNumber ||
                row.phone ||
                row.PHONE ||
                '';

            let email =
                normalizedRow.email ||
                normalizedRow.mail ||
                row.MAIL ||
                row.Email ||
                '';

            let gstin =
                normalizedRow.gstin ||
                normalizedRow.gst ||
                normalizedRow.gstno ||
                row.GSTIN ||
                row['GSTIN'] ||
                '';

            let address =
                normalizedRow.address ||
                normalizedRow.addr ||
                row.ADDRESS ||
                row.Address ||
                '';

            name = (name || '').toString().trim();
            phone = (phone || '').toString().trim().replace(/\D/g, ''); // keep only digits
            email = (email || '').toString().trim();
            gstin = (gstin || '').toString().trim().toUpperCase();
            address = (address || '').toString().trim();

            // Skip clearly invalid rows
            if (!name || name.length < 2) {
                skipped++;
                continue;
            }

            // Optional: skip if phone looks invalid (very short or too long)
            if (phone && (phone.length < 7 || phone.length > 13)) {
                phone = ''; // treat as no phone
            }

            const payload = {
                name,
                phone: phone || undefined,     // don't send empty string
                email: email || undefined,
                gstin: gstin || undefined,
                address: address || undefined,
            };

            try {
                await customerApi.add(payload);
                success++;
            } catch (err: any) {
                console.warn("Failed to import row:", row, err);
                failed++;
            }
        }

        toast.success(
            `Import finished: ${success} added, ${failed} failed, ${skipped} skipped (no name)`
        );

        await refreshCustomers();
        setLoading(false);

        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);

        if (file.name.endsWith('.csv')) {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => processRows(results.data as any[]),
                error: (err) => {
                    toast.error('CSV Parse error: ' + err.message);
                    setLoading(false);
                }
            });
        } else if (file.name.match(/\.(xlsx|xls)$/)) {
            try {
                const data = await parseExcelFile(file);
                processRows(data);
            } catch (err: any) {
                toast.error('Excel Parse error: ' + err.message);
                setLoading(false);
            }
        } else {
            toast.error("Unsupported file type");
            setLoading(false);
        }
    };

    const handleOpenModal = (c: Customer | null) => {
        setEditingCustomer(c);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCustomer(null);
    };

    const filteredCustomers = customers.filter(c =>
        (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.phone && c.phone.includes(searchTerm)) ||
        (c.gstin && c.gstin.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Derived stats for selected customer
    const filteredHistory = history.filter(h => {
        if (!h.date) return true;
        const purchaseDate = new Date(h.date);

        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (purchaseDate < start) return false;
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (purchaseDate > end) return false;
        }

        return true;
    });

    const totalBilled = filteredHistory.reduce((sum, h) => {
        if (h.status === 'CANCELLED' || h.status === 'HOLD') return sum;
        return sum + (Number(h.amount) || 0);
    }, 0);
    const totalPaid = filteredHistory.reduce((sum, h) => {
        if (h.status === 'CANCELLED' || h.status === 'HOLD') return sum;
        return sum + (Number(h.paidAmount || (h.status === 'PAID' ? h.amount : 0)) || 0);
    }, 0);
    const pendingBalance = totalBilled - totalPaid;

    const visitCount = filteredHistory.filter(h => h.status !== 'CANCELLED' && h.status !== 'HOLD').length;
    const sortedHistory = [...filteredHistory].sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());

    const lastVisit = (selectedCustomer?.lastVisit)
        ? new Date(selectedCustomer.lastVisit).toLocaleDateString()
        : (sortedHistory.length > 0 && sortedHistory[0].date)
            ? new Date(sortedHistory[0].date).toLocaleDateString()
            : 'N/A';

    return (
        <div className="flex h-[calc(100vh-100px)] gap-6 p-6">
            <ConfirmationDialog />
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />

            {/* Left Panel: List */}
            <div className="w-1/3 bg-white rounded-lg shadow-sm flex flex-col border border-gray-200">
                <div className="p-4 border-b">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Users className="text-blue-600" size={24} /> Customers
                        </h2>
                        <SyncIndicator isSyncing={isSyncing} />
                        <div className="flex gap-2">
                            <button onClick={handleUploadClick} className="p-2 bg-green-100 text-green-700 rounded-full hover:bg-green-200" title="Upload CSV">
                                <Upload size={18} />
                            </button>
                            <button
                                onClick={() => handleOpenModal(null)}
                                className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                                title="Add New Customer"
                            >
                                <PlusCircle size={20} />
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search Name, Phone, GST..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-gray-50"
                        />
                    </div>
                </div>

                <div className="overflow-y-auto flex-grow custom-scrollbar">
                    {globalLoading && customers.length === 0 ? (
                        <div className="p-8 text-center text-gray-500"><Loader2 className="animate-spin mx-auto mb-2" /> Loading...</div>
                    ) : filteredCustomers.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No customers found.</div>
                    ) : (
                        filteredCustomers.map(c => (
                            <div
                                id={`customer-${c.id}`}
                                key={c.id}
                                onClick={() => setSelectedCustomer(c)}
                                className={`p-4 border-b cursor-pointer transition-colors hover:bg-gray-50 flex justify-between items-center group relative ${selectedCustomer?.id === c.id ? 'bg-blue-50 border-blue-200' : ''}`}
                            >
                                <div>
                                    <div className="font-semibold text-gray-800">{c.name}</div>
                                    <div className="text-sm text-gray-500 flex items-center gap-2">
                                        {c.phone ? <><Phone size={12} /> {c.phone}</> : <span className="italic text-gray-400">No phone</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 bg-white/50 backdrop-blur-sm p-1 rounded-lg">
                                    <button onClick={(e) => { e.stopPropagation(); handleOpenModal(c); }} className="text-blue-600 hover:text-blue-800 p-1"><Pencil size={16} /></button>
                                    <button onClick={(e) => handleDeleteCustomer(c.id, e)} className="text-red-500 hover:text-red-700 p-1">
                                        {deletingId === c.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Panel: Details & History */}
            <div className="w-2/3 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
                {selectedCustomer ? (
                    <>
                        {/* Details Card */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 shrink-0">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                        <User className="text-gray-400" size={28} /> {selectedCustomer.name}
                                    </h1>
                                    <div className="text-sm text-gray-500 mt-1">Customer ID: <span className="font-mono">{selectedCustomer.id}</span></div>
                                </div>
                                <button onClick={() => handleOpenModal(selectedCustomer)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                    <Pencil size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="flex items-start gap-3">
                                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600 mt-1"><Phone size={18} /></div>
                                    <div>
                                        <div className="text-xs font-semibold text-gray-500 uppercase">Phone</div>
                                        <div className="font-medium text-gray-900">{selectedCustomer.phone || 'N/A'}</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-green-100 p-2 rounded-lg text-green-600 mt-1"><Mail size={18} /></div>
                                    <div>
                                        <div className="text-xs font-semibold text-gray-500 uppercase">Email</div>
                                        <div className="font-medium text-gray-900 break-all">{selectedCustomer.email || 'N/A'}</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-purple-100 p-2 rounded-lg text-purple-600 mt-1"><FileText size={18} /></div>
                                    <div>
                                        <div className="text-xs font-semibold text-gray-500 uppercase">GST Number</div>
                                        <div className="font-medium text-gray-900">{selectedCustomer.gstin || 'N/A'}</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-gray-100 p-2 rounded-lg text-gray-600 mt-1"><MapPin size={18} /></div>
                                    <div>
                                        <div className="text-xs font-semibold text-gray-500 uppercase">Address</div>
                                        <div className="font-medium text-gray-900 text-sm">{selectedCustomer.address || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-3 gap-4 shrink-0">
                            <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-blue-500">
                                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Billed</div>
                                <div className="text-2xl font-bold text-blue-700 mt-1">₹{totalBilled.toFixed(2)}</div>
                            </div>
                            <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-green-500">
                                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Paid</div>
                                <div className="text-2xl font-bold text-green-700 mt-1">₹{totalPaid.toFixed(2)}</div>
                            </div>
                            <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-orange-500">
                                <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">Pending Balance</div>
                                <div className="text-2xl font-bold text-red-600 mt-1">₹{pendingBalance.toFixed(2)}</div>
                            </div>
                        </div>

                        {/* History Table */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col min-h-[400px]">
                            <div className="p-4 border-b bg-gray-50 flex justify-between items-center gap-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">
                                    <Clock size={16} className="text-gray-500" /> Purchase History
                                </h3>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1 border rounded-lg bg-white px-2 py-1">
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="text-xs outline-none bg-transparent"
                                        />
                                        <span className="text-gray-400 text-xs">to</span>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="text-xs outline-none bg-transparent"
                                        />
                                    </div>
                                    {(startDate || endDate) && (
                                        <button
                                            onClick={() => { setStartDate(''); setEndDate(''); }}
                                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="overflow-y-auto flex-grow custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-4 font-semibold text-gray-600 text-[10px] uppercase tracking-wider">Date</th>
                                            <th className="p-4 font-semibold text-gray-600 text-[10px] uppercase tracking-wider">Bill ID</th>
                                            <th className="p-4 font-semibold text-gray-600 text-[10px] uppercase tracking-wider text-right">Bill Total</th>
                                            <th className="p-4 font-semibold text-gray-600 text-[10px] uppercase tracking-wider text-right text-green-600">Paid So Far</th>
                                            <th className="p-4 font-semibold text-gray-600 text-[10px] uppercase tracking-wider text-center">Status</th>
                                            <th className="p-4 font-semibold text-gray-600 text-[10px] uppercase tracking-wider text-center">History</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {isHistoryLoading ? (
                                            <tr><td colSpan={6} className="p-12 text-center text-gray-400"><Loader2 className="animate-spin mx-auto mb-2" /> Loading history...</td></tr>
                                        ) : sortedHistory.length === 0 ? (
                                            <tr><td colSpan={6} className="p-12 text-center text-gray-400">No purchase history found.</td></tr>
                                        ) : (
                                            sortedHistory.map((h, i) => (
                                                <tr
                                                    key={i}
                                                    id={`bill-${h.id}`}
                                                    className={`transition-colors h-16 ${h.id === urlBillId ? 'bg-yellow-50 border-l-4 border-yellow-500 shadow-sm' :
                                                        h.status === 'CANCELLED' ? 'bg-red-50/50' :
                                                            h.status === 'HOLD' ? 'bg-blue-50/30' :
                                                                'hover:bg-slate-50'
                                                        }`}
                                                >
                                                    <td className="p-4 text-xs text-gray-600">
                                                        <div className={`font-bold ${h.status === 'CANCELLED' ? 'line-through text-gray-400' : 'text-slate-800'}`}>
                                                            {h.date ? new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400">{h.date ? new Date(h.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                                                    </td>
                                                    <td className="p-4 text-xs font-mono font-bold">
                                                        <span className={h.status === 'CANCELLED' ? 'text-gray-400 line-through' : 'text-blue-600'}>#{h.id}</span>
                                                    </td>
                                                    <td className={`p-4 text-sm font-black text-right ${h.status === 'CANCELLED' ? 'text-gray-300 line-through' : 'text-slate-700'}`}>
                                                        ₹{Number(h.amount).toLocaleString()}
                                                    </td>
                                                    <td className={`p-4 text-sm font-black text-right text-green-600 ${h.status === 'CANCELLED' ? 'text-gray-300 line-through' : ''}`}>
                                                        ₹{Number(h.paidAmount || (h.status === 'PAID' ? h.amount : 0)).toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <StatusBadge
                                                            label={h.status || 'PAID'}
                                                            onClick={() => {
                                                                if (h.status === 'PAID') {
                                                                    setSelectedBill(h);
                                                                    setIsHistoryModalOpen(true);
                                                                } else {
                                                                    setBillToPay(h);
                                                                    setIsPayModalOpen(true);
                                                                }
                                                            }}
                                                            disabled={h.status === 'CANCELLED'}
                                                        />
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <button
                                                            onClick={() => { setSelectedBill(h); setIsHistoryModalOpen(true); }}
                                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200"
                                                            title="View Timeline"
                                                        >
                                                            <Clock size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-grow flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Users size={40} className="text-gray-300" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-600">No Customer Selected</h3>
                        <p className="text-gray-400 max-w-xs text-center mt-2">Select a customer from the list on the left to view their details, history, and statistics.</p>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <CustomerFormModal customer={editingCustomer} onSave={handleSaveCustomer} onClose={handleCloseModal} isSaving={isSaving} />
            )}
            {isHistoryModalOpen && selectedBill && (
                <HistoryModal bill={selectedBill} onClose={() => setIsHistoryModalOpen(false)} />
            )}
            {isPayModalOpen && billToPay && selectedCustomer && (
                <PaymentModal
                    customerId={selectedCustomer.id}
                    bill={billToPay}
                    onClose={() => { setIsPayModalOpen(false); setBillToPay(null); }}
                    onPaymentRecorded={() => { refreshBills(); refreshCustomers(); fetchHistory(); }}
                />
            )}
        </div>
    );
};

const CustomerFormModal = ({ customer, onSave, onClose, isSaving }: { customer: Customer | null; onSave: any; onClose: () => void; isSaving?: boolean }) => {
    const [form, setForm] = useState({
        name: customer?.name || '',
        phone: customer?.phone || '',
        gstNo: customer?.gstin || '',
        address: customer?.address || '',
        email: customer?.email || '',
    });

    const nameRef = useRef<HTMLInputElement>(null);
    const phoneRef = useRef<HTMLInputElement>(null);
    const emailRef = useRef<HTMLInputElement>(null);
    const gstRef = useRef<HTMLInputElement>(null);
    const addressRef = useRef<HTMLTextAreaElement>(null);

    const handleEnter = (e: React.KeyboardEvent, nextRef: React.RefObject<any>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextRef.current?.focus();
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...form, id: customer?.id });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg animate-in fade-in zoom-in-95">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        {customer ? <Pencil size={24} className="text-blue-600" /> : <PlusCircle size={24} className="text-blue-600" />}
                        {customer ? 'Edit Customer' : 'Add New Customer'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><X size={24} className="text-gray-500" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Customer Name *</label>
                        <input ref={nameRef} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} onKeyDown={(e) => handleEnter(e, phoneRef)} className="form-input w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter customer name" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                            <input ref={phoneRef} type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} onKeyDown={(e) => handleEnter(e, emailRef)} className="form-input w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="10-digit number" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                            <input ref={emailRef} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} onKeyDown={(e) => handleEnter(e, gstRef)} className="form-input w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="customer@example.com" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">GST Number</label>
                            <input ref={gstRef} value={form.gstNo} onChange={e => setForm({ ...form, gstNo: e.target.value })} onKeyDown={(e) => handleEnter(e, addressRef)} className="form-input w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Optional" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                        <textarea ref={addressRef} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); } }} className="form-input w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]" placeholder="Full address" rows={3}></textarea>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                        <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center gap-2">
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
                            {isSaving ? 'Saving...' : 'Save Customer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Customers;
