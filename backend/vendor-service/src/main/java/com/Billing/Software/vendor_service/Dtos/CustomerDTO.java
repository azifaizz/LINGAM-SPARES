package com.Billing.Software.vendor_service.Dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerDTO {
    private String id; // Optional, usually null on creation
    private String name;
    private String phone;
    private String email;
    private String address;
    private String gstNo; // if you have it
}