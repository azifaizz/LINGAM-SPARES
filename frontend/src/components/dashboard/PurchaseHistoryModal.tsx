import React, { useState, useMemo, useEffect } from 'react';
import { X, Info, PackageOpen, Search } from 'lucide-react';
import { useGlobalData } from '@/context/GlobalDataContext';
import { vendorApi } from '@/lib/api';

interface PurchaseHistoryModalProps {
  productId?: string;
  productName?: string;
  vendorId?: string;
  onClose: () => void;
}

const PurchaseHistoryModal = ({ productId: initialProductId, productName: initialProductName, vendorId: initialVendorId, onClose }: PurchaseHistoryModalProps) => {
  const { products } = useGlobalData();

  const [selectedProductId, setSelectedProductId] = useState(initialProductId || '');
  const [selectedProductName, setSelectedProductName] = useState(initialProductName || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.id && p.id.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [searchQuery, products]);

  const handleSelectProduct = async (product: any) => {
    setSelectedProductId(product.id);
    setSelectedProductName(product.name);
    setSearchQuery('');
    setIsSearchOpen(false);
    await fetchHistory(product.id, product.vendorId);
  };

  const fetchHistory = async (pId: string, vId?: string) => {
    const product = products.find((p: any) => p.id === pId);
    const vendorIdToUse = vId || product?.vendorId || initialVendorId;
    if (!vendorIdToUse || !pId) {
      setHistoryRecords([]);
      return;
    }

    setLoading(true);
    try {
      const res = await vendorApi.getCredits(vendorIdToUse);
      const txns = (res.data || [])
        .filter((tx: any) => tx.products && Array.isArray(tx.products) && tx.products.some((p: any) => p.id === pId))
        .sort((a: any, b: any) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime())
        .slice(0, 5)
        .map((tx: any) => {
          const productInTx = tx.products?.find((p: any) => p.id === pId);
          return {
            date: tx.date || tx.createdAt ? new Date(tx.date || tx.createdAt).toLocaleDateString('en-GB') : '-',
            supplierName: product?.vendorName || '-',
            supplierId: vendorIdToUse,
            purchaseRate: productInTx?.purchaseRate || productInTx?.price || 0,
            sellingRate: productInTx?.sellingPrice || product?.price || 0,
            wholesaleRate: (productInTx as any)?.wholesaleSellingPrice || (productInTx as any)?.wholesalePrice || product?.wholesalePrice || product?.wholesaleSellingPrice || 0,
            qty: productInTx?.stockQuantity || productInTx?.quantity || 0,
            currentStock: product?.stockQuantity || 0,
          };
        });
      setHistoryRecords(txns);
    } catch (err) {
      console.error('Failed to fetch purchase history:', err);
      setHistoryRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialProductId) {
      const product = products.find((p: any) => p.id === initialProductId);
      if (product) {
        fetchHistory(initialProductId, product.vendorId);
      }
    }
  }, [initialProductId, products]);

  const totals = useMemo(() => {
    return historyRecords.reduce((acc, r) => ({
      qty: acc.qty + r.qty,
      total: acc.total + (r.purchaseRate * r.qty)
    }), { qty: 0, total: 0 });
  }, [historyRecords]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col ring-1 ring-black/5">

        {/* Header */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-5 text-white flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight">Purchase History</h2>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/30">
                Last 5 Purchases
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
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm bg-white shadow-sm"
            />
            {isSearchOpen && filteredProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-50 max-h-60 overflow-y-auto">
                {filteredProducts.map((p, idx) => (
                  <div
                    key={p.id}
                    onMouseDown={() => handleSelectProduct(p)}
                    className={`px-4 py-2 cursor-pointer border-b border-gray-50 last:border-0 transition-colors ${idx === highlightedIndex ? 'bg-green-100' : 'hover:bg-green-50'}`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-gray-800">{p.name}</div>
                        <div className="text-xs text-gray-400">ID: {p.id} | Barcode: {p.barcode}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-blue-600">Buy: ₹{p.purchaseRate}</div>
                        <div className="text-xs text-green-600">Sell: ₹{p.price}</div>
                      </div>
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
              <span>Showing last {historyRecords.length} purchases for this product.</span>
            </div>
            <div className="flex gap-4">
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Total Qty Purchased</p>
                <p className="text-lg font-bold text-slate-800">{totals.qty}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Total Purchase Value</p>
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
                <p className="font-medium text-lg">Select a product to view purchase history</p>
                <p className="text-sm">Search and select a product above</p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                <p className="font-medium text-lg">Loading purchase history...</p>
              </div>
            </div>
          ) : historyRecords.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <PackageOpen size={48} strokeWidth={1.5} />
                <p className="font-medium text-lg">No purchase history found</p>
                <p className="text-sm">No credit transactions contain this product</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm text-left border-collapse table-bordered">
              <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-bold sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 border w-12 text-center">S.No</th>
                  <th className="px-4 py-3 border w-32">Date</th>
                  <th className="px-4 py-3 border min-w-[150px]">Supplier</th>
                  <th className="px-4 py-3 border min-w-[120px]">Supplier ID</th>
                  <th className="px-4 py-3 border w-28 text-right">Buy Rate</th>
                  <th className="px-4 py-3 border w-28 text-right">Sell Rate</th>
                  <th className="px-4 py-3 border w-24 text-center">Qty</th>
                  <th className="px-4 py-3 border w-28 text-center">Current Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {historyRecords.map((record, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 border text-center text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3 border text-gray-600">{record.date}</td>
                    <td className="px-4 py-3 border font-semibold text-gray-900">{record.supplierName}</td>
                    <td className="px-4 py-3 border font-mono text-xs text-gray-500">{record.supplierId}</td>
                    <td className="px-4 py-3 border text-right font-mono font-bold text-gray-900">₹{record.purchaseRate}</td>
                    <td className="px-4 py-3 border text-right font-mono text-green-700">₹{record.sellingRate}</td>
                    <td className="px-4 py-3 border text-center font-bold text-gray-700">{record.qty}</td>
                    <td className="px-4 py-3 border text-center font-black text-orange-600">{record.currentStock}</td>
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

export default PurchaseHistoryModal;
