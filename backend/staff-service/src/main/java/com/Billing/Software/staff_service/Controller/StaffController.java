package com.Billing.Software.staff_service.Controller;

import com.Billing.Software.staff_service.Dtos.AttendanceRequest;
import com.Billing.Software.staff_service.Dtos.SalarySlip;
import com.Billing.Software.staff_service.Dtos.SelfMarkRequest;
import com.Billing.Software.staff_service.Dtos.StaffLoginRequest;
import com.Billing.Software.staff_service.Entity.AppSettings;
import com.Billing.Software.staff_service.Entity.Role;
import com.Billing.Software.staff_service.Entity.Staff;
import com.Billing.Software.staff_service.Entity.StaffTarget;
import com.Billing.Software.staff_service.Entity.StaffTask;
import com.Billing.Software.staff_service.Service.StaffService;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class StaffController {

    private final StaffService service;

    // --- ROLES ---
    @PostMapping("/roles")
    @PreAuthorize("hasRole('ADMIN')")
    public String addRole(@RequestBody Role role) throws Exception { return service.addRole(role); }

    @GetMapping("/roles")
    public List<Role> getRoles() throws Exception { return service.getAllRoles(); }

    @PutMapping("/roles/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void updateRole(@PathVariable String id, @RequestBody Role role) throws Exception { service.updateRole(id, role); }

    @DeleteMapping("/roles/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteRole(@PathVariable String id) throws Exception { service.deleteRole(id); }

    // --- STAFF ---
    @PostMapping("/add")
    @PreAuthorize("hasRole('ADMIN')")
    public String addStaff(@RequestBody Staff staff) throws Exception { return service.addStaff(staff); }

    @GetMapping("/all")
    public List<Staff> getAll() throws Exception { return service.getAllStaff(); }

    @GetMapping("/{id}")
    public Staff getById(@PathVariable String id) throws Exception { return service.getStaffById(id); }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void update(@PathVariable String id, @RequestBody Map<String, Object> up) throws Exception { service.updateStaff(id, up); }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(@PathVariable String id) throws Exception { service.deleteStaff(id); }

    // --- ATTENDANCE ---
    @PostMapping("/attendance/mark-bulk")
    @PreAuthorize("hasRole('ADMIN')")
    public void markBulk(@RequestBody List<AttendanceRequest> reqs) throws Exception { service.markAttendanceBulk(reqs); }

    @PostMapping("/attendance/mark")
    @PreAuthorize("hasRole('ADMIN')")
    public void markSingle(@RequestBody AttendanceRequest req) throws Exception { service.markAttendanceSingle(req); }

    @GetMapping("/attendance/day/{date}")
    public Map<String, Object> getDay(@PathVariable String date) throws Exception { return service.getDayAttendance(date); }

    @GetMapping("/attendance/month/{year}/{month}")
    public List<Map<String, Object>> getMonth(@PathVariable String year, @PathVariable String month) throws Exception {
        return service.getMonthAttendance(year, month);
    }

    @GetMapping("/attendance/staff/{staffId}/{yearMonth}")
    public Map<String, Object> getStaffMonth(@PathVariable String staffId, @PathVariable String yearMonth) throws Exception {
        return service.getStaffMonth(staffId, yearMonth);
    }

    // --- COMMISSION ENDPOINTS ---
    @PostMapping("/commissions/add")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> addCommission(@RequestBody Map<String, Object> data) throws Exception {
        service.addCommission(data);
        return ResponseEntity.ok(Map.of("message", "Staff commission recorded successfully"));
    }

    @DeleteMapping("/commissions/bill/{billId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER')")
    public ResponseEntity<?> deleteCommissionsByBillId(@PathVariable String billId) throws Exception {
        service.deleteCommissionsByBillId(billId);
        return ResponseEntity.ok(Map.of("message", "Staff commissions deleted"));
    }

    // --- SALARY ENDPOINT ---
    @GetMapping("/salary/{staffId}/{yearMonth}")
    @PreAuthorize("hasRole('ADMIN')")
    public SalarySlip getSalarySlip(
            @PathVariable String staffId,
            @PathVariable String yearMonth) throws Exception {
        return service.generateSalarySlip(staffId, yearMonth);
    }

    // --- COMMISSIONS ENDPOINTS ---
    @GetMapping("/commissions/{staffId}")
    public List<Map<String, Object>> getStaffCommissions(
            @PathVariable String staffId,
            @RequestParam String yearMonth) throws Exception {
        return service.getCommissionsForStaff(staffId, yearMonth);
    }

    @GetMapping("/commissions/all")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Map<String, Object>> getAllCommissions() throws Exception {
        return service.getAllCommissions();
    }

    @PatchMapping("/commissions/{id}/pay")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> payCommission(@PathVariable String id) throws Exception {
        service.markCommissionAsPaid(id);
        return ResponseEntity.ok(Map.of("message", "Commission status updated to PAID"));
    }

    // ==================== APP SETTINGS ====================

    @GetMapping("/settings")
    @PreAuthorize("hasAnyRole('ADMIN', 'CASHIER', 'STAFF')")
    public AppSettings getAppSettings() throws Exception {
        return service.getAppSettings();
    }

    @PostMapping("/settings")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> saveAppSettings(@RequestBody AppSettings settings) throws Exception {
        service.saveAppSettings(settings);
        return ResponseEntity.ok(Map.of("message", "App settings saved successfully"));
    }

    // ==================== STAFF AUTH LOGIN (Mobile App) ====================

    @PostMapping("/auth/login")
    public ResponseEntity<?> staffLogin(@RequestBody StaffLoginRequest request) {
        try {
            Map<String, Object> result = service.staffLogin(request);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("message", e.getMessage()));
        }
    }

    // ==================== SELF-MARK ATTENDANCE (Mobile App) ====================

    @PostMapping("/attendance/self-mark")
    public ResponseEntity<?> selfMarkAttendance(@RequestBody SelfMarkRequest request) {
        try {
            Map<String, Object> result = service.selfMarkAttendance(request);
            if (Boolean.FALSE.equals(result.get("success"))) {
                return ResponseEntity.status(403).body(result);
            }
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // ==================== CHECK TODAY ATTENDANCE ====================

    @GetMapping("/attendance/check-today/{staffId}/{date}")
    public Map<String, Object> checkTodayAttendance(
            @PathVariable String staffId,
            @PathVariable String date) throws Exception {
        return service.checkTodayAttendance(staffId, date);
    }

    // ==================== AUTO-ABSENT ====================

    @PostMapping("/attendance/auto-absent/{date}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> autoMarkAbsent(@PathVariable String date) throws Exception {
        service.autoMarkAbsent(date);
        return ResponseEntity.ok(Map.of("message", "Auto-absent marking completed for " + date));
    }

    // ==================== STAFF PROFILE & MY DATA ====================

    @GetMapping("/{id}/profile")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public Map<String, Object> getStaffProfile(@PathVariable String id) throws Exception {
        return service.getStaffProfile(id);
    }

    @GetMapping("/{id}/my-attendance/{yearMonth}")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public Map<String, Object> getMyAttendance(
            @PathVariable String id,
            @PathVariable String yearMonth) throws Exception {
        return service.getMyAttendance(id, yearMonth);
    }

    @GetMapping("/{id}/my-salary/{yearMonth}")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public SalarySlip getMySalary(
            @PathVariable String id,
            @PathVariable String yearMonth) throws Exception {
        return service.getMySalary(id, yearMonth);
    }

    // ==================== STAFF TARGETS ====================

    @PostMapping("/targets")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createTarget(@RequestBody StaffTarget target) throws Exception {
        String id = service.createTarget(target);
        return ResponseEntity.ok(Map.of("id", id, "message", "Target created successfully"));
    }

    @GetMapping("/targets")
    public List<StaffTarget> getAllTargets() throws Exception {
        return service.getAllTargets();
    }

    @GetMapping("/targets/staff/{staffId}")
    public List<StaffTarget> getTargetsByStaff(@PathVariable String staffId) throws Exception {
        return service.getTargetsByStaff(staffId);
    }

    @PutMapping("/targets/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateTarget(@PathVariable String id, @RequestBody Map<String, Object> updates) throws Exception {
        service.updateTarget(id, updates);
        return ResponseEntity.ok(Map.of("message", "Target updated successfully"));
    }

    @DeleteMapping("/targets/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteTarget(@PathVariable String id) throws Exception {
        service.deleteTarget(id);
        return ResponseEntity.ok(Map.of("message", "Target deleted successfully"));
    }

    // ==================== STAFF TASKS ====================

    @PostMapping("/tasks")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createTask(@RequestBody StaffTask task) throws Exception {
        String id = service.createTask(task);
        return ResponseEntity.ok(Map.of("id", id, "message", "Task appointed successfully"));
    }

    @GetMapping("/tasks")
    public List<StaffTask> getAllTasks() throws Exception {
        return service.getAllTasks();
    }

    @GetMapping("/tasks/staff/{staffId}")
    public List<StaffTask> getTasksByStaff(@PathVariable String staffId) throws Exception {
        return service.getTasksByStaff(staffId);
    }

    @PatchMapping("/tasks/{id}/status")
    public ResponseEntity<?> updateTaskStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> body) throws Exception {
        String status = body.getOrDefault("status", "COMPLETED");
        String completedBy = body.get("completedBy");
        service.updateTaskStatus(id, status, completedBy);
        return ResponseEntity.ok(Map.of("message", "Task status updated successfully"));
    }

    @PutMapping("/tasks/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateTask(@PathVariable String id, @RequestBody Map<String, Object> updates) throws Exception {
        service.updateTask(id, updates);
        return ResponseEntity.ok(Map.of("message", "Task updated successfully"));
    }

    @DeleteMapping("/tasks/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteTask(@PathVariable String id) throws Exception {
        service.deleteTask(id);
        return ResponseEntity.ok(Map.of("message", "Task deleted successfully"));
    }
}

