package com.Billing.Software.vendor_service.Dtos;

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
    private BigDecimal paidAmount; // Actual amount paid at checkout
    private Date date;
    private String paymentMethod;
}