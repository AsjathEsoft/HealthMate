// Simple date helper functions using the device's local calendar date

// Converts a "YYYY-MM-DD" string or Date into a local Date object
export function parseLocalDate(input?: Date | string | null): Date {
  if (!input) {
    return new Date();
  }

  if (input instanceof Date) {
    if (isNaN(input.getTime())) {
      return new Date();
    }
    return input;
  }

  const parts = input.trim().split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day);
    }
  }

  const parsed = new Date(input);
  if (isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

// Formats a Date into "YYYY-MM-DD" for storing in SQLite
export function formatIsoDate(date: Date | string = new Date()): string {
  const localDate = parseLocalDate(date);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Formats a Date into a readable string like "Saturday, November 7, 2026"
export function formatDisplayDate(date: Date | string = new Date()): string {
  const localDate = parseLocalDate(date);
  return localDate.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

