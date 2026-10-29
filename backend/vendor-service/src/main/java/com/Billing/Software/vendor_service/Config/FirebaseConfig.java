package com.Billing.Software.vendor_service.Config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.util.List;

@Configuration
public class FirebaseConfig {

    // Scopes required by the Firebase Admin SDK (Firestore + identity).
    private static final List<String> FIREBASE_SCOPES = List.of(
            "https://www.googleapis.com/auth/datastore",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/cloud-platform");

    /**
     * Resolves Google credentials in a way that works both locally and on Cloud Run:
     *
     * 1) Local dev: uses classpath:serviceAccountKey.json when present (same as the
     *    reference project).
     * 2) Cloud Run / GCP: falls back to Application Default Credentials, which pick up
     *    the service account attached to the Cloud Run revision. No key file needs to be
     *    baked into the image — which is why the key file is gitignored.
     */
    private GoogleCredentials resolveCredentials() throws IOException {
        ClassPathResource keyFile = new ClassPathResource("serviceAccountKey.json");
        GoogleCredentials credentials;

        if (keyFile.exists()) {
            credentials = GoogleCredentials.fromStream(keyFile.getInputStream());
        } else {
            // No key file in the image → use the ambient service account / gcloud ADC.
            credentials = GoogleCredentials.getApplicationDefault();
        }

        if (credentials.createScopedRequired()) {
            credentials = credentials.createScoped(FIREBASE_SCOPES);
        }
        return credentials;
    }

    @Bean
    public FirebaseApp firebaseApp() throws IOException {
        // Guard against "default FirebaseApp already exists" when Spring
        // instantiates more than one bean that triggers initialization.
        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.getInstance();
        }

        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(resolveCredentials())
                .setProjectId("real-estateoo1")
                .build();
        System.out.println("✅ Firebase App initialized successfully");
        return FirebaseApp.initializeApp(options);
    }

    @Bean
    public Firestore firestore(FirebaseApp firebaseApp) {
        return FirestoreClient.getFirestore(firebaseApp);
    }

}
