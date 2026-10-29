package com.Billing.Software.staff_service.Dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SalarySlip {
    private String staffId;
    private String staffName;
    private String month;            // YYYY-MM
    private double baseSalary;

    // Attendance Counts
    private int totalDays;           // Usually 30 or days in month
    private int presentDays;
    private int absentDays;
    private int halfDays;
    private int sickLeaves;          // Paid leaves
    private double permissionHoursTaken;

    // Calculations
    private double perDaySalary;
    private double perHourSalary;


    // Financials
    private double lopAmount;        // Loss of Pay (Absent + Half Days)
    private double permissionDeduction;
    private double netSalary;        // Final Amount to Pay
}