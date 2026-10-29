package com.Billing.Software.billing_service.scheduler;

import com.Billing.Software.billing_service.Service.NotificationService;
import com.Billing.Software.billing_service.Service.ReminderService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Date;

@Component
@RequiredArgsConstructor
public class ExpiryScheduler {

    private final ReminderService reminderService;
    private final NotificationService notificationService;

    @Scheduled(cron = "0 0 9 ? * MON-FRI")
    public void checkExpiries() {
        System.out.println("Running Expiry Scheduler: " + new Date());
        try {
            reminderService.checkExpiries();
            reminderService.checkPaymentReminders();
        } catch (Exception e) {
            System.err.println("Expiry Scheduler Error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Scheduled(cron = "0 0 2 * * *")
    public void cleanupOldNotifications() {
        System.out.println("Running Notification Cleanup: " + new Date());
        try {
            notificationService.cleanupOldReadNotifications();
        } catch (Exception e) {
            System.err.println("Notification Cleanup Error: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
