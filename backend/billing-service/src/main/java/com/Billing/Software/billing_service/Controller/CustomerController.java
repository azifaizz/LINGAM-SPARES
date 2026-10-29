package com.Billing.Software.billing_service.Controller;

import com.Billing.Software.billing_service.Entity.Customer;
import com.Billing.Software.billing_service.Service.CustomerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    @PostMapping("/add")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> addCustomer(@RequestBody Customer customer) throws Exception {
        return ResponseEntity.ok(Map.of("phoneId", customerService.addCustomer(customer)));
    }

    @GetMapping("/all")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> getAll() throws Exception {
        return ResponseEntity.ok(customerService.getAllCustomers());
    }

    @PatchMapping("/update/{phone}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> update(@PathVariable String phone, @RequestBody Map<String, Object> updates) throws Exception {
        customerService.updateCustomer(phone, updates);
        return ResponseEntity.ok(Map.of("message", "Customer profile updated"));
    }

    @DeleteMapping("/delete/{phone}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> delete(@PathVariable String phone) throws Exception {
        customerService.deleteCustomer(phone);
        return ResponseEntity.ok(Map.of("message", "Customer deleted"));
    }
}