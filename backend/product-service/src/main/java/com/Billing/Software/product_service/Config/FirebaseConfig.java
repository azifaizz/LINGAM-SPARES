package com.Billing.Software.product_service.Config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.storage.Bucket;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.cloud.FirestoreClient;
import com.google.firebase.cloud.StorageClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

@Configuration
public class FirebaseConfig {

    // Scopes required by the Firebase Admin SDK (Firestore + Storage + identity).
    private static final List<String> FIREBASE_SCOPES = List.of(
            "https://www.googleapis.com/auth/datastore",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/devstorage.read_write",
            "https://www.googleapis.com/auth/cloud-platform");

    @Value("${firebase.bucket}")
    private String bucketName;

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
        InputStream keyFile = getClass().getClassLoader().getResourceAsStream("serviceAccountKey.json");
        GoogleCredentials credentials;

        if (keyFile != null) {
            credentials = GoogleCredentials.fromStream(keyFile);
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
    public Firestore firestore() throws IOException {
        initializeFirebase();
        return FirestoreClient.getFirestore();
    }

    @Bean
    public Bucket bucket() throws IOException {
        initializeFirebase();
        return StorageClient.getInstance().bucket(bucketName);
    }

    private void initializeFirebase() throws IOException {
        if (FirebaseApp.getApps().isEmpty()) {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(resolveCredentials())
                    .setStorageBucket(bucketName)
                    .setProjectId("real-estateoo1")
                    .build();

            FirebaseApp.initializeApp(options);
        }
    }
}
