import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { estimationApi, billingApi } from "@/lib/api";
import { utils, writeFile } from "xlsx";
import { Printer, Search, FileSpreadsheet, Calculator } from "lucide-react";
import { motion } from "framer-motion";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { APP_CONFIG } from '@/config';
import { useAuth } from '@/context/AuthContext';
import { renderToStaticMarkup } from 'react-dom/server';
import { numberToWords } from '@/utils/numberToWords';
import { EstimationPrint } from './Estimation';

interface BillItem {
    productName: string;
    quantity: number;
    unit?: string;
    discountRate: number;
    unitPrice: number;
    netAmount: number;
    gstRate: number;
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
    status: string;
    createdAt: string;
    billType?: string;
}

const EstimationList: React.FC = () => {
    const [estimations, setEstimations] = useState<Bill[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const { user, loading: authLoading } = useAuth();
    const [globalBills, setGlobalBills] = useState<any[]>([]);
    const refreshBills = useCallback(async () => {
        try {
            const res = await billingApi.getAll();
            setGlobalBills(Array.isArray(res) ? res : (res as any)?.data || []);
        } catch (e) { console.error("Failed to load bills", e); }
    }, []);
    useEffect(() => { refreshBills(); }, [refreshBills]);
    const [shopName] = useLocalStorage("shopName_v3", APP_CONFIG.COMPANY_NAME);
    const [gstNumberRaw] = useLocalStorage("gstNumber_v4", "33BJLPN3590D1Z7");
    const gstNumber = !gstNumberRaw || gstNumberRaw === '33JPNPK3337F1ZR' ? '33BJLPN3590D1Z7' : gstNumberRaw;

    useEffect(() => {
        const fetchEstimations = async () => {
            try {
                setLoading(true);
                const estRes = await estimationApi.getAll();

                const estimatesFromBills = (globalBills || [])
                    .filter((b: any) => b.billType === 'ESTIMATE' || b.paymentMethod === 'HOLD')
                    .map((b: any) => ({
                        ...b,
                        invoiceId: b.invoiceNumber || b.invoiceId || b.id
                    }));

                let dedicatedEstData: any[] = [];
                if (Array.isArray(estRes.data)) {
                    dedicatedEstData = estRes.data;
                }

                const mappedDedicated = dedicatedEstData.map(e => ({
                    id: e.id,
                    invoiceId: e.estimationId || e.id,
                    customerName: e.customerName,
                    customerPhone: e.customerPhone ? String(e.customerPhone) : "",
                    customerEmail: e.customerEmail || "",
                    customerAddress: e.customerAddress || "",
                    items: e.items || [],
                    finalAmount: e.finalAmount || 0,
                    paymentMethod: "ESTIMATE",
                    status: "PAID",
                    createdAt: e.createdAt,
                    billType: "ESTIMATE"
                }));

                const merged = [...estimatesFromBills, ...mappedDedicated];
                const sorted = merged.sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );

                setEstimations(sorted as Bill[]);
            } catch (err) {
                console.error("Failed to fetch estimations:", err);
                toast.error("Failed to load estimation history.");
            } finally {
                setLoading(false);
            }
        };

        fetchEstimations();
    }, [globalBills]);

    const filtered = estimations.filter((est) => {
        const estDate = new Date(est.createdAt);
        if (startDate) {
            const [y, m, d] = startDate.split('-').map(Number);
            const start = new Date(y, m - 1, d, 0, 0, 0, 0);
            if (estDate < start) return false;
        }
        if (endDate) {
            const [y, m, d] = endDate.split('-').map(Number);
            const end = new Date(y, m - 1, d, 23, 59, 59, 999);
            if (estDate > end) return false;
        }
        if (!searchTerm) return true;
        const lower = searchTerm.toLowerCase();
        const invoice = (est.invoiceId || est.id || "").toLowerCase();
        const name = (est.customerName || "").toLowerCase();
        const phone = (est.customerPhone || "").toString();
        return (invoice.includes(lower) || name.includes(lower) || phone.includes(searchTerm));
    });

    const handleExportExcel = () => {
        if (!filtered.length) {
            toast.error("No estimations to export.");
            return;
        }
        const data = filtered.map((est, i) => ({
            "S.No": i + 1,
            "Estimation ID": est.invoiceId || est.id,
            "Customer Name": est.customerName || "Walk-in",
            Contact: est.customerPhone || "N/A",
            "Date & Time": new Date(est.createdAt).toLocaleString("en-GB"),
            Items: est.items.length,
            "Total Amount": est.finalAmount,
        }));
        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Estimations");
        writeFile(wb, "Estimations_History.xlsx");
    };

    const handleReprint = (est: Bill) => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            toast.error("Popup blocked!");
            return;
        }

        const companyData = {
            name: "Lingam Spares",
            address: "No. 35, Malligai Street, Mullai Nagar, Orikkai, Kanchipuram - 631502",
            gstin: gstNumber || "33BJLPN3590D1Z7",
            email: "lingamspares@gmail.com",
            state: "Tamil Nadu"
        };

        const totalQty = est.items.filter(item => item.productId !== 'TRANSPORT_CHARGE').reduce((sum, item) => sum + Number(item.quantity), 0);
        const grandTotal = est.finalAmount;

        const printItems = est.items.map(item => ({
            name: item.productName,
            qty: item.quantity,
            unit: item.unit,
            rate: item.unitPrice,
            discount: item.discountRate,
            total: item.netAmount
        }));

        const html = renderToStaticMarkup(
            <EstimationPrint
                company={companyData}
                estimation={{ id: est.invoiceId || est.id, date: new Date(est.createdAt).toLocaleDateString('en-GB') }}
                customer={{
                    name: est.customerName || "Walk-in",
                    phone: est.customerPhone || "-",
                    address: est.customerAddress || "",
                    shippingAddress: est.customerAddress || ""
                }}
                items={printItems}
                totals={{ totalQty, grandTotal, amountInWords: numberToWords(grandTotal) }}
                printedAt={new Date().toLocaleString('en-GB')}
            />
        );

        printWindow.document.open();
        printWindow.document.write(`
          <html>
            <head>
              <title>Estimation - ${est.invoiceId || est.id}</title>
            </head>
            <body onload="window.print(); window.close();">${html}</body>
          </html>
        `);
        printWindow.document.close();
    };

    return (
        <motion.div
            className="p-6 bg-gray-50 min-h-screen space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
                    <Calculator className="text-blue-600" /> Estimation History
                </h1>
                <div className="flex gap-3">
                    <button
                        onClick={handleExportExcel}
                        className="px-5 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 flex items-center gap-2 transition-all shadow-sm"
                    >
                        <FileSpreadsheet size={18} /> Export
                    </button>
                    <div className="flex items-center gap-4 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-blue-400 font-bold uppercase">Count</span>
                            <span className="text-lg font-black text-blue-700">{filtered.length}</span>
                        </div>
                        <div className="w-px h-8 bg-blue-200"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-blue-400 font-bold uppercase">Total</span>
                            <span className="text-lg font-black text-blue-700">₹{Math.round(filtered.reduce((s, b) => s + b.finalAmount, 0)).toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap items-center gap-4 border border-gray-100">
                <div className="relative flex-grow max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search Estimation or Customer..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="form-input w-full pl-10 border-gray-200 focus:ring-blue-500 rounded-lg text-sm"
                    />
                </div>
                <div className="flex gap-2 items-center">
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input text-sm border-gray-200 rounded-lg" />
                    <span className="text-gray-400">→</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-input text-sm border-gray-200 rounded-lg" />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                    <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="font-medium">Loading estimations...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-8 justify-items-center">
                    {filtered.length ? (
                        filtered.map((est) => (
                            <motion.div
                                key={est.id}
                                className="relative group bg-white p-4 rounded-xl shadow-md border hover:shadow-xl transition-all w-fit"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                {/* Scale Preview Container */}
                                <div className="scale-[0.5] origin-top transform-gpu -mb-[350px]">
                                    <div className="pointer-events-none select-none border-2 border-gray-300 shadow-xl p-2 bg-white">
                                        <EstimationPrint
                                            company={{
                                                name: "Lingam Spares",
                                                address: "No. 35, Malligai Street, Mullai Nagar, Orikkai, Kanchipuram - 631502",
                                                gstin: gstNumber || "33BJLPN3590D1Z7",
                                                email: "lingamspares@gmail.com",
                                                state: "Tamil Nadu"
                                            }}
                                            estimation={{ id: est.invoiceId || est.id, date: new Date(est.createdAt).toLocaleDateString('en-GB') }}
                                            customer={{
                                                name: est.customerName || "Walk-in",
                                                phone: est.customerPhone || "-",
                                                address: est.customerAddress || "",
                                                shippingAddress: est.customerAddress || ""
                                            }}
                                            items={est.items.map(item => ({
                                                name: item.productName,
                                                qty: item.quantity,
                                                unit: item.unit,
                                                rate: item.unitPrice,
                                                discount: item.discountRate,
                                                total: item.netAmount
                                            }))}
                                            totals={{
                                                totalQty: est.items.filter((i: any) => i.productId !== 'TRANSPORT_CHARGE').reduce((s, i) => s + Number(i.quantity), 0),
                                                grandTotal: est.finalAmount,
                                                amountInWords: numberToWords(est.finalAmount)
                                            }}
                                            printedAt={new Date(est.createdAt).toLocaleString('en-GB')}
                                        />
                                    </div>
                                </div>

                                {/* Overlay Actions */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 flex items-center justify-center transition-all rounded-xl">
                                    <button
                                        onClick={() => handleReprint(est)}
                                        className="opacity-0 group-hover:opacity-100 bg-blue-600 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-2xl transform translate-y-4 group-hover:translate-y-0 transition-all hover:bg-blue-700"
                                    >
                                        <Printer size={20} /> PRINT MEMO
                                    </button>
                                </div>
                                <div className="mt-4 pt-4 border-t flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    <span>{est.invoiceId || est.id}</span>
                                    <span className="text-blue-600">{new Date(est.createdAt).toLocaleDateString('en-GB')}</span>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="col-span-full py-40 text-center text-gray-400 italic">
                            No estimations found.
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
};

export default EstimationList;


