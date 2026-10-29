package com.Billing.Software.billing_service.Entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Customer {
    private String phone; // Used as the Document ID
    private String name;
    private String email;
    private String address;
    private String gstNo;
    private BigDecimal loyaltyPoints;
    private BigDecimal totalSpent;
    private int visitCount;
    private Date lastVisit;
    private Date createdAt;
}