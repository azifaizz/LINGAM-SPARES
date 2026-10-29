package com.Billing.Software.billing_service.Service;

import com.Billing.Software.billing_service.Entity.Bill;
import com.Billing.Software.billing_service.Entity.BillDetails;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class GstReportService {

    private final Firestore firestore;
    private static final String COL = "bills";
    private static final String CLIENT_NAME = "LINGAM SPARES";

    public byte[] generateMonthlyReport(String monthStr) throws Exception {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM");
        Date monthDate = sdf.parse(monthStr);

        Calendar cal = Calendar.getInstance();
        cal.setTime(monthDate);
        cal.set(Calendar.DAY_OF_MONTH, 1);
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        Date startDate = cal.getTime();

        cal.add(Calendar.MONTH, 1);
        Date endDate = cal.getTime();

        List<Bill> bills = firestore.collection(COL)
                .whereGreaterThanOrEqualTo("createdAt", startDate)
                .whereLessThan("createdAt", endDate)
                .orderBy("createdAt", Query.Direction.ASCENDING)
                .get().get()
                .toObjects(Bill.class);

        return createExcel(bills, monthStr);
    }

    private byte[] createExcel(List<Bill> bills, String monthStr) throws IOException {
        String monthDisplay = getMonthName(monthStr);

        try (Workbook workbook = new XSSFWorkbook()) {
            Styles styles = new Styles(workbook);

            createSummarySheet(workbook, bills, monthDisplay, styles);
            createHsnSheet(workbook, bills, "HSN B2B", true, styles);
            createHsnSheet(workbook, bills, "HSN B2C", false, styles);
            createOutwardsSheet(workbook, bills, monthDisplay, styles);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        }
    }

    private void createSummarySheet(Workbook workbook, List<Bill> bills, String monthDisplay, Styles styles) {
        Sheet sheet = workbook.createSheet("Summary");
        sheet.setColumnWidth(0, 10000);
        for (int i = 1; i <= 5; i++)
            sheet.setColumnWidth(i, 4000);

        int rowIdx = 0;
        createLabelRow(sheet, rowIdx++, "Name: " + CLIENT_NAME, styles.bold);
        rowIdx++; // Blank
        createLabelRow(sheet, rowIdx++, "Summary of outward supplies for the month of " + monthDisplay, styles.bold);
        rowIdx++; // Space before table

        String[] headers = { "Particulars", "Taxable value", "IGST", "CGST", "SGST", "Total tax" };
        Row headerRow = sheet.createRow(rowIdx++);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(styles.header);
        }

        BigDecimal b2bTaxable = BigDecimal.ZERO, b2bIgst = BigDecimal.ZERO, b2bCgst = BigDecimal.ZERO,
                b2bSgst = BigDecimal.ZERO;
        BigDecimal b2cTaxable = BigDecimal.ZERO, b2cIgst = BigDecimal.ZERO, b2cCgst = BigDecimal.ZERO,
                b2cSgst = BigDecimal.ZERO;

        for (Bill bill : bills) {
            boolean isB2B = bill.getCustomerGst() != null && bill.getCustomerGst().length() == 15;
            if (isB2B) {
                b2bTaxable = b2bTaxable.add(bill.getTotalTaxable());
                b2bIgst = b2bIgst.add(bill.getTotalIGST());
                b2bCgst = b2bCgst.add(bill.getTotalCGST());
                b2bSgst = b2bSgst.add(bill.getTotalSGST());
            } else {
                b2cTaxable = b2cTaxable.add(bill.getTotalTaxable());
                b2cIgst = b2cIgst.add(bill.getTotalIGST());
                b2cCgst = b2cCgst.add(bill.getTotalCGST());
                b2cSgst = b2cSgst.add(bill.getTotalSGST());
            }
        }

        addSummaryRow(sheet, rowIdx++, "B2B Outward Supplies", b2bTaxable, b2bIgst, b2bCgst, b2bSgst, styles.currency);
        addSummaryRow(sheet, rowIdx++, "B2C Outward Supplies", b2cTaxable, b2cIgst, b2cCgst, b2cSgst, styles.currency);
        addSummaryRow(sheet, rowIdx++, "Credit notes", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, styles.currency);
        addSummaryRow(sheet, rowIdx++, "RCM Supplies", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, styles.currency);

        BigDecimal totalTaxable = b2bTaxable.add(b2cTaxable);
        BigDecimal totalIgst = b2bIgst.add(b2cIgst);
        BigDecimal totalCgst = b2bCgst.add(b2cCgst);
        BigDecimal totalSgst = b2bSgst.add(b2cSgst);
        addSummaryRow(sheet, rowIdx++, "Total Outward Supplies", totalTaxable, totalIgst, totalCgst, totalSgst,
                styles.total);

        rowIdx++;
        addSummaryRow(sheet, rowIdx++, "Inward Supplies from registered dealers", BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, styles.currency);
        addSummaryRow(sheet, rowIdx++, "RCM Supplies", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, styles.currency);
        addSummaryRow(sheet, rowIdx++, "Total ITC available", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, styles.total);

        rowIdx++;
        addSummaryRow(sheet, rowIdx++, "Electronic credit ledger balance", BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, styles.currency);
        addSummaryRow(sheet, rowIdx++, "Interhead Adjustment", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, styles.currency);
        addSummaryRow(sheet, rowIdx++, "Cash payable", totalIgst, totalIgst, totalCgst, totalSgst, styles.currency);
        addSummaryRow(sheet, rowIdx++, "Electronic cash ledger balance", BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, styles.currency);
        addSummaryRow(sheet, rowIdx++, "Total tax payable/ (credit available)", totalIgst, totalIgst, totalCgst,
                totalSgst, styles.total);
    }

    private void createHsnSheet(Workbook workbook, List<Bill> bills, String sheetName, boolean isB2B, Styles styles) {
        Sheet sheet = workbook.createSheet(sheetName);
        String[] headers = { "Row Labels", "Sum of Quantity", "Sum of Taxable value", "Sum of CGST", "Sum of SGST" };
        Row headerRow = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(styles.header);
            sheet.setColumnWidth(i, 5000);
        }

        Map<String, HsnData> grouped = new TreeMap<>(); // Sorted by HSN
        for (Bill bill : bills) {
            boolean billIsB2B = bill.getCustomerGst() != null && bill.getCustomerGst().length() == 15;
            if (billIsB2B == isB2B) {
                for (BillDetails item : bill.getItems()) {
                    String hsn = item.getHsnsac() != null ? item.getHsnsac() : "NA";
                    grouped.putIfAbsent(hsn, new HsnData());
                    HsnData data = grouped.get(hsn);
                    data.qty += item.getQuantity();
                    data.taxable = data.taxable.add(item.getTaxableValue());
                    data.cgst = data.cgst.add(item.getCgstAmount() != null ? item.getCgstAmount() : BigDecimal.ZERO);
                    data.sgst = data.sgst.add(item.getSgstAmount() != null ? item.getSgstAmount() : BigDecimal.ZERO);
                }
            }
        }

        int rowIdx = 1;
        BigDecimal grandQty = BigDecimal.ZERO, grandTaxable = BigDecimal.ZERO, grandCgst = BigDecimal.ZERO,
                grandSgst = BigDecimal.ZERO;
        for (Map.Entry<String, HsnData> entry : grouped.entrySet()) {
            Row row = sheet.createRow(rowIdx++);
            row.createCell(0).setCellValue(entry.getKey());
            row.createCell(1).setCellValue(entry.getValue().qty);
            setNumericCell(row.createCell(2), entry.getValue().taxable, styles.currency);
            setNumericCell(row.createCell(3), entry.getValue().cgst, styles.currency);
            setNumericCell(row.createCell(4), entry.getValue().sgst, styles.currency);

            grandQty = grandQty.add(new BigDecimal(entry.getValue().qty));
            grandTaxable = grandTaxable.add(entry.getValue().taxable);
            grandCgst = grandCgst.add(entry.getValue().cgst);
            grandSgst = grandSgst.add(entry.getValue().sgst);
        }

        Row totalRow = sheet.createRow(rowIdx);
        Cell totalLabel = totalRow.createCell(0);
        totalLabel.setCellValue("Grand Total");
        totalLabel.setCellStyle(styles.totalLabel);
        totalRow.createCell(1).setCellValue(grandQty.intValue());
        setNumericCell(totalRow.createCell(2), grandTaxable, styles.total);
        setNumericCell(totalRow.createCell(3), grandCgst, styles.total);
        setNumericCell(totalRow.createCell(4), grandSgst, styles.total);
    }

    private void createOutwardsSheet(Workbook workbook, List<Bill> bills, String monthDisplay, Styles styles) {
        Sheet sheet = workbook.createSheet("Outwards");
        int rowIdx = 0;
        createLabelRow(sheet, rowIdx++, "Name: " + CLIENT_NAME, styles.bold);
        rowIdx++;
        createLabelRow(sheet, rowIdx++, "Outward Supplies for the month of " + monthDisplay, styles.bold);
        rowIdx++;

        rowIdx = createOutwardsSection(sheet, bills, "SECTION 1: B2B-Outward Supplies", true, rowIdx, styles);
        rowIdx += 2;
        rowIdx = createOutwardsSection(sheet, bills, "SECTION 2: B2C-Outward Supplies", false, rowIdx, styles);
        rowIdx += 2;
        createOutwardsSummary(sheet, bills, rowIdx, styles);
    }

    private int createOutwardsSection(Sheet sheet, List<Bill> bills, String title, boolean isB2B, int startRow,
            Styles styles) {
        int rowIdx = startRow;
        createLabelRow(sheet, rowIdx++, title, styles.bold);

        String[] headers = { "Date", "Invoice no", "GSTIN", "Particulars", "HSN Code", "Quantity", "Taxable value",
                "Rate", "IGST", "CGST", "SGST", "Total Tax", "Invoice value" };
        Row headerRow = sheet.createRow(rowIdx++);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(styles.header);
            sheet.setColumnWidth(i, 4000);
        }

        BigDecimal sTaxable = BigDecimal.ZERO, sQty = BigDecimal.ZERO, sIgst = BigDecimal.ZERO, sCgst = BigDecimal.ZERO,
                sSgst = BigDecimal.ZERO, sTax = BigDecimal.ZERO, sValue = BigDecimal.ZERO;
        SimpleDateFormat dateFmt = new SimpleDateFormat("dd-MM-yyyy");

        for (Bill bill : bills) {
            boolean billIsB2B = bill.getCustomerGst() != null && bill.getCustomerGst().length() == 15;
            if (billIsB2B == isB2B) {
                for (BillDetails item : bill.getItems()) {
                    Row row = sheet.createRow(rowIdx++);
                    BigDecimal taxable = item.getTaxableValue();
                    BigDecimal igst = item.getIgstAmount() != null ? item.getIgstAmount() : BigDecimal.ZERO;
                    BigDecimal cgst = item.getCgstAmount() != null ? item.getCgstAmount() : BigDecimal.ZERO;
                    BigDecimal sgst = item.getSgstAmount() != null ? item.getSgstAmount() : BigDecimal.ZERO;
                    BigDecimal totalTax = igst.add(cgst).add(sgst);
                    BigDecimal invValue = taxable.add(totalTax);

                    row.createCell(0).setCellValue(dateFmt.format(bill.getCreatedAt()));
                    row.createCell(1).setCellValue(bill.getId());
                    row.createCell(2).setCellValue(isB2B ? bill.getCustomerGst() : "B2C");
                    row.createCell(3).setCellValue(bill.getCustomerName());
                    row.createCell(4).setCellValue(item.getHsnsac() != null ? item.getHsnsac() : "");
                    row.createCell(5).setCellValue(item.getQuantity());
                    setNumericCell(row.createCell(6), taxable, styles.currency);
                    row.createCell(7).setCellValue(item.getGstRate().intValue() + "%");
                    setIgstCell(row.createCell(8), igst, styles);
                    setNumericCell(row.createCell(9), cgst, styles.currency);
                    setNumericCell(row.createCell(10), sgst, styles.currency);
                    setNumericCell(row.createCell(11), totalTax, styles.currency);
                    setNumericCell(row.createCell(12), invValue, styles.currency);

                    sTaxable = sTaxable.add(taxable);
                    sQty = sQty.add(new BigDecimal(item.getQuantity()));
                    sIgst = sIgst.add(igst);
                    sCgst = sCgst.add(cgst);
                    sSgst = sSgst.add(sgst);
                    sTax = sTax.add(totalTax);
                    sValue = sValue.add(invValue);
                }
            }
        }

        Row totalRow = sheet.createRow(rowIdx++);
        Cell totalLabel = totalRow.createCell(0);
        totalLabel.setCellValue("TOTAL");
        totalLabel.setCellStyle(styles.totalLabel);
        setNumericCell(totalRow.createCell(5), sQty, styles.total);
        setNumericCell(totalRow.createCell(6), sTaxable, styles.total);
        setNumericCell(totalRow.createCell(8), sIgst, styles.total);
        setNumericCell(totalRow.createCell(9), sCgst, styles.total);
        setNumericCell(totalRow.createCell(10), sSgst, styles.total);
        setNumericCell(totalRow.createCell(11), sTax, styles.total);
        setNumericCell(totalRow.createCell(12), sValue, styles.total);

        return rowIdx;
    }

    private void createOutwardsSummary(Sheet sheet, List<Bill> bills, int startRow, Styles styles) {
        int rowIdx = startRow;
        String[] headers = { "Particulars", "Taxable Value", "Quantity", "Rate", "IGST", "CGST", "SGST", "Total Tax",
                "Total Invoice Value" };
        Row headerRow = sheet.createRow(rowIdx++);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(styles.header);
        }

        Map<String, SummaryGroup> groups = new LinkedHashMap<>();
        groups.put("B2B 18%", new SummaryGroup());
        groups.put("B2B 5%", new SummaryGroup());
        groups.put("B2C 18%", new SummaryGroup());
        groups.put("B2C 5%", new SummaryGroup());

        for (Bill bill : bills) {
            boolean isB2B = bill.getCustomerGst() != null && bill.getCustomerGst().length() == 15;
            String prefix = isB2B ? "B2B " : "B2C ";
            for (BillDetails item : bill.getItems()) {
                String key = prefix + item.getGstRate().intValue() + "%";
                if (groups.containsKey(key)) {
                    SummaryGroup g = groups.get(key);
                    g.add(item);
                }
            }
        }

        // B2B 18%, B2B 5%
        rowIdx = addGroupRow(sheet, rowIdx, "B2B 18%", groups.get("B2B 18%"), styles.currency);
        rowIdx = addGroupRow(sheet, rowIdx, "B2B 5%", groups.get("B2B 5%"), styles.currency);
        SummaryGroup b2bTotal = new SummaryGroup();
        b2bTotal.merge(groups.get("B2B 18%")).merge(groups.get("B2B 5%"));
        rowIdx = addGroupRow(sheet, rowIdx, "TOTAL", b2bTotal, styles.total);

        // B2C 18%, B2C 5%
        rowIdx = addGroupRow(sheet, rowIdx, "B2C 18%", groups.get("B2C 18%"), styles.currency);
        rowIdx = addGroupRow(sheet, rowIdx, "B2C 5%", groups.get("B2C 5%"), styles.currency);
        SummaryGroup b2cTotal = new SummaryGroup();
        b2cTotal.merge(groups.get("B2C 18%")).merge(groups.get("B2C 5%"));
        rowIdx = addGroupRow(sheet, rowIdx, "TOTAL", b2cTotal, styles.total);

        SummaryGroup grandTotal = new SummaryGroup();
        grandTotal.merge(b2bTotal).merge(b2cTotal);
        rowIdx = addGroupRow(sheet, rowIdx, "SUB TOTAL", grandTotal, styles.total);

        rowIdx += 2;
        createLabelRow(sheet, rowIdx++, "Invoice No summary:", styles.bold);
        Row invSumRow = sheet.createRow(rowIdx++);
        invSumRow.createCell(0).setCellValue("From");
        invSumRow.createCell(1).setCellValue("To");
        invSumRow.createCell(2).setCellValue("Total count");
        if (!bills.isEmpty()) {
            Row dataRow = sheet.createRow(rowIdx);
            dataRow.createCell(0).setCellValue(bills.get(0).getId());
            dataRow.createCell(1).setCellValue(bills.get(bills.size() - 1).getId());
            dataRow.createCell(2).setCellValue(bills.size());
        }
    }

    private int addGroupRow(Sheet sheet, int rowIdx, String label, SummaryGroup g, CellStyle style) {
        Row row = sheet.createRow(rowIdx++);
        row.createCell(0).setCellValue(label);
        setNumericCell(row.createCell(1), g.taxable, style);
        row.createCell(2).setCellValue(g.qty);
        row.createCell(3).setCellValue(label.contains("%") ? label.split(" ")[1] : "");
        setNumericCell(row.createCell(4), g.igst, style);
        setNumericCell(row.createCell(5), g.cgst, style);
        setNumericCell(row.createCell(6), g.sgst, style);
        setNumericCell(row.createCell(7), g.tax, style);
        setNumericCell(row.createCell(8), g.value, style);
        return rowIdx;
    }

    private void createLabelRow(Sheet sheet, int rowIdx, String value, CellStyle style) {
        Row row = sheet.createRow(rowIdx);
        Cell cell = row.createCell(0);
        cell.setCellValue(value);
        if (style != null)
            cell.setCellStyle(style);
    }

    private void addSummaryRow(Sheet sheet, int rowIdx, String label, BigDecimal taxable, BigDecimal igst,
            BigDecimal cgst, BigDecimal sgst, CellStyle style) {
        Row row = sheet.createRow(rowIdx);
        row.createCell(0).setCellValue(label);
        setNumericCell(row.createCell(1), taxable, style);
        setNumericCell(row.createCell(2), igst, style);
        setNumericCell(row.createCell(3), cgst, style);
        setNumericCell(row.createCell(4), sgst, style);
        setNumericCell(row.createCell(5), igst.add(cgst).add(sgst), style);
    }

    private void setNumericCell(Cell cell, BigDecimal value, CellStyle style) {
        if (value == null)
            value = BigDecimal.ZERO;
        cell.setCellValue(value.doubleValue());
        cell.setCellStyle(style);
    }

    private void setIgstCell(Cell cell, BigDecimal value, Styles styles) {
        if (value == null || value.compareTo(BigDecimal.ZERO) == 0) {
            cell.setCellValue("-");
            cell.setCellStyle(styles.center);
        } else {
            cell.setCellValue(value.doubleValue());
            cell.setCellStyle(styles.currency);
        }
    }

    private String getMonthName(String monthStr) {
        try {
            SimpleDateFormat in = new SimpleDateFormat("yyyy-MM");
            SimpleDateFormat out = new SimpleDateFormat("MMMM yyyy");
            return out.format(in.parse(monthStr));
        } catch (Exception e) {
            return monthStr;
        }
    }

    private static class HsnData {
        int qty = 0;
        BigDecimal taxable = BigDecimal.ZERO;
        BigDecimal cgst = BigDecimal.ZERO;
        BigDecimal sgst = BigDecimal.ZERO;
    }

    private static class SummaryGroup {
        BigDecimal taxable = BigDecimal.ZERO;
        int qty = 0;
        BigDecimal igst = BigDecimal.ZERO;
        BigDecimal cgst = BigDecimal.ZERO;
        BigDecimal sgst = BigDecimal.ZERO;
        BigDecimal tax = BigDecimal.ZERO;
        BigDecimal value = BigDecimal.ZERO;

        void add(BillDetails item) {
            BigDecimal t = item.getTaxableValue();
            BigDecimal i = item.getIgstAmount() != null ? item.getIgstAmount() : BigDecimal.ZERO;
            BigDecimal c = item.getCgstAmount() != null ? item.getCgstAmount() : BigDecimal.ZERO;
            BigDecimal s = item.getSgstAmount() != null ? item.getSgstAmount() : BigDecimal.ZERO;
            BigDecimal tx = i.add(c).add(s);
            taxable = taxable.add(t);
            qty += item.getQuantity();
            igst = igst.add(i);
            cgst = cgst.add(c);
            sgst = sgst.add(s);
            tax = tax.add(tx);
            value = value.add(t.add(tx));
        }

        SummaryGroup merge(SummaryGroup other) {
            taxable = taxable.add(other.taxable);
            qty += other.qty;
            igst = igst.add(other.igst);
            cgst = cgst.add(other.cgst);
            sgst = sgst.add(other.sgst);
            tax = tax.add(other.tax);
            value = value.add(other.value);
            return this;
        }
    }

    private static class Styles {
        CellStyle header, currency, total, bold, center, totalLabel;

        Styles(Workbook wb) {
            DataFormat df = wb.createDataFormat();
            Font boldFont = wb.createFont();
            boldFont.setBold(true);

            header = wb.createCellStyle();
            header.setFont(boldFont);
            header.setAlignment(HorizontalAlignment.CENTER);
            header.setBorderBottom(BorderStyle.THIN);

            currency = wb.createCellStyle();
            currency.setDataFormat(df.getFormat("#,##0.00"));

            total = wb.createCellStyle();
            total.setFont(boldFont);
            total.setDataFormat(df.getFormat("#,##0.00"));
            total.setBorderTop(BorderStyle.THIN);

            bold = wb.createCellStyle();
            bold.setFont(boldFont);

            center = wb.createCellStyle();
            center.setAlignment(HorizontalAlignment.CENTER);

            totalLabel = wb.createCellStyle();
            totalLabel.setFont(boldFont);
        }
    }
}
