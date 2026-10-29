package com.Billing.Software.billing_service.Service;

import com.Billing.Software.billing_service.Entity.Bill;
import com.Billing.Software.billing_service.Config.TwilioConfig;
import com.Billing.Software.billing_service.Entity.Notification;
import com.Billing.Software.billing_service.Entity.Reminder;
import java.math.BigDecimal;
import com.google.cloud.firestore.Firestore;
import com.twilio.rest.api.v2010.account.Message;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Service
@RequiredArgsConstructor
public class ReminderService {

    private final Firestore firestore;
    private final NotificationService notificationService;
    private final TwilioConfig twilioConfig;
    private static final String COL = "reminders";

    public String createReminder(Reminder reminder) throws ExecutionException, InterruptedException {
        if (reminder.getId() == null) {
            reminder.setId(UUID.randomUUID().toString());
        }
        if (reminder.getExpiryDate() == null) {
            // Default to 30 days if not set
            long thirtyDays = 30L * 24 * 60 * 60 * 1000;
            reminder.setExpiryDate(new Date(System.currentTimeMillis() + thirtyDays));
        }
        reminder.setCreatedAt(new Date());
        reminder.setStatus("PENDING");
        reminder.setRead(false);

        firestore.collection(COL).document(reminder.getId()).set(reminder).get();
        return reminder.getId();
    }

    public List<Reminder> getActiveReminders() throws ExecutionException, InterruptedException {
        return firestore.collection(COL)
                .whereEqualTo("status", "PENDING")
                .get().get().toObjects(Reminder.class);
    }

    // Triggered by ExpiryScheduler
    public void checkExpiries() {
        try {
            List<Reminder> pendingReminders = getActiveReminders();
            Date now = new Date();

            for (Reminder r : pendingReminders) {
                if (r.getExpiryDate() != null && r.getExpiryDate().before(now)) {
                    triggerReminder(r);
                }
            }
        } catch (Exception e) {
            System.err.println("Error in Reminder Check: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void triggerReminder(Reminder reminder) {
        try {
            // 1. Send SMS via Twilio using Config
            sendSMS(reminder);

            // 2. Create In-App Notification (Preserving ROSE's Notification Entity
            // Structure)
            Notification notification = Notification.builder()
                    .title("Bill Reminder Expired")
                    .message("Reminder for customer " + reminder.getCustomerName() + " (Bill: " + reminder.getBillId()
                            + ")")
                    .type("REMINDER")
                    .relatedId(reminder.getCustomerId())
                    .relatedBillId(reminder.getBillId())
                    .role("ALL") // Notify Admins and Cashiers
                    .createdAt(new Date())
                    .isRead(false)
                    .build(); // ID is auto-generated in NotificationService if not set, or we set it?
                              // NotificationService sets it if missing? No, createNotification usually takes
                              // ID inside. Let's check. ROSE NotificationService uses
                              // document(notification.getId()).
            // ROSE NotificationService:
            // firestore.collection(COL).document(notification.getId()).set(notification)
            // So we MUST set ID.

            notification.setId(UUID.randomUUID().toString()); // Generate ID here to be safe

            notificationService.createNotification(notification);

            // 3. Update Reminder Status
            firestore.collection(COL).document(reminder.getId()).update("status", "NOTIFIED").get();
            System.out.println("Reminder triggered and updated for ID: " + reminder.getId());

        } catch (Exception e) {
            System.err.println("Failed to trigger reminder " + reminder.getId() + ": " + e.getMessage());
        }
    }

    public void checkPaymentReminders() {
        try {
            Date now = new Date();
            // Query for bills with status PARTIAL/PENDING, reminderTriggered false, and
            // paymentReminderDate <= now
            List<Bill> dueBills = firestore.collection("bills")
                    .whereIn("status", List.of("PARTIAL", "PENDING"))
                    .whereEqualTo("reminderTriggered", false)
                    .whereLessThanOrEqualTo("paymentReminderDate", now)
                    .get().get().toObjects(Bill.class);

            for (Bill bill : dueBills) {
                // Verify there is still a balance
                BigDecimal amountPaid = bill.getAmountPaid() != null ? bill.getAmountPaid() : bill.getFinalAmount();
                if (bill.getFinalAmount().subtract(amountPaid).compareTo(BigDecimal.ZERO) > 0) {
                    triggerPaymentPendingNotification(bill);
                    // Update triggered status
                    firestore.collection("bills").document(bill.getId()).update("reminderTriggered", true).get();
                    System.out.println("Payment Reminder triggered for Bill: " + bill.getId());
                } else {
                    // If fully paid, mark as triggered so we don't check again
                    firestore.collection("bills").document(bill.getId()).update("reminderTriggered", true).get();
                }
            }
        } catch (Exception e) {
            System.err.println("Error in Payment Reminder Check: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void triggerPaymentPendingNotification(Bill bill) {
        try {
            Notification n = Notification.builder()
                    .id(UUID.randomUUID().toString())
                    .title("Payment Pending")
                    .message(
                            "Payment pending for bill " + bill.getId() + " (Customer: " + bill.getCustomerName() + ")")
                    .type("PAYMENT_PENDING")
                    .relatedId(bill.getCustomerId() != null ? bill.getCustomerId()
                            : (bill.getCustomerPhone() != 0 ? String.valueOf(bill.getCustomerPhone()) : null))
                    .relatedBillId(bill.getId())
                    .role("ALL")
                    .createdAt(new Date())
                    .isRead(false)
                    .build();
            notificationService.createNotification(n);
        } catch (Exception e) {
            System.err.println("Failed to trigger payment reminder notification: " + e.getMessage());
        }
    }

    private void sendSMS(Reminder r) {
        if (r.getCustomerPhone() == null || r.getCustomerPhone().isEmpty())
            return;

        try {
            String msg = String.format(
                    "Reminder: Hello %s, this is a reminder regarding your bill %s. Please contact us.",
                    (r.getCustomerName() != null ? r.getCustomerName() : "Customer"),
                    r.getBillId());

            // Format phone for Twilio
            String phone = r.getCustomerPhone().replaceAll("\\D", "");
            if (phone.length() == 10)
                phone = "+91" + phone;
            else if (!phone.startsWith("+"))
                phone = "+" + phone;

            Message.creator(
                    new com.twilio.type.PhoneNumber(phone),
                    new com.twilio.type.PhoneNumber(twilioConfig.getFromNumber()),
                    msg).create();

            System.out.println("SMS sent to " + phone);

        } catch (Exception e) {
            System.err.println("SMS Send Failed: " + e.getMessage());
        }
    }
}
