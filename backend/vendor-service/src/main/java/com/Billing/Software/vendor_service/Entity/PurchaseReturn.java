package com.Billing.Software.vendor_service.Entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PurchaseReturn {
    private String id;
    private String transactionId;
    private String vendorId;
    private String vendorName;
    private String invoice;
    private Date returnDate;
    private List<ReturnedProduct> returnedProducts;
    private double totalReturnAmount;
    private double previousAmount;
    private double newAmount;
    private double previousBalance;
    private double newBalance;
    private String status;
    private String remarks;
}
