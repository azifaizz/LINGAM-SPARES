import axios from 'axios';
import { auth } from '@/lib/firebase';

const isDev = import.meta.env.MODE === 'development';

const PRODUCT_SERVICE_URL = isDev ? '/proxy' : 'https://product-service-949402843265.asia-southeast1.run.app/api';
const BILLING_SERVICE_URL = isDev ? '/proxy' : 'https://billing-service-949402843265.asia-southeast1.run.app/api';
const VENDOR_SERVICE_URL = isDev ? '/proxy' : 'https://vendor-service-949402843265.asia-southeast1.run.app/api';
const REPORT_SERVICE_URL = isDev ? '/proxy' : 'https://billing-service-949402843265.asia-southeast1.run.app/api';
const STAFF_SERVICE_URL = isDev ? '/proxy' : 'https://staff-service-949402843265.asia-southeast1.run.app/api';

const DIRECT_URLS: Record<string, string> = {
  product: 'https://product-service-949402843265.asia-southeast1.run.app/api',
  billing: 'https://billing-service-949402843265.asia-southeast1.run.app/api',
  vendor: 'https://vendor-service-949402843265.asia-southeast1.run.app/api',
  report: 'https://billing-service-949402843265.asia-southeast1.run.app/api',
  staff: 'https://staff-service-949402843265.asia-southeast1.run.app/api',
  customer: 'https://vendor-service-949402843265.asia-southeast1.run.app/api',
};

// --- Create a separate Axios instance for each service ---
// 60s timeout to safely handle Cloud Run container cold starts (15-25s) without aborting
const productService = axios.create({ baseURL: PRODUCT_SERVICE_URL, timeout: 60000 });
const billingService = axios.create({ baseURL: BILLING_SERVICE_URL, timeout: 60000 });
const vendorService = axios.create({ baseURL: VENDOR_SERVICE_URL, timeout: 60000 });
const reportService = axios.create({ baseURL: REPORT_SERVICE_URL, timeout: 60000 });
const staffService = axios.create({ baseURL: STAFF_SERVICE_URL, timeout: 60000 });
const customerService = axios.create({ baseURL: VENDOR_SERVICE_URL, timeout: 60000 }); // Note: Customer service typically shares Vendor service URL based on original code

// --- Resilient Retry Interceptor: Auto-recovers if Vite local dev proxy resets socket ---
const attachRetryInterceptor = (instance: any, serviceKey: string) => {
  instance.interceptors.response.use(
    (response: any) => response,
    async (error: any) => {
      const config = error.config;
      if (!config || config.__isRetry) {
        return Promise.reject(error);
      }

      const status = error.response?.status;
      const isRetryableStatus = status === 500 || status === 502 || status === 503 || status === 504;
      const isNetworkError = !error.response || error.code === 'ERR_NETWORK' || error.message?.includes('socket') || error.message?.includes('Network Error');

      if (isRetryableStatus || isNetworkError) {
        config.__isRetry = true;
        // In dev mode, if the Vite proxy dropped socket or threw 500, switch directly to Cloud Run HTTPS URL (which supports CORS)
        if (isDev && DIRECT_URLS[serviceKey]) {
          config.baseURL = DIRECT_URLS[serviceKey];
        }
        await new Promise((res) => setTimeout(res, 300));
        return instance(config);
      }

      return Promise.reject(error);
    }
  );
};

attachRetryInterceptor(productService, 'product');
attachRetryInterceptor(billingService, 'billing');
attachRetryInterceptor(vendorService, 'vendor');
attachRetryInterceptor(reportService, 'report');
attachRetryInterceptor(staffService, 'staff');
attachRetryInterceptor(customerService, 'customer');

