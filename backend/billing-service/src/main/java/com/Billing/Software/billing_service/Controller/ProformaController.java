package com.Billing.Software.billing_service.Controller;

import com.Billing.Software.billing_service.Entity.Proforma;
import com.Billing.Software.billing_service.Service.ProformaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/proformas")
@RequiredArgsConstructor
public class ProformaController {

    private final ProformaService proformaService;

    @PostMapping("/create")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> createProforma(@RequestBody Proforma proforma) throws Exception {
        return ResponseEntity.ok(proformaService.createProforma(proforma));
    }

    @GetMapping("/all")
    public ResponseEntity<?> getAllProformas() throws Exception {
        return ResponseEntity.ok(proformaService.getAllProformas());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getProforma(@PathVariable String id) throws Exception {
        Proforma proforma = proformaService.getProforma(id);
        if (proforma != null) {
            return ResponseEntity.ok(proforma);
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> updateProforma(@PathVariable String id, @RequestBody Proforma proforma)
            throws Exception {
        return ResponseEntity.ok(proformaService.updateProforma(id, proforma));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> deleteProforma(@PathVariable String id) throws Exception {
        proformaService.deleteProforma(id);
        return ResponseEntity.ok().build();
    }
}
