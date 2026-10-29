package com.Billing.Software.product_service.Controller;

import com.Billing.Software.product_service.Utils.FirebaseAuthService;
import com.google.firebase.auth.FirebaseAuthException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @GetMapping
    public String status() {
        return "Auth Controller is running";
    }

    @Autowired
    private FirebaseAuthService firebaseAuthService;

    @PostMapping("/setRole")
    public String setRole(@RequestBody Map<String, String> body) throws FirebaseAuthException {
        String uid = body.get("uid");
        String role = body.get("role");

        firebaseAuthService.setUserRole(uid, role);
        return "Role " + role + " added to user " + uid;
    }
}
