# Dashboard Chart Period Indicator, Navigation & Dynamic Month Days Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement comprehensive period navigation (Prev/Next/Today & Month/Year dropdown), clear indicators for active Month, Year, and Weeks, dynamic day counts per month (handling 28, 29, 30, and 31 days), and date-scoped aggregation for the "Income vs Expenses" chart and synced "Revenue Distribution" pie chart in `DashboardOverview.tsx`.

**Architecture:** Introduce a dedicated `chartReferenceDate` state in `DashboardOverview.tsx` to anchor the dashboard's time range views (`day`, `week`, `month`, `year`). Add an intuitive, accessible period navigation header above the chart. Refactor `aggregateChartData` to dynamically determine the days in the active month via date-fns (`getDaysInMonth`), prevent cross-month transaction collisions, dynamically calculate month week spans with exact date badges, and format X-axis and tooltips with full contextual dates.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, date-fns, Recharts, Lucide React icons.

**Spec:** The "Income vs Expenses" chart currently lacks indicators for which month or year is being displayed. It also hardcodes 31 days for every month regardless of actual calendar days (causing February, April, June, September, November to erroneously display up to day 31), displays generic week labels without dates ("1st Week" to "5th Week"), and does not allow navigating back/forward across periods.

## Global Constraints
- Target file: `frontend/src/components/dashboard/DashboardOverview.tsx`
- Do not break the printable PDF report container (`#report-container`)
- Preserve existing styling and responsive layout rules
- Keep dependencies restricted to existing packages (`date-fns`, `recharts`, `lucide-react`)
- Dev server must remain functioning on `http://localhost:5173` without TypeScript or lint errors

## Review Focus
1. **February in leap and non-leap years:** Verify February displays 28 days (or 29 in leap years), never 31 days.
2. **30-day months (Apr, Jun, Sep, Nov):** Verify 30-day months stop at 30 and do not display 31.
3. **Cross-month collisions:** Verify transactions from previous months do not merge into the current month's day buckets.
4. **Week labels in month view:** Verify Week 5 only appears if `daysInMonth > 28`, and each week pill displays exact date spans (e.g. `Oct 1 - Oct 7`).
5. **Period navigation limits:** Verify `<` and `>` buttons properly increment/decrement dates without jumping years unexpectedly, and "Today" resets to the current date.

---

### Task 1: Add Period Navigation State & Date Helpers to `DashboardOverview.tsx`

**Files:**
- Modify: `frontend/src/components/dashboard/DashboardOverview.tsx:15-60`

**Interfaces:**
- Consumes: `date-fns` functions (`addMonths`, `subMonths`, `addYears`, `subYears`, `addWeeks`, `subWeeks`, `getDaysInMonth`, `isSameMonth`, `isSameYear`, `startOfMonth`, `endOfMonth`, etc.)
- Produces: `chartReferenceDate: Date`, `setChartReferenceDate: (d: Date) => void`, `periodTitle: string`, `periodSubtitle: string`, `handlePrevPeriod: () => void`, `handleNextPeriod: () => void`, `handleTodayPeriod: () => void`

- [ ] **Step 1: Expand `date-fns` imports in `DashboardOverview.tsx`**
  Add `addMonths`, `subMonths`, `addYears`, `subYears`, `addWeeks`, `subWeeks`, `getDaysInMonth`, `isSameMonth`, `isSameYear`, `getYear`, `getMonth` to the existing `date-fns` import on line 15.
  Add `ChevronLeft` to the `lucide-react` import.

- [ ] **Step 2: Add `chartReferenceDate` state and navigation handlers**
  Define:
  ```typescript
  const [chartReferenceDate, setChartReferenceDate] = useState<Date>(new Date());
  ```
  Implement handlers:
  - `handlePrevPeriod()`: steps back by 1 day, 1 week, 1 month, or 1 year based on `dashboardView`.
  - `handleNextPeriod()`: steps forward by 1 day, 1 week, 1 month, or 1 year based on `dashboardView`.
  - `handleTodayPeriod()`: resets `chartReferenceDate` to `new Date()`.

- [ ] **Step 3: Define memoized display labels (`periodTitle`, `periodBadge`)**
  Compute:
  - For `month`: e.g. `October 2026` with badge `31 Days` (or `February 2026 (28 Days)`)
  - For `year`: e.g. `Year 2026` with badge `12 Months`
  - For `week`: e.g. `Week 43: Oct 19 – Oct 25, 2026`
  - For `day`: e.g. `Thursday, 22 Oct 2026`

- [ ] **Step 4: Verify typecheck and syntax**
  Run: `npm run build` or test in Vite dev server.

---

### Task 2: Refactor `aggregateChartData` for Dynamic Month Days & Scope Accuracy

