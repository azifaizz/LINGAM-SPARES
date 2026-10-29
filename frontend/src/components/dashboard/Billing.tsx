import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from 'react-router-dom'; // Assuming used
import { billingApi, productApi, customerApi, Bill, BillDetails, Customer, Product as ApiProduct, reminderApi, estimationApi, proformaApi } from '@/lib/api'; // Added reminderApi, estimationApi, proformaApi
import { useGlobalData } from "@/context/GlobalDataContext";
import { useCachedResource } from '@/hooks/useCachedResource';
import { utils, writeFile } from "xlsx";
import {
  Search, Plus, Save, Trash2, Printer, X, CreditCard, ChevronDown, Check, Users, User, Clock, RefreshCw, FileText,
  RotateCcw, Pause, FileSpreadsheet, ShoppingCart, Phone, PackageSearch, Undo2, MessageSquare, Mail, MessageCircle, Briefcase
} from "lucide-react";
import { motion } from "framer-motion";
import { useLocalStorage } from '@/hooks/useLocalStorage';
// import { db } from "@/lib/firebase"; // Removed
// import { doc, getDoc } from "firebase/firestore"; // Removed
import { toast } from 'react-hot-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { SyncIndicator } from '@/components/SyncIndicator';
import { renderToStaticMarkup } from 'react-dom/server';
import ProfessionalTaxInvoice from '../print/ProfessionalTaxInvoice';
import ProformaInvoice from '../print/ProformaInvoice';
import EstimationPrint from './Estimation';
import EstimationPrintA4 from './EstimationA4';
import { numberToWords } from '@/utils/numberToWords';
import { useDropdownNavigation } from "@/hooks/useDropdownNavigation";
import BillingHistoryModal from './BillingHistoryModal';

// --- Reusable Center Popup ---


// --- Interfaces ---
interface BillProduct { id: string; barcode: string; name: string; unit?: string; price: number; wholesaleSellingPrice?: number; quantity: number; taxCode?: string; colourCode?: string; }
// --- MODIFIED: Added hsnsac to Interface ---
interface BillItem extends BillProduct {
  qty: number | string;
  total: number;
  GST: number;
  Discount: number | string;
  hsnsac?: string;
  purchaseRate?: number;
  wholesalePrice?: number;
}

// --- Invoice Number Generation (unchanged) ---



// --- Return Modal Component (unchanged) ---
const ReturnModal = ({ onFind, onClose }: { onFind: (invoiceId: string) => void; onClose: () => void; }) => {
  const [invoiceId, setInvoiceId] = useState("");
  const handleFindClick = () => { if (invoiceId.trim()) { onFind(invoiceId.trim()); } };
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Find Bill for Return</h2><button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button></div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter Invoice Number..."
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleFindClick();
              }
            }}
            className="form-input flex-grow"
          />
          <button onClick={handleFindClick} className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600">Find</button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Helpers from Reference ---
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const computeItem = (item: BillItem): BillItem => {
  const unitPrice = Number(item.price || 0);
  const qty = Number(item.qty || 0);
  const discountRate = Number(item.Discount || 0);
  const gstRate = Number(item.GST || 0);

  const subtotal = round2(unitPrice * qty); // Gross amount before discount
  const discountAmount = round2(subtotal * (discountRate / 100));
  const amountAfterDiscount = round2(subtotal - discountAmount); // This amount *includes* GST

  // Back-calculate taxable amount and GST amount from amountAfterDiscount
  const taxable = round2(amountAfterDiscount / (1 + (gstRate / 100)));
  const gstAmount = round2(amountAfterDiscount - taxable);
  const netAmount = round2(amountAfterDiscount); // This is the final amount after discount, including GST

  return {
    ...item,
    total: netAmount, // Aligning 'total' with 'netAmount' for UI display compatibility
    // Extended properties if needed for payload, but BillItem interface might need update if we want to be strict.
    // For now we assume BillItem has what we need or we cast.
  };
};

const buildPayloadFromUIItems = (
  uiItems: BillItem[],
  customerName: string,
  customerPhoneRaw: string,
  customerEmail: string,
  customerAddress: string, // Added address param
  paymentMethod: string,
  receivedAmountRaw: string,
  customerGst: string,
  billType: string,
  brokerId?: string,
  commissionAmount?: string | number,
  staffId?: string,
  staffCommissionPercentage?: string | number,
  brokerCommissionPercentage?: string | number,
  cashAmountRaw?: string,
  onlineAmountRaw?: string,
  partialPaidAmountRaw?: string,
  paymentReminderEnabled?: boolean,
  paymentReminderDays?: number,
  vehicleNo?: string,
  dispatchThrough?: string,
  destination?: string,
  termsOfDelivery?: string,
  isShipToDifferent?: boolean,
  shipToName?: string,
  shipToPhone?: string,
  shipToEmail?: string,
  shipToAddress?: string,
  shipToGst?: string,
  transportAmount?: string | number,
  transportGstRate?: string | number
) => {
  const items = uiItems.map((ui) => {
    // Re-compute to be safe
    const unitPrice = Number(ui.price || 0);
    const qty = Number(ui.qty || 0);
    const discountRate = Number(ui.Discount || 0);
    const gstRate = Number(ui.GST || 0);

    const subtotal = round2(unitPrice * qty); // Gross
    const discountAmount = round2(subtotal * (discountRate / 100));
    const netAmount = round2(subtotal - discountAmount); // Inclusive Amount

    const taxable = round2(netAmount / (1 + (gstRate / 100)));
    const gstAmount = round2(netAmount - taxable);

    return {
      productId: (ui as any).id || ui.barcode,
      productName: ui.name,
      quantity: qty,
      unitPrice: unitPrice,
      gstRate: gstRate,
      discountRate: discountRate,
      purchaseRate: Number(ui.purchaseRate || 0),
      purchaseGstRate: 0,
      subtotal: subtotal,
      discountAmount: discountAmount,
      gstAmount: gstAmount,
      netAmount: netAmount,
      unit: (ui as any).unit || "Nos",
      hsnsac: ui.hsnsac || (ui as any).taxCode || "-",
      taxCode: (ui as any).taxCode,
      colourCode: (ui as any).colourCode,
    };
  });

  const totalDiscountAmount = round2(items.reduce((s, it) => s + it.discountAmount, 0));
  const totalGstAmount = round2(items.reduce((s, it) => s + it.gstAmount, 0));
  const rawFinal = round2(items.reduce((s, it) => s + it.netAmount, 0));
  // Round to whole rupee matching the backend's grandTotal round-off
  const finalAmount = Math.round(rawFinal);

  const receivedAmount = parseFloat(receivedAmountRaw || '') || 0;
  // Ensure amountPaid matches the rounded finalAmount when fully paid
  let amountPaid = (paymentMethod === 'Cash' && (receivedAmount >= finalAmount || receivedAmount === 0))
    ? finalAmount
    : (receivedAmount > 0 ? receivedAmount : finalAmount);

  if (paymentMethod === 'PARTIAL') {
    amountPaid = parseFloat(partialPaidAmountRaw || '') || 0;
  }

  // Handle Split Payment
  let cashPaid = 0;
  let onlinePaid = 0;
  if (paymentMethod === 'Split Payment') {
    cashPaid = parseFloat(cashAmountRaw || '') || 0;
    onlinePaid = parseFloat(onlineAmountRaw || '') || 0;
    amountPaid = cashPaid + onlinePaid;
  }

  // Calculate Staff Commission
  const staffCommissionAmount = (staffCommissionPercentage && Number(staffCommissionPercentage) > 0)
    ? round2(finalAmount * (Number(staffCommissionPercentage) / 100))
    : 0;

  // Calculate Broker Commission
  let finalBrokerCommission = Number(commissionAmount) || 0;
  if (brokerCommissionPercentage && Number(brokerCommissionPercentage) > 0) {
    finalBrokerCommission = round2(finalAmount * (Number(brokerCommissionPercentage) / 100));
  }

  return {
    customerName: customerName || "",
    customerPhone: Number(customerPhoneRaw ? customerPhoneRaw.toString().replace(/\D/g, '') : 0) || 0,
    customerEmail: customerEmail || "",
    customerAddress: customerAddress || "",
    customerGst: customerGst || "",
    billType: billType || "GST_INVOICE",
    brokerId: brokerId || "",
    commissionAmount: finalBrokerCommission, // Use calculated amount
    brokerCommissionPercentage: Number(brokerCommissionPercentage) || 0, // Store percentage if backend supports, or plain ignore if not schema mapped yet
    staffId: staffId || "",
    staffCommissionPercentage: Number(staffCommissionPercentage) || 0,
    staffCommissionAmount: staffCommissionAmount,
    paymentMethod: paymentMethod === 'Split Payment' ? 'CASH + UPI' : paymentMethod,
    amountPaid: Number(round2(amountPaid)),
    status: (paymentMethod === 'PARTIAL' || paymentMethod === 'HOLD')
      ? (amountPaid <= 0 ? (paymentMethod === 'HOLD' ? 'HOLD' : 'PENDING') : 'PARTIAL')
      : 'PAID',
    cashAmount: paymentMethod === 'Split Payment' ? Number(round2(cashPaid)) : undefined,
    onlineAmount: paymentMethod === 'Split Payment' ? Number(round2(onlinePaid)) : undefined,
    items,
    totalDiscountAmount,
    totalGstAmount,
    finalAmount,
    paymentReminderEnabled,
    paymentReminderDays,
    vehicleNo,
    dispatchThrough,
    destination,
    termsOfDelivery,
    transportAmount: Number(transportAmount) || 0,
    transportGstRate: Number(transportGstRate) || 18,
    isShipToDifferent,
    shipToName,
    shipToPhone,
    shipToEmail,
    shipToAddress,
    shipToGst
  };
};

