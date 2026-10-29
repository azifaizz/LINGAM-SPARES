import React, { useMemo } from 'react';
import { X, Info, PackageOpen } from 'lucide-react';
import { useGlobalData } from '@/context/GlobalDataContext';

interface ViewProductsModalProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: any;
}

const ViewProductsModal: React.FC<ViewProductsModalProps> = ({ isOpen, onClose, transaction }) => {
    const { products: globalProducts } = useGlobalData();
    
    const formatQty = (value: any) => {
        const num = Number(value);
        if (isNaN(num)) return value;
        return num.toString();
    };

    // Use embedded products if available, otherwise filter global products
    const products = useMemo(() => {
        if (!isOpen || !transaction) return [];
        
        // Priority 1: Use products already in the transaction object
        if (transaction.products && Array.isArray(transaction.products) && transaction.products.length > 0) {
            return transaction.products;
        }
        
        // Priority 2: Filter global products by creditTransactionId
        if (transaction.id) {
            return globalProducts.filter(p => p.creditTransactionId === transaction.id);
        }
        
        return [];
    }, [isOpen, transaction, globalProducts]);

    const totals = useMemo(() => {
        return products.reduce((acc, p) => {
            const qty = p.stockQuantity || 0;
            const buyAfterGst = p.purchaseRate || 0; // In this system, purchaseRate is inclusive of GST
            const total = buyAfterGst * qty;

            return {
                qty: acc.qty + qty,
                total: acc.total + total
            };
        }, { qty: 0, total: 0 });
    }, [products]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col ring-1 ring-black/5">

                {/* Header */}
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-5 text-white flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold tracking-tight">Purchase Bill Details</h2>
                            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/30">
                                Read Only
                            </span>
                        </div>
                        <p className="text-gray-300 text-sm mt-1 font-medium flex items-center gap-4">
                            <span>Bill No: <span className="font-mono font-bold text-white">{transaction?.invoice || 'N/A'}</span></span>
                            <span className="w-px h-3 bg-white/20"></span>
                            <span>Date: <span className="text-white">{transaction?.date ? new Date(transaction.date).toLocaleDateString() : '-'}</span></span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Summary Info */}
                <div className="px-6 py-4 bg-slate-50 border-b flex justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <Info size={16} className="text-blue-500" />
                        <span>Showing {products.length} products purchased in this bill.</span>
                    </div>
                    <div className="flex gap-4">
                        <div className="text-right">
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Total Qty</p>
                            <p className="text-lg font-bold text-slate-800">{formatQty(totals.qty)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Bill Total</p>
                            <p className="text-lg font-black text-blue-700">₹{totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                </div>

                {/* Table Container */}
                <div className="flex-1 overflow-auto bg-white p-6">
                    <table className="w-full text-sm text-left border-collapse table-bordered">
                        <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-bold sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 border w-12 text-center">S.No</th>
                                <th className="px-4 py-3 border min-w-[200px]">Product Name</th>
                                <th className="px-4 py-3 border w-36">HSN/SAC</th>
                                <th className="px-4 py-3 border w-32 text-right">Buy Before GST</th>
                                <th className="px-4 py-3 border w-32 text-right">Buy After GST</th>
                                <th className="px-4 py-3 border w-24 text-center">Qty</th>
                                <th className="px-4 py-3 border w-36 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 text-gray-400">
                                            <PackageOpen size={48} strokeWidth={1.5} />
                                            <p className="font-medium text-lg">No products found for this bill.</p>
                                            <p className="text-sm">Either no items were linked or they have been removed from the product list.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : products.map((p, idx) => {
                                const buyAfter = p.purchaseRate || 0;
                                const gstRate = p.purchaseGst || 0;
                                const buyBefore = buyAfter / (1 + (gstRate / 100));
                                const rowTotal = buyAfter * (p.stockQuantity || 0);

                                return (
                                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 border text-center text-gray-500">{idx + 1}</td>
                                        <td className="px-4 py-3 border font-semibold text-gray-900">{p.name || 'Unknown Product'}</td>
                                        <td className="px-4 py-3 border font-mono text-gray-600">{p.taxCode || p.barcode || '-'}</td>
                                        <td className="px-4 py-3 border text-right text-gray-600">
                                            <span>₹{buyBefore.toFixed(2)}</span>
                                        </td>
                                        <td className="px-4 py-3 border text-right font-bold text-gray-900">
                                            <span>₹{buyAfter.toFixed(2)}</span>
                                        </td>
                                        <td className="px-4 py-3 border text-center font-bold text-gray-700">
                                            <span>{formatQty(p.stockQuantity)}</span>
                                        </td>
                                        <td className="px-4 py-3 border text-right font-black text-gray-900">
                                            <span>₹{rowTotal.toFixed(2)}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-100 transition-all shadow-sm"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ViewProductsModal;
