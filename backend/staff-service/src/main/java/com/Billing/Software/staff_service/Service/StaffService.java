package com.Billing.Software.staff_service.Service;

import com.Billing.Software.staff_service.Dtos.AttendanceRequest;
import com.Billing.Software.staff_service.Dtos.SalarySlip;
import com.Billing.Software.staff_service.Dtos.SelfMarkRequest;
import com.Billing.Software.staff_service.Dtos.StaffLoginRequest;
import com.Billing.Software.staff_service.Entity.AppSettings;
import com.Billing.Software.staff_service.Entity.Role;
import com.Billing.Software.staff_service.Entity.Staff;
import com.Billing.Software.staff_service.Entity.StaffTarget;
import com.Billing.Software.staff_service.Entity.StaffTask;
import com.google.cloud.firestore.*;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StaffService {

    private final Firestore firestore;
    private static final String COL_STAFF = "staffs";
    private static final String COL_ROLES = "roles";
    private static final String COL_ATTENDANCE = "attendance";
    private static final String COL_COMMISSIONS = "staff_commissions";
    private static final String COL_COUNTERS = "_counters";
    private static final String COL_APP_SETTINGS = "app_settings";
    private static final String COL_TARGETS = "staff_targets";
    private static final String COL_TASKS = "staff_tasks";


    // --- STAFF CRUD ---
    @CacheEvict(value = "staff", allEntries = true)
    public String addStaff(Staff staff) throws Exception {
        staff.setId(generateSequenceId());
        staff.setActive(true);
        staff.setCreatedAt(new Date());

        // Defaults
        if(staff.getBaseSalary() == 0) staff.setBaseSalary(10000);
        if(staff.getAllowedPermHours() == 0) staff.setAllowedPermHours(2.0);

        // Ensure bank details are stored as empty strings if null to avoid null pointers in UI
        if(staff.getAccountNumber() == null) staff.setAccountNumber("");
        if(staff.getIfscCode() == null) staff.setIfscCode("");
        if(staff.getProfilePicUrl() == null) staff.setProfilePicUrl("");

        firestore.collection(COL_STAFF).document(staff.getId()).set(staff).get();
        return staff.getId();
    }

    @Cacheable("staff")
    public List<Staff> getAllStaff() throws Exception {
        return firestore.collection(COL_STAFF).whereEqualTo("active", true).get().get().toObjects(Staff.class);
    }

    @Cacheable(value = "staff", key = "#id")
    public Staff getStaffById(String id) throws Exception {
        DocumentSnapshot doc = firestore.collection(COL_STAFF).document(id).get().get();
        return doc.exists() ? doc.toObject(Staff.class) : null;
    }

    @CacheEvict(value = "staff", allEntries = true)
    public void updateStaff(String id, Map<String, Object> updates) throws Exception {
        firestore.collection(COL_STAFF).document(id).update(updates).get();
    }

    @CacheEvict(value = "staff", allEntries = true)
    public void deleteStaff(String id) throws Exception {
        firestore.collection(COL_STAFF).document(id).update("active", false).get();
    }

    // --- NEW: STAFF COMMISSION LOGIC ---

    /**
     * Called by Billing Service via StaffController
     */



    /**
     * Helper to calculate total commission for a specific month
     */
    private double getMonthlyCommissions(String staffId, String yearMonth) throws Exception {
        String[] parts = yearMonth.split("-");
        int year = Integer.parseInt(parts[0]);
        int month = Integer.parseInt(parts[1]);

        Calendar cal = Calendar.getInstance();
        cal.set(year, month - 1, 1, 0, 0, 0);
        Date start = cal.getTime();

        cal.set(Calendar.DAY_OF_MONTH, cal.getActualMaximum(Calendar.DAY_OF_MONTH));
        cal.set(Calendar.HOUR_OF_DAY, 23);
        cal.set(Calendar.MINUTE, 59);
        Date end = cal.getTime();

        // If your Firestore contains STRINGS, this query will return 0.
        // If your Firestore contains TIMESTAMPS, this query will work.
        List<QueryDocumentSnapshot> docs = firestore.collection(COL_COMMISSIONS)
                .whereEqualTo("staffId", staffId)
                .get().get().getDocuments();

        // Fallback calculation: Filter manually if the range query fails
        return docs.stream()
                .filter(d -> {
                    // This manually checks if the commission belongs to the requested month
                    Object dObj = d.get("date");
                    if (dObj instanceof com.google.cloud.Timestamp) {
                        Date dDate = ((com.google.cloud.Timestamp) dObj).toDate();
                        return !dDate.before(start) && !dDate.after(end);
                    } else if (dObj instanceof String) {
                        return ((String) dObj).startsWith(yearMonth);
                    }
                    return false;
                })
                .mapToDouble(d -> d.getDouble("amount") != null ? d.getDouble("amount") : 0.0)
                .sum();
    }
    // --- ATTENDANCE LOGIC ---
    public void markAttendanceBulk(List<AttendanceRequest> requests) throws Exception {
        if (requests == null || requests.isEmpty()) return;
        WriteBatch batch = firestore.batch();
        for (AttendanceRequest req : requests) {
            prepareAttendanceBatch(batch, req);
        }
        batch.commit().get();
    }

    public void markAttendanceSingle(AttendanceRequest req) throws Exception {
        WriteBatch batch = firestore.batch();
        prepareAttendanceBatch(batch, req);
        batch.commit().get();
    }

    // 1. IMPROVED ATTENDANCE LOGIC
    private void prepareAttendanceBatch(WriteBatch batch, AttendanceRequest req) {
        if (req.getDate() == null || !req.getDate().contains("-")) {
            throw new IllegalArgumentException("Invalid date format. Expected YYYY-MM-DD");
        }
        String[] parts = req.getDate().split("-");
        String year = parts[0];
        String month = parts[1];
        String day = parts[2];
        String yearMonth = year + "-" + month;

        // 1. Update Daily Attendance View (The one in your screenshot)
        DocumentReference dailyRef = firestore.collection(COL_ATTENDANCE)
                .document(year).collection("months").document(month)
                .collection("days").document(day);

        Map<String, Object> staffData = new HashMap<>();
        staffData.put("name", req.getStaffName());
        staffData.put("status", req.getType());
        staffData.put("in", req.getInTime());
        staffData.put("out", req.getOutTime()); // ADDED
        staffData.put("remarks", req.getRemarks()); // ADDED
        staffData.put("permTimeRange", req.getPermissionTimeRange()); // ADDED

        Map<String, Object> dailyUpdate = new HashMap<>();
        dailyUpdate.put(req.getStaffId(), staffData);
        batch.set(dailyRef, dailyUpdate, SetOptions.merge());

        // 2. Update Staff's Individual Record (Used for Salary Calculation)
        DocumentReference staffRef = firestore.collection(COL_STAFF)
                .document(req.getStaffId()).collection("attendance").document(yearMonth);

        Map<String, Object> dayData = new HashMap<>();
        dayData.put("status", req.getType());
        dayData.put("in", req.getInTime());
        dayData.put("out", req.getOutTime());
        dayData.put("permHrs", req.getPermissionHours());
        dayData.put("permTimeRange", req.getPermissionTimeRange()); // ADDED
        dayData.put("remarks", req.getRemarks()); // ADDED

        Map<String, Object> staffUpdate = new HashMap<>();
        staffUpdate.put(day, dayData);
        batch.set(staffRef, staffUpdate, SetOptions.merge());
    }

    public Map<String, Object> getDayAttendance(String date) throws Exception {
        String[] p = date.split("-");
        DocumentSnapshot doc = firestore.collection(COL_ATTENDANCE).document(p[0])
                .collection("months").document(p[1])
                .collection("days").document(p[2]).get().get();
        return doc.exists() ? doc.getData() : new HashMap<>();
    }

    public List<Map<String, Object>> getMonthAttendance(String year, String month) throws Exception {
        return firestore.collection(COL_ATTENDANCE).document(year)
                .collection("months").document(month).collection("days")
                .get().get().getDocuments().stream()
                .map(d -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("day", d.getId());
                    map.putAll(d.getData());
                    return map;
                })
                .collect(Collectors.toList());
    }

    public Map<String, Object> getStaffMonth(String staffId, String yearMonth) throws Exception {
        DocumentSnapshot doc = firestore.collection(COL_STAFF).document(staffId)
                .collection("attendance").document(yearMonth).get().get();
        return doc.exists() ? doc.getData() : new HashMap<>();
    }

    /**
     * Public method to retrieve list of all commission records for a specific month
     */
    public List<Map<String, Object>> getCommissionsForStaff(String staffId, String yearMonth) throws Exception {
        String[] parts = yearMonth.split("-");
        int year = Integer.parseInt(parts[0]);
        int month = Integer.parseInt(parts[1]);

        Calendar cal = Calendar.getInstance();
        cal.set(year, month - 1, 1, 0, 0, 0);
        Date start = cal.getTime();

        cal.set(Calendar.DAY_OF_MONTH, cal.getActualMaximum(Calendar.DAY_OF_MONTH));
        cal.set(Calendar.HOUR_OF_DAY, 23);
        cal.set(Calendar.MINUTE, 59);
        Date end = cal.getTime();

        List<QueryDocumentSnapshot> docs = firestore.collection(COL_COMMISSIONS)
                .whereEqualTo("staffId", staffId)
                .get().get().getDocuments();

        return docs.stream()
                .filter(d -> {
                    Object dObj = d.get("date");
                    if (dObj instanceof com.google.cloud.Timestamp) {
                        Date dDate = ((com.google.cloud.Timestamp) dObj).toDate();
                        return !dDate.before(start) && !dDate.after(end);
                    } else if (dObj instanceof String) {
                        return ((String) dObj).startsWith(yearMonth);
                    }
                    return false;
                })
                .map(d -> {
                    Map<String, Object> map = d.getData();
                    map.put("id", d.getId());
                    return map;
                })
                .collect(Collectors.toList());
    }

    // --- SALARY CALCULATION (UPDATED WITH COMMISSIONS) ---
    // 1. Initializing status as UNPAID when billing creates a commission
    public void addCommission(Map<String, Object> data) throws Exception {
        String id = UUID.randomUUID().toString();
        data.put("id", id);
        data.put("status", "UNPAID"); // DEFAULT STATUS
        data.put("paidDate", null);

        firestore.collection(COL_COMMISSIONS).document(id).set(data).get();
    }

    // 2. New method to handle separate payments
    public void markCommissionAsPaid(String id) throws Exception {
        DocumentReference ref = firestore.collection(COL_COMMISSIONS).document(id);
        ref.update("status", "PAID", "paidDate", new Date()).get();
    }

    public void deleteCommissionsByBillId(String billId) throws Exception {
        List<QueryDocumentSnapshot> docs = firestore.collection(COL_COMMISSIONS).whereEqualTo("billId", billId).get().get().getDocuments();
        for (QueryDocumentSnapshot doc : docs) {
            doc.getReference().delete().get();
        }
    }

    // 3. Updated Salary Calculation (Commissions no longer added to Net Salary)
    public SalarySlip generateSalarySlip(String staffId, String yearMonth) throws Exception {
        Staff staff = getStaffById(staffId);
        if (staff == null) throw new RuntimeException("Staff not found");

        Map<String, Object> monthData = getStaffMonth(staffId, yearMonth);

        // Fetch Monthly Commissions for display only
        double monthlyCommissions = getMonthlyCommissions(staffId, yearMonth);

        // Variables for attendance counting
        int present = 0;
        int absent = 0;
        int halfDays = 0;
        int sickLeaves = 0;
        double permissionHrs = 0.0;

        // Logic to process attendance from Firestore maps
        for (Map.Entry<String, Object> entry : monthData.entrySet()) {
            if (entry.getValue() instanceof Map) {
                Map<String, Object> dayRecord = (Map<String, Object>) entry.getValue();
                String status = (String) dayRecord.getOrDefault("status", "ABSENT");

                switch (status) {
                    case "FULL_DAY":
                    case "PRESENT":
                        present++;
                        break;
                    case "HALF_DAY":
                        halfDays++;
                        break;
                    case "LEAVE":
                    case "SICK_LEAVE":
                        sickLeaves++;
                        break;
                    case "PERMISSION":
                        present++;
                        Object ph = dayRecord.get("permHrs");
                        if (ph instanceof Number) {
                            permissionHrs += ((Number) ph).doubleValue();
                        }
                        break;
                    case "ABSENT":
                        absent++;
                        break;
                    default:
                        // Don't count unknown statuses as absent
                        break;
                }
            }
        }

        // Calculate working days (exclude Sundays)
        String[] ymParts = yearMonth.split("-");
        int yr = Integer.parseInt(ymParts[0]);
        int mo = Integer.parseInt(ymParts[1]);
        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.set(yr, mo - 1, 1);
        int daysInMonth = cal.getActualMaximum(java.util.Calendar.DAY_OF_MONTH);
        int sundayCount = 0;
        for (int d = 1; d <= daysInMonth; d++) {
            cal.set(yr, mo - 1, d);
            if (cal.get(java.util.Calendar.DAY_OF_WEEK) == java.util.Calendar.SUNDAY) {
                sundayCount++;
            }
        }
        int workingDays = daysInMonth - sundayCount;
        if (workingDays <= 0) workingDays = 30;

        // Financial Calculations
        double baseSalary = staff.getBaseSalary();
        double perDay = baseSalary / workingDays;
        double perHour = perDay / 9.0;

        double lopAmount = (absent * perDay) + (halfDays * 0.5 * perDay);

        double allowedPerm = staff.getAllowedPermHours() > 0 ? staff.getAllowedPermHours() : 0;
        double excessPerm = Math.max(0, permissionHrs - allowedPerm);
        double permissionDeduction = excessPerm * perHour;

        // Net Salary: Base - Loss of Pay - Permission Deductions (Commissions are separate)
        double netSalary = baseSalary - lopAmount - permissionDeduction;

        return SalarySlip.builder()
                .staffId(staffId)
                .staffName(staff.getName())
                .month(yearMonth)
                .baseSalary(baseSalary)
                .totalDays(workingDays)
                .presentDays(present)
                .absentDays(absent)
                .halfDays(halfDays)
                .sickLeaves(sickLeaves)
                .permissionHoursTaken(permissionHrs)
                .perDaySalary(perDay)
                .perHourSalary(perHour)
                .lopAmount(lopAmount)
                .permissionDeduction(permissionDeduction)
                .netSalary(netSalary)
                .build();
    }




    private String generateSequenceId() throws Exception {
        DocumentReference ref = firestore.collection(COL_COUNTERS).document("staff_count");
        return firestore.runTransaction(t -> {
            DocumentSnapshot snap = t.get(ref).get();
            long next = (snap.exists() && snap.getLong("current") != null) ? snap.getLong("current") : 0;
            next++;
            t.set(ref, Map.of("current", next));
            return String.format("S-%05d", next);
        }).get();
    }

    // --- ROLES CRUD ---
    @CacheEvict(value = "roles", allEntries = true)
    public String addRole(Role role) throws Exception {
        if (role.getRoleId() == null) role.setRoleId(UUID.randomUUID().toString());
        firestore.collection(COL_ROLES).document(role.getRoleId()).set(role).get();
        return role.getRoleId();
    }

    @Cacheable("roles")
    public List<Role> getAllRoles() throws Exception {
        return firestore.collection(COL_ROLES).get().get().toObjects(Role.class);
    }

    @CacheEvict(value = "roles", allEntries = true)
    public void updateRole(String id, Role role) throws Exception {
        firestore.collection(COL_ROLES).document(id).set(role).get();
    }

    @CacheEvict(value = "roles", allEntries = true)
    public void deleteRole(String id) throws Exception {
        firestore.collection(COL_ROLES).document(id).delete().get();
    }

    public List<Map<String, Object>> getAllCommissions() throws Exception {
        return firestore.collection(COL_COMMISSIONS)
                .orderBy("date", Query.Direction.DESCENDING)
                .get()
                .get()
                .getDocuments()
                .stream()
                .map(d -> {
                    Map<String, Object> map = d.getData();
                    map.put("id", d.getId());
                    return map;
                })
                .collect(Collectors.toList());
    }

    // ==================== APP SETTINGS ====================

    public AppSettings getAppSettings() throws Exception {
        DocumentSnapshot doc = firestore.collection(COL_APP_SETTINGS).document("default_location").get().get();
        if (!doc.exists()) {
            return AppSettings.builder()
                    .id("default_location")
                    .locationName("Main Office")
                    .latitude(12.844477)
                    .longitude(79.698623)
                    .radiusMeters(50)
                    .halfDayCutoffTime("10:30")
                    .build();
        }
        AppSettings settings = doc.toObject(AppSettings.class);
        if (settings != null) {
            settings.setId("default_location");
            // If stored settings had 0,0, provide sensible store defaults
            if (settings.getLatitude() == 0 && settings.getLongitude() == 0) {
                settings.setLatitude(12.844477);
                settings.setLongitude(79.698623);
                if (settings.getRadiusMeters() <= 0) settings.setRadiusMeters(50);
            }
        }
        return settings;
    }

    @CacheEvict(value = "staff", allEntries = true)
    public void saveAppSettings(AppSettings settings) throws Exception {
        settings.setId("default_location");
        // Prevent accidental wipe of coordinates to 0,0 if valid coordinates already existed
        if (settings.getLatitude() == 0 && settings.getLongitude() == 0) {
            DocumentSnapshot existing = firestore.collection(COL_APP_SETTINGS).document("default_location").get().get();
            if (existing.exists()) {
                AppSettings prev = existing.toObject(AppSettings.class);
                if (prev != null && (prev.getLatitude() != 0 || prev.getLongitude() != 0)) {
                    settings.setLatitude(prev.getLatitude());
                    settings.setLongitude(prev.getLongitude());
                    if (settings.getLocationName() == null || settings.getLocationName().trim().isEmpty()) {
                        settings.setLocationName(prev.getLocationName());
                    }
                }
            }
        }
        if (settings.getRadiusMeters() <= 0) {
            settings.setRadiusMeters(50);
        }
        if (settings.getHalfDayCutoffTime() == null || settings.getHalfDayCutoffTime().trim().isEmpty()) {
            settings.setHalfDayCutoffTime("10:30");
        }
        firestore.collection(COL_APP_SETTINGS).document("default_location").set(settings).get();
    }

    // ==================== STAFF AUTH LOGIN ====================

    public Map<String, Object> staffLogin(StaffLoginRequest request) throws Exception {
        List<QueryDocumentSnapshot> docs = firestore.collection(COL_STAFF)
                .whereEqualTo("appUsername", request.getUsername())
                .whereEqualTo("active", true)
                .get()
                .get()
                .getDocuments();

        if (docs.isEmpty()) {
            throw new RuntimeException("Invalid credentials");
        }

        QueryDocumentSnapshot doc = docs.get(0);
        Staff staff = doc.toObject(Staff.class);

        if (staff.getAppPassword() == null || !staff.getAppPassword().equals(request.getPassword())) {
            throw new RuntimeException("Invalid credentials");
        }

        Map<String, Object> response = new HashMap<>();
        response.put("staffId", staff.getId());
        response.put("name", staff.getName());
        response.put("phone", staff.getPhone());
        response.put("role", staff.getRole());
        response.put("appLocation", staff.getAppLocation());
        response.put("token", "session_" + staff.getId() + "_" + System.currentTimeMillis());
        return response;
    }

    // ==================== SELF-MARK ATTENDANCE ====================

    public Map<String, Object> selfMarkAttendance(SelfMarkRequest request) throws Exception {
        String[] parts = request.getDate().split("-");
        String year = parts[0];
        String month = parts[1];
        String day = parts[2];

        // 1. Check if already marked today
        DocumentSnapshot existingDoc = firestore.collection(COL_ATTENDANCE)
                .document(year).collection("months").document(month)
                .collection("days").document(day).get().get();

        if (existingDoc.exists()) {
            Map<String, Object> dayData = existingDoc.getData();
            if (dayData != null && dayData.containsKey(request.getStaffId())) {
                Map<String, Object> staffRecord = (Map<String, Object>) dayData.get(request.getStaffId());
                Map<String, Object> alreadyMarked = new HashMap<>();
                alreadyMarked.put("alreadyMarked", true);
                alreadyMarked.put("status", staffRecord.get("status"));
                alreadyMarked.put("inTime", staffRecord.get("in"));
                return alreadyMarked;
            }
        }

        // 2. Validate geofence (only when the office point is actually configured)
        AppSettings settings = getAppSettings();
        boolean geofenceConfigured = settings.getLatitude() != 0 || settings.getLongitude() != 0;
        double distance = geofenceConfigured
                ? calculateDistance(request.getLatitude(), request.getLongitude(), settings.getLatitude(), settings.getLongitude())
                : 0.0;

        if (geofenceConfigured && distance > settings.getRadiusMeters()) {
            Map<String, Object> tooFar = new HashMap<>();
            tooFar.put("success", false);
            tooFar.put("message", "You are not within office premises");
            tooFar.put("distance", Math.round(distance));
            tooFar.put("allowedRadius", settings.getRadiusMeters());
            return tooFar;
        }

        // 3. Mark attendance
        String inTime = new java.text.SimpleDateFormat("HH:mm", Locale.US).format(new Date());
        String staffName = "";
        Staff staff = getStaffById(request.getStaffId());
        if (staff != null) staffName = staff.getName();

        // Check against cutoff time
        String cutoffTime = settings.getHalfDayCutoffTime();
        if (cutoffTime == null || cutoffTime.trim().isEmpty()) {
            cutoffTime = "10:30"; // Default if not set
        }
        
        String attendanceStatus = "PRESENT";
        if (inTime.compareTo(cutoffTime) > 0) {
            attendanceStatus = "HALF_DAY";
        }

        WriteBatch batch = firestore.batch();

        // Daily attendance view
        DocumentReference dailyRef = firestore.collection(COL_ATTENDANCE)
                .document(year).collection("months").document(month)
                .collection("days").document(day);

        Map<String, Object> staffData = new HashMap<>();
        staffData.put("name", staffName);
        staffData.put("status", attendanceStatus);
        staffData.put("in", inTime);
        staffData.put("out", "-");
        staffData.put("remarks", inTime.compareTo(cutoffTime) > 0 ? "Late punch-in" : "");
        staffData.put("selfMarked", true);

        Map<String, Object> dailyUpdate = new HashMap<>();
        dailyUpdate.put(request.getStaffId(), staffData);
        batch.set(dailyRef, dailyUpdate, SetOptions.merge());

        // Staff individual record
        DocumentReference staffRef = firestore.collection(COL_STAFF)
                .document(request.getStaffId()).collection("attendance").document(year + "-" + month);

        Map<String, Object> dayData = new HashMap<>();
        dayData.put("status", attendanceStatus);
        dayData.put("in", inTime);
        dayData.put("out", "-");
        dayData.put("permHrs", 0);
        dayData.put("selfMarked", true);

        Map<String, Object> staffUpdate = new HashMap<>();
        staffUpdate.put(day, dayData);
        batch.set(staffRef, staffUpdate, SetOptions.merge());

        batch.commit().get();

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("status", attendanceStatus);
        result.put("inTime", inTime);
        result.put("distance", Math.round(distance));
        return result;
    }

    // ==================== CHECK TODAY ATTENDANCE ====================

    public Map<String, Object> checkTodayAttendance(String staffId, String date) throws Exception {
        String[] parts = date.split("-");
        String year = parts[0];
        String month = parts[1];
        String day = parts[2];

        DocumentSnapshot doc = firestore.collection(COL_ATTENDANCE)
                .document(year).collection("months").document(month)
                .collection("days").document(day).get().get();

        Map<String, Object> result = new HashMap<>();
        result.put("marked", false);

        if (doc.exists()) {
            Map<String, Object> dayData = doc.getData();
            if (dayData != null && dayData.containsKey(staffId)) {
                Map<String, Object> staffRecord = (Map<String, Object>) dayData.get(staffId);
                result.put("marked", true);
                result.put("status", staffRecord.get("status"));
                result.put("inTime", staffRecord.get("in"));
                result.put("outTime", staffRecord.get("out"));
                result.put("remarks", staffRecord.get("remarks"));
            }
        }
        return result;
    }

    // ==================== AUTO-ABSENT ====================

    @CacheEvict(value = "staff", allEntries = true)
    public void autoMarkAbsent(String date) throws Exception {
        String[] parts = date.split("-");
        String year = parts[0];
        String month = parts[1];
        String day = parts[2];

        List<Staff> allStaff = getAllStaff();
        DocumentSnapshot dayDoc = firestore.collection(COL_ATTENDANCE)
                .document(year).collection("months").document(month)
                .collection("days").document(day).get().get();

        Map<String, Object> existingData = dayDoc.exists() ? dayDoc.getData() : new HashMap<>();

        WriteBatch batch = firestore.batch();
        boolean hasChanges = false;

        for (Staff staff : allStaff) {
            if (!existingData.containsKey(staff.getId())) {
                hasChanges = true;

                // Daily record
                DocumentReference dailyRef = firestore.collection(COL_ATTENDANCE)
                        .document(year).collection("months").document(month)
                        .collection("days").document(day);

                Map<String, Object> absentData = new HashMap<>();
                absentData.put("name", staff.getName());
                absentData.put("status", "ABSENT");
                absentData.put("in", "-");
                absentData.put("out", "-");
                absentData.put("remarks", "Auto-marked absent");

                Map<String, Object> dailyUpdate = new HashMap<>();
                dailyUpdate.put(staff.getId(), absentData);
                batch.set(dailyRef, dailyUpdate, SetOptions.merge());

                // Staff individual record
                DocumentReference staffRef = firestore.collection(COL_STAFF)
                        .document(staff.getId()).collection("attendance").document(year + "-" + month);

                Map<String, Object> dayRecord = new HashMap<>();
                dayRecord.put("status", "ABSENT");
                dayRecord.put("in", "-");
                dayRecord.put("out", "-");

                Map<String, Object> staffUpdate = new HashMap<>();
                staffUpdate.put(day, dayRecord);
                batch.set(staffRef, staffUpdate, SetOptions.merge());
            }
        }

        if (hasChanges) {
            batch.commit().get();
        }
    }

    // ==================== STAFF PROFILE & MY ATTENDANCE ====================

    public Map<String, Object> getStaffProfile(String staffId) throws Exception {
        Staff staff = getStaffById(staffId);
        if (staff == null) throw new RuntimeException("Staff not found");

        Map<String, Object> profile = new HashMap<>();
        profile.put("staffId", staff.getId());
        profile.put("name", staff.getName());
        profile.put("phone", staff.getPhone());
        profile.put("emergencyPhone", staff.getEmergencyPhone());
        profile.put("role", staff.getRole());
        profile.put("baseSalary", staff.getBaseSalary());
        profile.put("allowedPermHours", staff.getAllowedPermHours());
        profile.put("accountNumber", staff.getAccountNumber());
        profile.put("ifscCode", staff.getIfscCode());
        profile.put("appUsername", staff.getAppUsername());
        profile.put("appLocation", staff.getAppLocation());
        profile.put("profilePicUrl", staff.getProfilePicUrl());
        return profile;
    }

    public Map<String, Object> getMyAttendance(String staffId, String yearMonth) throws Exception {
        return getStaffMonth(staffId, yearMonth);
    }

    public SalarySlip getMySalary(String staffId, String yearMonth) throws Exception {
        return generateSalarySlip(staffId, yearMonth);
    }

    // ==================== GEOFENCE HELPER ====================

    private double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371000; // Earth radius in meters
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // ==================== TARGETS CRUD ====================

    public String createTarget(StaffTarget target) throws Exception {
        if (target.getId() == null || target.getId().trim().isEmpty()) {
            target.setId(UUID.randomUUID().toString());
        }
        if (target.getCreatedAt() == null) {
            target.setCreatedAt(new Date());
        }
        target.setUpdatedAt(new Date());
        if (target.getStatus() == null || target.getStatus().trim().isEmpty()) {
            target.setStatus("IN_PROGRESS");
        }
        firestore.collection(COL_TARGETS).document(target.getId()).set(target).get();
        return target.getId();
    }

    public List<StaffTarget> getAllTargets() throws Exception {
        return firestore.collection(COL_TARGETS).get().get().toObjects(StaffTarget.class);
    }

    public List<StaffTarget> getTargetsByStaff(String staffId) throws Exception {
        return firestore.collection(COL_TARGETS)
                .whereEqualTo("staffId", staffId)
                .get().get().toObjects(StaffTarget.class);
    }

    public void updateTarget(String id, Map<String, Object> updates) throws Exception {
        updates.put("updatedAt", new Date());
        firestore.collection(COL_TARGETS).document(id).update(updates).get();
    }

    public void deleteTarget(String id) throws Exception {
        firestore.collection(COL_TARGETS).document(id).delete().get();
    }

    // ==================== TASKS CRUD ====================

    public String createTask(StaffTask task) throws Exception {
        if (task.getId() == null || task.getId().trim().isEmpty()) {
            task.setId(UUID.randomUUID().toString());
        }
        if (task.getCreatedAt() == null) {
            task.setCreatedAt(new Date());
        }
        if (task.getStatus() == null || task.getStatus().trim().isEmpty()) {
            task.setStatus("PENDING");
        }
        if (task.getPriority() == null || task.getPriority().trim().isEmpty()) {
            task.setPriority("MEDIUM");
        }
        firestore.collection(COL_TASKS).document(task.getId()).set(task).get();
        return task.getId();
    }

    public List<StaffTask> getAllTasks() throws Exception {
        return firestore.collection(COL_TASKS).get().get().toObjects(StaffTask.class);
    }

    public List<StaffTask> getTasksByStaff(String staffId) throws Exception {
        List<StaffTask> specific = firestore.collection(COL_TASKS)
                .whereEqualTo("assignedStaffId", staffId)
                .get().get().toObjects(StaffTask.class);
        List<StaffTask> general = firestore.collection(COL_TASKS)
                .whereEqualTo("assignedStaffId", "ALL")
                .get().get().toObjects(StaffTask.class);
        List<StaffTask> combined = new ArrayList<>(specific);
        for (StaffTask t : general) {
            if (combined.stream().noneMatch(x -> x.getId().equals(t.getId()))) {
                combined.add(t);
            }
        }
        return combined;
    }

    public void updateTaskStatus(String id, String status, String completedBy) throws Exception {
        Map<String, Object> updates = new HashMap<>();
        updates.put("status", status);
        if ("COMPLETED".equalsIgnoreCase(status)) {
            updates.put("completedAt", new Date());
            updates.put("completedBy", completedBy != null ? completedBy : "Staff");
        } else {
            updates.put("completedAt", null);
            updates.put("completedBy", null);
        }
        firestore.collection(COL_TASKS).document(id).update(updates).get();
    }

    public void updateTask(String id, Map<String, Object> updates) throws Exception {
        firestore.collection(COL_TASKS).document(id).update(updates).get();
    }

    public void deleteTask(String id) throws Exception {
        firestore.collection(COL_TASKS).document(id).delete().get();
    }
}