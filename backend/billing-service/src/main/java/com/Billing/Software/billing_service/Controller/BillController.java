package com.Billing.Software.billing_service.Controller;

import com.Billing.Software.billing_service.Entity.Bill;
import com.Billing.Software.billing_service.Entity.SalesReturn;
import com.Billing.Software.billing_service.dto.BillRequest;
import com.Billing.Software.billing_service.Service.BillService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import lombok.extern.slf4j.Slf4j;

import java.util.Date;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/billing")
@RequiredArgsConstructor
@Slf4j
public class BillController {

    private final BillService billService;

    private String getAuthUid() {
        return (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    @PostMapping("/create")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> createBill(@RequestHeader(HttpHeaders.AUTHORIZATION) String auth,
            @RequestBody BillRequest request) throws Exception {
        log.info("Received Bill Creation Request: {}", request);
        String status = (request.getStatus() != null) ? request.getStatus() : "PAID";
        return ResponseEntity.ok(billService.processBillRequest(auth, request, getAuthUid(), status));
    }

    @PostMapping("/hold")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> holdBill(@RequestHeader(HttpHeaders.AUTHORIZATION) String auth,
            @RequestBody BillRequest request) throws Exception {
        String status = (request.getStatus() != null) ? request.getStatus() : "HOLD";
        return ResponseEntity.ok(billService.processBillRequest(auth, request, getAuthUid(), status));
    }

    @PatchMapping("/{id}/pay")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> finalizeHoldBill(@RequestHeader(HttpHeaders.AUTHORIZATION) String auth,
            @PathVariable String id, @RequestBody Bill updatedBill) throws Exception {
        return ResponseEntity.ok(billService.finalizeHeldBill(auth, id, updatedBill, getAuthUid()));
    }

    @PutMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> cancelHoldBill(@PathVariable String id) throws Exception {
        billService.cancelBill(id);
        return ResponseEntity.ok(Map.of("message", "Bill Cancelled"));
    }

    @PutMapping("/{id}/cancel-placeholder")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> cancelBillPlaceholder(@PathVariable String id) throws Exception {
        billService.cancelBillPlaceholder(id);
        return ResponseEntity.ok(Map.of("message", "Bill Cancelled"));
    }

    @PutMapping("/{id}/uncancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> uncancelHoldBill(@PathVariable String id) throws Exception {
        billService.uncancelBill(id);
        return ResponseEntity.ok(Map.of("message", "Bill Restored"));
    }

    @DeleteMapping("/delete/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> deleteBill(@RequestHeader(HttpHeaders.AUTHORIZATION) String auth, @PathVariable String id) throws Exception {
        billService.deleteBill(auth, id);
        return ResponseEntity.ok(Map.of("message", "Bill deleted successfully"));
    }

    /**
     * Processes a Sales Return against a bill.
     * Body: { "returnedProducts": [...], "remarks": "..." }
     * Legacy callers may PUT { "status": "RETURNED" } to simply flag a bill as returned.
     */
    @PutMapping("/{id}/return")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> returnBill(@RequestHeader(HttpHeaders.AUTHORIZATION) String auth, @PathVariable String id,
            @RequestBody Map<String, Object> returnRequest) throws Exception {
        SalesReturn result = billService.processReturnOrExchange(auth, id, returnRequest, getAuthUid());
        return ResponseEntity.ok(result);
    }

    /**
     * Cancels a previously completed Sales Return, restoring stock and reverting the bill.
     * Body: { "reason": "..." }
     */
    @PutMapping("/sales-returns/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> cancelSalesReturn(@RequestHeader(HttpHeaders.AUTHORIZATION) String auth,
            @PathVariable String id, @RequestBody Map<String, String> body) throws Exception {
        String reason = body.get("reason");
        SalesReturn result = billService.cancelSalesReturn(auth, id, reason, getAuthUid());
        return ResponseEntity.ok(result);
    }

    /**
     * Fetches all Sales Returns within a date range.
     * Usage: /api/billing/sales-returns/range?start=2025-01-01&end=2025-01-31
     */
    @GetMapping("/sales-returns/range")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public List<SalesReturn> getSalesReturnsByRange(
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") Date start,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") Date end) throws Exception {
        return billService.getSalesReturnsByDateRange(start, end);
    }

    /**
     * Fetches every Sales Return recorded against a specific bill.
     */
    @GetMapping("/sales-returns/bill/{billId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public List<SalesReturn> getSalesReturnsByBillId(@PathVariable String billId) throws Exception {
        return billService.getSalesReturnsByBillId(billId);
    }

    @GetMapping("/all")
    public List<Bill> getAll() throws Exception {
        return billService.getAllBills();
    }

    @GetMapping("/range")
    public List<Bill> getByRange(
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") Date start,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") Date end) throws Exception {
        return billService.getBillsByRange(start, end);
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> findBillsByCustomer(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) Long phone) throws Exception {
        return ResponseEntity.ok(billService.getBillsByCustomerInfo(name, phone));
    }

    @GetMapping("/notifications")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public List<Bill> getNotifications() throws Exception {
        return billService.getReminderNotifications();
    }
}