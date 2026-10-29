package com.Billing.Software.billing_service.Entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CashTally {
    private String id; // Format: "TALLY_YYYY-MM-DD"
    private String date; // YYYY-MM-DD
    private double openingBalance;
    private Map<String, Integer> denominations;
    private double totalCashHand;
}