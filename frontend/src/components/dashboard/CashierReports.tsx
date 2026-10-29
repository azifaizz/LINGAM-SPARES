import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { billingApi, Bill } from "@/lib/api";
import { Download, Filter } from "lucide-react";
import { utils, writeFile } from "xlsx";

interface BillItem {
  productName: string;
  quantity: number;
  unitPrice: string | number;
  discountAmount: number;
  gstAmount: number;
  netAmount: number;
  purchaseRate: number;
  paymentMethod?: string;
}

interface Bill {
  id?: string;
  createdAt?: any;
  status?: string;
  paymentMethod?: string;
  items: any[];
  billType?: string;
  finalAmount?: number;
  amountPaid?: number;
}

type PaymentMethod = "all" | "cash" | "card" | "upi" | "partial" | "other";

const CashierReports = () => {
  const [cachedBills, setCachedBills] = useState<Bill[]>([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const refreshLocalBills = useCallback(async () => {
    setBillsLoading(true);
    try {
      const res = await billingApi.getAll();
      setCachedBills(Array.isArray(res) ? res : (res as any)?.data || []);
    } catch (e) { console.error("Failed to load bills", e); }
    finally { setBillsLoading(false); }
  }, []);
  useEffect(() => { refreshLocalBills(); }, [refreshLocalBills]);
  const [data, setData] = useState<any[]>([]);
  const [totalBills, setTotalBills] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod>("all");

  // New State for Cancelled Bills
  const [cancelledBills, setCancelledBills] = useState<Bill[]>([]);
  const [showCancelledModal, setShowCancelledModal] = useState(false);
  const [isCancelledLoading, setIsCancelledLoading] = useState(false);
  const [modalStartDate, setModalStartDate] = useState('');
  const [modalEndDate, setModalEndDate] = useState('');

  // Sync with main dates when modal opens
  useEffect(() => {
    if (showCancelledModal) {
      setModalStartDate(startDate);
      setModalEndDate(endDate);
    }
  }, [showCancelledModal]);

  const parseFloatSafe = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(/[₹,]/g, '').trim();
    return parseFloat(cleaned) || 0;
  };

  const parseDateSafe = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'object') {
      const s = val.seconds || val._seconds;
      if (s !== undefined) return new Date(s * 1000);
      if (typeof val.toDate === 'function') return val.toDate();
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const getDefaultDates = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  };

  const isValidItem = (item: BillItem, bill?: Bill) => {
    const itemPm = (item.paymentMethod || "").trim().toLowerCase();
    if (itemPm) return itemPm !== "hold";
    const billPm = (bill?.paymentMethod || "").trim().toLowerCase();
    return billPm !== "hold";
  };

  const getPaymentMethod = (item: BillItem, bill: Bill) => {
    const status = (bill.status || '').toLowerCase().trim();
    if (status === 'partial') return 'partial';

    const itemPm = (item.paymentMethod || "").trim().toLowerCase();
    if (itemPm && itemPm !== "hold") return itemPm;

    const billPm = (bill.paymentMethod || "").trim().toLowerCase();
    if (billPm && billPm !== "hold") return billPm;

    return "other";
  };

  const fetchReports = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Use cached bills from GlobalDataContext instead of direct API call
      const bills: Bill[] = cachedBills || [];

      const { startDate: defStart, endDate: defEnd } = getDefaultDates();
      const start = new Date(startDate || defStart);
      const end = new Date(endDate || defEnd);
      end.setHours(23, 59, 59, 999);

      const isWithinRange = (dateSource: any) => {
        const d = parseDateSafe(dateSource);
        return d && d >= start && d <= end;
      };

      const validBills = bills.filter((bill) => {
        const pm = (bill.paymentMethod || "").trim().toLowerCase();
        const statusClean = (bill.status || "").toUpperCase().trim();
        const isCancelled = statusClean === "CANCELLED" || pm === "cancelled";
        const isHold = pm === "hold";
        const isEstimate = bill.billType === 'ESTIMATE';
        const isGstInvoice = !bill.billType || bill.billType === 'GST_INVOICE';

        return (
          isWithinRange(bill.createdAt) &&
          // !isCancelled && // Allowing cancelled bills as per request
          !isHold &&
          !isEstimate &&
          isGstInvoice &&
          bill.items?.some(it => isValidItem(it, bill))
        );
      });

      const idSet = new Set<string>();
      validBills.forEach((b) => idSet.add(b.id));
      setTotalBills(idSet.size);

      let serial = 1;

      const salesData = validBills
        .sort((a, b) => {
          const dA = parseDateSafe(a.createdAt);
          const dB = parseDateSafe(b.createdAt);
          return (dB?.getTime() || 0) - (dA?.getTime() || 0);
        })
        .flatMap((bill) =>
          bill.items
            .filter((item) => isValidItem(item, bill))
            .filter((item) =>
              paymentFilter === "all"
                ? true
                : getPaymentMethod(item, bill) === paymentFilter
            )
            .map((item) => {
              const unitPrice = parseFloatSafe(item.unitPrice);
              const subtotal = unitPrice * item.quantity;
              const discountAmount = parseFloatSafe(item.discountAmount || 0);
              const gstAmount = parseFloatSafe(item.gstAmount || 0);
              const discountPercent = subtotal > 0
                ? ((discountAmount / subtotal) * 100).toFixed(2)
                : "0.00";
              const totalExGst = subtotal - discountAmount;
              const parsedDate = parseDateSafe(bill.createdAt);

              return {
                "S.No": serial++,
                "Bill ID": bill.id,
                Date: parsedDate ? parsedDate.toLocaleDateString("en-GB") : "-",
                Product: item.productName,
                Quantity: item.quantity,
                Price: unitPrice.toFixed(2),
                "Discount (₹)": discountAmount.toFixed(2),
                "Discount (%)": discountPercent,
                GST: gstAmount.toFixed(2),
                Total: totalExGst.toFixed(0),
                Paid: (bill as any).amountPaid ? ((parseFloatSafe((bill as any).amountPaid) / bill.items.length)).toFixed(2) : (getPaymentMethod(item, bill) === 'partial' ? '0.00' : totalExGst.toFixed(0)),
                Balance: (bill as any).amountPaid ? (((parseFloatSafe(bill.finalAmount) - parseFloatSafe((bill as any).amountPaid)) / bill.items.length)).toFixed(2) : '0.00',
                "Payment Method": getPaymentMethod(item, bill).toUpperCase(),
                "Status": (bill.status || '').toUpperCase() || 'PAID',
              };
            })
        );

      setData(salesData);
    } catch (err) {
      console.error("Error:", err);
      setError("Failed to load reports.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!billsLoading) {
      fetchReports();
    }
  }, [cachedBills, billsLoading, startDate, endDate, paymentFilter]);

  const fetchCancelledReportsOnly = async () => {
    setIsCancelledLoading(true);
    try {
      // Use cached bills from GlobalDataContext instead of direct API call
      const bills: Bill[] = cachedBills || [];

      const start = modalStartDate ? new Date(modalStartDate) : null;
      const end = modalEndDate ? new Date(modalEndDate) : null;
      if (end) end.setHours(23, 59, 59, 999);

      const filtered = bills.filter(b => {
        const d = parseDateSafe(b.createdAt);
        if (start && d && d < start) return false;
        if (end && d && d > end) return false;

        const pm = (b.paymentMethod || "").trim().toLowerCase();
        const statusClean = (b.status || "").toUpperCase().trim();
        return statusClean === "CANCELLED" || pm === "cancelled";
      });
      setCancelledBills(filtered.sort((a, b) => {
        const dA = parseDateSafe(a.createdAt);
        const dB = parseDateSafe(b.createdAt);
        return (dB?.getTime() || 0) - (dA?.getTime() || 0);
      }));
    } catch (e) {
      console.error(e);
      toast.error("Failed to filter cancelled bills");
    } finally {
      setIsCancelledLoading(false);
    }
  };

  const downloadCancelledExcel = () => {
    if (!cancelledBills.length) return toast.error("No data to export");
    const rows: any[] = [];
    cancelledBills.forEach(bill => {
      if (!bill.items || bill.items.length === 0) {
        rows.push({
          'Bill ID': bill.id,
          'Date': parseDateSafe(bill.createdAt)?.toLocaleDateString('en-GB') || '-',
          'Status': 'CANCELLED',
          'Product': '-',
          'Quantity': 0,
          'Price': 0,
          'Total': 0
        });
      } else {
        bill.items.forEach(item => {
          rows.push({
            'Bill ID': bill.id,
            'Date': parseDateSafe(bill.createdAt)?.toLocaleDateString('en-GB') || '-',
            'Status': 'CANCELLED',
            'Product': item.productName,
            'Quantity': item.quantity,
            'Price': parseFloatSafe(item.unitPrice).toFixed(2),
            'Total': (item.netAmount || 0).toFixed(2)
          });
        });
      }
    });

    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Cancelled Bills");
    writeFile(wb, `Cancelled_Bills_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportExcel = () => {
    if (!data.length) return toast.error("No data to export.");
    const numericKeys = ["Quantity", "Price", "Discount (₹)", "GST", "Total"];
    const totals: any = { "S.No": "Total" };
    data.forEach((row) => {
      numericKeys.forEach((key) => {
        totals[key] = (totals[key] || 0) + parseFloat(String(row[key]).replace("₹", "").trim());
      });
    });
    numericKeys.forEach((key) => { totals[key] = totals[key].toFixed(2); });
    const ws = utils.json_to_sheet([...data, totals]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Sales");
    writeFile(wb, `sales_report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Sales Report</h1>
        <div className="flex gap-3">
          <button onClick={() => { setShowCancelledModal(true); fetchCancelledReportsOnly(); }} className="px-5 py-2.5 bg-red-600 text-white rounded-lg flex items-center gap-2 hover:bg-red-700">
            <Filter size={18} /> View Cancelled
          </button>
          <button onClick={exportExcel} className="px-5 py-2.5 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700">
            <Download size={18} /> Export to Excel
          </button>
        </div>
      </header>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-lg font-semibold text-blue-800">
          Total Paid Bills: <span className="font-bold text-xl">{totalBills}</span>
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm flex flex-wrap items-end gap-4">
        <div>
          <label>From</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input mt-1" />
        </div>
        <div>
          <label>To</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-input mt-1" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-600" />
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as PaymentMethod)} className="form-input mt-1">
            <option value="all">All Payments</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="partial">PARTIAL</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10">Loading...</div>
      ) : error ? (
        <div className="text-center py-10 text-red-600">{error}</div>
      ) : (
        <ReportTable data={data} totalBills={totalBills} />
      )}

      {showCancelledModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b bg-red-50 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-red-800">Cancelled Bills</h2>
                <p className="text-sm text-red-600">History of deleted or voided transactions</p>
              </div>
              <button onClick={() => setShowCancelledModal(false)} className="text-gray-500 hover:text-red-600 text-3xl font-bold transition-colors">&times;</button>
            </div>

            <div className="p-4 border-b bg-gray-50 flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">From</label>
                <input type="date" value={modalStartDate} onChange={e => setModalStartDate(e.target.value)} className="border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">To</label>
                <input type="date" value={modalEndDate} onChange={e => setModalEndDate(e.target.value)} className="border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <button
                onClick={fetchCancelledReportsOnly}
                disabled={isCancelledLoading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
              >
                {isCancelledLoading ? 'Filtering...' : 'Filter'}
              </button>
              <button
                onClick={downloadCancelledExcel}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition shadow-sm flex items-center gap-2"
              >
                <Download size={18} /> Export List
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
              {isCancelledLoading ? (
                <div className="text-center py-20 text-gray-400">Loading cancelled records...</div>
              ) : cancelledBills.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-gray-400 text-lg">No cancelled bills found for the selected range.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cancelledBills.map(b => (
                    <div key={b.id} className="border border-red-100 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-3 border-b border-red-50 pb-2">
                        <div>
                          <p className="font-bold text-red-800 text-lg">#{b.id}</p>
                          <p className="text-xs text-gray-500">{parseDateSafe(b.createdAt)?.toLocaleString('en-GB')}</p>
                        </div>
                        <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded uppercase">Cancelled</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-400 text-left text-[11px] uppercase">
                            <th className="pb-1 font-semibold">Item</th>
                            <th className="pb-1 text-center font-semibold">Qty</th>
                            <th className="pb-1 text-right font-semibold">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-700">
                          {b.items.map((it, idx) => (
                            <tr key={idx} className="border-t border-gray-50">
                              <td className="py-1.5 truncate max-w-[150px]" title={it.productName}>{it.productName}</td>
                              <td className="py-1.5 text-center">{it.quantity}</td>
                              <td className="py-1.5 text-right font-medium">₹{parseFloatSafe(it.netAmount).toFixed(0)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-red-100 font-bold text-red-800">
                            <td colSpan={2} className="pt-2 text-[12px]">TOTAL VALUE</td>
                            <td className="pt-2 text-right text-base text-red-900 line-through decoration-red-400/50">
                              ₹{b.items.reduce((s, i) => s + parseFloatSafe(i.netAmount), 0).toFixed(0)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ReportTable = ({ data, totalBills }: { data: any[]; totalBills: number }) => {
  if (!data.length) return <div className="text-center py-10 text-gray-500">No data available.</div>;
  const headers = Object.keys(data[0] || {});
  const moneyCols = new Set(["Price", "Discount (₹)", "GST", "Total", "Paid", "Balance"]);
  const totals: Record<string, number> = {};

  data.forEach((row) => {
    headers.forEach((h) => {
      if (h === "Quantity" || moneyCols.has(h)) {
        if (row["Status"] === "CANCELLED") return; // Skip cancelled from totals

        const value = parseFloat(String(row[h]).replace("₹", "").trim());
        if (!isNaN(value)) totals[h] = (totals[h] || 0) + value;
      }
    });
  });

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-x-auto mt-4">
      <table className="w-full text-left">
        <thead className="bg-gray-50 border-b">
          <tr>
            {headers.map((key, i) => (
              <th key={i} className="p-4 font-semibold text-gray-700">{key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-t hover:bg-gray-50">
              {headers.map((key) => (
                <td key={key} className="p-4">{moneyCols.has(key) ? `₹${row[key]}` : row[key]}</td>
              ))}
            </tr>
          ))}
          <tr className="border-t font-bold bg-green-50 text-green-900">
            {headers.map((key) => {
              if (key === "S.No") return <td key={key} className="p-4">TOTAL</td>;
              if (key === "Bill ID") return <td key={key} className="p-4">{totalBills}</td>;
              if (totals[key] !== undefined) return <td key={key} className="p-4">{moneyCols.has(key) ? "₹" : ""}{totals[key].toFixed(2)}</td>;
              return <td key={key} className="p-4"></td>;
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default CashierReports;
