package com.Billing.Software.billing_service.Config;

import com.twilio.Twilio;
import jakarta.annotation.PostConstruct;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "twilio")
@Data
public class TwilioConfig {
    private String accountSid;
    private String authToken;
    private String fromNumber;

    @PostConstruct
    public void init() {
        if (accountSid != null && !accountSid.isEmpty() && authToken != null && !authToken.isEmpty()) {
            try {
                Twilio.init(accountSid, authToken);
                System.out.println("Twilio initialized successfully");
            } catch (Exception e) {
                System.err.println("Twilio initialization error: " + e.getMessage());
            }
        } else {
            System.out.println("Twilio credentials not found. SMS service disabled.");
        }
    }
}
