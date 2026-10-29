import React from 'react';
import { APP_CONFIG } from '@/config';

// --- THIS IS THE FIX for the 'items' error ---
// We now explicitly tell this component that each item will have a subtotal.
interface BillItem {
  id: number;
  name: string;
  price: number;
  billQty: number;
  subtotal: number;
}
// ---------------------------------------------

interface BillProps {
  items: BillItem[];
  total: number;
  subTotal: number;
  discount: number;
  billNo: string;
  customerName?: string;
}

export const BillToPrint = React.forwardRef<HTMLDivElement, BillProps>((props, ref) => {
  const { items, total, subTotal, discount, billNo, customerName } = props;
  const currentDate = new Date().toLocaleString();

  return (
    <div ref={ref} className="p-8 font-mono text-black">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{APP_CONFIG.COMPANY_NAME}</h1>
        <p>{APP_CONFIG.ADDRESS_LINE_1}</p>
        <p>Date: {currentDate}</p>
        {customerName && <p>Customer: {customerName}</p>}
        <p className="border-t border-b border-dashed border-black my-4 py-2 text-xl">INVOICE</p>
      </div>
      <table className="w-full text-left mt-4 text-sm">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1">Item</th>
            <th className="py-1 text-center">Qty</th>
            <th className="py-1 text-right">Price</th>
            <th className="py-1 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td className="py-1">{item.name}</td>
              <td className="py-1 text-center">{item.billQty}</td>
              <td className="py-1 text-right">₹{item.price.toFixed(2)}</td>
              <td className="py-1 text-right">₹{item.subtotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t-2 border-dashed border-black mt-6 pt-4 text-base">
        <div className="flex justify-between"><span>Sub Total:</span> <span>₹{subTotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Discount:</span> <span>- ₹{discount.toFixed(2)}</span></div>
        <div className="flex justify-between font-bold text-lg mt-2"><span>GRAND TOTAL:</span> <span>₹{total.toFixed(2)}</span></div>
      </div>
      <div className="text-center mt-8"><p className="font-semibold">Thank you for your purchase!</p></div>
    </div>
  );
});