package com.Billing.Software.billing_service.feign;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import java.util.Map;

@FeignClient(name = "staff-service", url = "${staff.service.url}")
public interface StaffClient {

    @PostMapping("/api/staff/commissions/add")
    void addStaffCommission(@RequestHeader("Authorization") String auth, @RequestBody Map<String, Object> commissionData);

    @org.springframework.web.bind.annotation.DeleteMapping("/api/staff/commissions/bill/{billId}")
    void deleteStaffCommissionsByBillId(@RequestHeader("Authorization") String auth, @org.springframework.web.bind.annotation.PathVariable("billId") String billId);
}