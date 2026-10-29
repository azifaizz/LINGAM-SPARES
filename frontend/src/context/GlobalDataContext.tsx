import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { productApi, customerApi, vendorApi, staffApi, brokerApi, billingApi, Product, Customer, Vendor, Staff, Broker, Bill, PurchaseReturn, SalesReturn } from '@/lib/api';
import { useAuth } from './AuthContext';
import { useCachedResource } from '@/hooks/useCachedResource';

const DAY_TTL = 24 * 60 * 60 * 1000;

interface GlobalDataContextType {
    products: Product[];
    customers: Customer[];
    vendors: Vendor[];
    staff: Staff[];
    brokers: Broker[];
    bills: Bill[];
    purchaseReturns: PurchaseReturn[];
    salesReturns: SalesReturn[];
    loading: boolean;
    isSyncing: boolean;
    refreshAll: () => Promise<void>;
    refreshProducts: () => Promise<void>;
    refreshCustomers: () => Promise<void>;
    refreshVendors: () => Promise<void>;
    refreshStaff: () => Promise<void>;
    refreshBrokers: () => Promise<void>;
    refreshBills: () => Promise<void>;
    refreshPurchaseReturns: () => Promise<void>;
    refreshSalesReturns: () => Promise<void>;
    mutateProducts: (updater: Product[] | ((prev: Product[]) => Product[])) => void;
    mutateCustomers: (updater: Customer[] | ((prev: Customer[]) => Customer[])) => void;
    mutateVendors: (updater: Vendor[] | ((prev: Vendor[]) => Vendor[])) => void;
    mutateStaff: (updater: Staff[] | ((prev: Staff[]) => Staff[])) => void;
    mutateBrokers: (updater: Broker[] | ((prev: Broker[]) => Broker[])) => void;
    mutateBills: (updater: Bill[] | ((prev: Bill[]) => Bill[])) => void;
    mutatePurchaseReturns: (updater: PurchaseReturn[] | ((prev: PurchaseReturn[]) => PurchaseReturn[])) => void;
    mutateSalesReturns: (updater: SalesReturn[] | ((prev: SalesReturn[]) => SalesReturn[])) => void;
}

const GlobalDataContext = createContext<GlobalDataContextType>({
    products: [],
    customers: [],
    vendors: [],
    staff: [],
    brokers: [],
    bills: [],
    purchaseReturns: [],
    salesReturns: [],
    loading: true,
    isSyncing: false,
    refreshAll: async () => { },
    refreshProducts: async () => { },
    refreshCustomers: async () => { },
    refreshVendors: async () => { },
    refreshStaff: async () => { },
    refreshBrokers: async () => { },
    refreshBills: async () => { },
    refreshPurchaseReturns: async () => { },
    refreshSalesReturns: async () => { },
    mutateProducts: () => { },
    mutateCustomers: () => { },
    mutateVendors: () => { },
    mutateStaff: () => { },
    mutateBrokers: () => { },
    mutateBills: () => { },
    mutatePurchaseReturns: () => { },
    mutateSalesReturns: () => { },
});

