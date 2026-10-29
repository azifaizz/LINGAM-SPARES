package com.Billing.Software.billing_service.feign;


import com.Billing.Software.billing_service.dto.ProductDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class ProductClient {

    @org.springframework.beans.factory.annotation.Value("${product.service.url}/api/products")
    private String BASE_URL;

    @Autowired
    private RestTemplate restTemplate;

    public ProductDTO getProductById(String authHeader, String id) {
        String url = BASE_URL + "/get/" + id;
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, authHeader);

        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<ProductDTO> response = restTemplate.exchange(url, HttpMethod.GET, entity, ProductDTO.class);

        return response.getBody();
    }

    public void updateProductStock(String authHeader, String id, double change) {
        String url = BASE_URL + "/" + id + "/stock?change=" + change;
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, authHeader);
        headers.setContentLength(0);

        HttpEntity<Void> entity = new HttpEntity<>(headers);
        restTemplate.exchange(url, HttpMethod.PUT, entity, Void.class);
    }

    public ProductDTO getProductByBarcode(String authHeader, String barcode) {
        String url = BASE_URL + "/barcode/" + barcode;
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, authHeader);

        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<ProductDTO> response = restTemplate.exchange(url, HttpMethod.GET, entity, ProductDTO.class);

        return response.getBody();
    }
}
