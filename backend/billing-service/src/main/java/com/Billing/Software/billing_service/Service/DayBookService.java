package com.Billing.Software.billing_service.Service;

import com.Billing.Software.billing_service.Entity.Bill;
import com.Billing.Software.billing_service.Entity.CashTally;
import com.Billing.Software.billing_service.Entity.DayBookEntry;
import com.google.cloud.firestore.*;
import org.springframework.stereotype.Service;

import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ExecutionException;

@Service
public class DayBookService {

    private final Firestore firestore;
    private static final String ENTRY_COL = "daybook_entries";
    private static final String TALLY_COL = "cash_tally";
    private static final String BILL_COL = "bills";

    // Notes descending for Greedy Algorithm
    private static final int[] NOTES = { 500, 200, 100, 50, 20, 10, 1 };

    public DayBookService(Firestore firestore) {
        this.firestore = firestore;
    }

    // --- 1. Manual Entries ---
    public String addEntry(DayBookEntry entry) throws ExecutionException, InterruptedException {
        String id = UUID.randomUUID().toString();
        entry.setId(id);
        if (entry.getDate() == null)
            entry.setDate(new Date());
        if (entry.getType() == null)
            entry.setType("EXPENSE");
        if (entry.getAmount() < 0)
            entry.setAmount(Math.abs(entry.getAmount()));

        firestore.collection(ENTRY_COL).document(id).set(entry).get();
        return id;
    }

