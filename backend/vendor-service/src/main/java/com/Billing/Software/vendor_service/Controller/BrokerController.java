package com.Billing.Software.vendor_service.Controller;

import com.Billing.Software.vendor_service.Entity.Commissions;
import com.Billing.Software.vendor_service.Entity.Broker;
import com.Billing.Software.vendor_service.Service.BrokerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/broker")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class BrokerController {

    private final BrokerService brokerService;

    @PostMapping("/add")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> addBroker(@RequestBody Broker broker) throws Exception {
        String id = brokerService.addBroker(broker);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id, "message", "Broker added"));
    }

    @GetMapping("/all")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public List<Broker> getAll() throws Exception {
        return brokerService.getAllBrokers();
    }

    // --- NEW: Update Broker ---
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateBroker(@PathVariable String id, @RequestBody Broker broker) throws Exception {
        brokerService.updateBroker(id, broker);
        return ResponseEntity.ok(Map.of("message", "Broker updated successfully"));
    }

    // --- NEW: Delete Broker ---
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteBroker(@PathVariable String id) throws Exception {
        brokerService.deleteBroker(id);
        return ResponseEntity.ok(Map.of("message", "Broker deleted successfully"));
    }

    @PostMapping("/commissions/add")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> addCommission(@RequestBody Commissions commission) throws Exception {
        String id = brokerService.addCommission(commission);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id, "message", "Commission recorded"));
    }

    @DeleteMapping("/commissions/bill/{billId}")
    public ResponseEntity<?> deleteCommissionsByBillId(@PathVariable String billId) throws Exception {
        brokerService.deleteCommissionsByBillId(billId);
        return ResponseEntity.ok(Map.of("message", "Commissions deleted"));
    }

    @PatchMapping("/commissions/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateStatus(@PathVariable String id, @RequestBody Map<String, String> body) throws Exception {
        brokerService.updateCommissionStatus(id, body.get("status"));
        return ResponseEntity.ok(Map.of("message", "Status updated"));
    }

    @GetMapping("/{id}/commissions")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public List<Commissions> getByBroker(@PathVariable String id) throws Exception {
        return brokerService.getCommissionsByBroker(id);
    }
}