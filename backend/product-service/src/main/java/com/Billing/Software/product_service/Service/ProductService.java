package com.Billing.Software.product_service.Service;

import com.Billing.Software.product_service.Entity.Category;
import com.Billing.Software.product_service.Entity.Product;
import com.Billing.Software.product_service.Utils.BarcodeService;
import com.google.cloud.firestore.*;
import com.Billing.Software.product_service.feign.VendorClient;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.concurrent.CompletableFuture;// Import
import com.google.cloud.storage.Bucket;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final Firestore firestore;
    private final Bucket bucket;
    private final BarcodeService barcodeService;
    private final VendorClient vendorClient;

    private static final String COL_PRODUCTS = "products";
    private static final String COL_CATEGORY = "category";
    private static final String COL_COUNTERS = "_counters";

    @Value("${firebase.bucket}")
    private String bucketName;

    // --- Create Operations ---

    @CacheEvict(value = "products", allEntries = true)
    public String addProduct(Product product) throws Exception {
        String fullStamp = Instant.now().toString();
        if (product.getCreatedAt() == null)
            product.setCreatedAt(fullStamp);
        product.setUpdatedAt(fullStamp);

        // --- AUTHORITATIVE BUSINESS DATE ---
        if (product.getPurchaseDate() == null || product.getPurchaseDate().isBlank())
            product.setPurchaseDate(java.time.LocalDate.now().toString()); // yyyy-MM-dd

        // If user provides a barcode, use it; otherwise, generate a sequential one
        String finalId = (product.getBarcode() != null && !product.getBarcode().isBlank())
                ? product.getBarcode().trim()
                : getNextSequentialId();

        if (firestore.collection(COL_PRODUCTS).document(finalId).get().get().exists()) {
            throw new IllegalArgumentException("Barcode/ID already exists: " + finalId);
        }

        product.setId(finalId);
        product.setBarcode(finalId);
        product.setBarcodeImageUrl(barcodeService.generateAndUploadBarcode(finalId, bucket, bucketName));

        if (product.getMrp() == 0)
            product.setMrp(product.getSellingPrice());

        // --- STEP 3 & 4: EXPLICIT MAPPING & MIRRORING ---
        // Ensure taxCode persists and mirrors to hsnsac for backward compatibility
        if (product.getTaxCode() != null && !product.getTaxCode().isBlank()) {
            product.setHsnsac(product.getTaxCode());
        } else if (product.getHsnsac() != null && !product.getHsnsac().isBlank()) {
            product.setTaxCode(product.getHsnsac());
        }

        // STEP 7: VERIFY PERSISTENCE LOG
        System.out.println("[PERSISTENCE LOG] Saving Product: barcode=" + product.getBarcode() +
                ", taxCode=" + product.getTaxCode() +
                ", colourCode=" + product.getColourCode() +
                ", hsnsac=" + product.getHsnsac());

        firestore.collection(COL_PRODUCTS).document(finalId).set(product).get();
        return finalId;
    }

    @CacheEvict(value = "categories", allEntries = true)
    public String addCategory(Category category) throws Exception {
        DocumentReference docRef = firestore.collection(COL_CATEGORY).document();
        category.setId(docRef.getId());
        docRef.set(category).get();
        return category.getId();
    }

    // --- Read Operations ---

    @Cacheable(value = "products", key = "#id")
    public Product getProductById(String id) throws Exception {
        DocumentSnapshot doc = firestore.collection(COL_PRODUCTS).document(id).get().get();
        if (!doc.exists())
            throw new NoSuchElementException("Product not found: " + id);

        Product p = doc.toObject(Product.class);
        if (p != null)
            p.setId(doc.getId());
        return p;
    }

    @Cacheable(value = "products", key = "'barcode_' + #barcode")
    public Product getProductByBarcode(String barcode) throws Exception {
        List<QueryDocumentSnapshot> docs = firestore.collection(COL_PRODUCTS)
                .whereEqualTo("barcode", barcode).get().get().getDocuments();
        if (docs.isEmpty())
            throw new NoSuchElementException("Barcode not found: " + barcode);

        Product p = docs.get(0).toObject(Product.class);
        if (p != null)
            p.setId(docs.get(0).getId());
        return p;
    }

    @Cacheable("products")
    public List<Product> getAllProducts() throws Exception {
        return getListFromQuery(firestore.collection(COL_PRODUCTS));
    }

    @Cacheable("categories")
    public List<Category> getAllCategories() throws Exception {
        return firestore.collection(COL_CATEGORY).get().get().getDocuments().stream()
                .map(d -> d.toObject(Category.class)).collect(Collectors.toList());
    }

    public List<Product> getProductsByCategory(String category) throws Exception {
        return getListFromQuery(firestore.collection(COL_PRODUCTS).whereEqualTo("category", category));
    }

    public List<Product> getProductsByVendor(String vendorId) throws Exception {
        return getListFromQuery(firestore.collection(COL_PRODUCTS).whereEqualTo("vendorId", vendorId));
    }

    public List<Product> getLowStockProducts(int limit) throws Exception {
        return getListFromQuery(firestore.collection(COL_PRODUCTS).whereLessThanOrEqualTo("stockQuantity", limit));
    }

    public List<Product> getProductsByDateRange(Date start, Date end) throws Exception {
        Calendar cal = Calendar.getInstance();
        cal.setTime(end);
        cal.add(Calendar.DATE, 1);
        
        // Convert Date objects to ISO yyyy-MM-dd strings
        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd");
        String startStr = sdf.format(start);
        String endStr = sdf.format(cal.getTime());

        Query query = firestore.collection(COL_PRODUCTS)
                .whereGreaterThanOrEqualTo("purchaseDate", startStr)
                .whereLessThan("purchaseDate", endStr);
        return getListFromQuery(query);
    }

    // --- Update & Delete ---

    // Inside ProductService.java (product-service)

    @CacheEvict(value = "products", allEntries = true)
    public Product updateProduct(String id, Map<String, Object> updates) throws Exception {
        DocumentReference ref = firestore.collection(COL_PRODUCTS).document(id);
        DocumentSnapshot oldSnap = ref.get().get();

        // Check if product exists
        if (!oldSnap.exists()) {
            throw new NoSuchElementException("Product not found with ID: " + id);
        }

        // Apply the updatedAt timestamp to the updates map
        updates.put("updatedAt", Instant.now().toString());

        // --- STEP 5: MIRRORING IN UPDATE FLOW ---
        // Mirror taxCode to hsnsac if present in updates
        if (updates.containsKey("taxCode") && updates.get("taxCode") != null) {
            updates.put("hsnsac", updates.get("taxCode"));
        } else if (updates.containsKey("hsnsac") && updates.get("hsnsac") != null) {
            updates.put("taxCode", updates.get("hsnsac"));
        }

        // Perform partial update in Firestore
        ref.update(updates).get();

        // Return the full updated product object
        return getProductById(id);
    }

    public void setStock(String id, double value) throws Exception {
        this.updateStock(id, value, true);
    }

    @CacheEvict(value = "categories", allEntries = true)
    public void updateCategory(String id, Map<String, Object> updates) throws Exception {
        DocumentReference ref = firestore.collection(COL_CATEGORY).document(id);
        if (!ref.get().get().exists())
            throw new NoSuchElementException("Category not found");
        ref.update(updates).get();
    }

    @CacheEvict(value = "products", allEntries = true)
    public void updateStock(String id, double value, boolean isSet) throws Exception {
        DocumentReference ref = firestore.collection(COL_PRODUCTS).document(id);
        firestore.runTransaction(transaction -> {
            Product p = transaction.get(ref).get().toObject(Product.class);
            if (p == null)
                throw new NoSuchElementException("Product not found");
            double newStock = isSet ? value : p.getStockQuantity() + value;
            if (newStock < 0) {
                newStock = 0;
            }
            transaction.update(ref, Map.of("stockQuantity", newStock, "updatedAt", Instant.now().toString()));
            return null;
        }).get();
    }

    @CacheEvict(value = "products", allEntries = true)
    public void deleteProduct(String id) throws Exception {
        firestore.collection(COL_PRODUCTS).document(id).delete().get();
    }

    @CacheEvict(value = "categories", allEntries = true)
    public void deleteCategory(String id) throws Exception {
        firestore.collection(COL_CATEGORY).document(id).delete().get();
    }

    // --- Helpers ---

    /**
     * Modified to generate a 6-digit sequence starting from 000000
     */
    private String getNextSequentialId() throws ExecutionException, InterruptedException {
        DocumentReference counterRef = firestore.collection(COL_COUNTERS).document("product_counts");
        return firestore.runTransaction(transaction -> {
            DocumentSnapshot snap = transaction.get(counterRef).get();
            // Start from 0 if doc doesn't exist
            long currentNum = (snap.exists() && snap.getLong("current") != null) ? snap.getLong("current") : 0;

            // Update counter for next time
            transaction.set(counterRef, Map.of("current", currentNum + 1));

            // Format as 6 digits (e.g., 000000, 000001...)
            return String.format("%06d", currentNum);
        }).get();
    }

    private List<Product> getListFromQuery(Query query) throws Exception {
        return query.get().get().getDocuments().stream()
                .map(doc -> {
                    Product p = doc.toObject(Product.class);
                    if (p != null)
                        p.setId(doc.getId());
                    return p;
                }).collect(Collectors.toList());
    }
}