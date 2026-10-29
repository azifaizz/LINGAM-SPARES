package com.Billing.Software.billing_service.dto;

import com.Billing.Software.billing_service.Entity.BillDetails;
import com.Billing.Software.billing_service.Entity.PaymentHistoryEntry;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

@Data
@NoArgsConstructor
public class BillRequest {
    private String id;
    private Date createdAt;
    private String status;
    private String billType;
    private String customerName;
    private long customerPhone;
    private String customerEmail;
    private String customerGst;
    private String customerAddress;
    private String paymentMethod;
    private BigDecimal amountPaid;
    private BigDecimal cashAmount;
    private BigDecimal onlineAmount;
    private List<PaymentHistoryEntry> paymentHistory;
    private List<BillDetails> items;
    private BigDecimal totalDiscountAmount;
    private BigDecimal totalGstAmount;
    private BigDecimal finalAmount;
    private String brokerId;
    private BigDecimal commissionAmount;
    private String staffId;
    private BigDecimal staffCommissionPercentage;

    // --- NEW TAX FIELDS ---
    private BigDecimal totalTaxable;
    private BigDecimal totalCGST;
    private BigDecimal totalSGST;
    private BigDecimal totalIGST;
    private BigDecimal roundOffAmount;
    private String sellerStateCode;
    private String buyerStateCode;

    // Optional Reminder Fields
    private Boolean paymentReminderEnabled;
    private Integer paymentReminderDays;
    private Date paymentReminderDate;

    // TRANSPORT & SHIP TO FIELDS
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
}
