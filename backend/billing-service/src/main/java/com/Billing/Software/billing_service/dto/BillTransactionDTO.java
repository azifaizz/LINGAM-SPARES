package com.Billing.Software.billing_service.dto;

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
public class BillTransactionDTO {
    private String billId;
    private BigDecimal amount;
    private BigDecimal paidAmount;
    private Date date;
    private String paymentMethod;
}