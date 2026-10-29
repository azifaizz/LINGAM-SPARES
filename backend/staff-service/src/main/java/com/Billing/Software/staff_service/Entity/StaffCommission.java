package com.Billing.Software.staff_service.Entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StaffCommission {
    private String id;
    private String staffId;
    private String billId;
    private double amount;
    private double percentage;
    private String status;   // "PAID", "UNPAID"
    private Date date;       // Date earned
    private Date paidDate;   // Date the admin actually paid the staff
}