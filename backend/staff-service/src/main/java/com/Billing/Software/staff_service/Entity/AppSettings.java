package com.Billing.Software.staff_service.Entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppSettings {
    private String id;
    private String locationName;
    private double latitude;
    private double longitude;
    private int radiusMeters;
    private String halfDayCutoffTime; // "HH:mm" format (24-hour)
}
