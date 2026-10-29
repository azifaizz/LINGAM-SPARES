import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, X, PlusCircle, Calendar, ArrowUpRight, ArrowDownLeft, Eye } from 'lucide-react';
import { vendorApi, CreditTransaction, Vendor } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import ViewProductsModal from './ViewProductsModal';

// ... existing imports

interface SupplierCreditPanelProps {
    supplierId?: string;
    supplierName?: string;
    embedded?: boolean;
    onClose?: () => void;
    onSuccess?: (transactionId?: string) => void;
    initialAmount?: number;
    initialDescription?: string;
    billDate?: string;
    hideAddForm?: boolean;
    hideSubmitButton?: boolean;
    hidePaidAmount?: boolean;
    hideInvoice?: boolean;
    onFormChange?: (data: Partial<CreditTransaction>) => void;
}

const SupplierCreditPanel: React.FC<SupplierCreditPanelProps> = ({
    supplierId,
    supplierName,
    embedded = false,
    onClose,
    onSuccess,
    initialAmount,
    initialDescription,
    billDate,
    hideAddForm = false,
    hideSubmitButton = false,
    hidePaidAmount = false,
    hideInvoice = false,
    onFormChange
}) => {
    const [credits, setCredits] = useState<CreditTransaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddForm, setShowAddForm] = useState(!hideAddForm && embedded && (initialAmount || 0) > 0);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [formData, setFormData] = useState<Partial<CreditTransaction>>({
        amount: initialAmount || 0,
        paidAmount: 0,
        balance: 0,
        paymentMode: 'CREDIT',
        status: 'PENDING',
        invoice: '',
        description: initialDescription || '',
        date: billDate || format(new Date(), 'yyyy-MM-dd')
    });

    useEffect(() => {
        if (onFormChange) {
            onFormChange(formData);
        }
    }, [formData, onFormChange]);

    const amountRef = useRef<HTMLInputElement>(null);
    const paidRef = useRef<HTMLInputElement>(null);
    const modeRef = useRef<HTMLSelectElement>(null);
    const invoiceRef = useRef<HTMLInputElement>(null);
    const descriptionRef = useRef<HTMLInputElement>(null);

    const handleEnter = (e: React.KeyboardEvent, nextRef: React.RefObject<any>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextRef.current?.focus();
        }
    };

    useEffect(() => {
        if (supplierId) {
            fetchCredits();
        }
    }, [supplierId]);

    // Sync external bill date if provided
    useEffect(() => {
        if (billDate) {
            setFormData(prev => ({ ...prev, date: billDate }));
        }
    }, [billDate]);

    // Update form if initial props change
    useEffect(() => {
        if (initialAmount || initialDescription) {
            setFormData(prev => ({
                ...prev,
                amount: initialAmount || prev.amount,
                description: initialDescription || prev.description
            }));
            if (embedded && !hideAddForm) setShowAddForm(true);
        }
    }, [initialAmount, initialDescription, embedded]);

    const fetchCredits = async () => {
        if (!supplierId) return;
        setLoading(true);
        try {
            const res = await vendorApi.getCredits(supplierId);
            setCredits(res.data || []);
        } catch (error) {
            toast.error("Failed to load credits");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const calculateSummary = () => {
        const totalCredit = credits.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        const totalPaid = credits.reduce((sum, tx) => sum + (Number(tx.paidAmount) || 0), 0);
        const balance = totalCredit - totalPaid;
        return { totalCredit, totalPaid, balance };
    };

    const summary = calculateSummary();

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplierId) {
            toast.error("No supplier selected");
            return;
        }

        const txBalance = (Number(formData.amount) || 0) - (Number(formData.paidAmount) || 0);

        const payload: CreditTransaction = {
            vendorId: supplierId,
            invoice: formData.invoice,
            amount: Number(formData.amount) || 0,
            paidAmount: Number(formData.paidAmount) || 0,
            balance: txBalance,
            paymentMode: formData.paymentMode as any,
            status: txBalance > 0 ? 'PENDING' : 'PAID',
            description: formData.description,
            date: formData.date,
        };

        try {
            const res = await vendorApi.addCredit(payload);
            toast.success("Transaction recorded");
            setShowAddForm(false);
            setFormData({ ...formData, amount: 0, paidAmount: 0, description: '', invoice: '' });
            fetchCredits();
            if (onSuccess) onSuccess((res.data as any).id);
        } catch (error) {
            toast.error("Failed to add transaction");
        }
    };

    const filteredCredits = credits.filter(c => {
        if (!startDate && !endDate) return true;
        const d = c.date ? new Date(c.date) : new Date();
        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date(9999, 11, 31);
        return d >= start && d <= end;
    });

    const [historyModal, setHistoryModal] = useState<{ open: boolean; tx: CreditTransaction | null }>({ open: false, tx: null });
    const [productsModal, setProductsModal] = useState<{ open: boolean; tx: CreditTransaction | null }>({ open: false, tx: null });

    return (
        <div className={`flex flex-col h-full bg-white ${!embedded ? 'p-6 rounded-xl shadow-sm border border-gray-200' : 'h-full'}`}>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold flex items-center space-x-2 text-gray-800">
                        <CreditCard className="text-blue-600" />
                        <span>Credit Ledger {supplierName ? `- ${supplierName}` : ''}</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Manage payments and outstanding balances</p>
                </div>
                {!embedded && onClose && (
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                )}
            </div>

            {/* Summary - Ledger Style Layout (Bullet-Proof Zoom Stability) */}
            <div className="space-y-3 mb-6">
                {/* TOTAL PURCHASE */}
                <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                    <div className="text-sm font-semibold text-blue-600 uppercase">
                        Total Purchase
                    </div>
                    <div className="text-lg font-bold text-gray-900 whitespace-nowrap">
                        ₹{summary.totalCredit.toFixed(2)}
                    </div>
                </div>

                {/* TOTAL PAID */}
                <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-4 py-3">
                    <div className="text-sm font-semibold text-green-600 uppercase">
                        Total Paid
                    </div>
                    <div className="text-lg font-bold text-gray-900 whitespace-nowrap">
                        ₹{summary.totalPaid.toFixed(2)}
                    </div>
                </div>

                {/* BALANCE DUE */}
                <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                    <div className="text-sm font-semibold text-red-600 uppercase">
                        Balance Due
                    </div>
                    <div className="text-lg font-bold text-red-700 whitespace-nowrap">
                        ₹{summary.balance.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-2">
                    <div className="flex items-center border rounded-lg px-2 py-1 bg-gray-50">
                        <span className="text-xs text-gray-500 mr-2">From</span>
                        <input type="date" className="bg-transparent text-sm outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="flex items-center border rounded-lg px-2 py-1 bg-gray-50">
                        <span className="text-xs text-gray-500 mr-2">To</span>
                        <input type="date" className="bg-transparent text-sm outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                </div>
                {!hideAddForm && (
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm"
                    >
                        {showAddForm ? <X size={16} /> : <PlusCircle size={16} />}
                        <span>{showAddForm ? 'Cancel' : 'New Entry'}</span>
                    </button>
                )}
            </div>

            {/* Add Form - HIGHLIGHTED */}
            {showAddForm && (
                <form onSubmit={handleAddSubmit} className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200 shadow-md animate-in fade-in slide-in-from-top-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-1">Purchase Amount (Credit)</label>
                            <input
                                ref={amountRef}
                                type="number"
                                className="w-full border border-indigo-200 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                                onKeyDown={(e) => handleEnter(e, hidePaidAmount ? modeRef : paidRef)}
                            />
                        </div>
                        {!hidePaidAmount && (
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-1">Paid Amount (Cash/Bank)</label>
                                <input
                                    ref={paidRef}
                                    type="number"
                                    className="w-full border border-indigo-200 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="0.00"
                                    value={formData.paidAmount}
                                    onChange={e => setFormData({ ...formData, paidAmount: parseFloat(e.target.value) })}
                                    onKeyDown={(e) => handleEnter(e, modeRef)}
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-1">Payment Mode</label>
                            <select
                                ref={modeRef}
                                className="w-full border border-indigo-200 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                value={formData.paymentMode}
                                onChange={e => setFormData({ ...formData, paymentMode: e.target.value as any })}
                                onKeyDown={(e) => handleEnter(e, hideInvoice ? descriptionRef : invoiceRef)}
                            >
                                <option value="CREDIT">Credit (Purchase)</option>
                                <option value="CASH">Cash</option>
                                <option value="ONLINE">Online/UPI</option>
                                <option value="CHEQUE">Cheque</option>
                            </select>
                        </div>
                        {!hideInvoice && (
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-1">Bill No. (Invoice)</label>
                                <input
                                    ref={invoiceRef}
                                    type="text"
                                    className="w-full border border-indigo-200 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g. Bill #1234"
                                    value={formData.invoice}
                                    onChange={e => setFormData({ ...formData, invoice: e.target.value })}
                                    onKeyDown={(e) => handleEnter(e, descriptionRef)}
                                />
                            </div>
                        )}
                        <div className="col-span-2">
                            <label className="block text-sm font-bold text-gray-800 mb-1">Description</label>
                            <input
                                ref={descriptionRef}
                                type="text"
                                className="w-full border border-indigo-200 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Transaction remarks..."
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubmit(e as any); } }}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-1">Date</label>
                            <input
                                type="date"
                                className="w-full border border-indigo-200 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        {!hideSubmitButton && (
                            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700">Record Transaction</button>
                        )}
                    </div>
                </form>
            )}

            {/* Table */}
            <div className={`flex-1 overflow-auto border rounded-lg ${embedded ? 'max-h-[calc(100vh-250px)]' : ''}`}>
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Bill No</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3 text-right">Purchase (Cr)</th>
                            <th className="px-4 py-3 text-right">Paid (Dr)</th>
                            <th className="px-4 py-3 text-center">Mode</th>
                            <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="text-center py-8">Loading...</td></tr>
                        ) : filteredCredits.length === 0 ? (
                            <tr><td colSpan={7} className="text-center py-8 text-gray-400">No transactions found</td></tr>
                        ) : (
                            filteredCredits.map((tx, idx) => (
                                <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{tx.date}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-gray-600">{tx.invoice || '-'}</span>
                                            <button 
                                                onClick={() => setProductsModal({ open: true, tx })}
                                                className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 font-bold hover:bg-blue-600 hover:text-white transition-all whitespace-nowrap"
                                            >
                                                View Products
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">{tx.description || '-'}</td>
                                    <td className="px-4 py-3 text-right text-red-600 font-medium">
                                        {tx.amount > 0 ? `₹${tx.amount.toFixed(2)}` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-green-600 font-medium">
                                        {tx.paidAmount > 0 ? `₹${tx.paidAmount.toFixed(2)}` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded border border-blue-400">
                                            {tx.paymentMode}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button onClick={() => setHistoryModal({ open: true, tx })} className="text-gray-500 hover:text-blue-600" title="View History">
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* History Modal */}
            {historyModal.open && historyModal.tx && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                            <h3 className="text-lg font-bold">Transaction History</h3>
                            <button onClick={() => setHistoryModal({ open: false, tx: null })} className="p-1 hover:bg-gray-200 rounded"><X size={20} /></button>
                        </div>
                        <div className="p-0 overflow-auto max-h-[60vh]">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Date</th>
                                        <th className="px-4 py-2 text-left">Description</th>
                                        <th className="px-4 py-2 text-right">Amount</th>
                                        <th className="px-4 py-2 text-right">Balance</th>
                                        <th className="px-4 py-2 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {historyModal.tx.paymentHistory && historyModal.tx.paymentHistory.length > 0 ? (
                                        historyModal.tx.paymentHistory.map((h, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <div>{h.paymentDate ? format(new Date(h.paymentDate), 'dd MMM yyyy') : '-'}</div>
                                                    <div className="text-xs text-gray-500">{h.paymentMode}</div>
                                                </td>
                                                <td className="px-4 py-3">{h.description || '-'}</td>
                                                <td className="px-4 py-3 text-right font-medium text-green-600">₹{h.amount.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right text-gray-600">₹{h.balanceAfterPayment.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`text-xs px-2 py-1 rounded ${h.statusAfterPayment === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {h.statusAfterPayment}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                                No payment history records found for this transaction.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
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

export default SupplierCreditPanel;
