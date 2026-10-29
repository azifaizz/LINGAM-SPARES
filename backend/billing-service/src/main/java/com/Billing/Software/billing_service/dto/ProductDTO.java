package com.Billing.Software.billing_service.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Date;

@Data
@NoArgsConstructor
public class ProductDTO {
    private String id;
    private String name;
    private String category;

    // --- UPDATED TO BIGDECIMAL & ADDED PROFIT FIELDS ---
    private BigDecimal purchaseRate;
    private BigDecimal purchaseGst;
    private BigDecimal price;
    private BigDecimal discount;
    private String unit;
    private String hsnsac;
    private String taxCode;
    private String colourCode;
    // ----------------------------------------------------

    private int stockQuantity;
    private String vendorId;
    private String vendorName;
    private String barcode;
    private String barcodeImageUrl;
    private Date createdAt;
    private Date updatedAt;
}