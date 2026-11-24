// Basic input validation functions for forms and database operations

// Check if an email address has a valid basic format (e.g. name@example.com)
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(trimmed);
}

// Check if a date string is a real calendar date in YYYY-MM-DD format
export function isValidCalendarDate(dateText: string): boolean {
  const trimmed = dateText.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return false;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) {
    return false;
  }

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonths = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = daysInMonths[month - 1];

  if (day < 1 || day > maxDay) {
    return false;
  }

  return true;
}

// Convert text into a non-negative whole number (0, 1, 2, ...), or return null if invalid
export function parseWholeNumber(value: string | number): number | null {
  const text = String(value).trim();
  if (text === '') {
    return null;
  }

  if (!/^\d+$/.test(text)) {
    return null;
  }

  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

// Convert text into a positive whole number greater than 0 (1, 2, 3, ...), or return null if invalid
export function parsePositiveNumber(value: string | number): number | null {
  const parsed = parseWholeNumber(value);
  if (parsed === null || parsed <= 0) {
    return null;
  }
  return parsed;
}
