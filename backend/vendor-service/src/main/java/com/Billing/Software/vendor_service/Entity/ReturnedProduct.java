package com.Billing.Software.vendor_service.Entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReturnedProduct {
    private String productId;
    private String name;
    private int returnedQty;
    private double purchaseRate;
    private double amount;
}
