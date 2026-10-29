package com.Billing.Software.vendor_service.Service;

import com.Billing.Software.vendor_service.Entity.PaymentHistoryEntry;
import com.Billing.Software.vendor_service.Entity.PurchaseReturn;
import com.Billing.Software.vendor_service.Entity.Vendor;
import com.Billing.Software.vendor_service.Entity.VendorTransaction;
import com.google.cloud.firestore.*;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VendorService {

    private final Firestore firestore;
    private static final String COL_VENDORS = "vendors";
    private static final String COL_TX = "vendor_transactions";
    private static final String COL_COUNTERS = "_counters";
    private static final String COL_PURCHASE_RETURNS = "purchase_returns";

    // =========================================================================
    // PRIVATE SEQUENCE HELPER
    // =========================================================================

    public void syncProductDetailsInTransactions(String productId, double newRate, double newGst, int newStock)
            throws Exception {
        // Indexed query using productIds array field.
        // All new transactions populate productIds (line 164), so this covers all current docs.
        List<QueryDocumentSnapshot> docs = firestore.collection(COL_TX)
                .whereArrayContains("productIds", productId)
                .get().get().getDocuments();

        for (DocumentSnapshot doc : docs) {
            VendorTransaction tx = doc.toObject(VendorTransaction.class);
            if (tx == null || tx.getProducts() == null)
                continue;

            boolean isModified = false;
            for (com.Billing.Software.vendor_service.Dtos.Product p : tx.getProducts()) {
                if (p == null || p.getId() == null)
                    continue;

                // Debugging print to see what IDs are actually being compared
                System.out.println("Comparing Transaction Product ID: " + p.getId() + " with Target ID: " + productId);

                if (p.getId().equals(productId)) {
                    p.setPurchaseRate(newRate);
                    p.setPurchaseGst(newGst);
                    p.setStockQuantity(newStock);
                    isModified = true;
                }
            }

            if (isModified) {
                double newTotal = tx.getProducts().stream()
                        .mapToDouble(p -> (p.getPurchaseRate() + p.getPurchaseGst()) * p.getStockQuantity())
                        .sum();

                tx.setAmount(newTotal);
                tx.setBalance(newTotal - tx.getPaidAmount());
                tx.setStatus(tx.getBalance() <= 0 ? "PAID" : (tx.getPaidAmount() > 0 ? "PARTIAL" : "PENDING"));

                firestore.collection(COL_TX).document(tx.getId()).set(tx).get();
                System.out.println("Transaction " + tx.getId() + " updated successfully.");
            }
        }
    }

    private String generateSequenceId(String counterDocId, String prefix, int digits) throws Exception {
        DocumentReference counterRef = firestore.collection(COL_COUNTERS).document(counterDocId);

        return firestore.runTransaction(transaction -> {
            DocumentSnapshot snapshot = transaction.get(counterRef).get();
            long currentNum = snapshot.exists() ? snapshot.getLong("current") : 0;
            long nextNum = currentNum + 1;

            transaction.set(counterRef, Map.of("current", nextNum));
            return prefix + String.format("%0" + digits + "d", nextNum);
        }).get();
    }

    // =========================================================================
    // VENDOR CRUD OPERATIONS
    // =========================================================================

    @CacheEvict(value = "vendors", allEntries = true)
    public String addVendor(Vendor vendor) throws Exception {
        String sequenceId = generateSequenceId("vendor_count", "V-", 3);
        vendor.setId(sequenceId);
        firestore.collection(COL_VENDORS).document(sequenceId).set(vendor).get();
        return sequenceId;
    }

    @Cacheable(value = "vendors", key = "#id")
    public Vendor getVendorById(String id) throws Exception {
        DocumentSnapshot doc = firestore.collection(COL_VENDORS).document(id).get().get();
        if (!doc.exists())
            throw new NoSuchElementException("Vendor not found with ID: " + id);
        return doc.toObject(Vendor.class);
    }

    @Cacheable("vendors")
    public List<Vendor> getAllVendors() throws Exception {
        return firestore.collection(COL_VENDORS).get().get().getDocuments()
                .stream().map(d -> d.toObject(Vendor.class)).collect(Collectors.toList());
    }

    @CacheEvict(value = "vendors", allEntries = true)
    public Vendor updateVendor(String id, Map<String, Object> updates) throws Exception {
        DocumentReference docRef = firestore.collection(COL_VENDORS).document(id);

        // Check if vendor exists
        DocumentSnapshot snapshot = docRef.get().get();
        if (!snapshot.exists()) {
            throw new NoSuchElementException("Vendor not found with ID: " + id);
        }

        // Filter out 'id' from the map if it's present to prevent changing the document
        // ID
        updates.remove("id");

        // Perform the partial update
        docRef.update(updates).get();

        // Return the full updated object
        return docRef.get().get().toObject(Vendor.class);
    }

    @CacheEvict(value = "vendors", allEntries = true)
    public void deleteVendor(String id) throws Exception {
        DocumentReference docRef = firestore.collection(COL_VENDORS).document(id);
        if (!docRef.get().get().exists())
            throw new NoSuchElementException("Vendor not found");
        docRef.delete().get();
    }

    // =========================================================================
    // TRANSACTION & PAYMENT LOGIC
    // =========================================================================

    public String addTransaction(VendorTransaction tx) throws Exception {
        String txId = generateSequenceId("tx_count", "TX-", 5);
        tx.setId(txId);

        // Populate productIds for indexed queries (optimization for syncProductDetailsInTransactions)
        if (tx.getProducts() != null) {
            tx.setProductIds(tx.getProducts().stream()
                    .filter(p -> p != null && p.getId() != null)
                    .map(com.Billing.Software.vendor_service.Dtos.Product::getId)
                    .collect(Collectors.toList()));
        }

        // Logic to calculate total if not provided
        if (tx.getAmount() <= 0 && tx.getProducts() != null) {
            double total = tx.getProducts().stream()
                    .mapToDouble(p -> (p.getPurchaseRate() + p.getPurchaseGst()) * p.getStockQuantity())
                    .sum();
            tx.setAmount(total);
        }

        if (tx.getDate() == null)
            tx.setDate(new Date());

        // Use the 'invoice' field from the object passed by the controller
        tx.setBalance(tx.getAmount() - tx.getPaidAmount());
        tx.setStatus(tx.getBalance() <= 0 ? "PAID" : (tx.getPaidAmount() > 0 ? "PARTIAL" : "PENDING"));

        DocumentReference txRef = firestore.collection(COL_TX).document(txId);
        DocumentReference vendorRef = firestore.collection(COL_VENDORS).document(tx.getVendorId());

        firestore.runTransaction(transaction -> {
            transaction.set(txRef, tx);
            transaction.update(vendorRef, "transactions", FieldValue.arrayUnion(txId));
            return null;
        }).get();

        return txId;
    }

    public void recordPayment(String transactionId, double paymentAmount, String paymentMode, String paymentDescription)
            throws Exception {
        DocumentReference docRef = firestore.collection(COL_TX).document(transactionId);

        firestore.runTransaction(transaction -> {
            DocumentSnapshot snapshot = transaction.get(docRef).get();
            if (!snapshot.exists())
                throw new NoSuchElementException("Transaction not found");

            VendorTransaction tx = snapshot.toObject(VendorTransaction.class);
            if (tx == null)
                throw new IllegalStateException("Transaction data is null");

            double newPaidAmount = tx.getPaidAmount() + paymentAmount;
            double newBalance = tx.getAmount() - newPaidAmount;
            String newStatus = newBalance <= 0.05 ? "PAID" : "PARTIAL"; // Tolerance for float math

            // Create History Entry
            PaymentHistoryEntry historyEntry = PaymentHistoryEntry.builder()
                    .amount(BigDecimal.valueOf(paymentAmount))
                    .paymentMode(paymentMode != null ? paymentMode : "CREDIT")
                    .description(paymentDescription)
                    .paymentDate(new Date())
                    .balanceAfterPayment(BigDecimal.valueOf(newBalance))
                    .statusAfterPayment(newStatus)
                    .build();

            List<PaymentHistoryEntry> history = tx.getPaymentHistory();
            if (history == null) {
                history = new ArrayList<>();
            }
            history.add(historyEntry);

            // Update Entity Fields
            tx.setPaidAmount(newPaidAmount);
            tx.setBalance(newBalance);
            tx.setLastPaymentDate(new Date());
            tx.setStatus(newStatus);
            tx.setPaymentHistory(history);

            if (paymentMode != null && !paymentMode.trim().isEmpty()) {
                tx.setPaymentMode(paymentMode);
            }
            if (paymentDescription != null && !paymentDescription.trim().isEmpty()) {
                tx.setPaymentRemarks(paymentDescription);
            }
            // Ensure description is not lost if it was mapped differently
            // tx.setDescription(paymentDescription); // Don't overwrite original
            // description?
            // The method signature suggests paymentDescription is for the PAYMENT, not the
            // transaction description.
            // VendorTransaction has 'paymentRemarks' field we added.

            // FULL DOCUMENT OVERWRITE to ensure List<POJO> is serialized correctly
            transaction.set(docRef, tx);
            return null;
        }).get();
    }

    // =========================================================================
    // QUERY & REPORTING METHODS
    // =========================================================================

    public List<VendorTransaction> getTransactionsByVendor(String vendorId) throws Exception {
        return firestore.collection(COL_TX)
                .whereEqualTo("vendorId", vendorId)
                .get().get().getDocuments().stream()
                .map(d -> d.toObject(VendorTransaction.class))
                .sorted(Comparator.comparing(VendorTransaction::getDate).reversed())
                .collect(Collectors.toList());
    }

    public List<VendorTransaction> getTransactionsByDateRange(Date startDate, Date endDate) throws Exception {
        // Adjust end date to the very end of the day (23:59:59)
        Calendar c = Calendar.getInstance();
        c.setTime(endDate);
        c.add(Calendar.DATE, 1);
        Date adjustedEndDate = c.getTime();

        return firestore.collection(COL_TX)
                .whereGreaterThanOrEqualTo("date", startDate)
                .whereLessThan("date", adjustedEndDate)
                .orderBy("date", Query.Direction.ASCENDING)
                .get().get().getDocuments().stream()
                .map(d -> d.toObject(VendorTransaction.class))
                .collect(Collectors.toList());
    }

    public void deleteCreditTransaction(String id) throws Exception {
        DocumentReference docRef = firestore.collection(COL_TX).document(id);
        if (!docRef.get().get().exists())
            throw new NoSuchElementException("Transaction not found");
        docRef.delete().get();
    }

    // =========================================================================
    // PURCHASE RETURN LOGIC
    // =========================================================================

    public String processPurchaseReturn(PurchaseReturn purchaseReturn) throws Exception {
        String prId = generateSequenceId("pr_count", "PR-", 5);
        purchaseReturn.setId(prId);
        purchaseReturn.setReturnDate(new Date());
        purchaseReturn.setStatus("COMPLETED");

        DocumentReference txRef = firestore.collection(COL_TX).document(purchaseReturn.getTransactionId());

        firestore.runTransaction(transaction -> {
            DocumentSnapshot snapshot = transaction.get(txRef).get();
            if (!snapshot.exists())
                throw new NoSuchElementException("Transaction not found with ID: " + purchaseReturn.getTransactionId());

            VendorTransaction tx = snapshot.toObject(VendorTransaction.class);

            purchaseReturn.setPreviousAmount(tx.getAmount());
            purchaseReturn.setPreviousBalance(tx.getBalance());

            double newAmount = Math.max(0, tx.getAmount() - purchaseReturn.getTotalReturnAmount());
            double newBalance = Math.max(0, newAmount - tx.getPaidAmount());
            String newStatus = newBalance <= 0 ? "PAID" : (tx.getPaidAmount() > 0 ? "PARTIAL" : "PENDING");

            purchaseReturn.setNewAmount(newAmount);
            purchaseReturn.setNewBalance(newBalance);

            Map<String, Object> txUpdates = new HashMap<>();
            txUpdates.put("amount", newAmount);
            txUpdates.put("balance", newBalance);
            txUpdates.put("status", newStatus);
            transaction.update(txRef, txUpdates);

            DocumentReference prRef = firestore.collection(COL_PURCHASE_RETURNS).document(prId);
            transaction.set(prRef, purchaseReturn);

            return null;
        }).get();

        return prId;
    }

    public List<PurchaseReturn> getPurchaseReturnsByDateRange(Date startDate, Date endDate) throws Exception {
        Calendar c = Calendar.getInstance();
        c.setTime(endDate);
        c.add(Calendar.DATE, 1);
        Date adjustedEndDate = c.getTime();

        return firestore.collection(COL_PURCHASE_RETURNS)
                .whereGreaterThanOrEqualTo("returnDate", startDate)
                .whereLessThan("returnDate", adjustedEndDate)
                .orderBy("returnDate", Query.Direction.ASCENDING)
                .get().get().getDocuments().stream()
                .map(d -> d.toObject(PurchaseReturn.class))
                .collect(Collectors.toList());
    }

    public List<PurchaseReturn> getPurchaseReturnsByTransaction(String transactionId) throws Exception {
        return firestore.collection(COL_PURCHASE_RETURNS)
                .whereEqualTo("transactionId", transactionId)
                .get().get().getDocuments().stream()
                .map(d -> d.toObject(PurchaseReturn.class))
                .collect(Collectors.toList());
    }

}