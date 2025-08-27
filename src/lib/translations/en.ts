export const en = {
  // Navigation
  navigation: {
    doctorManagement: "Doctor Management",
    calendarConfig: "Calendar Configuration",
    scheduleGeneration: "Schedule Generation",
    viewSchedule: "View Schedule",
    leaveRequests: "Leave Requests",
    statistics: "Statistics",
    userManagement: "User Management",
    logout: "Logout"
  },

  // Doctor Management
  doctors: {
    title: "Doctor Management",
    addDoctor: "Add Doctor",
    editDoctor: "Edit Doctor",
    fullName: "Full Name",
    alias: "Alias",
    unavailableWeekdays: "Unavailable Weekdays",
    maxGuards7h: "Max 7h Guards",
    maxGuards17h: "Max 17h Guards",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    confirmDelete: "Are you sure you want to delete this doctor?",
    doctorsList: "Doctors List",
    monday: "Monday",
    tuesday: "Tuesday", 
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday"
  },

  // Calendar Configuration
  calendar: {
    title: "Calendar Configuration",
    description: "Configure which days are guard days by selecting dates on the calendar. Selected dates will be marked as guard days.",
    guardDays: "Guard Days",
    selectedDates: "Selected Dates",
    saveConfiguration: "Save Configuration",
    loadingCalendar: "Loading calendar configuration...",
    savingConfiguration: "Saving configuration...",
    configurationSaved: "Calendar configuration saved successfully!"
  },

  // Schedule Generation
  schedule: {
    title: "Schedule Generation",
    description: "Generate guard schedules for a specific month and year.",
    selectMonth: "Select Month",
    selectYear: "Select Year", 
    generateSchedule: "Generate Schedule",
    january: "January",
    february: "February",
    march: "March",
    april: "April",
    may: "May",
    june: "June",
    july: "July",
    august: "August",
    september: "September",
    october: "October",
    november: "November",
    december: "December",
    generating: "Generating schedule...",
    scheduleGenerated: "Schedule generated successfully!"
  },

  // View Schedule
  viewSchedule: {
    title: "View Schedule",
    description: "View and manage generated guard schedules.",
    selectSchedule: "Select Schedule",
    noSchedules: "No schedules available",
    loading: "Loading schedules...",
    doctor: "Doctor",
    shift7h: "7h Shift",
    shift17h: "17h Shift",
    date: "Date",
    shiftType: "Shift Type",
    originalDoctor: "Original Doctor",
    changeAssignment: "Change Assignment",
    save: "Save",
    cancel: "Cancel"
  },

  // Leave Requests
  leaveRequests: {
    title: "Leave Requests",
    description: "Manage doctor leave requests.",
    addRequest: "Add Leave Request",
    doctor: "Doctor",
    startDate: "Start Date",
    endDate: "End Date", 
    reason: "Reason",
    status: "Status",
    hasSubstitute: "Has Substitute",
    substituteName: "Substitute Name",
    notes: "Notes",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    approve: "Approve",
    reject: "Reject"
  },

  // Statistics
  statistics: {
    title: "Guard Assignment Statistics",
    columnVisibility: "Column Visibility",
    all7hShifts: "All 7h Shifts",
    all17hShifts: "All 17h Shifts", 
    allTotals: "All Totals",
    shiftDays7h: "7h Shift Days:",
    shiftDays17h: "17h Shift Days:",
    totalColumns: "Total Columns:",
    total7h: "7h Total",
    total17h: "17h Total",
    grandTotal: "Grand Total",
    startDate: "Start Date",
    endDate: "End Date",
    pickStartDate: "Pick a start date",
    pickEndDate: "Pick an end date",
    quickDateRanges: "Quick Date Ranges",
    currentMonth: "Current Month",
    currentYear: "Current Year",
    last12Months: "Last 12 Months",
    currentYearQuarters: "Current Year Quarters",
    q1: "Q1 (Jan-Mar)",
    q2: "Q2 (Apr-Jun)",
    q3: "Q3 (Jul-Sep)",
    q4: "Q4 (Oct-Dec)",
    doctorSelection: "Doctor Selection",
    selectAll: "Select All",
    deselectAll: "Deselect All",
    generateStatistics: "Generate Statistics",
    loading: "Loading...",
    noDataAvailable: "No data available for the selected criteria.",
    doctorName: "Doctor Name",
    totalGuards: "Total Guards"
  },

  // User Management
  userManagement: {
    title: "User Management",
    description: "Manage user accounts and permissions.",
    users: "Users",
    role: "Role",
    editor: "Editor",
    viewer: "Viewer",
    associatedDoctor: "Associated Doctor",
    noDoctor: "No Doctor",
    loading: "Loading users...",
    updateRole: "Update Role",
    save: "Save",
    cancel: "Cancel"
  },

  // Authentication
  auth: {
    login: "Login",
    email: "Email",
    password: "Password",
    signUp: "Sign Up",
    signIn: "Sign In",
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: "Already have an account?",
    forgotPassword: "Forgot Password?",
    sendResetEmail: "Send Reset Email",
    backToLogin: "Back to Login"
  },

  // Common
  common: {
    loading: "Loading...",
    error: "Error",
    success: "Success",
    warning: "Warning",
    info: "Info",
    yes: "Yes",
    no: "No",
    ok: "OK",
    close: "Close",
    language: "Language",
    english: "English",
    spanish: "Spanish"
  }
};

export type TranslationKeys = typeof en;