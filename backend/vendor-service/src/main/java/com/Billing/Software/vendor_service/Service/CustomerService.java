package com.Billing.Software.vendor_service.Service;

import com.Billing.Software.vendor_service.Dtos.BillTransactionDTO;
import com.Billing.Software.vendor_service.Dtos.PaymentRequestDTO;
import com.Billing.Software.vendor_service.Entity.Customer;
import com.Billing.Software.vendor_service.Entity.CustomerPurchase;
import com.Billing.Software.vendor_service.Entity.PaymentHistoryEntry;
import com.google.cloud.firestore.*;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.atomic.AtomicReference;

@Service
@RequiredArgsConstructor
public class CustomerService {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "customers";
    private static final String SUB_COL_PURCHASES = "purchases";
    private static final String COUNTER_COLLECTION = "_counters";
    private static final String CUSTOMER_COUNTER_DOC_ID = "customers";
    private static final int SEQ_DIGITS = 5;

    // --- ID GENERATION ---
    private String getNextSequentialId() throws ExecutionException, InterruptedException {
        DocumentReference counterRef = firestore.collection(COUNTER_COLLECTION).document(CUSTOMER_COUNTER_DOC_ID);
        AtomicReference<String> newIdRef = new AtomicReference<>();

        firestore.runTransaction((Transaction.Function<Void>) transaction -> {
            DocumentSnapshot snapshot = transaction.get(counterRef).get();
            long currentNumber = snapshot.exists() ? snapshot.getLong("currentNumber") : 0;
            long nextNumber = currentNumber + 1;
            String formatString = "CUST-%0" + SEQ_DIGITS + "d";
            String newCustomerId = String.format(formatString, nextNumber);
            transaction.set(counterRef, Map.of("currentNumber", nextNumber));
            newIdRef.set(newCustomerId);
            return null;
        }).get();

        return newIdRef.get();
    }

    // --- CRUD OPERATIONS ---
    @CacheEvict(value = "customers", allEntries = true)
    public String addCustomer(Customer customer) throws Exception {
        // 1. Normalize Phone Number (Remove spaces, +91, leading 0s for consistent
        // check)
        String rawPhone = customer.getPhone();
        if (rawPhone != null) {
            String cleanPhone = rawPhone.replaceAll("[^0-9]", ""); // Keep digits only
            // Optional: Remove country code if you want standard 10 digit storage
            if (cleanPhone.length() > 10) {
                cleanPhone = cleanPhone.substring(cleanPhone.length() - 10);
            }
            customer.setPhone(cleanPhone);
        }

        // 2. Check for Duplicate by Phone
        Customer existing = getCustomerByPhone(customer.getPhone());

        if (existing != null) {
            System.out.println("Customer already exists: " + existing.getId());
            // Optional: Update details if needed (e.g. name update), but we just return ID
            return existing.getId();
        }

        // 3. Create New if not found
        String newCustomerId = getNextSequentialId();
        customer.setId(newCustomerId);
        customer.setCreatedAt(new Date());
        customer.setTotalSpent(BigDecimal.ZERO);
        customer.setVisitCount(0);

        firestore.collection(COLLECTION_NAME).document(newCustomerId).set(customer).get();
        return newCustomerId;
    }

    @Cacheable(value = "customers", key = "#id")
    public Customer getCustomerById(String id) throws Exception {
        DocumentSnapshot doc = firestore.collection(COLLECTION_NAME).document(id).get().get();
        if (doc.exists()) {
            return doc.toObject(Customer.class);
        }
        throw new NoSuchElementException("Customer not found with ID: " + id);
    }

    @Cacheable(value = "customers", key = "'phone_' + #phone")
    public Customer getCustomerByPhone(String phone) throws Exception {
        // Robust Query
        if (phone == null || phone.isEmpty())
            return null;

        QuerySnapshot query = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("phone", phone) // Ensure this matches normalized phone
                .get()
                .get();

        if (!query.isEmpty()) {
            Customer c = query.getDocuments().get(0).toObject(Customer.class);
            c.setId(query.getDocuments().get(0).getId());
            return c;
        }
        return null;
    }

    @Cacheable("customers")
    public List<Customer> getAllCustomers() throws Exception {
        QuerySnapshot query = firestore.collection(COLLECTION_NAME).get().get();
        List<Customer> customers = new ArrayList<>();
        for (QueryDocumentSnapshot doc : query) {
            Customer c = doc.toObject(Customer.class);
            c.setId(doc.getId()); // Populate ID from doc key
            customers.add(c);
        }
        return customers;
    }

    @CacheEvict(value = "customers", allEntries = true)
    public Customer updateCustomer(String id, Customer customer) throws Exception {
        DocumentReference docRef = firestore.collection(COLLECTION_NAME).document(id);
        if (!docRef.get().get().exists())
            throw new NoSuchElementException("Customer not found with ID: " + id);

        Map<String, Object> updates = new HashMap<>();
        if (customer.getName() != null)
            updates.put("name", customer.getName());
        if (customer.getPhone() != null)
            updates.put("phone", customer.getPhone());
        if (customer.getEmail() != null)
            updates.put("email", customer.getEmail());
        if (customer.getAddress() != null)
            updates.put("address", customer.getAddress());
        if (customer.getGstin() != null)
            updates.put("gstin", customer.getGstin());

        docRef.update(updates).get();
        return docRef.get().get().toObject(Customer.class);
    }

