package com.Billing.Software.vendor_service.Controller;

import com.Billing.Software.vendor_service.Entity.PurchaseReturn;
import com.Billing.Software.vendor_service.Entity.Vendor;
import com.Billing.Software.vendor_service.Entity.VendorTransaction;
import com.Billing.Software.vendor_service.Service.VendorService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/vendors")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class VendorController {

    private final VendorService vendorService;

    /**
     * HEALTH CHECK
     */
    @GetMapping("/health")
    public String healthCheck() {
        return "Vendor Service is active and running.";
    }

    // =========================================================================
    // VENDOR MANAGEMENT
    // =========================================================================

    @PostMapping("/add")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> addVendor(@RequestBody Vendor vendor) throws Exception {
        String id = vendorService.addVendor(vendor);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("message", "Vendor added successfully", "id", id));
    }

    @GetMapping("/get/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public Vendor getVendor(@PathVariable String id) throws Exception {
        return vendorService.getVendorById(id);
    }

    @GetMapping("/all")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public List<Vendor> getAllVendors() throws Exception {
        return vendorService.getAllVendors();
    }

    @PatchMapping("/update/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public Vendor updateVendor(@PathVariable String id, @RequestBody Map<String, Object> updates) throws Exception {
        return vendorService.updateVendor(id, updates);
    }

    @DeleteMapping("/delete/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> deleteVendor(@PathVariable String id) throws Exception {
        vendorService.deleteVendor(id);
        return ResponseEntity.ok(Map.of("message", "Vendor deleted successfully"));
    }

    // =========================================================================
    // TRANSACTION & PAYMENT MANAGEMENT
    // =========================================================================

    /**
     * Add a new purchase transaction (creates a debt record).
     * Sequential ID like TX-00001
     */
    @PostMapping("/transactions/add")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> addTransaction(@RequestBody VendorTransaction transaction) throws Exception {
        String id = vendorService.addTransaction(transaction);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("message", "Transaction recorded", "id", id));
    }

    /**
     * Record a payment against a specific transaction ID.
     * This updates the balance and status (PAID/PARTIAL) atomically.
     */
    @PutMapping("/transactions/{id}/pay")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> recordPayment(
            @PathVariable String id,
            @RequestParam double amount,
            @RequestParam(required = false) String paymentMode,
            @RequestParam(required = false) String paymentDescription) throws Exception {
        vendorService.recordPayment(id, amount, paymentMode, paymentDescription);
        return ResponseEntity.ok(Map.of("message", "Payment of " + amount + " recorded for " + id));
    }

    /**
     * Fetch all transactions for a specific vendor.
     */
    @GetMapping("/transactions/vendor/{vendorId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public List<VendorTransaction> getTransactionsByVendor(@PathVariable String vendorId) throws Exception {
        return vendorService.getTransactionsByVendor(vendorId);
    }

    /**
     * Fetch all vendor transactions within a specific date range.
     * Usage:
     * /api/vendors/transactions/range?startDate=2025-01-01&endDate=2025-01-31
     */
    @GetMapping("/transactions/range")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public List<VendorTransaction> getTransactionsByRange(
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") Date startDate,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") Date endDate) throws Exception {
        return vendorService.getTransactionsByDateRange(startDate, endDate);
    }

    /**
     * Delete a transaction record.
     */
    @DeleteMapping("/transactions/delete/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> deleteTransaction(@PathVariable String id) throws Exception {
        vendorService.deleteCreditTransaction(id);
        return ResponseEntity.ok(Map.of("message", "Transaction record removed"));
    }

    // Inside VendorController.java (vendor-service)

    @PutMapping("/transactions/sync-details/{productId}")
    public ResponseEntity<?> syncProductDetails(
            @PathVariable String productId,
            @RequestParam double rate,
            @RequestParam double gst,
            @RequestParam int stock) throws Exception {

        // Call the new method name provided by your team
        vendorService.syncProductDetailsInTransactions(productId, rate, gst, stock);
        return ResponseEntity.ok(Map.of("message", "Product details synced across transactions"));
    }

    // =========================================================================
    // PURCHASE RETURN ENDPOINTS
    // =========================================================================

    @PostMapping("/transactions/returns/add")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> addPurchaseReturn(@RequestBody PurchaseReturn purchaseReturn) throws Exception {
        String id = vendorService.processPurchaseReturn(purchaseReturn);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("message", "Purchase return processed successfully", "id", id));
    }

    @GetMapping("/transactions/returns/range")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public List<PurchaseReturn> getPurchaseReturnsByRange(
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") Date startDate,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") Date endDate) throws Exception {
        return vendorService.getPurchaseReturnsByDateRange(startDate, endDate);
    }

    @GetMapping("/transactions/returns/transaction/{transactionId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public List<PurchaseReturn> getPurchaseReturnsByTransaction(@PathVariable String transactionId) throws Exception {
        return vendorService.getPurchaseReturnsByTransaction(transactionId);
    }
}