**Files:**
- Modify: `frontend/src/components/dashboard/DashboardOverview.tsx:94-155`

**Interfaces:**
- Consumes: `chartReferenceDate`, `rawData: any[]`, `view: DashboardPeriod`
- Produces: Clean, accurately scoped chart array with dynamic day lengths and exact date ranges.

- [ ] **Step 1: Fix `month` view dynamic days**
  Replace hardcoded `for (let i = 1; i <= 31; i++)` with:
  ```typescript
  const daysInMonth = getDaysInMonth(chartReferenceDate);
  const targetYear = getYear(chartReferenceDate);
  const targetMonth = getMonth(chartReferenceDate);
  
  // Only map transactions belonging to target year & month
  const dataMap = new Map();
  rawData.forEach((d: any) => {
    const dDate = new Date(d.date);
    if (!isNaN(dDate.getTime()) && getYear(dDate) === targetYear && getMonth(dDate) === targetMonth) {
      dataMap.set(dDate.getDate(), d);
    }
  });

  for (let i = 1; i <= daysInMonth; i++) {
    const dayData = dataMap.get(i);
    fullMonthData.push({
      date: i.toString(),
      fullDate: format(new Date(targetYear, targetMonth, i), 'dd MMM yyyy'),
      income: dayData?.income || 0,
      expense: dayData?.expense || 0
    });
  }
  ```

- [ ] **Step 2: Fix `week` view week breakdown with exact date spans**
  Calculate exact week spans for the month:
  - Week 1: Day 1 - 7
  - Week 2: Day 8 - 14
  - Week 3: Day 15 - 21
  - Week 4: Day 22 - 28
  - Week 5: Day 29 - `daysInMonth` (only include if `daysInMonth > 28`!)
  Label each with clean date spans: e.g. `W1 (1-7 Oct)`, `W2 (8-14 Oct)`, etc.

- [ ] **Step 3: Fix `year` view year filtering**
  Ensure year aggregation filters transactions matching `getYear(chartReferenceDate)`.

- [ ] **Step 4: Sync data fetching with `chartReferenceDate`**
  Update `fetchChartData` so its range bounds adapt when navigating periods, or when calculating from local bills/expenses fallback.

---

### Task 3: Build Sleek Period Navigation & Month/Year Selector UI

**Files:**
- Modify: `frontend/src/components/dashboard/DashboardOverview.tsx:665-715`

**Interfaces:**
- Consumes: `periodTitle`, `periodBadge`, `handlePrevPeriod`, `handleNextPeriod`, `handleTodayPeriod`, `chartReferenceDate`, `dashboardView`
- Produces: Modern, responsive header above the chart with period controls.

- [ ] **Step 1: Add Period Navigation Bar above "Income vs Expenses"**
  Include:
  - `<` (Previous button with tooltip)
  - Current Period Display (e.g., `October 2026`) in bold with badge (e.g., `31 Days`)
  - `>` (Next button with tooltip)
  - "Today" quick return button (visible when `chartReferenceDate` is not the current period)
  - Quick Month / Year dropdown selector so users can jump directly to any month or year without clicking Next multiple times.

- [ ] **Step 2: Enhance Recharts Tooltip for Chart**
  Update `RechartsTooltip` in `BarChart`:
  - Display `payload[0]?.payload?.fullDate || label` as the title (e.g. `22 Oct 2026`)
  - Format income and expenses with `₹` and commas.
  - Display Net Income / Net Profit for that specific day/week.

- [ ] **Step 3: Update "Synced View" PieChart & KPI ranges**
  Ensure the synced pie chart reflects the active `chartReferenceDate` and `dashboardView`.

---

### Task 4: Verification, Edge Case Testing & Build Validation

**Files:**
- Test in Browser: `http://localhost:5173/admin/dashboard`
- Check console logs and build output

- [ ] **Step 1: Test February (28 days non-leap, 29 days leap year 2028)**
  Navigate to February 2026: verify X-axis ends at 28.
  Navigate to February 2028: verify X-axis ends at 29.
  Navigate to April, June, September, November: verify X-axis ends at 30.
  Navigate to October, December: verify X-axis ends at 31.

- [ ] **Step 2: Test Week View Breakdown**
  Switch to `WEEK` view: verify labels show week numbers with exact date ranges (`W1 (1-7 Oct)` to `W5 (29-31 Oct)`). For February 2026, verify `W5` is absent.

- [ ] **Step 3: Test Year View Navigation**
  Switch to `YEAR` view: verify label shows `Year 2026`, with `<` and `>` jumping years.

- [ ] **Step 4: Verify PDF Report Generation**
  Test clicking "Download Report": ensure PDF captures accurately without breaking layout.

- [ ] **Step 5: Run TypeScript & Vite Build Check**
  Verify `npm run build` exits 0 with zero errors.
