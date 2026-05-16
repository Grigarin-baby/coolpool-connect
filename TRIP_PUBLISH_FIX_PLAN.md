# Trip Publishing Modal & Time Picker Fixes

## Issues to Fix

### Issue 1: Publish Trip Area Not Visible / Form Organization

**Current state:** Form is shown on the right side of the page. Published trips are shown separately on the left.

**User requirement:** Show published trips in a modal with the publish form appearing on button click within that modal.

**What I'll do:**

- Create a new modal component that shows the list of published trips
- Add a "Publish New Trip" button inside the modal
- When clicked, the form appears as a sub-view within the modal (or form expands/toggles)
- Published trips should display with edit/cancel actions in the modal
- The "Quick Access" dashboard and other modules remain on the main page

**UI Flow:**

```
Dashboard → Click "Trips" tab/button → Opens Modal with:
  ├── List of published trips (with Edit/Cancel buttons)
  └── "Publish New Trip" button → Shows form below/inside modal
```

---

### Issue 2: DatePicker Not Responsive on Mobile

**Current state:** DatePicker at line 1498-1511 has `placement="bottomLeft"` but no responsive mobile styling.

**What I'll do:**

- Add a CSS class `popupClassName="trip-publish-datepicker"` to the DatePicker
- Add mobile-specific CSS to `src/styles.css` similar to what was done for driver dashboard:
  ```css
  @media (max-width: 640px) {
    .trip-publish-datepicker .ant-picker-dropdown {
      left: 0.75rem !important;
      right: 0.75rem !important;
      width: auto !important;
    }
    .trip-publish-datepicker .ant-picker-panel-container {
      max-width: calc(100vw - 1.5rem) !important;
      overflow-x: auto !important;
    }
  }
  ```

---

### Issue 3: Time Selection Should Not Allow Past Times

**Current state:** The `disabledDate` function (lines 1505-1510) only restricts dates, but allows any time to be selected, even times in the past if selecting today.

**What I'll do:**

- Keep `disabledDate` as is (prevents dates before today or after tomorrow)
- Add `disabledHours` function that:
  - Returns all hours before current hour (if today is selected)
  - Returns empty array if tomorrow or later is selected
- Add `disabledMinutes` function that:
  - If the hour matches current hour and today is selected, disable minutes before current minute
  - Otherwise allow all minutes

**Logic:**

```
If selected date is TODAY:
  - Disable hours: 0 to (current_hour - 1)
  - If selected hour is current_hour: disable minutes 0 to (current_minute - 1)
Else (selected date is TOMORROW):
  - Allow all hours and minutes
```

**Example:**

- Creating trip at 1:30 PM on May 17
- May 17: Can only select 1:45 PM or later (not 1:30 PM, 1:15 PM, 12:00 PM, etc.)
- May 18: Can select any time (12:00 AM onwards)

---

## Files to Modify

1. **src/routes/driver/dashboard.tsx**
   - Extract published trips section into a Modal component
   - Reorganize the form layout to fit inside the modal
   - Update state management for modal visibility
   - Add `disabledHours` and `disabledMinutes` logic to DatePicker
   - Add `popupClassName="trip-publish-datepicker"` to DatePicker

2. **src/styles.css**
   - Add `.trip-publish-datepicker` responsive CSS rules for mobile

---

## Questions for You

1. **Modal behavior:** Should the published trips modal be always open, or only when user clicks a button? Should there be a close button?

2. **Form placement in modal:** Should the form be:
   - Below the trips list (scroll if needed)?
   - In a collapsible section?
   - Replace the trips list when "Publish New Trip" is clicked?
   - In a separate step/view?

3. **Time restrictions:** Should the time restriction apply:
   - Only to today's departures?
   - Also to future dates (prevent selecting a time in the past relative to "now")?

4. **Modal size:** Should it be:
   - Full screen/large modal?
   - Medium modal with scrolling?
   - Drawer (slide from side)?

---

## Implementation Order

1. Fix Issue 3 first (add time restrictions to DatePicker)
2. Fix Issue 2 (add responsive CSS for DatePicker)
3. Fix Issue 1 (reorganize into modal) — depends on your answers to the questions above
