package com.Billing.Software.product_service.Entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// --- REMOVED @DocumentId IMPORT ---

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Product {

    // --- REMOVED @DocumentId ANNOTATION ---
    // The mapper will now simply read the 'id' field stored in your database JSON
    private String id;

    private String name;
    private String unit;
    private String category;

    // --- Pricing Fields ---
    private double purchaseRate;
    private double purchaseGst;
    private double mrp;
    private double sellingPrice;
    private double wholesaleSellingPrice; // Added Wholesale Selling Price
    private double discount;
    // ----------------------
    private String hsnsac;
    private String taxCode;
    private String colourCode;

    private double stockQuantity;
    private String vendorId;
    private String vendorName;
    private String barcode;
    private String barcodeImageUrl;

    private String purchaseDate; // Business Date: yyyy-MM-dd
    private String createdAt;
    private String updatedAt;
}