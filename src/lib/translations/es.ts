import { TranslationKeys } from './en';

export const es: TranslationKeys = {
  // Navigation
  navigation: {
    doctorManagement: "Gestión de Médicos",
    calendarConfig: "Configuración de Calendario",
    scheduleGeneration: "Generación de Horarios",
    viewSchedule: "Ver Horario",
    leaveRequests: "Solicitudes de Licencia",
    statistics: "Estadísticas",
    userManagement: "Gestión de Usuarios",
    logout: "Cerrar Sesión"
  },

  // Doctor Management
  doctors: {
    title: "Gestión de Médicos",
    addDoctor: "Agregar Médico",
    editDoctor: "Editar Médico",
    fullName: "Nombre Completo",
    alias: "Alias",
    unavailableWeekdays: "Días de la Semana No Disponibles",
    maxGuards7h: "Máximo Guardias 7h",
    maxGuards17h: "Máximo Guardias 17h",
    save: "Guardar",
    cancel: "Cancelar",
    edit: "Editar",
    delete: "Eliminar",
    confirmDelete: "¿Está seguro de que desea eliminar este médico?",
    doctorsList: "Lista de Médicos",
    monday: "Lunes",
    tuesday: "Martes",
    wednesday: "Miércoles",
    thursday: "Jueves",
    friday: "Viernes",
    saturday: "Sábado",
    sunday: "Domingo"
  },

  // Calendar Configuration
  calendar: {
    title: "Configuración de Calendario",
    description: "Configure qué días son días de guardia seleccionando fechas en el calendario. Las fechas seleccionadas se marcarán como días de guardia.",
    guardDays: "Días de Guardia",
    selectedDates: "Fechas Seleccionadas",
    saveConfiguration: "Guardar Configuración",
    loadingCalendar: "Cargando configuración del calendario...",
    savingConfiguration: "Guardando configuración...",
    configurationSaved: "¡Configuración del calendario guardada exitosamente!"
  },

  // Schedule Generation
  schedule: {
    title: "Generación de Horarios",
    description: "Genere horarios de guardia para un mes y año específicos.",
    selectMonth: "Seleccionar Mes",
    selectYear: "Seleccionar Año",
    generateSchedule: "Generar Horario",
    january: "Enero",
    february: "Febrero",
    march: "Marzo",
    april: "Abril",
    may: "Mayo",
    june: "Junio",
    july: "Julio",
    august: "Agosto",
    september: "Septiembre",
    october: "Octubre",
    november: "Noviembre",
    december: "Diciembre",
    generating: "Generando horario...",
    scheduleGenerated: "¡Horario generado exitosamente!"
  },

  // View Schedule
  viewSchedule: {
    title: "Ver Horario",
    description: "Vea y gestione los horarios de guardia generados.",
    selectSchedule: "Seleccionar Horario",
    noSchedules: "No hay horarios disponibles",
    loading: "Cargando horarios...",
    doctor: "Médico",
    shift7h: "Turno 7h",
    shift17h: "Turno 17h",
    date: "Fecha",
    shiftType: "Tipo de Turno",
    originalDoctor: "Médico Original",
    changeAssignment: "Cambiar Asignación",
    save: "Guardar",
    cancel: "Cancelar"
  },

  // Leave Requests
  leaveRequests: {
    title: "Solicitudes de Licencia",
    description: "Gestione las solicitudes de licencia de los médicos.",
    addRequest: "Agregar Solicitud",
    doctor: "Médico",
    startDate: "Fecha de Inicio",
    endDate: "Fecha de Fin",
    reason: "Motivo",
    status: "Estado",
    hasSubstitute: "Tiene Sustituto",
    substituteName: "Nombre del Sustituto",
    notes: "Notas",
    pending: "Pendiente",
    approved: "Aprobado",
    rejected: "Rechazado",
    save: "Guardar",
    cancel: "Cancelar",
    edit: "Editar",
    delete: "Eliminar",
    approve: "Aprobar",
    reject: "Rechazar"
  },

  // Statistics
  statistics: {
    title: "Estadísticas de Asignación de Guardias",
    columnVisibility: "Visibilidad de Columnas",
    all7hShifts: "Todos los Turnos 7h",
    all17hShifts: "Todos los Turnos 17h",
    allTotals: "Todos los Totales",
    shiftDays7h: "Días de Turno 7h:",
    shiftDays17h: "Días de Turno 17h:",
    totalColumns: "Columnas de Total:",
    total7h: "Total 7h",
    total17h: "Total 17h",
    grandTotal: "Total General",
    startDate: "Fecha de Inicio",
    endDate: "Fecha de Fin",
    pickStartDate: "Seleccione una fecha de inicio",
    pickEndDate: "Seleccione una fecha de fin",
    quickDateRanges: "Rangos de Fecha Rápidos",
    currentMonth: "Mes Actual",
    currentYear: "Año Actual",
    last12Months: "Últimos 12 Meses",
    currentYearQuarters: "Trimestres del Año Actual",
    q1: "T1 (Ene-Mar)",
    q2: "T2 (Abr-Jun)",
    q3: "T3 (Jul-Sep)",
    q4: "T4 (Oct-Dic)",
    doctorSelection: "Selección de Médicos",
    selectAll: "Seleccionar Todo",
    deselectAll: "Deseleccionar Todo",
    generateStatistics: "Generar Estadísticas",
    loading: "Cargando...",
    noDataAvailable: "No hay datos disponibles para los criterios seleccionados.",
    doctorName: "Nombre del Médico",
    totalGuards: "Total de Guardias"
  },

  // User Management
  userManagement: {
    title: "Gestión de Usuarios",
    description: "Gestione cuentas de usuario y permisos.",
    users: "Usuarios",
    role: "Rol",
    editor: "Editor",
    viewer: "Visualizador",
    associatedDoctor: "Médico Asociado",
    noDoctor: "Sin Médico",
    loading: "Cargando usuarios...",
    updateRole: "Actualizar Rol",
    save: "Guardar",
    cancel: "Cancelar"
  },

  // Authentication
  auth: {
    login: "Iniciar Sesión",
    email: "Correo Electrónico",
    password: "Contraseña",
    signUp: "Registrarse",
    signIn: "Iniciar Sesión",
    dontHaveAccount: "¿No tienes una cuenta?",
    alreadyHaveAccount: "¿Ya tienes una cuenta?",
    forgotPassword: "¿Olvidaste tu contraseña?",
    sendResetEmail: "Enviar Email de Restablecimiento",
    backToLogin: "Volver al Inicio de Sesión"
  },

  // Common
  common: {
    loading: "Cargando...",
    error: "Error",
    success: "Éxito",
    warning: "Advertencia",
    info: "Información",
    yes: "Sí",
    no: "No",
    ok: "OK",
    close: "Cerrar",
    language: "Idioma",
    english: "Inglés",
    spanish: "Español"
  }
};