package com.Billing.Software.vendor_service.Dtos;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PaymentRequestDTO {
    private BigDecimal amount;
    private String paymentMode;
    private String description;
    private Date date;
}