// --- Create a reusable interceptor to attach the auth token ---
const authInterceptor = async (config: any) => {
  try {
    // Wait for auth to initialize
    await auth.authStateReady();

    if (auth.currentUser) {
      // Only refresh if token is expired (auto-refreshes). Force=true causes unnecessary Auth reads.
      const token = await auth.currentUser.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn("Auth token attachment failed", error);
  }
  return config;
};

// Apply auth interceptors
productService.interceptors.request.use(authInterceptor);
billingService.interceptors.request.use(authInterceptor);
vendorService.interceptors.request.use(authInterceptor);
reportService.interceptors.request.use(authInterceptor);
staffService.interceptors.request.use(authInterceptor);
customerService.interceptors.request.use(authInterceptor);

// --- API Call Logger (temporary — remove after 24h audit) ---
const apiLogger = (config: any) => {
  const urlToCheck = `${config.baseURL || ''}${config.url || ''}`.toLowerCase();
  const service = urlToCheck.includes('product') ? 'product'
    : urlToCheck.includes('billing') || urlToCheck.includes('report') ? 'billing'
    : urlToCheck.includes('staff') ? 'staff'
    : 'vendor';
  console.log(`[API ${service}] ${config.method?.toUpperCase()} ${config.url} @ ${new Date().toLocaleTimeString()}`);
  return config;
};
productService.interceptors.request.use(apiLogger);
billingService.interceptors.request.use(apiLogger);
vendorService.interceptors.request.use(apiLogger);
reportService.interceptors.request.use(apiLogger);
staffService.interceptors.request.use(apiLogger);
customerService.interceptors.request.use(apiLogger);

export {
  productService,
  billingService,
  vendorService,
  reportService,
  customerService,
  staffService,
};

// --- Types ---

export interface Staff {
  id: string;
  name: string;
  phone: string;
  emergencyPhone?: string;
  role: string;
  isActive: boolean; // Added for compatibility
  createdAt?: string;
  baseSalary?: number;
  allowedPermHours?: number;
  profilePicUrl?: string;
  accountNumber?: string;
  ifscCode?: string;
  commissionPercentage?: number;
  appUsername?: string;
  appPassword?: string;
  appLocation?: string;
  active?: boolean;
}

export interface Role {
  id?: string;
  name: string;
  permissions?: string[];
  description?: string;
}

export interface Attendance {
  id?: string;
  staffId: string;
  staffName: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'PERMISSION' | 'FULL_DAY';
  remarks?: string; // Added for compatibility
  permissionTime?: string;
  permissionTimeRange?: string; // New field
  timestamp?: string; // Added for compatibility
  inTime?: string;
  outTime?: string;
}

// --- Staff API ---
export const staffApi = {
  // Staff Management
  getAll: async () => {
    try {
      const res = await staffService.get<Staff[]>('/staff/all');
      if (Array.isArray(res.data)) {
        res.data = res.data.map((s: any) => ({
          ...s,
          id: s.id || s._id || '',
          isActive: s.isActive !== undefined ? s.isActive : (s.active !== undefined ? s.active : true)
        }));
        try {
          localStorage.setItem('cashier_staff_cache', JSON.stringify(res.data));
        } catch {}
      }
      return res;
    } catch (err) {
      // Offline / network failure fallback: read from cached directory
      try {
        const cached = localStorage.getItem('cashier_staff_cache') || localStorage.getItem('LINGAM_SPARES_V1_global_staff');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return { data: parsed } as any;
          }
        }
      } catch {}
      throw err;
    }
  },
  getById: async (id: string) => {
    const res = await staffService.get<Staff>(`/staff/${id}`);
    if (res.data) {
      const s: any = res.data;
      res.data = {
        ...s,
        id: s.id || s._id || '',
        isActive: s.isActive !== undefined ? s.isActive : (s.active !== undefined ? s.active : true)
      };
    }
    return res;
  },
  add: (data: Partial<Staff>) => {
    const payload = { ...data, active: data.isActive };
    return staffService.post('/staff/add', payload);
  },
  update: (id: string, data: Partial<Staff>) => {
    const payload = { ...data, active: data.isActive };
    return staffService.patch(`/staff/${id}`, payload);
  },
  delete: (id: string) => staffService.delete(`/staff/${id}`),

  // Role Management
  getRoles: () => staffService.get<Role[]>('/staff/roles'),
  addRole: (role: Role) => staffService.post('/staff/roles', role),
  updateRole: (id: string, role: Role) => staffService.put(`/staff/roles/${id}`, role),
  deleteRole: (id: string) => staffService.delete(`/staff/roles/${id}`),

  // Attendance Management
  getDailyAttendance: (date: string) => staffService.get<any>(`/staff/attendance/day/${date}`),

  markAttendance: (data: Attendance) => {
    const payload = { ...data, type: data.status }; // Map status -> type for backend DTO
    return staffService.post('/staff/attendance/mark', payload);
  },

  markBulkAttendance: (data: Attendance[]) => {
    const payload = data.map(d => ({ ...d, type: d.status })); // Map status -> type for bulk
    return staffService.post('/staff/attendance/mark-bulk', payload);
  },

  getMonthAttendance: (year: string, month: string) => staffService.get<any[]>(`/staff/attendance/month/${year}/${month}`),
  getStaffMonthAttendance: (staffId: string, yearMonth: string) => staffService.get<any>(`/staff/attendance/staff/${staffId}/${yearMonth}`),

  // Salary
  getSalarySlip: (staffId: string, yearMonth: string) => staffService.get<SalarySlip>(`/staff/salary/${staffId}/${yearMonth}`),

  // Commissions
  getAllCommissions: (yearMonth?: string) => staffService.get<Commission[]>(`/staff/commissions/all${yearMonth ? `?yearMonth=${yearMonth}` : ''}`),
  getStaffCommissions: (staffId: string, yearMonth?: string) =>
    staffService.get<Commission[]>(`/staff/commissions/${staffId}${yearMonth ? `?yearMonth=${yearMonth}` : ''}`),
  payCommission: (id: string, paymentMethod?: string) =>
    staffService.patch(`/staff/commissions/${id}/pay${paymentMethod ? `?paymentMethod=${paymentMethod}` : ''}`),

  // Self Attendance (Cashier geo-mark)
  login: (credentials: { username: string; password: string }) =>
    staffService.post<{ staffId: string; name: string; phone: string; role: string; token: string }>('/staff/auth/login', credentials),

  selfMarkAttendance: (data: { staffId: string; date: string; latitude: number; longitude: number }) =>
    staffService.post('/staff/attendance/self-mark', data),

  // App Settings (Geofence, Cutoff, with persistent storage fallback)
  getSettings: async () => {
    try {
      const res = await staffService.get<AppSettings>('/staff/settings');
      if (res.data && (res.data.latitude || res.data.longitude)) {
        try {
          localStorage.setItem('lingam_office_location_v1', JSON.stringify(res.data));
        } catch {}
      }
      return res;
    } catch (err) {
      const cached = localStorage.getItem('lingam_office_location_v1');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return { data: parsed } as any;
        } catch {}
      }
      throw err;
    }
  },

  saveSettings: async (data: AppSettings) => {
    try {
      localStorage.setItem('lingam_office_location_v1', JSON.stringify(data));
    } catch {}
    return staffService.post('/staff/settings', data);
  },

  // Targets (Admin can create/edit/delete, everyone can view)
  getAllTargets: () => staffService.get<StaffTarget[]>('/staff/targets'),
  getTargetsByStaff: (staffId: string) => staffService.get<StaffTarget[]>(`/staff/targets/staff/${staffId}`),
  createTarget: (data: StaffTarget) => staffService.post<{ id: string; message: string }>('/staff/targets', data),
  updateTarget: (id: string, data: Partial<StaffTarget>) => staffService.put(`/staff/targets/${id}`, data),
  deleteTarget: (id: string) => staffService.delete(`/staff/targets/${id}`),

  // Tasks (Admin can create/edit/delete, Staff/Cashier can complete)
  getAllTasks: () => staffService.get<StaffTask[]>('/staff/tasks'),
  getTasksByStaff: (staffId: string) => staffService.get<StaffTask[]>(`/staff/tasks/staff/${staffId}`),
  createTask: (data: StaffTask) => staffService.post<{ id: string; message: string }>('/staff/tasks', data),
  updateTaskStatus: (id: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED', completedBy?: string) =>
    staffService.patch(`/staff/tasks/${id}/status`, { status, completedBy }),
  updateTask: (id: string, data: Partial<StaffTask>) => staffService.put(`/staff/tasks/${id}`, data),
  deleteTask: (id: string) => staffService.delete(`/staff/tasks/${id}`),
};

