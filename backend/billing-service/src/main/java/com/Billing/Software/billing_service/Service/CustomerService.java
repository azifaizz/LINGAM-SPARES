package com.Billing.Software.billing_service.Service;

import com.Billing.Software.billing_service.Entity.Customer;
import com.google.cloud.firestore.Firestore;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
@RequiredArgsConstructor
public class CustomerService {

    private final Firestore firestore;
    private static final String COLLECTION = "customers";

    public void ensureCustomerExists(String name, long phone, String email) throws Exception {
        String phoneId = String.valueOf(phone);
        var docRef = firestore.collection(COLLECTION).document(phoneId);
        var snap = docRef.get().get();

        if (!snap.exists()) {
            Customer c = new Customer();
            c.setPhone(phoneId);
            c.setName(name);
            c.setEmail(email);
            c.setCreatedAt(new Date());
            c.setVisitCount(1);
            docRef.set(c).get();
        } else {
            docRef.update("visitCount", snap.getLong("visitCount") + 1, "lastVisit", new Date());
        }
    }

    @CacheEvict(value = "billing_customers", allEntries = true)
    public String addCustomer(Customer customer) throws Exception {
        customer.setCreatedAt(new Date());
        firestore.collection(COLLECTION).document(customer.getPhone()).set(customer).get();
        return customer.getPhone();
    }

    @Cacheable("billing_customers")
    public List<Customer> getAllCustomers() throws Exception {
        return firestore.collection(COLLECTION).get().get().toObjects(Customer.class);
    }

    @CacheEvict(value = "billing_customers", allEntries = true)
    public void updateCustomer(String phone, Map<String, Object> updates) throws Exception {
        firestore.collection(COLLECTION).document(phone).update(updates).get();
    }

    @CacheEvict(value = "billing_customers", allEntries = true)
    public void deleteCustomer(String phone) throws Exception {
        firestore.collection(COLLECTION).document(phone).delete().get();
    }
}