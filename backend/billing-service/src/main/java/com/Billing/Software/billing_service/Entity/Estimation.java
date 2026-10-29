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
public class Estimation {
    private String id;
    private String estimationId; // Format: EST-YYYY-XXXXXX

    private String customerName;
    private long customerPhone;
    private String customerEmail;
    private String customerGst;
    private String customerAddress;

    private String pricingMode; // RETAIL or WHOLESALE

    private List<BillDetails> items;
    private BigDecimal totalDiscountAmount;
    private BigDecimal totalGstAmount;
    private BigDecimal finalAmount;

    private Date createdAt;

    // --- TRANSPORT & SHIP TO FIELDS ---
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

    // --- PAYMENT TRACKING FIELDS ---
    private BigDecimal paidAmount;
    private BigDecimal amountPaid;
    private String status;
    private List<java.util.Map<String, Object>> paymentHistory;
}
