package com.Billing.Software.vendor_service.Entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Customer {
    private String id; // CUST-XXXXX
    private String name;
    private String phone;
    private String email;
    private String address;
    private String gstin;

    // --- New Aggregate Fields ---
    private BigDecimal totalSpent;
    private int visitCount;
    private Date lastVisit;
    private Date createdAt;
}