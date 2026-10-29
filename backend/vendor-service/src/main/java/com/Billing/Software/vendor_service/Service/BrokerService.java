package com.Billing.Software.vendor_service.Service;

import com.Billing.Software.vendor_service.Entity.Commissions;
import com.Billing.Software.vendor_service.Entity.Broker;
import com.google.cloud.firestore.*;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class BrokerService {

    private final Firestore firestore;
    private static final String BROKER_COL = "brokers";
    private static final String COMM_COL = "commissions";
    private static final String COUNTER_COL = "_counters";
    private static final String BROKER_COUNTER_DOC = "brokers";

    public BrokerService(Firestore firestore) {
        this.firestore = firestore;
    }

    private String getNextId() throws ExecutionException, InterruptedException {
        DocumentReference counterRef = firestore.collection(COUNTER_COL).document(BROKER_COUNTER_DOC);
        AtomicReference<String> newIdRef = new AtomicReference<>();
        firestore.runTransaction(t -> {
            DocumentSnapshot snapshot = t.get(counterRef).get();
            long current = snapshot.exists() ? snapshot.getLong("currentNumber") : 0;
            long next = current + 1;
            t.set(counterRef, Map.of("currentNumber", next));
            newIdRef.set(String.format("BRK-%03d", next));
            return null;
        }).get();
        return newIdRef.get();
    }

    @CacheEvict(value = "brokers", allEntries = true)
    public String addBroker(Broker broker) throws Exception {
        String id = getNextId();
        broker.setId(id);
        broker.setCommissions(new ArrayList<>());
        firestore.collection(BROKER_COL).document(id).set(broker).get();
        return id;
    }

    @Cacheable("brokers")
    public List<Broker> getAllBrokers() throws Exception {
        List<Broker> list = new ArrayList<>();
        List<QueryDocumentSnapshot> docs = firestore.collection(BROKER_COL).get().get().getDocuments();
        for (DocumentSnapshot doc : docs) list.add(doc.toObject(Broker.class));
        return list;
    }

    // --- NEW: Update Broker Logic ---
    @CacheEvict(value = "brokers", allEntries = true)
    public void updateBroker(String id, Broker broker) throws Exception {
        broker.setId(id);
        // SetOptions.merge() ensures we don't delete the commissions list if it's missing in the request
        firestore.collection(BROKER_COL).document(id).set(broker, SetOptions.merge()).get();
    }

    // --- NEW: Delete Broker Logic ---
    @CacheEvict(value = "brokers", allEntries = true)
    public void deleteBroker(String id) throws Exception {
        firestore.collection(BROKER_COL).document(id).delete().get();
        // Optional: You might want to delete all commissions associated with this broker too
    }

    public void deleteCommissionsByBillId(String billId) throws Exception {
        List<QueryDocumentSnapshot> docs = firestore.collection(COMM_COL).whereEqualTo("billId", billId).get().get().getDocuments();
        for (QueryDocumentSnapshot doc : docs) {
            doc.getReference().delete().get();
        }
    }

    public String addCommission(Commissions commission) throws Exception {
        String id = UUID.randomUUID().toString();
        commission.setId(id);
        if(commission.getDate() == null) commission.setDate(new Date());
        if(commission.getStatus() == null) commission.setStatus("UNPAID");

        firestore.collection(COMM_COL).document(id).set(commission).get();

        DocumentReference brokerRef = firestore.collection(BROKER_COL).document(commission.getBrokerId());
        if (brokerRef.get().get().exists()) {
            brokerRef.update("commissions", FieldValue.arrayUnion(id));
        }
        return id;
    }

    public void updateCommissionStatus(String id, String status) throws Exception {
        firestore.collection(COMM_COL).document(id).update("status", status).get();
    }

    public List<Commissions> getCommissionsByBroker(String brokerId) throws Exception {
        return firestore.collection(COMM_COL)
                .whereEqualTo("brokerId", brokerId)
                .get().get().toObjects(Commissions.class);
    }

    public List<Commissions> getCommissionsByBill(String billId) throws Exception {
        return firestore.collection(COMM_COL)
                .whereEqualTo("billId", billId)
                .get().get().toObjects(Commissions.class);
    }
}