export const GlobalDataProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();

    const {
        data: products,
        loading: loadingProducts,
        isSyncing: syncingProducts,
        refresh: refreshProducts,
        mutate: rawMutateProducts
    } = useCachedResource<Product[]>('global_products', productApi.getAll, { skip: !user, initialData: [], ttl: DAY_TTL });

    const {
        data: customers,
        loading: loadingCustomers,
        isSyncing: syncingCustomers,
        refresh: refreshCustomers,
        mutate: mutateCustomers
    } = useCachedResource<Customer[]>('global_customers', customerApi.getAll, { skip: !user, initialData: [], ttl: DAY_TTL });

    const {
        data: vendors,
        loading: loadingVendors,
        isSyncing: syncingVendors,
        refresh: refreshVendors,
        mutate: mutateVendors
    } = useCachedResource<Vendor[]>('global_vendors', vendorApi.getAll, { skip: !user, initialData: [], ttl: DAY_TTL });

    const {
        data: staff,
        loading: loadingStaff,
        isSyncing: syncingStaff,
        refresh: refreshStaff,
        mutate: mutateStaff
    } = useCachedResource<Staff[]>('global_staff', staffApi.getAll, { skip: !user, initialData: [], ttl: DAY_TTL });

    const {
        data: brokers,
        loading: loadingBrokers,
        isSyncing: syncingBrokers,
        refresh: refreshBrokers,
        mutate: mutateBrokers
    } = useCachedResource<Broker[]>('global_brokers', brokerApi.getAll, { skip: !user, initialData: [], ttl: DAY_TTL });

    const {
        data: bills,
        loading: loadingBills,
        isSyncing: syncingBills,
        refresh: refreshBills,
        mutate: mutateBills
    } = useCachedResource<Bill[]>('global_bills', billingApi.getAll, { skip: !user, initialData: [], ttl: 60 * 1000 }); // Instant cache with 1m background refresh

    const {
        data: purchaseReturns,
        loading: loadingPurchaseReturns,
        isSyncing: syncingPurchaseReturns,
        refresh: refreshPurchaseReturns,
        mutate: rawMutatePurchaseReturns
    } = useCachedResource<PurchaseReturn[]>('global_purchase_returns', () => vendorApi.getPurchaseReturnsRange('2024-01-01', '2030-12-31'), { skip: !user, initialData: [], ttl: DAY_TTL });

    const {
        data: salesReturns,
        loading: loadingSalesReturns,
        isSyncing: syncingSalesReturns,
        refresh: refreshSalesReturns,
        mutate: rawMutateSalesReturns
    } = useCachedResource<SalesReturn[]>('global_sales_returns', () => billingApi.getSalesReturnsByRange('2024-01-01', '2030-12-31'), { skip: !user, initialData: [], ttl: DAY_TTL });

    const loading = loadingProducts || loadingCustomers || loadingVendors || loadingStaff || loadingBrokers || loadingBills || loadingPurchaseReturns || loadingSalesReturns;
    const isSyncing = syncingProducts || syncingCustomers || syncingVendors || syncingStaff || syncingBrokers || syncingBills || syncingPurchaseReturns || syncingSalesReturns;

    const refreshAll = useCallback(async () => {
        await Promise.allSettled([
            refreshProducts(),
            refreshCustomers(),
            refreshVendors(),
            refreshStaff(),
            refreshBrokers(),
            refreshBills(),
            refreshPurchaseReturns(),
            refreshSalesReturns(),
        ]);
    }, [refreshProducts, refreshCustomers, refreshVendors, refreshStaff, refreshBrokers, refreshBills, refreshPurchaseReturns, refreshSalesReturns]);

    // rawMutateProducts now supports function updater pattern natively

    const value = useMemo(() => ({
        products: products || [],
        customers: customers || [],
        vendors: vendors || [],
        staff: staff || [],
        brokers: brokers || [],
        bills: bills || [],
        purchaseReturns: purchaseReturns || [],
        salesReturns: salesReturns || [],
        loading,
        isSyncing,
        refreshAll,
        refreshProducts,
        refreshCustomers,
        refreshVendors,
        refreshStaff,
        refreshBrokers,
        refreshBills,
        refreshPurchaseReturns,
        refreshSalesReturns,
        mutateProducts: rawMutateProducts,
        mutateCustomers,
        mutateVendors,
        mutateStaff,
        mutateBrokers,
        mutateBills,
        mutatePurchaseReturns: rawMutatePurchaseReturns,
        mutateSalesReturns: rawMutateSalesReturns,
    }), [
        products, customers, vendors, staff, brokers, bills, purchaseReturns, salesReturns,
        loading, isSyncing,
        refreshAll, refreshProducts, refreshCustomers,
        refreshVendors, refreshStaff, refreshBrokers, refreshBills, refreshPurchaseReturns, refreshSalesReturns,
        rawMutateProducts, mutateCustomers, mutateVendors, mutateStaff, mutateBrokers, mutateBills,
        rawMutatePurchaseReturns, rawMutateSalesReturns,
    ]);

    return <GlobalDataContext.Provider value={value}>{children}</GlobalDataContext.Provider>;
};

export const useGlobalData = () => {
    return useContext(GlobalDataContext);
};
