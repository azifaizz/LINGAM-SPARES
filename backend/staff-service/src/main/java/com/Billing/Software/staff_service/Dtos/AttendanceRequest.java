package com.Billing.Software.staff_service.Dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttendanceRequest {
    private String staffId;
    private String staffName;
    private String date;             // "YYYY-MM-DD"
    private String type;             // FULL_DAY, HALF_DAY, SICK_LEAVE, PERMISSION
    private String inTime;           // "09:00 AM"
    private String outTime;          // "06:00 PM"
    private double permissionHours;  // Only used if type is "PERMISSION"
    private String permissionTimeRange; // Add this
    private String remarks; // Add this
}