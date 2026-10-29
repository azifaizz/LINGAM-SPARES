import React from 'react';
import paymentQR from "../../assets/payment-qr.jpeg";

interface EstimationItem {
  name: string;
  qty: number | string;
  unit?: string;
  rate: number;
  discount?: number | string;
  total: number;
}

interface EstimationPrintProps {
  company: {
    name: string;
    address: string;
    phone?: string;
    gstin: string;
    email: string;
    state?: string;
  };
  estimation: {
    id: string;
    date: string;
  };
  customer: {
    name: string;
    phone: string;
    address?: string; // Bill To
    shippingAddress?: string; // Ship To
  };
  items: EstimationItem[];
  totals: {
    totalQty: number;
    grandTotal: number;
    amountInWords: string;
  };
  printedAt: string;
}

export const EstimationPrint: React.FC<EstimationPrintProps> = ({
  company,
  estimation,
  customer,
  items,
  totals,
  printedAt
}) => {
  const formatQty = (value: any) => {
    const num = Number(value);
    if (isNaN(num)) return value;
    return num.toString();
  };

  // Logic for Fixed Height / Dummy Rows
  const MIN_ROWS = 25;
  const itemsCount = items.length;
  const emptyRowsCount = Math.max(0, MIN_ROWS - itemsCount);
  const emptyRows = Array.from({ length: emptyRowsCount });

  const styles = `
    @media print {
      @page {
        size: A5 portrait;
        margin: 8mm;
      }
      body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        height: 100%;
      }
      .a5-container {
        height: 100%; /* Force container to fill page for borders */
      }
    }
    body {
      font-family: "Times New Roman", serif;
      font-size: 9.5px;
      line-height: 1.1;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 0;
    }
    .a5-container {
      width: 132mm;
      margin: 0 auto;
      background: white;
      position: relative;
    }

    /* Header Outside */
    .header-outside {
      position: relative;
      margin-bottom: 2px;
      height: 15px; 
    }
    .memo-title {
      float: left;
      width: 100%;
      text-align: center;
      font-weight: bold;
      font-size: 11px;
      margin-top: 5px;
    }
    .printed-on {
      position: absolute;
      right: 0;
      top: 0;
      font-size: 9px;
      line-height: 15px;
      text-align: right;
    }

    /* Master Table */
    .master-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      table-layout: fixed;
    }
    .master-table th, .master-table td {
      border: 1px solid #000;
      padding: 1px 2px;
      vertical-align: top;
      word-wrap: break-word;
      font-size: 9px;
    }

    /* Thead Repeats */
    thead {
      display: table-header-group;
    }
    
    tr {
      page-break-inside: avoid;
    }

    /* Layout Nested Tables */
    .layout-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0;
      padding: 0;
      border: none;
      table-layout: fixed; /* FIX 1: Strict 50/50 */
    }
    .layout-table td {
      border: none;
      padding: 4px; /* FIX 1: Equal padding */
      vertical-align: top;
      width: 50%; /* FIX 1: Explicit 50% */
      box-sizing: border-box;
    }

    .company-name {
      font-weight: bold;
      text-transform: uppercase;
      font-size: 11px;
      margin-bottom: 1px;
    }
    
    /* FIX 2: Relaxed height to prevent collision */
    .customer-stack {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .cust-section {
       /* Removes strict height */
    }
    .cust-divider {
      border-top: 1px solid #000;
      margin: 2px 0;
    }
    /* FIX 2: Collision Padding */
    .buyer-section {
      padding-bottom: 6px; 
    }

    .invoice-row td {
      text-align: left;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 2px 4px;
      font-weight: bold;
    }

    .product-header th {
      font-weight: bold;
      text-align: center;
      font-size: 9.5px;
      background: #fff;
      height: 15px;
    }

    /* Product Rows */
    .product-row td {
      height: 14px;
    }

    /* Total Row */
    .total-row td {
      font-weight: bold;
      border-top: 1px solid #000;
      padding: 3px 2px;
    }

    /* Footer Layout */
    .footer-wrapper-td {
      padding: 0 !important;
      border-top: 1px solid #000;
    }
    .footer-table {
      width: 100%;
      border-collapse: collapse;
      border: none;
    }
    .footer-table td {
      padding: 0;
      vertical-align: top;
    }
    
    .footer-left {
      width: 50%;
      /* FIX 3: Remove border-right here */
      border-right: none !important;
      padding: 2px 4px !important;
    }
    .footer-right {
      width: 50%;
      padding: 0 !important;
      border-left: 1px solid #000;
    }
    
    .bank-details-wrapper {
      padding: 2px 4px;
      min-height: 70px;
    }

    /* Signature Section */
    .signature-section {
      border-top: 1px solid #000; 
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: 4px;
      min-height: 80px;
      width: 100%;
      box-sizing: border-box;
    }

    /* Bank Mini Table */
    .bank-mini-table {
      width: 100%;
      border-collapse: collapse;
    }
    .bank-mini-table td {
      padding: 0;
      border: none;
      font-size: 9px;
    }

    .declaration-container {
      margin-top: 5px; 
      padding-top: 5px;
    }

    .thanks-text {
      text-align: center;
      text-transform: uppercase;
      font-size: 10px;
      font-weight: bold;
      margin-top: 5px;
    }
        /* Remove horizontal lines BETWEEN product rows only */
    .master-table tbody tr.product-row td {
        border-top: none !important;
        border-bottom: none !important;
    }

    /* Keep vertical column lines */
    .master-table tbody tr.product-row td {
        border-left: 1px solid #000 !important;
        border-right: 1px solid #000 !important;
    }

    /* Make sure header bottom border stays strong */
    .product-header th {
        border-bottom: 2px solid #000 !important;
    }

    /* Optional: subtle separator before total row (looks clean & professional) */
    .master-table tbody tr.product-row:last-child td {
        border-bottom: 1px solid #ddd !important;
    }

    /* Total row keeps its top border visible */
    .total-row td {
        border-top: 1px solid #000 !important;
    }
  `;

  return (
    <div className="a5-container">
      <style>{styles}</style>

      {/* Header Outside */}
      <div className="header-outside">
        <div className="memo-title">Memo</div>
        <div className="printed-on">Printed on : {printedAt}</div>
      </div>

      <table className="master-table">
        <colgroup>
          <col style={{ width: '8mm' }} />
          <col style={{ width: '52mm' }} />
          <col style={{ width: '18mm' }} />
          <col style={{ width: '18mm' }} />
          <col style={{ width: '10mm' }} />
          <col style={{ width: '12mm' }} />
          <col style={{ width: '14mm' }} />
        </colgroup>

        <thead>
          {/* Row 1: Shop | Customer (FIX 1: strict 50/50 nested) */}
          <tr>
            <td colSpan={7} style={{ padding: 0, border: '1px solid #000' }}>
              <table className="layout-table">
                <tbody>
                  <tr className="header-split-row">
                    {/* LEFT 50%*/}
                    <td style={{ borderRight: '1px solid #000' }}>
                      <div className="company-name">Lingam Spares</div>
                      <div>No : 32 ,Ground Floor, Pattala Street, Kanchipuram - 631501</div>
                      <div>GPay No: 9626956999</div>
                      <div>GSTIN/UIN: 33BJLPN3590D1Z7</div>
                      <div>State: Tamil Nadu,Code : 33</div>
                      <div>Email: lingamspares@gmail.com</div>
                    </td>

                    {/* RIGHT 50% */}
                    <td>
                      <div className="customer-stack">
                        <div className="cust-section">
                          <span style={{ fontWeight: 'bold' }}>Consignee (Ship to)</span><br />
                          <span style={{ fontWeight: 'bold' }}>{customer.name}</span><br />

                          Contact No: {customer.phone}
                        </div>
                        <div className="cust-divider"></div>
                        {/* FIX 2: Buyer Collision */}
                        <div className="cust-section buyer-section">
                          <span style={{ fontWeight: 'bold' }}>Buyer (Bill to)</span><br />
                          <span style={{ fontWeight: 'bold' }}>{customer.name}</span><br />
                          Contact No: {customer.phone}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* Row 2: Invoice Info */}
          <tr className="invoice-row">
            <td colSpan={7}>
              <span style={{ display: 'inline-block', width: '40%' }}>Invoice No : {estimation.id}</span>
              <span style={{ display: 'inline-block', width: '30%' }}>Date : {estimation.date}</span>
              <span style={{ display: 'inline-block', width: '30%' }}>e-Way Bill No : </span>
            </td>
          </tr>

          {/* Row 3: Product Headers */}
          <tr className="product-header">
            <th>Sl No</th>
            <th>Description of Goods</th>
            <th>Quantity</th>
            <th>Rate</th>
            <th>per</th>
            <th>Disc %</th>
            <th>Amount</th>
          </tr>
        </thead>

        <tbody>
          {/* 1. Real Items */}
          {items.map((item, index) => {
            const isTransport = (item as any).name === 'Transport Charge';
            return (
            <tr key={`item-${index}`} className="product-row">
              <td style={{ textAlign: 'center' }}>{index + 1}</td>
              <td style={{ textAlign: 'left' }}>{item.name}</td>
              <td style={{ textAlign: 'center' }}>{isTransport ? '' : `${formatQty(item.qty)} ${item.unit || 'Nos'}`}</td>
              <td style={{ textAlign: 'right' }}>{isTransport ? '' : item.rate.toFixed(2)}</td>
              <td style={{ textAlign: 'center' }}>{isTransport ? '' : (item.unit || 'Nos')}</td>
              <td style={{ textAlign: 'center' }}>{isTransport ? '' : (item.discount ? Number(item.discount).toFixed(2) : "")}</td>
              <td style={{ textAlign: 'right' }}>{item.total.toFixed(2)}</td>
            </tr>
            );
          })}

          {/* 2. Dummy Filler Rows */}
          {emptyRows.map((_, index) => (
            <tr key={`empty-${index}`} className="product-row">
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
          ))}

          {/* 3. Total Row (Embedded) */}
          <tr className="total-row">
            <td></td>
            <td style={{ textAlign: 'right' }}>Total</td>
            <td style={{ textAlign: 'center' }}></td>
            <td></td>
            <td></td>
            <td></td>
            <td style={{ textAlign: 'right' }}>₹ {totals.grandTotal.toFixed(2)}</td>
          </tr>

          {/* 4. Footer Row */}
          <tr>
            <td colSpan={7} className="footer-wrapper-td">
              <table className="footer-table">
                <tbody>
                  <tr>
                    {/* LEFT FOOTER 50% */}
                    <td className="footer-left">
                      {/* Block 1: Amounts */}
                      <div style={{ minHeight: '60px' }}>
                        <div style={{ marginBottom: '2px' }}>Amount Chargeable (in words)</div>
                        <div style={{ fontWeight: 'bold', textTransform: 'capitalize', marginBottom: '10px' }}>
                          INR {totals.amountInWords}
                        </div>
                        <div style={{ marginBottom: '2px' }}>Scan to pay</div>
                      </div>

                      {/* Billing QR Insertion */}
                      <div style={{ margin: '2px 0' }}>
                        <img
                          src={paymentQR}
                          alt="Payment QR"
                          style={{ width: '65px', height: 'auto' }}
                        />
                      </div>

                      {/* Block 2: Declaration */}
                      <div className="declaration-container">
                        <span style={{ textDecoration: 'underline' }}>Declaration:</span><br />
                        <div style={{ textAlign: 'justify' }}>
                          We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                        </div>
                      </div>
                    </td>

                    {/* RIGHT FOOTER 50% */}
                    <td className="footer-right">
                      {/* Block 1: Bank Details */}
                      <div className="bank-details-wrapper" style={{ minHeight: '60px' }}>
                        <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', marginBottom: '2px', display: 'inline-block' }}>
                          Company's Bank Details
                        </div>
                      </div>

                      {/* Block 2: Signature with Vertical Divider RESTORED per request */}
                      <div className="signature-section">
                        <div style={{ fontWeight: 'bold' }}>For Lingam Spares</div>
                        <div style={{ fontWeight: 'bold' }}>Authorized Signatory</div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Thanks Outside */}
      <div className="thanks-text">THANKS FOR YOUR BUSINESS</div>
    </div>
  );
};

export default EstimationPrint;

