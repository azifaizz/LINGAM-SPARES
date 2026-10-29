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
public class StaffTarget {
    private String id;
    private String staffId;
    private String staffName;
    private String period; // e.g. "2026-10" or "DAILY" or custom string
    private double targetAmount; // Sales target in rupees
    private int targetQuantity; // Optional units target
    private String status; // "IN_PROGRESS", "ACHIEVED", "EXPIRED"
    private String notes;
    private Date startDate;
    private Date endDate;
    private String createdBy;
    private Date createdAt;
    private Date updatedAt;
}
