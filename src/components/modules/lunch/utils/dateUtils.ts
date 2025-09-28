// src/components/modules/lunch/utils/dateUtils.ts

/** 
 * Utilidades para manejar fechas en zona horaria peruana (UTC-5)
 */

// Obtener fecha actual en Perú
export function getCurrentDateInPeru(): Date {
  const now = new Date();
  const peruTime = new Date(now.getTime() - (5 * 60 * 60 * 1000)); // UTC-5
  return peruTime;
}

// Formatear fecha como YYYY-MM-DD en zona peruana
export function formatDateForPeru(date: Date): string {
  const peruDate = new Date(date.getTime() - (5 * 60 * 60 * 1000));
  return peruDate.toISOString().split('T')[0];
}

// Obtener fecha actual en formato YYYY-MM-DD para Perú
export function getTodayInPeru(): string {
  return formatDateForPeru(new Date());
}

// Verificar si una fecha ya pasó (en zona peruana)
export function isDatePast(dateString: string): boolean {
  const today = getTodayInPeru();
  return dateString < today;
}

// Obtener días de la semana siguiente con fechas
export function getNextWeekDays(): { day: string; date: string; label: string }[] {
  const today = getCurrentDateInPeru();
  const days = [];
  
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    const dayName = dayNames[date.getDay()];
    const dateString = formatDateForPeru(date);
    const label = `${dayName} ${date.getDate()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    days.push({
      day: dayName,
      date: dateString,
      label
    });
  }
  
  return days;
}

// Mapear días de configuración a nombres en español
export const dayMapping = {
  monday: 'lunes',
  tuesday: 'martes', 
  wednesday: 'miércoles',
  thursday: 'jueves',
  friday: 'viernes',
  saturday: 'sábado',
  sunday: 'domingo'
} as const;

// Obtener días habilitados según configuración
export function getEnabledDays(enabledDays?: Record<string, boolean>): string[] {
  if (!enabledDays) return [];
  
  return Object.entries(enabledDays)
    .filter(([_, enabled]) => enabled)
    .map(([day, _]) => dayMapping[day as keyof typeof dayMapping])
    .filter(Boolean);
}