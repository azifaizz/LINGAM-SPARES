package com.Billing.Software.billing_service.Entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentHistoryEntry {
    private BigDecimal amount;
    private String paymentMode;
    private String description;
    private Date paymentDate;
    private BigDecimal balanceAfterPayment;
    private String statusAfterPayment;
}