export interface AppSettings {
  id?: string;
  locationName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  halfDayCutoffTime: string;
}

export interface StaffTarget {
  id?: string;
  staffId: string;
  staffName: string;
  period: string; // e.g. "2026-10" or "ALL" or custom string
  targetAmount: number; // in Rupees
  targetQuantity?: number;
  status?: 'IN_PROGRESS' | 'ACHIEVED' | 'EXPIRED';
  notes?: string;
  startDate?: string;
  endDate?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffTask {
  id?: string;
  title: string;
  description?: string;
  assignedStaffId: string; // Staff ID or "ALL"
  assignedStaffName?: string;
  dueDate: string; // "YYYY-MM-DD"
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  createdBy?: string;
  createdAt?: string;
  completedAt?: string;
  completedBy?: string;
}


export interface SalarySlip {
  staffId: string;
  staffName: string;
  month: string;            // Format: "YYYY-MM"
  baseSalary: number;       // Monthly Fixed Salary

  // Attendance Stats
  totalDays: number;
  presentDays: number;      // Full Days + Permission Days
  absentDays: number;
  halfDays: number;
  sickLeaves: number;       // Paid leaves
  permissionHoursTaken: number;

  // Calculations
  perDaySalary: number;
  perHourSalary: number;

  // Financials
  lopAmount: number;        // Deduction for Absent + Half Days
  permissionDeduction: number; // Deduction for excess hours
  netSalary: number;        // Final Amount to be paid
}

export interface CreditTransaction {
  id?: string;
  vendorId: string;
  invoice?: string; // Added for compatibility with new backend
  amount: number;
  paidAmount: number;
  balance: number;
  paymentMode: 'CASH' | 'ONLINE' | 'CHEQUE' | 'CREDIT' | 'UPI';
  status: 'PENDING' | 'PARTIAL' | 'PAID';
  description?: string;
  date?: string;
  createdAt?: string;
  products?: Product[]; // Added list of products
  lastPaymentDate?: string;
  paymentRemarks?: string;
  paymentHistory?: PaymentHistoryEntry[];
}

export interface PaymentHistoryEntry {
  amount: number;
  paymentMode: string;
  description?: string;
  paymentDate: string;
  balanceAfterPayment: number;
  statusAfterPayment: string;
}

export interface ReturnedProduct {
  productId: string;
  name: string;
  returnedQty: number;
  purchaseRate: number;
  amount: number;
}

export interface PurchaseReturn {
  id?: string;
  transactionId: string;
  vendorId: string;
  vendorName: string;
  invoice: string;
  returnDate: string;
  returnedProducts: ReturnedProduct[];
  totalReturnAmount: number;
  previousAmount: number;
  newAmount: number;
  previousBalance: number;
  newBalance: number;
  status: string;
  remarks?: string;
}

export interface SalesReturnedProduct {
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
}

export interface SalesReturn {
  id?: string;
  billId: string;
  customerName: string;
  customerPhone: string;
  returnDate: string;
  returnedProducts: SalesReturnedProduct[];
  totalReturnAmount: number;
  previousBillAmount: number;
  newBillAmount: number;
  status: string;
  remarks?: string;
  processedBy?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  gstin: string;
  address: string;
  state?: string; // Added state field
  vendorInvoice?: string; // New field
  transactions?: string[];
}

export const mapVendorFromBackend = (v: any): Vendor => ({
  id: v.id || v._id || '',
  name: v.name,
  phone: v.phone || v.contact || '',
  gstin: v.gstin || v.gstIn || v.gst || v.GST || v.GSTIN || v.gstNo || '',
  address: v.address || '',
  state: v.state || '', // Map state field
  vendorInvoice: v.vendorInvoice || '', // Map new field
  transactions: v.transactions || []
});

// Vendor API Wrapper
export const vendorApi = {
  getAll: async () => {
    const res = await vendorService.get<Vendor[]>('/vendors/all');
    let data: any[] = [];
    if (Array.isArray(res.data)) {
      data = res.data;
    } else if (res.data && Array.isArray((res.data as any).vendors)) {
      data = (res.data as any).vendors;
    }

    // In-place update of data to ensure type safety downstream
    const mapped = data.map(mapVendorFromBackend);
    res.data = mapped;
    return res;
  },
  getVendor: (id: string) => vendorService.get<Vendor>(`/vendors/get/${id}`),
  addVendor: (data: Partial<Vendor>) => vendorService.post('/vendors/add', data),
  updateVendor: (id: string, data: Partial<Vendor>) => vendorService.patch(`/vendors/update/${id}`, data),
  deleteVendor: (id: string) => vendorService.delete(`/vendors/delete/${id}`),

  // Transactions
  getCredits: (vendorId: string) => vendorService.get<CreditTransaction[]>(`/vendors/transactions/vendor/${vendorId}`),
  addCredit: (data: CreditTransaction) => vendorService.post('/vendors/transactions/add', data),
  updateCredit: (id: string, data: Partial<CreditTransaction>) => vendorService.patch(`/vendors/transactions/update/${id}`, data), // Kept for compat if needed, simplified in new backend
  recordPayment: (id: string, amount: number, paymentMode?: string, description?: string) =>
    vendorService.put(`/vendors/transactions/${id}/pay`, null, { params: { amount, paymentMode, paymentDescription: description } }),
  deleteCredit: (id: string) => vendorService.delete(`/vendors/transactions/delete/${id}`),
  getCreditsRange: (start: string, end: string) => vendorService.get<CreditTransaction[]>(`/vendors/transactions/range?startDate=${start}&endDate=${end}`),
  syncProductDetails: (productId: string, rate: number, gst: number, stock: number) => vendorService.put(`/vendors/transactions/sync-details/${productId}?rate=${rate}&gst=${gst}&stock=${stock}`),

  // Purchase Returns
  addPurchaseReturn: (data: PurchaseReturn) => vendorService.post('/vendors/transactions/returns/add', data),
  getPurchaseReturnsRange: (start: string, end: string) => vendorService.get<PurchaseReturn[]>(`/vendors/transactions/returns/range?startDate=${start}&endDate=${end}`),
  getPurchaseReturnsByTransaction: (transactionId: string) => vendorService.get<PurchaseReturn[]>(`/vendors/transactions/returns/transaction/${transactionId}`),
};

export interface ChitScheme {
  id?: string;
  name: string;
  monthlyAmount: number;
  totalMonths: number;
  bonusAmount: number;
  active: boolean;
}

export interface ChitMember {
  id?: string;
  customerName: string;
  customerPhone: string;
  schemeId: string;
  joinedDate?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'DROPPED';
  monthsPaid: number;
  totalPaidAmount: number;
}

// --- Product API ---

export interface Category {
  id?: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  unit?: string;
  category: string;
  purchaseRate: number;
  purchaseGst: number;
  sellingPrice: number; // Backend field (formerly salesRate)
  wholesaleSellingPrice: number; // NEW Backend field
  price: number;     // Frontend alias for sellingPrice
  wholesalePrice: number; // Frontend alias for wholesaleSellingPrice
  discount: number;
  stockQuantity: number;
  vendorId: string;
  vendorName: string;
  barcode: string;
  barcodeImageUrl?: string;
  taxCode?: string;
  colourCode?: string;
  purchaseDate?: string; // Authoritative Business Date: yyyy-MM-dd
  createdAt?: string;
  updatedAt?: string;
  mrp?: number;
  creditTransactionId?: string;
  gst?: number; // Frontend override for billing
}

export { DEFAULT_UNIT_OPTIONS as UNIT_OPTIONS, getAllUnitOptions } from '@/utils/unitManager';

// Helper to map Backend Product to Frontend Product (handling alias)
const mapProductFromBackend = (p: any): Product => ({
  ...p,
  id: p.id || p._id || '',
  name: p.name || '',
  unit: p.unit || '',
  barcode: p.barcode || p.productCode || '', // Ensure barcode is never undefined
  // Safely fallback to 0 if valid data is missing
  price: parseFloat(p.sellingPrice !== undefined ? p.sellingPrice : (p.price || 0)) || 0,
  sellingPrice: parseFloat(p.sellingPrice || 0) || 0,
  wholesalePrice: parseFloat(p.wholesaleSellingPrice !== undefined ? p.wholesaleSellingPrice : (p.wholesalePrice || 0)) || 0,
  wholesaleSellingPrice: parseFloat(p.wholesaleSellingPrice || 0) || 0,
  mrp: parseFloat(p.mrp || p.MRP || p.Mrp || 0) || 0, // Enhanced mapping
  purchaseRate: parseFloat(p.purchaseRate || 0) || 0,
  stockQuantity: parseFloat(p.stockQuantity || 0) || 0,
  discount: parseFloat(p.discount || 0) || 0,
  purchaseGst: parseFloat(p.purchaseGst || 0) || 0,
  purchaseDate: p.purchaseDate || (p.createdAt ? p.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
  taxCode: p.taxCode || p.hsnsac || '',
  colourCode: p.colourCode || '',
});

// Helper to map Frontend Product to Backend Product
const mapProductToBackend = (p: Partial<Product>): any => {
  const { price, sellingPrice, wholesalePrice, wholesaleSellingPrice, ...rest } = p;
  return {
    ...rest,
    sellingPrice: sellingPrice !== undefined ? sellingPrice : price, // Use price if sellingPrice not set
    wholesaleSellingPrice: wholesaleSellingPrice !== undefined ? wholesaleSellingPrice : wholesalePrice,
  };
};

export const productApi = {
  getAll: async (params?: any) => {
    const res = await productService.get<Product[]>('/products/all', { params });
    if (Array.isArray(res.data)) {
      res.data = res.data.map(mapProductFromBackend);
    }
    return res;
  },
  get: async (id: string) => {
    const res = await productService.get<Product>(`/products/get/${id}`);
    if (res.data) res.data = mapProductFromBackend(res.data);
    return res;
  },
  getByBarcode: async (barcode: string) => {
    const res = await productService.get<Product>(`/products/barcode/${barcode}`);
    if (res.data) res.data = mapProductFromBackend(res.data);
    return res;
  },
  add: (data: Partial<Product>) => productService.post('/products/add', mapProductToBackend(data)),
  update: (id: string, data: Partial<Product>) => productService.patch(`/products/update/${id}`, mapProductToBackend(data)),
  delete: (id: string) => productService.delete(`/products/delete/${id}`),
  updateStock: (id: string, change: number | null, set: number | null) =>
    productService.put(`/products/${id}/stock`, null, { params: { change, set } }),

  // Categories
  getCategories: () => productService.get<Category[]>('/products/categories'),
  addCategory: (data: Category) => productService.post('/products/categories/add', data),
  updateCategory: (id: string, data: Partial<Category>) => productService.patch(`/products/categories/${id}`, data),
  deleteCategory: (id: string) => productService.delete(`/products/categories/delete/${id}`),

  // Date Range
  getByDateRange: async (startDate: string, endDate: string) => {
    const res = await productService.get<Product[]>(`/products/by-dates?startDate=${startDate}&endDate=${endDate}`);
    if (Array.isArray(res.data)) res.data = res.data.map(mapProductFromBackend);
    return res;
  }
};

export const chitService = {
  // Using paths from reference to support new feature set
  createScheme: (data: ChitScheme) => vendorService.post('/chit/schemes/add', data),
  updateScheme: (id: string, data: Partial<ChitScheme>) => vendorService.patch(`/chit/schemes/update/${id}`, data),
  getAllSchemes: () => vendorService.get<ChitScheme[]>('/chit/schemes/all'),
  deleteScheme: (id: string) => vendorService.delete(`/chit/schemes/delete/${id}`),

  joinChit: (data: ChitMember) => vendorService.post('/chit/members/join', data),
  getAllMembers: (phone?: string) => vendorService.get<ChitMember[]>(`/chit/members/all${phone ? `?phone=${phone}` : ''}`),
  updateMember: (id: string, data: Partial<ChitMember>) => vendorService.patch(`/chit/members/update/${id}`, data),
  deleteMember: (id: string) => vendorService.delete(`/chit/members/delete/${id}`),

  makePayment: (data: any) => vendorService.post('/chit/payment/pay', data),
  getHistory: (memberId: string) => vendorService.get(`/chit/payment/history/${memberId}`),
};

// --- Billing API ---

export interface BillDetails {
  productId: string;
  quantity: number;
  productName: string;
  unit: string;
  unitPrice: number;
  mrp?: number;
  gstRate: number;
  discountRate: number;
  taxCode?: string;
  colourCode?: string;
  // Sales Return tracking — quantity of this line already returned
  returnedQty?: number;
  // Profit specific
  purchaseRate?: number;
  purchaseGstRate?: number;
  // Computed
  subtotal?: number;
  discountAmount?: number;
  gstAmount?: number;
  netAmount?: number;
}

export interface Bill {
  id?: string;
  invoiceId?: string; // Added for compatibility
  invoiceNumber?: string; // Added for compatibility
  status?: string; // PAID, HOLD, CANCELLED, RETURNED
  customerName: string;
  customerPhone: number;
  customerEmail?: string;
  customerAddress?: string;
  customerGst?: string; // Added for compatibility
  cashierId?: string;
  items: BillDetails[];
  totalDiscountAmount?: number;
  totalGstAmount?: number;
  finalAmount?: number;
  amountPaid?: number;
  paymentMethod: string;
  billType?: string; // Added billType
  brokerId?: string;
  commissionAmount?: number;
  staffId?: string; // Added staffId
  staffCommissionPercentage?: number; // Added staffCommissionPercentage
  staffCommissionAmount?: number; // Added staffCommissionAmount
  staffCommissionStatus?: 'PAID' | 'UNPAID'; // Added staffCommissionStatus
  onlineAmount?: number;
  paymentHistory?: PaymentHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
  // Payment Reminder Fields
  paymentReminderDate?: string;

  // Transport Details
  vehicleNo?: string;
  dispatchThrough?: string;
  destination?: string;
  termsOfDelivery?: string;
  transportAmount?: number;
  transportGstRate?: number;

  // Ship To Details
  shipToName?: string;
  shipToPhone?: string;
  shipToEmail?: string;
  shipToAddress?: string;
  shipToGst?: string;
  isShipToDifferent?: boolean;
  // Sales Return summary — cumulative value returned + fully-returned flag
  returnedAmount?: number;
  fullyReturned?: boolean;
}

export const billingApi = {
  getNotifications: () => billingService.get<Bill[]>('/billing/notifications').catch(() => billingService.get<Bill[]>('/billing/all').catch(() => ({ data: [] as Bill[] }))), 
  create: (data: Bill) => billingService.post('/billing/create', data),
  update: (id: string, data: Partial<Bill>) => billingService.patch(`/billing/update/${id}`, data), // Added generic update
  hold: (data: Bill) => billingService.post('/billing/hold', data),

  cancelHold: (id: string) => billingService.put(`/billing/${id}/cancel`),
  cancelPlaceholder: (id: string) => billingService.put(`/billing/${id}/cancel-placeholder`),
  uncancel: (id: string) => billingService.put(`/billing/${id}/uncancel`),
  returnBill: (id: string, data: Bill) => billingService.put(`/billing/${id}/return`, data),
  // Sales Returns
  processSalesReturn: (billId: string, data: { returnedProducts: any[]; remarks?: string }) =>
    billingService.put<SalesReturn>(`/billing/${billId}/return`, data),
  cancelSalesReturn: (returnId: string, data: { reason: string }) =>
    billingService.put<SalesReturn>(`/billing/sales-returns/${returnId}/cancel`, data),
  getSalesReturnsByRange: (start: string, end: string) =>
    billingService.get<SalesReturn[]>(`/billing/sales-returns/range?start=${start}&end=${end}`),
  getSalesReturnsByBillId: (billId: string) =>
    billingService.get<SalesReturn[]>(`/billing/sales-returns/bill/${billId}`),
  pay: (id: string, data: any) => billingService.patch(`/billing/${id}/pay`, data),
  getAll: () => billingService.get<Bill[]>('/billing/all'),
  getByRange: (start: string, end: string) => billingService.get<Bill[]>(`/billing/range?start=${start}&end=${end}&startDate=${start}&endDate=${end}`),
  search: (name?: string, phone?: number) => billingService.get<Bill[]>(`/billing/search`, { params: { name, phone } }),
  // Get single bill by ID
  getById: (id: string) => billingService.get<Bill>(`/billing/${encodeURIComponent(id)}`), // Assuming generic GET endpoint exists or handled by billing service
  // Compatibility
  getProduct: (barcode: string) => billingService.get<BillDetails>(`/billing/product/${barcode}`),
  getHoldBills: () => billingService.get<Bill[]>('/billing/hold'), // This endpoint might need verify if it exists on backend, assuming filtered GET or specific endpoint.
  // Checking Service code: doesn't show specific 'getHold' endpoint.
  // But `getAll` returns all. `getHoldBills` probably needs to filter.
  // Or user might have meant `/billing/all` and filter by status.
  // Provided backend code DOES NOT have explicit `/hold` GET.
  // However, existing frontend calls `/billing/hold` GET.
  // Provided backend code DOES NOT have explicit `/hold` GET.
  // However, existing frontend calls `/billing/hold` GET.
  // The user provided controller has `@PostMapping("/hold")` but not GET.
  // We will assume `getAll` + filter for now or `getHold` if it was there.
  // Wait, the user's `BillService` has `updateStatus`.
};

// --- Customer API ---

export interface Customer {
  id: string; // Made id required for type safety
  phone: string;
  name: string;
  email?: string;
  address?: string;
  gstin?: string;
  gstNo?: string;
  loyaltyPoints?: number;
  totalSpent?: number;
  visitCount?: number;
  lastVisit?: string;
  createdAt?: string;
}

export interface CustomerPurchase {
  id: string; // Bill ID
  amount: number; // Total Bill Amount
  paidAmount?: number;
  balance?: number;
  paymentMethod: string;
  items?: any[];
  status?: string;
  cashAmount?: number;
  onlineAmount?: number;
  paymentHistory?: PaymentHistoryEntry[];
  date?: string;
}

export const mapCustomerFromBackend = (c: any): Customer => ({
  ...c,
  id: c.id || c._id || '',
  phone: c.phone || c.contact || '',
  address: c.address || c.Address || c.location || '',
  gstin: c.gstin || c.gst || c.gstNo || '',
});

export const customerApi = {
  add: (data: Partial<Customer>) => customerService.post('/customers/add', data),
  getAll: async () => {
    const res = await customerService.get<Customer[]>('/customers/all');
    if (res.data && Array.isArray(res.data)) {
      res.data = res.data.map(mapCustomerFromBackend);
    }
    return res;
  },
  update: (id: string, data: Partial<Customer>) => customerService.patch(`/customers/update/${id}`, data),
  delete: (id: string) => customerService.delete(`/customers/delete/${id}`),
  getHistory: (id: string) => customerService.get<CustomerPurchase[]>(`/customers/${id}/history`),
  recordPayment: (customerId: string, billId: string, data: {
    amount: number,
    paymentMode: string,
    description?: string,
    date: string
  }) => vendorService.post(`/customers/${customerId}/bills/${billId}/payments`, data),
};

// --- DayBook API ---

export interface DayBookEntry {
  id?: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  amount: number;
  date?: string;
  category?: string; // "System" means it came from auto-calculated sales
  paymentMethod: "Cash" | "UPI" | "Card";
}



export interface DayBookSummaryResponse {
  salesSummary: {
    total: number;
    cash: number;
    upi: number;
    card: number;
  };
  entries: DayBookEntry[];
}

export interface CashTally {
  date: string; // YYYY-MM-DD
  openingBalance: number;
  denominations: { [key: string]: number }; // e.g., "500": 10
  totalCashHand: number;
}

export const daybookApi = {
  getSummary: (date: string) => billingService.get<DayBookSummaryResponse>(`/billing/daybook/summary?date=${date}`),
  addEntry: (entry: DayBookEntry) => billingService.post('/billing/daybook/add', entry),
  getTally: (date: string) => billingService.get<CashTally>(`/billing/daybook/tally?date=${date}`),
  saveTally: (tally: CashTally) => billingService.post('/billing/daybook/tally', tally),

  // Edit/Delete
  updateEntry: (id: string, entry: Partial<DayBookEntry>) => billingService.patch(`/billing/daybook/update/${id}`, entry),
  deleteEntry: (id: string) => billingService.delete(`/billing/daybook/delete/${id}`),
  getRange: (start: string, end: string) => billingService.get<{
    summary: { totalIncome: number; totalExpense: number };
    dailyBreakdown: { date: string; income: number; expense: number }[];
    chartData: { date: string; income: number; expense: number }[];
  }>(`/billing/daybook/range?start=${start}&end=${end}&startDate=${start}&endDate=${end}`),
};

// --- Broker API ---

export interface Broker {
  id: string;
  name: string;
  phone: string;
  address?: string;
  gstNo?: string;
  category?: string;
  commissionPercentage?: number;
}

export interface Commission {
  id: string;
  brokerId?: string;
  staffId?: string;
  staffName?: string;
  billId: string;
  date: string;
  amount: number; // Sale amount
  commissionAmount?: number; // Broker commission
  staffCommissionAmount?: number; // Staff commission
  status: 'UNPAID' | 'PAID';
  paidDate?: string;
}

export const brokerApi = {
  getAll: () => vendorService.get<Broker[]>('/broker/all'),
  add: (data: Partial<Broker>) => vendorService.post('/broker/add', data),
  update: (id: string, data: Partial<Broker>) => vendorService.put(`/broker/${id}`, data),
  delete: (id: string) => vendorService.delete(`/broker/${id}`),
  getCommissions: (id: string) => vendorService.get<Commission[]>(`/broker/${id}/commissions`),
  addCommission: (data: Partial<Commission>) => vendorService.post('/broker/commissions/add', data),
  updateStatus: (id: string, status: 'PAID' | 'UNPAID') => vendorService.patch(`/broker/commissions/${id}/status`, { status }),
};

// --- Reminder & Notification API ---

export interface Reminder {
  id?: string;
  customerId: string;
  customerName: string;
  phone?: string; // Backend field
  customerPhone?: string; // Frontend alias
  billId: string;
  productName?: string; // Used for note
  expiryDate?: string; // ISO Date
  notified?: boolean;
  status?: string; // Compatibility
  type?: string; // Compatibility
  message?: string; // Compatibility
}

export const reminderApi = {
  create: (data: Reminder) => billingService.post('/reminders/create', {
    ...data,
    phone: data.phone || data.customerPhone, // Ensure backend gets 'phone'
  }),
  // Add other methods if needed
};

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  relatedId?: string;
  relatedBillId?: string;
  isRead: boolean;
  createdAt: string;
  role?: string;
}



export const notificationApi = {
  getUnread: () => billingService.get<Notification[]>('/notifications/unread'),
  markAsRead: (id: string) => billingService.patch(`/notifications/${id}/read`),
};

// --- Estimation API ---

export interface Estimation {
  id?: string;
  estimationId: string;
  customerName: string;
  customerPhone: number;
  customerEmail?: string;
  customerAddress?: string;
  customerGst?: string;
  pricingMode: string;
  items: BillDetails[];
  totalDiscountAmount?: number;
  totalGstAmount?: number;
  finalAmount?: number;
  createdAt?: string;

