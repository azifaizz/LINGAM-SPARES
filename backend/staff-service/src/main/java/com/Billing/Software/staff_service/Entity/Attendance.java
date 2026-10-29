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
public class Attendance {
    private String id;
    private String staffId;
    private String date; // YYYY-MM-DD
    private String type; // FULL_DAY, HALF_DAY, SICK_LEAVE, PERMISSION
    private double permissionHours; // Used only if type is PERMISSION
    private String status; // "PENDING", "APPROVED" (for leaves)
    private Date timestamp;
    private String permissionTimeRange; // NEW: The specific interval (e.g., "10:00 - 14:00")
    private String remarks;
}