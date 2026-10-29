package com.Billing.Software.vendor_service.Entity;

import lombok.*;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Vendor {
    private String id;
    private String name;
    private String phone;
    private String address;
    private String gstNo;
    private String vendorInvoice;
    private String state;
    private List<String> transactions; // IDs of transactions
}
