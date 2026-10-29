package com.Billing.Software.billing_service.Service;

import com.Billing.Software.billing_service.Entity.Estimation;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Calendar;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EstimationService {

    private final Firestore firestore;
    private static final String COL = "estimations";

    @CacheEvict(value = "estimations", allEntries = true)
    public Estimation createEstimation(Estimation estimation) throws Exception {
        estimation.setId(UUID.randomUUID().toString());
        estimation.setEstimationId(generateEstimationId());
        estimation.setCreatedAt(new Date());

        firestore.collection(COL).document(estimation.getEstimationId()).set(estimation).get();
        return estimation;
    }

    public Estimation getEstimation(String estimationId) throws Exception {
        DocumentSnapshot snap = firestore.collection(COL).document(estimationId.toUpperCase()).get().get();
        if (snap.exists()) {
            return snap.toObject(Estimation.class);
        }
        return null;
    }

    @Cacheable("estimations")
    public List<Estimation> getAllEstimations() throws Exception {
        return firestore.collection(COL).get().get().toObjects(Estimation.class);
    }

    @CacheEvict(value = "estimations", allEntries = true)
    public Estimation updateEstimation(String estimationId, Estimation estimation) throws Exception {
        // Ensure the estimationId matches the document we're updating
        estimation.setEstimationId(estimationId);
        // We don't update createdAt, but we could add an updatedAt if needed.
        // For now, we strictly follow the requirement of non-destructive updates.

        firestore.collection(COL).document(estimationId.toUpperCase()).set(estimation).get();
        return estimation;
    }

    private String generateEstimationId() throws Exception {
        Calendar cal = Calendar.getInstance();
        int year = cal.get(Calendar.YEAR);

        DocumentReference ref = firestore.collection("_counters").document("estimations");
        return firestore.runTransaction(t -> {
            DocumentSnapshot snap = t.get(ref).get();
            long next = (snap.exists() && snap.getLong("current") != null) ? snap.getLong("current") : 0;
            next++;
            t.set(ref, Map.of("current", next));
            return String.format("%03d",next);
        }).get();
    }
}
