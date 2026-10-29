package com.Billing.Software.vendor_service.Entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Commissions {
    private String id;
    private String billId;
    private String brokerId; // Refactored from electricianId
    private double amount;
    private String status; // "PAID", "UNPAID"
    private Date date;
}