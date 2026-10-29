package com.Billing.Software.vendor_service.Dtos;

import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Product {

    private String id;
    private String name;
    private double purchaseRate;
    private double purchaseGst;
    private int stockQuantity;
    private String vendorId;
}