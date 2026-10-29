package com.Billing.Software.vendor_service.Entity;

import com.Billing.Software.vendor_service.Dtos.Product;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

// Updated Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VendorTransaction {
    private String id;
    private String vendorId;
    private String invoice;
    private double amount;
    private List<Product> products; // Added: List of items purchased
    private List<String> productIds; // Indexed field for efficient product sync queries
    private double paidAmount;
    private double balance;
    private String status;
    private String paymentMode;
    private Date date;
    private Date lastPaymentDate;
    private String description;
    private List<PaymentHistoryEntry> paymentHistory;
    private String paymentRemarks; // Added to support frontend history display
}