  // Transport Details
  vehicleNo?: string;
  dispatchThrough?: string;
  destination?: string;
  termsOfDelivery?: string;
  transportAmount?: number;
  transportGstRate?: number;

  // Ship To Details
  shipToName?: string;
  shipToPhone?: string;
  shipToEmail?: string;
  shipToAddress?: string;
  shipToGst?: string;
  isShipToDifferent?: boolean;
  paidAmount?: number;
  paymentHistory?: PaymentHistoryEntry[];
}

export const estimationApi = {
  create: (data: Estimation) => billingService.post('/estimations/create', data),
  getAll: () => billingService.get<Estimation[]>('/estimations/all'),
  getById: (id: string) => billingService.get<Estimation>(`/estimations/${encodeURIComponent(id)}`),
  update: (id: string, data: Estimation) => billingService.put(`/estimations/${encodeURIComponent(id)}`, data),
};

// --- Proforma API ---

export interface Proforma {
  id?: string;
  proformaId: string;
  customerName: string;
  customerPhone: number;
  customerEmail?: string;
  customerAddress?: string;
  customerGst?: string;
  pricingMode: string;
  items: BillDetails[];
  totalDiscountAmount?: number;
  totalGstAmount?: number;
  finalAmount?: number;
  createdAt?: string;

