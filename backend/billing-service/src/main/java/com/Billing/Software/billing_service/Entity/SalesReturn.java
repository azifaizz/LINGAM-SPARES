package com.Billing.Software.billing_service.Entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SalesReturn {
    private String id;
    private String billId;
    private String customerName;
    private String customerPhone;
    private Date returnDate;
    private List<SalesReturnedProduct> returnedProducts;
    private double totalReturnAmount;
    private double previousBillAmount;
    private double newBillAmount;
    private String status;
    private String remarks;
    private String processedBy;
    private String cancelledBy;
    private Date cancelledAt;
    private String cancellationReason;
}
