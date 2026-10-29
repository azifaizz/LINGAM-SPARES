import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Trash2, CheckCircle, Clock, Pencil, Save, X, User, Phone, FileText, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { brokerApi, Broker, Commission } from '@/lib/api';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useConfirm } from '@/hooks/useConfirm';
import { useGlobalData } from '@/context/GlobalDataContext';
import { useAuth } from '@/context/AuthContext';

const Brokers = () => {
    const { user } = useAuth();
    const isAdmin = user?.role?.toLowerCase() === 'admin';
    const { brokers, refreshBrokers, mutateBrokers, isSyncing: globalSyncing } = useGlobalData();
    const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [localSyncing, setLocalSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedCategory, setSelectedCategory] = useState("ALL");

    const isSyncing = globalSyncing || localSyncing;
    const { confirm: confirmAction, ConfirmationDialog } = useConfirm();

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', phone: '', address: '', gstNo: '', category: '', commissionPercentage: 0 });

    const nameRef = useRef<HTMLInputElement>(null);
    const phoneRef = useRef<HTMLInputElement>(null);
    const addressRef = useRef<HTMLInputElement>(null);
    const gstRef = useRef<HTMLInputElement>(null);
    const categoryRef = useRef<HTMLInputElement>(null);

    const handleEnter = (e: React.KeyboardEvent, nextRef: React.RefObject<any>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextRef.current?.focus();
        }
    };

    // Data already loaded by GlobalDataContext on login — no need to refresh on mount.

    useEffect(() => {
        if (selectedBroker) {
            fetchCommissions(selectedBroker.id);
        } else {
            setCommissions([]);
        }
    }, [selectedBroker]);

    const [error, setError] = useState<string | null>(null);

    const fetchCommissions = async (id: string) => {
        if (!id) return;
        setLocalSyncing(true);
        setError(null);
        try {
            const res = await brokerApi.getCommissions(id);
            if (res && res.data && Array.isArray(res.data)) {
                setCommissions(res.data);
            } else {
                setCommissions([]);
            }
        } catch (error: any) {
            console.error("Failed to fetch commissions", error);
            if (error.response && error.response.status === 500) {
                // Specific helpful message for the known backend bug
                setError("Backend Error: Server crashed (500). This is likely due to the Invalid Security Annotation (@PreAuthorize) in the BrokerController.");
                // Do not toast for this specific error to avoid spamming the user
            } else {
                setError("Failed to load commissions. Please check your connection.");
                toast.error("Failed to load commissions.");
            }
            setCommissions([]);
        } finally {
            setLocalSyncing(false);
        }
    };

    const handleOpenModal = (broker?: Broker) => {
        if (!isAdmin) {
            toast.error("Only Admin can add or edit Sales Reps.");
            return;
        }
        if (broker) {
            setEditingId(broker.id);
            setFormData({
                name: broker.name,
                phone: broker.phone,
                address: broker.address || '',
                gstNo: broker.gstNo || '',
                category: broker.category || '',
                commissionPercentage: broker.commissionPercentage || 0
            });
        } else {
            setEditingId(null);
            setFormData({ name: '', phone: '', address: '', gstNo: '', category: '', commissionPercentage: 0 });
        }
        setIsModalOpen(true);
    };

    const handleSaveBroker = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdmin) {
            toast.error("Only Admin can save Sales Reps.");
            return;
        }
        if (!formData.name || !formData.phone) {
            toast.error("Name and Phone are required.");
            return;
        }

        setIsLoading(true);
        try {
            if (editingId) {
                await brokerApi.update(editingId, formData);
                toast.success("Sales Rep updated successfully!");
                // Update local state if selected
                if (selectedBroker?.id === editingId) {
                    setSelectedBroker({ ...selectedBroker, ...formData });
                }
            } else {
                await brokerApi.add({
                    ...formData
                });
                toast.success("Sales Rep added successfully!");
            }
            setIsModalOpen(false);
            setFormData({ name: '', phone: '', address: '', gstNo: '', category: '', commissionPercentage: 0 });
            refreshBrokers();
        } catch (error) {
            console.error("Failed to save Sales Rep", error);
            toast.error("Failed to save Sales Rep.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleMarkPaidClick = (commission: Commission) => {
        if (!isAdmin) {
            toast.error("Only Admin can settle commissions.");
            return;
        }
        confirmAction(
            `Are you sure you want to mark commission of ₹${commission.amount} as PAID?`,
            async () => {
                try {
                    await brokerApi.updateStatus(commission.id, 'PAID');
                    toast.success("Commission marked as PAID.");
                    setCommissions(prev => prev.map(c => c.id === commission.id ? { ...c, status: 'PAID' } : c));
                } catch (error) {
                    toast.error("Action failed.");
                }
            },
            'Mark as Paid?',
            undefined,
            { confirmText: 'Yes, Mark Paid', variant: 'info' }
        );
    };

    const handleDeleteClick = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!isAdmin) {
            toast.error("Only Admin can delete Sales Reps.");
            return;
        }
        confirmAction(
            "This action cannot be undone. All history will be lost.",
            async () => {
                try {
                    await brokerApi.delete(id);
                    mutateBrokers(prev => prev.filter(b => b.id !== id));
                    toast.success("Sales Rep deleted.");
                    if (selectedBroker?.id === id) {
                        setSelectedBroker(null);
                    }
                } catch (error) {
                    toast.error("Delete failed.");
                }
            },
            'Delete Sales Rep?'
        );
    };

    const categories = [
        "ALL",
        ...new Set(
            brokers
                .map(rep => rep.category)
                .filter(Boolean)
        )
    ];

    const filteredBrokers = brokers.filter(e => {
        const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.phone.includes(searchTerm);
        const matchesCategory = selectedCategory === "ALL" || e.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const filteredCommissions = commissions.filter(c => {
        if (!c.date) return true;
        const commDate = new Date(c.date);

        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (commDate < start) return false;
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (commDate > end) return false;
        }

        return true;
    });

    const totalPending = filteredCommissions.filter(c => c.status === 'UNPAID').reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const totalPaid = filteredCommissions.filter(c => c.status === 'PAID').reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    return (
        <div className="flex h-[calc(100vh-100px)] gap-6">
            <ConfirmationDialog />
            {/* Left Panel: List */}
            <div className="w-1/3 bg-white rounded-lg shadow-sm flex flex-col">
                <div className="p-4 border-b">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-800">Sales Rep</h2>
                        <SyncIndicator isSyncing={isSyncing} />
                        {isAdmin && (
                            <button
                                onClick={() => handleOpenModal()}
                                className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                                title="Add New Sales Rep"
                            >
                                <Plus size={20} />
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by name or phone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-gray-700 min-w-[100px]"
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-y-auto flex-grow">
                    {filteredBrokers.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 flex flex-col items-center gap-2">
                            <span>No Sales Rep found.</span>
                            <button
                                onClick={() => refreshBrokers()}
                                className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                            >
                                Refresh List
                            </button>
                        </div>
                    ) : (
                        filteredBrokers.map(el => (
                            <div
                                key={el.id}
                                onClick={() => setSelectedBroker(el)}
                                className={`p-4 border-b cursor-pointer transition-colors hover:bg-gray-50 flex justify-between items-center group ${selectedBroker?.id === el.id ? 'bg-blue-50 border-blue-200' : ''}`}
                            >
                                <div>
                                    <div className="font-semibold text-gray-800">{el.name}</div>
                                    <div className="text-sm text-gray-500">{el.phone}</div>
                                </div>
                                {isAdmin && (
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleOpenModal(el); }}
                                            className="text-blue-500 hover:text-blue-700 p-1"
                                            title="Edit"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteClick(el.id, e)}
                                            className="text-red-400 hover:text-red-600 p-1"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Panel: Ledger */}
            <div className="w-2/3 flex flex-col gap-6">
                {selectedBroker ? (
                    <>
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 shrink-0">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                        <User className="text-gray-400" size={28} /> {selectedBroker.name}
                                    </h1>
                                    <div className="text-sm text-gray-500 mt-1">Sales Rep ID: <span className="font-mono">{selectedBroker.id}</span></div>
                                </div>
                                {isAdmin && (
                                    <button
                                        onClick={() => handleOpenModal(selectedBroker)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Edit Sales Rep Details"
                                    >
                                        <Pencil size={20} />
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="flex items-start gap-3">
                                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600 mt-1"><Phone size={18} /></div>
                                    <div>
                                        <div className="text-xs font-semibold text-gray-500 uppercase">Phone</div>
                                        <div className="font-medium text-gray-900">{selectedBroker.phone || 'N/A'}</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-purple-100 p-2 rounded-lg text-purple-600 mt-1"><FileText size={18} /></div>
                                    <div>
                                        <div className="text-xs font-semibold text-gray-500 uppercase">GST Number</div>
                                        <div className="font-medium text-gray-900">{selectedBroker.gstNo || 'N/A'}</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-gray-100 p-2 rounded-lg text-gray-600 mt-1"><MapPin size={18} /></div>
                                    <div>
                                        <div className="text-xs font-semibold text-gray-500 uppercase">Address</div>
                                        <div className="font-medium text-gray-900 text-sm">{selectedBroker.address || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summary Card */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-500">
                                <div className="text-gray-500 text-sm font-medium uppercase tracking-wide">Total Pending</div>
                                <div className="text-3xl font-bold text-orange-600 mt-1">₹{totalPending.toFixed(2)}</div>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
                                <div className="text-gray-500 text-sm font-medium uppercase tracking-wide">Total Paid</div>
                                <div className="text-3xl font-bold text-green-600 mt-1">₹{totalPaid.toFixed(2)}</div>
                            </div>
                        </div>

                        {/* Ledger Table */}
                        <div className="bg-white rounded-lg shadow-sm flex-grow flex flex-col overflow-hidden">
                            <div className="p-4 border-b bg-gray-50 flex justify-between items-center gap-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">Commission Ledger</h3>

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
                            <div className="overflow-y-auto flex-grow">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="p-4 font-semibold text-gray-600 text-sm">Date</th>
                                            <th className="p-4 font-semibold text-gray-600 text-sm">Bill ID</th>
                                            <th className="p-4 font-semibold text-gray-600 text-sm text-right">Amount</th>
                                            <th className="p-4 font-semibold text-gray-600 text-sm text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {error ? (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center">
                                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 inline-block max-w-lg">
                                                        <h4 className="text-red-800 font-bold mb-1">Unable to Load Data</h4>
                                                        <p className="text-red-600 text-sm">{error}</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredCommissions.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-gray-400">No commission history found.</td></tr>
                                        ) : (
                                            filteredCommissions.map((comm) => (
                                                <tr key={comm.id} className="hover:bg-gray-50">
                                                    <td className="p-4 text-sm text-gray-600">
                                                        {new Date(comm.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        <div className="text-xs text-gray-400">{new Date(comm.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </td>
                                                    <td className="p-4 text-sm font-mono text-blue-600">{comm.billId}</td>
                                                    <td className="p-4 text-sm font-bold text-right">₹{Number(comm.amount).toFixed(2)}</td>
                                                    <td className="p-4 text-center">
                                                        <button
                                                            onClick={() => isAdmin && comm.status === 'UNPAID' && handleMarkPaidClick(comm)}
                                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${comm.status === 'PAID'
                                                                ? 'bg-green-100 text-green-700'
                                                                : isAdmin
                                                                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 cursor-pointer active:scale-95'
                                                                    : 'bg-orange-100 text-orange-700 cursor-default opacity-80'
                                                                }`}
                                                            title={comm.status === 'UNPAID' ? (isAdmin ? "Click to Mark Paid" : "Only Admin can mark commission as paid") : ""}
                                                            disabled={!isAdmin || comm.status === 'PAID'}
                                                        >
                                                            {comm.status === 'PAID' ? <CheckCircle size={12} /> : <Clock size={12} />}
                                                            {comm.status}
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
                    <div className="flex-grow flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        <div className="text-center text-gray-400">
                            <Search size={48} className="mx-auto mb-4 opacity-20" />
                            <p>Select a Sales Rep to view their ledger.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">{editingId ? 'Edit Sales Rep' : 'Add New Sales Rep'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-800"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSaveBroker} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                                <input
                                    ref={nameRef}
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    onKeyDown={(e) => handleEnter(e, phoneRef)}
                                    className="w-full form-input rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                                <input
                                    ref={phoneRef}
                                    type="text"
                                    value={formData.phone}
                                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                                    onKeyDown={(e) => handleEnter(e, addressRef)}
                                    className="w-full form-input rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                <input
                                    ref={addressRef}
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                    onKeyDown={(e) => handleEnter(e, gstRef)}
                                    className="w-full form-input rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">GST No. (Optional)</label>
                                <input
                                    ref={gstRef}
                                    type="text"
                                    value={formData.gstNo}
                                    onChange={(e) => setFormData(prev => ({ ...prev, gstNo: e.target.value }))}
                                    onKeyDown={(e) => handleEnter(e, categoryRef)}
                                    className="w-full form-input rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category (Optional)</label>
                                <input
                                    ref={categoryRef}
                                    type="text"
                                    value={formData.category}
                                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                    className="w-full form-input rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
                                    placeholder="e.g. Field, Office, Prime"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    {isLoading ? 'Saving...' : <><Save size={18} /> {editingId ? 'Update Sales Rep' : 'Add Sales Rep'}</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


        </div>
    );
};

export default Brokers;