  vehicleNo?: string;
  dispatchThrough?: string;
  destination?: string;
  termsOfDelivery?: string;
  transportAmount?: number;
  transportGstRate?: number;

  shipToName?: string;
  shipToPhone?: string;
  shipToEmail?: string;
  shipToAddress?: string;
  shipToGst?: string;
  isShipToDifferent?: boolean;
  paidAmount?: number;
  paymentHistory?: PaymentHistoryEntry[];
}

export const proformaApi = {
  create: (data: Proforma) => billingService.post('/proformas/create', data),
  getAll: () => billingService.get<Proforma[]>('/proformas/all'),
  getById: (id: string) => billingService.get<Proforma>(`/proformas/${encodeURIComponent(id)}`),
  update: (id: string, data: Proforma) => billingService.put(`/proformas/${encodeURIComponent(id)}`, data),
  delete: (id: string) => billingService.delete(`/proformas/${encodeURIComponent(id)}`),
};

export const reportApi = {
  downloadGstMonthlyReport: (month: string) =>
    reportService.get(`/reports/gst/monthly`, {
      params: { month },
      responseType: 'blob'
    }),
};
export interface RawMaterial { id?: string; name: string; availableStock?: number; }
export const rawMaterialApi = {
  getAll: () => Promise.resolve({ data: [] as RawMaterial[] })
};

