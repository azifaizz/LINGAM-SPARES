import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Layers, X, CreditCard, Trash2, PlusCircle, Printer, Save, Upload, Edit2, Check, Clock } from 'lucide-react';
import { CreditTransaction, Vendor, vendorApi, UNIT_OPTIONS } from '@/lib/api';
import { useCustomUnits } from '@/utils/unitManager';
import JsBarcode from 'jsbarcode';
import SupplierCreditPanel from './SupplierCreditPanel';
import PurchaseHistoryModal from './PurchaseHistoryModal';
import { parseExcelFile } from '@/utils/excelParser';
import { generateSixDigitId } from '@/lib/utils';

// Data Structures
interface ProductRow {
    id: string;
    name: string;
    unit: string;
    category: string;
    purchaseRate: number;
    price: number;
    wholesalePrice: number;
    stockQuantity: number;
    barcode: string;
    discount: number;
    taxCode: string;
    gst?: number;
    purchaseGst?: number;
}

interface MultiProductFormModalProps {
    vendors: Vendor[];
    categories: string[];
    onSave: (products: any[], creditData?: Partial<CreditTransaction>) => void;
    onClose: () => void;
    defaultGst: number;
    isSaving?: boolean;
    shopName: string;
    products: ProductRow[];
}

const MultiProductFormModal = ({ vendors, categories, products, onSave, onClose, defaultGst, shopName, isSaving }: MultiProductFormModalProps) => {
    const [selectedVendorId, setSelectedVendorId] = useState<string>(vendors[0]?.id || '');
    const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
    const [billNumber, setBillNumber] = useState('');

    // Cart State
    const [addedProducts, setAddedProducts] = useState<ProductRow[]>([]);

    // State to track if products have been saved
    const [isProductsSaved, setIsProductsSaved] = useState(false);

    // Selection state for printing
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

    // State to track if credit transaction has been saved in the panel
    const [isCreditSaved, setIsCreditSaved] = useState(false);
    const [creditTransactionId, setCreditTransactionId] = useState<string | undefined>(undefined);

    // Input Row State
    const getDefaultInput = (): ProductRow => ({
        id: generateSixDigitId(),
        name: '',
        unit: '',
        category: categories[0] || '',
        purchaseRate: 0,
        price: 0,
        wholesalePrice: 0,
        stockQuantity: 1,
        barcode: '',
        discount: 0,
        taxCode: '',
        gst: defaultGst,
    });
    const [currentInput, setCurrentInput] = useState<ProductRow>(getDefaultInput());

    // Searchable Supplier State
    const [supplierSearchQuery, setSupplierSearchQuery] = useState(vendors.find(v => v.id === selectedVendorId)?.name || '');
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
    const [highlightedSupplierIndex, setHighlightedSupplierIndex] = useState(-1);
    const supplierInputRef = useRef<HTMLInputElement>(null);

    // Searchable Category State
    const [categorySearchQuery, setCategorySearchQuery] = useState(currentInput.category);
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const [highlightedCategoryIndex, setHighlightedCategoryIndex] = useState(-1);
    // Searchable Unit State
    const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
    const [highlightedUnitIndex, setHighlightedUnitIndex] = useState(-1);
    const { allUnits: customAndDefaultUnits } = useCustomUnits();
    const unitSuggestions = React.useMemo(() => {
        const existing = products.map(p => p.unit).filter(Boolean);
        const inCart = addedProducts.map(p => p.unit).filter(Boolean);
        return Array.from(new Set([...customAndDefaultUnits, ...existing, ...inCart]));
    }, [customAndDefaultUnits, products, addedProducts]);
    
    // Searchable Product State
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const [highlightedProductIndex, setHighlightedProductIndex] = useState(-1);
    const productDropdownRef = useRef<HTMLDivElement>(null);
    const unitDropdownRef = useRef<HTMLDivElement>(null);
    const unitItemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    useEffect(() => {
        if (isUnitDropdownOpen && highlightedUnitIndex >= 0) {
            const el = unitItemRefs.current.get(highlightedUnitIndex);
            if (el) {
                el.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [highlightedUnitIndex, isUnitDropdownOpen]);

    const [isCreditPanelOpen, setIsCreditPanelOpen] = useState(true);
    const [addToCredit, setAddToCredit] = useState(true);
    const [paymentMode, setPaymentMode] = useState<'CREDIT' | 'CASH' | 'ONLINE' | 'CHEQUE'>('CREDIT');
    const [localSaving, setLocalSaving] = useState(false);
    const formatQty = (value: any) => {
        const num = Number(value);
        if (isNaN(num)) return value;
        return num.toString();
    };
    const autoCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Edit Quantity State
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editQuantity, setEditQuantity] = useState<number>(1);

    // Purchase History Modal State
    const [isPurchaseHistoryOpen, setIsPurchaseHistoryOpen] = useState(false);
    const [purchaseHistoryProductId, setPurchaseHistoryProductId] = useState<string | undefined>(undefined);
    const [purchaseHistoryProductName, setPurchaseHistoryProductName] = useState<string>('');

    // --- PRICING ASSISTANT (REFACTORED) ---
    // baseBuy is internal-only.
    // buyAfterGst is what the user sees in "Buy" and what is saved as purchaseRate.
    const [baseBuy, setBaseBuy] = useState<number>(0);
    const [gstPercent, setGstPercent] = useState<number | "">("");
    const [profitPercent, setProfitPercent] = useState<number | "">("");

    const [buyAfterGst, setBuyAfterGst] = useState<number | "">("");
    // sellingPrice is calculated from buyAfterGst + profit
    const [calculatedSellingPrice, setCalculatedSellingPrice] = useState<number>(0);

    // Flag for manual selling price override
    const [isSellingManual, setIsSellingManual] = useState(false);
    const [lastEdited, setLastEdited] = useState<string | null>(null);

    // Helper: Round to 2 decimal places
    const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

    const handleAutoSelect = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    const handleClickSelect = (e: React.MouseEvent<HTMLInputElement>) => {
        (e.target as HTMLInputElement).select();
    };

    // Core Recalculation Effect
    useEffect(() => {
        const toNumber = (val: any) => parseFloat(val) || 0;

        const buying = toNumber(buyAfterGst);
        const gstRate = toNumber(gstPercent);
        const profitP = toNumber(profitPercent);
        const selling = toNumber(calculatedSellingPrice);

        // Skip recalculation when loading from database - values are already correct
        if (lastEdited === "DATABASE") return;

        if (!buying) {
            if (profitPercent !== 0 && profitPercent !== "") {
                setProfitPercent(0);
            }
            return;
        }

        // BuyAfterGst IS already GST inclusive in this UI's logic
        // But the user's rule 4 says: "Changing GST updates both Buying (if GST-inclusive) and Selling"
        // Wait, in this UI, buyAfterGst is what the user enters.
        // If they change GST, what should happen to buyAfterGst?
        // Usually, Buying (Excl. GST) stays same, so Buy (Incl. GST) changes?
        // Or Buy (Incl. GST) stays same, so Buying (Excl. GST) changes?
        // Let's stick to the user's provided logic which treats "buying" as the BASE.

        const gstMultiplier = 1 + (gstRate / 100);
        // In THIS component's original logic: baseBuy is the EXCL GST price.
        // User's "buying" in prompt matches "baseBuy" or "buyingAmount"?
        // Prompt says: "Buying + GST -> updates Selling & Profit".
        // Let's assume "Buying" in prompt is the Base price (Excl. GST).

        const buyingExclGst = baseBuy;
        const currentBuyInclGst = buyingExclGst * gstMultiplier;

        if (lastEdited === "BUYING" || lastEdited === "GST") {
            // Update the visible Buy (Incl. GST)
            if (toNumber(buyAfterGst).toFixed(2) !== currentBuyInclGst.toFixed(2)) {
                setBuyAfterGst(parseFloat(currentBuyInclGst.toFixed(2)));
                handleInputChange('purchaseRate', parseFloat(currentBuyInclGst.toFixed(2)));
            }

            // DO NOT auto-fill selling price when entering or changing buying rate!
            // If selling price has already been entered, update the profit % based on the new buy rate:
            if (selling > 0 && currentBuyInclGst > 0) {
                const newProfit = ((selling - currentBuyInclGst) / currentBuyInclGst) * 100;
                if (toNumber(profitPercent).toFixed(2) !== newProfit.toFixed(2)) {
                    setProfitPercent(parseFloat(newProfit.toFixed(2)));
                }
            }
        }

        if (lastEdited === "PROFIT") {
            const newSelling = currentBuyInclGst * (1 + profitP / 100);
            if (selling.toFixed(2) !== newSelling.toFixed(2)) {
                setCalculatedSellingPrice(parseFloat(newSelling.toFixed(2)));
                handleInputChange('price', parseFloat(newSelling.toFixed(2)));
            }
        }

        if (lastEdited === "SELLING") {
            if (currentBuyInclGst > 0) {
                const newProfit = ((selling - currentBuyInclGst) / currentBuyInclGst) * 100;
                if (toNumber(profitPercent).toFixed(2) !== newProfit.toFixed(2)) {
                    setProfitPercent(parseFloat(newProfit.toFixed(2)));
                }
            }
        }

        handleInputChange('gst', gstRate);
    }, [baseBuy, gstPercent, profitPercent, calculatedSellingPrice, lastEdited]);

    // Handlers
    const handleBuyChange = (valStr: string) => {
        if (valStr === "") {
            setBuyAfterGst("");
            setBaseBuy(0);
            setLastEdited("BUYING");
            return;
        }

        const entered = parseFloat(valStr);
        if (isNaN(entered)) return;

        setBuyAfterGst(entered);
        setLastEdited("BUYING");

        // Reverse Calculate Base: Base = BuyAfterGST / (1 + GST/100)
        const gstVal = typeof gstPercent === 'number' ? gstPercent : 0;
        const calculatedBase = entered / (1 + (gstVal / 100));
        setBaseBuy(calculatedBase);
    };

    const handleGstChange = (valStr: string) => {
        const entered = valStr === "" ? "" : parseFloat(valStr);
        setGstPercent(entered as any);
        setLastEdited("GST");
    };

    const handleProfitChange = (valStr: string) => {
        const entered = valStr === "" ? "" : parseFloat(valStr);
        setProfitPercent(entered as any);
        setLastEdited("PROFIT");
    };

    const handleSellingChange = (valStr: string) => {
        setIsSellingManual(true);
        const entered = parseFloat(valStr);
        const safe = isNaN(entered) ? 0 : entered;
        setCalculatedSellingPrice(safe);
        setLastEdited("SELLING");
        handleInputChange('price', safe);
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        // Initial focus
        setTimeout(() => supplierInputRef.current?.focus(), 100);
        return () => {
            if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
        };
    }, []);

    // Captured state from SupplierCreditPanel
    const [creditFormDetails, setCreditFormDetails] = useState<Partial<CreditTransaction>>({});

    // Focus Ref
    const nameInputRef = useRef<HTMLInputElement>(null);
    const categoryInputRef = useRef<HTMLInputElement>(null);
    const unitInputRef = useRef<HTMLInputElement>(null);
    const hsnInputRef = useRef<HTMLInputElement>(null);
    const purchaseInputRef = useRef<HTMLInputElement>(null); // Buy
    const gstInputRef = useRef<HTMLInputElement>(null);
    const profitInputRef = useRef<HTMLInputElement>(null);
    const priceInputRef = useRef<HTMLInputElement>(null); // Sell
    const wholesalePriceInputRef = useRef<HTMLInputElement>(null); // Wholesale
    const qtyInputRef = useRef<HTMLInputElement>(null); // Qty

    const billNumberInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Smart Navigation Handler
    const focusNext = (current: string) => {
        switch (current) {
            case "supplier": billNumberInputRef.current?.focus(); break;
            case "billNo": nameInputRef.current?.focus(); break;
            case "name": categoryInputRef.current?.focus(); break;
            case "category": unitInputRef.current?.focus(); break;
            case "unit": hsnInputRef.current?.focus(); break;
            case "hsn": purchaseInputRef.current?.focus(); break;
            case "buy": gstInputRef.current?.focus(); break;
            case "gst": priceInputRef.current?.focus(); break;
            case "selling": profitInputRef.current?.focus(); break;
            case "profit": qtyInputRef.current?.focus(); break;
            case "qty": handleAddProduct(); break;
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const data = await parseExcelFile(file);
            if (!data || data.length === 0) {
                toast.error("Excel file is empty.");
                return;
            }

            const newProducts: ProductRow[] = data.map((row: any) => {
                // lenient column aliases
                const name = row['Product Name'] || row['Name'] || row['Item Name'] || row['name'] || '';
                const unit = row['Unit'] || row['UOM'] || row['unit'] || '';
                const category = row['Category'] || row['Type'] || row['category'] || categories[0] || '';

                // Parse numbers strictly or default to 0
                const rawPurchase = row['Purchase Rate'] || row['Cost'] || row['Buy Rate'] || row['purchaseRate'];
                const purchaseRate = parseFloat(rawPurchase) || 0;

                const rawPrice = row['Selling Price'] || row['Price'] || row['Rate'] || row['price'];
                const price = parseFloat(rawPrice) || 0;

                const rawQty = row['Stock Quantity'] || row['Quantity'] || row['Qty'] || row['stockQuantity'];
                const stockQuantity = parseFloat(rawQty) || 1;

                const rawDiscount = row['Discount'] || row['Disc'] || row['discount'];
                const discount = parseFloat(rawDiscount) || 0;

                const rawBarcode = row['Barcode'] || row['Product ID'] || row['barcode'] || row['id'];
                const barcode = rawBarcode ? String(rawBarcode).trim() : generateSixDigitId();

                const rawWholesale = row['Wholesale Price'] || row['Wholesale'] || row['wholesalePrice'];
                const wholesalePrice = parseFloat(rawWholesale) || price; // Default to retail price if wholesale not provided

                return {
                    id: barcode || generateSixDigitId(),
                    name: String(name).trim(),
                    unit: String(unit).trim(),
                    category: String(category).trim(),
                    purchaseRate,
                    price,
                    wholesalePrice,
                    stockQuantity,
                    barcode,
                    discount,
                    taxCode: String(row['HSN/SAC'] || row['taxCode'] || '').trim(),
                };
            }).filter(p => p.name); // Filter out empty rows

            setAddedProducts(prev => {
                if (isCreditSaved) {
                    setIsCreditSaved(false);
                    setCreditTransactionId(undefined);
                }
                const combined = [...newProducts, ...prev];
                // Auto-select new imports
                const ids = new Set(selectedProductIds);
                newProducts.forEach(p => ids.add(p.id));
                setSelectedProductIds(ids);
                return combined;
            });

            toast.success(`Imported ${newProducts.length} products.`);
            if (fileInputRef.current) fileInputRef.current.value = '';

        } catch (error) {
            console.error("Excel Import Failed:", error);
            toast.error("Failed to parse Excel file.");
        }
    };

    const handleInputChange = (field: keyof ProductRow, value: string | number) => {
        setCurrentInput(prev => ({ ...prev, [field]: value }));
    };

    const handleSelectVendor = (vendor: Vendor) => {
        setSelectedVendorId(vendor.id);
        setSupplierSearchQuery(vendor.name);
        setIsSupplierDropdownOpen(false);
        setHighlightedSupplierIndex(0);
        setTimeout(() => billNumberInputRef.current?.focus(), 50);
    };

    const handleSelectCategory = (category: string) => {
        setCategorySearchQuery(category);
        handleInputChange('category', category);
        setIsCategoryDropdownOpen(false);
        setHighlightedCategoryIndex(0);
        setTimeout(() => unitInputRef.current?.focus(), 50);
    };

    const handleSelectUnit = (unit: string) => {
        handleInputChange('unit', unit);
        setIsUnitDropdownOpen(false);
        setHighlightedUnitIndex(0);
        setTimeout(() => hsnInputRef.current?.focus(), 50);
    };

    const handleAddProduct = (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!currentInput.name.trim()) {
            toast.error("Please enter a product name");
            return;
        }
        if (currentInput.purchaseRate <= 0 || currentInput.price <= 0 || currentInput.stockQuantity <= 0) {
            toast.error("Please ensure Price, Rate, and Quantity are valid (> 0).");
            return;
        }
        if (currentInput.price < currentInput.purchaseRate) {
            toast.error("Selling Price cannot be less than Buy Rate.");
            return;
        }

        const newId = currentInput.barcode || generateSixDigitId();
        const newProduct = {
            ...currentInput,
            id: newId,
            barcode: currentInput.barcode || newId,
            wholesaleSellingPrice: currentInput.wholesalePrice, // Map for backend
        };

        // Check for duplicate in added list
        setAddedProducts(prev => {
            const duplicateIndex = prev.findIndex(p => 
                (p.barcode && p.barcode === newProduct.barcode) || 
                (p.name.toLowerCase() === newProduct.name.toLowerCase() && p.category === newProduct.category)
            );

            if (duplicateIndex !== -1) {
                const updated = [...prev];
                updated[duplicateIndex] = {
                    ...updated[duplicateIndex],
                    stockQuantity: updated[duplicateIndex].stockQuantity + newProduct.stockQuantity
                };
                toast.success(`Updated quantity for ${newProduct.name}`);
                return updated;
            }

            // Reset credit saved status if products change, as amount mismatches
            if (isCreditSaved) {
                setIsCreditSaved(false);
                setCreditTransactionId(undefined);
            }
            return [newProduct, ...prev];
        });

        // Auto-select the newly added product (if new)
        setSelectedProductIds(prev => new Set(prev).add(newProduct.id));

        const defaultInput = getDefaultInput();
        setCurrentInput(defaultInput);
        // Reset Assistant State
        setBaseBuy(0);
        setGstPercent("");
        setProfitPercent("");
        setBuyAfterGst("");
        setCalculatedSellingPrice(0);
        setIsSellingManual(false);

        setCategorySearchQuery(defaultInput.category);

        // Keep focus for rapid entry - reset to Search field as per requirement 7
        setTimeout(() => nameInputRef.current?.focus(), 50);
    };

    const handleSelectProduct = (product: ProductRow) => {
        setIsProductDropdownOpen(false);
        
        const gst = product.gst || product.purchaseGst || 0;
        const buyRate = product.purchaseRate;
        const sellRate = product.price;
        const wholeRate = product.wholesalePrice || product.price;

        // Calculate Profit % from database values
        const profit = buyRate > 0 ? ((sellRate - buyRate) / buyRate) * 100 : 0;

        // Calculate base buy (excl GST)
        const calculatedBase = gst > 0 ? buyRate / (1 + (gst / 100)) : buyRate;

        // Set ALL pricing assistant states FIRST to prevent useEffect overwrite
        setBaseBuy(calculatedBase);
        setBuyAfterGst(buyRate);
        setGstPercent(gst);
        setProfitPercent(parseFloat(profit.toFixed(2)));
        setCalculatedSellingPrice(sellRate);
        setIsSellingManual(true);
        setLastEdited("DATABASE");

        // Auto populate all fields from database
        setCurrentInput(prev => ({
            ...prev,
            name: product.name,
            category: product.category,
            purchaseRate: buyRate,
            price: sellRate,
            wholesalePrice: wholeRate,
            barcode: product.barcode,
            taxCode: product.taxCode || '',
            gst: gst,
            unit: product.unit || 'Nos',
            stockQuantity: 1, 
        }));
        
        setCategorySearchQuery(product.category);

        // move focus to next field after selection (Category) as per flow requirements
        setTimeout(() => categoryInputRef.current?.focus(), 50);
    };

    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(currentInput.name);
        }, 300);
        return () => clearTimeout(timer);
    }, [currentInput.name]);

    const filteredSuggestions = products.filter(p => {
        const query = debouncedSearch.toLowerCase();
        if (!query) return false;
        return p.name.toLowerCase().includes(query) || (p.barcode && p.barcode.toLowerCase().includes(query));
    }).slice(0, 10);

    const handleProductKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && (!isProductDropdownOpen || filteredSuggestions.length === 0)) {
            e.preventDefault();
            focusNext('name');
            return;
        }

        if (!isProductDropdownOpen || filteredSuggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedProductIndex(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedProductIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            // Requirement 3: "Enter should select the first result immediately" if no highlight, or select highlighted
            const idx = highlightedProductIndex >= 0 ? highlightedProductIndex : 0;
            const selected = filteredSuggestions[idx];
            if (selected) handleSelectProduct(selected);
        } else if (e.key === 'Escape') {
            setIsProductDropdownOpen(false);
        }
    };

    const handleRemoveProduct = (index: number) => {
        setAddedProducts(prev => {
            const productToRemove = prev[index];
            if (productToRemove) {
                setSelectedProductIds(oldSet => {
                    const newSet = new Set(oldSet);
                    newSet.delete(productToRemove.id);
                    return newSet;
                });
            }

            if (isCreditSaved) {
                setIsCreditSaved(false);
                setCreditTransactionId(undefined);
            }
            return prev.filter((_, i) => i !== index)
        });
    };

    const handleInlineQuantityChange = (index: number, val: string) => {
        const newQty = parseFloat(val) || 0;
        
        setAddedProducts(prev => {
            const newProducts = [...prev];
            newProducts[index] = {
                ...newProducts[index],
                stockQuantity: newQty
            };

            // Trigger recalculation in credit if needed
            if (isCreditSaved) {
                setIsCreditSaved(false);
                setCreditTransactionId(undefined);
            }

            return newProducts;
        });
    };

    const toggleProductSelection = (id: string) => {
        setSelectedProductIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedProductIds.size === addedProducts.length && addedProducts.length > 0) {
            setSelectedProductIds(new Set());
        } else {
            setSelectedProductIds(new Set(addedProducts.map(p => p.id)));
        }
    };

    const currentInputPurchase = (currentInput.name && currentInput.purchaseRate && currentInput.stockQuantity)
        ? (currentInput.purchaseRate * currentInput.stockQuantity)
        : 0;
    const totalPurchaseValue = addedProducts.reduce((acc, row) => acc + (row.purchaseRate * row.stockQuantity), 0) + currentInputPurchase;

    const currentInputSelling = (currentInput.name && currentInput.price && currentInput.stockQuantity)
        ? (currentInput.price * currentInput.stockQuantity)
        : 0;
    const totalSellingValue = addedProducts.reduce((acc, row) => acc + (row.price * row.stockQuantity), 0) + currentInputSelling;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving || localSaving) return;

        const selectedVendor = vendors.find(v => v.id === selectedVendorId);
        if (!selectedVendor) {
            toast.error("Please select a valid supplier.");
            return;
        }

        // Include current input if entered but not explicitly added
        let productsToProcess = [...addedProducts];
        if (currentInput.name.trim()) {
            if (currentInput.purchaseRate <= 0 || currentInput.price <= 0 || currentInput.stockQuantity <= 0) {
                return;
            }
            if (currentInput.price < currentInput.purchaseRate) {
                toast.error("Selling Price cannot be less than Buy Rate.");
                return;
            }
            const newId = currentInput.barcode || generateSixDigitId();
            const newProduct = {
                ...currentInput,
                id: newId,
                barcode: currentInput.barcode || newId,
            };
            // Add to top of list for processing
            productsToProcess = [newProduct, ...productsToProcess];
        }

        if (productsToProcess.length === 0) {
            toast.error("No products added to save.");
            return;
        }



        setLocalSaving(true);
        try {
            let finalTransactionId = creditTransactionId;

            if (addToCredit && !finalTransactionId) {
                // Re-calculate totals based on productsToProcess
                const currentPurchaseValue = productsToProcess.reduce((acc, row) => acc + (row.purchaseRate * row.stockQuantity), 0);

                const txAmount = currentPurchaseValue;

                // Use values from the Credit Panel if open, otherwise default to full credit
                let txPaidAmount = 0;
                let finalPaymentMode = paymentMode;

                if (isCreditPanelOpen) {
                    txPaidAmount = creditFormDetails.paidAmount || 0;
                    if (creditFormDetails.paymentMode) {
                        finalPaymentMode = creditFormDetails.paymentMode as any;
                    }
                } else {
                    const isCredit = paymentMode === 'CREDIT';
                    txPaidAmount = isCredit ? 0 : txAmount;
                }

                const txBalance = txAmount - txPaidAmount;

                try {
                    const creditPayload: CreditTransaction = {
                        vendorId: selectedVendor.id,
                        invoice: billNumber,
                        amount: txAmount,
                        paidAmount: txPaidAmount,
                        balance: txBalance,
                        paymentMode: finalPaymentMode,
                        status: txBalance > 0 ? 'PENDING' : 'PAID',
                        description: creditFormDetails.description?.trim()
                            ? creditFormDetails.description.trim()
                            : `Purchase of ${productsToProcess.length} items`,
                        date: billDate,
                        createdAt: new Date().toISOString(),
                        products: productsToProcess.map(p => ({
                            ...p,
                            id: p.id,
                            vendorId: selectedVendor.id,
                            vendorName: selectedVendor.name,
                            price: p.price,
                            sellingPrice: p.price,
                            purchaseGst: 0,
                            purchaseDate: billDate,
                        })) as any,
                    };
                    const res = await vendorApi.addCredit(creditPayload);
                    if (res.data && (res.data as any).id) {
                        finalTransactionId = (res.data as any).id;
                        handleCreditSuccess(finalTransactionId);
                    }
                } catch (err) {
                    console.error("Failed to auto-create credit transaction", err);
                    toast.error("Failed to record credit transaction. Products will NOT be saved.");
                    setLocalSaving(false);
                    return;
                }
            }

            const productsPayload = productsToProcess.map((row) => ({
                ...row,
                vendorId: selectedVendor.id,
                vendorName: selectedVendor.name,
                purchaseGst: row.gst ?? defaultGst, // Use product's GST
                discount: row.discount || 0,
                mrp: 0,
                purchaseDate: billDate,
                updatedAt: new Date().toISOString(),
                creditTransactionId: finalTransactionId,
                taxCode: row.taxCode,
            }));

            onSave(productsPayload, undefined);
            // We do NOT set localSaving(false) here, as parent will likely unmount or set isSaving=true.
            // If the operation fails in parent, parent should handle UI feedback.
            setIsProductsSaved(false); // Reset to allow more adds
            // Clear all
            setAddedProducts([]);
            setCurrentInput(getDefaultInput());
            setBillNumber('');
            // Optional: toast to indicate it's ready for next batch?
            toast.success("Saved! Ready for next batch.", { duration: 2500 });
        } catch (error) {
            console.error("Error in handleSubmit", error);
            setLocalSaving(false);
        } finally {
            // If parent doesn't unmount, we should eventually reset. 
            // But we want to keep it disabled while parent saves.
            // Rely on isSaving prop for long running parent save.
            // But if parent save is fast/synchronous in triggering isSaving, we are good.
            // If we want to be safe in case of error:
            setTimeout(() => setLocalSaving(false), 2000);
        }
    };

    // Derived values 
    const productsToSave = addedProducts;

    const selectedVendor = vendors.find(v => v.id === selectedVendorId);

    const handleCreditSuccess = (txId?: string) => {
        setIsCreditSaved(true);
        if (txId) setCreditTransactionId(txId);
    };

    const handlePrintBarcodes = () => {
        // Collect all potential products: added ones AND current valid input
        let potentialProducts = [...addedProducts];

        // Temporarily include current input if it looks valid
        if (currentInput.name.trim() && (currentInput.barcode || currentInput.id)) {
            const tempInput = {
                ...currentInput,
                id: currentInput.barcode || currentInput.id || generateSixDigitId(),
                barcode: currentInput.barcode || currentInput.id || generateSixDigitId()
            };
            potentialProducts = [tempInput, ...potentialProducts];
        }

        const productsToPrint = potentialProducts.filter(p => !isProductsSaved ? true : selectedProductIds.has(p.id));

        // Fallback: if nothing selected, try to print everything if no specific selection logic required
        // But better to enforce selection if products exist.
        // For smoother UX: If user just typed a product and wants to print, we print that. 
        if (potentialProducts.length === 0) {
            toast.error("No products to print.");
            return;
        }

        if (productsToPrint.length === 0) {
            toast.error("Please select at least one product to print barcodes.");
            return;
        }

        const stickers: string[] = [];
        for (const row of productsToPrint) {
            const qty = row.stockQuantity || 0;
            if (!row.barcode) continue;
            for (let i = 0; i < qty; i++) {
                stickers.push(`
            <div class="label">
              <div class="shop">${shopName}</div>
              <svg class="code" data-value="${row.barcode}"></svg>
              <div class="product-name">${row.name}</div>
              <div class="product-id">${row.id}</div>
              <div class="price">₹${Number(row.price).toFixed(2)}</div>
            </div>`);
            }
        }
        if (stickers.length === 0) return;
        const printWin = window.open('', '_blank', 'width=800,height=600');
        if (!printWin) { toast.error('Pop-up blocked!'); return; }
        printWin.document.write(`<!DOCTYPE html><html><head><title>Print</title><style>
        @page { size: auto; margin: 0; }
        body { margin: 0; padding: 4mm 2mm; display: grid; grid-template-columns: repeat(3, 55mm); grid-auto-rows: min-content; justify-content: center; column-gap: 3mm; row-gap: 6mm; font-family: Arial; }
        .label { width: 55mm; height: 28mm; padding: 1mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; box-sizing: border-box; overflow: hidden; }
        .shop { font-size: 8pt; font-weight: bold; margin-bottom: 0.5mm; }
        .code { width: 45mm; height: 8mm; margin: 0 auto; }
        .product-name { font-size: 9pt; font-weight: bold; margin-top: 1mm; line-height: 1.1; max-height: 2.2em; overflow: hidden; }
        .product-id { font-size: 7pt; margin-top: 0.5mm; }
        .price { font-size: 14pt; font-weight: bold; margin-top: 1mm; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style></head><body>${stickers.join('')}</body></html>`);
        printWin.document.close();
        printWin.onload = () => {
            const svgs = printWin.document.querySelectorAll(".code");
            svgs.forEach((svg: any) => { if (svg.dataset.value) JsBarcode(svg, svg.dataset.value, { format: "CODE128", width: 1.5, height: 35, displayValue: false, margin: 0 }); });
            setTimeout(() => printWin.print(), 500);
        };
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
            <div className={`bg-white rounded-lg shadow-xl p-4 sm:p-5 w-full h-[90vh] max-h-[90vh] flex flex-col overflow-hidden transition-all duration-300 ${isCreditPanelOpen ? 'max-w-[95vw]' : 'max-w-6xl'}`}>
                <div className="flex justify-between items-center mb-3 border-b pb-3 shrink-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Layers className="text-blue-600" />
                        Add Multiple Products
                    </h2>
                    <div className="flex gap-2">
                        {!isCreditPanelOpen && (
                            <button
                                type="button"
                                onClick={() => setIsCreditPanelOpen(true)}
                                className="p-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-full transition-colors flex items-center gap-2 px-3"
                                title="Open Supplier Credit Panel"
                            >
                                <CreditCard size={18} />
                                <span className="text-sm font-semibold">Supplier Credit</span>
                            </button>
                        )}
                        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-full transition-colors flex items-center gap-2 px-3"
                            title="Import Excel"
                        >
                            <Upload size={18} />
                            <span className="text-sm font-semibold">Import Excel</span>
                        </button>
                        <button
                            onClick={() => {
                                const firstProduct = addedProducts[0];
                                if (firstProduct) {
                                    setPurchaseHistoryProductId(firstProduct.id);
                                    setPurchaseHistoryProductName(firstProduct.name);
                                } else {
                                    setPurchaseHistoryProductId(undefined);
                                    setPurchaseHistoryProductName('');
                                }
                                setIsPurchaseHistoryOpen(true);
                            }}
                            className="p-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-full transition-colors flex items-center gap-2 px-3"
                            title="View Purchase History"
                        >
                            <Clock size={18} />
                            <span className="text-sm font-semibold">History</span>
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={24} /></button>
                    </div>
                </div>

                <div className="flex flex-row gap-6 flex-1 min-h-0 overflow-hidden">
                    {/* LEFT SIDE: PRODUCT FORM */}
                    <div className={`flex flex-col flex-1 min-h-0 overflow-hidden transition-all duration-300 ${isCreditPanelOpen ? 'w-2/3' : 'w-full'}`}>
                        <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0 overflow-hidden">
                            {/* Supplier & Header Info */}
                            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl mb-3 flex items-center justify-between shadow-sm flex-wrap gap-3">

                                <div className="flex flex-col w-1/4 min-w-[200px] relative">
                                    <label className="text-xs font-semibold text-gray-600 mb-1">Select Supplier</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-grow">
                                            <input
                                                ref={supplierInputRef}
                                                type="text"
                                                value={supplierSearchQuery}
                                                onChange={(e) => {
                                                    setSupplierSearchQuery(e.target.value);
                                                    setIsSupplierDropdownOpen(true);
                                                    setHighlightedSupplierIndex(0);
                                                }}
                                                onBlur={() => setTimeout(() => setIsSupplierDropdownOpen(false), 200)}
                                                onKeyDown={(e) => {
                                                    const filtered = vendors.filter(v => v.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()));
                                                    if (e.key === 'ArrowDown') {
                                                        e.preventDefault();
                                                        setHighlightedSupplierIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
                                                    } else if (e.key === 'ArrowUp') {
                                                        e.preventDefault();
                                                        setHighlightedSupplierIndex(prev => (prev > 0 ? prev - 1 : prev));
                                                    } else if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (filtered.length > 0 && highlightedSupplierIndex >= 0 && highlightedSupplierIndex < filtered.length) {
                                                            handleSelectVendor(filtered[highlightedSupplierIndex]);
                                                        } else if (filtered.length > 0) {
                                                            handleSelectVendor(filtered[0]);
                                                        } else {
                                                            focusNext('supplier');
                                                        }
                                                    } else if (e.key === 'Escape') {
                                                        setIsSupplierDropdownOpen(false);
                                                    }
                                                }}
                                                placeholder="Search Supplier..."
                                                className="form-input bg-white w-full py-1.5 text-sm"
                                                onFocus={(e) => {
                                                    handleAutoSelect(e);
                                                    setIsSupplierDropdownOpen(true);
                                                    setHighlightedSupplierIndex(0);
                                                }}
                                                onClick={handleClickSelect}
                                                required
                                            />
                                            {isSupplierDropdownOpen && (
                                                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-50 max-h-60 overflow-y-auto">
                                                    {vendors.filter(v => v.name.toLowerCase().includes(supplierSearchQuery.toLowerCase())).map((v, idx) => (
                                                        <div
                                                            key={v.id}
                                                            onMouseEnter={() => setHighlightedSupplierIndex(idx)}
                                                            onClick={() => handleSelectVendor(v)}
                                                            className={`px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 ${highlightedSupplierIndex === idx ? 'bg-blue-100' : ''}`}
                                                        >
                                                            <div className="font-medium text-gray-800">{v.name}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col w-1/5 min-w-[120px]">
                                    <label className="text-xs font-semibold text-gray-600 mb-1">Bill Number</label>
                                    <input
                                        ref={billNumberInputRef}
                                        type="text"
                                        value={billNumber}
                                        onChange={e => setBillNumber(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && focusNext('billNo')}
                                        onFocus={handleAutoSelect}
                                        className="form-input py-1.5 text-sm"
                                        placeholder="Enter Bill No"
                                    />
                                </div>

                                <div className="flex flex-col w-1/6 min-w-[120px]">
                                    <label className="text-xs font-semibold text-gray-600 mb-1">Bill Date</label>
                                    <input
                                        type="date"
                                        value={billDate}
                                        onChange={e => setBillDate(e.target.value)}
                                        className="form-input py-1.5 text-sm"
                                    />
                                </div>
                                <div className="flex items-center self-end mb-1">
                                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={addToCredit}
                                            onChange={(e) => setAddToCredit(e.target.checked)}
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-xs font-semibold text-gray-700">Add to Credit</span>
                                    </label>
                                </div>
                            </div>

                            {/* PRODUCTS "CART" LIST */}
                            <div className="flex-1 min-h-[120px] flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-white mb-2 shadow-sm">
                                <div className="flex-1 overflow-y-auto">
                                    <table className="w-full text-sm text-gray-700 table-fixed border-collapse">
                                        <thead className="bg-gray-50 border-b sticky top-0 z-10">
                                            <tr className="text-xs font-bold text-gray-600 uppercase">
                                                <th className="w-16 p-2 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={addedProducts.length > 0 && selectedProductIds.size === addedProducts.length}
                                                            onChange={toggleSelectAll}
                                                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span>S.NO</span>
                                                    </div>
                                                </th>
                                                <th className="p-2 text-left">Product Name</th>
                                                <th className="w-24 p-2 text-left">Category</th>
                                                <th className="w-16 p-2 text-center">Unit</th>
                                                <th className="w-20 p-2 text-right">Buy</th>
                                                <th className="w-20 p-2 text-right">Sell</th>
                                                <th className="w-24 p-2 text-right">Margin</th>
                                                <th className="w-16 p-2 text-center">Qty</th>
                                                <th className="w-24 p-2 text-left">HSN/SAC</th>
                                                <th className="w-16 p-2 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {addedProducts.length === 0 ? (
                                                <tr>
                                                    <td colSpan={10} className="py-12 text-center text-gray-400">
                                                        <div className="flex flex-col items-center justify-center">
                                                            <Layers size={32} className="mb-2 opacity-20" />
                                                            <p className="text-sm">Added products will appear here</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                addedProducts.map((row, i) => (
                                                    <tr key={i} className="border-b hover:bg-gray-50 group">
                                                        <td className="p-2 text-center font-mono text-gray-400 whitespace-nowrap">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedProductIds.has(row.id)}
                                                                    onChange={() => toggleProductSelection(row.id)}
                                                                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                />
                                                                {addedProducts.length - i}
                                                            </div>
                                                        </td>
                                                        <td className="p-2">
                                                            <div className="font-medium text-gray-800 truncate" title={row.name}>{row.name}</div>
                                                            <div className="text-[10px] text-gray-400 font-mono">{row.barcode}</div>
                                                        </td>
                                                        <td className="p-2 text-gray-600 truncate text-xs" title={row.category}>{row.category}</td>
                                                        <td className="p-2 text-center text-xs text-gray-500">{row.unit || 'Nos'}</td>
                                                        <td className="p-2 text-right font-mono text-gray-400">₹{row.purchaseRate}</td>
                                                        <td className="p-2 text-right font-mono font-medium text-green-700">₹{row.price}</td>
                                                        <td className="p-2 text-right font-mono">
                                                            {(() => {
                                                                const buy = Number(row.purchaseRate) || 0;
                                                                const sell = Number(row.price) || 0;
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
                                                        <td className="p-2 text-center font-bold">
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                value={row.stockQuantity || ''}
                                                                onChange={(e) => handleInlineQuantityChange(i, e.target.value)}
                                                                onFocus={handleAutoSelect}
                                                                onClick={handleClickSelect}
                                                                className="w-16 px-1 py-0.5 text-center border border-gray-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none transition-all font-bold"
                                                                min="0"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-left text-xs text-gray-500 whitespace-nowrap">
                                                            {row.taxCode || "-"}
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setPurchaseHistoryProductId(row.id);
                                                                        setPurchaseHistoryProductName(row.name);
                                                                        setIsPurchaseHistoryOpen(true);
                                                                    }}
                                                                    className="text-blue-500 hover:text-blue-700 transition-colors"
                                                                    title="View Purchase History"
                                                                >
                                                                    <Clock size={16} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveProduct(i)}
                                                                    className="text-red-500 hover:text-red-700 transition-colors"
                                                                    title="Remove Item"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* INPUT AREA (Bottom) */}
                            <div className="bg-gray-50/50 p-2.5 rounded-lg border border-gray-200 shadow-inner shrink-0 mb-2">
                                <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></div>
                                    ADD NEW PRODUCT
                                </div>

                                {/* STACKED GRID LAYOUT */}
                                <div className="space-y-2.5">
                                    {/* Row 1: Name, Category, Unit */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className="flex flex-col relative">
                                            <input
                                                ref={nameInputRef}
                                                type="text"
                                                value={currentInput.name}
                                                onChange={(e) => {
                                                    handleInputChange('name', e.target.value);
                                                    setIsProductDropdownOpen(true);
                                                    setHighlightedProductIndex(0); // Auto highlight first result
                                                }}
                                                onKeyDown={handleProductKeyDown}
                                                onFocus={(e) => {
                                                    handleAutoSelect(e);
                                                    if (currentInput.name.length > 0) setIsProductDropdownOpen(true);
                                                }}
                                                onBlur={() => setTimeout(() => setIsProductDropdownOpen(false), 200)}
                                                className="form-input w-full text-sm font-semibold border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
                                            />
                                            {isProductDropdownOpen && filteredSuggestions.length > 0 && (
                                                <div ref={productDropdownRef} className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-50 max-h-60 overflow-y-auto">
                                                    {filteredSuggestions.map((p, idx) => (
                                                        <div
                                                            key={p.id || idx}
                                                            onMouseEnter={() => setHighlightedProductIndex(idx)}
                                                            onClick={() => handleSelectProduct(p)}
                                                            className={`px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 ${highlightedProductIndex === idx ? 'bg-blue-100' : ''}`}
                                                        >
                                                            <div className="flex justify-between items-center text-left">
                                                                <div className="font-medium text-gray-800">{p.name}</div>
                                                                <div className="text-xs text-gray-500 font-mono">{p.barcode}</div>
                                                            </div>
                                                            {p.stockQuantity !== undefined && (
                                                                <div className="text-[10px] text-gray-400 text-left">Stock: {formatQty(p.stockQuantity)}</div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col">
                                            <div className="relative">
                                                <input
                                                    ref={categoryInputRef}
                                                    type="text"
                                                    placeholder="Category"
                                                    value={categorySearchQuery}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setCategorySearchQuery(val);
                                                        handleInputChange('category', val);
                                                        setIsCategoryDropdownOpen(true);
                                                        setHighlightedCategoryIndex(0);
                                                    }}
                                                    onFocus={(e) => {
                                                        handleAutoSelect(e);
                                                        setIsCategoryDropdownOpen(true);
                                                        setHighlightedCategoryIndex(0);
                                                    }}
                                                    onClick={handleClickSelect}
                                                    onBlur={() => setTimeout(() => setIsCategoryDropdownOpen(false), 200)}
                                                    onKeyDown={(e) => {
                                                        const filtered = categories.filter(c => c.toLowerCase().includes(categorySearchQuery.toLowerCase()));
                                                        if (e.key === 'ArrowDown') {
                                                            e.preventDefault();
                                                            setHighlightedCategoryIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
                                                        } else if (e.key === 'ArrowUp') {
                                                            e.preventDefault();
                                                            setHighlightedCategoryIndex(prev => (prev > 0 ? prev - 1 : prev));
                                                        } else if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            if (filtered.length > 0 && highlightedCategoryIndex >= 0 && highlightedCategoryIndex < filtered.length) {
                                                                handleSelectCategory(filtered[highlightedCategoryIndex]);
                                                            } else if (filtered.length > 0) {
                                                                handleSelectCategory(filtered[0]);
                                                            }
                                                            focusNext('category');
                                                        } else if (e.key === 'Escape') {
                                                            setIsCategoryDropdownOpen(false);
                                                        }
                                                    }}
                                                    className="form-input w-full text-sm border-gray-300 placeholder-gray-400"
                                                />
                                                {isCategoryDropdownOpen && (
                                                    <div className="absolute bottom-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl mb-1.5 z-50 max-h-48 overflow-y-auto p-1 divide-y divide-gray-50">
                                                        {categories.filter(c => c.toLowerCase().includes(categorySearchQuery.toLowerCase())).map((c, idx) => (
                                                            <div
                                                                key={c}
                                                                onMouseEnter={() => setHighlightedCategoryIndex(idx)}
                                                                onMouseDown={(e) => { e.preventDefault(); handleSelectCategory(c); unitInputRef.current?.focus(); }}
                                                                className={`px-3 py-1.5 hover:bg-blue-50 cursor-pointer rounded-lg text-sm transition-colors ${highlightedCategoryIndex === idx ? 'bg-blue-600 text-white font-semibold' : 'text-gray-700'}`}
                                                            >
                                                                {c}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col justify-end">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Unit (Nos/Kg/Pcs)"
                                                    ref={unitInputRef}
                                                    value={currentInput.unit}
                                                    autoComplete="off"
                                                    onFocus={() => {
                                                        setIsUnitDropdownOpen(true);
                                                        setHighlightedUnitIndex(0);
                                                    }}
                                                    onBlur={() => setTimeout(() => setIsUnitDropdownOpen(false), 200)}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        handleInputChange('unit', val);
                                                        setIsUnitDropdownOpen(true);
                                                    }}
                                                    onKeyDown={e => {
                                                        const filtered = unitSuggestions.filter(u => u.toLowerCase().startsWith(currentInput.unit.toLowerCase()));
                                                        if (e.key === 'ArrowDown') {
                                                            e.preventDefault();
                                                            setHighlightedUnitIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
                                                        } else if (e.key === 'ArrowUp') {
                                                            e.preventDefault();
                                                            setHighlightedUnitIndex(prev => (prev > 0 ? prev - 1 : prev));
                                                        } else if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            if (filtered.length > 0 && highlightedUnitIndex >= 0 && highlightedUnitIndex < filtered.length) {
                                                                handleSelectUnit(filtered[highlightedUnitIndex]);
                                                            } else if (filtered.length > 0 && currentInput.unit.length > 0) {
                                                                // If they typed something and hit enter, use first suggestion if available
                                                                handleSelectUnit(filtered[0]);
                                                            } else {
                                                                setIsUnitDropdownOpen(false);
                                                                focusNext('unit');
                                                            }
                                                        } else if (e.key === 'Escape') {
                                                            setIsUnitDropdownOpen(false);
                                                        }
                                                    }}
                                                    className="form-input w-full text-sm border-gray-300 placeholder-gray-400 h-[38px]"
                                                />
                                                {isUnitDropdownOpen && (
                                                    <div ref={unitDropdownRef} className="absolute bottom-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl mb-1.5 z-50 max-h-56 overflow-y-auto p-1 divide-y divide-gray-50">
                                                        {unitSuggestions
                                                            .filter(u => u.toLowerCase().startsWith(currentInput.unit.toLowerCase()))
                                                            .map((u, idx) => (
                                                                <div
                                                                    key={u}
                                                                    ref={el => { if (el) unitItemRefs.current.set(idx, el); else unitItemRefs.current.delete(idx); }}
                                                                    onMouseEnter={() => setHighlightedUnitIndex(idx)}
                                                                    onMouseDown={(e) => {
                                                                        e.preventDefault();
                                                                        handleSelectUnit(u);
                                                                    }}
                                                                    className={`px-3 py-2 rounded-lg cursor-pointer text-sm font-medium transition-colors ${
                                                                        highlightedUnitIndex === idx ? 'bg-blue-600 text-white font-semibold' : 'text-gray-700 hover:bg-blue-50'
                                                                    }`}
                                                                >
                                                                    {u}
                                                                </div>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: HSN, Buy, GST, Profit, Selling, Wholesale, Qty */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                                        <div className="flex flex-col">
                                            <input
                                                type="text"
                                                placeholder="HSN"
                                                ref={hsnInputRef}
                                                value={currentInput.taxCode || ''}
                                                onChange={e => handleInputChange('taxCode', e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') { e.preventDefault(); focusNext('hsn'); }
                                                }}
                                                className="form-input w-full text-sm border-gray-300 placeholder-gray-400"
                                            />
                                        </div>

                                        <div className="flex flex-col">
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                placeholder="Buy Rate"
                                                ref={purchaseInputRef}
                                                value={buyAfterGst}
                                                onChange={e => handleBuyChange(e.target.value)}
                                                onFocus={(e) => (e.target as HTMLInputElement).select()}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') { e.preventDefault(); focusNext('buy'); }
                                                }}
                                                className="form-input w-full text-sm text-right font-medium text-blue-700 bg-blue-50/50 border-blue-200 focus:border-blue-500 focus:ring-blue-500 placeholder-blue-300"
                                            />
                                        </div>

                                        <div className="flex flex-col">
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                placeholder="GST %"
                                                ref={gstInputRef}
                                                value={gstPercent}
                                                onChange={e => handleGstChange(e.target.value)}
                                                onFocus={(e) => (e.target as HTMLInputElement).select()}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') { e.preventDefault(); focusNext('gst'); }
                                                }}
                                                className="form-input w-full text-sm text-center border-gray-300 placeholder-gray-400"
                                            />
                                        </div>

                                        <div className="flex flex-col">
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                placeholder="Selling Price"
                                                ref={priceInputRef}
                                                value={isSellingManual ? (currentInput.price || '') : (calculatedSellingPrice || '')}
                                                onChange={e => handleSellingChange(e.target.value)}
                                                onFocus={handleAutoSelect}
                                                onClick={(e) => (e.target as HTMLInputElement).select()}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') { e.preventDefault(); focusNext('selling'); }
                                                }}
                                                className="form-input w-full text-sm text-right bg-green-50/50 text-green-800 font-bold border-green-200 placeholder-green-300"
                                            />
                                        </div>

                                        <div className="flex flex-col">
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                placeholder="Profit %"
                                                ref={profitInputRef}
                                                value={profitPercent}
                                                onChange={e => handleProfitChange(e.target.value)}
                                                onFocus={(e) => (e.target as HTMLInputElement).select()}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') { e.preventDefault(); focusNext('profit'); }
                                                }}
                                                className="form-input w-full text-sm text-center text-green-700 border-gray-300 placeholder-gray-400"
                                            />
                                        </div>

                                        {/* Margin / Profit Preview */}
                                        <div className="flex flex-col">
                                            {(() => {
                                                const curSelling = parseFloat(isSellingManual ? String(currentInput.price || 0) : String(calculatedSellingPrice || 0)) || 0;
                                                const curBuy = parseFloat(String(buyAfterGst || 0)) || 0;
                                                const curProfit = curSelling - curBuy;
                                                const curMarginPct = curBuy > 0 ? ((curProfit / curBuy) * 100).toFixed(1) : (curSelling > 0 ? '100' : '0');
                                                const hasValues = curSelling > 0 || curBuy > 0;
                                                const isPositive = curProfit >= 0;

                                                return (
                                                    <div 
                                                        title={`Margin: ₹${curProfit.toFixed(2)} (${curMarginPct}%)`}
                                                        className={`h-[38px] px-2 py-0.5 rounded border flex flex-col justify-center items-center text-center transition-all ${
                                                            !hasValues 
                                                                ? 'bg-gray-50 border-gray-200 text-gray-400' 
                                                                : isPositive 
                                                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                                                                    : 'bg-rose-50 border-rose-300 text-rose-800'
                                                        }`}
                                                    >
                                                        <span className="text-[9px] font-bold uppercase tracking-wider leading-none mb-0.5 opacity-75">
                                                            Margin
                                                        </span>
                                                        <span className="text-xs font-black font-mono leading-none">
                                                            {!hasValues ? '₹0.00' : `${isPositive ? '+' : ''}₹${curProfit.toFixed(2)}`}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        <div className="flex flex-col">
                                            <input
                                                type="number"
                                                step="any"
                                                inputMode="decimal"
                                                placeholder="Qty"
                                                ref={qtyInputRef}
                                                value={currentInput.stockQuantity || ''}
                                                onChange={e => handleInputChange('stockQuantity', parseFloat(e.target.value))}
                                                onFocus={(e) => (e.target as HTMLInputElement).select()}
                                                onClick={(e) => (e.target as HTMLInputElement).select()}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleAddProduct();
                                                    }
                                                }}
                                                className="form-input w-full text-sm text-center font-bold border-gray-300 placeholder-gray-400"
                                            />
                                        </div>

                                        <div className="flex items-end">
                                            <button
                                                type="button"
                                                onClick={handleAddProduct}
                                                disabled={!currentInput.name}
                                                className="w-full h-[38px] flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm disabled:opacity-50 transition-all hover:shadow-md"
                                            >
                                                <PlusCircle size={20} className="mr-2" />
                                                <span>ADD</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="pt-2.5 border-t flex flex-wrap justify-between items-center bg-white shrink-0 gap-2">
                                <div className="text-sm text-gray-600 flex flex-wrap items-center gap-2 sm:gap-3">
                                    <span>Total Items: <span className="font-bold text-gray-800">{addedProducts.length + (currentInput.name ? 1 : 0)}</span></span>
                                    <span className="text-gray-300">|</span>
                                    <span>Total Purchase: <span className="font-bold text-blue-600">₹{totalPurchaseValue.toFixed(2)}</span></span>
                                    <span className="text-gray-300">|</span>
                                    <span>Total Selling: <span className="font-bold text-indigo-600">₹{totalSellingValue.toFixed(2)}</span></span>
                                    <span className="text-gray-300">|</span>
                                    {(() => {
                                        const totalMargin = totalSellingValue - totalPurchaseValue;
                                        const totalMarginPct = totalPurchaseValue > 0 ? ((totalMargin / totalPurchaseValue) * 100).toFixed(1) : '0';
                                        const isPos = totalMargin >= 0;
                                        return (
                                            <span>
                                                Total Margin: <span className={`font-bold ${isPos ? 'text-emerald-700' : 'text-rose-600'}`}>
                                                    {isPos ? '+' : ''}₹{totalMargin.toFixed(2)} ({isPos ? '+' : ''}{totalMarginPct}%)
                                                </span>
                                            </span>
                                        );
                                    })()}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={handlePrintBarcodes}
                                        className={`px-4 py-2.5 font-semibold rounded-lg flex items-center gap-2 transition-colors bg-purple-100 text-purple-700 hover:bg-purple-200`}
                                    >
                                        <Printer size={18} /> Barcodes
                                    </button>
                                    <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors">Close</button>

                                    <button
                                        type="submit"
                                        disabled={(addedProducts.length === 0 && !currentInput.name) || isSaving || localSaving}
                                        className={`px-6 py-2.5 font-semibold rounded-lg shadow-lg flex items-center gap-2 transition-all bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 disabled:opacity-50 disabled:shadow-none`}
                                        title={"Save All (Products + Transaction)"}
                                    >
                                        <Save size={18} />
                                        {isSaving || localSaving ? "Saving..." : "Save all"}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* RIGHT SIDE: CREDIT PANEL (Collapsible) */}
                    {isCreditPanelOpen && selectedVendor && (
                        <div className="w-1/3 min-w-[350px] border-l pl-6 animate-in slide-in-from-right-10 duration-300 flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <CreditCard size={20} className="text-purple-600" /> Supplier Credit
                                </h3>
                                <button onClick={() => setIsCreditPanelOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm hover:underline">Close Panel</button>
                            </div>

                            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                                <SupplierCreditPanel
                                    supplierId={selectedVendor.id}
                                    supplierName={selectedVendor.name}
                                    onClose={() => setIsCreditPanelOpen(false)}
                                    onSuccess={handleCreditSuccess}
                                    initialAmount={totalPurchaseValue}
                                    initialDescription={`Purchase of ${addedProducts.length} items`}
                                    embedded={true}
                                    billDate={billDate}
                                    hideSubmitButton={true}
                                    hidePaidAmount={false}
                                    hideInvoice={true}
                                    onFormChange={setCreditFormDetails}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {isPurchaseHistoryOpen && (
                <PurchaseHistoryModal
                    productId={purchaseHistoryProductId}
                    productName={purchaseHistoryProductName}
                    vendorId={selectedVendorId}
                    onClose={() => setIsPurchaseHistoryOpen(false)}
                />
            )}
        </div>
    );
};
export default MultiProductFormModal;
