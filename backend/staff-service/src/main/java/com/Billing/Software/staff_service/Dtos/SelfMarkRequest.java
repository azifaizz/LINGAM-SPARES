package com.Billing.Software.staff_service.Dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SelfMarkRequest {
    private String staffId;
    private String date;
    private double latitude;
    private double longitude;
}
