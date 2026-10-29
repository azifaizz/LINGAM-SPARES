package com.Billing.Software.product_service.feign;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;

// Inside VendorClient.java (product-service)

@FeignClient(name = "vendor-service", url = "${vendor.service.url}")
public interface VendorClient {

    @PutMapping("/api/vendors/transactions/sync-details/{productId}")
    void syncProductDetails(
            @RequestHeader("Authorization") String auth,
            @PathVariable("productId") String productId,
            @RequestParam("rate") double rate,
            @RequestParam("gst") double gst,
            @RequestParam("stock") int stock);
}