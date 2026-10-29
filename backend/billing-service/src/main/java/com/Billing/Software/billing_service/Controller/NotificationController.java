package com.Billing.Software.billing_service.Controller;

import com.Billing.Software.billing_service.Entity.Notification;
import com.Billing.Software.billing_service.Service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping("/unread")
    public List<Notification> getUnread(@RequestParam(defaultValue = "ALL") String role) throws Exception {
        return notificationService.getUnreadNotifications(role);
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(@PathVariable String id) throws Exception {
        notificationService.markAsRead(id);
        return ResponseEntity.ok(Map.of("message", "Marked as read"));
    }
}
