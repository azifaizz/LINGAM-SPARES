package com.Billing.Software.billing_service.Controller;

import com.Billing.Software.billing_service.Entity.CashTally;
import com.Billing.Software.billing_service.Entity.DayBookEntry;
import com.Billing.Software.billing_service.Service.DayBookService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/billing/daybook")
public class DayBookController {

    private final DayBookService service;

    public DayBookController(DayBookService service) {
        this.service = service;
    }

    // --- Transactions ---

    @PostMapping("/add")
    public ResponseEntity<?> addEntry(@RequestBody DayBookEntry entry) throws Exception {
        return ResponseEntity.ok(Map.of("id", service.addEntry(entry)));
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<?> updateEntry(@PathVariable String id, @RequestBody DayBookEntry entry) throws Exception {
        service.updateEntry(id, entry);
        return ResponseEntity.ok(Map.of("message", "Entry updated successfully"));
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> deleteEntry(@PathVariable String id) throws Exception {
        service.deleteEntry(id);
        return ResponseEntity.ok(Map.of("message", "Entry deleted successfully"));
    }

    // --- Daily Summary ---

    @GetMapping("/summary")
    public ResponseEntity<?> getDailySummary(@RequestParam String date) throws Exception {
        // Parsing logic moved to Service for consistency
        return ResponseEntity.ok(service.getDailySummary(date));
    }

    // --- Tally (Denominations) ---

    @PostMapping("/tally")
    public ResponseEntity<?> saveTally(@RequestBody CashTally tally) throws Exception {
        service.saveTally(tally);
        return ResponseEntity.ok(Map.of("message", "Tally saved"));
    }

    @GetMapping("/tally")
    public ResponseEntity<?> getTally(@RequestParam String date) throws Exception {
        return ResponseEntity.ok(service.getTally(date));
    }

    // --- Analytics Range Endpoint ---
    @GetMapping("/range")
    public ResponseEntity<?> getRangeAnalytics(
            @RequestParam String startDate,
            @RequestParam String endDate) throws Exception {
        // Accepts String YYYY-MM-DD to avoid 400 Bad Request on Date parsing
        return ResponseEntity.ok(service.getRangeAnalytics(startDate, endDate));
    }
}