package com.Billing.Software.billing_service.Controller;

import com.Billing.Software.billing_service.Entity.Reminder;
import com.Billing.Software.billing_service.Service.ReminderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/reminders")
@RequiredArgsConstructor
public class ReminderController {

    private final ReminderService reminderService;

    @PostMapping("/create")
    public ResponseEntity<?> createReminder(@RequestBody Reminder reminder) throws Exception {
        String id = reminderService.createReminder(reminder);
        return ResponseEntity.ok(Map.of("message", "Reminder created", "id", id));
    }
}
