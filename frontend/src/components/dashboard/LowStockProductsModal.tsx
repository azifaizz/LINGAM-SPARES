import React from 'react';
import { X, AlertTriangle, Check } from 'lucide-react';
import { format } from 'date-fns';

interface LowStockProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lowStockProducts: any[];
}

const LowStockProductsModal: React.FC<LowStockProductsModalProps> = ({ isOpen, onClose, lowStockProducts }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-[85vw] max-h-[90vh] flex flex-col border border-slate-100">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center border border-rose-100">
                  <AlertTriangle size={20} />
              </div>
              Action Required: Low Stock
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1 rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-200 shadow-sm">
                <th className="p-4 font-bold text-center w-16">S.No</th>
                <th className="p-4 font-bold whitespace-nowrap">Date</th>
                <th className="p-4 font-bold">Supplier Name</th>
                <th className="p-4 font-bold">Supplier ID</th>
                <th className="p-4 font-bold">Product Name</th>
                <th className="p-4 font-bold text-center">Series</th>
                <th className="p-4 font-bold">Product ID</th>
                <th className="p-4 font-bold">Category</th>
                <th className="p-4 font-bold whitespace-nowrap text-right">Purchase Price</th>
                <th className="p-4 font-bold text-center">Total Qty</th>
                <th className="p-4 font-bold text-center leading-tight">Sold Out<br/><span className="text-[9px] lowercase font-normal">(qty sold)</span></th>
                <th className="p-4 font-bold text-center">Available Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {lowStockProducts.map((p, index) => {
                const isVeryLow = p.stock === 0;
                return (
                  <tr key={index} className={`transition-colors hover:bg-slate-50 ${isVeryLow ? 'bg-rose-50/30' : ''}`}>
                    <td className="p-4 font-bold text-slate-400 text-center">{index + 1}</td>
                    <td className="p-4 text-xs font-bold text-slate-600 whitespace-nowrap">
                       {(() => {
                            try {
                                return p.purchaseDate && !isNaN(new Date(p.purchaseDate).getTime()) 
                                    ? format(new Date(p.purchaseDate), 'dd MMM yyyy') 
                                    : 'N/A';
                            } catch (e) { return 'N/A'; }
                        })()}
                    </td>
                    <td className="p-4 font-bold text-slate-800">{p.vendorName || 'N/A'}</td>
                    <td className="p-4 text-xs text-slate-500 font-mono font-bold">#{p.vendorId?.slice(-8) || 'N/A'}</td>
                    <td className="p-4 font-black text-rose-700 min-w-[200px]">{p.name}</td>
                    <td className="p-4 text-center">
                        <span className="bg-blue-50 text-blue-700 font-mono font-bold text-xs px-2.5 py-1 rounded-md border border-blue-100 block mx-auto w-fit">
                            #{p.hashtagNumber || p.id?.slice(-6) || 'N/A'}
                        </span>
                    </td>
                    <td className="p-4 text-xs text-slate-400 font-mono font-bold">{p.id}</td>
                    <td className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{p.category || 'N/A'}</td>
                    <td className="p-4 text-right font-black text-slate-700">₹{(p.purchaseRate || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                    <td className="p-4 text-center">
                       <span className="font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {(p.qtySold || 0) + (p.stock || 0)}
                       </span>
                    </td>
                    <td className="p-4 text-center">
                       <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          {p.qtySold || 0}
                       </span>
                    </td>
                    <td className="p-4 text-center">
                       <div className={`inline-flex items-center gap-1.5 font-black text-xs px-3 py-1.5 rounded-lg border ${isVeryLow ? 'bg-red-100 text-red-700 border-red-200 animate-pulse' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
                          <AlertTriangle size={14} className={isVeryLow ? 'text-red-600' : 'text-orange-500'} /> 
                          {isVeryLow ? 'OUT OF STOCK' : `${p.stock} LEFT`}
                       </div>
                    </td>
                  </tr>
                )
              })}
              {lowStockProducts.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-16 text-center text-slate-400 font-medium">
                     <div className="flex flex-col flex-1 items-center justify-center opacity-50">
                        <Check size={48} className="text-emerald-500 mb-4" />
                        <h3 className="text-xl font-bold">Inventory looking healthy</h3>
                        <p>No products are currently reporting low stock levels.</p>
                     </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LowStockProductsModal;
