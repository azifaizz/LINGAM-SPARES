package com.Billing.Software.billing_service.Entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SalesReturnedProduct {
    private String productId;
    private String productName;
    private int originalQty;
    private int previouslyReturned;
    private int returnQty;
    private int remainingReturnable;
    private double unitPrice;
    private double gstRate;
    private double discountRate;
    private double discountAmount;
    private double amountBeforeGst;
    private double gstAmount;
    private double amountAfterGst;
}
