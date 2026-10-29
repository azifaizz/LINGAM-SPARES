package com.Billing.Software.billing_service.Security;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class FirebaseAuthFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        String path = request.getRequestURI();
        // Diagnostic Logging
        System.out.println("Security Filter Check: URI=" + path + " Context=" + request.getContextPath());

        // CRITICAL FIX: Explicitly bypass authentication for public endpoints
        // This ensures doFilter is called immediately without touching SecurityContext
        if (path.contains("/api/notifications") ||
                path.contains("/api/billing/daybook") ||
                path.equals("/api/billing/status") ||
                path.equals("/api/billing/all") ||
                path.equals("/api/estimations/all")) {
            chain.doFilter(request, response);
            return;
        }

        String header = request.getHeader("Authorization");

        // 1. If no token, continue as Anonymous
        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        try {
            // 2. Try to verify token
            String token = header.substring(7);
            FirebaseToken firebaseToken = FirebaseAuth.getInstance().verifyIdToken(token);
            String uid = firebaseToken.getUid();

            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    uid, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN"), new SimpleGrantedAuthority("ROLE_CASHIER")));

            SecurityContextHolder.getContext().setAuthentication(auth);

        } catch (Exception e) {
            // 3. CRITICAL FIX: If token fails, DO NOT send error.
            // Just clear context and let Spring Security decide based on permitAll.
            System.err.println("Token Verification Failed (Continuing as Anonymous): " + e.getMessage());
            SecurityContextHolder.clearContext();
        }

        // 4. Continue the chain
        chain.doFilter(request, response);
    }
}