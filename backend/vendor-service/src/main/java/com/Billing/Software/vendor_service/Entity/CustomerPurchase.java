package com.Billing.Software.vendor_service.Entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerPurchase {
    private String id; // Bill ID
    private BigDecimal amount; // Total Bill Amount
    private BigDecimal paidAmount;
    private BigDecimal balance;
    private String status;
    private Date date;
    private String paymentMethod;
    private List<PaymentHistoryEntry> paymentHistory;
}