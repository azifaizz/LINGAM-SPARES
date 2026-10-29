package com.Billing.Software.vendor_service.Entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Broker {
    private String id;
    private String name;
    private String phone;
    private String address;
    private String gstNo;
    private String category;
    private List<String> commissions; // List of Commission IDs
}