    public void updateEntry(String id, DayBookEntry entry) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(ENTRY_COL).document(id);
        if (!ref.get().get().exists())
            throw new IllegalArgumentException("Entry not found");
        entry.setId(id);
        ref.set(entry, SetOptions.merge()).get();
    }

    public void deleteEntry(String id) throws ExecutionException, InterruptedException {
        firestore.collection(ENTRY_COL).document(id).delete().get();
    }

    public List<DayBookEntry> getEntriesByDate(Date start, Date end) throws ExecutionException, InterruptedException {
        QuerySnapshot query = firestore.collection(ENTRY_COL)
                .whereGreaterThanOrEqualTo("date", start)
                .whereLessThanOrEqualTo("date", end)
                .get().get();
        List<DayBookEntry> entries = new ArrayList<>();
        for (QueryDocumentSnapshot doc : query)
            entries.add(doc.toObject(DayBookEntry.class));
        return entries;
    }

    // --- 2. Sales Summary Logic ---
    public Map<String, Double> getSalesSummary(Date start, Date end) throws ExecutionException, InterruptedException {
        QuerySnapshot query = firestore.collection(BILL_COL)
                .whereGreaterThanOrEqualTo("createdAt", start)
                .whereLessThanOrEqualTo("createdAt", end)
                .get().get();

        double total = 0, cash = 0, upi = 0, card = 0;

        for (QueryDocumentSnapshot doc : query) {
            Bill bill = doc.toObject(Bill.class);
            if ("CANCELLED".equalsIgnoreCase(bill.getStatus()))
                continue;

            double amount = bill.getFinalAmount().doubleValue();
            String method = bill.getPaymentMethod() != null ? bill.getPaymentMethod().toLowerCase() : "cash";

            if (method.contains("split") || method.contains("cash + upi")) {
                // Handle Split Payment
                double bCash = (bill.getCashAmount() != null) ? bill.getCashAmount().doubleValue() : 0;
                double bUpi = (bill.getOnlineAmount() != null) ? bill.getOnlineAmount().doubleValue() : 0;

                // Safety: If both are 0 but it's marked split, default to total in cash for
                // accounting safety
                if (bCash == 0 && bUpi == 0) {
                    cash += amount;
                } else {
                    cash += bCash;
                    upi += bUpi;
                }
            } else if (method.contains("cash")) {
                cash += amount;
            } else if (method.contains("upi") || method.contains("online")) {
                upi += amount;
            } else if (method.contains("card")) {
                card += amount;
            } else {
                cash += amount;
            }
            total += amount;
        }

        Map<String, Double> summary = new HashMap<>();
        summary.put("total", total);
        summary.put("cash", cash);
        summary.put("upi", upi);
        summary.put("card", card);
        return summary;
    }

    // Wrapper for Controller to handle Dates
    public Map<String, Object> getDailySummary(String dateStr) throws Exception {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
        sdf.setTimeZone(TimeZone.getTimeZone("Asia/Kolkata")); // Restore Timezone for IST
        Date date = sdf.parse(dateStr);

        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("Asia/Kolkata"));
        c.setTime(date);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        Date start = c.getTime();

        c.add(Calendar.DATE, 1);
        Date end = c.getTime();

        List<DayBookEntry> manualEntries = getEntriesByDate(start, end);
        Map<String, Double> salesSummary = getSalesSummary(start, end);

        Map<String, Object> response = new HashMap<>();
        response.put("entries", manualEntries);
        response.put("salesSummary", salesSummary);
        return response;
    }

    // --- 3. Cash Tally (Auto-Calc Logic) ---
    public void saveTally(CashTally tally) throws ExecutionException, InterruptedException {
        String id = "TALLY_" + tally.getDate();
        tally.setId(id);
        firestore.collection(TALLY_COL).document(id).set(tally).get();
    }

    public CashTally getTally(String dateStr) throws ExecutionException, InterruptedException {
        String id = "TALLY_" + dateStr;
        DocumentReference docRef = firestore.collection(TALLY_COL).document(id);
        DocumentSnapshot doc = docRef.get().get();

        try {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
            Date currentDate = sdf.parse(dateStr);

            // 1. Get Opening Balance (From Yesterday)
            Calendar calendar = Calendar.getInstance();
            calendar.setTime(currentDate);
            calendar.add(Calendar.DATE, -1);
            String prevId = "TALLY_" + sdf.format(calendar.getTime());
            DocumentSnapshot prevDoc = firestore.collection(TALLY_COL).document(prevId).get().get();

            double openingBal = 0.0;
            if (prevDoc.exists()) {
                CashTally prevTally = prevDoc.toObject(CashTally.class);
                if (prevTally != null)
                    openingBal = prevTally.getTotalCashHand();
            } else if (doc.exists()) {
                // Keep existing opening if today already created
                openingBal = doc.toObject(CashTally.class).getOpeningBalance();
            }

            // 2. Calculate REAL-TIME Cash Stats
            Calendar todayCal = Calendar.getInstance();
            todayCal.setTime(currentDate);
            todayCal.set(Calendar.HOUR_OF_DAY, 0);
            todayCal.set(Calendar.MINUTE, 0);
            todayCal.set(Calendar.SECOND, 0);
            Date start = todayCal.getTime();
            todayCal.add(Calendar.DATE, 1);
            Date end = todayCal.getTime();

            Map<String, Double> sales = getSalesSummary(start, end);
            double cashSales = sales.getOrDefault("cash", 0.0);

            List<DayBookEntry> expenses = getEntriesByDate(start, end);
            double cashExpenses = 0;
            for (DayBookEntry entry : expenses) {
                // Only count Cash Expenses
                if ("EXPENSE".equalsIgnoreCase(entry.getType()) &&
                        (entry.getPaymentMethod() == null || "Cash".equalsIgnoreCase(entry.getPaymentMethod()))) {
                    cashExpenses += entry.getAmount();
                }
                // Add Cash Income (Manual) if any
                if ("INCOME".equalsIgnoreCase(entry.getType()) &&
                        (entry.getPaymentMethod() == null || "Cash".equalsIgnoreCase(entry.getPaymentMethod()))) {
                    cashSales += entry.getAmount();
                }
            }

            // 3. Expected Physical Cash
            double targetCash = openingBal + cashSales - cashExpenses;
            if (targetCash < 0)
                targetCash = 0;

            // 4. Auto-Calculate Denominations
            Map<String, Integer> autoDenominations = calculateDenominations(targetCash);

            // 5. Construct & Save Tally
            CashTally tally = new CashTally();
            tally.setId(id);
            tally.setDate(dateStr);
            tally.setOpeningBalance(openingBal);
            tally.setTotalCashHand(targetCash);

            // KEY CHANGE: Always overwrite denominations with auto-calc unless user
            // explicitly saves differently via POST
            // This ensures "1600 sales" -> "3x500, 1x100" automatically appears.
            tally.setDenominations(autoDenominations);

            docRef.set(tally).get(); // Sync to DB
            return tally;

        } catch (Exception e) {
            return new CashTally(null, dateStr, 0, new HashMap<>(), 0);
        }
    }

    private Map<String, Integer> calculateDenominations(double amount) {
        Map<String, Integer> denominations = new LinkedHashMap<>();
        int remaining = (int) Math.round(amount);
        for (int note : NOTES) {
            if (remaining >= note) {
                int count = remaining / note;
                remaining %= note;
                denominations.put(note == 1 ? "Coin" : String.valueOf(note), count);
            } else {
                denominations.put(note == 1 ? "Coin" : String.valueOf(note), 0);
            }
        }
        return denominations;
    }

    // --- 4. Range Analytics (Fix for 403/404) ---
    public Map<String, Object> getRangeAnalytics(String startDateStr, String endDateStr) {
        try {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
            Date start = sdf.parse(startDateStr);
            Date end = sdf.parse(endDateStr);

            Calendar c = Calendar.getInstance();
            c.setTime(end);
            c.set(Calendar.HOUR_OF_DAY, 23);
            c.set(Calendar.MINUTE, 59);
            c.set(Calendar.SECOND, 59);
            Date endQuery = c.getTime();

            // Fetch
            QuerySnapshot billsQuery = firestore.collection(BILL_COL)
                    .whereGreaterThanOrEqualTo("createdAt", start)
                    .whereLessThanOrEqualTo("createdAt", endQuery)
                    .get().get();

            QuerySnapshot expensesQuery = firestore.collection(ENTRY_COL)
                    .whereGreaterThanOrEqualTo("date", start)
                    .whereLessThanOrEqualTo("date", endQuery)
                    .get().get();

            Map<String, Map<String, Double>> dailyData = new TreeMap<>();
            double totalIncome = 0;
            double totalExpense = 0;

            // Process Bills
            for (QueryDocumentSnapshot doc : billsQuery) {
                Bill bill = doc.toObject(Bill.class);
                if (!"CANCELLED".equalsIgnoreCase(bill.getStatus())) {
                    double amt = bill.getFinalAmount().doubleValue();
                    totalIncome += amt;

                    String day = sdf.format(bill.getCreatedAt());
                    String method = bill.getPaymentMethod() != null ? bill.getPaymentMethod().toLowerCase() : "cash";

                    dailyData.putIfAbsent(day, new HashMap<>());
                    Map<String, Double> dayStats = dailyData.get(day);

                    if (method.contains("split") || method.contains("cash + upi")) {
                        double bCash = (bill.getCashAmount() != null) ? bill.getCashAmount().doubleValue() : 0;
                        double bUpi = (bill.getOnlineAmount() != null) ? bill.getOnlineAmount().doubleValue() : 0;
                        if (bCash == 0 && bUpi == 0) {
                            dayStats.put("cash", dayStats.getOrDefault("cash", 0.0) + amt);
                        } else {
                            dayStats.put("cash", dayStats.getOrDefault("cash", 0.0) + bCash);
                            dayStats.put("upi", dayStats.getOrDefault("upi", 0.0) + bUpi);
                        }
                    } else if (method.contains("cash")) {
                        dayStats.put("cash", dayStats.getOrDefault("cash", 0.0) + amt);
                    } else if (method.contains("upi") || method.contains("online")) {
                        dayStats.put("upi", dayStats.getOrDefault("upi", 0.0) + amt);
                    } else {
                        dayStats.put("card", dayStats.getOrDefault("card", 0.0) + amt);
                    }
                }
            }

            // Process Expenses
            for (QueryDocumentSnapshot doc : expensesQuery) {
                DayBookEntry entry = doc.toObject(DayBookEntry.class);
                if ("EXPENSE".equalsIgnoreCase(entry.getType())) {
                    totalExpense += entry.getAmount();
                    String day = sdf.format(entry.getDate());
                    dailyData.putIfAbsent(day, new HashMap<>());
                    dailyData.get(day).put("expense", dailyData.get(day).getOrDefault("expense", 0.0) + entry.getAmount());
                } else if ("INCOME".equalsIgnoreCase(entry.getType())) {
                    // Manual Income entries logic if required in chart Data
                    // We add it to 'cash' or other based on method, but usually just 'cash' or 'income'
                    // For now, only handle EXPENSE as before to avoid double counting if not expected.
                }
            }

            List<Map<String, Object>> chartData = new ArrayList<>();
            for (Map.Entry<String, Map<String, Double>> entry : dailyData.entrySet()) {
                Map<String, Object> point = new HashMap<>();
                point.put("date", entry.getKey());
                point.put("cash", entry.getValue().getOrDefault("cash", 0.0));
                point.put("upi", entry.getValue().getOrDefault("upi", 0.0));
                point.put("card", entry.getValue().getOrDefault("card", 0.0));
                point.put("expense", entry.getValue().getOrDefault("expense", 0.0));
                point.put("income",
                        point.values().stream().filter(v -> v instanceof Double).mapToDouble(v -> (Double) v).sum()
                                - (Double) point.get("expense"));
                chartData.add(point);
            }

            Map<String, Object> resp = new HashMap<>();
            resp.put("totalIncome", totalIncome);
            resp.put("totalExpense", totalExpense);
            resp.put("chartData", chartData);
            return resp;

        } catch (Exception e) {
            e.printStackTrace();
            return Map.of("error", e.getMessage());
        }
    }
}