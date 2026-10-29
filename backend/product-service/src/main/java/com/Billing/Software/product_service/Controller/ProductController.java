package com.Billing.Software.product_service.Controller;

import com.Billing.Software.product_service.Entity.Category;
import com.Billing.Software.product_service.Entity.Product;
import com.Billing.Software.product_service.Service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpHeaders;

import java.util.*;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ProductController {

    private final ProductService productService;

    @GetMapping("/health")
    public String healthCheck() {
        return "Product Service is active";
    }

    @PostMapping("/add")
    // @PreAuthorize("hasRole('ADMIN')") // Uncomment for security
    public ResponseEntity<?> addProduct(@RequestBody Product product) throws Exception {
        String id = productService.addProduct(product);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("message", "Product added successfully", "id", id));
    }

    @GetMapping("/get/{id}")
    public Product getProduct(@PathVariable String id) throws Exception {
        return productService.getProductById(id);
    }

    @GetMapping("/barcode/{barcode}")
    public Product getProductByBarcode(@PathVariable String barcode) throws Exception {
        return productService.getProductByBarcode(barcode);
    }

    @GetMapping("/all")
    public List<Product> getAllProducts(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String vendorId,
            @RequestParam(required = false) Integer lowStock) throws Exception {

        if (category != null) return productService.getProductsByCategory(category);
        if (vendorId != null) return productService.getProductsByVendor(vendorId);
        if (lowStock != null) return productService.getLowStockProducts(lowStock);

        return productService.getAllProducts();
    }

    @GetMapping("/by-dates")
    public List<Product> getProductsByDateRange(
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") Date startDate,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") Date endDate) throws Exception {
        return productService.getProductsByDateRange(startDate, endDate);
    }

    @PatchMapping("/update/{id}")
    public Product updateProduct(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String auth,
            @PathVariable String id,
            @RequestBody Map<String, Object> updates) throws Exception {

        // Remove 'auth' from the service call.
        // The service fetches the token itself using RequestContextHolder.
        return productService.updateProduct(id, updates);
    }

    @PutMapping("/{id}/stock")
    public ResponseEntity<?> updateStock(
            @PathVariable String id,
            @RequestParam(required = false) Double change,
            @RequestParam(required = false) Double set) throws Exception {

        if (set != null) {
            productService.setStock(id, set);
            return ResponseEntity.ok(Map.of("message", "Stock set to " + set));
        }

        if (change != null) {
            productService.updateStock(id, change, false);
            return ResponseEntity.ok(Map.of("message", "Stock updated by " + change));
        }

        throw new IllegalArgumentException("Either 'change' or 'set' parameter is required");
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> deleteProduct(@PathVariable String id) throws Exception {
        productService.deleteProduct(id);
        return ResponseEntity.ok(Map.of("message", "Product deleted successfully"));
    }

    // --- Category Endpoints ---

    @PostMapping("/categories/add")
    public ResponseEntity<?> addCategory(@RequestBody Category category) throws Exception {
        String id = productService.addCategory(category);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id, "message", "Category added"));
    }

    @GetMapping("/categories")
    public List<Category> getAllCategories() throws Exception {
        return productService.getAllCategories();
    }

    @PatchMapping("/categories/{id}")
    public ResponseEntity<?> updateCategory(@PathVariable String id, @RequestBody Map<String, Object> updates) throws Exception {
        productService.updateCategory(id, updates);
        return ResponseEntity.ok(Map.of("message", "Category updated successfully"));
    }

    @DeleteMapping("/categories/delete/{id}")
    public ResponseEntity<?> deleteCategory(@PathVariable String id) throws Exception {
        productService.deleteCategory(id);
        return ResponseEntity.ok(Map.of("message", "Category deleted"));
    }
}