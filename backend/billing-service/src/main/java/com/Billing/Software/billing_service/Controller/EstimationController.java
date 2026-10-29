package com.Billing.Software.billing_service.Controller;

import com.Billing.Software.billing_service.Entity.Estimation;
import com.Billing.Software.billing_service.Service.EstimationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/estimations")
@RequiredArgsConstructor
public class EstimationController {

    private final EstimationService estimationService;

    @PostMapping("/create")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> createEstimation(@RequestBody Estimation estimation) throws Exception {
        return ResponseEntity.ok(estimationService.createEstimation(estimation));
    }

    @GetMapping("/all")
    public ResponseEntity<?> getAllEstimations() throws Exception {
        return ResponseEntity.ok(estimationService.getAllEstimations());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getEstimation(@PathVariable String id) throws Exception {
        Estimation estimation = estimationService.getEstimation(id);
        if (estimation != null) {
            return ResponseEntity.ok(estimation);
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> updateEstimation(@PathVariable String id, @RequestBody Estimation estimation)
            throws Exception {
        return ResponseEntity.ok(estimationService.updateEstimation(id, estimation));
    }
}
