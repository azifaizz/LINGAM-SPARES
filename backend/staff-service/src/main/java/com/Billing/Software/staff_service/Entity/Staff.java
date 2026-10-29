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
public class Staff {
    private String id;
    private String name;
    private String phone;
    private String emergencyPhone;
    private String role; // e.g., MANAGER, SALES

    // Image URL (Frontend uploads to Firebase Storage -> sends URL here)
    private String profilePicUrl;

    // --- SALARY & BANK DETAILS ---
    private double baseSalary;
    private double allowedPermHours;

    // New Bank Fields
    private String accountNumber;
    private String ifscCode;
    // -----------------------------

    // --- APP LOGIN CREDENTIALS ---
    private String appUsername;
    private String appPassword;
    private String appLocation;
    // -----------------------------

    private boolean active;
    private Date createdAt;
}