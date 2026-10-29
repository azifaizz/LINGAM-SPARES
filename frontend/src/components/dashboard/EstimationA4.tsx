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

interface EstimationPrintA4Props {
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
    address?: string;
    shippingAddress?: string;
  };
  items: EstimationItem[];
  totals: {
    totalQty: number;
    grandTotal: number;
    amountInWords: string;
  };
  printedAt: string;
}

export const EstimationPrintA4: React.FC<EstimationPrintA4Props> = ({
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

  const MIN_ROWS = 35;
  const itemsCount = items.length;
  const emptyRowsCount = Math.max(0, MIN_ROWS - itemsCount);
  const emptyRows = Array.from({ length: emptyRowsCount });

  const styles = `
    @media print {
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
      body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        height: 100%;
      }
      .a4-container {
        height: 100%;
      }
    }
    body {
      font-family: "Times New Roman", serif;
      font-size: 10px;
      line-height: 1.2;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 0;
    }
    .a4-container {
      width: 190mm;
      margin: 0 auto;
      background: white;
      position: relative;
    }

    .header-outside {
      position: relative;
      margin-bottom: 2px;
      height: 18px;
    }
    .memo-title {
      float: left;
      width: 100%;
      text-align: center;
      font-weight: bold;
      font-size: 13px;
      margin-top: 5px;
    }
    .printed-on {
      position: absolute;
      right: 0;
      top: 0;
      font-size: 9px;
      line-height: 18px;
      text-align: right;
    }

    .master-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      table-layout: fixed;
    }
    .master-table th, .master-table td {
      border: 1px solid #000;
      padding: 2px 4px;
      vertical-align: top;
      word-wrap: break-word;
      font-size: 9.5px;
    }

    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: avoid;
    }

    .layout-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0;
      padding: 0;
      border: none;
      table-layout: fixed;
    }
    .layout-table td {
      border: none;
      padding: 6px;
      vertical-align: top;
      width: 50%;
      box-sizing: border-box;
    }

    .company-name {
      font-weight: bold;
      text-transform: uppercase;
      font-size: 12px;
      margin-bottom: 2px;
    }

    .customer-stack {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .cust-section {
    }
    .cust-divider {
      border-top: 1px solid #000;
      margin: 3px 0;
    }
    .buyer-section {
      padding-bottom: 6px;
    }

    .invoice-row td {
      text-align: left;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 3px 6px;
      font-weight: bold;
    }

    .product-header th {
      font-weight: bold;
      text-align: center;
      font-size: 10px;
      background: #fff;
      height: 18px;
    }

    .product-row td {
      height: 16px;
    }

    .total-row td {
      font-weight: bold;
      border-top: 1px solid #000;
      padding: 4px 4px;
    }

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
      border-right: none !important;
      padding: 4px 6px !important;
    }
    .footer-right {
      width: 50%;
      padding: 0 !important;
      border-left: 1px solid #000;
    }

    .bank-details-wrapper {
      padding: 4px 6px;
      min-height: 80px;
    }

    .signature-section {
      border-top: 1px solid #000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: 6px;
      min-height: 100px;
      width: 100%;
      box-sizing: border-box;
    }

    .bank-mini-table {
      width: 100%;
      border-collapse: collapse;
    }
    .bank-mini-table td {
      padding: 1px 0;
      border: none;
      font-size: 9.5px;
    }

    .declaration-container {
      margin-top: 8px;
      padding-top: 5px;
    }

    .thanks-text {
      text-align: center;
      text-transform: uppercase;
      font-size: 11px;
      font-weight: bold;
      margin-top: 8px;
    }

    .master-table tbody tr.product-row td {
      border-top: none !important;
      border-bottom: none !important;
    }
    .master-table tbody tr.product-row td {
      border-left: 1px solid #000 !important;
      border-right: 1px solid #000 !important;
    }
    .product-header th {
      border-bottom: 2px solid #000 !important;
    }
    .master-table tbody tr.product-row:last-child td {
      border-bottom: 1px solid #ddd !important;
    }
    .total-row td {
      border-top: 1px solid #000 !important;
    }
  `;

  return (
    <div className="a4-container">
      <style>{styles}</style>

      <div className="header-outside">
        <div className="memo-title">Memo</div>
        <div className="printed-on">Printed on : {printedAt}</div>
      </div>

      <table className="master-table">
        <colgroup>
          <col style={{ width: '10mm' }} />
          <col style={{ width: '60mm' }} />
          <col style={{ width: '22mm' }} />
          <col style={{ width: '22mm' }} />
          <col style={{ width: '14mm' }} />
          <col style={{ width: '16mm' }} />
          <col style={{ width: '20mm' }} />
        </colgroup>

        <thead>
          <tr>
            <td colSpan={7} style={{ padding: 0, border: '1px solid #000' }}>
              <table className="layout-table">
                <tbody>
                  <tr className="header-split-row">
                    <td style={{ borderRight: '1px solid #000' }}>
                      <div className="company-name">Lingam Spares</div>
                      <div>No : 32 ,Ground Floor, Pattala Street, Kanchipuram - 631501</div>
                      <div>GPay No: 9626956999</div>
                      <div>GSTIN/UIN: 33BJLPN3590D1Z7</div>
                      <div>State: Tamil Nadu,Code : 33</div>
                      <div>Email: lingamspares@gmail.com</div>
                    </td>

                    <td>
                      <div className="customer-stack">
                        <div className="cust-section">
                          <span style={{ fontWeight: 'bold' }}>Consignee (Ship to)</span><br />
                          <span style={{ fontWeight: 'bold' }}>{customer.name}</span><br />
                          Contact No: {customer.phone}
                        </div>
                        <div className="cust-divider"></div>
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

          <tr className="invoice-row">
            <td colSpan={7}>
              <span style={{ display: 'inline-block', width: '40%' }}>Invoice No : {estimation.id}</span>
              <span style={{ display: 'inline-block', width: '30%' }}>Date : {estimation.date}</span>
              <span style={{ display: 'inline-block', width: '30%' }}>e-Way Bill No : </span>
            </td>
          </tr>

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

          <tr className="total-row">
            <td></td>
            <td style={{ textAlign: 'right' }}>Total</td>
            <td style={{ textAlign: 'center' }}></td>
            <td></td>
            <td></td>
            <td></td>
            <td style={{ textAlign: 'right' }}>₹ {totals.grandTotal.toFixed(2)}</td>
          </tr>

          <tr>
            <td colSpan={7} className="footer-wrapper-td">
              <table className="footer-table">
                <tbody>
                  <tr>
                    <td className="footer-left">
                      <div style={{ minHeight: '70px' }}>
                        <div style={{ marginBottom: '3px' }}>Amount Chargeable (in words)</div>
                        <div style={{ fontWeight: 'bold', textTransform: 'capitalize', marginBottom: '12px' }}>
                          INR {totals.amountInWords}
                        </div>
                        <div style={{ marginBottom: '3px' }}>Scan to pay</div>
                      </div>

                      <div style={{ margin: '4px 0' }}>
                        <img
                          src={paymentQR}
                          alt="Payment QR"
                          style={{ width: '75px', height: 'auto' }}
                        />
                      </div>

                      <div className="declaration-container">
                        <span style={{ textDecoration: 'underline' }}>Declaration:</span><br />
                        <div style={{ textAlign: 'justify' }}>
                          We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                        </div>
                      </div>
                    </td>

                    <td className="footer-right">
                      <div className="bank-details-wrapper" style={{ minHeight: '60px' }}>
                        <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', marginBottom: '3px', display: 'inline-block' }}>
                          Company's Bank Details
                        </div>
                      </div>

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

      <div className="thanks-text">THANKS FOR YOUR BUSINESS</div>
    </div>
  );
};

export default EstimationPrintA4;

