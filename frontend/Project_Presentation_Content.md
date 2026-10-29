# Project Presentation Content: Rose Boutique Management System

## Slide 1: Title Slide
- **Project Name:** Rose Boutique / Smart Billing & Inventory System
- **Subtitle:** Comprehensive Business Management Solution
- **Presented By:** [Your Name/Team Name]
- **Association:** In association with Naandi Foundation & PALS (as per template)

---

## Slide 2: Agenda
*(As provided in your image)*
- Business Requirements
- Business Benefits
- Functional Requirements
- Business Workflow
- Use Cases
- Technical Architecture
- Detailed Design
- User Interfaces
- Data Model
- Infrastructure Requirements

---

## Slide 3: Business Requirements
**Current Challenges:**
- Manual tracking of inventory leads to errors and stock mismatches.
- Difficulty in maintaining accurate credit ledgers for multiple suppliers.
- Time-consuming manual billing process.
- Complex staff salary calculations involving attendance, half-days, and commissions.

**Core Needs:**
- **Automated Billing:** Fast, error-free invoicing with GST compliance.
- **Inventory Control:** Real-time stock tracking with barcode support.
- **Financial Tracking:** Automated day-book and supplier credit management.
- **Staff Management:** Digital attendance and automated salary slip generation.

---

## Slide 4: Business Benefits
- **Operational Efficiency:** Reduces billing time by ~40% with barcode scanning and quick-add features.
- **Financial Accuracy:** Eliminates calculation errors in sales, taxes, and commissions.
- **Real-time Insights:** Instant visibility into daily sales, cash tally, and stock levels.
- **Better Vendor Relations:** Transparent credit history and timely payment tracking.
- **Scalability:** Designed to handle growing product lists (CSV uploads) and multiple staff members.

---

## Slide 5: Functional Requirements
**1. Inventory Management:**
- Add/Edit/Delete products.
- Batch upload via CSV.
- Barcode generation & printing.
- Low stock alerts.

**2. POS & Billing:**
- Customer selection & management.
- Multi-product cart with tax/discount calculation.
- Invoice generation & printing (Thermal/A4).
- Returns & Hold bill functionality.

**3. Vendor Management:**
- Supplier database.
- Credit/Debit ledger (Purchase vs. Payment).
- Product-wise purchase history.

**4. Staff & HR:**
- Daily attendance marking.
- Role-based access (Admin vs. Staff).
- Salary calculation (Base + Commission - Deductions).

---

## Slide 6: Business Workflow
**1. Procurement (Inbound):**
`Supplier` → `Purchase Entry` → `Stock Update` → `Credit Ledger Update`
- Admin adds products from a supplier.
- Stock increases.
- Amount owed to supplier increases.

**2. Sales (Outbound):**
`Customer` → `Billing` → `Stock Deduction` → `Sales Record` → `Invoice`
- Cashier scans items.
- Payment received (Cash/UPI).
- Inventory count decreases.
- Sale recorded in Day Book.

**3. Staff Management:**
`Daily Check-in` → `Attendance Log` → `Month-End` → `Salary Slip Generation`

---

## Slide 7: Use Cases
| Actor | Use Case | Description |
| :--- | :--- | :--- |
| **Cashier** | **Create Bill** | Scans items, selects payment mode, prints invoice for customer. |
| **Admin** | **Stock Entry** | Uploads a CSV of 500 new items arriving from a vendor. |
| **Admin** | **Settle Credit** | Checks supplier balance and records a payment of ₹50,000 to "ABC Textiles". |
| **Broker** | **Commission** | System tracks sales linked to a broker to calculate their earnings. |
| **Manager** | **Day End** | Checks "Day Book" to tally cash in drawer vs. system sales. |

---

## Slide 8: Technical Architecture
- **Frontend Layer:** 
    - **Framework:** React.js (TypeScript) for robust, type-safe UI logic.
    - **Styling:** Tailwind CSS for modern, responsive aesthetics.
    - **Build Tool:** Vite for high-performance development.
    - **Platform:** Electron (for desktop executable) / Web Browser.
- **Backend Layer (Microservices):**
    - **Services:** Product Service, Vendor Service, Billing Service, Staff Service.
    - **Environment:** Node.js / Serverless (Cloud Run).
    - **Communication:** RESTful APIs.
- **Database Layer:**
    - **Primary DB:** Firebase Firestore (NoSQL) for real-time data syncing.
    - **Auth:** Firebase Authentication.

---

## Slide 9: Detailed Design
**Key Modules:**
1.  **Dashboard:** Central hub showing widgets for Total Sales, Net Balance, and Quick Actions.
2.  **Smart Components:**
    - *MultiProductFormModal:* Handles complex batch entry of products while simultaneously creating backend credit transactions.
    - *SupplierCreditPanel:* Reusable component for tracking financial history per vendor.
3.  **State Management:**
    - `GlobalDataContext`: Manages app-wide state (Products, Vendors) to reduce API calls and ensure UI consistency.
4.  **Utilities:**
    - Custom hooks (`useConfirm`, `useLocalStorage`) for consistent UX patterns.

---

## Slide 10: User Interfaces
*(Include Screenshots from the application here)*
- **Login Screen:** Secure entry point.
- **Billing Dashboard:** Split-screen design with Product List (left) and Cart/Billing (right).
- **Stock Management:** Data grid with inline editing for fast price updates.
- **Supplier Panel:** List view with "Account Ledger" slide-out panel.
- **Reports:** Graphical representation of sales trends.

---

## Slide 11: Data Model
**1. Product Schema:**
- `id`: Unique Identifier
- `name`: String
- `purchaseRate`: Float
- `sellingPrice`: Float
- `vendorId`: Link to Vendor
- `stockQuantity`: Integer

**2. Transaction Schema:**
- `id`: Credit ID
- `vendorId`: Foreign Key
- `amount`: Total Purchase Value
- `paidAmount`: Amount Paid
- `balance`: Outstanding Due
- `invoice`: Bill Number ref

**3. Bill Schema:**
- `billNo`: Unique Sequence
- `items`: Array of {productId, qty, price}
- `totalAmount`: Final Sum
- `customer`: Object {name, phone}

---

## Slide 12: Infrastructure Requirements
**Hardware:**
- **Workstations:** Standard PC or Laptop (Windows/Mac).
- **Peripherals:** 
    - Barcode Scanner (USB/Bluetooth).
    - Thermal Printer (POS 80mm).
- **Connectivity:** Stable Internet connection (for cloud sync), though designed for low-bandwidth.

**Software Environment:**
- **OS:** Windows 10/11 recommended for the offline build.
- **Dependencies:** Node.js runtime (for development/local server).
