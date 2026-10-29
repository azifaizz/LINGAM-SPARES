import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { X, Info, PackageOpen, Search } from 'lucide-react';
import { billingApi } from '@/lib/api';
import { useGlobalData } from '@/context/GlobalDataContext';

interface BillingHistoryModalProps {
  productId?: string;
  productName?: string;
  onClose: () => void;
}

const BillingHistoryModal = ({ productId: initialProductId, productName: initialProductName, onClose }: BillingHistoryModalProps) => {
  const { products } = useGlobalData();
  const [bills, setBills] = useState<any[]>([]);
  const refreshBills = useCallback(async () => {
    try {
      const res = await billingApi.getAll();
      setBills(Array.isArray(res) ? res : (res as any)?.data || []);
    } catch (e) { console.error("Failed to load bills", e); }
  }, []);
  useEffect(() => { refreshBills(); }, [refreshBills]);

  const [selectedProductId, setSelectedProductId] = useState(initialProductId || '');
  const [selectedProductName, setSelectedProductName] = useState(initialProductName || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.id && p.id.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [searchQuery, products]);

  const handleSelectProduct = (product: any) => {
    setSelectedProductId(product.id);
    setSelectedProductName(product.name);
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const historyRecords = useMemo(() => {
    if (!selectedProductId || !bills) return [];
    return bills
      .filter((bill: any) =>
        bill.items?.some((item: any) => item.productId === selectedProductId)
      )
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5)
      .map((bill: any) => {
        const matchingItem = bill.items.find((item: any) => item.productId === selectedProductId);
        return {
          billNo: bill.id || bill.invoiceNumber || '-',
          date: bill.createdAt ? new Date(bill.createdAt).toLocaleDateString('en-GB') : '-',
          customerName: bill.customerName || '-',
          mobile: bill.customerPhone || '-',
          qty: matchingItem?.quantity || 0,
          rate: matchingItem?.unitPrice || 0,
          discount: matchingItem?.discountRate || 0,
          total: matchingItem?.netAmount || 0,
        };
      });
  }, [selectedProductId, bills]);

  const totals = useMemo(() => {
    return historyRecords.reduce((acc, r) => ({
      qty: acc.qty + r.qty,
      total: acc.total + r.total
    }), { qty: 0, total: 0 });
  }, [historyRecords]);

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p: any) => p.id === selectedProductId) || null;
  }, [selectedProductId, products]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col ring-1 ring-black/5">

        {/* Header */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-5 text-white flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight">Billing History</h2>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/30">
                Last 5 Sales
              </span>
            </div>
            {selectedProductName && (
              <p className="text-gray-300 text-sm mt-1 font-medium flex items-center gap-4">
                <span>Product: <span className="font-mono font-bold text-white">{selectedProductName}</span></span>
                {selectedProductId && (
                  <>
                    <span className="w-px h-3 bg-white/20"></span>
                    <span>ID: <span className="font-mono text-white">{selectedProductId}</span></span>
                  </>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 bg-slate-50 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={selectedProductName ? `Change product (current: ${selectedProductName})` : "Search product by name, ID, or barcode..."}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
                setHighlightedIndex(0);
              }}
              onFocus={() => { if (searchQuery) setIsSearchOpen(true); }}
              onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightedIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
                } else if (e.key === 'Enter' && filteredProducts.length > 0) {
                  e.preventDefault();
                  handleSelectProduct(filteredProducts[highlightedIndex]);
                } else if (e.key === 'Escape') {
                  setIsSearchOpen(false);
                }
              }}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white shadow-sm"
            />
            {isSearchOpen && filteredProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-50 max-h-60 overflow-y-auto">
                {filteredProducts.map((p, idx) => (
                  <div
                    key={p.id}
                    onMouseDown={() => handleSelectProduct(p)}
                    className={`px-4 py-2 cursor-pointer border-b border-gray-50 last:border-0 transition-colors ${idx === highlightedIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-gray-800">{p.name}</div>
                        <div className="text-xs text-gray-400">ID: {p.id} | Barcode: {p.barcode}</div>
                      </div>
                      <div className="text-sm font-semibold text-green-600">₹{p.price}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Summary Info */}
        {selectedProductId && (
          <div className="px-6 py-4 bg-slate-50 border-b flex justify-between items-center">
            <div className="flex items-center gap-2 text-slate-600 font-medium">
              <Info size={16} className="text-blue-500" />
              <span>Showing last {historyRecords.length} sales for this product.</span>
            </div>
            <div className="flex gap-4">
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Total Qty Sold</p>
                <p className="text-lg font-bold text-slate-800">{totals.qty}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Total Revenue</p>
                <p className="text-lg font-black text-blue-700">₹{totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
        )}

        {/* Table Container */}
        <div className="flex-1 overflow-auto bg-white p-6">
          {!selectedProductId ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <PackageOpen size={48} strokeWidth={1.5} />
                <p className="font-medium text-lg">Select a product to view billing history</p>
                <p className="text-sm">Search and select a product above</p>
              </div>
            </div>
          ) : historyRecords.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <PackageOpen size={48} strokeWidth={1.5} />
                <p className="font-medium text-lg">No billing history found</p>
                <p className="text-sm">No bills contain this product</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm text-left border-collapse table-bordered">
              <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-bold sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 border w-12 text-center">S.No</th>
                  <th className="px-4 py-3 border min-w-[120px]">Bill No</th>
                  <th className="px-4 py-3 border w-32">Date</th>
                  <th className="px-4 py-3 border min-w-[150px]">Customer</th>
                  <th className="px-4 py-3 border w-32">Mobile</th>
                  <th className="px-4 py-3 border w-20 text-center">Qty</th>
                  <th className="px-4 py-3 border w-28 text-right">Rate</th>
                  <th className="px-4 py-3 border w-24 text-center">Discount</th>
                  <th className="px-4 py-3 border w-32 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {historyRecords.map((record, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 border text-center text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3 border font-mono font-semibold text-blue-700">{record.billNo}</td>
                    <td className="px-4 py-3 border text-gray-600">{record.date}</td>
                    <td className="px-4 py-3 border font-semibold text-gray-900">{record.customerName}</td>
                    <td className="px-4 py-3 border font-mono text-gray-600">{record.mobile}</td>
                    <td className="px-4 py-3 border text-center font-bold text-gray-700">{record.qty}</td>
                    <td className="px-4 py-3 border text-right font-mono">₹{record.rate}</td>
                    <td className="px-4 py-3 border text-center text-orange-600">{record.discount}%</td>
                    <td className="px-4 py-3 border text-right font-black text-gray-900">₹{record.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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

export default BillingHistoryModal;
