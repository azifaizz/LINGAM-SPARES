package com.Billing.Software.billing_service.Config;

import com.Billing.Software.billing_service.Security.FirebaseAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final FirebaseAuthFilter firebaseAuthFilter;

    public SecurityConfig(FirebaseAuthFilter firebaseAuthFilter) {
        this.firebaseAuthFilter = firebaseAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .authorizeHttpRequests(auth -> auth
                        // Allow specific DayBook endpoints explicitly
                        .requestMatchers("/api/billing/daybook/**").permitAll()
                        .requestMatchers("/api/billing/status").permitAll()
                        .requestMatchers("/api/notifications/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/billing/all").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/estimations/all").permitAll()
                        .requestMatchers("/api/reports/**").authenticated()
                        // Secure everything else
                        .anyRequest().authenticated())
                .addFilterBefore(firebaseAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Defines a permissive CORS configuration source.
     * This is crucial for allowing requests from any UI/origin.
     * Note: This bean name must match the parameter passed to .cors() if you don't
     * use the explicit setter.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // Allows requests from any UI/Origin
        configuration.addAllowedOriginPattern("*");

        // Allows all methods (GET, POST, PUT, DELETE, etc.)
        configuration.addAllowedMethod("*");

        // Allows all headers (including Authorization)
        configuration.addAllowedHeader("*");

        // Allows the exchange of credentials (cookies, auth headers)
        configuration.setAllowCredentials(true);

        // Apply this configuration to all endpoints
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);

        return source;
    }
}
