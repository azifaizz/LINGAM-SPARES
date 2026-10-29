package com.Billing.Software.billing_service.Entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DayBookEntry {
    private String id;
    private String type;
    private String description;
    private double amount;
    private Date date;
    private String category;
    private String paymentMethod;
}