const ProductSelectionModal = ({ products, onSelect, onClose }: { products: any[]; onSelect: (product: any) => void; onClose: () => void; }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Select Product</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
        </div>
        <div className="flex-grow overflow-y-auto border rounded-md">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="p-3 font-semibold">Name</th>
                <th className="p-3 font-semibold">Price</th>
                <th className="p-3 font-semibold">Stock</th>
                <th className="p-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id || product.barcode} className="border-b hover:bg-gray-50">
                  <td className="p-3">{product.name}</td>
                  <td className="p-3">₹{product.price}</td>
                  <td className="p-3">{product.stockQuantity}</td>
                  <td className="p-3">
                    <button
                      onClick={() => onSelect(product)}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                    >
                      Select
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

const Billing: React.FC = () => {
  const {
    products: globalProducts,
    customers: globalCustomers,
    staff: globalStaff,
    brokers: globalBrokers,
    loading: globalLoading,
    refreshProducts,
    refreshCustomers,
    refreshBrokers,
    refreshBills,
    mutateProducts,
    isSyncing: globalSyncing
  } = useGlobalData();

  const [pricingMode, setPricingMode] = useState<'Retail' | 'Wholesale'>('Retail');
  const [documentMode, setDocumentMode] = useState<'Billing' | 'Estimation' | 'Proforma'>('Billing');
  const [isEstimationSaved, setIsEstimationSaved] = useState(false);
  const [lastEstimationId, setLastEstimationId] = useState<string | null>(null);
  const [isLoadEstimationModalOpen, setIsLoadEstimationModalOpen] = useState(false);
  const [estIdInput, setEstIdInput] = useState("");
  const [isLoadProformaModalOpen, setIsLoadProformaModalOpen] = useState(false);
  const [proformaIdInput, setProformaIdInput] = useState("");
  const [isProformaSaved, setIsProformaSaved] = useState(false);
  const [lastProformaId, setLastProformaId] = useState<string | null>(null);

  const [barcode, setBarcode] = useState("");
  const [items, setItems] = useState<BillItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerGst, setCustomerGst] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [loading, setLoading] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState("");
  // Split Payment state variables
  const [cashAmount, setCashAmount] = useState("");
  const [onlineAmount, setOnlineAmount] = useState("");
  const [selectedBroker, setSelectedBroker] = useState("");
  const [brokerNameInput, setBrokerNameInput] = useState("");
  const [brokerSuggestions, setBrokerSuggestions] = useState<any[]>([]);
  const [commissionAmount, setCommissionAmount] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [staffNameInput, setStaffNameInput] = useState("");
  const [staffSuggestions, setStaffSuggestions] = useState<any[]>([]);
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
  const [highlightedStaffIndex, setHighlightedStaffIndex] = useState(-1);
  const [staffCommissionPercentage, setStaffCommissionPercentage] = useState("");
  // --- MODIFIED: Added brokerCommissionPercentage to state ---
  const [brokerCommissionPercentage, setBrokerCommissionPercentage] = useState("");

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [partialPaidAmount, setPartialPaidAmount] = useState("");
  const [paymentReminderEnabled, setPaymentReminderEnabled] = useState(true);
  const [paymentReminderDays, setPaymentReminderDays] = useState(7);

  // Bills loaded on-demand with instant localStorage cache fallback
  const [localBills, setLocalBills] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('LINGAM_SPARES_V1_local_bills');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const refreshLocalBills = useCallback(async () => {
    try {
      const res = await billingApi.getAll();
      const bills = Array.isArray(res) ? res : (res as any)?.data || [];
      if (bills.length > 0) {
        setLocalBills(bills);
        try { localStorage.setItem('LINGAM_SPARES_V1_local_bills', JSON.stringify(bills)); } catch {}
      }
    } catch (e) {
      console.warn("Failed to refresh bills from server, using cached list:", e);
    }
  }, []);
  useEffect(() => { refreshLocalBills(); }, [refreshLocalBills]);

  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [enableReminder, setEnableReminder] = useState(false);
  const [reminderDays, setReminderDays] = useState(30);

  // Cancel / Uncancel Bill modal state
  const [cancelModal, setCancelModal] = useState<{ open: boolean; billId: string | null; mode: 'cancel' | 'uncancel' }>({ open: false, billId: null, mode: 'cancel' });
  const openCancelModal = (billId: string, mode: 'cancel' | 'uncancel') => setCancelModal({ open: true, billId, mode });
  const closeCancelModal = () => setCancelModal({ open: false, billId: null, mode: 'cancel' });

  // Transport Details
  const [vehicleNo, setVehicleNo] = useState("");
  const [dispatchThrough, setDispatchThrough] = useState("");
  const [destination, setDestination] = useState("");
  const [termsOfDelivery, setTermsOfDelivery] = useState("");
  const [transportAmount, setTransportAmount] = useState("");
  const [transportGstRate, setTransportGstRate] = useState("18");

  // Ship To Details
  const [isShipToDifferent, setIsShipToDifferent] = useState(false);
  const [shipToName, setShipToName] = useState("");
  const [shipToPhone, setShipToPhone] = useState("");
  const [shipToEmail, setShipToEmail] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");
  const [shipToGst, setShipToGst] = useState("");
  const [nextBillNo, setNextBillNo] = useState<string>("");
  const [customBillNo, setCustomBillNo] = useState("");
  const [customDate, setCustomDate] = useState("");

  // Calculate Next Bill Number based on existing bills
  useEffect(() => {
    if (localBills && localBills.length > 0) {
      const pattern = /^RE 26-27-(\d+)$/;
      let maxNum = 0;
      localBills.forEach(b => {
        const billId = b.id || b.invoiceNumber || "";
        const match = billId.match(pattern);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxNum) maxNum = num;
        }
      });
      setNextBillNo(`RE 26-27-${String(maxNum + 1).padStart(3, '0')}`);
    } else {
      setNextBillNo("RE 26-27-001");
    }
  }, [localBills]);

  const [originalBillDate, setOriginalBillDate] = useState<Date | null>(null);
  const [originalInvoiceId, setOriginalInvoiceId] = useState<string>("");
  const [originalTotal, setOriginalTotal] = useState(0);
  const [customerMode, setCustomerMode] = useState("Walk-in");
  const [currentHoldId, setCurrentHoldId] = useState<string | null>(null);
  const [isHoldLoaded, setIsHoldLoaded] = useState(false);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isPhoneDropdownOpen, setIsPhoneDropdownOpen] = useState(false);
  const [isBillNoDropdownOpen, setIsBillNoDropdownOpen] = useState(false);
  const [isBillingHistoryOpen, setIsBillingHistoryOpen] = useState(false);
  const [historyProductId, setHistoryProductId] = useState<string | undefined>(undefined);
  const [historyProductName, setHistoryProductName] = useState('');
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(0);
  const barcodeInputRef = React.useRef<HTMLInputElement>(null);
  const customerNameRef = React.useRef<HTMLInputElement>(null);
  const customerPhoneRef = useRef<HTMLInputElement>(null);
  const customerEmailRef = useRef<HTMLInputElement>(null);
  const customerGstRef = useRef<HTMLInputElement>(null);
  const customerAddressRef = useRef<HTMLInputElement>(null);

  const productDropdownRef = useRef<HTMLDivElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const phoneDropdownRef = useRef<HTMLDivElement>(null);
  const brokerDropdownRef = useRef<HTMLDivElement>(null);
  const staffDropdownRef = useRef<HTMLDivElement>(null);

  const vehicleNoRef = useRef<HTMLInputElement>(null);
  const dispatchThroughRef = useRef<HTMLInputElement>(null);
  const destinationRef = useRef<HTMLInputElement>(null);
  const termsOfDeliveryRef = useRef<HTMLInputElement>(null);
  const transportAmountRef = useRef<HTMLInputElement>(null);
  const transportGstRateRef = useRef<HTMLInputElement>(null);
  const shipToNameRef = useRef<HTMLInputElement>(null);
  const shipToPhoneRef = useRef<HTMLInputElement>(null);
  const shipToEmailRef = useRef<HTMLInputElement>(null);
  const shipToGstRef = useRef<HTMLInputElement>(null);
  const shipToAddressRef = useRef<HTMLInputElement>(null);
  const brokerRef = useRef<HTMLInputElement>(null);
  const staffRef = useRef<HTMLInputElement>(null);
  const brokerCommRef = useRef<HTMLInputElement>(null);
  const staffCommRef = useRef<HTMLInputElement>(null);

  const [shopName] = useLocalStorage('shopName_rose_boutique', 'Lingam Spares');
  const [gstNumberRaw] = useLocalStorage('gstNumber_v4', '33BJLPN3590D1Z7');

  const gstNumber =
    !gstNumberRaw || gstNumberRaw === 'YOUR_GST_NUMBER_HERE' || gstNumberRaw === '33JPNPK3337F1ZR'
      ? '33BJLPN3590D1Z7'
      : gstNumberRaw.toString().trim();

  const [billMessage] = useLocalStorage('billMessage', 'Thank You For Your Purchasing');

  const isSyncing = globalSyncing;

  const holds = React.useMemo(() => {
    return (localBills || []).filter((b: any) => {
      const pm = (b.paymentMethod || '').toLowerCase();
      return pm === 'hold' && b.status !== 'CANCELLED';
    }).sort((a: any) => new Date(a.createdAt).getTime());
  }, [localBills]);

  const brokers = globalBrokers; // Use global brokers instead of local cache

  // Update broker name input if ID is present but name is empty (e.g. after fresh load)
  useEffect(() => {
    if (selectedBroker && !brokerNameInput && Array.isArray(brokers)) {
      const b = brokers.find((br: any) => br.id === selectedBroker);
      if (b) setBrokerNameInput(b.name);
    }
  }, [brokers, selectedBroker, brokerNameInput]);

  // Data already loaded by GlobalDataContext on login — no need to refresh on mount.
  // Post-action refreshes (hold, pay, delete) handle freshness via targeted refreshLocalBills() calls.

  // Task 2: Dropdown Auto Close (Click Outside)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (productDropdownRef.current && !productDropdownRef.current.contains(target)) {
        setIsProductDropdownOpen(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(target)) {
        setIsCustomerDropdownOpen(false);
      }
      if (phoneDropdownRef.current && !phoneDropdownRef.current.contains(target)) {
        setIsPhoneDropdownOpen(false);
      }
      if (brokerDropdownRef.current && !brokerDropdownRef.current.contains(target)) {
        setBrokerSuggestions([]);
      }
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(target)) {
        setIsStaffDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);



  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [phoneSuggestions, setPhoneSuggestions] = useState<any[]>([]);
  const [productSuggestions, setProductSuggestions] = useState<any[]>([]);

  const { confirm: confirmAction, ConfirmationDialog } = useConfirm();

  // Effect to recalculate prices when pricingMode changes
  useEffect(() => {
    if (items.length === 0) return;

    setItems((prev) => prev.map((item) => {
      // Find the original product to get correct prices
      const product = globalProducts.find(p => p.barcode === item.barcode || p.id === item.id);
      if (!product) return item;

      const resolvedPrice = pricingMode === 'Retail' ? product.price : (product.wholesaleSellingPrice || product.price);

      return {
        ...item,
        price: resolvedPrice,
        total: calculateItemTotal(resolvedPrice, item.qty, item.Discount, item.GST)
      };
    }));
  }, [pricingMode, globalProducts]);

  const addProductToBill = (product: any) => {
    setItems((prev) => {
      const existingItem = prev.find((i) => i.barcode === product.barcode);
      if (existingItem) {
        return prev.map((i) =>
          i.barcode === product.barcode
            ? { ...i, qty: Number(i.qty) + 1, total: calculateItemTotal(pricingMode === 'Retail' ? i.price : (i.wholesaleSellingPrice || i.price), Number(i.qty) + 1, i.Discount, i.GST) }
            : i
        );
      } else {
        const resolvedPrice = pricingMode === 'Retail' ? product.price : (product.wholesaleSellingPrice || product.price);
        const newItem: BillItem = {
          id: product.id,
          barcode: product.barcode,
          name: product.name,
          unit: product.unit || "Nos",
          price: resolvedPrice,
          wholesaleSellingPrice: product.wholesaleSellingPrice, // Wholesale
          GST: product.purchaseGst || 0,
          Discount: "",
          quantity: product.quantity ?? product.stockQuantity ?? 1,
          qty: 1,
          total: calculateItemTotal(resolvedPrice, 1, 0, product.purchaseGst || 0),
          purchaseRate: product.purchaseRate || 0,
          hsnsac: product.hsnsac || product.taxCode || "-",
          taxCode: product.taxCode,
          colourCode: product.colourCode,
        };
        return [...prev, newItem];
      }
    });
    setBarcode("");
    setProductSuggestions([]);
    setSearchResults([]);
    setIsSelectionModalOpen(false);
    toast.success(`Added ${product.name}`);
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  };

  const handleProductSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBarcode(val);

    if (val.trim()) {
      const normalizeId = (id: any) => id ? id.toString().replace(/^0+/, '') : '';
      const normalizedInput = normalizeId(val);

      const matches = globalProducts.filter(p =>
        (p.barcode && normalizeId(p.barcode) === normalizedInput) ||
        (p.id && normalizeId(p.id) === normalizedInput) ||
        (p.name && p.name.toLowerCase().includes(val.toLowerCase()))
      ).slice(0, 10); // Limit to 10 suggestions
      setProductSuggestions(matches);
      setIsProductDropdownOpen(true);
      setHighlightedProductIndex(0);
    } else {
      setProductSuggestions([]);
      setIsProductDropdownOpen(false);
    }
  };

  const handleProductKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsProductDropdownOpen(true);
      setHighlightedProductIndex(prev => (prev + 1) % productSuggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsProductDropdownOpen(true);
      setHighlightedProductIndex(prev => (prev - 1 + productSuggestions.length) % productSuggestions.length);
    } else if (e.key === "Enter") {
      if (isProductDropdownOpen && productSuggestions.length > 0) {
        e.preventDefault();
        addProductToBill(productSuggestions[highlightedProductIndex]);
        setIsProductDropdownOpen(false);
      } else {
        handleAddProduct();
      }
    } else if (e.key === "Escape") {
      setIsProductDropdownOpen(false);
    }
  };

  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomerName(val);

    if (val.trim()) {
      const matches = globalCustomers.filter(c =>
        c.name.toLowerCase().includes(val.toLowerCase()) ||
        (c.phone && c.phone.includes(val))
      );
      setCustomerSuggestions(matches);
    } else {
      setCustomerSuggestions([]);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomerPhone(val);

    if (val.trim()) {
      const matches = globalCustomers.filter(c =>
        c.phone && c.phone.includes(val)
      );
      setPhoneSuggestions(matches);
    } else {
      setPhoneSuggestions([]);
    }
  };

  const selectCustomer = (customer: any) => {
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || "");
    setCustomerEmail(customer.email || "");
    setCustomerAddress(customer.address || customer.location || customer.Address || "");
    setCustomerGst(customer.gstin || customer.gst || "");
    setCustomerId(customer.id);
    setCustomerSuggestions([]);
    setPhoneSuggestions([]);
    setIsCustomerDropdownOpen(false);
    setIsPhoneDropdownOpen(false);
    // After selection, move focus to phone
    setTimeout(() => customerPhoneRef.current?.focus(), 50);
  };

  const {
    highlightedIndex: highlightedCustomerIndex,
    handleKeyDown: handleCustomerKeyDown
  } = useDropdownNavigation({
    items: customerSuggestions,
    onSelect: selectCustomer,
    isOpen: isCustomerDropdownOpen,
  });

  const {
    highlightedIndex: highlightedPhoneIndex,
    handleKeyDown: handlePhoneKeyDown
  } = useDropdownNavigation({
    items: phoneSuggestions,
    onSelect: selectCustomer,
    isOpen: isPhoneDropdownOpen,
    getItemLabel: (item) => item.phone || "",
  });

  const handleStaffSearchChange = (val: string) => {
    setStaffNameInput(val);
    if (val.trim()) {
      const matches = (globalStaff || []).filter((s: any) =>
        s.isActive && (s.name.toLowerCase().includes(val.toLowerCase()) || (s.role && s.role.toLowerCase().includes(val.toLowerCase())))
      );
      setStaffSuggestions(matches);
      setIsStaffDropdownOpen(true);
    } else {
      setStaffSuggestions([]);
      setIsStaffDropdownOpen(false);
    }
  };

  const selectStaff = (staff: any) => {
    setSelectedStaffId(staff.id);
    setStaffNameInput(staff.name);
    setStaffSuggestions([]);
    setIsStaffDropdownOpen(false);
    setTimeout(() => staffCommRef.current?.focus(), 50);
  };

  const {
    highlightedIndex: highlightedStaffIndexInner,
    handleKeyDown: handleStaffKeyDown
  } = useDropdownNavigation({
    items: staffSuggestions,
    onSelect: selectStaff,
    isOpen: isStaffDropdownOpen,
  });

  const selectBroker = (broker: any) => {
    setSelectedBroker(broker.id);
    setBrokerNameInput(broker.name);
    setBrokerSuggestions([]);
    // Move to broker commission
    setTimeout(() => brokerCommRef.current?.focus(), 50);
  };

  const {
    highlightedIndex: highlightedBrokerIndexInner,
    handleKeyDown: handleBrokerKeyDownHook
  } = useDropdownNavigation({
    items: brokerSuggestions,
    onSelect: selectBroker,
    isOpen: brokerSuggestions.length > 0,
  });

  // Task 1: Auto-scrolling for highlighted items
  useEffect(() => {
    if (isProductDropdownOpen) {
      const el = document.getElementById(`prod-item-${highlightedProductIndex}`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedProductIndex, isProductDropdownOpen]);

  useEffect(() => {
    if (isCustomerDropdownOpen) {
      const el = document.getElementById(`cust-item-${highlightedCustomerIndex}`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedCustomerIndex, isCustomerDropdownOpen]);

  useEffect(() => {
    if (isPhoneDropdownOpen) {
      const el = document.getElementById(`phone-item-${highlightedPhoneIndex}`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedPhoneIndex, isPhoneDropdownOpen]);

  // fetchCustomers removed as we use globalCustomers context


  const calculateItemTotal = (price: number, qty: number | string, discountPercent: number | string, gstPercent: number): number => {
    const q = Number(qty) || 0;
    const d = Number(discountPercent) || 0;
    const subtotal = price * q;
    const discountAmount = subtotal * (d / 100);
    const taxableAmount = subtotal - discountAmount;
    const finalTotal = taxableAmount;
    return Number(finalTotal.toFixed(2));
  };

  const handleSendSMS = async () => {
    if (!items.length) {
      toast.error("Add at least one item to send an SMS.");
      return;
    }
    if (!customerPhone || customerPhone.trim().length < 10) {
      toast.error("Please enter a valid 10-digit customer phone number.");
      return;
    }

    confirmAction(`Send bill details via SMS to ${customerPhone}?`, async () => {
      setLoading(true);
      try {
        const billId = await handleSaveBill();
        const domain = window.location.hostname === 'localhost' ? 'https://real-estateoo1.web.app' : window.location.origin;
        const billUrl = `${domain}/bill/${billId}`;
        const message = `Thank you for shopping at Lingam Spares! View your bill for Rs. ${totalAmount.toFixed(2)} here: ${billUrl}`;

        // Twilio Logic
        const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID || "";
        const authToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN || "";
        const messagingServiceSid = import.meta.env.VITE_TWILIO_MESSAGING_SERVICE_SID || "";
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

        const formData = new URLSearchParams();
        let formattedPhone = customerPhone.trim();
        if (!formattedPhone.startsWith("+")) formattedPhone = "+91" + formattedPhone;

        formData.append("To", formattedPhone);
        formData.append("MessagingServiceSid", messagingServiceSid);
        formData.append("Body", message);

        const response = await fetch(twilioUrl, {
          method: "POST",
          headers: { "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`), "Content-Type": "application/x-www-form-urlencoded" },
          body: formData
        });
        const responseData = await response.json();
        if (!response.ok) throw new Error(responseData.message || "Failed to send SMS via Twilio");


        toast.success(`SMS sent successfully to ${customerPhone}!`);
      } catch (err: any) {
        console.error("🔥 Error in sending SMS:", err);
        toast.error(err.message || "Failed to send SMS.");
      } finally {
        setLoading(false);
      }
    });
  };

  const handleSendWhatsApp = async () => {
    if (!items.length) {
      toast.error("Add at least one item to send a WhatsApp message.");
      return;
    }
    if (!customerPhone || customerPhone.trim().length < 10) {
      toast.error("Please enter a valid 10-digit customer phone number.");
      return;
    }

    confirmAction(`Send bill details via WhatsApp to ${customerPhone} automatically?`, async () => {
      setLoading(true);
      try {
        const billId = await handleSaveBill();
        const domain = window.location.hostname === 'localhost' ? 'https://real-estateoo1.web.app' : window.location.origin;
        const billUrl = `${domain}/bill/${billId}`;
        const message = `*Invoice from ${shopName}*\n\nHello *${customerName || 'Customer'}*,\nThank you for shopping with us!\nYour bill (ID: ${billId}) for *Rs. ${totalAmount.toFixed(2)}* is ready.\n\n📄 *View & Download Invoice:* \n${billUrl}\n\nHave a great day!`;

        let phone = customerPhone.replace(/\D/g, '');
        if (phone.length === 10) phone = '91' + phone;
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
        toast.success("WhatsApp opened! Please click send.");
      } catch (err: any) {
        console.error("Error in sending WhatsApp:", err);
        toast.error(err.message || "Failed to process WhatsApp request.");
      } finally {
        setLoading(false);
      }
    });
  };

  const handleAddProduct = async () => {
    if (!barcode || barcode.trim() === "") {
      toast.error("Please enter a barcode or product name.");
      return;
    }

    const searchInput = barcode.trim();
    const processedBarcode = searchInput.replace(/^0+/, "") || searchInput;

    const addToItems = (product: any) => {
      setItems((prev) => {
        const existingItem = prev.find((i) => i.barcode === product.barcode);
        if (existingItem) {
          return prev.map((i) =>
            i.barcode === product.barcode
              ? { ...i, qty: Number(i.qty) + 1, total: calculateItemTotal(pricingMode === 'Retail' ? i.price : (i.wholesaleSellingPrice || i.price), Number(i.qty) + 1, i.Discount, i.GST) }
              : i
          );
        } else {
          const resolvedPrice = pricingMode === 'Retail' ? product.price : (product.wholesaleSellingPrice || product.price);
          const newItem: BillItem = {
            id: product.id,
            barcode: product.barcode,
            name: product.name,
            unit: product.unit || "Nos",
            price: resolvedPrice,
            wholesaleSellingPrice: product.wholesaleSellingPrice, // Wholesale
            GST: product.purchaseGst || 0,
            Discount: 0,
            quantity: product.quantity ?? product.stockQuantity ?? 1,
            qty: 1,
            total: calculateItemTotal(resolvedPrice, 1, 0, product.purchaseGst || 0),
            purchaseRate: product.purchaseRate || 0,
            taxCode: product.taxCode,
            colourCode: product.colourCode,
          };
          return [...prev, newItem];
        }
      });
      setBarcode("");
      setSearchResults([]);
      setIsSelectionModalOpen(false);
    };

    // --- OPTIMIZED SEARCH STRATEGY ---
    // 1. Search in Local Cache FIRST
    console.log("Searching in local cache for:", searchInput);

    // Normalize logic
    const normalizeId = (id: any) => id ? id.toString().replace(/^0+/, '') : '';
    const normalizedInput = normalizeId(searchInput);

    // Filter from globalProducts context (Instant)
    const matches = globalProducts.filter(p =>
      (p.barcode && normalizeId(p.barcode) === normalizedInput) ||
      (p.id && normalizeId(p.id) === normalizedInput) ||
      (p.name && p.name.toLowerCase().includes(searchInput.toLowerCase()))
    );

    if (matches.length === 1) {
      console.log("Found in local cache:", matches[0]);
      addToItems(matches[0]);
      return;
    } else if (matches.length > 1) {
      console.log("Multiple matches in local cache");
      setSearchResults(matches);
      setIsSelectionModalOpen(true);
      return;
    }

    // 2. If NOT found in local cache, fallback to API (Slower, but necessary for very new items not yet cached)
    // Only do this if cache didn't have it.

    try {
      setLoading(true);
      console.log("Local cache miss. Fetching from API...");

      const fetchProduct = async (code: string) => {
        // Only fetch specific product, don't fetchAll again
        try {
          const res = await productApi.getProduct(encodeURIComponent(code));
          return res.data;
        } catch (e) { return null; }
      };

      let product = await fetchProduct(processedBarcode);

      if (!product && processedBarcode.length === 6) {
        // Try zero padded
        product = await fetchProduct(`0${processedBarcode}`);
      }

      if (product) {
        addToItems(product);
      } else {
        toast.error("Product not found.");
      }
    } catch (err: any) {
      console.error("Search failed:", err);
      toast.error("An error occurred during search.");
    } finally {
      setLoading(false);
    }
  };

  const handleQtyChange = (barcode: string, qty: string) => {
    const val = qty === "" ? "" : Number(qty);
    // Allow blank, and don't restrict min(1) while typing
    setItems((prev) =>
      prev.map((i) => {
        if (i.barcode === barcode) {
          const priceToUse = pricingMode === 'Retail' ? i.price : (i.wholesaleSellingPrice || i.price);
          return { ...i, qty: val, total: calculateItemTotal(priceToUse, val, i.Discount, i.GST) };
        }
        return i;
      })
    );
  };

  const handleDiscountChange = (barcode: string, discount: string) => {
    const val = discount === "" ? "" : Number(discount);
    setItems((prev) =>
      prev.map((i) => {
        if (i.barcode === barcode) {
          const priceToUse = pricingMode === 'Retail' ? i.price : (i.wholesaleSellingPrice || i.price);
          return { ...i, Discount: val, total: calculateItemTotal(priceToUse, i.qty, val, i.GST) };
        }
        return i;
      })
    );
  };

  const handlePriceChange = (barcode: string, newPrice: number) => {
    const validPrice = Math.max(0, newPrice);
    setItems((prev) =>
      prev.map((i) => {
        if (i.barcode === barcode) {
          const updated = { ...i };
          if (pricingMode === 'Retail') {
            updated.price = validPrice;
          } else {
            updated.wholesaleSellingPrice = validPrice;
          }
          const priceToUse = pricingMode === 'Retail' ? updated.price : (updated.wholesaleSellingPrice || updated.price);
          updated.total = calculateItemTotal(priceToUse, i.qty, i.Discount, i.GST);
          return updated;
        }
        return i;
      })
    );
  };



  const updateItemColourCode = (barcode: string, newColour: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.barcode === barcode ? { ...i, colourCode: newColour } : i
      )
    );
  };

  const handleRemoveItem = (barcode: string) => setItems((prev) => prev.filter((i) => i.barcode !== barcode));

  // MODIFIED: Total Amount is now the SUM of Item Totals (Inclusive of GST)
  // The User expects the "Total" display and calculations (Change Due, Commission) to be based on the final payable amount (e.g. 200).
  const totalAmount = items.reduce((acc, item) => acc + (item.total || 0), 0);

  // We keep totalTaxableAmount calculated in case it's needed for specific displays, but it is NOT the main total.
  const totalTaxableAmount = items.reduce((acc, item) => {
    const gstMultiplier = 1 + (item.GST || 0) / 100;
    const taxable = item.total / gstMultiplier;
    return acc + taxable;
  }, 0);



  const parsedReceivedAmount = parseFloat(receivedAmount) || 0;
  const changeDue = (paymentMethod === 'Cash' && parsedReceivedAmount > totalAmount) ? parsedReceivedAmount - totalAmount : 0;

  const handleFindBill = async (invoiceId: string) => {
    try {
      setLoading(true);

      // 1. Try Local Search first (from localBills cache)
      const localMatch = localBills?.find((b: any) =>
        (b.id && b.id.toString().toLowerCase() === invoiceId.toLowerCase()) ||
        (b.invoiceNumber && b.invoiceNumber.toString().toLowerCase() === invoiceId.toLowerCase())
      );

      let bill = localMatch;

      // 2. If not found locally, try API
      if (!bill) {
        try {
          const response = await billingApi.getById(encodeURIComponent(invoiceId));
          bill = response.data;
        } catch (apiErr) {
          console.warn("API fetch failed for bill:", apiErr);
          // Fallback: Try searching "all" endpoint if getById fails (optional, but 'allBills' should cover it)
        }
      }

      if (bill) {
        if (!bill.items || bill.items.length === 0) {
          toast.error(`No items found for invoice ${invoiceId}.`);
          setLoading(false); return;
        }

        if (bill.createdAt) {
          const createdAtDate = new Date(bill.createdAt);
          setOriginalBillDate(createdAtDate);
        }
        setOriginalInvoiceId(bill.id || invoiceId);

        const loadedItems: BillItem[] = bill.items.map((i: any) => {
          const subtotal = parseFloat(i.unitPrice || 0) * parseFloat(i.quantity || 1);
          const discountAmount = subtotal * (parseFloat(i.discountRate || 0) / 100);
          const taxableAmount = subtotal - discountAmount;
          return {
            id: i.productId || "",
            barcode: i.productId || "",
            name: i.productName || "",
            price: parseFloat(i.unitPrice || 0),
            qty: parseFloat(i.quantity || 1),
            total: taxableAmount,
            unit: i.unit || "Nos",
            GST: parseFloat(i.gstRate || 0),
            Discount: parseFloat(i.discountRate || 0),
            purchaseRate: Number(i.purchaseRate || 0),
            quantity: parseFloat(i.quantity || 1),
          };
        });

        setItems(loadedItems);
        setOriginalTotal(loadedItems.reduce((acc: number, item: BillItem) => acc + item.total, 0));

        setCustomerName(bill.customerName || "");
        const cPhone = bill.customerPhone ? bill.customerPhone.toString() : "";
        setCustomerPhone(cPhone);
        const foundCustomer = globalCustomers.find((c: any) => c.phone === cPhone);
        setCustomerId(foundCustomer ? foundCustomer.id : null);
        setCustomerAddress(bill.customerAddress || "");
        setPaymentMethod(bill.paymentMethod || "Cash");
        setCustomerGst((bill as any).customerGst || "");

        // Load split payment amounts if they exist
        if (bill.paymentMethod === "Split Payment") {
          setCashAmount((bill as any).cashAmount?.toString() || "");
          setOnlineAmount((bill as any).onlineAmount?.toString() || "");
        }

        setSelectedBroker(bill.brokerId || "");
        if (bill.brokerId && Array.isArray(brokers)) {
          const b = brokers.find((br: any) => br.id === bill.brokerId);
          setBrokerNameInput(b ? b.name : "");
        } else {
          setBrokerNameInput("");
        }
        const calculatedBrokerPct = (bill as any).brokerCommissionPercentage ||
          ((bill.commissionAmount && bill.finalAmount) ? ((bill.commissionAmount / bill.finalAmount) * 100).toFixed(2) : "");
        setBrokerCommissionPercentage(calculatedBrokerPct.toString());
        setCommissionAmount(bill.commissionAmount?.toString() || "");

        setSelectedStaffId(bill.staffId || "");
        setStaffCommissionPercentage(bill.staffCommissionPercentage?.toString() || "");

        // Transport Details Retrieval
        setVehicleNo(bill.vehicleNo || "");
        setDispatchThrough(bill.dispatchThrough || "");
        setDestination(bill.destination || "");
        setTermsOfDelivery(bill.termsOfDelivery || "");
        setTransportAmount((bill as any).transportAmount?.toString() || "");
        setTransportGstRate((bill as any).transportGstRate?.toString() || "18");

        // Ship To Details Retrieval
        const shipToActive = bill.isShipToDifferent || !!bill.shipToName;
        setIsShipToDifferent(shipToActive);
        setShipToName(bill.shipToName || "");
        setShipToPhone(bill.shipToPhone || "");
        setShipToEmail(bill.shipToEmail || "");
        setShipToAddress(bill.shipToAddress || "");
        setShipToGst(bill.shipToGst || "");

        setIsReturnMode(true);
        setIsReturnModalOpen(false);
        toast.success(`Bill ${bill.id || invoiceId} loaded successfully for return!`);
      } else {
        toast.error(`No bill found with ID: ${invoiceId}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch bill.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreStock = async (barcode: string, qtyToRestore: number) => {
    if (!isReturnMode) return;
    const product = items.find((p) => p.barcode === barcode);
    if (!product) return;

    const input = prompt(`How many of ${product.name} (Qty: ${product.qty}) to restore?`, qtyToRestore.toString());
    if (!input) return;
    const restoreQty = Math.min(parseFloat(input), Number(product.qty));
    if (isNaN(restoreQty) || restoreQty <= 0) return;

    confirmAction(`Confirm restoring ${restoreQty} unit(s) of ${product.name}?`, async () => {
      try {
        setLoading(true);
        const existingProduct = globalProducts.find((p: any) => p.barcode?.toString().trim() === barcode.toString().trim());

        if (existingProduct) {
          await productApi.updateStock(existingProduct.id, restoreQty, null);
          // Optimistic cache update — don't re-fetch all 1839 products
          mutateProducts((prev) =>
            prev.map((p) =>
              p.id === existingProduct.id
                ? { ...p, stockQuantity: (p.stockQuantity || 0) + restoreQty }
                : p
            )
          );
          setItems((prev) => prev.map((i) => i.barcode === barcode ? { ...i, qty: Number(i.qty) - restoreQty, total: calculateItemTotal(i.price, Number(i.qty) - restoreQty, i.Discount, i.GST) } : i).filter((i) => Number(i.qty) > 0));
          toast.success(`Restocked ${restoreQty} unit(s) of ${product.name}.`);
        } else {
          toast.error(`Product ${barcode} not found in inventory.`);
        }
      } catch (err: any) {
        console.error("Restoration failed", err);
        toast.error("Failed to restore stock.");
      } finally {
        setLoading(false);
      }
    });
  };

  const handleSaveBill = async (billType = "GST_INVOICE", forceCustomerId?: string) => {
    if (!items.length) throw new Error("Add at least one item!");

    const billData = buildPayloadFromUIItems(
      items,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      paymentMethod,
      receivedAmount,
      customerGst,
      billType,
      selectedBroker,
      commissionAmount,
      selectedStaffId,
      staffCommissionPercentage,
      brokerCommissionPercentage,
      cashAmount,
      onlineAmount,
      partialPaidAmount,
      paymentReminderEnabled,
      paymentReminderDays,
      vehicleNo,
      dispatchThrough,
      destination,
      termsOfDelivery,
      isShipToDifferent,
      shipToName,
      shipToPhone,
      shipToEmail,
      shipToAddress,
      shipToGst,
      transportAmount,
      transportGstRate
    );

    // Only send ID if customBillNo is provided. Otherwise let backend's generateSequentialId() handle it safely.
    if (customBillNo.trim() !== "") {
      (billData as any).id = customBillNo.trim();
    }

    if (customDate) {
      (billData as any).createdAt = new Date(customDate).toISOString();
    }

    // Inject the freshly created/resolved customer ID if available
    if (forceCustomerId) {
      (billData as any).customerId = forceCustomerId;
    } else if (customerId) {
      (billData as any).customerId = customerId;
    }

    // The helper returns a payload object. We can extend it.
    // (Status being "PAID" is handled by the backend's /create endpoint logic)

    try {
      const response = await billingApi.create(billData as any);
      const createdBill = response.data;

      if (!createdBill || !createdBill.id) {
        console.warn("Backend response missing ID:", createdBill);
        throw new Error("Parameters returned from server invalid (Missing ID)");
      }
      return createdBill;
    } catch (err: any) {
      console.error("Create bill error:", err);
      let backendMsg = err.response?.data?.message || err.response?.data?.error;
      if (typeof err.response?.data === 'string' && err.response.data.trim()) {
        backendMsg = err.response.data;
      }
      if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
        backendMsg = "Server took too long to respond. Please check recent bills or try again.";
      }
      throw new Error(backendMsg || err.message || "Failed to create bill");
    }
  };

  const handlePrint = (bill: any, onPrintComplete: () => void, withGst: boolean, targetWindow?: Window | null) => {
    const printWindow = targetWindow || window.open("", "_blank");
    if (!printWindow) {
      toast.error("Could not open print window. Please disable your popup blocker.");
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
    const html = renderToStaticMarkup(
      <ProfessionalTaxInvoice
        bill={bill}
        items={bill.items || []}
        company={companyData}
        numberToWords={numberToWords}
      />
    );

    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - ${bill.invoiceNumber || bill.id}</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body onload="window.print(); window.close();">${html}</body>
      </html>
    `);
    printWindow.document.close();

    setTimeout(() => {
      onPrintComplete();
    }, 500);
  };

  const handlePrintEstimation = (estimationId: string, onPrintComplete: () => void, targetWindow?: Window | null) => {
    const printWindow = targetWindow || window.open("", "_blank");
    if (!printWindow) {
      toast.error("Could not open print window.");
      return;
    }

    const currentDate = new Date(); // Or use originalBillDate if available? Logic below uses form state.
    const formattedDate = (originalBillDate || currentDate).toLocaleString('en-GB');

    const totalQty = items.reduce((sum, item) => sum + Number(item.qty), 0);
    const grandTotal = totalAmount; // using state totalAmount

    // Prepare Data for Component
    const companyData = {
      name: "Lingam Spares",
      address: "No. 35, Malligai Street, Mullai Nagar, Orikkai, Kanchipuram - 631502", // Hardcoded per legacy string
      gstin: gstNumber || "33BJLPN3590D1Z7",
      email: "lingamspares@gmail.com", // Example or from config? The original HTML didn't show email. Prompt requests Email in Left Header. I'll use a placeholder or check config.
      state: "Tamil Nadu"
    };

    const estState = {
      id: estimationId,
      date: formattedDate
    };

    const customerData = {
      name: customerName || "Walk-in",
      phone: customerPhone || "-",
      address: customerAddress || "",
      shippingAddress: customerAddress || "" // Assuming same for now as UI doesn't have separate ship to
    };

    const printItems = items.map(item => ({
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      rate: pricingMode === 'Retail' ? item.price : (item.wholesaleSellingPrice || item.price),
      discount: item.Discount,
      total: item.total
    }));

    const tAmount = parseFloat(transportAmount) || 0;
    const tGst = parseFloat(transportGstRate) || 18;
    if (tAmount > 0) {
      const transportTaxable = tAmount;
      const transportGstAmt = round2(tAmount * (tGst / 100));
      const transportTotal = round2(tAmount + transportGstAmt);
      printItems.push({
        name: 'Transport Charge',
        qty: '',
        unit: '',
        rate: transportTotal,
        discount: '',
        total: transportTotal
      });
    }

    const totalsData = {
      totalQty,
      grandTotal: tAmount > 0 ? grandTotal + round2(tAmount + round2(tAmount * (tGst / 100))) : grandTotal,
      amountInWords: numberToWords(tAmount > 0 ? grandTotal + round2(tAmount + round2(tAmount * (tGst / 100))) : grandTotal)
    };

    const html = renderToStaticMarkup(
      <EstimationPrint
        company={companyData}
        estimation={estState}
        customer={customerData}
        items={printItems}
        totals={totalsData}
        printedAt={new Date().toLocaleString('en-GB')}
      />
    );

    printWindow.document.write(`
      <html>
        <head>
          <title>Estimation - ${estimationId}</title>
        </head>
        <body>${html}</body>
      </html>
    `);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      // setTimeout(() => printWindow.close(), 100); // Optional: keep open or close
      onPrintComplete();
    }, 500);
  };

  const handlePrintEstimationA4 = (estimationId: string, onPrintComplete: () => void, targetWindow?: Window | null) => {
    const printWindow = targetWindow || window.open("", "_blank");
    if (!printWindow) {
      toast.error("Could not open print window.");
      return;
    }

    const currentDate = new Date();
    const formattedDate = (originalBillDate || currentDate).toLocaleString('en-GB');

    const totalQty = items.reduce((sum, item) => sum + Number(item.qty), 0);
    const grandTotal = totalAmount;

    const companyData = {
      name: "Lingam Spares",
      address: "No. 35, Malligai Street, Mullai Nagar, Orikkai, Kanchipuram - 631502",
      gstin: gstNumber || "33BJLPN3590D1Z7",
      email: "lingamspares@gmail.com",
      state: "Tamil Nadu"
    };

    const estState = {
      id: estimationId,
      date: formattedDate
    };

    const customerData = {
      name: customerName || "Walk-in",
      phone: customerPhone || "-",
      address: customerAddress || "",
      shippingAddress: customerAddress || ""
    };

    const printItems = items.map(item => ({
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      rate: pricingMode === 'Retail' ? item.price : (item.wholesaleSellingPrice || item.price),
      discount: item.Discount,
      total: item.total
    }));

    const tAmount = parseFloat(transportAmount) || 0;
    const tGst = parseFloat(transportGstRate) || 18;
    if (tAmount > 0) {
      const transportTaxable = tAmount;
      const transportGstAmt = round2(tAmount * (tGst / 100));
      const transportTotal = round2(tAmount + transportGstAmt);
      printItems.push({
        name: 'Transport Charge',
        qty: '',
        unit: '',
        rate: transportTotal,
        discount: '',
        total: transportTotal
      });
    }

    const totalsData = {
      totalQty,
      grandTotal: tAmount > 0 ? grandTotal + round2(tAmount + round2(tAmount * (tGst / 100))) : grandTotal,
      amountInWords: numberToWords(tAmount > 0 ? grandTotal + round2(tAmount + round2(tAmount * (tGst / 100))) : grandTotal)
    };

    const html = renderToStaticMarkup(
      <EstimationPrintA4
        company={companyData}
        estimation={estState}
        customer={customerData}
        items={printItems}
        totals={totalsData}
        printedAt={new Date().toLocaleString('en-GB')}
      />
    );

    printWindow.document.write(`
      <html>
        <head>
          <title>Estimation A4 - ${estimationId}</title>
        </head>
        <body>${html}</body>
      </html>
    `);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      onPrintComplete();
    }, 500);
  };

  const handlePrintProforma = (proformaId: string, onPrintComplete: () => void, targetWindow?: Window | null) => {
    const printWindow = targetWindow || window.open("", "_blank");
    if (!printWindow) {
      toast.error("Could not open print window.");
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

    const printItems = items.map(ui => {
        const unitPrice = pricingMode === 'Retail' ? ui.price : (ui.wholesaleSellingPrice || ui.price);
        const qty = Number(ui.qty || 0);
        const discountRate = Number(ui.Discount || 0);
        const gstRate = Number(ui.GST || 0);

        const subtotal = round2(unitPrice * qty);
        const discountAmount = round2(subtotal * (discountRate / 100));
        const netAmount = round2(subtotal - discountAmount);
        const taxable = round2(netAmount / (1 + (gstRate / 100)));
        const gstAmount = round2(netAmount - taxable);

        return {
            productName: ui.name,
            colourCode: ui.colourCode,
            quantity: qty,
            unit: ui.unit || 'Nos',
            unitPrice: unitPrice,
            discountRate: discountRate,
            hsnsac: (ui as any).taxCode || '',
            taxableValue: taxable,
            cgstPercent: gstRate / 2,
            sgstPercent: gstRate / 2,
            cgstAmount: round2(gstAmount / 2),
            sgstAmount: round2(gstAmount / 2),
            netAmount: netAmount
        };
    });

    const tAmount = parseFloat(transportAmount) || 0;
    const tGst = parseFloat(transportGstRate) || 18;
    if (tAmount > 0) {
        const transportTaxable = tAmount;
        const transportGstAmt = round2(tAmount * (tGst / 100));
        const transportNet = round2(tAmount + transportGstAmt);
        printItems.push({
            productName: 'Transport Charge',
            colourCode: '',
            quantity: 1,
            unit: '',
            unitPrice: transportNet,
            discountRate: 0,
            hsnsac: '',
            taxableValue: transportTaxable,
            cgstPercent: tGst / 2,
            sgstPercent: tGst / 2,
            cgstAmount: round2(transportGstAmt / 2),
            sgstAmount: round2(transportGstAmt / 2),
            netAmount: transportNet
        });
    }

    const billData = {
      proformaId,
      invoiceNumber: proformaId,
      customerName,
      customerPhone,
      customerAddress,
      customerGst,
      createdAt: originalBillDate || new Date(),
      vehicleNo,
      dispatchThrough,
      destination,
      termsOfDelivery,
      isShipToDifferent,
      shipToName,
      shipToPhone,
      shipToAddress,
      shipToGst,
      totalTaxable: round2(printItems.reduce((s, it) => s + it.taxableValue, 0)),
      totalCGST: round2(printItems.reduce((s, it) => s + it.cgstAmount, 0)),
      totalSGST: round2(printItems.reduce((s, it) => s + it.sgstAmount, 0)),
      totalGstAmount: round2(printItems.reduce((s, it) => s + it.cgstAmount + it.sgstAmount, 0)),
      finalAmount: round2(printItems.reduce((s, it) => s + it.netAmount, 0)),
      transportAmount: tAmount,
      transportGstRate: tGst,
      items: printItems
    };

    const html = renderToStaticMarkup(
      <ProformaInvoice
        bill={billData}
        items={billData.items as any}
        company={companyData}
        numberToWords={numberToWords}
      />
    );

    printWindow.document.write(`
      <html>
        <head>
          <title>Proforma Invoice - ${proformaId}</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body onload="window.print(); window.close();">${html}</body>
      </html>
    `);
    printWindow.document.close();

    setTimeout(() => {
      onPrintComplete();
    }, 500);
  };

  const handleSaveAndPrint = async (withGst: boolean, printFormat: 'A5' | 'A4' = 'A5') => {
    if (!items.length) {
      toast.error("Add at least one item!");
      return;
    }

    const isEstimation = documentMode === 'Estimation';
    const isProforma = documentMode === 'Proforma';
    const skipPayment = isEstimation || isProforma;

    if (!skipPayment) {
      if (paymentMethod === "Cash") {
        if (!receivedAmount || parseFloat(receivedAmount) <= 0) {
          toast.error("Please enter the amount received.");
          return;
        }
        if (parseFloat(receivedAmount) < totalAmount) {
          toast.error(`Received amount is less than the payable amount.`);
          return;
        }
      }
    }

    if (!skipPayment && paymentMethod === "Split Payment") {
      const cash = parseFloat(cashAmount) || 0;
      const online = parseFloat(onlineAmount) || 0;
      const total = cash + online;

      if (cash <= 0 || online <= 0) {
        toast.error("Both Cash and Online amounts must be greater than zero for Split Payment.");
        return;
      }

      if (Math.abs(total - totalAmount) > 0.01) { // Allow small floating point differences
        toast.error(`Split payment amounts (₹${total.toFixed(2)}) must equal the bill total (₹${totalAmount.toFixed(2)}).`);
        return;
      }
    }

    if (!skipPayment && (paymentMethod === "PARTIAL" || (paymentMethod === "HOLD" && parseFloat(partialPaidAmount) > 0))) {
      if (!customerPhone || customerPhone.length < 10) {
        toast.error("Customer selection is required for Partial or Credit bills.");
        return;
      }
    }

    // --- PRE-OPEN PRINT WINDOW ---
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Could not open print window. Please disable your popup blocker.");
      return;
    }

    // -----------------------------
    // -----------------------------

    setLoading(true);

    // 1. Save/Get Customer Logic
    // We must await this to ensure we link the bill to the correct Customer ID for "Total Spent" tracking.
    let finalCustomerId = customerId;

    if (customerId) {
      // Existing customer: Update details in background (non-blocking for ID, but good to ensure up-to-date)
      customerApi.update(customerId, { name: customerName, phone: customerPhone, email: customerEmail, address: customerAddress, gstin: customerGst } as any)
        .then(() => refreshCustomers()) // Refresh to get latest stats if backend updates them
        .catch(err => console.error("Background customer update failed:", err));
    } else if (customerName || customerPhone) {
      // New Customer or Search by Phone failed previously
      try {
        // Check if exists in global cache, otherwise add
        const existingCustomer = globalCustomers.find(c => c.phone === customerPhone);
        if (existingCustomer) {
          finalCustomerId = existingCustomer.id;
        } else {
          const addRes = await customerApi.add({ name: customerName, phone: customerPhone, email: customerEmail, address: customerAddress, gstin: customerGst } as any);
          if (addRes.data && (addRes.data as any).id) {
            finalCustomerId = (addRes.data as any).id;
          }
        }
      } catch (err) {
        console.error("Failed to create/link customer:", err);
        // Proceed without linking if customer creation fails, to not block sale
      }
      refreshCustomers(); // Ensure global list is updated
    }

    try {
      if (documentMode === 'Estimation') {
        const estItems = items.map(ui => ({
            productId: (ui as any).id || ui.barcode,
            productName: ui.name,
            quantity: Number(ui.qty),
            unit: (ui as any).unit,
            unitPrice: pricingMode === 'Retail' ? ui.price : (ui.wholesaleSellingPrice || ui.price),
            netAmount: ui.total,
            gstRate: ui.GST,
            discountRate: Number(ui.Discount || 0),
            taxCode: ui.taxCode,
            colourCode: ui.colourCode
        }));

        const tAmount = parseFloat(transportAmount) || 0;
        const tGst = parseFloat(transportGstRate) || 18;
        if (tAmount > 0) {
            const transportTaxable = tAmount;
            const transportGstAmt = round2(tAmount * (tGst / 100));
            const transportNet = round2(tAmount + transportGstAmt);
            estItems.push({
                productId: 'TRANSPORT_CHARGE',
                productName: 'Transport Charge',
                quantity: 1,
                unit: '',
                unitPrice: transportNet,
                netAmount: transportNet,
                gstRate: tGst,
                discountRate: 0,
                taxCode: '',
                colourCode: ''
            });
        }

        const estPayload = {
          customerId: finalCustomerId,
          customerName,
          customerPhone: Number(customerPhone.replace(/\D/g, '')) || 0,
          customerEmail,
          customerAddress,
          customerGst,
          pricingMode,
          items: estItems,
          vehicleNo,
          dispatchThrough,
          destination,
          termsOfDelivery,
          transportAmount: tAmount,
          transportGstRate: tGst,
          finalAmount: tAmount > 0 ? round2(totalAmount + tAmount + round2(tAmount * (tGst / 100))) : totalAmount,
          createdAt: originalBillDate || new Date()
        };

        let res;
        if (originalInvoiceId) {
          res = await estimationApi.update(originalInvoiceId, estPayload as any);
        } else {
          res = await estimationApi.create(estPayload as any);
        }

        const estimationId = res.data?.estimationId || res.data?.id || originalInvoiceId;

        const printFn = printFormat === 'A4' ? handlePrintEstimationA4 : handlePrintEstimation;
        printFn(estimationId, () => {
          toast.success(originalInvoiceId ? "Estimation updated & printed!" : "Estimation saved & printed!");
          setIsEstimationSaved(true);
          setLastEstimationId(estimationId);
          // Post-Estimation Reset: Clear items and totals but maintain Estimation mode
          handleReset();
          // documentMode remains 'Estimation' because handleReset no longer resets it blindly
        }, printWindow);
        return;
      }

      if (documentMode === 'Proforma') {
        const tAmount = parseFloat(transportAmount) || 0;
        const tGst = parseFloat(transportGstRate) || 18;

        const proformaItems = items.map(ui => {
          const unitPrice = pricingMode === 'Retail' ? ui.price : (ui.wholesaleSellingPrice || ui.price);
          const qty = Number(ui.qty || 0);
          const discountRate = Number(ui.Discount || 0);
          const gstRate = Number(ui.GST || 0);

          const subtotal = round2(unitPrice * qty);
          const discountAmount = round2(subtotal * (discountRate / 100));
          const netAmount = round2(subtotal - discountAmount);
          const taxable = round2(netAmount / (1 + (gstRate / 100)));
          const gstAmount = round2(netAmount - taxable);

          return {
            productId: (ui as any).id || ui.barcode,
            productName: ui.name,
            quantity: qty,
            unit: (ui as any).unit || 'Nos',
            unitPrice: unitPrice,
            gstRate: gstRate,
            discountRate: discountRate,
            hsnsac: (ui as any).taxCode || '',
            taxCode: (ui as any).taxCode,
            colourCode: (ui as any).colourCode,
            subtotal: subtotal,
            discountAmount: discountAmount,
            gstAmount: gstAmount,
            netAmount: netAmount,
            taxableValue: taxable,
            cgstPercent: gstRate / 2,
            sgstPercent: gstRate / 2,
            cgstAmount: round2(gstAmount / 2),
            sgstAmount: round2(gstAmount / 2),
          };
        });

        if (tAmount > 0) {
            const transportTaxable = tAmount;
            const transportGstAmt = round2(tAmount * (tGst / 100));
            const transportNet = round2(tAmount + transportGstAmt);
            proformaItems.push({
                productId: 'TRANSPORT_CHARGE',
                productName: 'Transport Charge',
                quantity: 1,
                unit: '',
                unitPrice: transportNet,
                gstRate: tGst,
                discountRate: 0,
                hsnsac: '',
                taxCode: '',
                colourCode: '',
                subtotal: transportNet,
                discountAmount: 0,
                gstAmount: transportGstAmt,
                netAmount: transportNet,
                taxableValue: transportTaxable,
                cgstPercent: tGst / 2,
                sgstPercent: tGst / 2,
                cgstAmount: round2(transportGstAmt / 2),
                sgstAmount: round2(transportGstAmt / 2),
            });
        }

        const proformaPayload = {
          customerId: finalCustomerId,
          customerName,
          customerPhone: Number(customerPhone.replace(/\D/g, '')) || 0,
          customerEmail,
          customerAddress,
          customerGst,
          pricingMode,
          items: proformaItems,
          vehicleNo,
          dispatchThrough,
          destination,
          termsOfDelivery,
          transportAmount: tAmount,
          transportGstRate: tGst,
          totalTaxable: round2(proformaItems.reduce((s, it) => s + it.taxableValue, 0)),
          totalCGST: round2(proformaItems.reduce((s, it) => s + it.cgstAmount, 0)),
          totalSGST: round2(proformaItems.reduce((s, it) => s + it.sgstAmount, 0)),
          totalGstAmount: round2(proformaItems.reduce((s, it) => s + it.gstAmount, 0)),
          finalAmount: round2(proformaItems.reduce((s, it) => s + it.netAmount, 0)),
          createdAt: originalBillDate || new Date()
        };

        let res;
        if (originalInvoiceId) {
          res = await proformaApi.update(originalInvoiceId, proformaPayload as any);
        } else {
          res = await proformaApi.create(proformaPayload as any);
        }

        const proformaId = res.data?.proformaId || res.data?.id || originalInvoiceId;

        handlePrintProforma(proformaId, () => {
          toast.success(originalInvoiceId ? "Proforma updated & printed!" : "Proforma saved & printed!");
          setIsProformaSaved(true);
          setLastProformaId(proformaId);
          handleReset();
        }, printWindow);
        return;
      }

      // --- CASE 1: Paying a Held Bill ---
      if (currentHoldId) {
        const payload = buildPayloadFromUIItems(
          items, customerName, customerPhone, customerEmail, customerAddress,
          paymentMethod, receivedAmount, customerGst, withGst ? "GST_INVOICE" : "ESTIMATE", selectedBroker, commissionAmount, selectedStaffId, staffCommissionPercentage, brokerCommissionPercentage, cashAmount, onlineAmount, partialPaidAmount,
          paymentReminderEnabled, paymentReminderDays, vehicleNo, dispatchThrough, destination, termsOfDelivery, isShipToDifferent, shipToName, shipToPhone, shipToEmail, shipToAddress, shipToGst, transportAmount, transportGstRate
        );

        // Use pay endpoint which is an UPDATE operation
        const res = await billingApi.pay(currentHoldId, payload);
        const updatedBill = res.data;
        // Use returned invoice number or ID, falling back to currentHoldId
        const printId = updatedBill?.invoiceNumber || updatedBill?.id || currentHoldId;

        handlePrint(updatedBill, () => {
          toast.success(`Held Bill Updated & Paid.`);
          setTimeout(handleReset, 1500);
          refreshLocalBills(); // Refresh held bills list
          refreshBills(); // Refresh global bills for dashboard
        }, withGst, printWindow);
        return;
      }

      // --- CASE 2: Normal Bill Creation ---
      const createdBill = await handleSaveBill(withGst ? "GST_INVOICE" : "ESTIMATE", finalCustomerId);

      if (enableReminder) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + Number(reminderDays || 30));

        try {
          await reminderApi.create({
            customerId: finalCustomerId,
            customerName: customerName,
            customerPhone: customerPhone ? String(customerPhone) : undefined,
            billId: (createdBill as any).id, // Using id from createdBill object
            productName: items.map(i => i.name).join(", "),
            expiryDate: expiryDate.toISOString(),
            notified: false
          });
          toast.success("Expiry reminder set!");
        } catch (remErr) {
          console.error("Failed to set reminder", remErr);
          toast.error("Bill created, but failed to set reminder.");
        }
      }

      handlePrint(createdBill, () => {
        toast.success(`Bill ${(createdBill as any).id} created & printed.`);
        refreshBills(); // Refresh global bill list to update dashboard
        handleReset(); // Requirement: Reset form properly after printing
      }, withGst, printWindow);

    } catch (err: any) {
      console.error("Save & Print error:", err);
      printWindow.close(); // Close the pre-opened window on error
      toast.error(err.response?.data?.error || err.message || "Failed to process bill.");
    } finally {
      setLoading(false);
    }
  };

  const handleHoldBill = async () => {
    if (!items.length) return toast.error("No items to hold!");
    try {
      setLoading(true);
      const payload = buildPayloadFromUIItems(
        items, customerName, customerPhone, customerEmail, customerAddress, "HOLD", receivedAmount, customerGst, "GST_INVOICE", selectedBroker, commissionAmount, selectedStaffId, staffCommissionPercentage, brokerCommissionPercentage, cashAmount, onlineAmount, partialPaidAmount,
        paymentReminderEnabled, paymentReminderDays, vehicleNo, dispatchThrough, destination, termsOfDelivery, isShipToDifferent, shipToName, shipToPhone, shipToEmail, shipToAddress, shipToGst, transportAmount, transportGstRate
      );

      let res;
      if (currentHoldId) {
        // Update existing hold instead of creating a new one and cancelling the old
        // Using 'pay' endpoint but with 'HOLD' status in the payload
        res = await billingApi.pay(currentHoldId, payload);
      } else {
        // Create new hold record
        res = await billingApi.hold(payload as any);
      }

      if (res.status === 200 || res.status === 201) {
        toast.success(currentHoldId ? "Held bill updated!" : "Bill placed on hold!");

        // Reset form immediately to clear currentHoldId and return to main state
        handleReset();

        // Refresh the list with a slight delay to ensure backend has processed the write
        setTimeout(async () => {
          await refreshLocalBills();
        }, 500);
      } else {
        toast.error("Failed to hold bill. Please try again.");
      }
    } catch (err: any) {
      console.error("hold error:", err);
      toast.error(err.response?.data?.error || err.message || "Failed to hold bill.");
    } finally {
      setLoading(false);
    }
  };

  const handleRetrieveHold = async (bill: any) => {
    setItems(bill.items.map((i: any) => {
      const unitPrice = parseFloat(i.unitPrice ?? i.purchaseRate ?? 0);
      const gstRate = parseFloat(i.gstRate ?? i.purchaseGstRate ?? 0);
      const discountRate = parseFloat(i.discountRate ?? 0);
      const qty = parseFloat(i.quantity ?? 1);

      const subtotal = unitPrice * qty;
      const discountAmount = subtotal * (discountRate / 100);
      const netAmount = subtotal - discountAmount;

      return {
        id: i.productId,
        barcode: i.productId,
        name: i.productName,
        price: unitPrice,
        qty: qty,
        total: netAmount,
        unit: i.unit || "Nos",
        quantity: qty,
        GST: gstRate,
        Discount: discountRate,
        // MRP removed
        // Map other fields if needed
        purchaseRate: Number(i.purchaseRate || 0),
      };
    }));
    setCustomerName(bill.customerName || "");
    const cPhone = bill.customerPhone ? String(bill.customerPhone) : "";
    setCustomerPhone(cPhone);
    const foundCustomer = globalCustomers.find((c: any) => c.phone === cPhone);
    setCustomerId(foundCustomer ? foundCustomer.id : null);
    setCustomerEmail(bill.customerEmail || "");
    setCustomerAddress(bill.customerAddress || ""); // Added retrieval
    setCustomerGst(bill.customerGst || ""); // if available
    setSelectedBroker(bill.brokerId || "");
    if (bill.brokerId && Array.isArray(brokers)) {
      const b = brokers.find((br: any) => br.id === bill.brokerId);
      setBrokerNameInput(b ? b.name : "");
    } else {
      setBrokerNameInput("");
    }

    setPaymentMethod(bill.paymentMethod ?? "HOLD");
    setReceivedAmount("");
    // Load split payment amounts if they exist
    if (bill.paymentMethod === "Split Payment") {
      setCashAmount((bill as any).cashAmount?.toString() || "");
      setOnlineAmount((bill as any).onlineAmount?.toString() || "");
    }
    setPartialPaidAmount(bill.amountPaid?.toString() || "");
    setCurrentHoldId(bill.id ?? null);
    setCommissionAmount(bill.commissionAmount || bill.commission || "");
    const calculatedBrokerPct = (bill as any).brokerCommissionPercentage ||
      (((bill.commissionAmount || bill.commission) && (bill.finalAmount || bill.totalAmount)) ? ((Number(bill.commissionAmount || bill.commission) / Number(bill.finalAmount || bill.totalAmount)) * 100).toFixed(2) : "");
    setBrokerCommissionPercentage(calculatedBrokerPct.toString());
    setSelectedStaffId(bill.staffId || "");
    setStaffCommissionPercentage(bill.staffCommissionPercentage || "");
    setIsHoldLoaded(true);

    // Transport Details Retrieval
    setVehicleNo(bill.vehicleNo || "");
    setDispatchThrough(bill.dispatchThrough || "");
    setDestination(bill.destination || "");
    setTermsOfDelivery(bill.termsOfDelivery || "");
    setTransportAmount((bill as any).transportAmount?.toString() || "");
    setTransportGstRate((bill as any).transportGstRate?.toString() || "18");

    // Ship To Details Retrieval
    const shipToActive = bill.isShipToDifferent || !!bill.shipToName;
    setIsShipToDifferent(shipToActive);
    setShipToName(bill.shipToName || "");
    setShipToPhone(bill.shipToPhone || "");
    setShipToEmail(bill.shipToEmail || "");
    setShipToAddress(bill.shipToAddress || "");
    setShipToGst(bill.shipToGst || "");
  };

  const handleDeleteHeldBill = (billId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    openCancelModal(billId, 'cancel');
  };

  // Mark a bill number as CANCELLED — works whether or not a real bill exists for it.
  // Keeps/creates the record in the list so it shows as cancelled in reports & bill selection.
  const performCancelByNumber = async (target: string) => {
    try {
      setLoading(true);
      await billingApi.cancelPlaceholder(target);
      // Mutate local cache immediately
      setLocalBills(prev => {
        const exists = prev.find(b => (b.id || b.invoiceNumber) === target);
        if (exists) {
          return prev.map(b => (b.id || b.invoiceNumber) === target ? { ...b, status: 'CANCELLED' } : b);
        }
        // No existing bill — add a placeholder cancelled record
        return [
          ...prev,
          {
            id: target,
            status: 'CANCELLED',
            paymentMethod: 'CANCELLED',
            createdAt: new Date().toISOString(),
            items: [],
            finalAmount: 0,
            customerName: 'Cancelled Bill',
          },
        ];
      });
      setCustomBillNo(""); // let auto-numbering take over
      toast.success('Bill marked as Cancelled!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel bill.');
    } finally {
      setLoading(false);
      closeCancelModal();
    }
  };

  // Restore a previously cancelled bill to its previous status (frees the number for reuse)
  const performUncancelBill = async (billId: string) => {
    try {
      setLoading(true);
      await billingApi.uncancel(billId);
      // Fetch restored record to get the correct previous status
      try {
        const res = await billingApi.getById(encodeURIComponent(billId));
        const restored = res.data;
        setLocalBills(prev => prev.map(b => b.id === billId ? { ...b, ...restored } : b));
      } catch {
        setLocalBills(prev => prev.map(b => b.id === billId ? { ...b, status: 'PAID', previousStatus: null } : b));
      }
      toast.success('Bill restored — number available for reuse!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to restore bill.');
    } finally {
      setLoading(false);
      closeCancelModal();
    }
  };

  // Cancel the currently selected bill number via the "Cancel Bill" button.
  // Works even if no bill exists yet for that number (creates a cancelled placeholder).
  const handleCancelSelectedBill = () => {
    const target = (customBillNo || nextBillNo || '').trim();
    if (!target) return;
    const bill = localBills.find(b => (b.id || b.invoiceNumber) === target);
    if (bill && (bill.status || '').toUpperCase() === 'CANCELLED') {
      toast.error(`Bill ${target} is already cancelled.`);
      return;
    }
    openCancelModal(target, 'cancel');
  };

  const handleReset = () => {
    setItems([]); setBarcode(""); setCustomerName(""); setCustomerPhone(""); setCustomerEmail("");
    setCustomerGst(""); setCustomerAddress("");
    setPaymentMethod("Cash"); setReceivedAmount("");
    setCashAmount(""); setOnlineAmount("");
    setPartialPaidAmount("");

    setEnableReminder(false);
    setReminderDays(30);
    setIsReturnMode(false);
    setOriginalBillDate(null);
    setOriginalInvoiceId("");
    setOriginalTotal(0);
    setCustomerMode("Walk-in");
    setCurrentHoldId(null);
    setIsHoldLoaded(false);
    setSelectedBroker("");
    setBrokerNameInput("");
    setBrokerNameInput("");
    setCommissionAmount("");
    setSelectedStaffId("");
    setStaffCommissionPercentage("");
    setCustomerId(null);
    setPricingMode("Retail");
    // Do NOT reset documentMode here to preserve Estimation/Billing selection
    // setDocumentMode("Billing"); 
    setIsEstimationSaved(false);
    setLastEstimationId(null);
    setIsProformaSaved(false);
    setLastProformaId(null);
    setIsReturnMode(false);
    setOriginalInvoiceId("");
    setCustomBillNo("");
    setCustomDate("");

    // Transport Details Reset
    setVehicleNo("");
    setDispatchThrough("");
    setDestination("");
    setTermsOfDelivery("");
    setTransportAmount("");
    setTransportGstRate("18");

    // Ship To Reset
    setIsShipToDifferent(false);
    setShipToName("");
    setShipToPhone("");
    setShipToEmail("");
    setShipToAddress("");
    setShipToGst("");
  };

  const handleLoadEstimation = async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await estimationApi.getById(id);
      const est = res.data;
      if (est) {
        setCustomerName(est.customerName || "");
        setCustomerPhone(est.customerPhone ? String(est.customerPhone) : "");
        setPricingMode(est.pricingMode as any || 'Retail');

        const loadedItems: BillItem[] = est.items.map((item: any) => {
          const originalProd = globalProducts.find(p => p.id === item.productId || p.barcode === item.productId);
          return {
            id: item.productId,
            barcode: originalProd?.barcode || item.productId,
            name: item.productName,
            price: item.unitPrice,
            wholesaleSellingPrice: originalProd?.wholesaleSellingPrice,
            unit: item.unit || originalProd?.unit || "Nos",
            GST: item.gstRate,
            Discount: item.discountRate,
            qty: item.quantity,
            total: item.netAmount,
            quantity: originalProd?.stockQuantity ?? 0,
            purchaseRate: originalProd?.purchaseRate ?? 0,
            taxCode: originalProd?.taxCode || item.taxCode,
            colourCode: originalProd?.colourCode || item.colourCode
          };
        });

        setItems(loadedItems);
        // Load Estimation UX = Return Bill UX Parity
        // setIsReturnMode(true); // REVERTED: Do NOT treat estimation edit as Return Mode
        setDocumentMode('Estimation');
        setOriginalBillDate(est.createdAt ? new Date(est.createdAt) : new Date());
        setOriginalInvoiceId(id);
        const estTotal = loadedItems.reduce((acc: number, item: BillItem) => acc + item.total, 0);
        setOriginalTotal(estTotal);

        setIsLoadEstimationModalOpen(false);
        setEstIdInput("");
        toast.success("Estimation loaded! View mode active.");

        // Transport Details Retrieval
        setVehicleNo(est.vehicleNo || "");
        setDispatchThrough(est.dispatchThrough || "");
        setDestination(est.destination || "");
        setTermsOfDelivery(est.termsOfDelivery || "");
        setTransportAmount((est as any).transportAmount?.toString() || "");
        setTransportGstRate((est as any).transportGstRate?.toString() || "18");

        // Ship To Details Retrieval
        const shipToActive = est.isShipToDifferent || !!est.shipToName;
        setIsShipToDifferent(shipToActive);
        setShipToName(est.shipToName || "");
        setShipToPhone(est.shipToPhone || "");
        setShipToEmail(est.shipToEmail || "");
        setShipToAddress(est.shipToAddress || "");
        setShipToGst(est.shipToGst || "");
      } else {
        toast.error("Estimation not found.");
      }
    } catch (err) {
      console.error("Load estimation failed:", err);
      toast.error("Failed to load estimation.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadProforma = async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await proformaApi.getById(id);
      const proforma = res.data;
      if (proforma) {
        setCustomerName(proforma.customerName || "");
        setCustomerPhone(proforma.customerPhone ? String(proforma.customerPhone) : "");
        setPricingMode(proforma.pricingMode as any || 'Retail');

        const loadedItems: BillItem[] = proforma.items.map((item: any) => {
          const originalProd = globalProducts.find(p => p.id === item.productId || p.barcode === item.productId);
          return {
            id: item.productId,
            barcode: originalProd?.barcode || item.productId,
            name: item.productName,
            price: item.unitPrice,
            wholesaleSellingPrice: originalProd?.wholesaleSellingPrice,
            unit: item.unit || originalProd?.unit || "Nos",
            GST: item.gstRate,
            Discount: item.discountRate,
            qty: item.quantity,
            total: item.netAmount,
            quantity: originalProd?.stockQuantity ?? 0,
            purchaseRate: originalProd?.purchaseRate ?? 0,
            taxCode: originalProd?.taxCode || item.taxCode,
            colourCode: originalProd?.colourCode || item.colourCode
          };
        });

        setItems(loadedItems);
        setDocumentMode('Proforma');
        setOriginalBillDate(proforma.createdAt ? new Date(proforma.createdAt) : new Date());
        setOriginalInvoiceId(id);
        const proformaTotal = loadedItems.reduce((acc: number, item: BillItem) => acc + item.total, 0);
        setOriginalTotal(proformaTotal);

        setIsLoadProformaModalOpen(false);
        setProformaIdInput("");
        toast.success("Proforma loaded! View mode active.");

        setVehicleNo(proforma.vehicleNo || "");
        setDispatchThrough(proforma.dispatchThrough || "");
        setDestination(proforma.destination || "");
        setTermsOfDelivery(proforma.termsOfDelivery || "");
        setTransportAmount((proforma as any).transportAmount?.toString() || "");
        setTransportGstRate((proforma as any).transportGstRate?.toString() || "18");

        const shipToActive = proforma.isShipToDifferent || !!proforma.shipToName;
        setIsShipToDifferent(shipToActive);
        setShipToName(proforma.shipToName || "");
        setShipToPhone(proforma.shipToPhone || "");
        setShipToEmail(proforma.shipToEmail || "");
        setShipToAddress(proforma.shipToAddress || "");
        setShipToGst(proforma.shipToGst || "");
      } else {
        toast.error("Proforma not found.");
      }
    } catch (err) {
      console.error("Load proforma failed:", err);
      toast.error("Failed to load proforma.");
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!items || items.length === 0) {
      toast.error("Add at least one item to the bill before exporting to Excel.");
      return;
    }
    const wb = utils.book_new();
    const data = items.map((i, idx) => ({
      SN: idx + 1, Customer: customerName, Phone: customerPhone, Payment: paymentMethod,
      Product: i.name, Quantity: i.qty, Price: i.price, Total: i.total,
    }));
    const ws = utils.json_to_sheet(data);
    utils.book_append_sheet(wb, ws, "Bill");
    writeFile(wb, `${customerName || "Bill"}.xlsx`);
  };

  // --- Save Return (Cancel Old Bill & Create New Bill) ---
  const handleSaveReturnAndPrint = async () => {
    if (!items.length) {
      toast.error("No items to save!");
      return;
    }

    setLoading(true);
    try {
      // 1. Mark original bill as RETURNED
      // Using returnBill instead of cancelHold
      await billingApi.returnBill(originalInvoiceId, { status: 'RETURNED' } as any);

      // 2. Create a NEW Bill for the exchange
      // We carry over final amount logic. 
      // If it's a return/exchange, typically we settle the difference.
      // For this specific logic requested, we treat the new bill as the final record.
      const payload = buildPayloadFromUIItems(
        items,
        customerName,
        customerPhone,
        customerEmail,
        customerAddress,
        paymentMethod,
        totalAmount.toString(), // Pass full amount to ensure it's marked PAID or handled as such
        customerGst,
        "GST_INVOICE", // Default return to GST Invoice
        selectedBroker,
        commissionAmount,
        selectedStaffId,
        staffCommissionPercentage,
        brokerCommissionPercentage,
        cashAmount,
        onlineAmount,
        undefined, // partialPaidAmountRaw
        paymentReminderEnabled,
        paymentReminderDays,
        vehicleNo,
        dispatchThrough,
        destination,
        termsOfDelivery,
        isShipToDifferent,
        shipToName,
        shipToPhone,
        shipToEmail,
        shipToAddress,
        shipToGst,
        transportAmount,
        transportGstRate
      );
      (payload as any).status = "PAID";

      const response = await billingApi.create(payload as any);
      const newBillId = response.data?.id || response.data?.bill?.id;

      if (!newBillId) throw new Error("Failed to retrieve new bill ID.");

      // 3. Print the NEW Bill
      // Use original logic to print, passing true for GST if desired, or make it selectable. 
      // User's provided reference implies "Update & Print", often meaning with GST or standard format.
      // We will default to With GST for returns to be safe, or we could add a prompt.
      // For now, defaulting to standard print.
      handlePrint(response.data, () => {
        toast.success(`Return processed. Old Bill ${originalInvoiceId} Cancelled. New Bill ${newBillId} created.`);
        handleReset(); // Re-enabled for return processing
      }, true); // Printing with GST true by default for returns

    } catch (err: any) {
      console.error("Return processing error:", err);
      // const status = err.response?.status;
      const errMsg = err.response?.data?.error || err.message;
      toast.error(`Failed to process return. (${errMsg})`);
    } finally {
      setLoading(false);
    }
  };

  // Keyboard customization for Estimation Print - Moved to end to avoid TDZ
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "m") {
        if (documentMode === 'Estimation') {
          const idToPrint = originalInvoiceId || lastEstimationId || "DRAFT";
          handlePrintEstimation(idToPrint, () => { });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [documentMode, originalInvoiceId, lastEstimationId, items, customerName, customerPhone, pricingMode, totalAmount]);

  return (
    <>
      <ConfirmationDialog />
      {cancelModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
              <X size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {cancelModal.mode === 'cancel' ? 'Cancel Bill' : 'Restore Bill'}
            </h3>
            <p className="text-gray-500 mb-6 text-sm leading-relaxed">
              {cancelModal.mode === 'cancel'
                ? 'Are you sure you want to CANCEL this bill? It will be stored as a cancelled bill and the number cannot be reused.'
                : 'Restore this cancelled bill? Its number will become available for reuse.'}
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={closeCancelModal}
                className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => cancelModal.billId && (cancelModal.mode === 'cancel' ? performCancelByNumber(cancelModal.billId) : performUncancelBill(cancelModal.billId))}
                disabled={loading}
                className={`flex-1 px-4 py-2.5 text-white rounded-xl transition-colors font-semibold text-sm shadow-md ${loading ? 'opacity-50 cursor-not-allowed ' : ''}${cancelModal.mode === 'cancel' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {loading ? 'Processing...' : cancelModal.mode === 'cancel' ? 'Yes, Cancel' : 'Yes, Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
      {isReturnModalOpen && <ReturnModal onFind={handleFindBill} onClose={() => setIsReturnModalOpen(false)} />}
      {isBillingHistoryOpen && (
        <BillingHistoryModal
          productId={historyProductId}
          productName={historyProductName}
          onClose={() => { setIsBillingHistoryOpen(false); setHistoryProductId(undefined); setHistoryProductName(''); }}
        />
      )}
      {isSelectionModalOpen && (
        <ProductSelectionModal
          products={searchResults}
          onSelect={(product) => {
            // We need to call the logic inside handleAddProduct. 
            // Since we can't easily access the closure, we'll duplicate the add logic here for now
            // OR better, we can just call a shared add function if we extract it.
            // For now, I will just duplicate the simple add logic to avoid large refactors.

            setItems((prev) => {
              const existingItem = prev.find((i) => i.barcode === product.barcode);
              if (existingItem) {
                return prev.map((i) =>
                  i.barcode === product.barcode
                    ? { ...i, qty: Number(i.qty) + 1, total: calculateItemTotal(pricingMode === 'Retail' ? i.price : (i.wholesaleSellingPrice || i.price), Number(i.qty) + 1, i.Discount, i.GST) }
                    : i
                );
              } else {
                const resolvedPrice = pricingMode === 'Retail' ? product.price : (product.wholesaleSellingPrice || product.price);
                const newItem: BillItem = {
                  id: product.id,
                  barcode: product.barcode,
                  name: product.name,
                  unit: product.unit || "Nos",
                  price: product.price,
                  wholesaleSellingPrice: product.wholesaleSellingPrice,
                  GST: product.gst ?? product.purchaseGst ?? 0,
                  Discount: "",
                  quantity: product.quantity ?? product.stockQuantity ?? 1,
                  qty: 1,
                  total: calculateItemTotal(resolvedPrice, 1, 0, product.gst ?? product.purchaseGst ?? 0),
                  purchaseRate: product.purchaseRate || 0,
                  taxCode: product.taxCode,
                  colourCode: product.colourCode,
                };
                return [...prev, newItem];
              }
            });
            setBarcode("");
            setSearchResults([]);
            setIsSelectionModalOpen(false);
            toast.success(`Added ${product.name}`);
          }}
          onClose={() => setIsSelectionModalOpen(false)}
        />
      )}
            <motion.div
        className="p-6 sm:p-8 bg-gradient-to-br from-indigo-50/70 via-blue-50/40 to-slate-100 shadow-xl rounded-3xl space-y-6 backdrop-blur-xl border border-white/60"
      >
        {/* 1. TOP HEADER & CONTROLS */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 sm:p-6 shadow-md border border-white/80 relative overflow-hidden">
          <div className="flex flex-col gap-5">
            {/* Top Row: Title, Document Mode & Pricing Mode */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5">
              {/* Title Section */}
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl shadow-md shadow-blue-500/25">
                  <ShoppingCart className="h-7 w-7" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                      {isReturnMode ? (documentMode === 'Estimation' ? "Estimation" : "Return Processing") : documentMode === 'Estimation' ? 'Estimation Page' : documentMode === 'Proforma' ? 'Proforma Invoice' : "Smart Billing Dashboard"}
                    </h1>
                    <SyncIndicator isSyncing={isSyncing} className="scale-90 opacity-80" />
                    <button
                      onClick={() => { refreshProducts(); refreshCustomers(); refreshLocalBills(); toast("Refreshing data...", { icon: '🔄' }); }}
                      className="p-2 bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-full transition-all border border-transparent hover:border-blue-200"
                      title="Refresh Data Override"
                    >
                      <RefreshCw size={15} className={globalLoading ? "animate-spin text-blue-600" : ""} />
                    </button>
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">Manage your transactions seamlessly</p>
                </div>
              </div>

              {/* Document Mode Toggle */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Document Mode</span>
                <div className="flex p-1 bg-slate-100 border border-slate-200/80 rounded-xl shadow-inner">
                    <button
                      onClick={() => {
                        setDocumentMode('Billing');
                        setIsReturnMode(false);
                        setOriginalInvoiceId("");
                      }}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${documentMode === 'Billing' ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700/20' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                    >
                      BILLING
                    </button>
                    <button
                      onClick={() => {
                        setDocumentMode('Estimation');
                        setIsReturnMode(false);
                        setOriginalInvoiceId("");
                      }}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${documentMode === 'Estimation' ? 'bg-amber-500 text-white shadow-sm ring-1 ring-amber-600/20' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                    >
                      ESTIMATION
                    </button>
                    <button
                      onClick={() => {
                        setDocumentMode('Proforma');
                        setIsReturnMode(false);
                        setOriginalInvoiceId("");
                      }}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${documentMode === 'Proforma' ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-700/20' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                    >
                      PROFORMA
                    </button>
                  </div>
                </div>
            </div>

            <div className="h-px w-full bg-slate-200/70"></div>

            {/* Bottom Row of Top Header: Bill Number, Date Override, Cancel Bill */}
            <div className="flex flex-wrap items-center justify-between gap-3.5">
              <div className="flex flex-wrap items-center gap-3">
                {/* Bill Number Selector */}
                <div className="flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-xl border border-blue-100 hover:border-blue-300 transition-all shadow-sm group relative cursor-pointer">
                  <div
                    className="flex flex-col"
                    onClick={() => setIsBillNoDropdownOpen(!isBillNoDropdownOpen)}
                  >
                    <span className="text-[10px] font-bold text-blue-500/80 uppercase tracking-widest mb-0.5 group-hover:text-blue-600">Bill Number</span>
                    <span className="text-base font-black text-slate-800 font-mono tracking-tight leading-none group-hover:text-blue-700 transition-colors">
                      {customBillNo || nextBillNo || "Calculating..."}
                    </span>
                  </div>

                  {isBillNoDropdownOpen && (
                    <div className="absolute top-full left-0 mt-3 w-72 sm:w-[400px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-5 max-h-96 overflow-y-auto">
                      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                        <h3 className="text-sm font-bold text-slate-800">Select Bill Number</h3>
                        <button onClick={() => setIsBillNoDropdownOpen(false)} className="text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 p-1.5 rounded-full transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {Array.from({ length: Math.max(parseInt((nextBillNo.match(/\d+$/) || ["0"])[0]) || 1, 1) + 30 }).map((_, i) => {
                          const numStr = `RE 26-27-${String(i + 1).padStart(3, '0')}`;
                          const billForNum = localBills.find((b: any) => (b.id || b.invoiceNumber) === numStr);
                          const isUsed = !!billForNum;
                          const isCancelled = billForNum && ((billForNum.status || '').toUpperCase() === 'CANCELLED' || (billForNum.paymentMethod || '').toUpperCase() === 'CANCELLED');
                          const isUsedActive = isUsed && !isCancelled;
                          return (
                            <button
                              key={i}
                              disabled={isUsedActive}
                              onClick={() => {
                                if (isCancelled && billForNum) {
                                  openCancelModal(billForNum.id, 'uncancel');
                                  return;
                                }
                                setCustomBillNo(numStr);
                                setIsBillNoDropdownOpen(false);
                              }}
                              title={isCancelled ? 'Click to restore this cancelled bill' : undefined}
                              className={`text-xs py-2 px-2 rounded-xl font-mono font-bold transition-all border ${isUsedActive ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed opacity-60' : isCancelled ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-600 hover:text-white cursor-pointer shadow-sm' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-600 hover:text-white cursor-pointer shadow-sm hover:shadow-md'}`}
                            >
                              {String(i + 1).padStart(3, '0')} {isUsedActive ? '(Used)' : isCancelled ? '(Cancelled ↺)' : ''}
                            </button>
                          );
                        })}
                      </div>
                      {customBillNo && (
                        <button
                          onClick={() => { setCustomBillNo(""); setIsBillNoDropdownOpen(false); }}
                          className="w-full mt-4 py-2 bg-slate-50 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-xl hover:bg-slate-100 border border-slate-200 transition-colors"
                        >
                          Reset to Auto Generation
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Date Override */}
                <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest z-10 flex items-center gap-1">
                    Date
                  </span>
                  <input
                    type="datetime-local"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="text-xs font-bold text-indigo-900 bg-transparent border-b-2 border-transparent hover:border-indigo-300 focus:border-indigo-500 focus:ring-0 focus:outline-none transition-all z-10 py-0.5 cursor-pointer max-w-[145px]"
                  />
                  {customDate && (
                    <button onClick={() => setCustomDate("")} className="text-slate-400 hover:text-red-500 z-10 ml-1 p-1 rounded-full hover:bg-red-50 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Cancel Bill Button */}
              <button
                onClick={handleCancelSelectedBill}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-bold hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                title="Cancel the currently selected bill number"
              >
                Cancel Bill
              </button>
            </div>
          </div>
        </div>

        {isReturnMode && originalBillDate && (
          <div className="text-sm font-semibold text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center gap-2">
            <span>{documentMode === 'Estimation' ? "Estimation Date: " : "Original Bill Date: "}</span>
            <span className="font-bold text-amber-900">{originalBillDate.toLocaleString('en-GB')}</span>
          </div>
        )}

        {/* 2. PRODUCT SEARCH & ADD (FULL-WIDTH & VISUALLY PROMINENT) */}
        <div ref={productDropdownRef} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-40">
          <div className="relative flex-1">
            <PackageSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5 pointer-events-none" />
            <input
              type="text"
              placeholder="Scan Barcode or Search Product by Name... [F8]"
              value={barcode}
              ref={barcodeInputRef}
              onChange={handleProductSearchChange}
              onKeyDown={handleProductKeyDown}
              onFocus={() => { if (barcode.trim()) setIsProductDropdownOpen(true); }}
              className="pl-12 pr-16 py-3 w-full border border-slate-300 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl shadow-sm bg-white/95 backdrop-blur text-sm font-medium transition-all"
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <kbd className="hidden sm:inline-block text-[11px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">F8</kbd>
            </div>
            {isProductDropdownOpen && productSuggestions.length > 0 && (
              <div className="absolute top-full mt-1.5 left-0 w-full bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
                {productSuggestions.map((prod, idx) => (
                  <div
                    key={prod.id || prod.barcode}
                    id={`prod-item-${idx}`}
                    className={`px-4 py-2.5 cursor-pointer border-b last:border-b-0 flex justify-between items-center transition-colors ${idx === highlightedProductIndex ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 text-gray-800'}`}
                    onMouseEnter={() => setHighlightedProductIndex(idx)}
                    onClick={() => {
                      addProductToBill(prod);
                      setIsProductDropdownOpen(false);
                    }}
                  >
                    <div>
                      <div className={`font-medium ${idx === highlightedProductIndex ? 'text-white' : 'text-gray-800'}`}>{prod.name}</div>
                      <div className={`text-xs ${idx === highlightedProductIndex ? 'text-blue-100' : 'text-gray-400'}`}>{prod.barcode}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${idx === highlightedProductIndex ? 'text-white' : 'text-green-600'}`}>₹{prod.price}</div>
                      <div className={`text-xs ${idx === highlightedProductIndex ? 'text-blue-100' : 'text-gray-500'}`}>Stock: {prod.stockQuantity}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleAddProduct}
            disabled={loading}
            className={`h-12 px-6 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap ${loading ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            <Plus size={18} />
            {loading ? "Searching..." : "Add Product"}
          </motion.button>
        </div>

        {/* 3. CART TABLE */}
        <motion.div
          className="bg-white/95 rounded-2xl shadow-md overflow-hidden border border-slate-200/90 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-700">
              <thead className="bg-slate-100/90 text-xs font-bold uppercase text-slate-600 border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="p-3 text-center w-14">S. NO</th>
                  <th className="p-3 text-left min-w-[200px]">Product Name</th>
                  <th className="p-3 text-center font-mono w-24">HSN/SAC</th>
                  <th className="p-3 text-left w-28">Colour</th>
                  <th className="p-3 text-center w-28">Price</th>
                  <th className="p-3 text-center w-24">Qty</th>
                  <th className="p-3 text-center w-16">Unit</th>
                  <th className="p-3 text-center w-24">Discount (%)</th>
                  <th className="p-3 text-center w-20">GST (%)</th>
                  <th className="p-3 text-right pr-4 w-28">Total</th>
                  <th className="p-3 text-center w-14">History</th>
                  <th className="p-3 text-center w-14">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-14 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                        <ShoppingCart className="h-10 w-10 text-slate-300 stroke-[1.5]" />
                        <p className="text-sm font-semibold text-slate-600">Cart is empty</p>
                        <p className="text-xs text-slate-400">Scan a barcode or type in the search bar above [F8] to add items</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((i, idx) => (
                    <motion.tr
                      key={i.barcode}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="hover:bg-blue-50/50 transition-colors"
                    >
                      <td className="p-2.5 text-center text-slate-500 font-semibold">{idx + 1}</td>
                      <td className="p-2.5 text-left font-medium text-slate-800">{i.name}</td>
                      <td className="p-2.5 text-center font-mono text-xs text-slate-600">{i.taxCode || "-"}</td>
                      <td className="p-2.5 text-left">
                        <input
                          type="text"
                          placeholder="Colour"
                          value={i.colourCode || ""}
                          onChange={(e) => updateItemColourCode(i.barcode, e.target.value)}
                          className="border border-slate-200 focus:border-blue-400 w-24 px-2 py-1 rounded-lg text-left text-xs bg-white"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          min="0"
                          step="0.01"
                          value={i.price}
                          onChange={(e) => handlePriceChange(i.barcode, parseFloat(e.target.value) || 0)}
                          onFocus={(e) => (e.target as HTMLInputElement).select()}
                          className="border border-blue-200 bg-blue-50/50 focus:border-blue-500 w-24 py-1 px-2 rounded-lg text-center font-bold text-blue-700 text-xs"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          step="any"
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          value={i.qty}
                          onChange={(e) => handleQtyChange(i.barcode, e.target.value)}
                          onFocus={(e) => (e.target as HTMLInputElement).select()}
                          className="border border-slate-200 focus:border-blue-400 w-16 py-1 px-1 rounded-lg text-center font-semibold text-slate-800 text-xs bg-white"
                        />
                      </td>
                      <td className="p-2.5 text-center text-xs font-bold text-slate-400 uppercase">{i.unit || "Nos"}</td>
                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          value={i.Discount}
                          max={100}
                          onChange={(e) => handleDiscountChange(i.barcode, e.target.value)}
                          onFocus={(e) => (e.target as HTMLInputElement).select()}
                          className="border border-slate-200 focus:border-blue-400 w-16 py-1 px-1 rounded-lg text-center text-xs bg-white"
                          disabled={isReturnMode}
                        />
                      </td>
                      <td className="p-2.5 text-center text-xs font-semibold text-slate-600">{i.GST}%</td>
                      <td className="p-2.5 text-right pr-4 font-bold text-slate-900 font-mono">₹{Number(i.total.toFixed(2))}</td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => { setHistoryProductId(i.id || i.barcode); setHistoryProductName(i.name); setIsBillingHistoryOpen(true); }}
                          className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Billing History"
                        >
                          <Clock size={16} />
                        </button>
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center">
                          {(isReturnMode && documentMode !== 'Estimation') ? (
                            <button onClick={() => handleRestoreStock(i.barcode, Number(i.qty))} className="text-green-600 hover:text-green-800 p-1.5 hover:bg-green-50 rounded-lg transition-colors" title="Restore to Stock">
                              <RotateCcw size={16} />
                            </button>
                          ) : (
                            <button onClick={() => handleRemoveItem(i.barcode)} className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Remove Product">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* 4. TOTALS & PAYMENT SECTION */}
        <div className="bg-white/95 rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            {/* Total Display */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {isReturnMode ? "Summary" : "Total Payable"}
              </span>
              <div className="flex flex-wrap items-baseline gap-4">
                <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight">
                  ₹{Number(totalAmount.toFixed(2))}
                </div>
                {isReturnMode && (
                  <div className="text-sm font-semibold text-slate-500">
                    Original: ₹{Number(originalTotal.toFixed(2))}
                  </div>
                )}
              </div>
              {isReturnMode && (
                <div className={`text-sm font-bold mt-1 inline-block px-3 py-1 rounded-lg ${totalAmount - originalTotal >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {totalAmount - originalTotal >= 0 ? "Additional Due: " : "Refund Due: "}₹{Number(Math.abs(totalAmount - originalTotal).toFixed(2))}
                </div>
              )}
            </div>

            {/* Tender Options */}
            <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-auto">
              {documentMode === 'Billing' && (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Amount Inputs for Cash, Split, Partial */}
                    {paymentMethod === "Cash" && (
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <input
                          type="number"
                          placeholder="Amount Received"
                          value={receivedAmount}
                          onChange={(e) => setReceivedAmount(e.target.value)}
                          onFocus={(e) => (e.target as HTMLInputElement).select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveAndPrint(true);
                          }}
                          className="h-11 pl-8 pr-3 border border-slate-300 rounded-xl w-44 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold text-slate-800 text-sm"
                        />
                      </div>
                    )}

                    {paymentMethod === "Split Payment" && (
                      <div className="flex gap-2">
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                          <input
                            type="number"
                            placeholder="Cash Amount"
                            value={cashAmount}
                            onChange={(e) => setCashAmount(e.target.value)}
                            onFocus={(e) => (e.target as HTMLInputElement).select()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveAndPrint(true);
                            }}
                            className="h-11 pl-8 pr-3 border border-slate-300 rounded-xl w-36 focus:ring-2 focus:ring-emerald-500 font-semibold text-sm"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                          <input
                            type="number"
                            placeholder="Online Amount"
                            value={onlineAmount}
                            onChange={(e) => setOnlineAmount(e.target.value)}
                            onFocus={(e) => (e.target as HTMLInputElement).select()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveAndPrint(true);
                            }}
                            className="h-11 pl-8 pr-3 border border-slate-300 rounded-xl w-36 focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {paymentMethod === "PARTIAL" && (
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <input
                          type="number"
                          placeholder="Paid Amount"
                          value={partialPaidAmount}
                          onChange={(e) => setPartialPaidAmount(e.target.value)}
                          onFocus={(e) => (e.target as HTMLInputElement).select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveAndPrint(true);
                          }}
                          className="h-11 pl-8 pr-3 border border-slate-300 rounded-xl w-44 focus:ring-2 focus:ring-amber-500 font-bold text-sm"
                        />
                      </div>
                    )}

                    {/* Mode Selector */}
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-500 uppercase">Mode:</span>
                      <select
                        value={customerMode}
                        onChange={(e) => setCustomerMode(e.target.value)}
                        className="text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="Walk-in">Walk-in</option>
                        <option value="Online">Online</option>
                      </select>
                    </div>

                    {/* Payment Selector */}
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-500 uppercase">Payment:</span>
                      <select
                        value={paymentMethod}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPaymentMethod(val);
                          if (val === "PARTIAL") {
                            setPaymentReminderEnabled(true);
                            setPaymentReminderDays(7);
                          } else {
                            setPaymentReminderEnabled(false);
                            setPaymentReminderDays(7);
                          }
                        }}
                        className="text-xs font-bold text-blue-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="UPI">UPI</option>
                        <option value="PARTIAL">PARTIAL</option>
                        <option value="Split Payment">Split Payment</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Reminders & Change Due */}
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    {/* Expiry Reminder */}
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={enableReminder}
                          onChange={(e) => setEnableReminder(e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="font-semibold text-slate-700 text-xs">Expiry Reminder</span>
                      </label>
                      {enableReminder && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            value={reminderDays}
                            onChange={(e) => setReminderDays(Math.max(1, Number(e.target.value)))}
                            className="w-14 border border-slate-300 rounded px-1.5 py-0.5 text-xs text-center"
                          />
                          <span className="text-[10px] text-slate-400">days</span>
                        </div>
                      )}
                    </div>

                    {/* Partial Reminder */}
                    {paymentMethod === "PARTIAL" && (
                      <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 animate-in fade-in duration-200">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={paymentReminderEnabled}
                            onChange={(e) => setPaymentReminderEnabled(e.target.checked)}
                            className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-amber-500"
                          />
                          <span className="font-semibold text-amber-900 text-xs">Payment Reminder</span>
                        </label>
                        {paymentReminderEnabled && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              value={paymentReminderDays}
                              onChange={(e) => setPaymentReminderDays(Math.max(1, Number(e.target.value)))}
                              className="w-14 border border-amber-300 rounded px-1.5 py-0.5 text-xs text-center"
                            />
                            <span className="text-[10px] text-amber-700">days</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Split Total Validation Pill */}
                    {paymentMethod === "Split Payment" && cashAmount && onlineAmount && (
                      <div className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${Math.abs((parseFloat(cashAmount) + parseFloat(onlineAmount)) - totalAmount) < 0.01 ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
                        {Math.abs((parseFloat(cashAmount) + parseFloat(onlineAmount)) - totalAmount) < 0.01
                          ? `✓ Split Total: ₹${(parseFloat(cashAmount) + parseFloat(onlineAmount)).toFixed(2)}`
                          : `✗ Split: ₹${(parseFloat(cashAmount) + parseFloat(onlineAmount)).toFixed(2)} (Need: ₹${totalAmount.toFixed(2)})`
                        }
                      </div>
                    )}

                    {/* Change Due */}
                    {changeDue > 0 && (
                      <div className="text-sm font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-3.5 py-1.5 rounded-xl">
                        Change Due: ₹{changeDue.toFixed(2)}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 5. CUSTOMER INFORMATION (STRUCTURED RESPONSIVE GRID) */}
        <div className="bg-white/95 rounded-2xl p-5 border border-slate-200/90 shadow-sm backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <User className="h-4 w-4 text-blue-600" />
              <span>Customer Details</span>
            </div>
            <span className="text-[11px] font-medium text-slate-400">Optional for regular walk-in sales</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Customer Name */}
            <div className="relative" ref={customerDropdownRef}>
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Customer Name"
                ref={customerNameRef}
                value={customerName}
                onChange={(e) => {
                  handleCustomerNameChange(e);
                  setIsCustomerDropdownOpen(true);
                }}
                onFocus={() => {
                  if (customerName) handleCustomerNameChange({ target: { value: customerName } } as any);
                  setIsCustomerDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (isCustomerDropdownOpen && customerSuggestions.length > 0) {
                      handleCustomerKeyDown(e);
                    } else {
                      e.preventDefault();
                      customerPhoneRef.current?.focus();
                    }
                  } else {
                    handleCustomerKeyDown(e);
                  }
                }}
                className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl w-full text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
              {isCustomerDropdownOpen && customerSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 z-50 max-h-56 overflow-y-auto">
                  {customerSuggestions.map((c: any, idx) => (
                    <div
                      key={c.id}
                      id={`cust-item-${idx}`}
                      onClick={() => selectCustomer(c)}
                      className={`px-3 py-2 cursor-pointer border-b border-slate-100 last:border-0 flex justify-between items-center text-xs ${idx === highlightedCustomerIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
                    >
                      <div className="font-semibold text-slate-800">{c.name}</div>
                      <div className="text-[11px] text-slate-400">{c.phone || "No Phone"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer Phone */}
            <div className="relative" ref={phoneDropdownRef}>
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Customer Phone"
                ref={customerPhoneRef}
                value={customerPhone}
                onChange={(e) => {
                  handlePhoneChange(e);
                  setIsPhoneDropdownOpen(true);
                }}
                onFocus={() => {
                  if (customerPhone) handlePhoneChange({ target: { value: customerPhone } } as any);
                  setIsPhoneDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (isPhoneDropdownOpen && phoneSuggestions.length > 0) {
                      handlePhoneKeyDown(e);
                    } else {
                      e.preventDefault();
                      customerEmailRef.current?.focus();
                    }
                  } else {
                    handlePhoneKeyDown(e);
                  }
                }}
                className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl w-full text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
              {isPhoneDropdownOpen && phoneSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 z-50 max-h-56 overflow-y-auto">
                  {phoneSuggestions.map((c: any, idx) => (
                    <div
                      key={c.id}
                      id={`phone-item-${idx}`}
                      onClick={() => selectCustomer(c)}
                      className={`px-3 py-2 cursor-pointer border-b border-slate-100 last:border-0 flex justify-between items-center text-xs ${idx === highlightedPhoneIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
                    >
                      <div className="font-semibold text-slate-800">{c.name}</div>
                      <div className="text-[11px] text-slate-400">{c.phone}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input
                ref={customerEmailRef}
                type="email"
                placeholder="Customer Email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    customerGstRef.current?.focus();
                  }
                }}
                className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl w-full text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>

            {/* Customer GST */}
            <div>
              <input
                ref={customerGstRef}
                type="text"
                placeholder="Customer GST (Optional)"
                value={customerGst}
                onChange={(e) => setCustomerGst(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    customerAddressRef.current?.focus();
                  }
                }}
                className="px-3 py-2 border border-slate-200 rounded-xl w-full text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white uppercase"
              />
            </div>

            {/* Customer Address */}
            <div>
              <input
                ref={customerAddressRef}
                type="text"
                placeholder="Customer Address (Optional)"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveAndPrint(true);
                  }
                }}
                className="px-3 py-2 border border-slate-200 rounded-xl w-full text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
          </div>

          {/* Ship To Checkbox */}
          <div className="pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                id="shipToDifferent"
                checked={isShipToDifferent}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsShipToDifferent(checked);
                  if (checked) {
                    setTimeout(() => shipToNameRef.current?.focus(), 50);
                  } else {
                    setShipToName("");
                    setShipToPhone("");
                    setShipToEmail("");
                    setShipToAddress("");
                    setShipToGst("");
                  }
                }}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span>Ship to a different delivery address</span>
            </label>
          </div>

          {/* Ship To Details - Conditional */}
          {isShipToDifferent && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-in fade-in duration-200">
              <input
                type="text"
                placeholder="Ship To Name"
                ref={shipToNameRef}
                value={shipToName}
                onChange={(e) => setShipToName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    shipToPhoneRef.current?.focus();
                  }
                }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                placeholder="Ship To Phone"
                ref={shipToPhoneRef}
                value={shipToPhone}
                onChange={(e) => setShipToPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    shipToEmailRef.current?.focus();
                  }
                }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="email"
                placeholder="Ship To Email"
                ref={shipToEmailRef}
                value={shipToEmail}
                onChange={(e) => setShipToEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    shipToGstRef.current?.focus();
                  }
                }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                placeholder="Ship To GST"
                ref={shipToGstRef}
                value={shipToGst}
                onChange={(e) => setShipToGst(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    shipToAddressRef.current?.focus();
                  }
                }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 uppercase"
              />
              <input
                type="text"
                placeholder="Ship To Address"
                ref={shipToAddressRef}
                value={shipToAddress}
                onChange={(e) => setShipToAddress(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    vehicleNoRef.current?.focus();
                  }
                }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>

        {/* 6. TRANSPORT DETAILS (STRUCTURED RESPONSIVE GRID) */}
        <div className="bg-white/95 rounded-2xl p-5 border border-slate-200/90 shadow-sm backdrop-blur-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm pb-2 border-b border-slate-100">
            <span>Transport & Dispatch Details (Optional)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <input
              type="text"
              placeholder="Vehicle Number"
              ref={vehicleNoRef}
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  dispatchThroughRef.current?.focus();
                }
              }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-500 bg-white uppercase"
            />
            <input
              type="text"
              placeholder="Dispatched Through"
              ref={dispatchThroughRef}
              value={dispatchThrough}
              onChange={(e) => setDispatchThrough(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  destinationRef.current?.focus();
                }
              }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-500 bg-white"
            />
            <input
              type="text"
              placeholder="Destination"
              ref={destinationRef}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  transportAmountRef.current?.focus();
                }
              }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-500 bg-white"
            />
            <input
              type="text"
              placeholder="Terms of Delivery"
              ref={termsOfDeliveryRef}
              value={termsOfDelivery}
              onChange={(e) => setTermsOfDelivery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  transportAmountRef.current?.focus();
                }
              }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-500 bg-white"
            />
            <input
              type="number"
              placeholder="Transport Amount"
              ref={transportAmountRef}
              value={transportAmount}
              onChange={(e) => setTransportAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  transportGstRateRef.current?.focus();
                }
              }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-500 bg-white"
            />
            <input
              type="number"
              placeholder="Transport GST %"
              ref={transportGstRateRef}
              value={transportGstRate}
              onChange={(e) => setTransportGstRate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  brokerRef.current?.focus();
                }
              }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-500 bg-white"
            />
          </div>
        </div>

        {/* 7. SALES REP & STAFF (BILLING MODE) */}
        {documentMode === 'Billing' && (
          <div className="bg-white/95 rounded-2xl p-5 border border-slate-200/90 shadow-sm backdrop-blur-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm pb-2 border-b border-slate-100">
              <Briefcase className="h-4 w-4 text-blue-600" />
              <span>Sales Rep & Staff Commission (Optional)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Sales Rep Selector */}
              <div className="relative" ref={brokerDropdownRef}>
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Select Sales Rep (Optional)"
                  ref={brokerRef}
                  value={brokerNameInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBrokerNameInput(val);
                    if (!val) {
                      setSelectedBroker("");
                      setBrokerSuggestions([]);
                    } else {
                      const brokerList = Array.isArray(globalBrokers) ? globalBrokers : [];
                      const matches = brokerList.filter((b: any) =>
                        b.name.toLowerCase().includes(val.toLowerCase())
                      );
                      setBrokerSuggestions(matches);
                    }
                  }}
                  onFocus={() => {
                    const brokerList = Array.isArray(globalBrokers) ? globalBrokers : [];
                    if (!brokerNameInput) {
                      setBrokerSuggestions(brokerList);
                    } else {
                      const matches = brokerList.filter((b: any) =>
                        b.name.toLowerCase().includes(brokerNameInput.toLowerCase())
                      );
                      setBrokerSuggestions(matches);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (brokerSuggestions.length > 0) {
                        handleBrokerKeyDownHook(e);
                      } else {
                        e.preventDefault();
                        staffRef.current?.focus();
                      }
                    } else {
                      handleBrokerKeyDownHook(e);
                    }
                  }}
                  className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl w-full text-xs font-medium focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {brokerSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 z-50 max-h-56 overflow-y-auto">
                    {brokerSuggestions.map((b: any, idx) => (
                      <div
                        key={b.id}
                        id={`broker-item-${idx}`}
                        onClick={() => selectBroker(b)}
                        className={`px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0 text-xs ${idx === highlightedBrokerIndexInner ? 'bg-blue-100' : ''}`}
                      >
                        <div className="font-semibold text-slate-800">{b.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sales Rep Commission % */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                <input
                  type="number"
                  placeholder="Sales Rep Comm %"
                  ref={brokerCommRef}
                  value={brokerCommissionPercentage}
                  onChange={(e) => {
                    setBrokerCommissionPercentage(e.target.value);
                    setCommissionAmount("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      staffRef.current?.focus();
                    }
                  }}
                  className="pl-7 pr-3 py-2 border border-slate-200 rounded-xl w-full text-xs font-medium focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {Number(brokerCommissionPercentage) > 0 && (
                  <div className="absolute top-10 right-0 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded shadow z-10 whitespace-nowrap">
                    Comm: ₹{((totalAmount * Number(brokerCommissionPercentage)) / 100).toFixed(2)}
                  </div>
                )}
              </div>

              {/* Staff Selector */}
              <div className="relative" ref={staffDropdownRef}>
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Select Sales Staff (Optional)"
                  ref={staffRef}
                  value={staffNameInput}
                  onChange={(e) => handleStaffSearchChange(e.target.value)}
                  onFocus={() => {
                    if (!staffNameInput) {
                      setStaffSuggestions(globalStaff.filter(s => s.isActive));
                    } else {
                      handleStaffSearchChange(staffNameInput);
                    }
                    setIsStaffDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (isStaffDropdownOpen && staffSuggestions.length > 0) {
                        handleStaffKeyDown(e);
                      } else {
                        e.preventDefault();
                        staffCommRef.current?.focus();
                      }
                    } else {
                      handleStaffKeyDown(e);
                    }
                  }}
                  className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl w-full text-xs font-medium focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {isStaffDropdownOpen && staffSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 z-50 max-h-56 overflow-y-auto">
                    {staffSuggestions.map((s: any, idx) => (
                      <div
                        key={s.id}
                        id={`staff-item-${idx}`}
                        onClick={() => selectStaff(s)}
                        className={`px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0 text-xs ${idx === highlightedStaffIndexInner ? 'bg-blue-100' : ''}`}
                      >
                        <div className="font-semibold text-slate-800">{s.name}</div>
                        <div className="text-[10px] text-slate-400">{s.role}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Staff Commission % */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                <input
                  type="number"
                  placeholder="Staff Comm %"
                  ref={staffCommRef}
                  title="Staff Commission Percentage"
                  value={staffCommissionPercentage}
                  onChange={(e) => setStaffCommissionPercentage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  className="pl-7 pr-3 py-2 border border-slate-200 rounded-xl w-full text-xs font-medium focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {Number(staffCommissionPercentage) > 0 && (
                  <div className="absolute top-10 right-0 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded shadow z-10 whitespace-nowrap">
                    Comm: ₹{((totalAmount * Number(staffCommissionPercentage)) / 100).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 8. DEDICATED BOTTOM ACTION TOOLBAR (UI/UX PRINCIPLES APPLIED) */}
        <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-lg flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 backdrop-blur-md">
          {isReturnMode ? (
            <div className="flex flex-wrap items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSaveReturnAndPrint}
                disabled={loading}
                className={`h-12 px-6 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md flex items-center gap-2.5 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? <RefreshCw className="animate-spin" size={18} /> : <Printer size={18} />}
                {loading ? "Processing..." : (documentMode === 'Estimation' ? "Print Estimation" : "Save Return & Print")}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleReset}
                disabled={loading}
                className="h-12 px-5 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 flex items-center gap-2 transition-all shadow-sm"
              >
                <RotateCcw size={18} /> {documentMode === 'Estimation' ? "Exit View" : "Exit Return Mode"}
              </motion.button>
            </div>
          ) : (
            <>
              {/* Left / Center: Primary Actions & Customer Comms */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Primary CTA */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSaveAndPrint(true)}
                  disabled={loading}
                  className={`h-12 px-7 rounded-xl font-bold text-sm sm:text-base text-white shadow-lg flex items-center gap-2.5 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${
                    documentMode === 'Estimation'
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/25'
                      : documentMode === 'Proforma'
                      ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/25'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25'
                  }`}
                >
                  {loading ? (
                    <RefreshCw className="animate-spin" size={20} />
                  ) : documentMode === 'Estimation' || documentMode === 'Proforma' ? (
                    <FileText size={20} />
                  ) : (
                    <Save size={20} />
                  )}
                  <span>
                    {loading
                      ? "Saving..."
                      : documentMode === 'Estimation'
                      ? "Print Estimation"
                      : documentMode === 'Proforma'
                      ? "Print Proforma"
                      : "Save & Print Bill"}
                  </span>
                  {documentMode === 'Billing' && (
                    <kbd className="hidden sm:inline-block text-[11px] font-mono bg-emerald-700/60 text-white px-2 py-0.5 rounded border border-emerald-500/40">F2</kbd>
                  )}
                </motion.button>

                {documentMode === 'Estimation' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSaveAndPrint(true, 'A4')}
                    disabled={loading}
                    className={`h-12 px-5 rounded-xl font-bold text-sm text-white bg-slate-800 hover:bg-slate-900 shadow-md flex items-center gap-2 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {loading ? <RefreshCw className="animate-spin" size={18} /> : <FileText size={18} />}
                    <span>Save & Print A4</span>
                  </motion.button>
                )}

                {/* Billing Mode Communication & Hold buttons */}
                {documentMode === 'Billing' && (
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSendWhatsApp}
                      disabled={loading || !customerPhone || customerPhone.trim().length < 10}
                      className="h-12 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white shadow-sm flex items-center gap-2 transition-all disabled:opacity-40 disabled:hover:bg-emerald-50 disabled:hover:text-emerald-700 disabled:cursor-not-allowed"
                      title={!customerPhone || customerPhone.trim().length < 10 ? "Enter valid phone number to WhatsApp" : "Send bill on WhatsApp"}
                    >
                      <MessageCircle size={18} />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSendSMS}
                      disabled={loading || !customerPhone || customerPhone.trim().length < 10}
                      className="h-12 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-600 hover:text-white shadow-sm flex items-center gap-2 transition-all disabled:opacity-40 disabled:hover:bg-sky-50 disabled:hover:text-sky-700 disabled:cursor-not-allowed"
                      title={!customerPhone || customerPhone.trim().length < 10 ? "Enter valid phone number to SMS" : "Send bill via SMS"}
                    >
                      <MessageSquare size={18} />
                      <span className="hidden sm:inline">SMS</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleHoldBill}
                      disabled={loading}
                      className={`h-12 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-500 hover:text-white shadow-sm flex items-center gap-2 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Hold this bill [F4]"
                    >
                      <Pause size={18} />
                      <span>{loading ? "Holding..." : "Hold"}</span>
                      <kbd className="hidden md:inline-block text-[10px] font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300">F4</kbd>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsReturnModalOpen(true)}
                      disabled={loading}
                      className="h-12 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white shadow-sm flex items-center gap-2 transition-all"
                    >
                      <Undo2 size={18} />
                      <span>Return</span>
                    </motion.button>
                  </div>
                )}
              </div>

              {/* Right: Document Utilities & Reset */}
              <div className="flex flex-wrap items-center gap-2 pt-2 xl:pt-0">
                <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
                  <button
                    onClick={() => setIsLoadEstimationModalOpen(true)}
                    disabled={loading}
                    className="h-10 px-3 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white transition-all flex items-center gap-1.5 shadow-none hover:shadow-sm"
                    title="Load Estimation"
                  >
                    <RefreshCw size={14} />
                    <span>Load Est</span>
                  </button>

                  <button
                    onClick={() => setIsLoadProformaModalOpen(true)}
                    disabled={loading}
                    className="h-10 px-3 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white transition-all flex items-center gap-1.5 shadow-none hover:shadow-sm"
                    title="Load Proforma"
                  >
                    <RefreshCw size={14} />
                    <span>Load Prof</span>
                  </button>

                  <button
                    onClick={() => { setHistoryProductId(undefined); setHistoryProductName(''); setIsBillingHistoryOpen(true); }}
                    disabled={loading}
                    className="h-10 px-3 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white transition-all flex items-center gap-1.5 shadow-none hover:shadow-sm"
                    title="Billing History"
                  >
                    <Clock size={14} />
                    <span>History</span>
                  </button>

                  {documentMode === 'Billing' && (
                    <button
                      onClick={exportToExcel}
                      disabled={loading}
                      className="h-10 px-3 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white transition-all flex items-center gap-1.5 shadow-none hover:shadow-sm"
                      title="Export Bills to Excel"
                    >
                      <FileSpreadsheet size={14} />
                      <span>Excel</span>
                    </button>
                  )}
                </div>

                <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

                {/* Destructive Reset Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleReset}
                  disabled={loading}
                  className="h-10 px-4 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-600 hover:text-white border border-red-200 hover:border-red-600 flex items-center gap-1.5 transition-all shadow-sm"
                  title="Clear all fields and restart billing"
                >
                  <RotateCcw size={15} />
                  <span>Reset</span>
                </motion.button>
              </div>
            </>
          )}
        </div>

        {/* 9. HELD BILLS */}
        {!isReturnMode && holds.length > 0 && (
          <div className="mt-8 border-t border-slate-200/80 pt-4">
            <h2 className="text-base font-bold mb-3 flex items-center gap-2 text-amber-800">
              <Pause size={18} />
              <span>Held Bills ({holds.filter(h => h.id !== currentHoldId).length})</span>
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {holds.filter(h => h.id !== currentHoldId).map((h) => (
                <motion.div
                  key={h.id}
                  onClick={() => handleRetrieveHold(h)}
                  whileHover={{ scale: 1.02 }}
                  className="relative p-4 border border-amber-200 rounded-2xl bg-amber-50/80 hover:bg-amber-100/90 cursor-pointer shadow-sm hover:shadow transition"
                >
                  <button
                    onClick={(e) => handleDeleteHeldBill(h.id, e)}
                    className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-100 transition-colors z-10"
                    title="Cancel Held Bill"
                  >
                    <X size={16} />
                  </button>
                  <div className="font-bold text-slate-800 text-sm">{h.customerName || "Walk-in Customer"}</div>
                  <div className="text-xs text-slate-600 mt-1">{h.items?.length || 0} items — <span className="font-bold font-mono">₹{h.finalAmount}</span></div>
                  <div className="text-[11px] font-semibold text-amber-700 mt-1">Payment: {h.paymentMethod || "Cash"}</div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
      {isLoadEstimationModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Load Estimation</h2>
              <button onClick={() => setIsLoadEstimationModalOpen(false)} className="text-gray-500 hover:text-gray-800"><X /></button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Estimation ID..."
                value={estIdInput}
                onChange={(e) => setEstIdInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && estIdInput.trim()) {
                    handleLoadEstimation(estIdInput.trim());
                  }
                }}
                className="form-input flex-grow"
              />
              <button
                onClick={() => handleLoadEstimation(estIdInput.trim())}
                disabled={loading || !estIdInput.trim()}
                className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Find"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {isLoadProformaModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Load Proforma</h2>
              <button onClick={() => setIsLoadProformaModalOpen(false)} className="text-gray-500 hover:text-gray-800"><X /></button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Proforma ID..."
                value={proformaIdInput}
                onChange={(e) => setProformaIdInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && proformaIdInput.trim()) {
                    handleLoadProforma(proformaIdInput.trim());
                  }
                }}
                className="form-input flex-grow"
              />
              <button
                onClick={() => handleLoadProforma(proformaIdInput.trim())}
                disabled={loading || !proformaIdInput.trim()}
                className="px-4 py-2 bg-purple-500 text-white font-semibold rounded-md hover:bg-purple-600 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Find"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default Billing;

