import React, { useState, useEffect } from 'react';
import { staffApi, Commission } from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle, Clock, DollarSign, Search, Filter, CreditCard } from 'lucide-react';
import { format } from 'date-fns';

const CommissionLedger = () => {
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchCommissions = async () => {
        setLoading(true);
        try {
            const res = await staffApi.getAllCommissions(selectedMonth);
            if (Array.isArray(res.data)) {
                setCommissions(res.data);
            }
        } catch (error) {
            console.error("Failed to fetch commissions", error);
            toast.error("Failed to load commissions");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCommissions();
    }, [selectedMonth]);

    const handlePay = async (id: string) => {
        try {
            await staffApi.payCommission(id);
            toast.success("Commission marked as paid");
            fetchCommissions();
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const filteredCommissions = commissions.filter(c => {
        const matchesSearch =
            (c.staffName?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
            (c.billId?.toLowerCase().includes(searchTerm.toLowerCase()) || '');

        const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;

        let matchesDate = true;
        if (c.date) {
            const commDate = new Date(c.date);
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                if (commDate < start) matchesDate = false;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (commDate > end) matchesDate = false;
            }
        }

        return matchesSearch && matchesStatus && matchesDate;
    });

    const totalUnpaid = commissions
        .filter(c => c.status === 'UNPAID')
        .reduce((sum, c) => sum + (c.staffCommissionAmount || c.commissionAmount || c.amount || 0), 0);

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Header / stats */}
            <div className="flex gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex-1 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Pending Payouts</p>
                        <h2 className="text-3xl font-bold text-orange-600 mt-1">₹{totalUnpaid.toLocaleString()}</h2>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-full">
                        <DollarSign size={24} className="text-orange-600" />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by staff or bill ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-gray-50"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-gray-500" />
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="border rounded-lg p-2 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                        value={statusFilter}
                        onChange={(e: any) => setStatusFilter(e.target.value)}
                        className="border rounded-lg p-2 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="ALL">All Status</option>
                        <option value="UNPAID">Unpaid</option>
                        <option value="PAID">Paid</option>
                    </select>

                </div>
                <button onClick={fetchCommissions} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="Refresh">
                    <Loader2 size={18} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center gap-4">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">
                        <CreditCard size={16} className="text-blue-600" /> Commission Ledger
                    </h3>

                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 border rounded-lg bg-white px-2 py-1">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="text-xs outline-none bg-transparent"
                            />
                            <span className="text-gray-400 text-xs shadow-none">to</span>
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
                                className="text-xs text-red-500 hover:text-red-700 font-medium px-1"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 font-semibold text-gray-600 text-xs uppercase tracking-wider">Date</th>
                                <th className="p-4 font-semibold text-gray-600 text-xs uppercase tracking-wider">Staff</th>
                                <th className="p-4 font-semibold text-gray-600 text-xs uppercase tracking-wider">Bill Reference</th>
                                <th className="p-4 font-semibold text-gray-600 text-xs uppercase tracking-wider text-right">Commission</th>
                                <th className="p-4 font-semibold text-gray-600 text-xs uppercase tracking-wider text-center">Status</th>
                                <th className="p-4 font-semibold text-gray-600 text-xs uppercase tracking-wider text-center">Payment Date</th>
                                <th className="p-4 font-semibold text-gray-600 text-xs uppercase tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading && commissions.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-gray-400"><Loader2 className="animate-spin mx-auto mb-2" /> Loading...</td></tr>
                            ) : filteredCommissions.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-gray-400">No commissions found.</td></tr>
                            ) : (
                                filteredCommissions.map((comm) => (
                                    <tr key={comm.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-sm text-gray-500">
                                            {(() => {
                                                if (!comm.date) return '-';
                                                const d = new Date(comm.date);
                                                return isNaN(d.getTime()) ? '-' : format(d, 'dd MMM yyyy');
                                            })()}
                                        </td>
                                        <td className="p-4 text-sm font-medium text-gray-900">
                                            {comm.staffName || 'Unknown Staff'}
                                            <div className="text-xs text-gray-400">ID: {comm.staffId?.substring(0, 6)}</div>
                                        </td>
                                        <td className="p-4 text-sm font-mono text-blue-600">{comm.billId}</td>
                                        <td className="p-4 text-sm font-bold text-right text-gray-800">
                                            ₹{(comm.staffCommissionAmount || comm.commissionAmount || comm.amount || 0).toLocaleString()}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${comm.status === 'PAID'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {comm.status === 'PAID' ? <CheckCircle size={10} /> : <Clock size={10} />}
                                                {comm.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center text-sm text-gray-500">
                                            {(() => {
                                                if (comm.status !== 'PAID') return '-';
                                                if (!comm.paidDate) return '-';
                                                const d = new Date(comm.paidDate);
                                                return isNaN(d.getTime()) ? '-' : format(d, 'dd MMM yyyy');
                                            })()}
                                        </td>
                                        <td className="p-4 text-right">
                                            {comm.status === 'UNPAID' && (
                                                <button
                                                    onClick={() => handlePay(comm.id)}
                                                    className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors shadow-sm"
                                                >
                                                    Mark as Paid
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CommissionLedger;
