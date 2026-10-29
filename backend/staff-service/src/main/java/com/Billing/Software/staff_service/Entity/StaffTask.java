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
public class StaffTask {
    private String id;
    private String title;
    private String description;
    private String assignedStaffId; // Specific staff ID or "ALL"
    private String assignedStaffName;
    private String dueDate; // e.g. "2026-10-20"
    private String priority; // "LOW", "MEDIUM", "HIGH", "URGENT"
    private String status; // "PENDING", "IN_PROGRESS", "COMPLETED"
    private String createdBy;
    private Date createdAt;
    private Date completedAt;
    private String completedBy;
}
