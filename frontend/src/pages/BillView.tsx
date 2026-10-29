
import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { billingApi, Bill } from '@/lib/api';
import { Loader2, Download, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'react-hot-toast';
import { APP_CONFIG } from '@/config';
import { formatDate } from '@/lib/utils';
import { useLocalStorage } from '@/hooks/useLocalStorage';


const numberToWords = (num: number): string => {
    const a = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const b = [
        '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
    ];

    const inWords = (n: number): string => {
        if (n === 0) return '';
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
        if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + inWords(n % 100) : '');
        if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
        if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
        return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
    };

    const numStr = num.toFixed(2);
    const [rupees, paise] = numStr.split('.').map(Number);

    let words = '';
    if (rupees === 0) words = 'Zero';
    else words = inWords(rupees);

    words = `Rupees ${words}`;
    if (paise > 0) words += ` and ${inWords(paise)} Paise`;
    return words + ' Only';
};

const BillView = () => {
    const { id } = useParams<{ id: string }>();
    const [bill, setBill] = useState<Bill | null>(null);
    const [loading, setLoading] = useState(true);
    const invoiceRef = useRef<HTMLDivElement>(null);

    const [billMessage] = useLocalStorage('billMessage', 'Thank You For Your Purchasing');


    useEffect(() => {
        const fetchBill = async () => {
            try {
                if (!id) return;
                const res = await billingApi.getById(id.trim());
                if (res.data) {
                    setBill(res.data);
                } else {
                    toast.error("Bill not found");
                }
            } catch (error) {
                console.error("Error fetching bill", error);
                toast.error("Failed to load bill details");
            } finally {
                setLoading(false);
            }
        };
        fetchBill();
    }, [id]);

    const handleDownloadPdf = async () => {
        if (!invoiceRef.current || !bill) return;
        try {
            const canvas = await html2canvas(invoiceRef.current, {
                scale: 2, // Higher resolution
                useCORS: true,
                logging: false
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a5'
            });

            const imgWidth = 210; // A5 landscape width (approx)
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`FF_${bill.id}.pdf`);
            toast.success("Invoice downloaded!");
            toast.success("Invoice downloaded!");
        } catch (error) {
            console.error("PDF generation failed", error);
            toast.error("Failed to generate PDF");
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin w-10 h-10 text-blue-600" /></div>;
    if (!bill) return <div className="h-screen flex items-center justify-center text-red-500 text-xl">Bill Not Found</div>;

    // Derive Calculations
    let totalTaxable = 0;
    let totalGst = 0;
    let totalQty = 0;

    // Re-calculate to ensure consistency with display logic
    const items = (bill.items || []).map(item => {
        const qty = Number(item.quantity || 1);
        const unitPrice = Number(item.unitPrice || 0);
        const discountRate = Number(item.discountRate || 0);
        const gstRate = Number(item.gstRate || 0);

        const subtotal = unitPrice * qty;
        const discountAmount = subtotal * (discountRate / 100);
        const taxableAmount = subtotal - discountAmount;
        const gstAmount = taxableAmount * (gstRate / 100);
        const totalLine = taxableAmount; // GST is NOT added to the line total anymore as per request

        totalTaxable += taxableAmount;
        totalGst += gstAmount;
        totalQty += qty;

        return { ...item, qty, unitPrice, discountRate, gstRate, taxableAmount, gstAmount, totalLine };
    });

    const finalAmount = Math.round(totalTaxable); // Net Amount is just Taxable Total
    const roundOff = finalAmount - totalTaxable;
    const amountInWords = numberToWords(finalAmount);

    const gstNumber = APP_CONFIG.GSTIN || "33BJLPN3590D1Z7";
    const billDate = formatDate(bill.createdAt);

    return (
        <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center">

            <div className="mb-6 flex gap-4 no-print">
                <button
                    onClick={handleDownloadPdf}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-lg font-semibold transition-transform hover:scale-105"
                >
                    <Download size={20} /> Download PDF
                </button>
                <button
                    onClick={() => window.print()}
                    className="bg-gray-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-gray-800 shadow-lg font-semibold transition-transform hover:scale-105"
                >
                    <Printer size={20} /> Print
                </button>
            </div>

            {/* INVOICE CANVAS */}
            <div
                ref={invoiceRef}
                className="bg-white text-black p-0 shadow-xl overflow-hidden print-container"
                style={{
                    width: '210mm', // A5 Landscape width roughly or A4 Portrait depending on pref. Billing.tsx used A5 Landscape.
                    minHeight: '148mm',
                    margin: '0 auto',
                    position: 'relative',
                    boxSizing: 'border-box'
                }}
            >
                <div className="border border-black flex flex-col h-full" style={{ padding: '0' }}>
                    {/* Header Title */}
                    <div className="flex justify-between border-b border-black px-2 py-1">
                        <span className="font-bold">{bill.billType === 'ESTIMATE' ? 'ESTIMATE' : 'TAX INVOICE'}</span>
                        <span className="font-bold">ORIGINAL</span>
                    </div>

                    {/* Header Details */}
                    <div className="flex border-bottom border-black" style={{ borderBottom: '1px solid black' }}>
                        <div className="w-[40%] p-2 border-r border-black">
                            <div className="text-xl font-bold uppercase mb-1">{APP_CONFIG.COMPANY_NAME}</div>
                            <div className="text-xs leading-tight">
                                No. 35, Malligai Street, Mullai Nagar,<br />
                                Orikkai, Kancheepuram – 631502<br />
                                <strong>Contact No:</strong> 861 000 1221<br />
                                <strong>GSTIN:</strong> {gstNumber}
                            </div>
                        </div>
                        <div className="w-[20%] border-r border-black p-1 flex items-center justify-center">
                            <img src="/upi_qr.png" alt="QR" className="w-20 h-20 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                        </div>
                        <div className="w-[40%] p-2 text-xs">
                            <div className="flex justify-between mb-1"><strong>Bill No:</strong> <span>{bill.id}</span></div>
                            <div className="flex justify-between mb-1"><strong>Bill Date:</strong> <span>{billDate}</span></div>
                            <div className="mt-1 pt-1 border-t border-dashed border-black">
                                <div className="font-bold mb-0.5">Customer Details:</div>
                                <div className="flex justify-between"><span>{bill.customerName || 'Walk-in'}</span></div>
                                <div className="flex justify-between"><span>{bill.customerPhone}</span></div>
                                {bill.customerAddress && <div>{bill.customerAddress}</div>}
                                {/* {bill.customerGst && <div>GST: {bill.customerGst}</div>} */}
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-grow">
                        <table className="w-full border-collapse text-[10px]">
                            <thead>
                                <tr className="border-b border-black">
                                    <th className="border-r border-black px-1 py-0.5 w-[5%]">SN</th>
                                    <th className="border-r border-black px-1 py-0.5 w-[36%] text-left">PARTICULARS</th>
                                    <th className="border-r border-black px-1 py-0.5 w-[8%] text-right">MRP</th>
                                    <th className="border-r border-black px-1 py-0.5 w-[5%]">QTY</th>
                                    <th className="border-r border-black px-1 py-0.5 w-[8%] text-right">RATE</th>
                                    <th className="border-r border-black px-1 py-0.5 w-[5%]">DIS%</th>
                                    <th className="border-r border-black px-1 py-0.5 w-[9%] text-right">TAXABLE</th>
                                    <th className="border-r border-black px-1 py-0.5 w-[8%] text-center">GST</th>
                                    <th className="px-1 py-0.5 w-[16%] text-right">AMOUNT</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr key={idx} className="border-none">
                                        <td className="border-r border-black px-1 text-center">{idx + 1}</td>
                                        <td className="border-r border-black px-1 text-left truncate max-w-[150px]">{item.productName}</td>
                                        <td className="border-r border-black px-1 text-right">{item.mrp ? item.mrp.toFixed(2) : '-'}</td>
                                        <td className="border-r border-black px-1 text-center">{item.qty}</td>
                                        <td className="border-r border-black px-1 text-right">{item.unitPrice.toFixed(2)}</td>
                                        <td className="border-r border-black px-1 text-center">{item.discountRate}%</td>
                                        <td className="border-r border-black px-1 text-right">{item.taxableAmount.toFixed(2)}</td>
                                        <td className="border-r border-black px-1 text-center">{item.gstRate}%</td>
                                        <td className="px-1 text-right">{item.totalLine.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {/* Fill empty rows */}
                                {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, i) => (
                                    <tr key={`empty-${i}`} className="h-4">
                                        <td className="border-r border-black"></td><td className="border-r border-black"></td>
                                        <td className="border-r border-black"></td><td className="border-r border-black"></td>
                                        <td className="border-r border-black"></td><td className="border-r border-black"></td>
                                        <td className="border-r border-black"></td><td className="border-r border-black"></td>
                                        <td className="border-r border-black"></td><td className="border-r border-black"></td>
                                        <td className="border-r border-black"></td><td className="border-r border-black"></td>
                                        <td className="border-r border-black"></td><td className="border-r border-black"></td>
                                        <td></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-black flex text-[9px]">
                        <div className="w-[35%] border-r border-black p-1">
                            <div className="flex justify-between font-bold border-b border-black mb-1">
                                <span>GST</span><span>Taxable</span><span>SGST</span><span>CGST</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Avg</span>
                                <span>{totalTaxable.toFixed(2)}</span>
                                <span>{(totalGst / 2).toFixed(2)}</span>
                                <span>{(totalGst / 2).toFixed(2)}</span>
                            </div>
                            <div className="mt-2 font-bold text-[10px] leading-tight pt-2 border-t border-black">
                                Rupees {amountInWords}
                            </div>
                        </div>

                        <div className="w-[65%] flex">
                            <div className="w-[50%] border-r border-black p-1 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between"><strong>Items:</strong> {items.length} <strong>Qty:</strong> {totalQty}</div>
                                </div>
                                <div className="text-[8px] mt-1">
                                    <strong>Company's Bank Details</strong>
                                </div>
                            </div>

                            <div className="w-[50%] p-1 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between mb-0.5"><span>SubTotal:</span> <span>{totalTaxable.toFixed(2)}</span></div>
                                    {bill.billType !== 'ESTIMATE' && (
                                        <>
                                            <div className="flex justify-between mb-0.5"><span>CGST:</span> <span>{(totalGst / 2).toFixed(2)}</span></div>
                                            <div className="flex justify-between mb-0.5"><span>SGST:</span> <span>{(totalGst / 2).toFixed(2)}</span></div>
                                        </>
                                    )}
                                    <div className="flex justify-between mb-0.5"><span>Round Off:</span> <span>{roundOff.toFixed(2)}</span></div>
                                    <div className="flex justify-between font-bold text-sm border-t border-b border-black py-0.5 mt-0.5">
                                        <span>Net Amount:</span> <span>{finalAmount.toFixed(2)}</span>
                                    </div>
                                </div>
                                <div className="text-center mt-2 pt-4 flex flex-col items-center">
                                    <div className="text-[10px] font-bold mb-4 italic text-gray-700">
                                        *** {billMessage} ***
                                    </div>
                                    <span className="font-bold border-t border-black pt-1 px-4">Authorised Signatory</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white; -webkit-print-color-adjust: exact; }
            .print-container { box-shadow: none; margin: 0; width: 100%; }
          }
        `}</style>
        </div>
    );
};

export default BillView;
