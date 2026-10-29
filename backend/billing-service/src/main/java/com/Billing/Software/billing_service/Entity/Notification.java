package com.Billing.Software.billing_service.Entity;

import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Date;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Notification {
    @DocumentId
    private String id;
    private String title;
    private String message;
    private String type; // 'REMINDER', 'SYSTEM', 'PAYMENT'
    private String relatedId; // e.g., Customer ID
    private String relatedBillId; // e.g., Bill ID
    private boolean isRead;
    private Date createdAt;
    private String role; // 'ADMIN', 'CASHIER', 'ALL'
}
