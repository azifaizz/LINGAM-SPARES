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
public class Reminder {
    @DocumentId
    private String id;
    private String customerId;
    private String customerName;
    private String customerPhone; // Added for SMS
    private String billId; // Related Bill
    private Date expiryDate;
    private String status; // STRICTLY: 'PENDING', 'NOTIFIED', 'COMPLETED'
    private String message;
    private String type; // 'SMS', 'WHATSAPP', 'APP'
    private boolean isRead;
    private Date createdAt;
}
