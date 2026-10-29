package com.Billing.Software.billing_service.Service;

import com.Billing.Software.billing_service.Entity.Notification;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.WriteBatch;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final Firestore firestore;
    private static final String COL = "notifications";

    @CacheEvict(value = "notifications", allEntries = true)
    public String createNotification(Notification notification) throws ExecutionException, InterruptedException {
        if (notification.getId() == null) {
            notification.setId(UUID.randomUUID().toString());
        }
        notification.setCreatedAt(new Date());
        notification.setRead(false);
        firestore.collection(COL).document(notification.getId()).set(notification).get();
        return notification.getId();
    }

    @Cacheable(value = "notifications", key = "'unread_' + #role")
    public List<Notification> getUnreadNotifications(String role) throws ExecutionException, InterruptedException {
        return firestore.collection(COL)
                .whereEqualTo("read", false)
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .limit(20)
                .get().get().toObjects(Notification.class);
    }

    @CacheEvict(value = "notifications", allEntries = true)
    public void markAsRead(String id) throws ExecutionException, InterruptedException {
        firestore.collection(COL).document(id).update("read", true).get();
    }

    @CacheEvict(value = "notifications", allEntries = true)
    public void markAllAsRead() throws ExecutionException, InterruptedException {
        List<QueryDocumentSnapshot> docs = firestore.collection(COL)
                .whereEqualTo("read", false)
                .get().get().getDocuments();

        WriteBatch batch = firestore.batch();
        for (DocumentSnapshot doc : docs) {
            batch.update(doc.getReference(), "read", true);
        }
        batch.commit().get();
    }

    public void cleanupOldReadNotifications() throws ExecutionException, InterruptedException {
        Date thirtyDaysAgo = new Date(System.currentTimeMillis() - 30L * 24 * 60 * 60 * 1000);
        List<QueryDocumentSnapshot> oldRead = firestore.collection(COL)
                .whereEqualTo("read", true)
                .whereLessThanOrEqualTo("createdAt", thirtyDaysAgo)
                .limit(500)
                .get().get().getDocuments();

        if (!oldRead.isEmpty()) {
            WriteBatch batch = firestore.batch();
            for (DocumentSnapshot doc : oldRead) {
                batch.delete(doc.getReference());
            }
            batch.commit().get();
            System.out.println("Cleaned up " + oldRead.size() + " old notifications");
        }
    }
}
