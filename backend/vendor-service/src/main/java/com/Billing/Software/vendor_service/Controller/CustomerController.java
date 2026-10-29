package com.Billing.Software.vendor_service.Controller;

import com.Billing.Software.vendor_service.Dtos.BillTransactionDTO;
import com.Billing.Software.vendor_service.Dtos.PaymentRequestDTO;
import com.Billing.Software.vendor_service.Entity.Customer;
import com.Billing.Software.vendor_service.Entity.CustomerPurchase;
import com.Billing.Software.vendor_service.Service.CustomerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CustomerController {

    private final CustomerService customerService;

    @GetMapping("/health")
    public String healthCheck() {
        return "Customer Service is up and running!";
    }

    // --- STANDARD ENDPOINTS ---

    @PostMapping("/add")
    public ResponseEntity<?> addCustomer(@RequestBody Customer customer) {
        try {
            String id = customerService.addCustomer(customer);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "Customer added", "id", id));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<?> getCustomer(@PathVariable String id) {
        try {
            return ResponseEntity.ok(customerService.getCustomerById(id));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/search")
    public ResponseEntity<?> getCustomerByPhone(@RequestParam String phone) {
        try {
            Customer c = customerService.getCustomerByPhone(phone);
            if (c != null)
                return ResponseEntity.ok(c);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Customer not found"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/all")
    public ResponseEntity<?> getAllCustomers() {
        try {
            return ResponseEntity.ok(customerService.getAllCustomers());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/update/{id}")
    public ResponseEntity<?> updateCustomer(@PathVariable String id, @RequestBody Customer customer) {
        try {
            Customer updated = customerService.updateCustomer(id, customer);
            return ResponseEntity.ok(Map.of("message", "Updated", "customer", updated));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> deleteCustomer(@PathVariable String id) {
        try {
            customerService.deleteCustomer(id);
            return ResponseEntity.ok(Map.of("message", "Customer deleted successfully"));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    // --- TRANSACTION HISTORY ENDPOINTS ---

    @PostMapping("/{id}/transactions")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> addTransaction(
            @PathVariable String id,
            @RequestBody BillTransactionDTO transactionDto) {
        try {
            customerService.addPurchaseHistory(id, transactionDto);
            return ResponseEntity.ok(Map.of("message", "Transaction recorded"));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/transactions/bill/{billId}")
    public ResponseEntity<?> deleteTransactionsByBillId(@PathVariable String billId) {
        try {
            customerService.deletePurchaseHistoryByBillId(billId);
            return ResponseEntity.ok(Map.of("message", "Transactions deleted"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public List<CustomerPurchase> getHistory(@PathVariable String id) throws Exception {
        return customerService.getCustomerHistory(id);
    }

    @PostMapping("/{customerId}/bills/{billId}/payments")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> recordPayment(
            @PathVariable String customerId,
            @PathVariable String billId,
            @RequestBody PaymentRequestDTO paymentRequest) {
        try {
            customerService.recordPayment(customerId, billId, paymentRequest);
            return ResponseEntity.ok(Map.of("message", "Payment recorded successfully"));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }
}