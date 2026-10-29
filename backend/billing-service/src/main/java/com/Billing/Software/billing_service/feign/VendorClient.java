package com.Billing.Software.billing_service.feign;

import com.Billing.Software.billing_service.dto.BillTransactionDTO;
import com.Billing.Software.billing_service.dto.CommissionDTO;
import com.Billing.Software.billing_service.dto.CustomerDTO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import java.util.Map;

@FeignClient(name = "vendor-service", url = "${vendor.service.url}")
public interface VendorClient {

    @PostMapping("/api/broker/commissions/add")
    void addCommission(@RequestHeader("Authorization") String auth, @RequestBody CommissionDTO commission);

    @PostMapping("/api/customers/{phone}/transactions")
    void addCustomerTransaction(
            @RequestHeader("Authorization") String auth,
            @PathVariable("phone") String phone,
            @RequestBody BillTransactionDTO transaction
    );

    // --- CHANGED: Return Map to get 'id' ---
    @PostMapping("/api/customers/add")
    Map<String, String> addCustomer(@RequestHeader("Authorization") String auth, @RequestBody CustomerDTO customer);

    @org.springframework.web.bind.annotation.DeleteMapping("/api/customers/transactions/bill/{billId}")
    void deleteCustomerTransactionsByBillId(@RequestHeader("Authorization") String auth, @PathVariable("billId") String billId);

    @org.springframework.web.bind.annotation.DeleteMapping("/api/broker/commissions/bill/{billId}")
    void deleteCommissionsByBillId(@RequestHeader("Authorization") String auth, @PathVariable("billId") String billId);
}