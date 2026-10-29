// src/components/PurchaseOrderToPrint.tsx
import React from 'react';

interface PurchaseItem {
  id: number;
  name: string;
  mrp: number;
  purchaseQty: number;
  buyRate: number;
  total: number;
}
interface PurchaseOrderProps {
  items: PurchaseItem[];
  supplierName: string;
  billNo: string;
  total: number;
}

export const PurchaseOrderToPrint = React.forwardRef<HTMLDivElement, PurchaseOrderProps>((props, ref) => {
  const { items, supplierName, billNo, total } = props;
  const currentDate = new Date().toLocaleString();

  return (
    <div ref={ref} className="p-8 font-mono text-black">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">PURCHASE ORDER</h1>
        <p className="font-semibold">Lingam Spares</p>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div><p><strong>Supplier:</strong> {supplierName || 'N/A'}</p></div>
        <div className="text-right"><p><strong>Date:</strong> {currentDate}</p></div>
        <div className="text-right"><p><strong>Bill No:</strong> {billNo || 'N/A'}</p></div>
      </div>
      <table className="w-full text-left text-sm mt-4">
        <thead>
          <tr className="border-y border-black">
            <th className="py-1">Item Name</th>
            <th className="py-1 text-center">Qty</th>
            <th className="py-1 text-right">Buy Rate</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-b border-dashed">
              <td className="py-1">{item.name}</td>
              <td className="py-1 text-center">{item.purchaseQty}</td>
              <td className="py-1 text-right">₹{item.buyRate.toFixed(2)}</td>
              <td className="py-1 text-right">₹{item.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-right mt-4 text-xl font-bold">
        GRAND TOTAL: ₹{total.toFixed(2)}
      </div>
    </div>
  );
});