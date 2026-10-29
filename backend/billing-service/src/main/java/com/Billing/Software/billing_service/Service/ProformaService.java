package com.Billing.Software.billing_service.Service;

import com.Billing.Software.billing_service.Entity.BillDetails;
import com.Billing.Software.billing_service.Entity.Proforma;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Calendar;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProformaService {

    private final Firestore firestore;
    private static final String COL = "proformas";

    private void computeTaxBreakdown(Proforma proforma) {
        if (proforma.getItems() == null || proforma.getItems().isEmpty()) return;

        // Add transport as a product item at the end if transport amount is provided
        if (proforma.getTransportAmount() != null && proforma.getTransportAmount().compareTo(BigDecimal.ZERO) > 0) {
            boolean transportAlreadyAdded = proforma.getItems().stream()
                    .anyMatch(item -> "TRANSPORT_CHARGE".equals(item.getProductId()));
            if (!transportAlreadyAdded) {
                BillDetails transportItem = new BillDetails();
                transportItem.setProductId("TRANSPORT_CHARGE");
                transportItem.setProductName("Transport Charge");
                transportItem.setQuantity(1);
                transportItem.setUnit("");
                BigDecimal tGstRate = proforma.getTransportGstRate() != null ? proforma.getTransportGstRate() : new BigDecimal(18);
                BigDecimal inclusivePrice = proforma.getTransportAmount()
                        .multiply(BigDecimal.ONE.add(tGstRate.divide(new BigDecimal(100), 4, RoundingMode.HALF_UP)))
                        .setScale(2, RoundingMode.HALF_UP);
                transportItem.setUnitPrice(inclusivePrice);
                transportItem.setGstRate(tGstRate);
                transportItem.setDiscountRate(BigDecimal.ZERO);
                transportItem.setHsnsac("");
                transportItem.setPurchaseRate(BigDecimal.ZERO);
                transportItem.setPurchaseGstRate(BigDecimal.ZERO);
                proforma.getItems().add(transportItem);
            }
        }

        String sellerState = proforma.getSellerStateCode() != null ? proforma.getSellerStateCode() : "33";
        String buyerState = proforma.getBuyerStateCode() != null ? proforma.getBuyerStateCode() : "33";
        boolean isIntraState = sellerState.equals(buyerState);

        BigDecimal accumulatedTaxable = BigDecimal.ZERO;
        BigDecimal accumulatedCGST = BigDecimal.ZERO;
        BigDecimal accumulatedSGST = BigDecimal.ZERO;
        BigDecimal accumulatedIGST = BigDecimal.ZERO;

        for (BillDetails item : proforma.getItems()) {
            BigDecimal qty = new BigDecimal(item.getQuantity());
            BigDecimal unitPrice = item.getUnitPrice() != null ? item.getUnitPrice() : BigDecimal.ZERO;
            BigDecimal gstRate = item.getGstRate() != null ? item.getGstRate() : BigDecimal.ZERO;

            BigDecimal lineTotal = unitPrice.multiply(qty).setScale(2, RoundingMode.HALF_UP);
            item.setNetAmount(lineTotal);

            BigDecimal gstFactor = BigDecimal.ONE.add(gstRate.divide(new BigDecimal(100), 4, RoundingMode.HALF_UP));
            BigDecimal taxableValue = lineTotal.divide(gstFactor, 2, RoundingMode.HALF_UP);
            item.setTaxableValue(taxableValue);

            accumulatedTaxable = accumulatedTaxable.add(taxableValue);

            BigDecimal gstAmount = lineTotal.subtract(taxableValue);
            item.setGstAmount(gstAmount);

            if (isIntraState) {
                BigDecimal cgstAmount = gstAmount.divide(new BigDecimal(2), 2, RoundingMode.HALF_UP);
                BigDecimal sgstAmount = gstAmount.subtract(cgstAmount);

                item.setCgstAmount(cgstAmount);
                item.setSgstAmount(sgstAmount);
                item.setIgstAmount(BigDecimal.ZERO);

                BigDecimal halfRate = gstRate.divide(new BigDecimal(2), 2, RoundingMode.HALF_UP);
                item.setCgstPercent(halfRate);
                item.setSgstPercent(halfRate);
                item.setIgstPercent(BigDecimal.ZERO);

                accumulatedCGST = accumulatedCGST.add(cgstAmount);
                accumulatedSGST = accumulatedSGST.add(sgstAmount);
            } else {
                item.setCgstAmount(BigDecimal.ZERO);
                item.setSgstAmount(BigDecimal.ZERO);
                item.setIgstAmount(gstAmount);

                item.setCgstPercent(BigDecimal.ZERO);
                item.setSgstPercent(BigDecimal.ZERO);
                item.setIgstPercent(gstRate);

                accumulatedIGST = accumulatedIGST.add(gstAmount);
            }
        }

        proforma.setTotalTaxable(accumulatedTaxable.setScale(2, RoundingMode.HALF_UP));
        proforma.setTotalCGST(accumulatedCGST.setScale(2, RoundingMode.HALF_UP));
        proforma.setTotalSGST(accumulatedSGST.setScale(2, RoundingMode.HALF_UP));
        proforma.setTotalIGST(accumulatedIGST.setScale(2, RoundingMode.HALF_UP));
        proforma.setTotalGstAmount(
                accumulatedCGST.add(accumulatedSGST).add(accumulatedIGST).setScale(2, RoundingMode.HALF_UP));

        BigDecimal grandTotalRaw = accumulatedTaxable.add(proforma.getTotalGstAmount());
        BigDecimal grandTotalRounded = grandTotalRaw.setScale(0, RoundingMode.HALF_UP).setScale(2);

        proforma.setFinalAmount(grandTotalRounded);
        proforma.setRoundOffAmount(grandTotalRounded.subtract(grandTotalRaw).setScale(2, RoundingMode.HALF_UP));

        proforma.setSellerStateCode(sellerState);
        proforma.setBuyerStateCode(buyerState);
    }

    @CacheEvict(value = "proformas", allEntries = true)
    public Proforma createProforma(Proforma proforma) throws Exception {
        proforma.setId(UUID.randomUUID().toString());
        proforma.setProformaId(generateProformaId());
        proforma.setCreatedAt(new Date());

        computeTaxBreakdown(proforma);

        firestore.collection(COL).document(proforma.getProformaId()).set(proforma).get();
        return proforma;
    }

    public Proforma getProforma(String proformaId) throws Exception {
        DocumentSnapshot snap = firestore.collection(COL).document(proformaId.toUpperCase()).get().get();
        if (snap.exists()) {
            return snap.toObject(Proforma.class);
        }
        return null;
    }

    @Cacheable("proformas")
    public List<Proforma> getAllProformas() throws Exception {
        return firestore.collection(COL).get().get().toObjects(Proforma.class);
    }

    @CacheEvict(value = "proformas", allEntries = true)
    public Proforma updateProforma(String proformaId, Proforma proforma) throws Exception {
        proforma.setProformaId(proformaId);

        computeTaxBreakdown(proforma);

        firestore.collection(COL).document(proformaId.toUpperCase()).set(proforma).get();
        return proforma;
    }

    @CacheEvict(value = "proformas", allEntries = true)
    public void deleteProforma(String proformaId) throws Exception {
        firestore.collection(COL).document(proformaId.toUpperCase()).delete().get();
    }

    private String generateProformaId() throws Exception {
        DocumentReference ref = firestore.collection("_counters").document("proformas");
        return firestore.runTransaction(t -> {
            DocumentSnapshot snap = t.get(ref).get();
            long next = (snap.exists() && snap.getLong("current") != null) ? snap.getLong("current") : 0;
            next++;
            t.set(ref, Map.of("current", next));
            return String.format("%03d", next);
        }).get();
    }
}
