import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Pencil, Trash2, PlusCircle, X, Layers, Upload, Download, Printer, ListPlus,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CreditCard, CheckCircle, Info, Calendar
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { productApi, vendorApi, CreditTransaction, Vendor, Product as ApiProduct, UNIT_OPTIONS } from '@/lib/api';
import { useGlobalData } from '@/context/GlobalDataContext';
import Barcode from 'react-barcode';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import Papa, { ParseResult } from 'papaparse';
import JsBarcode from 'jsbarcode';
import MultiProductFormModal from './MultiProductFormModal';
import { generateSixDigitId, formatDate } from '@/lib/utils';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useConfirm } from '@/hooks/useConfirm';
import { useAuth } from '@/context/AuthContext';
import { parseExcelFile } from '@/utils/excelParser'; // Added import
import { useCustomUnits } from '@/utils/unitManager';
// Data Structures
interface Product extends ApiProduct {
  creditTransactionId?: string;
}

interface SelectedProducts {
  [productId: string]: {
    quantity: number;
    barcode: string;
    name: string;
    price: number;
  };
}

const formatQty = (value: any) => {
  const num = Number(value);
  if (isNaN(num)) return value;
  return num.toString();
};

// =================================================================================
// START: STYLISH PAGINATION COMPONENT
// =================================================================================
const Pagination = ({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    for (const i of range) {
      if (l) {
        if (i - l === 2) rangeWithDots.push(l + 1);
        else if (i - l !== 1) rangeWithDots.push('...');
      }
      rangeWithDots.push(i);
      l = i;
    }
    return rangeWithDots;
  };

  return (
    <div className="flex justify-between items-center px-6 py-4 border-t bg-gray-50">
      <div className="text-sm text-gray-500 font-medium">
        Page {currentPage} of {totalPages}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg hover:bg-white hover:shadow-sm text-gray-600 disabled:opacity-30 disabled:hover:shadow-none transition-all"
          title="First Page"
        >
          <ChevronsLeft size={18} />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg hover:bg-white hover:shadow-sm text-gray-600 disabled:opacity-30 disabled:hover:shadow-none transition-all"
          title="Previous Page"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex gap-1 mx-2">
          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className="px-2 self-end text-gray-400 font-medium select-none mb-1">...</span>
              ) : (
                <button
                  onClick={() => onPageChange(Number(page))}
                  className={`
                    w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-all duration-200
                    ${currentPage === page
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-white hover:shadow-sm'
                    }
                  `}
                >
                  {page}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg hover:bg-white hover:shadow-sm text-gray-600 disabled:opacity-30 disabled:hover:shadow-none transition-all"
          title="Next Page"
        >
          <ChevronRight size={18} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg hover:bg-white hover:shadow-sm text-gray-600 disabled:opacity-30 disabled:hover:shadow-none transition-all"
          title="Last Page"
        >
          <ChevronsRight size={18} />
        </button>
      </div>
    </div>
  );
};