    @CacheEvict(value = "customers", allEntries = true)
    public void deleteCustomer(String id) throws Exception {
        firestore.collection(COLLECTION_NAME).document(id).delete().get();
    }

    public void deletePurchaseHistoryByBillId(String billId) throws Exception {
        List<QueryDocumentSnapshot> docs = firestore.collectionGroup(SUB_COL_PURCHASES).whereEqualTo("id", billId).get().get().getDocuments();
        for (QueryDocumentSnapshot doc : docs) {
            doc.getReference().delete().get();
        }
    }

    // --- TRANSACTION HISTORY LOGIC ---
    public void addPurchaseHistory(String idOrPhone, BillTransactionDTO transactionDto) throws Exception {
        String targetCustomerId = idOrPhone;

        // 1. Check if input is ID or Phone
        DocumentSnapshot doc = firestore.collection(COLLECTION_NAME).document(idOrPhone).get().get();

        if (!doc.exists()) {
            // Not an ID, try Phone
            String cleanInput = idOrPhone.replaceAll("[^0-9]", "");
            if (cleanInput.length() > 10)
                cleanInput = cleanInput.substring(cleanInput.length() - 10);

            Customer byPhone = getCustomerByPhone(cleanInput);
            if (byPhone != null) {
                targetCustomerId = byPhone.getId();
            } else {
                throw new NoSuchElementException("Customer not found with ID or Phone: " + idOrPhone);
            }
        }

        // 2. Reference the correct document
        DocumentReference customerRef = firestore.collection(COLLECTION_NAME).document(targetCustomerId);

        // 3. Prepare Purchase Record
        DocumentReference purchaseRef = customerRef.collection(SUB_COL_PURCHASES).document(transactionDto.getBillId());

        BigDecimal totalAmount = transactionDto.getAmount();
        BigDecimal paidAmount = transactionDto.getPaidAmount() != null ? transactionDto.getPaidAmount() : totalAmount;
        BigDecimal balance = totalAmount.subtract(paidAmount);
        String status = balance.compareTo(BigDecimal.ZERO) <= 0 ? "PAID"
                : (paidAmount.compareTo(BigDecimal.ZERO) > 0 ? "PARTIAL" : "PENDING");

        List<PaymentHistoryEntry> history = new ArrayList<>();
        if (paidAmount.compareTo(BigDecimal.ZERO) > 0) {
            history.add(PaymentHistoryEntry.builder()
                    .amount(paidAmount)
                    .paymentMode(transactionDto.getPaymentMethod())
                    .description("Initial Payment")
                    .paymentDate(new Date())
                    .balanceAfterPayment(balance)
                    .statusAfterPayment(status)
                    .build());
        }

        CustomerPurchase purchase = CustomerPurchase.builder()
                .id(transactionDto.getBillId())
                .amount(totalAmount)
                .paidAmount(paidAmount)
                .balance(balance)
                .status(status)
                .date(transactionDto.getDate())
                .paymentMethod(transactionDto.getPaymentMethod())
                .paymentHistory(history)
                .build();

        // 4. Atomic Update
        firestore.runTransaction(t -> {
            t.set(purchaseRef, purchase);
            t.update(customerRef, "visitCount", FieldValue.increment(1));
            t.update(customerRef, "totalSpent", FieldValue.increment(paidAmount.doubleValue()));
            t.update(customerRef, "lastVisit", transactionDto.getDate());
            return null;
        }).get();
    }

    public void recordPayment(String customerId, String billId, PaymentRequestDTO request) throws Exception {
        DocumentReference customerRef = firestore.collection(COLLECTION_NAME).document(customerId);
        DocumentReference purchaseRef = customerRef.collection(SUB_COL_PURCHASES).document(billId);

        firestore.runTransaction(t -> {
            DocumentSnapshot purchaseSnap = t.get(purchaseRef).get();
            if (!purchaseSnap.exists())
                throw new NoSuchElementException("Purchase record not found for bill: " + billId);

            CustomerPurchase purchase = purchaseSnap.toObject(CustomerPurchase.class);
            BigDecimal newPaid = purchase.getPaidAmount().add(request.getAmount());
            BigDecimal newBalance = purchase.getAmount().subtract(newPaid);
            String newStatus = newBalance.compareTo(BigDecimal.ZERO) <= 0 ? "PAID" : "PARTIAL";

            List<PaymentHistoryEntry> history = purchase.getPaymentHistory();
            if (history == null)
                history = new ArrayList<>();
            history.add(PaymentHistoryEntry.builder()
                    .amount(request.getAmount())
                    .paymentMode(request.getPaymentMode())
                    .description(request.getDescription())
                    .paymentDate(request.getDate())
                    .balanceAfterPayment(newBalance)
                    .statusAfterPayment(newStatus)
                    .build());

            t.update(purchaseRef,
                    "paidAmount", newPaid,
                    "balance", newBalance,
                    "status", newStatus,
                    "paymentHistory", history);

            t.update(customerRef, "totalSpent", FieldValue.increment(request.getAmount().doubleValue()));
            t.update(customerRef, "lastVisit", new Date());

            return null;
        }).get();
    }

    public List<CustomerPurchase> getCustomerHistory(String customerId) throws Exception {
        return firestore.collection(COLLECTION_NAME).document(customerId)
                .collection(SUB_COL_PURCHASES)
                .orderBy("date", Query.Direction.DESCENDING)
                .get().get()
                .toObjects(CustomerPurchase.class);
    }
}