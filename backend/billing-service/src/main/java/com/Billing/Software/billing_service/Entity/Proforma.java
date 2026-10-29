package com.Billing.Software.billing_service.Entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Proforma {
    private String id;
    private String proformaId;

    private String customerName;
    private long customerPhone;
    private String customerEmail;
    private String customerGst;
    private String customerAddress;

    private String pricingMode;

    private List<BillDetails> items;
    private BigDecimal totalDiscountAmount;
    private BigDecimal totalGstAmount;
    private BigDecimal finalAmount;

    // --- TAX BREAKDOWN FIELDS (matching Bill entity) ---
    private BigDecimal totalTaxable;
    private BigDecimal totalCGST;
    private BigDecimal totalSGST;
    private BigDecimal totalIGST;
    private BigDecimal roundOffAmount;
    private String sellerStateCode;
    private String buyerStateCode;
    // ---------------------------------------------------

    private Date createdAt;

    private String vehicleNo;
    private String dispatchThrough;
    private String destination;
    private String termsOfDelivery;
    private BigDecimal transportAmount;
    private BigDecimal transportGstRate;
    private Boolean isShipToDifferent;
    private String shipToName;
    private String shipToPhone;
    private String shipToEmail;
    private String shipToAddress;
    private String shipToGst;

    private BigDecimal paidAmount;
    private BigDecimal amountPaid;
    private String status;
    private List<java.util.Map<String, Object>> paymentHistory;
}