const Products = () => {
  const { user } = useAuth();
  const isCashier = user?.role?.toLowerCase() === 'cashier';
  const { products: globalProducts, vendors: globalVendors, loading: globalLoading, refreshProducts, refreshVendors, mutateProducts, isSyncing } = useGlobalData();
  const { confirm: confirmAction, ConfirmationDialog } = useConfirm();
  const { allUnits } = useCustomUnits();

  // Data is already loaded by GlobalDataContext on login. No need to refresh on every navigation.
  // Post-action refreshes (add/edit/delete) handle data freshness via refreshProducts() calls.

  // Categories derived from already-loaded products — no API call needed
  const categories = useMemo(
    () => [...new Set(globalProducts.map((p: any) => p.category).filter(Boolean))] as string[],
    [globalProducts]
  );
  // Local derived state for UI
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);

  const [isLoading, setIsLoading] = useState(false); // For local actions like delete/save
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMultiAddModalOpen, setIsMultiAddModalOpen] = useState(false);
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [defaultGst] = useLocalStorage('defaultGst', 5);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProducts>({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const handleApplyFilter = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setCurrentPage(1);
    toast.success('Date filter applied');
  };

  // Inline Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});




  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100);
  const [shopName] = useLocalStorage('shopName_rose_boutique', 'Lingam Spares');

  // Helper to sort products (client-side now)
  const getSortedProducts = (list: Product[]) => {
    return [...list].sort((a, b) => {
      // Primary: purchaseDate
      const dateA = a.purchaseDate || '';
      const dateB = b.purchaseDate || '';
      const comp = dateB.localeCompare(dateA);
      if (comp !== 0) return comp;

      // Secondary: createdAt (Audit trail)
      const timeA = new Date(a.createdAt || '').getTime() || 0;
      const timeB = new Date(b.createdAt || '').getTime() || 0;
      const timeDiff = timeB - timeA;
      if (timeDiff !== 0) return timeDiff;

      // Tertiary: Numeric ID
      return parseInt(b.id || '0', 10) - parseInt(a.id || '0', 10);
    });
  };

  // Filter products based on search
  const filteredProducts = (globalProducts as Product[]).filter((p) => {
    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    let matchesSearch = true;

    if (lowerSearchTerm) {
      matchesSearch = (
        (p.name && p.name.toLowerCase().includes(lowerSearchTerm)) ||
        (p.category && p.category.toLowerCase().includes(lowerSearchTerm)) ||
        (p.id && p.id.toString().includes(lowerSearchTerm)) ||
        (p.barcode && p.barcode.toString().includes(lowerSearchTerm)) ||
        (p.vendorName && p.vendorName.toLowerCase().includes(lowerSearchTerm))
      );
    }

    if (!matchesSearch) return false;

    // Date Filter logic
    if (!appliedStartDate && !appliedEndDate) return true;

    const pDateStr = p.purchaseDate;
    if (!pDateStr) return false;

    const pDate = new Date(pDateStr);
    if (isNaN(pDate.getTime())) return false;

    pDate.setHours(0, 0, 0, 0);

    if (appliedStartDate) {
      const sDate = new Date(appliedStartDate);
      sDate.setHours(0, 0, 0, 0);
      if (pDate < sDate) return false;
    }
    if (appliedEndDate) {
      const eDate = new Date(appliedEndDate);
      eDate.setHours(0, 0, 0, 0);
      if (pDate > eDate) return false;
    }
    return true;
  });

  // Sort and Paginate
  const sortedProducts = getSortedProducts(filteredProducts);
  const totalItems = sortedProducts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Slice for current view
  const currentViewProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Sync displayed products
  useEffect(() => {
    setDisplayedProducts(currentViewProducts);
  }, [globalProducts, currentPage, searchTerm, itemsPerPage, appliedStartDate, appliedEndDate]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleSaveProduct = async (formData: any) => {
    setIsSaving(true);
    const isEditing = !!formData.id;
    const now = new Date().toISOString();
    const payload = {
      id: formData.id || generateSixDigitId(),
      name: formData.name,
      unit: formData.unit || '',
      category: formData.category,
      purchaseRate: parseFloat(formData.purchaseRate as any) || 0,
      purchaseGst: parseFloat(formData.purchaseGst as any) || 0,
      price: parseFloat(formData.price as any) || 0,
      wholesaleSellingPrice: parseFloat(formData.wholesalePrice as any) || 0,
      mrp: parseFloat(formData.mrp as any) || 0,
      discount: parseFloat(formData.discount as any) || 0,
      stockQuantity: parseFloat(formData.stockQuantity as any) || 0,
      vendorId: formData.vendorId,
      vendorName: formData.vendorName,
      barcode: formData.barcode,
      taxCode: formData.taxCode,
      colourCode: formData.colourCode,
      purchaseDate: formData.purchaseDate || (formData.createdAt ? formData.createdAt.split('T')[0] : now.split('T')[0]),
      createdAt: formData.createdAt || now,
      updatedAt: now
    };

    const processSave = async () => {
      try {
        if (isEditing) {
          const { createdAt, ...updatePayload } = payload;

          // 1. Update Product Service
          await productApi.update(formData.id, updatePayload);

          // 2. Sync Vendor Service (if critical fields changed)
          const oldProduct = (globalProducts as Product[]).find(p => p.id === formData.id);
          const newRate = payload.purchaseRate;
          const newGst = payload.purchaseGst;
          const newStock = payload.stockQuantity;

          if (oldProduct) {
            const rateChanged = Math.abs((oldProduct.purchaseRate || 0) - (newRate || 0)) > 0.01;
            const gstChanged = Math.abs((oldProduct.purchaseGst || 0) - (newGst || 0)) > 0.01;
            const stockChanged = (oldProduct.stockQuantity || 0) !== (newStock || 0);

            if (rateChanged || gstChanged || stockChanged) {
              // Trigger manual sync
              try {
                await vendorApi.syncProductDetails(formData.id, newRate, 0, newStock);
                console.log("Product details sync triggered for product:", formData.id);
                // Refresh vendors to see updated credits
                refreshVendors();
              } catch (syncErr: any) {
                console.error("Vendor details sync failed:", syncErr);
                toast.error("Product updated, but failed to sync vendor credits.");
              }
            }
          }

          toast.success("Product updated successfully");
        } else {
          const res = await productApi.add(payload);
          if (payload.mrp > 0 && res.data && res.data.id) {
            try {
              await productApi.update(res.data.id, { mrp: payload.mrp });
            } catch (e) {
              console.error("MRP Patch failed");
            }
          }
          toast.success("Product created successfully");
        }
        await refreshProducts();
        setIsModalOpen(false);
      } catch (err: any) {
        toast.error(`Error saving product: ${err.response?.data?.error || err.message}`);
      } finally {
        setIsSaving(false);
      }
    };

    if (payload.stockQuantity <= 0 && isEditing) {
      confirmAction(
        `Product ${payload.name} stock is 0. Do you want to delete this product entirely?`,
        async () => {
          try {
            await productApi.delete(formData.id);
            mutateProducts(prev => prev.filter(p => p.id !== formData.id));
            setIsModalOpen(false);
            setIsSaving(false); // Reset saving state after delete
          } catch (err: any) {
            toast.error(`Delete failed: ${err.message}`);
            setIsSaving(false);
          }
        },
        "Delete Product?",
        () => {
          // Cancel means Save as 0 stock
          processSave();
        },
        { cancelText: 'No, Keep (0 Stock)', confirmText: 'Yes, Delete' }
      );
      return;
    }

    await processSave();
  };

  const handleDeleteProduct = (id: string) => {
    confirmAction('Are you sure you want to delete this product? This will remove it from stock and update supplier credits if linked.', async () => {
      const previousProducts = [...globalProducts];
      const product = globalProducts.find(p => p.id === id);

      // Instant Optimistic UI: Remove product from table in 0ms
      mutateProducts(prev => prev.filter(p => p.id !== id));
      const toastId = toast.loading("Deleting product...");

      try {
        // 1. Handle Supplier Credit Update in background
        if (product && product.vendorId) {
          try {
            const creditsRes = await vendorApi.getCredits(product.vendorId);
            const credits = creditsRes.data || [];

            let tx = credits.find((t: any) => product.creditTransactionId && t.id === product.creditTransactionId);
            if (!tx) {
              tx = credits.find((t: any) => t.products && Array.isArray(t.products) && t.products.some((pr: any) => pr.id === id));
            }

            if (tx) {
              const newProducts = tx.products || [];
              const productInTxIndex = newProducts.findIndex((pr: any) => pr.id === id);

              let deduction = 0;
              if (productInTxIndex !== -1) {
                const pEntry = newProducts[productInTxIndex];
                deduction = (pEntry.purchaseRate || product.purchaseRate || 0) * (pEntry.stockQuantity || product.stockQuantity || 0);
                newProducts.splice(productInTxIndex, 1);
              } else {
                deduction = (product.purchaseRate || 0) * (product.stockQuantity || 0);
              }

              const newAmount = Math.max(0, (tx.amount || 0) - deduction);
              const newBalance = Math.max(0, (tx.balance || 0) - deduction);

              if (newAmount <= 0) {
                await vendorApi.deleteCredit(tx.id!);
              } else {
                await vendorApi.updateCredit(tx.id!, {
                  amount: newAmount,
                  balance: newBalance,
                  products: newProducts
                } as any);
              }
            }
          } catch (e) {
            console.error("Credit update failed", e);
          }
        }

        // 2. Delete Product
        await productApi.delete(id);
        toast.success("Product deleted successfully.", { id: toastId });
      } catch (err: any) {
        mutateProducts(previousProducts);
        toast.error(`Delete failed: ${err.message}`, { id: toastId });
      }
    }, 'Delete Product');
  };

  // Edit Handlers (Moved here to fix scope issues)
  const handleEditClick = (product: Product) => {
    setEditingId(product.id);
    setEditForm({
      id: product.id || '',
      name: product.name || '',
      category: product.category || '',
      vendorId: product.vendorId || '',
      vendorName: product.vendorName || '',
      purchaseRate: product.purchaseRate || 0,
      price: product.price || 0,
      wholesalePrice: product.wholesaleSellingPrice || 0,
      stockQuantity: product.stockQuantity || 0,
      purchaseGst: product.purchaseGst || 0,
      discount: product.discount || 0,
      barcode: product.barcode || '',
      taxCode: product.taxCode || '',
      colourCode: product.colourCode || '',
      unit: product.unit || '',
      mrp: product.mrp || 0,
      purchaseDate: product.purchaseDate || (product.createdAt ? product.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
      createdAt: product.createdAt
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveInline = async () => {
    if (!editingId) return;
    // Basic validations
    if (parseFloat(editForm.price) < parseFloat(editForm.purchaseRate)) {
      toast.error("Selling Price cannot be less than Purchase Rate.");
      return;
    }
    // Call existing save handler
    await handleSaveProduct(editForm);
    setEditingId(null);
  };

  // Categories are derived from products via useMemo above — no API call needed on mount.

  const handleAddOrUpdateCategory = async (oldCategory: string | null, newCategory: string) => {
    if (!newCategory.trim()) return;
    try {
      if (oldCategory) {
        // Fetch to find the ID of the category we want to update
        const res = await productApi.getCategories();
        const categoryObj = res.data.find((c: any) => c.name === oldCategory);

        if (categoryObj && categoryObj.id) {
          await productApi.updateCategory(categoryObj.id, { name: newCategory.trim() });
          toast.success("Category updated successfully");
        } else {
          throw new Error("Category ID not found in database");
        }
      } else {
        await productApi.addCategory({ name: newCategory.trim() });
        toast.success("Category added successfully");
      }
      await refreshProducts();
    } catch (err: any) {
      console.error("Category save error:", err);
      toast.error(`Failed to save category: ${err.response?.data?.error || err.message}`);
      throw err;
    }
  };

  // ... (rest of component) ...
  // Wait, I am pasting `handleDeleteProduct` AND `CategoryModal` completely?
  // Let's replace `CategoryModal` entirely with the new version.

  // ...

  // Skipping down to CategoryModal replacement target (lines 756+)



  const handleOpenModal = (product: Product | null) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const processInBatches = async (productsToUpload: any[], batchSize = 10) => {
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < productsToUpload.length; i += batchSize) {
      const batch = productsToUpload.slice(i, i + batchSize);
      const uploadPromises = batch.map((product) => {
        const vendor = globalVendors.find(v => v.id === product.vendorId);

        if (!vendor && !product.vendorName) {
          console.error(`Skipping product "${product.name}" - Vendor ID "${product.vendorId}" not found.`);
          return Promise.reject(`Vendor ID not found`);
        }

        const barcodeKeys = ['barcode', 'Barcode', 'BARCODE', 'id', 'ID'];
        let csvBarcodeValue = '';
        for (const key of barcodeKeys) {
          if (product[key]) {
            csvBarcodeValue = product[key].toString().trim();
            break;
          }
        }
        const uniqueIdentifier = csvBarcodeValue || generateSixDigitId();
        const dateString = product.createdAt || product.date || product.Date;
        let finalCreatedAt = new Date().toISOString();
        if (dateString) {
          // If it's already YYYY-MM-DD format, keep it to avoid timezone shifts
          if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            finalCreatedAt = dateString;
          } else {
            const parsedDate = new Date(dateString);
            if (!isNaN(parsedDate.getTime())) {
              finalCreatedAt = parsedDate.toISOString();
            } else {
              console.warn(`Could not parse date "${dateString}" for product "${product.name}". Using current date instead.`);
            }
          }
        }

        let purchaseDate =
          product.purchaseDate ||
          product.date ||
          product.Date ||
          '';

        purchaseDate = String(purchaseDate).trim();

        // Block numeric-only fake dates like 46009
        if (/^\d{5,}$/.test(purchaseDate)) {
          console.warn(`Blocked invalid numeric date ${purchaseDate} for ${product.name}`);
          purchaseDate = new Date().toISOString().split('T')[0];
        }

        // Handle Excel Serial Date Format (e.g., 45231)
        if (/^\d+$/.test(purchaseDate) && Number(purchaseDate) > 40000 && Number(purchaseDate) < 60000) {
          const excelDate = new Date((Number(purchaseDate) - 25569) * 86400 * 1000);
          purchaseDate = excelDate.toISOString().split('T')[0];
        }

        const payload = {
          id: uniqueIdentifier,
          barcode: uniqueIdentifier,
          name: product.name,
          unit: product.unit || '',
          category: product.category,
          price: parseFloat(product.price) || 0,
          wholesaleSellingPrice: parseFloat(product.wholesaleSellingPrice || product.wholesalePrice || product.price) || 0,
          mrp: parseFloat(product.mrp || product.MRP || product.Mrp || 0) || 0, // Match backend field 'mrp'
          stockQuantity: parseFloat(product.stockQuantity) || 0,
          purchaseRate: parseFloat(product.purchaseRate) || 0,
          purchaseGst: parseFloat(product.purchaseGst) || defaultGst,
          discount: parseFloat(product.discount) || 0,
          vendorId: product.vendorId,
          vendorName: product.vendorName || vendor?.name,
          purchaseDate: purchaseDate || new Date().toISOString().split('T')[0],
          createdAt: finalCreatedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          creditTransactionId: product.creditTransactionId,
          taxCode: product.taxCode,
          colourCode: product.colourCode,
        };

        if (!payload.name || !payload.price || !payload.barcode) {
          console.error("Skipping invalid row (missing name, price, or barcode):", product);
          return Promise.reject('Missing required fields');
        }

        // Check if product exists to increment stock instead of creating new
        const existingProduct = (globalProducts as Product[]).find(p => 
          p.barcode === payload.barcode || 
          p.id === payload.id || 
          p.name.toLowerCase() === payload.name.toLowerCase()
        );

        if (existingProduct) {
          console.log(`Updating stock for existing product: ${existingProduct.name} (${existingProduct.id})`);
          // Increment stock using the dedicated endpoint
          // Note: updateStock(id, change, set)
          return productApi.updateStock(existingProduct.id, payload.stockQuantity, null);
        }

        return productApi.add(payload);
      });

      const settledResults = await Promise.allSettled(uploadPromises);
      settledResults.forEach(result => {
        if (result.status === 'fulfilled') successCount++;
        else {
          errorCount++;
          console.error("Upload failed for one product in batch:", result.reason);
        }
      });
    }
    return { successCount, errorCount };
  };

  const handleSaveMultipleProducts = async (productsToSave: any[], creditData?: Partial<CreditTransaction>) => {
    setIsLoading(true);
    const { successCount, errorCount } = await processInBatches(productsToSave);
    let creditMsg = '';
    if (creditData && successCount > 0) {
      try {
        await vendorApi.addCredit(creditData as CreditTransaction);
        creditMsg = '\nCredit transaction added successfully.';
      } catch (err) {
        console.error("Failed to add credit transaction:", err);
        creditMsg = '\nWARNING: Failed to add credit transaction.';
      }
    }

    toast.success(`${successCount} products added successfully.\n${errorCount} products failed to add.${creditMsg}`, { duration: 2500 });
    await refreshProducts();
    await refreshVendors();
    setIsLoading(false);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Product Name", "Category", "Unit", "Purchase Rate", "Selling Price", "Wholesale Price", 
      "Stock Quantity", "GST %", "HSN/SAC", "Barcode", "Vendor ID", "Vendor Name", "Bill Number"
    ];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "products_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    const processData = async (data: any[]) => {
      if (data.length === 0) {
        toast.error("File is empty or formatted incorrectly.");
        setIsLoading(false); return;
      }

      // Group by Vendor for Credit Transaction Creation
      const vendorGroups: { [key: string]: any[] } = {};

      data.forEach(p => {
        // Try to find vendor ID
        let vId = p.vendorId || p['Vendor ID'] || p['VendorId'];
        // If no ID, try to find by name from globalVendors
        if (!vId) {
          const vName = p.vendorName || p['Vendor Name'] || p['Supplier'];
          if (vName) {
            const match = globalVendors.find(gv => gv.name.toLowerCase() === vName.toLowerCase());
            if (match) vId = match.id;
          }
        }

        const key = vId || 'UNKNOWN';
        if (!vendorGroups[key]) vendorGroups[key] = [];
        vendorGroups[key].push({ ...p, vendorId: vId }); // Ensure vendorId is set if found
      });

      let totalSuccess = 0;
      let totalError = 0;

      // Process each vendor group
      for (const [vId, products] of Object.entries(vendorGroups)) {
        let creditTxId = undefined;

        if (vId !== 'UNKNOWN') {
          // Calculate total for this batch
          const batchTotal = products.reduce((sum, p) => {
            const cost = parseFloat(p.purchaseRate || p['Purchase Rate'] || p['Cost'] || 0);
            const qty = parseFloat(p.stockQuantity || p['Stock Quantity'] || p['Qty'] || 0);
            return sum + (cost * qty);
          }, 0);
          const invoiceNumber =
            products[0]?.billNumber ||
            products[0]?.['Bill Number'] ||
            products[0]?.['Bill No'] ||
            products[0]?.['Invoice'];

          if (batchTotal > 0) {
            try {
              // CREDIT FIRST: Create transaction
              const creditPayload: CreditTransaction = {
                vendorId: vId,
                invoice: invoiceNumber || '', // Auto-gen invoice number
                amount: batchTotal,
                paidAmount: 0,
                balance: batchTotal,
                paymentMode: 'CREDIT',
                status: 'PENDING',
                description: `Excel Import of ${products.length} items`,
                date: new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString(),
                products: [] // Will be linked via ID back-reference mostly,/or we can pass empty
              };

              const res = await vendorApi.addCredit(creditPayload);
              if (res.data && (res.data as any).id) {
                creditTxId = (res.data as any).id;
                // No toast here to avoid spam, we'll summarize at end
              }
            } catch (err) {
              console.error(`Failed to create credit for vendor ${vId}`, err);
              toast.error(`Failed to create credit record for vendor ${vId}. Products will be saved without credit link.`);
            }
          }
        }

        // Inject ID and Save
        const productsWithCredit = products.map(p => ({
          ...p,
          creditTransactionId: creditTxId
        }));

        const { successCount, errorCount } = await processInBatches(productsWithCredit);
        totalSuccess += successCount;
        totalError += errorCount;
      }

      toast.success(`${totalSuccess} products uploaded successfully.\n${totalError} failed.`, { duration: 3000 });
      await refreshProducts();
      await refreshVendors(); // Refresh ledger
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (results) => processData(results.data),
        error: (error) => { toast.error("CSV Error: " + error.message); setIsLoading(false); }
      });
    } else {
      // Excel
      try {
        const excelData = await parseExcelFile(file);
        // Remap keys if necessary (lenient mapping) happens in processData/processInBatches logic partially? 
        // processInBatches mostly expects direct keys, let's normalize here if needed or trust the 'any' usage
        // The 'processInBatches' function looks for specific keys. 
        // We should ideally run the same normalization as MultiProductFormModal, but 'processInBatches' is existing logic.
        // Let's rely on 'processInBatches' lenient checks (it checks purchaseRate OR Purchase Rate etc? No, step 61 line 575 checks 'product.purchaseRate')
        // Wait, step 61 line 575: `parseFloat(product.purchaseRate)`. It doesn't check aliases.
        // MultiProductFormModal has aliases. Products.tsx line 534...
        // START OF FIX: processInBatches in Products.tsx (Step 61) DOES NOT HAVE ALIASES. 
        // I need to update processInBatches OR normalize data here.
        // Normalizing here is safer.

        const normalizedData = excelData.map((row: any) => ({
          name: row['Product Name'] || row['Name'] || row['Item Name'] || row['name'],

          category: row['Category'] || row['Type'] || row['category'],

          unit: row['Unit'] || row['UOM'] || row['unit'] || "Nos",

          purchaseRate: row['Purchase Rate'] || row['Cost'] || row['Buy Rate'] || row['purchaseRate'],

          price: row['Selling Price'] || row['Price'] || row['Rate'] || row['price'],

          wholesaleSellingPrice:
            row['Wholesale Price'] ||
            row['Wholesale'] ||
            row['wholesalePrice'],

          stockQuantity:
            row['Stock Quantity'] ||
            row['Quantity'] ||
            row['Qty'] ||
            row['stockQuantity'],

          purchaseGst:
            row['GST'] ||
            row['GST %'] ||
            row['purchaseGst'],

          taxCode:
            row['HSN/SAC'] ||
            row['HSN'] ||
            row['taxCode'],

          barcode:
            row['Barcode'] ||
            row['Product ID'] ||
            row['barcode'] ||
            row['id'],

          vendorId:
            row['Vendor ID'] ||
            row['vendorId'],

          vendorName:
            row['Vendor Name'] ||
            row['Supplier'],

          discount:
            row['Discount'] ||
            row['discount'],

          mrp:
            row['MRP'] ||
            row['mrp'],

          purchaseDate:
            row['Purchase Date'] ||
            row['Date'] ||
            row['purchaseDate'] ||
            row['PurchaseDate'] ||
            row['Bill Date'] ||
            row['Invoice Date'] ||
            '',

          billNumber:
            row['Bill Number'] ||
            row['Bill No'] ||
            row['Invoice'] ||
            row['Bill']
        }));

        await processData(normalizedData);
      } catch (err) {
        toast.error("Excel parsing failed.");
        setIsLoading(false);
      }
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleSelectProduct = (productId: string, product: Product) => {
    setSelectedProducts(prev => {
      const newSelection = { ...prev };
      if (newSelection[productId]) {
        delete newSelection[productId];
      } else {
        newSelection[productId] = { quantity: 1, barcode: product.barcode, name: product.name, price: product.price };
      }
      return newSelection;
    });
  };

  const handleBarcodeQuantityChange = (productId: string, quantity: number) => {
    setSelectedProducts(prev => ({
      ...prev,
      [productId]: { ...prev[productId], quantity: Math.max(1, quantity) }
    }));
  };

  const handlePrintBarcodes = () => {
    const stickers: string[] = [];
    for (const productId in selectedProducts) {
      const { quantity, barcode, name, price } = selectedProducts[productId];
      const formattedId = productId;
      for (let i = 0; i < quantity; i++) {
        stickers.push(`
            <div class="label">
              <div class="shop">${shopName}</div>
              <svg class="code" data-value="${barcode}"></svg>
              <div class="product-name">${name}</div>
              <div class="product-id">${formattedId}</div>
              <div class="price">₹${price.toFixed(2)}</div>
            </div>`);
      }
    }
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) { toast.error('Pop-up blocked! Please enable pop-ups.'); return; }
    printWin.document.write(`<!DOCTYPE html><html><head><title>Print Barcodes</title><style>
        @page { size: auto; margin: 1mm; }
        body { margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 56mm); justify-content: center; column-gap: 2mm; row-gap: 2mm; font-family: sans-serif; text-transform: uppercase; }
        .label { width: 56mm; height: 28mm; padding: 0.5mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; box-sizing: border-box; overflow: hidden; border: 1px dotted #ccc; page-break-inside: avoid; }
        .shop { font-size: 10pt; font-weight: bold; letter-spacing: 0.5px; }
        .code { width: 48mm; height: 8mm; margin: 1px 0; }
        .product-name { font-size: 8pt; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 54mm; }
        .product-id { font-size: 9pt; font-weight: bold; letter-spacing: 1px; }
        .price { font-size: 15pt; font-weight: 900; margin-bottom: 1px; }
        @media print { 
            body { -webkit-print-color-adjust: exact; } 
            .label { border: none; }
        }
      </style></head><body>${stickers.join('')}</body></html>`);
    printWin.document.close();
    printWin.onload = () => {
      const svgs = printWin.document.querySelectorAll(".code");
      svgs.forEach((svg: any) => {
        const value = svg.dataset.value;
        if (value) {
          JsBarcode(svg, value, { format: "CODE128", width: 1.5, height: 35, displayValue: false, margin: 0 });
        }
      });
      setTimeout(() => { printWin.print(); }, 400);
    };
  };

  // handled by filteredProducts definition at top scope


  const isAllSelected = filteredProducts.length > 0 && filteredProducts.every(p => !!selectedProducts[p.id]);

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedProducts({});
    } else {
      const newSelection: SelectedProducts = {};
      filteredProducts.forEach(p => {
        newSelection[p.id] = { quantity: 1, barcode: p.barcode, name: p.name, price: p.price };
      });
      setSelectedProducts(newSelection);
    }
  };



  if (globalLoading && globalProducts.length === 0) return <div className="p-6 text-center text-gray-500">Loading products...</div>;


  return (
    <div className="space-y-6 pb-12">
      <ConfirmationDialog />
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-gray-800">Stock / Products</h1>
        <SyncIndicator isSyncing={isSyncing} />
      </div>
      {error && <div className="p-4 text-red-600 bg-red-100 rounded-md">{error}</div>}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col gap-4">
        {/* Top Row: Search and Action Buttons */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="w-full lg:w-96 relative">
            <input 
              type="text" 
              placeholder="Search all products..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="form-input w-full py-2 px-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm" 
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {Object.keys(selectedProducts).length > 0 && (
              <button onClick={handlePrintBarcodes} className="px-4 py-2 bg-purple-500 text-white text-sm font-semibold rounded-lg hover:bg-purple-600 flex items-center gap-2 whitespace-nowrap shadow-sm transition-colors">
                <Printer size={18} /> Print Selected
              </button>
            )}
            {isCashier ? (
              <button onClick={() => setIsMultiAddModalOpen(true)} className="px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-lg hover:bg-teal-600 flex items-center gap-2 whitespace-nowrap shadow-sm transition-colors">
                <ListPlus size={18} /> Add Products
              </button>
            ) : (
              <>
                <button onClick={handleDownloadTemplate} className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors border border-blue-200">
                  <Download size={16} /> Template
                </button>
                <button onClick={handleUploadClick} className="px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors border border-green-200">
                  <Upload size={16} /> Import
                </button>
                <button onClick={() => setCategoryModalOpen(true)} className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors border border-gray-200">
                  <Layers size={16} /> Categories
                </button>
                <button onClick={() => setIsMultiAddModalOpen(true)} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap shadow-sm transition-colors">
                  <ListPlus size={18} /> Add Products
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bottom Row: Date Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-50">
          <span className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
            <Calendar size={16} className="text-gray-400" /> Filter by Date:
          </span>
          <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-md border border-gray-100">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-sm px-2 py-1 outline-none text-gray-700" title="Start Date" />
            <span className="text-gray-400 text-xs">to</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-sm px-2 py-1 outline-none text-gray-700" title="End Date" />
          </div>
          <button
            onClick={handleApplyFilter}
            className="px-4 py-1.5 bg-gray-800 text-white text-sm font-semibold rounded-md hover:bg-gray-900 transition-colors shadow-sm"
          >
            Apply Filter
          </button>
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />

      <div className="bg-white rounded-lg shadow-sm flex flex-col h-[calc(100vh-220px)]">
        {isLoading ? (
          <div className="flex-grow flex items-center justify-center text-gray-400">Loading page data...</div>
        ) : (
          <>
            <div className="overflow-auto flex-grow">
              <table className="w-full text-left relative">
                <thead className="bg-gray-50 border-b sticky top-0 z-10">
                  <tr>
                    <th className="p-4"><input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="form-checkbox" /></th>
                    <th className="p-4">S.No</th><th className="p-4">Date</th>
                    {!isCashier && (
                      <>
                        <th className="p-4">Supplier Name</th>
                        <th className="p-4">Supplier ID</th>
                      </>
                    )}
                    <th className="p-4">Product Name</th>
                    <th className="p-4">Product ID / Barcode</th><th className="p-4">Category</th><th className="p-4">Unit</th>
                    {!isCashier && (
                      <>
                        <th className="p-4">HSN/SAC</th>
                        <th className="p-4">Purchase price</th>
                      </>
                    )}
                    <th className="p-4">Selling Price</th>
                    {!isCashier && <th className="p-4 text-right">Margin</th>}
                    {!isCashier && <th className="p-4">GST</th>}
                    <th className="p-4">Stock</th>{!isCashier && <th className="p-4 sticky right-0 bg-gray-50 z-10 border-l border-gray-200 shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {displayedProducts.map((product, index) => {
                    const isSelected = !!selectedProducts[product.id];
                    const isEditing = editingId === product.id;

                    if (isEditing) {
                      return (
                        <tr key={product.id} className="border-t bg-blue-50/50">
                          <td className="p-4"><input type="checkbox" disabled className="form-checkbox opacity-50" /></td>
                          <td className="p-4">{((currentPage - 1) * itemsPerPage) + index + 1}</td>
                          <td className="p-4 text-xs text-gray-500">{formatDate(product.purchaseDate)}</td>

                          {/* Supplier Name Select (Admin Only) */}
                          {!isCashier && (
                            <>
                              <td className="p-4">
                                <span className="text-sm text-gray-700">{editForm.vendorName || '-'}</span>
                              </td>
                              <td className="p-4 font-mono text-xs text-gray-500">{editForm.vendorId}</td>
                            </>
                          )}

                          {/* Product Name */}
                          <td className="p-4">
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="border rounded p-1 w-32 text-sm"
                            />
                          </td>

                          {/* Barcode */}
                          <td className="p-4">
                            <input
                              type="text"
                              value={editForm.barcode}
                              onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                              className="border rounded p-1 w-24 text-sm font-mono"
                            />
                          </td>

                          {/* Category */}
                          <td className="p-4">
                            <select
                              value={editForm.category}
                              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                              className="border rounded p-1 w-24 text-sm"
                            >
                              {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>

                          {/* Unit */}
                          <td className="p-4">
                            <select
                              value={editForm.unit || 'Nos'}
                              onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                              className="border rounded p-1 w-20 text-sm"
                            >
                                {Array.from(new Set([...allUnits, ...globalProducts.map(p => p.unit).filter(Boolean)])).sort().map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>

                          {/* Tax Code & Purchase Rate (Admin Only) */}
                          {!isCashier && (
                            <>
                              <td className="p-4">
                                <input
                                  type="text"
                                  value={editForm.taxCode}
                                  onChange={(e) => setEditForm({ ...editForm, taxCode: e.target.value })}
                                  className="border rounded p-1 w-20 text-xs"
                                />
                              </td>

                              {/* Purchase Rate */}
                              <td className="p-4">
                                <input
                                  type="number"
                                  value={editForm.purchaseRate}
                                  onChange={(e) => setEditForm({ ...editForm, purchaseRate: e.target.value })}
                                  className="border rounded p-1 w-20 text-sm"
                                />
                              </td>
                            </>
                          )}

                          {/* Selling Price */}
                          <td className="p-4">
                            <input
                              type="number"
                              value={editForm.price}
                              onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                              className="border rounded p-1 w-20 text-sm font-semibold"
                            />
                          </td>

                          {/* Margin (Admin Only) */}
                          {!isCashier && (
                            <td className="p-4 text-right font-mono">
                              {(() => {
                                const buy = parseFloat(editForm.purchaseRate as any) || 0;
                                const sell = parseFloat(editForm.price as any) || 0;
                                const profit = sell - buy;
                                const marginPct = buy > 0 ? ((profit / buy) * 100).toFixed(1) : (sell > 0 ? '100' : '0');
                                const isPositive = profit >= 0;
                                return (
                                  <div className="flex flex-col items-end leading-tight">
                                    <span className={`text-xs font-bold ${isPositive ? 'text-emerald-700' : 'text-rose-600'}`}>
                                      {isPositive ? '+' : ''}₹{profit.toFixed(2)}
                                    </span>
                                    <span className={`text-[10px] font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-500'}`}>
                                      {isPositive ? '+' : ''}{marginPct}%
                                    </span>
                                  </div>
                                );
                              })()}
                            </td>
                          )}

                          {/* GST (Admin Only) */}
                          {!isCashier && (
                            <td className="p-4">
                              <input
                                type="number"
                                value={editForm.purchaseGst}
                                onChange={(e) => setEditForm({ ...editForm, purchaseGst: e.target.value })}
                                className="border rounded p-1 w-12 text-center text-sm"
                              />
                            </td>
                          )}

                          {/* Stock */}
                          <td className="p-4">
                            <input
                              type="number"
                              step="any"
                              value={editForm.stockQuantity}
                              onChange={(e) => setEditForm({ ...editForm, stockQuantity: e.target.value })}
                              className="border rounded p-1 w-16 text-center text-sm"
                            />
                          </td>

                          <td className="p-4 sticky right-0 bg-blue-50 z-10 border-l border-gray-200 shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">
                            <div className="flex gap-2">
                              <button onClick={handleSaveInline} disabled={isSaving} className="text-green-600 hover:text-green-800 p-1"><CheckCircle size={20} /></button>
                              <button onClick={handleCancelEdit} disabled={isSaving} className="text-red-500 hover:text-red-700 p-1"><X size={20} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={product.id} className={`group border-t transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        <td className="p-4"><input type="checkbox" checked={isSelected} onChange={() => handleSelectProduct(product.id, product)} className="form-checkbox" /></td>
                        <td className="p-4">{((currentPage - 1) * itemsPerPage) + index + 1}</td>
                        <td className="p-4">{formatDate(product.purchaseDate)}</td>
                        {!isCashier && (
                          <>
                            <td className="p-4 font-medium">{product.vendorName || '-'}</td>
                            <td className="p-4 font-mono">{product.vendorId || '-'}</td>
                          </>
                        )}
                        <td className="p-4 font-medium">{product.name}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{product.barcode}</span>
                            {isSelected && (
                              <input
                                type="number"
                                value={selectedProducts[product.id].quantity}
                                onChange={(e) => handleBarcodeQuantityChange(product.id, parseFloat(e.target.value))}
                                className="form-input w-16 text-center"
                                min="1"
                              />
                            )}
                          </div>
                        </td>
                        <td className="p-4">{product.category}</td>
                        <td className="p-4 text-xs font-mono">{product.unit || 'Nos'}</td>
                        {!isCashier && (
                          <>
                            <td className="p-4 text-xs font-mono">{product.taxCode || '-'}</td>
                            <td className="p-4">₹{product.purchaseRate.toFixed(2)}</td>
                          </>
                        )}
                        <td className="p-4 font-semibold">₹{product.price.toFixed(2)}</td>
                        {!isCashier && (
                          <td className="p-4 text-right font-mono">
                            {(() => {
                              const buy = product.purchaseRate || 0;
                              const sell = product.price || 0;
                              const profit = sell - buy;
                              const marginPct = buy > 0 ? ((profit / buy) * 100).toFixed(1) : (sell > 0 ? '100' : '0');
                              const isPositive = profit >= 0;
                              return (
                                <div className="flex flex-col items-end leading-tight">
                                  <span className={`text-xs font-bold ${isPositive ? 'text-emerald-700' : 'text-rose-600'}`}>
                                    {isPositive ? '+' : ''}₹{profit.toFixed(2)}
                                  </span>
                                  <span className={`text-[10px] font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {isPositive ? '+' : ''}{marginPct}%
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                        )}
                        {!isCashier && <td className="p-4">{product.purchaseGst}%</td>}
                        <td className="p-4 font-bold">{formatQty(product.stockQuantity)}</td>
                        {!isCashier && (
                          <td className={`p-4 sticky right-0 z-10 border-l border-gray-200 shadow-[-4px_0_10px_rgba(0,0,0,0.05)] ${isSelected ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50'}`}>
                            <div className="flex gap-3">
                              <button onClick={() => handleEditClick(product)} className="text-blue-600 hover:text-blue-800"><Pencil size={18} /></button>
                              <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>

      {isModalOpen && (<ProductFormModal product={editingProduct} categories={categories} vendors={globalVendors} onSave={handleSaveProduct} onClose={handleCloseModal} defaultGst={defaultGst} isSaving={isSaving} />)}

      {isCategoryModalOpen && (<CategoryModal categories={categories} onAddOrUpdate={handleAddOrUpdateCategory} onDeleteSuccess={refreshProducts} onClose={() => setCategoryModalOpen(false)} />)}
      {isMultiAddModalOpen && (<MultiProductFormModal vendors={globalVendors} categories={categories}          onSave={handleSaveMultipleProducts}
          products={globalProducts as any}
          onClose={() => setIsMultiAddModalOpen(false)}
 defaultGst={defaultGst} shopName={shopName} isSaving={isLoading} />)}

      {isSaving && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-8 rounded-xl shadow-2xl flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
            <p className="text-lg font-semibold text-gray-800">Processing Update...</p>
            <p className="text-sm text-gray-500 mt-2">Syncing prices with Vendor Service</p>
          </div>
        </div>
      )}

    </div>
  );
};

const ProductFormModal = ({ product, categories, vendors, onSave, onClose, defaultGst, isSaving }: { product: Product | null; categories: string[]; vendors: Vendor[]; onSave: (p: any) => void; onClose: () => void; defaultGst: number; isSaving?: boolean; }) => {
  const { products: globalProducts } = useGlobalData();
  const [formData, setFormData] = useState({
    id: product?.id || null, name: product?.name || '', category: product?.category || categories[0] || '',
    purchaseRate: product?.purchaseRate || 0, purchaseGst: product?.purchaseGst ?? defaultGst,
    profit: product?.purchaseRate ? (((product.price - (product.purchaseRate * (1 + (product.purchaseGst ?? defaultGst) / 100))) / (product.purchaseRate * (1 + (product.purchaseGst ?? defaultGst) / 100))) * 100).toFixed(2) : 0,
    price: product?.price || 0, wholesalePrice: product?.wholesaleSellingPrice || 0,
    mrp: product?.mrp || 0,
    discount: product?.discount || 0, stockQuantity: product?.stockQuantity || 0,
    vendorId: product?.vendorId || (vendors[0]?.id || ''), vendorName: product?.vendorName || (vendors[0]?.name || ''),
    barcode: product?.barcode || '',
    unit: product?.unit || UNIT_OPTIONS[0],
    taxCode: product?.taxCode || '',
    purchaseDate: product?.purchaseDate || (product?.createdAt ? product.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
    createdAt: product?.createdAt || null,
  });

  const [lastEdited, setLastEdited] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const supplierRef = useRef<HTMLSelectElement>(null);
  const purchaseRateRef = useRef<HTMLInputElement>(null);
  const profitRef = useRef<HTMLInputElement>(null);
  const sellingPriceRef = useRef<HTMLInputElement>(null);
  const wholesalePriceRef = useRef<HTMLInputElement>(null);
  const stockRef = useRef<HTMLInputElement>(null);
  const gstRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const handleEnter = (e: React.KeyboardEvent, nextRef: React.RefObject<any>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  useEffect(() => {
    const toNumber = (val: any) => parseFloat(val) || 0;
    const buying = toNumber(formData.purchaseRate);
    const gstRate = toNumber(formData.purchaseGst);
    const profitPercent = toNumber(formData.profit);
    const selling = toNumber(formData.price);

    if (!buying) {
      if (toNumber(formData.profit) !== 0) {
        setFormData(prev => ({ ...prev, profit: 0 }));
      }
      return;
    }

    const gstMultiplier = 1 + (gstRate / 100);
    const buyingWithGST = buying * gstMultiplier;

    if (lastEdited === "PURCHASE_RATE" || lastEdited === "GST") {
      // Do NOT auto-fill selling price when editing purchase rate!
      // If selling price has already been entered, update the profit percentage:
      if (selling > 0 && buyingWithGST > 0) {
        const newProfit = ((selling - buyingWithGST) / buyingWithGST) * 100;
        if (toNumber(formData.profit).toFixed(2) !== newProfit.toFixed(2)) {
          setFormData(prev => ({ ...prev, profit: parseFloat(newProfit.toFixed(2)) }));
        }
      }
    }

    if (lastEdited === "PROFIT") {
      const newSelling = buyingWithGST * (1 + profitPercent / 100);
      if (toNumber(formData.price).toFixed(2) !== newSelling.toFixed(2)) {
        setFormData(prev => ({ ...prev, price: parseFloat(newSelling.toFixed(2)) }));
      }
    }

    if (lastEdited === "SELLING") {
      const newProfit = ((selling - buyingWithGST) / buyingWithGST) * 100;
      if (toNumber(formData.profit).toFixed(2) !== newProfit.toFixed(2)) {
        setFormData(prev => ({ ...prev, profit: parseFloat(newProfit.toFixed(2)) }));
      }
    }
  }, [formData.purchaseRate, formData.purchaseGst, formData.profit, formData.price, lastEdited]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const purchaseRate = parseFloat(formData.purchaseRate as any);
    const price = parseFloat(formData.price as any);
    const stockQuantity = parseFloat(formData.stockQuantity as any);

    if (price < purchaseRate) {
      toast.error("Selling Price cannot be less than the Purchase Rate.");
      return;
    }

    if (purchaseRate <= 0) { toast.error("Purchase Rate must be greater than 0."); return; }
    if (price <= 0) { toast.error("Selling Price must be greater than 0."); return; }
    if (stockQuantity <= 0) { toast.error("Stock Quantity must be greater than 0."); return; }
    onSave(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'purchaseRate') setLastEdited("PURCHASE_RATE");
    if (name === 'purchaseGst') setLastEdited("GST");
    if (name === 'profit') setLastEdited("PROFIT");
    if (name === 'price') setLastEdited("SELLING");
  };

  const handleVendorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedVendor = vendors.find((v) => v.id === e.target.value);
    if (selectedVendor) { setFormData((prev) => ({ ...prev, vendorId: selectedVendor.id, vendorName: selectedVendor.name })); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-gray-800">{product ? 'Edit Product' : 'Add New Product'}</h2><button onClick={onClose}><X size={24} /></button></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label>Product Name</label><input ref={nameRef} name="name" type="text" value={formData.name} onChange={handleChange} onKeyDown={(e) => handleEnter(e, categoryRef)} className="form-input mt-1" required /></div>
            <div><label>Category</label><select ref={categoryRef} name="category" value={formData.category} onChange={handleChange} onKeyDown={(e) => handleEnter(e, supplierRef)} className="form-input mt-1" required>{categories.map((c) => (<option key={c} value={c}>{c}</option>))}</select></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label>Supplier Name</label><select ref={supplierRef} name="vendorId" value={formData.vendorId} onChange={handleVendorChange} onKeyDown={(e) => handleEnter(e, purchaseRateRef)} className="form-input mt-1" required><option value="" disabled>-- Select a Supplier --</option>{vendors.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}</select></div>
            <div><label>Supplier ID (Auto-filled)</label><input name="vendorId" type="text" value={formData.vendorId} className="form-input mt-1 bg-gray-100" readOnly /></div>
            <div><label>Unit</label><select name="unit" value={formData.unit} onChange={handleChange} className="form-input mt-1" required>
              {Array.from(new Set([...allUnits, ...globalProducts.map(p => p.unit).filter(Boolean)])).sort().map(u => <option key={u} value={u}>{u}</option>)}
            </select></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="flex items-center gap-1">
                Purchase Rate (₹)
                <div className="group relative">
                  <Info size={14} className="text-blue-500 cursor-help" />
                  <div className="hidden group-hover:block absolute z-50 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg -mt-12 ml-6">
                    Updating the purchase rate will automatically recalculate balances for all existing supplier credit transactions associated with this product.
                  </div>
                </div>
              </label>
              <input ref={purchaseRateRef} name="purchaseRate" type="number" value={formData.purchaseRate} onChange={handleChange} onKeyDown={(e) => handleEnter(e, profitRef)} className="form-input mt-1" />
            </div>
            <div>
              <label>Profit (%)</label>
              <input ref={profitRef} name="profit" type="number" value={formData.profit} onChange={handleChange} onKeyDown={(e) => handleEnter(e, sellingPriceRef)} className="form-input mt-1" placeholder="0.00" />
            </div>
            <div>
              <label>Selling Price (₹)</label>
              <input ref={sellingPriceRef} name="price" type="number" value={formData.price} onChange={handleChange} onKeyDown={(e) => handleEnter(e, stockRef)} className="form-input mt-1 font-semibold" />
            </div>
            <div>
              <label className="text-gray-700">Margin Amount (₹)</label>
              {(() => {
                const buy = parseFloat(formData.purchaseRate as any) || 0;
                const sell = parseFloat(formData.price as any) || 0;
                const profit = sell - buy;
                const isPositive = profit >= 0;
                const hasValues = buy > 0 || sell > 0;
                return (
                  <div className={`mt-1 h-[42px] px-3 rounded-lg border flex items-center justify-between font-mono font-bold text-sm ${
                    !hasValues
                      ? 'bg-gray-50 border-gray-200 text-gray-400'
                      : isPositive
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-rose-50 border-rose-300 text-rose-800'
                  }`}>
                    <span className="text-xs uppercase tracking-wide opacity-80">Margin:</span>
                    <span>{!hasValues ? '₹0.00' : `${isPositive ? '+' : ''}₹${profit.toFixed(2)}`}</span>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label>Stock Quantity</label><input ref={stockRef} name="stockQuantity" type="number" step="any" value={formData.stockQuantity} onChange={handleChange} onKeyDown={(e) => handleEnter(e, gstRef)} className="form-input mt-1" /></div>
            <div><label>Purchase GST (%)</label><input ref={gstRef} name="purchaseGst" type="number" value={formData.purchaseGst} onChange={handleChange} onKeyDown={(e) => handleEnter(e, discountRef)} className="form-input mt-1" /></div>
            <div><label>Discount (%)</label><input ref={discountRef} name="discount" type="number" value={formData.discount} onChange={handleChange} onKeyDown={(e) => handleEnter(e, barcodeRef)} className="form-input mt-1" /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label>Date</label><input name="purchaseDate" type="date" value={formData.purchaseDate} onChange={handleChange} className="form-input mt-1" /></div>
            <div><label>Barcode</label><input ref={barcodeRef} name="barcode" type="text" value={formData.barcode} onChange={handleChange} className="form-input mt-1" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label>HSN/SAC Code</label><input name="taxCode" type="text" value={formData.taxCode} onChange={handleChange} className="form-input mt-1" /></div>
          </div>
          {formData.barcode && (<div className="p-4 bg-gray-50 rounded-md flex justify-center"><Barcode value={formData.barcode} height={50} /></div>)}
          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} disabled={isSaving} className="px-5 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {isSaving ? "Saving..." : "Save Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

function CategoryModal({ categories, onAddOrUpdate, onDeleteSuccess, onClose }: { categories: string[]; onAddOrUpdate: (oldCat: string | null, newCat: string) => Promise<void>; onDeleteSuccess: () => Promise<void>; onClose: () => void; }) {
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [updatedCategory, setUpdatedCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input immediately when modal opens
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    setIsSaving(true);
    try {
      await onAddOrUpdate(null, newCategory.trim());
      setNewCategory('');
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (e) {
      // Handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatedCategory.trim() || !editingCategory) return;
    setIsSaving(true);
    try {
      await onAddOrUpdate(editingCategory, updatedCategory.trim());
      setEditingCategory(null);
      setUpdatedCategory('');
    } catch (e) {
      // Handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (categoryName: string) => {
    // Removed window.confirm as per user request
    setIsSaving(true);
    try {
      const res = await productApi.getCategories();
      const categoryObj = res.data.find((c: any) => (c.name === categoryName || c === categoryName));

      if (categoryObj && categoryObj.id) {
        await productApi.deleteCategory(categoryObj.id);
        toast.success("Category deleted");
        await onDeleteSuccess(); // Refresh categories in parent instead of reload
      } else {
        toast.error("Category ID not found.");
      }
    } catch (err: any) {
      toast.error("Failed to delete category");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-gray-800">Manage Categories</h2><button onClick={onClose}><X size={24} /></button></div>

        <form onSubmit={handleAdd} className="flex gap-2 mb-6">
          <input ref={inputRef} type="text" placeholder="New Category Name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="form-input flex-grow" disabled={isSaving} />
          <button type="submit" disabled={isSaving || !newCategory.trim()} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {isSaving ? "..." : <PlusCircle size={20} />}
          </button>
        </form>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {categories.map((cat) => (
            <div key={cat} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg group">
              {editingCategory === cat ? (
                <form onSubmit={handleUpdate} className="flex gap-2 flex-grow">
                  <input type="text" value={updatedCategory} onChange={(e) => setUpdatedCategory(e.target.value)} className="form-input flex-grow py-1" autoFocus disabled={isSaving} />
                  <button type="submit" disabled={isSaving} className="text-green-600 hover:text-green-800 p-1"><CheckCircle size={18} /></button>
                  <button type="button" onClick={() => setEditingCategory(null)} disabled={isSaving} className="text-red-500 hover:text-red-700 p-1"><X size={18} /></button>
                </form>
              ) : (
                <>
                  <span className="font-medium text-gray-700">{cat}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingCategory(cat); setUpdatedCategory(cat); }} disabled={isSaving} className="text-blue-600 hover:text-blue-800 p-1"><Pencil size={16} /></button>
                    <button onClick={() => handleDelete(cat)} disabled={isSaving} className="text-red-600 hover:text-red-800 p-1"><Trash2 size={16} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Products;