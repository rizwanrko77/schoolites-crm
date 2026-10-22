/**
 * Utility functions for formatting Preferred Connect Slot values
 */

export function formatSlotTime(timeStr?: string | null): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  if (
    trimmed.includes('AM') ||
    trimmed.includes('PM') ||
    trimmed.includes('am') ||
    trimmed.includes('pm')
  ) {
    return trimmed;
  }
  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    if (!isNaN(h)) {
      const ampm = h >= 12 ? 'pm' : 'am';
      const formattedH = h % 12 || 12;
      return `${formattedH}:${m} ${ampm}`;
    }
  }
  return trimmed;
}

export function formatSlotDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function getSlotModeIcon(mode?: string | null): string {
  if (!mode) return '📞';
  if (mode.includes('Virtual') || mode.includes('Meeting') || mode.includes('Meet')) return '💻';
  if (mode.includes('Unsure')) return '❓';
  return '📞';
}
