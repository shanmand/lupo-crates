# Shuku Equipment Tracking - User Manual
## System Version: Lupo Bakery Pro

Welcome to the **Shuku Equipment Tracking** system. This manual provides a comprehensive guide to managing your logistics, inventory, and financial reconciliation workflows.

---

## 1. Introduction
Shuku is a high-precision equipment tracking platform designed for logistics-heavy businesses like **Lupo Bakery**. It tracks the lifecycle of assets (crates, pallets, etc.) from supplier intake through customer delivery to final settlement.

### Key Concepts:
*   **Batch:** A group of assets received or moved together.
*   **THAAN Slip:** A critical return document required for supplier reconciliation.
*   **Liability:** The accrued rental or replacement cost for equipment currently in your possession.

---

## 2. Getting Started

### 2.1 Login & Authentication
*   **Web Portal:** Access via the main URL. Use your corporate credentials.
*   **Driver Portal:** Access via the "Driver Portal" tab or mobile link. Drivers log in using their **License Number** or **Phone Number**.

### 2.2 Navigation
The sidebar is divided into logical sections:
*   **Overview:** High-level stats and executive reporting.
*   **Logistics & Ops:** Daily movement, trip planning, and driver tasks.
*   **Inventory & Assets:** Stock levels, asset definitions, and losses.
*   **Finance & Claims:** Reconciliation, settlements, and dispute management.
*   **Fleet & Personnel:** Truck readiness, driver shifts, and compliance.
*   **Configuration:** System-wide settings and registries.

---

## 3. Core Workflows

### 3.1 Setup (The Foundation)
Before processing movements, ensure your master data is correct:
1.  **Business Directory:** Register Suppliers and Customers.
2.  **Asset Master:** Define equipment types (e.g., Bread Crate, Plastic Pallet) and their replacement values.
3.  **Location Registry:** Map out your Branches, Customer Sites, and Supplier Depots.
4.  **Personnel Management:** Register Drivers and assign them to Home Branches.

### 3.2 Inventory Intake (Receiving Equipment)
When new equipment arrives from a supplier:
1.  Navigate to **Inventory Intake**.
2.  Select the **Supplier** and **Asset Type**.
3.  Enter the **Quantity** and **Date Received**.
4.  The system generates a unique **Batch ID** for tracking.

### 3.3 Logistics & Trip Planning
To move equipment between locations:
1.  **Trip Planning:** Schedule a trip, assign a **Truck** and **Driver**, and set the **Scheduled Date**.
2.  **Logistics Ops:** Execute the movement. Record the **From** and **To** locations.
3.  **Driver Shifts:** Ensure drivers are clocked into their shifts for accurate audit trails.

### 3.4 Driver Mobile Workflow
Drivers use the **Driver Portal** for:
1.  **Daily Inspection:** A mandatory pre-trip safety checklist (Tyres, Brakes, Lights).
2.  **Odometer Tracking:** Submitting odometer readings with photo evidence.
3.  **Task Management:** Viewing and completing assigned pickup/delivery tasks.
4.  **License Renewal:** Uploading new license photos directly to the system.

---

## 4. Financial Reconciliation

### 4.1 Supplier Liability
The system automatically calculates liability based on:
*   **Rental Accruals:** Daily fees for equipment held past the grace period.
*   **Losses:** Replacement fees for equipment marked as "Lost" or "Scrapped".
*   **Penalties:** Fees for returning equipment without a valid THAAN slip.

### 4.2 Payment Settlement
1.  Navigate to **Payment Settlement**.
2.  Select a **Supplier** and **Date Range**.
3.  Review the calculated liabilities (Rental, Loss, Penalty, Credit).
4.  Enter the **Cash Paid** and **Payment Reference**.
5.  Click **Finalize Settlement** to mark batches as settled and update the financial ledger.

---

## 5. Compliance & Maintenance

### 5.1 Fleet Readiness
Monitor the **Fleet Readiness** dashboard for:
*   **License Disc Expiry:** Color-coded alerts (Red = Expired, Amber = Critical).
*   **Roadworthy (COF):** Tracking history and upcoming expiry dates.
*   **Grounded Vehicles:** Trucks that failed safety inspections are automatically flagged.

### 5.2 Stock Take Recon
Perform periodic audits:
1.  Select a **Location**.
2.  Enter the **Physical Count** for each asset.
3.  The system calculates the **Variance** against the system quantity.
4.  Submit to adjust inventory and trigger loss investigations if necessary.

---

## 6. Reporting & Analytics

### 6.1 Executive Dashboard
Real-time visibility into:
*   **Total Units:** Global asset count.
*   **Stagnant Units:** Equipment that hasn't moved in >14 days.
*   **Financial Drainage:** Accrued liability for stagnant equipment.

### 6.2 Audit Trails
*   **Batch Forensic:** Trace the entire history of a single batch ID.
*   **Trip Audit Trail:** Review every movement, including driver and truck details, with GPS verification.

---

## 7. Role-Based Access Control (RBAC)
The system enforces strict security levels to ensure data integrity:

| Role | Permissions |
| :--- | :--- |
| **System Admin** | Full access. Can manage users, edit data schema, and perform database cleanups. |
| **Executive** | Read-only access to all reports and dashboards. Cannot perform operational movements. |
| **Manager** | Branch-level access. Can plan trips, manage inventory, and finalize settlements for their branch. |
| **Staff** | Operational access. Can record movements, intake inventory, and record losses. |
| **Driver** | Mobile-only access. Limited to inspections, task updates, and license uploads. |

---

## 8. Common Scenarios (Step-by-Step)

### Scenario 1: Receiving a new batch of crates
1.  Go to **Inventory Intake**.
2.  Select **Supplier** (e.g., "CrateCo South Africa").
3.  Select **Asset** (e.g., "Standard Bread Crate").
4.  Enter **Quantity** (e.g., 500).
5.  Click **Register Intake**. A new Batch ID is created.

### Scenario 2: Dispatching a truck for delivery
1.  Go to **Trip Planning**.
2.  Create a new Trip. Assign a **Truck** and **Driver**.
3.  Go to **Logistics Ops**.
4.  Select the **Batch ID** from Scenario 1.
5.  Set **From** (e.g., "Kya Sands Warehouse") and **To** (e.g., "Durban Branch").
6.  Click **Execute Movement**. The batch is now "In Transit".

### Scenario 3: Handling a lost crate
1.  Go to **Record a Loss**.
2.  Search for the **Batch ID**.
3.  Enter the **Lost Quantity** (e.g., 5).
4.  Select **Loss Type** (e.g., "Theft" or "Damage").
5.  Upload a photo if available and **Submit**. The system reduces the batch quantity and records a liability.

### Scenario 4: Monthly supplier settlement
1.  Go to **Payment Settlement**.
2.  Select the **Supplier**.
3.  Review the **Liability Table**. Check for any "Penalties" (missing THAAN slips).
4.  If a penalty is unfair, go to **Claims Centre** to dispute it.
5.  Once reconciled, enter the **Payment Reference** and click **Finalize Settlement**.

---

## 9. Troubleshooting & Support
*   **Permission Denied:** Contact your System Administrator to verify your Role (Admin, Manager, or Driver).
*   **Missing THAAN:** If a return was made without a slip, a **Penalty** will be applied during settlement unless a **Claim** is filed and accepted.
*   **Offline Errors:** Ensure your internet connection is stable. The system uses real-time syncing with the cloud database.

---
**Shuku Support Team**
*Empowering Logistics with Precision.*
