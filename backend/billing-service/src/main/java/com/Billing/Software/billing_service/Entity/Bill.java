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
public class Bill {
    private String id;
    private String status;
    private String previousStatus; // Stores status before cancellation so it can be restored on uncancel
    private String billType;
    private String customerId; // New field to store customer's unique ID

    private String customerName;
    private long customerPhone;
    private String customerEmail;
    private String customerGst;
    private String customerAddress;

    private String cashierId;

    // --- NEW TAX FIELDS (STRICT GST) ---
    private BigDecimal totalTaxable;
    private BigDecimal totalCGST;
    private BigDecimal totalSGST;
    private BigDecimal totalIGST;
    private BigDecimal roundOffAmount;
    private String sellerStateCode;
    private String buyerStateCode;
    // -----------------------------------

    // --- NEW FIELDS ---
    private String brokerId;
    private BigDecimal commissionAmount;
    // ------------------

    // --- NEW STAFF COMMISSION FIELDS ---
    private String staffId; // The ID of the staff who attended the customer
    private BigDecimal staffCommissionPercentage; // e.g., 5.0
    private BigDecimal staffCommissionAmount; // Calculated: finalAmount * (percentage / 100)

    private List<BillDetails> items;
    private BigDecimal totalDiscountAmount;
    private BigDecimal totalGstAmount;
    private BigDecimal finalAmount;
    private BigDecimal amountPaid;
    private BigDecimal pendingAmount;

    // --- SALES RETURN SUMMARY FIELDS ---
    private double returnedAmount;   // Cumulative value returned against this bill
    private boolean fullyReturned;   // True when every line item is fully returned

    private String paymentMethod;
    private BigDecimal cashAmount;
    private BigDecimal onlineAmount;
    private List<PaymentHistoryEntry> paymentHistory;
    private Date createdAt;
    private Date updatedAt;

    // --- EXPIRY REMINDER FIELDS (MR-silks logic) ---
    @com.google.cloud.firestore.annotation.PropertyName("enableExpiryReminder")
    public boolean isEnableExpiryReminder() { return enableExpiryReminder; }
    @com.google.cloud.firestore.annotation.PropertyName("enableExpiryReminder")
    public void setEnableExpiryReminder(boolean enableExpiryReminder) { this.enableExpiryReminder = enableExpiryReminder; }

    @com.google.cloud.firestore.annotation.PropertyName("expiryDays")
    public Integer getExpiryDays() { return expiryDays; }
    @com.google.cloud.firestore.annotation.PropertyName("expiryDays")
    public void setExpiryDays(Integer expiryDays) { this.expiryDays = expiryDays; }

    private boolean enableExpiryReminder;
    private Integer expiryDays;

    // --- OPTIONAL REMINDER FIELDS ---
    private Boolean paymentReminderEnabled;
    private Integer paymentReminderDays;
    private Date paymentReminderDate;
    private Boolean reminderTriggered;

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
}