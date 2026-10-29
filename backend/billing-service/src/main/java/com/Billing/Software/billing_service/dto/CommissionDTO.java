package com.Billing.Software.billing_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommissionDTO {
    private String id;
    private String billId;
    private String brokerId;
    private double amount;
    private String status; // "UNPAID"
    private Date date;
}