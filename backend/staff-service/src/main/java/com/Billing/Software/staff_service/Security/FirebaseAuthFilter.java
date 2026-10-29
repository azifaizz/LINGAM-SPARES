package com.Billing.Software.staff_service.Security;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import org.springframework.beans.factory.annotation.Autowired;

@Component
public class FirebaseAuthFilter extends OncePerRequestFilter {

    @Autowired(required = false)
    private Firestore firestore;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        String token = header.substring(7);

        // Handle custom session tokens from staff mobile app
        if (token.startsWith("session_")) {
            // Format: session_<staffId>_<timestamp>
            String staffId = token.split("_")[1];
            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(staffId, null,
                            List.of(new SimpleGrantedAuthority("ROLE_STAFF")));
            SecurityContextHolder.getContext().setAuthentication(auth);
            chain.doFilter(request, response);
            return;
        }

        // Handle Firebase ID tokens
        try {
            FirebaseToken decoded = FirebaseAuth.getInstance().verifyIdToken(token);

            String uid = decoded.getUid();
            String roleStr = (String) decoded.getClaims().get("role");
            if (roleStr == null || !roleStr.equalsIgnoreCase("ADMIN")) {
                if (firestore != null) {
                    try {
                        DocumentSnapshot userDoc = firestore.collection("users").document(uid).get().get();
                        if (userDoc.exists()) {
                            String fsRole = userDoc.getString("role");
                            if (fsRole != null && fsRole.equalsIgnoreCase("ADMIN")) {
                                roleStr = "ADMIN";
                            }
                        }
                    } catch (Exception ignored) {
                    }
                }
            }
            if (roleStr == null || !roleStr.equalsIgnoreCase("ADMIN")) {
                roleStr = "CASHIER";
            }
            String role = roleStr;

            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(uid, null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase())));

            SecurityContextHolder.getContext().setAuthentication(auth);
            chain.doFilter(request, response);
        } catch (Exception ex) {
            response.sendError(HttpStatus.UNAUTHORIZED.value(), "Invalid or expired token");
        }
    }
}
