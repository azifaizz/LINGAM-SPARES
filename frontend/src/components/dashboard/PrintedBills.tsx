import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { billingService, billingApi, estimationApi, SalesReturn } from "@/lib/api";
import { utils, writeFile } from "xlsx";
import { Printer, FileText, Search, FileSpreadsheet, Calculator, RefreshCw, X, CreditCard, Trash2, Eye, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { APP_CONFIG } from '@/config';
import { useAuth } from '@/context/AuthContext';
import { useGlobalData } from '@/context/GlobalDataContext';

import { renderToStaticMarkup } from 'react-dom/server';
import ProfessionalTaxInvoice from '../print/ProfessionalTaxInvoice';
import { numberToWords } from '@/utils/numberToWords';
import { EstimationPrint } from './Estimation';

interface BillItem {
  productName: string;
  quantity: number;
  discountRate: number;
  unitPrice: number;
  netAmount: number;
  gstRate: number;
  unit?: string;
  productId?: string;
  // Sales Return tracking — quantity of this line already returned
  returnedQty?: number;
}

interface Bill {
  id: string;
  invoiceId?: string;
  invoiceNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  items: BillItem[];
  finalAmount: number;
  paymentMethod: string;
  cashAmount?: number;
  onlineAmount?: number;
  status: string;
  createdAt: string;
  billType?: string;
  estimationId?: string;
  vehicleNo?: string;
  dispatchThrough?: string;
  destination?: string;
  termsOfDelivery?: string;
  transportAmount?: number;
  transportGstRate?: number;
  isShipToDifferent?: boolean;
  shipToName?: string;
  shipToPhone?: string;
  shipToEmail?: string;
  shipToAddress?: string;
  shipToGst?: string;
  paidAmount?: number;
  paymentHistory?: any[];
  // Sales Return summary
  returnedAmount?: number;
  fullyReturned?: boolean;
}

const PrintedBills: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewMode, setViewMode] = useState<'PRINTED' | 'ESTIMATION'>('PRINTED');
  const { user, loading: authLoading } = useAuth();

  const [shopName] = useLocalStorage("shopName_v3", APP_CONFIG.COMPANY_NAME);
  const [gstNumberRaw] = useLocalStorage("gstNumber_v4", "33BJLPN3590D1Z7");
  const gstNumber = !gstNumberRaw || gstNumberRaw === '33JPNPK3337F1ZR' ? '33BJLPN3590D1Z7' : gstNumberRaw;
  const { mutateProducts, refreshSalesReturns } = useGlobalData();

  // Payment Tracking State
  const [payModal, setPayModal] = useState<{ open: boolean; bill: Bill | null }>({ open: false, bill: null });
  const [historyModal, setHistoryModal] = useState<{ open: boolean; bill: Bill | null }>({ open: false, bill: null });
  const [previewModal, setPreviewModal] = useState<{ open: boolean; bill: Bill | null }>({ open: false, bill: null });
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    mode: 'CASH' as 'CASH' | 'UPI' | 'ONLINE' | 'CHEQUE',
    remarks: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Sales Return Modal State
  const [srModalOpen, setSrModalOpen] = useState(false);
  const [srTab, setSrTab] = useState<'search' | 'history'>('search');
  const [srSearch, setSrSearch] = useState('');
  const [srStartDate, setSrStartDate] = useState('');
  const [srEndDate, setSrEndDate] = useState('');
  const [srSearchResults, setSrSearchResults] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [srReturnProducts, setSrReturnProducts] = useState<{
    productId: string;
    productName: string;
    originalQty: number;
    previouslyReturned: number;
    returnQty: number;
    remainingReturnable: number;
    unitPrice: number;
    gstRate: number;
    discountRate: number;
    discountAmount: number;
    amountBeforeGst: number;
    gstAmount: number;
    amountAfterGst: number;
  }[]>([]);
  const [srRemarks, setSrRemarks] = useState('');
  const [isProcessingSR, setIsProcessingSR] = useState(false);
  // Sales Return history tab state
  const [srHistoryResults, setSrHistoryResults] = useState<SalesReturn[]>([]);
  const [srHistorySearch, setSrHistorySearch] = useState('');
  const [srHistoryStartDate, setSrHistoryStartDate] = useState('');
  const [srHistoryEndDate, setSrHistoryEndDate] = useState('');
  // Cancel sales return modal
  const [cancelSrModal, setCancelSrModal] = useState<{ open: boolean; sr: SalesReturn | null }>({ open: false, sr: null });
  const [cancelReason, setCancelReason] = useState('');
  const [isCancellingSr, setIsCancellingSr] = useState(false);
  // Generic confirm dialog (mirrors reference project)
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; message: string; onConfirm: () => void }>({ open: false, message: '', onConfirm: () => { } });

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // Fetch bills directly (no stale closure)
      let allBills: Bill[] = [];
      try {
        const billRes = await billingApi.getAll();
        const billData = Array.isArray(billRes.data) ? billRes.data : (Array.isArray(billRes) ? billRes : []);
        allBills = [...billData];
      } catch (billErr) {
        console.warn("Bills fetch failed:", billErr);
      }

      // Dedicated Estimations (non-blocking on failure)
      try {
        const estimationRes = await estimationApi.getAll();
        const dedicatedEstimations = Array.isArray(estimationRes.data) ? estimationRes.data : [];
        const mappedEstimations = dedicatedEstimations.map((e: any) => ({
          ...e,
          invoiceId: e.estimationId || e.id,
          billType: 'ESTIMATE',
          paymentMethod: 'ESTIMATE'
        }));
        allBills = [...allBills, ...mappedEstimations];
      } catch (estErr) {
        console.warn("Estimations fetch failed (continuing with bills only):", estErr);
      }



      const sorted = allBills.sort(
        (a: Bill, b: Bill) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setBills(sorted);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      toast.error("Failed to load history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

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

  // ------------------------------------------------------------------
  // Sales Return helpers
  //
  // NOTE ON GST MATH: Raju stores unitPrice as a GST-INCLUSIVE amount (see the
  // backend calculateBillTotals). The reference project branches on a
  // Retail/Wholesale systemType that Raju does not have, so we always use the
  // inclusive ("retail") formula to stay consistent with how bills are created.
  // ------------------------------------------------------------------
  const computeSrLineTotals = (
    unitPrice: number,
    qty: number,
    discountRate: number,
    gstRate: number
  ) => {
    const beforeDiscount = unitPrice * qty;
    const discountAmount = beforeDiscount * (discountRate / 100);
    const amountAfterDiscount = beforeDiscount - discountAmount;
    const taxable = amountAfterDiscount / (1 + gstRate / 100);
    const gstAmount = amountAfterDiscount - taxable;
    return { discountAmount, amountBeforeGst: taxable, gstAmount, amountAfterGst: amountAfterDiscount };
  };

  const openSrModal = () => {
    setSrModalOpen(true);
    setSrTab('search');
    setSrSearch('');
    setSrStartDate('');
    setSrEndDate('');
    setSrSearchResults([]);
    setSelectedBill(null);
    setSrReturnProducts([]);
    setSrRemarks('');
  };

  const handleSrSearch = (query: string) => {
    setSrSearch(query);
    const q = query.toLowerCase().trim();
    if (!q && !srStartDate && !srEndDate) {
      setSrSearchResults([]);
      return;
    }
    const results = filteredData.filter(item => {
      if (q) {
        const id = (item.invoiceId || item.invoiceNumber || item.id || "").toLowerCase();
        const name = (item.customerName || "").toLowerCase();
        const phone = (item.customerPhone || "").toString();
        if (!id.includes(q) && !name.includes(q) && !phone.includes(q)) return false;
      }
      if (srStartDate) {
        const billDate = new Date(item.createdAt || "");
        const start = new Date(srStartDate);
        start.setHours(0, 0, 0, 0);
        if (billDate < start) return false;
      }
      if (srEndDate) {
        const billDate = new Date(item.createdAt || "");
        const end = new Date(srEndDate);
        end.setHours(23, 59, 59, 999);
        if (billDate > end) return false;
      }
      return true;
    });
    setSrSearchResults(results);
  };

  const handleSrSelectBill = (bill: Bill) => {
    setSelectedBill(bill);
    const products = (bill.items || []).map(item => {
      const qty = Number(item.quantity) || 0;
      const prevReturned = Number(item.returnedQty) || 0;
      const price = Number(item.unitPrice) || 0;
      const discountRate = Number(item.discountRate) || 0;
      const gstRate = Number(item.gstRate) || 0;

      return {
        productId: item.productId || "",
        productName: item.productName || "",
        originalQty: qty,
        previouslyReturned: prevReturned,
        returnQty: 0,
        remainingReturnable: qty - prevReturned,
        unitPrice: price,
        gstRate: gstRate,
        discountRate: discountRate,
        discountAmount: 0,
        amountBeforeGst: 0,
        gstAmount: 0,
        amountAfterGst: 0
      };
    });
    setSrReturnProducts(products);
  };

  const handleSrReturnQtyChange = (index: number, qty: number) => {
    setSrReturnProducts(prev => prev.map((p, i) => {
      if (i === index) {
        const clamped = Math.max(0, Math.min(qty, p.remainingReturnable));
        const totals = computeSrLineTotals(p.unitPrice, clamped, p.discountRate, p.gstRate);
        return {
          ...p,
          returnQty: clamped,
          discountAmount: totals.discountAmount,
          amountBeforeGst: totals.amountBeforeGst,
          gstAmount: totals.gstAmount,
          amountAfterGst: totals.amountAfterGst
        };
      }
      return p;
    }));
  };

  const totalSrReturnAmount = srReturnProducts.reduce((sum, p) => sum + p.amountAfterGst, 0);

  const handleProcessSalesReturn = async () => {
    if (!selectedBill || !selectedBill.id) {
      toast.error("No bill selected");
      return;
    }
    const productsWithReturn = srReturnProducts.filter(p => p.returnQty > 0);
    if (productsWithReturn.length === 0) {
      toast.error("Please set at least one product return quantity");
      return;
    }
    for (const p of productsWithReturn) {
      if (p.returnQty > p.remainingReturnable) {
        toast.error(`Cannot return ${p.returnQty} of ${p.productName}. Remaining: ${p.remainingReturnable}`);
        return;
      }
    }
    setConfirmDialog({
      open: true,
      message: `Process sales return of ₹${totalSrReturnAmount.toFixed(2)}? Stock will be restored and the bill will be updated.`,
      onConfirm: async () => {
        setIsProcessingSR(true);
        try {
          await billingApi.processSalesReturn(selectedBill.id!, {
            returnedProducts: productsWithReturn.map(p => ({
              productId: p.productId,
              productName: p.productName,
              originalQty: p.originalQty,
              previouslyReturned: p.previouslyReturned,
              returnQty: p.returnQty,
              remainingReturnable: p.remainingReturnable,
              unitPrice: p.unitPrice,
              gstRate: p.gstRate,
              discountRate: p.discountRate,
              discountAmount: p.discountAmount,
              amountBeforeGst: p.amountBeforeGst,
              gstAmount: p.gstAmount,
              amountAfterGst: p.amountAfterGst
            })),
            remarks: srRemarks
          });
          toast.success("Sales return processed successfully");
          await fetchAllData();
          await refreshSalesReturns();
          setSrModalOpen(false);
          setSelectedBill(null);
          setSrReturnProducts([]);
          setSrRemarks('');
        } catch (error: any) {
          toast.error(error.response?.data?.message || "Failed to process sales return");
        } finally {
          setIsProcessingSR(false);
          setConfirmDialog({ open: false, message: '', onConfirm: () => { } });
        }
      }
    });
  };

  const handleLoadSrHistory = async () => {
    try {
      const res = await billingApi.getSalesReturnsByRange(
        srHistoryStartDate || '2024-01-01',
        srHistoryEndDate || '2030-12-31'
      );
      setSrHistoryResults(res.data || []);
    } catch (err) {
      toast.error("Failed to load sales return history");
    }
  };

  const handleCancelSalesReturn = (sr: SalesReturn) => {
    setCancelSrModal({ open: true, sr });
    setCancelReason('');
  };

  const handleConfirmCancelSr = async () => {
    if (!cancelSrModal.sr) return;
    setIsCancellingSr(true);
    try {
      await billingApi.cancelSalesReturn(cancelSrModal.sr.id!, { reason: cancelReason });
      toast.success("Sales return cancelled, stock restored");
      setCancelSrModal({ open: false, sr: null });
      await fetchAllData();
      await refreshSalesReturns();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to cancel sales return");
    } finally {
      setIsCancellingSr(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!payModal.bill || !payModal.bill.id) return;
    const pendingAmount = payModal.bill.finalAmount - (payModal.bill.paidAmount || 0);

    if (paymentData.amount <= 0 || paymentData.amount > pendingAmount) {
      toast.error("Invalid payment amount");
      return;
    }

    setIsProcessing(true);
    try {
      const newPaid = (payModal.bill.paidAmount || 0) + paymentData.amount;
      const historyEntry = {
        amount: paymentData.amount,
        paymentMode: paymentData.mode,
        description: paymentData.remarks,
        paymentDate: new Date().toISOString(),
        balanceAfterPayment: payModal.bill.finalAmount - newPaid,
        statusAfterPayment: (payModal.bill.finalAmount - newPaid) <= 0 ? 'PAID' : 'PARTIAL'
      };

      const updatedHistory = [...(payModal.bill.paymentHistory || []), historyEntry];

      const updatedEstimation = {
        ...payModal.bill,
        paidAmount: newPaid,
        amountPaid: newPaid, // Keep both for safety
        paymentHistory: updatedHistory,
        status: (payModal.bill.finalAmount - newPaid) <= 0 ? 'PAID' : 'PARTIAL'
      } as any;

      // Use the actual estimationId (e.g. '001') if it exists, otherwise fall back to invoiceId or id.
      // This prevents the backend from creating a new UUID-keyed document.
      const targetId = payModal.bill.estimationId || payModal.bill.invoiceId || payModal.bill.id;
      
      // Call existing update API
      await estimationApi.update(targetId, updatedEstimation);

      // Replace existing estimation in state instead of adding new / reloading
      setBills(prev => prev.map(b => (b.estimationId || b.invoiceId || b.id) === targetId ? { 
        ...b, 
        paidAmount: newPaid, 
        amountPaid: newPaid,
        paymentHistory: updatedHistory,
        status: (payModal.bill!.finalAmount - newPaid) <= 0 ? 'PAID' : (b.status || 'PENDING')
      } : b));

      toast.success("Payment recorded successfully");
      setPayModal({ open: false, bill: null });
      setPaymentData({ amount: 0, mode: 'CASH', remarks: '' });
    } catch (error) {
      console.error("Payment failed", error);
      toast.error("Failed to record payment");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredData = bills.filter((bill) => {
    // 1. View Mode Filtering
    if (viewMode === 'PRINTED') {
      // Show only real bills that are NOT estimates, NOT proformas, and NOT held
      if (bill.billType === 'ESTIMATE' || bill.paymentMethod === 'HOLD' || bill.billType === 'PROFORMA') return false;
    } else {
      // Show only ESTIMATES or HELD bills
      if (bill.billType !== 'ESTIMATE' && bill.paymentMethod !== 'HOLD') return false;
    }

    // 2. Date Filtering
    const isCashier = user?.role === 'Cashier';
    const billDate = new Date(bill.createdAt);

    if (isCashier) {
      const today = new Date();
      const isToday =
        billDate.getDate() === today.getDate() &&
        billDate.getMonth() === today.getMonth() &&
        billDate.getFullYear() === today.getFullYear();
      if (!isToday) return false;
    } else {
      if (startDate) {
        const [y, m, d] = startDate.split('-').map(Number);
        const start = new Date(y, m - 1, d, 0, 0, 0, 0);
        if (billDate < start) return false;
      }
      if (endDate) {
        const [y, m, d] = endDate.split('-').map(Number);
        const end = new Date(y, m - 1, d, 23, 59, 59, 999);
        if (billDate > end) return false;
      }
    }

    // 3. Search Filtering
    if (!searchTerm) return true;
    const lower = searchTerm.toLowerCase();
    const invoice = (bill.invoiceId || bill.id || "").toLowerCase();
    const name = (bill.customerName || "").toLowerCase();
    const phone = (bill.customerPhone || "").toString();

    return (
      invoice.includes(lower) ||
      name.includes(lower) ||
      phone.includes(searchTerm)
    );
  });

  const totalFilteredAmount = filteredData.reduce((sum, bill) => {
    const taxableTotal = (bill.items || []).reduce((acc, item) => {
      const itemSubtotal = item.unitPrice * item.quantity;
      const discountValue = itemSubtotal * (item.discountRate / 100);
      return acc + (itemSubtotal - discountValue);
    }, 0);
    return sum + taxableTotal;
  }, 0);

  const handleExportExcel = () => {
    if (!filteredData.length) {
      toast.error("No records to export.");
      return;
    }

    const data = filteredData.map((bill, i) => ({
      "S.No": i + 1,
      "ID": bill.invoiceId || bill.id,
      "Customer Name": bill.customerName || "Walk-in",
      Contact: bill.customerPhone || "N/A",
      "Date & Time": new Date(bill.createdAt).toLocaleString("en-GB"),
      Items: bill.items.length,
      "Final Amount": bill.finalAmount,
      "Type": bill.billType || bill.paymentMethod,
    }));

    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    const sheetName = viewMode === 'PRINTED' ? 'Bills' : 'Estimations';
    utils.book_append_sheet(wb, ws, sheetName);
    writeFile(wb, `${sheetName}_History.xlsx`);
  };

  const handleReprint = (bill: Bill) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocked!");
      return;
    }

    const companyData = {
      name: "Lingam Spares",
      address: "No:32,Ground Floor , pattala street, kanchipuram - 631501",
      phone: "9626956999",
      email: "lingamspares@gmail.com",
      gstin: gstNumber || "33BJLPN3590D1Z7",
      pan: "FFFPS9148J",
      state: "Tamil Nadu",
      bankName: "",
      accountNo: "",
      ifsc: "",
      branch: ""
    };

    let html = "";
    if (viewMode === 'PRINTED') {
      html = renderToStaticMarkup(
        <ProfessionalTaxInvoice
          bill={bill as any}
          items={bill.items as any || []}
          company={companyData}
          numberToWords={numberToWords}
        />
      );
    } else {
      const totalQty = bill.items.filter((item: any) => item.productId !== 'TRANSPORT_CHARGE').reduce((sum, item) => sum + Number(item.quantity), 0);
      const grandTotal = bill.finalAmount;
      const printItems = bill.items.map(item => ({
        name: item.productName,
        qty: item.quantity,
        unit: item.unit,
        rate: item.unitPrice,
        discount: item.discountRate,
        total: item.netAmount
      }));

      html = renderToStaticMarkup(
        <EstimationPrint
          company={companyData}
          estimation={{ id: bill.invoiceId || bill.id, date: new Date(bill.createdAt).toLocaleDateString('en-GB') }}
          customer={{
            name: bill.customerName || "Walk-in",
            phone: bill.customerPhone || "-",
            address: bill.customerAddress || "",
            shippingAddress: bill.customerAddress || ""
          }}
          items={printItems}
          totals={{ totalQty, grandTotal, amountInWords: numberToWords(grandTotal) }}
          printedAt={new Date().toLocaleString('en-GB')}
        />
      );
    }

    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>${viewMode === 'PRINTED' ? 'Invoice' : 'Estimation'} - ${bill.invoiceId || bill.id}</title>
          ${viewMode === 'PRINTED' ? `
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; }
          </style>` : ""}
        </head>
        <body onload="window.print(); window.close();">${html}</body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDeleteBill = async (bill: Bill) => {
    const billId = bill.id || bill.invoiceId || bill.invoiceNumber || "";
    const isEstimation = bill.billType === 'ESTIMATE';
    const deleteType = isEstimation ? 'estimation' : 'bill';
    
    if (!window.confirm(`Are you sure you want to delete this ${deleteType} ${billId}? This will revert products and remove related reports.`)) return;

    // Save previous snapshot for rollback if network fails
    const previousBills = [...bills];
    const deletedBill = bills.find(b => b.id === billId || b.invoiceId === billId);

    // 1. INSTANT OPTIMISTIC UI: Remove from list in 0ms so user never waits
    setBills(prev => prev.filter(b => b.id !== billId && b.invoiceId !== billId));

    // Immediately restore stock in local state
    if (deletedBill?.items?.length) {
      mutateProducts(prev =>
        prev.map(product => {
          const billItem = deletedBill.items.find(
            (i: any) => i.productId === product.id || i.productName === product.name
          );
          if (!billItem) return product;
          return {
            ...product,
            stockQuantity: (product.stockQuantity || 0) + (billItem.quantity || 0)
          };
        })
      );
    }

    const toastId = toast.loading(`Deleting ${deleteType} ${billId}...`);
    
    try {
      if (isEstimation) {
        await billingService.delete(`/estimations/${encodeURIComponent(bill.invoiceId || bill.id)}`);
      } else {
        await billingService.delete(`/billing/delete/${billId}`);
      }

      toast.success(`${deleteType.toUpperCase()} deleted successfully`, { id: toastId });
    } catch (error) {
      console.error("Delete failed", error);
      // Rollback UI if delete failed
      setBills(previousBills);
      toast.error(`Failed to delete ${deleteType}. Restored.`, { id: toastId });
    }
  };

  return (
    <motion.div
      className="p-6 bg-gray-50 min-h-screen space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <FileText className="text-blue-600" /> Bills History
        </h1>

        {/* Unified Toggle aligned with Billing styles */}
        <div className="flex bg-gray-200 rounded-lg p-1">
          <button
            onClick={() => setViewMode('PRINTED')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'PRINTED'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-500 hover:bg-gray-300'}`}
          >
            PRINTED BILLS
          </button>
          <button
            onClick={() => setViewMode('ESTIMATION')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'ESTIMATION'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-500 hover:bg-gray-300'}`}
          >
            ESTIMATIONS
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-grow sm:w-1/2 lg:w-1/3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={`Search ${viewMode === 'PRINTED' ? 'Invoice' : 'Estimation'}, Name...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input w-full pl-12"
          />
        </div>

        <div className="flex gap-2 items-center">
          {user?.role === 'Cashier' ? (
            <div className="px-4 py-2 bg-blue-50 text-blue-800 font-bold rounded-lg border border-blue-200">
              Date: {new Date().toLocaleDateString('en-GB')}
            </div>
          ) : (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="form-input px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <span className="self-center text-gray-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="form-input px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </>
          )}
        </div>

        <button
          onClick={handleExportExcel}
          className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <FileSpreadsheet size={18} /> Export {viewMode === 'PRINTED' ? 'Bills' : 'Estimations'}
        </button>

        {viewMode === 'PRINTED' && (
          <button
            onClick={openSrModal}
            className="px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 flex items-center gap-2 transition-all shadow-sm"
          >
            <RotateCcw size={18} /> Sales Return
          </button>
        )}

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
            <span className="text-gray-600 font-medium">Count:</span>
            <span className="text-lg font-bold text-blue-700">
              {filteredData.length}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100">
            <span className="text-gray-600 font-medium">Total:</span>
            <span className="text-lg font-bold text-indigo-700">
              ₹{Math.round(totalFilteredAmount).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-4 text-gray-500 font-medium tracking-wide">Fetching data...</p>
        </div>
      ) : (
        <motion.div className="bg-white/80 rounded-2xl shadow-lg overflow-hidden border border-blue-100">
          <div className="overflow-x-auto text-[13px]">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="p-4 font-semibold text-gray-700">{viewMode === 'PRINTED' ? 'Invoice ID' : 'Estimation ID'}</th>
                  <th className="p-4 font-semibold text-gray-700">Customer Name</th>
                  <th className="p-4 font-semibold text-gray-700">Contact</th>
                  <th className="p-4 font-semibold text-gray-700">Date & Time</th>
                  <th className="p-4 text-center font-semibold text-gray-700">Items</th>
                  <th className="p-4 text-right font-semibold text-gray-700">Final Amount</th>
                  {viewMode === 'ESTIMATION' && (
                    <>
                      <th className="p-4 text-right font-semibold text-gray-700">Paid Amount</th>
                      <th className="p-4 text-right font-semibold text-gray-700">Pending</th>
                      <th className="p-4 text-center font-semibold text-gray-700">Status</th>
                      <th className="p-4 text-center font-semibold text-gray-700">History</th>
                    </>
                  )}
                  <th className="p-4 text-center font-semibold text-gray-700">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredData.length ? (
                  filteredData.map((bill) => (
                    <motion.tr
                      key={bill.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="hover:bg-gray-50 border-b border-gray-100 even:bg-gray-50/50 transition-colors group"
                    >
                      <td className="p-4 font-semibold text-blue-700">{bill.invoiceNumber || bill.invoiceId || bill.id}</td>
                      <td className="p-4 font-semibold text-gray-800">{bill.customerName || "Walk-in"}</td>
                      <td className="p-4 text-gray-500">{bill.customerPhone || "N/A"}</td>
                      <td className="p-4 text-gray-500">{new Date(bill.createdAt).toLocaleString("en-GB")}</td>
                      <td className="p-4 text-center">
                        <span className="px-3 py-1 bg-gray-100 rounded-full font-bold">{bill.items.length}</span>
                      </td>
                      <td className="p-4 text-right font-bold text-gray-900">₹{bill.finalAmount.toFixed(2)}</td>
                      
                      {viewMode === 'ESTIMATION' && (
                        <>
                          <td className="p-4 text-right font-semibold text-green-600">₹{(bill.paidAmount || 0).toLocaleString()}</td>
                          <td className="p-4 text-right font-semibold text-red-600">₹{(bill.finalAmount - (bill.paidAmount || 0)).toLocaleString()}</td>
                          <td className="p-4 text-center">
                            <span 
                              onClick={() => {
                                if (bill.finalAmount - (bill.paidAmount || 0) > 0) {
                                  setPayModal({ open: true, bill });
                                  setPaymentData({ amount: bill.finalAmount - (bill.paidAmount || 0), mode: 'CASH', remarks: '' });
                                }
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all shadow-sm ${
                                (bill.finalAmount - (bill.paidAmount || 0)) <= 0 
                                  ? 'bg-green-100 text-green-700 cursor-default' 
                                  : 'bg-red-50 text-red-700 hover:bg-red-100'
                              }`}
                            >
                              {(bill.finalAmount - (bill.paidAmount || 0)) <= 0 ? 'PAID' : 'PENDING'}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <button 
                              onClick={() => setHistoryModal({ open: true, bill })}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="View History"
                            >
                              <RefreshCw size={16} />
                            </button>
                          </td>
                        </>
                      )}

                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setPreviewModal({ open: true, bill })}
                            className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                            title="View Invoice"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => handleReprint(bill)}
                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                            title="Print"
                          >
                            <Printer size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteBill(bill)}
                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={viewMode === 'ESTIMATION' ? 11 : 7} className="text-center p-20 text-gray-400 italic">
                      No records found for the selected criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Pay Modal */}
      {payModal.open && payModal.bill && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 p-6 text-white relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <CreditCard size={80} />
              </div>
              <h2 className="text-xl font-bold relative z-10 tracking-tight">Record Payment</h2>
              <p className="text-blue-50 text-sm mt-1 relative z-10 opacity-90">{payModal.bill.customerName || 'Walk-in'} � {payModal.bill.invoiceId || payModal.bill.id}</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Amount</p>
                  <p className="text-lg font-bold text-slate-800 font-mono">₹{payModal.bill.finalAmount.toLocaleString()}</p>
                </div>
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 shadow-sm">
                  <p className="text-[10px] text-rose-500 uppercase font-bold tracking-wider">Outstanding</p>
                  <p className="text-lg font-bold text-rose-700 font-mono">₹{(payModal.bill.finalAmount - (payModal.bill.paidAmount || 0)).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Payment Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">?</span>
                  <input
                    type="number"
                    className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-xl pl-8 pr-4 py-3 focus:bg-white focus:border-blue-500 focus:ring-0 outline-none transition-all font-bold text-lg"
                    value={paymentData.amount || ''}
                    autoFocus
                    placeholder="0.00"
                    onChange={e => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-[10px] text-gray-400">Enter amount to pay</p>
                  <button
                    onClick={() => setPaymentData({ ...paymentData, amount: payModal.bill!.finalAmount - (payModal.bill!.paidAmount || 0) })}
                    className="text-[10px] text-blue-600 font-bold hover:underline"
                  >
                    Pay Full Balance
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Payment Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {['CASH', 'UPI', 'ONLINE', 'CHEQUE'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setPaymentData({ ...paymentData, mode: mode as any })}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border-2 transition-all duration-200 ${paymentData.mode === mode
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-600 text-blue-700 shadow-sm'
                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600'
                        }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Remarks (Optional)</label>
                <textarea
                  className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-xl p-3 text-sm focus:bg-white focus:border-blue-500 focus:ring-0 outline-none transition-all min-h-[80px]"
                  placeholder="Add payment notes here..."
                  value={paymentData.remarks}
                  onChange={e => setPaymentData({ ...paymentData, remarks: e.target.value })}
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setPayModal({ open: false, bill: null })}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200/50 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handlePaymentSubmit}
                disabled={isProcessing || paymentData.amount <= 0 || paymentData.amount > (payModal.bill.finalAmount - (payModal.bill.paidAmount || 0))}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
              >
                {isProcessing ? <RefreshCw size={18} className="animate-spin" /> : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModal.open && historyModal.bill && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-50 via-white to-white px-6 py-5 flex justify-between items-center border-b border-indigo-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 rounded-full -mr-16 -mt-16 blur-3xl"></div>
              <div className="relative z-10">
                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  <RefreshCw size={20} className="text-blue-600" />
                  <span>Payment History</span>
                </h2>
                <p className="text-slate-500 text-sm mt-0.5 font-medium">
                  {historyModal.bill.customerName || 'Walk-in'} <span className="mx-2 text-slate-300">�</span> Invoice: <span className="font-mono text-blue-600 font-bold">{historyModal.bill.invoiceId || historyModal.bill.id}</span>
                </p>
              </div>
              <button
                onClick={() => setHistoryModal({ open: false, bill: null })}
                className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all duration-200"
              >
                <X size={18} strokeWidth={3} />
              </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-6 px-6 py-6 border-b bg-slate-50/50">
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <p className="text-[10px] text-slate-500 uppercase font-extrabold tracking-widest mb-1">Total Bill</p>
                <p className="text-xl font-black text-slate-800 font-mono">
                  ₹{historyModal.bill.finalAmount.toLocaleString()}
                </p>
              </div>
              <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 shadow-sm">
                <p className="text-[10px] text-green-600 uppercase font-extrabold tracking-widest mb-1">Total Paid</p>
                <p className="text-xl font-black text-green-600 font-mono">
                  ₹{(historyModal.bill.paidAmount || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 shadow-sm">
                <p className="text-[10px] text-rose-600 uppercase font-extrabold tracking-widest mb-1">Outstanding</p>
                <p className="text-xl font-black text-rose-600 font-mono">
                  ₹{(historyModal.bill.finalAmount - (historyModal.bill.paidAmount || 0)).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="max-h-[420px] overflow-y-auto">
              {!historyModal.bill.paymentHistory || historyModal.bill.paymentHistory.length === 0 ? (
                <div className="p-12 text-center text-gray-400 text-sm italic">
                  No payment records available for this transaction.
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-100 text-gray-600 uppercase text-xs sticky top-0 z-10">
                    <tr>
                      <th className="px-5 py-3 text-left">Date</th>
                      <th className="px-5 py-3 text-right">Paid Amount</th>
                      <th className="px-5 py-3 text-center">Mode</th>
                      <th className="px-5 py-3 text-right">Balance After</th>
                      <th className="px-5 py-3 text-left">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyModal.bill.paymentHistory.map((entry: any, i: number) => (
                      <tr
                        key={i}
                        className="border-b hover:bg-indigo-50/40 transition-colors duration-150"
                      >
                        <td className="px-5 py-3 text-gray-800 font-medium">
                          {new Date(entry.paymentDate).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-green-600">
                          ₹{entry.amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="px-3 py-1 text-[10px] font-bold rounded-full border bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border-slate-200 uppercase tracking-tighter">
                            {entry.paymentMode}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-800">
                          ₹{entry.balanceAfterPayment.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-gray-600 text-xs">
                          {entry.description || '�'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-5 bg-gradient-to-t from-slate-50/80 to-white border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setHistoryModal({ open: false, bill: null })}
                className="px-10 py-2.5 text-sm font-bold bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 transition-all duration-200 shadow-sm"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewModal.open && previewModal.bill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center text-white">
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  {viewMode === 'PRINTED' ? 'Tax Invoice Preview' : 'Estimation Preview'}
                </h2>
                <p className="text-white/80 text-sm mt-0.5">
                  {previewModal.bill.customerName || 'Walk-in'} - {previewModal.bill.invoiceId || previewModal.bill.id}
                </p>
              </div>
              <button
                onClick={() => setPreviewModal({ open: false, bill: null })}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              <div className="bg-white shadow-lg rounded-lg overflow-hidden" style={{ transform: 'scale(0.65)', transformOrigin: 'top center', minHeight: '600px' }}>
                {viewMode === 'PRINTED' ? (
                  <ProfessionalTaxInvoice
                    bill={previewModal.bill as any}
                    items={previewModal.bill.items as any || []}
                    company={{
                      name: "Lingam Spares",
                      address: "No:32,Ground Floor , pattala street, kanchipuram - 631501",
                      phone: "9626956999",
                      email: "lingamspares@gmail.com",
                      gstin: gstNumber || "33BJLPN3590D1Z7",
                      pan: "FFFPS9148J",
                      state: "Tamil Nadu",
                      bankName: "",
                      accountNo: "",
                      ifsc: "",
                      branch: ""
                    }}
                    numberToWords={numberToWords}
                  />
                ) : (() => {
                  const bill = previewModal.bill;
                  const totalQty = bill.items.filter((item: any) => item.productId !== 'TRANSPORT_CHARGE').reduce((sum, item) => sum + Number(item.quantity), 0);
                  const grandTotal = bill.finalAmount;
                  const printItems = bill.items.map(item => ({
                    name: item.productName,
                    qty: item.quantity,
                    unit: item.unit,
                    rate: item.unitPrice,
                    discount: item.discountRate,
                    total: item.netAmount
                  }));
                  return (
                    <EstimationPrint
                      company={{
                        name: "Lingam Spares",
                        address: "No:32,Ground Floor , pattala street, kanchipuram - 631501",
                        phone: "9626956999",
                        email: "lingamspares@gmail.com",
                        gstin: gstNumber || "33BJLPN3590D1Z7",
                        state: "Tamil Nadu"
                      }}
                      estimation={{ id: bill.invoiceId || bill.id, date: new Date(bill.createdAt).toLocaleDateString('en-GB') }}
                      customer={{
                        name: bill.customerName || "Walk-in",
                        phone: bill.customerPhone || "-",
                        address: bill.customerAddress || "",
                        shippingAddress: bill.customerAddress || ""
                      }}
                      items={printItems}
                      totals={{ totalQty, grandTotal, amountInWords: numberToWords(grandTotal) }}
                      printedAt={new Date().toLocaleString('en-GB')}
                    />
                  );
                })()}
              </div>
            </div>

            <div className="px-6 py-4 bg-gradient-to-t from-slate-50/80 to-white border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setPreviewModal({ open: false, bill: null })}
                className="px-6 py-2.5 text-sm font-bold bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 transition-all duration-200 shadow-sm"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleReprint(previewModal.bill!);
                  setPreviewModal({ open: false, bill: null });
                }}
                className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-all duration-200 shadow-lg flex items-center gap-2"
              >
                <Printer size={16} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Sales Return Modal */}
      {srModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[85vw] max-h-[92vh] overflow-hidden ring-1 ring-black/5 flex flex-col">

            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 px-6 py-5 text-white relative flex-shrink-0">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <RotateCcw size={80} />
              </div>
              <div className="flex justify-between items-start">
                <div className="relative z-10">
                  <h2 className="text-xl font-bold tracking-tight">Sales Return</h2>
                  <p className="text-orange-100 text-sm mt-1 opacity-90">Search bills and process returns</p>
                </div>
                <button
                  onClick={() => setSrModalOpen(false)}
                  className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-all duration-200"
                >
                  <X size={18} strokeWidth={3} />
                </button>
              </div>
              <div className="flex space-x-2 mt-4 relative z-10">
                <button
                  onClick={() => setSrTab('search')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${srTab === 'search' ? 'bg-white text-orange-600 shadow-lg' : 'bg-white/20 text-white hover:bg-white/30'}`}
                >
                  Search & Return
                </button>
                <button
                  onClick={() => { setSrTab('history'); handleLoadSrHistory(); }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${srTab === 'history' ? 'bg-white text-orange-600 shadow-lg' : 'bg-white/20 text-white hover:bg-white/30'}`}
                >
                  Return History
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {srTab === 'search' ? (
                <div>
                  {!selectedBill && (
                    <div className="mb-6 space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                          type="text"
                          className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-xl pl-10 pr-4 py-3 focus:bg-white focus:border-orange-500 focus:ring-0 outline-none transition-all text-sm"
                          placeholder="Search by bill number, customer name, or mobile number..."
                          autoFocus
                          value={srSearch}
                          onChange={e => handleSrSearch(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-3 items-center">
                        <input type="date" value={srStartDate} onChange={e => setSrStartDate(e.target.value)} className="border-2 border-slate-100 bg-slate-50/50 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-orange-500 focus:ring-0 outline-none" />
                        <span className="text-gray-400 text-sm">to</span>
                        <input type="date" value={srEndDate} onChange={e => setSrEndDate(e.target.value)} className="border-2 border-slate-100 bg-slate-50/50 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-orange-500 focus:ring-0 outline-none" />
                        <button onClick={() => handleSrSearch(srSearch)} className="px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition shadow-sm">Search</button>
                      </div>
                    </div>
                  )}

                  {srSearchResults.length > 0 && !selectedBill && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                          <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                            <tr>
                              <th className="px-4 py-3">Date</th>
                              <th className="px-4 py-3">Bill No</th>
                              <th className="px-4 py-3">Customer</th>
                              <th className="px-4 py-3 text-center">Items</th>
                              <th className="px-4 py-3 text-right">Amt Before GST</th>
                              <th className="px-4 py-3 text-right">GST%</th>
                              <th className="px-4 py-3 text-right">Amt After GST</th>
                              <th className="px-4 py-3 text-center">Returned</th>
                              <th className="px-4 py-3 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {srSearchResults.map((bill) => {
                              const totalGst = (bill.items || []).reduce((sum, item) => {
                                const qty = Number(item.quantity) || 0;
                                const price = Number(item.unitPrice) || 0;
                                const gstRate = Number(item.gstRate) || 0;
                                const subtotal = price * qty;
                                const discountAmt = subtotal * ((Number(item.discountRate) || 0) / 100);
                                const taxable = subtotal - discountAmt;
                                return sum + (taxable - taxable / (1 + gstRate / 100));
                              }, 0);
                              const amtAfterGst = Number(bill.finalAmount) || 0;
                              const amtBeforeGst = amtAfterGst - totalGst;
                              return (
                                <tr key={bill.id} className="bg-white border-b hover:bg-slate-50/80 transition-colors">
                                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{bill.createdAt ? new Date(bill.createdAt).toLocaleDateString('en-GB') : '-'}</td>
                                  <td className="px-4 py-3 font-mono text-gray-600">{bill.invoiceId || bill.invoiceNumber || bill.id}</td>
                                  <td className="px-4 py-3 font-medium text-orange-600">{bill.customerName || 'Walk-in'}</td>
                                  <td className="px-4 py-3 text-center"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold text-xs">{bill.items?.length || 0}</span></td>
                                  <td className="px-4 py-3 text-right font-mono text-gray-600">₹{amtBeforeGst.toFixed(2)}</td>
                                  <td className="px-4 py-3 text-right font-mono text-gray-500">{totalGst > 0 && amtBeforeGst > 0 ? `${((totalGst / amtBeforeGst) * 100).toFixed(0)}%` : '-'}</td>
                                  <td className="px-4 py-3 text-right font-mono text-gray-900 font-semibold">₹{amtAfterGst.toFixed(2)}</td>
                                  <td className="px-4 py-3 text-center">
                                    {bill.fullyReturned ? <span className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-600 font-bold border border-red-200">FULL</span> : bill.returnedAmount ? <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-50 text-yellow-600 font-bold border border-yellow-200">PARTIAL</span> : <span className="text-[10px] px-2 py-0.5 rounded bg-green-50 text-green-600 font-bold border border-green-200">NONE</span>}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <button onClick={() => handleSrSelectBill(bill)} className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition shadow-sm">Select</button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {selectedBill && (
                    <div>
                      <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 mb-6 flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold text-orange-800">{selectedBill.customerName || 'Walk-in'}</span>
                          <span className="mx-2 text-orange-300">•</span>
                          <span className="text-sm font-mono text-orange-600">Bill: {selectedBill.invoiceId || selectedBill.invoiceNumber || selectedBill.id}</span>
                          <span className="mx-2 text-orange-300">•</span>
                          <span className="text-sm text-orange-600">₹{(Number(selectedBill.finalAmount) || 0).toFixed(2)}</span>
                        </div>
                        <button onClick={() => { setSelectedBill(null); setSrReturnProducts([]); setSrRemarks(''); }} className="text-xs text-orange-600 font-bold hover:underline">Change Selection</button>
                      </div>

                      {srReturnProducts.length > 0 ? (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                <tr>
                                  <th className="px-3 py-3">Product ID</th>
                                  <th className="px-3 py-3">Product Name</th>
                                  <th className="px-3 py-3 text-center">Stock</th>
                                  <th className="px-3 py-3 text-center">Orig Qty</th>
                                  <th className="px-3 py-3 text-center">Returned</th>
                                  <th className="px-3 py-3 text-center">Remaining</th>
                                  <th className="px-3 py-3 text-right">Taxable Amt</th>
                                  <th className="px-3 py-3 text-right">Discount</th>
                                  <th className="px-3 py-3 text-right">GST%</th>
                                  <th className="px-3 py-3 text-right">GST Amt</th>
                                  <th className="px-3 py-3 text-right">Net Amt</th>
                                  <th className="px-3 py-3 text-center">Return Qty</th>
                                  <th className="px-3 py-3 text-right">Return Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {srReturnProducts.map((p, idx) => (
                                  <tr key={idx} className={`bg-white border-b transition-colors ${p.remainingReturnable <= 0 ? 'opacity-50' : 'hover:bg-slate-50/80'}`}>
                                    <td className="px-3 py-3 font-mono text-gray-600 text-xs">{p.productId}</td>
                                    <td className="px-3 py-3 font-medium text-gray-900">{p.productName}</td>
                                    <td className="px-3 py-3 text-center"><span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-0.5 rounded">{p.originalQty - p.previouslyReturned}</span></td>
                                    <td className="px-3 py-3 text-center text-gray-600">{p.originalQty}</td>
                                    <td className="px-3 py-3 text-center text-gray-600">{p.previouslyReturned}</td>
                                    <td className="px-3 py-3 text-center">
                                      {p.remainingReturnable <= 0 ? <span className="text-red-600 text-xs font-bold">Fully Returned</span> : <span className="text-green-600 text-xs font-bold">{p.remainingReturnable}</span>}
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-gray-600">{p.returnQty > 0 ? `₹${p.amountBeforeGst.toFixed(2)}` : '₹0.00'}</td>
                                    <td className="px-3 py-3 text-right font-mono text-gray-600">{p.returnQty > 0 ? `₹${p.discountAmount.toFixed(2)}` : '₹0.00'}</td>
                                    <td className="px-3 py-3 text-right font-mono text-gray-500">{p.gstRate}%</td>
                                    <td className="px-3 py-3 text-right font-mono text-gray-600">{p.returnQty > 0 ? `₹${p.gstAmount.toFixed(2)}` : '₹0.00'}</td>
                                    <td className="px-3 py-3 text-right font-mono text-gray-900 font-semibold">{p.returnQty > 0 ? `₹${p.amountAfterGst.toFixed(2)}` : '₹0.00'}</td>
                                    <td className="px-3 py-3 text-center">
                                      {p.remainingReturnable > 0 ? (
                                        <input
                                          type="number"
                                          min={0}
                                          max={p.remainingReturnable}
                                          value={p.returnQty || ''}
                                          placeholder="0"
                                          className="w-20 border-2 border-slate-100 bg-slate-50/50 rounded-lg px-2 py-1.5 text-center text-sm focus:bg-white focus:border-orange-500 focus:ring-0 outline-none transition-all font-bold"
                                          onChange={e => handleSrReturnQtyChange(idx, parseInt(e.target.value) || 0)}
                                        />
                                      ) : <span className="text-gray-400 text-xs">-</span>}
                                    </td>
                                    <td className="px-3 py-3 text-right font-bold text-orange-600 font-mono">
                                      {p.returnQty > 0 ? `₹${p.amountAfterGst.toFixed(2)}` : '₹0.00'}
                                    </td>
                                  </tr>
                                ))}
                                {srReturnProducts.some(p => p.returnQty > 0) && (
                                  <tr className="bg-orange-50 border-t-2 border-orange-200 font-bold">
                                    <td colSpan={6} className="px-3 py-3 text-right text-orange-800 text-xs uppercase">Totals</td>
                                    <td className="px-3 py-3 text-right font-mono text-orange-800">₹{srReturnProducts.reduce((s, p) => s + (p.returnQty > 0 ? p.amountBeforeGst : 0), 0).toFixed(2)}</td>
                                    <td className="px-3 py-3 text-right font-mono text-orange-800">₹{srReturnProducts.reduce((s, p) => s + (p.returnQty > 0 ? p.discountAmount : 0), 0).toFixed(2)}</td>
                                    <td className="px-3 py-3 text-right font-mono text-orange-800"></td>
                                    <td className="px-3 py-3 text-right font-mono text-orange-800">₹{srReturnProducts.reduce((s, p) => s + (p.returnQty > 0 ? p.gstAmount : 0), 0).toFixed(2)}</td>
                                    <td className="px-3 py-3 text-right font-mono text-orange-800">₹{totalSrReturnAmount.toFixed(2)}</td>
                                    <td className="px-3 py-3 text-center text-orange-800"></td>
                                    <td className="px-3 py-3 text-right font-mono text-orange-800">₹{totalSrReturnAmount.toFixed(2)}</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-center text-yellow-700 text-sm mb-6">
                          No products found for this bill.
                        </div>
                      )}

                      <div className="mb-6">
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Remarks / Reason for Return</label>
                        <textarea
                          className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-xl p-3 text-sm focus:bg-white focus:border-orange-500 focus:ring-0 outline-none transition-all min-h-[80px]"
                          placeholder="Add notes about this return..."
                          value={srRemarks}
                          onChange={e => setSrRemarks(e.target.value)}
                        />
                      </div>

                      <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-600">Total Return:</span>
                          <span className="text-xl font-black text-orange-600 font-mono">₹{totalSrReturnAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => { setSelectedBill(null); setSrReturnProducts([]); setSrRemarks(''); }} className="px-6 py-2.5 text-sm font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">Cancel</button>
                          <button
                            onClick={handleProcessSalesReturn}
                            disabled={isProcessingSR || totalSrReturnAmount <= 0}
                            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-200/50 flex items-center gap-2"
                          >
                            {isProcessingSR ? <RotateCcw size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                            Process Return
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!srSearch && !selectedBill && (
                    <div className="text-center py-16">
                      <RotateCcw size={48} className="mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-bold text-gray-500 mb-2">Search for a Bill</h3>
                      <p className="text-sm text-gray-400">Type a bill number, customer name, or mobile number above to find bills to return</p>
                    </div>
                  )}

                  {srSearch && srSearchResults.length === 0 && !selectedBill && (
                    <div className="text-center py-16">
                      <Search size={48} className="mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-bold text-gray-500 mb-2">No Results Found</h3>
                      <p className="text-sm text-gray-400">No bills match your search. Try a different bill number or customer name.</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Return History Tab */
                <div>
                  <div className="flex flex-wrap gap-4 items-end mb-6">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Date Range</label>
                      <div className="flex items-center space-x-2">
                        <input type="date" value={srHistoryStartDate} onChange={e => setSrHistoryStartDate(e.target.value)} className="border rounded-lg p-2 text-sm" />
                        <span className="text-gray-400">-</span>
                        <input type="date" value={srHistoryEndDate} onChange={e => setSrHistoryEndDate(e.target.value)} className="border rounded-lg p-2 text-sm" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Filter Returns</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="text"
                          className="w-full border rounded-lg pl-9 pr-4 py-2 text-sm"
                          placeholder="Filter by customer, bill number, or return ID..."
                          value={srHistorySearch}
                          onChange={e => setSrHistorySearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <button onClick={handleLoadSrHistory} className="px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600 transition shadow-sm">Load History</button>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Return ID</th>
                            <th className="px-4 py-3">Bill No</th>
                            <th className="px-4 py-3">Customer</th>
                            <th className="px-4 py-3">Returned Products</th>
                            <th className="px-4 py-3 text-right">Return Amount</th>
                            <th className="px-4 py-3 text-right">New Bill Total</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {srHistoryResults.length === 0 ? (
                            <tr><td colSpan={9} className="text-center py-10 text-gray-400">No sales returns found. Click "Load History" to fetch.</td></tr>
                          ) : (
                            srHistoryResults
                              .filter(sr => {
                                if (!srHistorySearch) return true;
                                const q = srHistorySearch.toLowerCase();
                                return (sr.customerName || '').toLowerCase().includes(q) || (sr.billId || '').toLowerCase().includes(q) || (sr.id || '').toLowerCase().includes(q);
                              })
                              .map((sr) => (
                                <tr key={sr.id} className="bg-white border-b hover:bg-slate-50/80 transition-colors">
                                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{sr.returnDate ? new Date(sr.returnDate).toLocaleDateString('en-GB') : '-'}</td>
                                  <td className="px-4 py-3 font-mono text-orange-600 font-bold text-xs">{sr.id}</td>
                                  <td className="px-4 py-3 font-mono text-gray-600">{sr.billId}</td>
                                  <td className="px-4 py-3 font-medium text-gray-700">{sr.customerName || '-'}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                      {(sr.returnedProducts || []).map((p, i) => (
                                        <span key={i} className="bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded border border-orange-200">
                                          {p.productName} x{p.returnQty}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right font-bold text-red-600 font-mono">-₹{sr.totalReturnAmount.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right font-semibold text-gray-800 font-mono">₹{sr.newBillAmount.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`text-[10px] px-2 py-0.5 rounded border font-black uppercase ${sr.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' : sr.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-200 line-through' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                      {sr.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {sr.status === 'COMPLETED' && (
                                      <button onClick={() => handleCancelSalesReturn(sr)} className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded border border-red-200 hover:bg-red-100 transition">
                                        Cancel
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

                  {srHistoryResults.length > 0 && (
                    <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-600">Total Returns: <span className="text-orange-600">{srHistoryResults.length}</span></span>
                      <span className="text-sm font-bold text-gray-600">Total Return Amount: <span className="text-red-600 font-mono">₹{srHistoryResults.reduce((sum, sr) => sum + sr.totalReturnAmount, 0).toLocaleString()}</span></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Sales Return Modal */}
      {cancelSrModal.open && cancelSrModal.sr && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-500 p-6 text-white relative">
              <div className="absolute top-0 right-0 p-4 opacity-10"><RotateCcw size={80} /></div>
              <h2 className="text-xl font-bold relative z-10">Cancel Sales Return</h2>
              <p className="text-red-100 text-sm mt-1 relative z-10">This will reverse stock and bill changes</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                <p className="text-sm font-bold text-red-800">Return ID: <span className="font-mono">{cancelSrModal.sr.id}</span></p>
                <p className="text-sm text-red-700 mt-1">Amount: <span className="font-bold">₹{cancelSrModal.sr.totalReturnAmount.toLocaleString()}</span></p>
                <p className="text-sm text-red-700">Customer: <span className="font-bold">{cancelSrModal.sr.customerName}</span></p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Reason for Cancellation</label>
                <textarea
                  className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-xl p-3 text-sm focus:bg-white focus:border-red-500 focus:ring-0 outline-none transition-all min-h-[80px]"
                  placeholder="Why are you cancelling this return?"
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex gap-3">
              <button onClick={() => setCancelSrModal({ open: false, sr: null })} className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200/50 transition-all">Go Back</button>
              <button onClick={handleConfirmCancelSr} disabled={isCancellingSr} className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-200/50 flex items-center justify-center gap-2">
                {isCancellingSr ? <RotateCcw size={16} className="animate-spin" /> : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <RotateCcw size={48} className="mx-auto text-orange-500 mb-4" />
              <h2 className="text-lg font-bold text-gray-800 mb-2">Confirm Sales Return</h2>
              <p className="text-sm text-gray-600">{confirmDialog.message}</p>
            </div>
            <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex gap-3">
              <button onClick={() => setConfirmDialog({ open: false, message: '', onConfirm: () => { } })} className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200/50 transition-all">Cancel</button>
              <button onClick={confirmDialog.onConfirm} className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-200/50">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default PrintedBills;


