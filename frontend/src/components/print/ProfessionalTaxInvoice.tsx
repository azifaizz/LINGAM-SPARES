import React from 'react';

import paymentQR from "../../assets/payment-qr.jpeg";

interface BillItem {
    productName: string;
    colourCode?: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    discountRate: number;
    hsnsac?: string;
    taxableValue: number;
    cgstPercent: number;
    sgstPercent: number;
    cgstAmount: number;
    sgstAmount: number;
    netAmount: number;
}

interface ProfessionalTaxInvoiceProps {
    bill: any;
    items: BillItem[];
    company: any;
    numberToWords: (num: number) => string;
}

const ProfessionalTaxInvoice: React.FC<ProfessionalTaxInvoiceProps> = ({
    bill: inputBill,
    items: inputItems,
    company,
    numberToWords
}) => {
    const bill = (inputBill as any)?.data || inputBill || {};
    const items = (Array.isArray(inputItems) && inputItems.length > 0) ? inputItems :
        (Array.isArray((bill as any).items) ? (bill as any).items :
            (Array.isArray((bill as any).products) ? (bill as any).products :
                (Array.isArray((bill as any).gstItems) ? (bill as any).gstItems : [])));

    if (!items || items.length === 0) {
        return <div style={{ padding: '80px 40px', textAlign: 'center' }}>No Items Found</div>;
    }

    const billTotalTaxable = Number(bill.totalTaxable || 0);
    const billTotalCGST = Number(bill.totalCGST || 0);
    const billTotalSGST = Number(bill.totalSGST || 0);
    const billTotalGstAmount = Number(bill.totalGstAmount || 0);
    const billFinalAmount = Number(bill.finalAmount || 0);
    const billRoundOff = Number(bill.roundOffAmount || 0);

    const productCGSTTotal = items.reduce((sum, item) => sum + Number(item.cgstAmount || 0), 0);
    const productSGSTTotal = items.reduce((sum, item) => sum + Number(item.sgstAmount || 0), 0);

    const billDate = (bill.createdAt && !isNaN(new Date(bill.createdAt).getTime()))
        ? new Date(bill.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'N/A';

    const formatQty = (value: any) => {
        const num = Number(value);
        if (isNaN(num)) return value;
        return num.toString();
    };

    const renderFittingValue = (value: string | number, maxWidthChars: number = 8) => {
        const str = value.toString();
        let fontSize = '12px';
        if (str.length > maxWidthChars) {
            const over = str.length - maxWidthChars;
            const reduction = over * 0.9; // 0.9px reduction per char over limit
            fontSize = `${Math.max(7, 12 - reduction)}px`;
        }
        return <span style={{ fontSize, display: 'inline-block' }}>{str}</span>;
    };

    const totalQuantity = items.filter((it: any) => it.productId !== 'TRANSPORT_CHARGE').reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    // ====================== CONSTANTS (UPDATED - reduced by 1 row) ======================
    const SINGLE_PAGE_MAX = 4;        // ≤5 products → single page with fixed 5-row table + footer
    const PAGE1_MAX = 22;             // First product page in multi-page (full height, reduced by 1)
    const LAST_PAGE_DEFAULT_ROWS = 5; // 2nd page (or any last page when forced) always shows exactly 5 rows (blank if needed)

    // ====================== PAGINATION LOGIC (no other changes) ======================
    const pages: any[] = [];
    let remaining = [...items];

    if (items.length <= SINGLE_PAGE_MAX) {
        // Single page: fixed 5-row product table + footer
        pages.push({
            isFirst: true,
            items: [...items],
            emptyRows: SINGLE_PAGE_MAX - items.length,
            showFooter: true,
            pageIndex: 0
        });
    } else {
        // MULTI-PAGE (6+ products)
        // Page 1: All products (up to PAGE1_MAX) + pad to FULL table height
        const p1Items = remaining.splice(0, Math.min(PAGE1_MAX, items.length));
        const p1Empty = PAGE1_MAX - p1Items.length;

        pages.push({
            isFirst: true,
            items: p1Items,
            emptyRows: p1Empty,
            showFooter: false,
            pageIndex: 0
        });

        // If no more products left (6–23 items total) → create dedicated 2nd page with 5 blank rows + footer
        if (remaining.length === 0) {
            pages.push({
                isFirst: false,
                items: [],
                emptyRows: LAST_PAGE_DEFAULT_ROWS,
                showFooter: true,
                pageIndex: 1
            });
        } else {
            // Normal continued pages for >23 items
            let pIndex = 1;
            while (remaining.length > 0) {
                const chunk = remaining.splice(0, 10);
                const isLast = remaining.length === 0;
                const emptyRows = 0;

                pages.push({
                    isFirst: false,
                    items: chunk,
                    emptyRows,
                    showFooter: isLast,
                    pageIndex: pIndex
                });
                pIndex++;
            }
        }
    }

    // ====================== SHARED RENDER FUNCTIONS ======================
    const renderHeaderP1 = () => (
        <>
            <table className="header-table invoice-table" style={{ border: 'none' }}>
                <tbody>
                    <tr><td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', border: 'none' }}>Tax Invoice</td></tr>
                    <tr><td style={{ textAlign: 'center', fontSize: '9px', border: 'none' }}>(ORIGINAL FOR RECIPIENT / DUPLICATE FOR TRANSPORTER / TRIPLICATE FOR SUPPLIER)</td></tr>
                </tbody>
            </table>

            <table className="invoice-table" style={{ marginTop: '2px', border: '1px solid #000' }}>
                <tbody>
                    <tr>
                        <td style={{ width: '60%', borderRight: '1px solid #000', padding: '6px' }}>
                            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '10px' }}>
                                
                                <div>
                                    <div className="font-bold">{company.name}</div>
                                    <div>{company.address}</div>
                                    <div>GSTIN/UIN: <span className="font-bold">{company.gstin}</span></div>
                                    <div>State Name: <span className="font-bold">{company.state}</span></div>
                                    <div>Gpay No: <span className="font-bold">{company.phone}</span></div>
                                </div>
                            </div>
                        </td>
                        <td style={{ width: '40%', padding: 0 }}>
                            <table style={{ borderCollapse: 'collapse', border: 'none' }}>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid #000' }}>
                                        <td style={{ width: '50%', borderRight: '1px solid #000', padding: '4px' }}>Invoice No.<br /><span className="font-bold">{bill.invoiceNumber || bill.id}</span></td>
                                        <td style={{ padding: '4px' }}>Dated<br /><span className="font-bold">{billDate}</span></td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #000' }}>
                                        <td style={{ borderRight: '1px solid #000', padding: '4px' }}>Delivery Note</td>
                                        <td style={{ padding: '4px' }}>Mode/Terms of Payment</td>
                                    </tr>
                                    <tr>
                                        <td style={{ borderRight: '1px solid #000', padding: '4px' }}>Vehicle No</td>
                                        <td style={{ padding: '4px' }}>{bill.vehicleNo || '-'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td className="address-cell" style={{ padding: '4px' }}>
                            <div className="font-bold">Consignee (Ship To)</div>
                            <div className="font-bold">{bill.isShipToDifferent ? (bill.shipToName || bill.customerName) : bill.customerName}</div>
                            <div>{bill.isShipToDifferent ? (bill.shipToAddress || bill.customerAddress || '-') : (bill.customerAddress || '-')}</div>
                            <div>GSTIN/UIN: <span className="font-bold">{bill.isShipToDifferent ? (bill.shipToGst || bill.customerGst || '-') : (bill.customerGst || '-')}</span></div>
                            <div>State Code: <span className="font-bold">{bill.buyerStateCode || ''}</span></div>
                        </td>
                        <td style={{ padding: 0 }}>
                            <table style={{ borderCollapse: 'collapse', border: 'none' }}>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid #000' }}>
                                        <td style={{ width: '50%', borderRight: '1px solid #000', padding: '4px' }}>Buyer's Order No.</td>
                                        <td style={{ padding: '4px' }}>Dated</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #000' }}>
                                        <td style={{ borderRight: '1px solid #000', padding: '4px' }}>Dispatch Doc No.</td>
                                        <td style={{ padding: '4px' }}>Delivery Note Date</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #000' }}>
                                        <td style={{ borderRight: '1px solid #000', padding: '4px' }}>Dispatched through</td>
                                        <td style={{ padding: '4px' }}>{bill.dispatchThrough || '-'}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ borderRight: '1px solid #000', padding: '4px' }}>Destination</td>
                                        <td style={{ padding: '4px' }}>{bill.destination || '-'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                    <tr style={{ borderBottom: 'none' }}>
                        <td className="address-cell" style={{ padding: '4px' }}>
                            <div className="font-bold">Buyer (Bill To)</div>
                            <div className="font-bold">{bill.customerName}</div>
                            <div>{bill.customerAddress || 'N/A'}</div>
                            <div>GSTIN/UIN: <span className="font-bold">{bill.customerGst || 'N/A'}</span></div>
                            <div>State Code: <span className="font-bold">{bill.buyerStateCode || ''}</span></div>
                        </td>
                        <td style={{ borderBottom: 'none', padding: 0 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
                                <tbody>
                                    <tr><td style={{ padding: 4, borderBottom: '1px solid #000', fontWeight: 'bold' }}>Terms of Delivery</td></tr>
                                    {bill.termsOfDelivery && <tr><td style={{ padding: 4 }}>{bill.termsOfDelivery}</td></tr>}
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
        </>
    );

    const renderHeaderContinued = (pageNum: number) => (
        <>
            <table className="header-table invoice-table" style={{ border: 'none' }}>
                <tbody>
                    <tr><td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', border: 'none' }}>Tax Invoice (Page {pageNum})</td></tr>
                    <tr><td style={{ textAlign: 'center', fontSize: '9px', border: 'none' }}>(ORIGINAL FOR RECIPIENT / DUPLICATE FOR TRANSPORTER / TRIPLICATE FOR SUPPLIER)</td></tr>
                </tbody>
            </table>

            <table className="invoice-table" style={{ marginTop: '2px', border: '1px solid #000' }}>
                <tbody>
                    <tr>
                        <td style={{ width: '60%', borderRight: '1px solid #000', padding: '6px', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                <div>
                                    <div className="font-bold">{company.name}</div>
                                    <div>{company.address}</div>
                                    <div>GSTIN/UIN: <span className="font-bold">{company.gstin}</span></div>
                                    <div>State Name: <span className="font-bold">{company.state}</span></div>
                                    <div>Gpay No: <span className="font-bold">{company.phone}</span></div>
                                </div>
                            </div>
                        </td>
                        <td style={{ width: '40%', padding: 0 }}>
                            <table style={{ borderCollapse: 'collapse', border: 'none' }}>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid #000' }}>
                                        <td style={{ width: '50%', borderRight: '1px solid #000', padding: '4px' }}>Invoice No.<br /><span className="font-bold">{bill.invoiceNumber || bill.id}</span></td>
                                        <td style={{ padding: '4px' }}>Dated<br /><span className="font-bold">{billDate}</span></td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #000' }}>
                                        <td style={{ borderRight: '1px solid #000', padding: '4px' }}>Delivery Note</td>
                                        <td style={{ padding: '4px' }}>Mode/Terms of Payment</td>
                                    </tr>
                                    <tr>
                                        <td style={{ borderRight: '1px solid #000', padding: '4px' }}>Vehicle No</td>
                                        <td style={{ padding: '4px' }}>{bill.vehicleNo || '-'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td className="address-cell" style={{ padding: '4px' }}>
                            <div className="font-bold">Buyer (Bill To)</div>
                            <div className="font-bold">{bill.customerName}</div>
                            <div>{bill.customerAddress || 'N/A'}</div>
                            <div>GSTIN/UIN: <span className="font-bold">{bill.customerGst || 'N/A'}</span></div>
                            <div>State Code: <span className="font-bold">{bill.buyerStateCode || ''}</span></div>
                        </td>
                        <td style={{ padding: 0 }}>
                            <table style={{ borderCollapse: 'collapse', border: 'none' }}>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid #000' }}>
                                        <td style={{ width: '50%', borderRight: '1px solid #000', padding: '4px' }}>Buyer's Order No.</td>
                                        <td style={{ padding: '4px' }}>Dated</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #000' }}>
                                        <td style={{ borderRight: '1px solid #000', padding: '4px' }}>Dispatch Doc No.</td>
                                        <td style={{ padding: '4px' }}>Delivery Note Date</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #000' }}>
                                        <td style={{ borderRight: '1px solid #000', padding: '4px' }}>Dispatched through</td>
                                        <td style={{ padding: '4px' }}>{bill.dispatchThrough || '-'}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ borderRight: '1px solid #000', padding: '4px' }}>Destination</td>
                                        <td style={{ padding: '4px' }}>{bill.destination || '-'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
        </>
    );

    const renderProductTableHeader = () => (
        <thead>
            <tr className="font-bold">
                <th style={{ width: '7%', borderTop: 'none' }}>Sl No.</th>
                <th style={{ width: '43%', borderTop: 'none' }}>Description of Goods</th>
                <th style={{ width: '12%', borderTop: 'none' }}>HSN/SAC</th>
                <th style={{ width: '10%', borderTop: 'none' }}>Quantity</th>
                <th style={{ width: '11%', borderTop: 'none' }}>Rate</th>
                <th style={{ width: '7%', borderTop: 'none' }}>per</th>
                <th style={{ width: '10%', borderTop: 'none' }}>Amount</th>
            </tr>
        </thead>
    );

    const renderFooter = () => {
        // HSN table fixed to ONLY 3 rows max (Top 2 HSNs + Others) - as requested
        let hsnRows = Object.values(items.reduce((acc: any, item) => {
            const hsn = item.hsnsac || '-';
            if (!acc[hsn]) acc[hsn] = { hsn, taxable: 0, cgstR: item.cgstPercent, cgstA: 0, sgstR: item.sgstPercent, sgstA: 0 };
            acc[hsn].taxable += Number(item.taxableValue || 0);
            acc[hsn].cgstA += Number(item.cgstAmount || 0);
            acc[hsn].sgstA += Number(item.sgstAmount || 0);
            return acc;
        }, {}));

        if (hsnRows.length > 3) {
            hsnRows.sort((a: any, b: any) => b.taxable - a.taxable);
            const top = hsnRows.slice(0, 2);
            const others = hsnRows.slice(2).reduce((acc: any, curr: any) => {
                acc.taxable += curr.taxable;
                acc.cgstA += curr.cgstA;
                acc.sgstA += curr.sgstA;
                if (!acc._cgstMap) acc._cgstMap = {};
                if (!acc._sgstMap) acc._sgstMap = {};
                acc._cgstMap[curr.cgstR] = (acc._cgstMap[curr.cgstR] || 0) + curr.taxable;
                acc._sgstMap[curr.sgstR] = (acc._sgstMap[curr.sgstR] || 0) + curr.taxable;
                return acc;
            }, { hsn: 'Others', taxable: 0, cgstR: 0, cgstA: 0, sgstR: 0, sgstA: 0 });
            const majorityCgst = Object.entries(others._cgstMap).sort((a: any, b: any) => b[1] - a[1])[0];
            const majoritySgst = Object.entries(others._sgstMap).sort((a: any, b: any) => b[1] - a[1])[0];
            others.cgstR = majorityCgst ? Number(majorityCgst[0]) : 0;
            others.sgstR = majoritySgst ? Number(majoritySgst[0]) : 0;
            delete others._cgstMap;
            delete others._sgstMap;
            top.push(others);
            hsnRows = top;
        }

        return (
            <>
                <tr className="product-row">
                    <td style={{ borderTop: '1px solid #000' }}></td>
                    <td className="text-right" style={{ borderTop: '1px solid #000' }}>CGST @ {(items[0]?.cgstPercent || 0)}%</td>
                    <td style={{ borderTop: '1px solid #000' }}></td><td style={{ borderTop: '1px solid #000' }}></td>
                    <td style={{ borderTop: '1px solid #000' }}></td><td style={{ borderTop: '1px solid #000' }}></td>
                    <td className="text-right font-bold" style={{ borderTop: '1px solid #000' }}>{renderFittingValue(productCGSTTotal.toFixed(2))}</td>
                </tr>
                <tr className="product-row">
                    <td></td><td className="text-right">SGST @ {(items[0]?.sgstPercent || 0)}%</td>
                    <td></td><td></td><td></td><td></td>
                    <td className="text-right font-bold">{renderFittingValue(productSGSTTotal.toFixed(2))}</td>
                </tr>
                {billRoundOff !== 0 && (
                    <tr className="product-row">
                        <td></td><td className="text-right">Round Off</td>
                        <td></td><td></td><td></td><td></td>
                        <td className="text-right font-bold">{billRoundOff.toFixed(2)}</td>
                    </tr>
                )}
                <tr className="font-bold" style={{ height: '20px' }}>
                    <td style={{ borderTop: '1px solid #000' }}></td>
                    <td className="text-right" style={{ borderTop: '1px solid #000' }}>Total</td>
                    <td style={{ borderTop: '1px solid #000' }}></td>
                    <td className="text-center" style={{ borderTop: '1px solid #000' }}></td>
                    <td style={{ borderTop: '1px solid #000' }}></td><td style={{ borderTop: '1px solid #000' }}></td>
                    <td className="text-right" style={{ borderTop: '1px solid #000' }}>₹ {renderFittingValue(billFinalAmount.toFixed(2))}</td>
                </tr>
                <tr><td colSpan={7} className="text-right" style={{ fontSize: '10px', fontStyle: 'italic', padding: '2px 4px', borderTop: 'none', borderBottom: 'none' }}>E. & O.E.</td></tr>

                <tr className="footer-row">
                    <td colSpan={7} style={{ borderBottom: '1px solid #000', borderTop: '1px solid #000', padding: '4px' }}>
                        <div>Amount Chargeable (in words)</div>
                        <div className="font-bold">INR {numberToWords(billFinalAmount)}</div>
                    </td>
                </tr>

                <tr className="footer-row">
                    <td colSpan={7} style={{ padding: 0, borderBottom: '1px solid #000' }}>
                        <table className="tax-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: 'none' }}>
                            <thead>
                                <tr className="font-bold">
                                    <th style={{ width: '12%', borderBottom: '1px solid #000', borderRight: '1px solid #000', padding: '3px' }}>HSN/SAC</th>
                                    <th style={{ width: '18%', borderBottom: '1px solid #000', borderRight: '1px solid #000', padding: '3px' }}>Taxable Value</th>
                                    <th style={{ width: '12%', borderBottom: '1px solid #000', borderRight: '1px solid #000', padding: '3px' }}>CGST Rate</th>
                                    <th style={{ width: '12%', borderBottom: '1px solid #000', borderRight: '1px solid #000', padding: '3px' }}>CGST Amt</th>
                                    <th style={{ width: '12%', borderBottom: '1px solid #000', borderRight: '1px solid #000', padding: '3px' }}>SGST Rate</th>
                                    <th style={{ width: '12%', borderBottom: '1px solid #000', borderRight: '1px solid #000', padding: '3px' }}>SGST Amt</th>
                                    <th style={{ width: '22%', borderBottom: '1px solid #000', padding: '3px' }}>Total Tax</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hsnRows.map((row: any, idx: number) => (
                                    <tr key={idx}>
                                        <td style={{ borderBottom: '1px solid #eee', borderRight: '1px solid #000', padding: '3px', whiteSpace: 'nowrap' }}>{row.hsn}</td>
                                        <td className="text-right" style={{ borderBottom: '1px solid #eee', borderRight: '1px solid #000', padding: '3px', whiteSpace: 'nowrap' }}>{renderFittingValue(row.taxable.toFixed(2))}</td>
                                        <td className="text-center" style={{ borderBottom: '1px solid #eee', borderRight: '1px solid #000', padding: '3px', whiteSpace: 'nowrap' }}>{row.cgstR}%</td>
                                        <td className="text-right" style={{ borderBottom: '1px solid #eee', borderRight: '1px solid #000', padding: '3px', whiteSpace: 'nowrap' }}>{renderFittingValue(row.cgstA.toFixed(2))}</td>
                                        <td className="text-center" style={{ borderBottom: '1px solid #eee', borderRight: '1px solid #000', padding: '3px', whiteSpace: 'nowrap' }}>{row.sgstR}%</td>
                                        <td className="text-right" style={{ borderBottom: '1px solid #eee', borderRight: '1px solid #000', padding: '3px', whiteSpace: 'nowrap' }}>{renderFittingValue(row.sgstA.toFixed(2))}</td>
                                        <td className="text-right font-bold" style={{ borderBottom: '1px solid #eee', padding: '3px', whiteSpace: 'nowrap' }}>{renderFittingValue((row.cgstA + row.sgstA).toFixed(2))}</td>
                                    </tr>
                                ))}
                                <tr className="font-bold" style={{ borderTop: '2px solid #000' }}>
                                    <td className="text-right" style={{ borderRight: '1px solid #000', padding: '3px' }}>Total</td>
                                    <td className="text-right" style={{ borderRight: '1px solid #000', padding: '3px' }}>{renderFittingValue(billTotalTaxable.toFixed(2))}</td>
                                    <td style={{ borderRight: '1px solid #000' }}></td>
                                    <td className="text-right" style={{ borderRight: '1px solid #000', padding: '3px' }}>{renderFittingValue(billTotalCGST.toFixed(2))}</td>
                                    <td style={{ borderRight: '1px solid #000' }}></td>
                                    <td className="text-right" style={{ borderRight: '1px solid #000', padding: '3px' }}>{renderFittingValue(billTotalSGST.toFixed(2))}</td>
                                    <td className="text-right" style={{ padding: '3px' }}>{renderFittingValue(billTotalGstAmount.toFixed(2))}</td>
                                </tr>
                            </tbody>
                        </table>
                    </td>
                </tr>
                <tr className="footer-row"><td colSpan={7} style={{ borderBottom: '1px solid #000', padding: '4px' }}>Tax Amount (in words) : <span className="font-bold">INR {numberToWords(billTotalGstAmount)}</span></td></tr>
                <tr className="footer-row">
                    <td colSpan={7} style={{ padding: '0', borderBottom: '1px solid #000' }}>
                        <table style={{ width: '100%', border: 'none' }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: '20%', padding: '4px', textAlign: 'center', border: 'none' }}>{paymentQR && <img src={paymentQR} alt="QR" style={{ width: '100px' }} />}</td>
                                    <td style={{ width: '80%', padding: '8px', border: 'none', verticalAlign: 'top' }}>
                                        <div className="font-bold" style={{ textDecoration: 'underline', marginBottom: '4px' }}>Company's Bank Details</div>
                                        {company.bankName && <div>Bank Name: <span className="font-bold">{company.bankName}</span></div>}
                                        {company.accountNo && <div>A/c No: <span className="font-bold">{company.accountNo}</span></div>}
                                        {company.ifsc && <div>IFSC: <span className="font-bold">{company.ifsc}</span></div>}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </td>
                </tr>
                <tr className="declaration-row">
                    <td colSpan={4} style={{ padding: '5px' }}><div className="font-bold">Declaration</div><div style={{ fontSize: '10px' }}>Actual price details and true particulars declared here.</div></td>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '5px' }}><div className="font-bold">For {company.name}</div><div style={{ marginTop: '30px' }} className="font-bold">Authorised Signatory</div></td>
                </tr>
            </>
        );
    };

    // ====================== RENDER ======================
    return (
        <>
            <style>
                {`
                @page { size: A4; margin: 0; }
                @media print { .invoice-page { break-after: page; } }
                .invoice-container { display: flex; flex-direction: column; align-items: center; background-color: #f0f0f0; padding: 20px 0; }
                .invoice-page {
                    width: 210mm; 
                    height: 297mm; 
                    padding: 8mm; 
                    box-sizing: border-box; 
                    background-color: #fff;
                    margin-bottom: 20px; 
                    font-family: Arial, sans-serif; 
                    font-size: 12px; 
                    line-height: 1.2;
                    position: relative; 
                    overflow: hidden;
                }
                @media print { .invoice-container { background-color: #fff; padding: 0; } .invoice-page { margin: 0; } }
                table { border-collapse: collapse; width: 100%; table-layout: fixed; }
                .invoice-table { border: 1px solid #000; }
                .invoice-table td, .invoice-table th { 
                    border: 1px solid #000; 
                    padding: 4px; 
                    vertical-align: top; 
                    overflow: hidden;
                }
                .product-row td { border-top: none !important; border-bottom: none !important; height: 18px; white-space: nowrap; }
                .product-row td.description-cell { white-space: normal; word-break: break-word; }
                .font-bold { font-weight: bold; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .qr-box { width: 45px; height: 45px; border: 1px solid #000; display: inline-block; }
                .tax-table th, .tax-table td { white-space: nowrap; overflow: hidden; font-size: 10px; }
                `}
            </style>

            <div className="invoice-container">
                {pages.map((p, idx) => {
                    const pageNum = idx + 1;
                    return (
                        <div className="invoice-page" key={idx}>
                            {p.isFirst ? renderHeaderP1() : renderHeaderContinued(pageNum)}
                            <table className="invoice-table" style={{ borderTop: 'none' }}>
                                {renderProductTableHeader()}
                                <tbody>
                                    {p.items.map((it: any, i: number) => {
                                        const sl = pages.slice(0, idx).reduce((a, x) => a + x.items.length, 0) + i + 1;
                                        const isTransport = it.productId === 'TRANSPORT_CHARGE';
                                        return (
                                            <tr key={i} className="product-row">
                                                <td className="text-center">{sl}</td>
                                                <td className="text-left font-bold description-cell">
                                                    {it.productName}
                                                    {it.colourCode && <span style={{ fontWeight: 'bold', fontSize: '11px', marginLeft: '5px' }}>({it.colourCode})</span>}
                                                </td>
                                                <td className="text-center">{it.hsnsac || '-'}</td>
                                                <td className="text-center">{isTransport ? '' : renderFittingValue(`${formatQty(it.quantity)} ${it.unit || 'Nos'}`, 12)}</td>
                                                <td className="text-right">{isTransport ? '' : renderFittingValue((it.taxableValue / (it.quantity || 1)).toFixed(2))}</td>
                                                <td className="text-center">{isTransport ? '' : (it.unit || 'Nos')}</td>
                                                <td className="text-right font-bold">{renderFittingValue(it.taxableValue.toFixed(2))}</td>
                                            </tr>
                                        );
                                    })}

                                    {Array.from({ length: p.emptyRows }).map((_, i) => (
                                        <tr key={`empty-${i}`} className="product-row">
                                            <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td>
                                        </tr>
                                    ))}

                                    {p.showFooter && renderFooter()}
                                </tbody>
                            </table>
                        </div>
                    );
                })}
            </div>
        </>
    );
};

export default ProfessionalTaxInvoice;

