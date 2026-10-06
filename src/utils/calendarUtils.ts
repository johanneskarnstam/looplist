import { Item } from '../types';

/**
 * Formats a Date object as a local ISO string (YYYY-MM-DDTHH:mm) for datetime-local inputs.
 */
export function toLocalISOString(date: Date): string {
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().slice(0, 16);
}

/**
 * Returns the next full hour as a local ISO string.
 */
export function getNextFullHour(baseDate: Date = new Date()): string {
    const nextHour = new Date(baseDate);
    nextHour.setHours(nextHour.getHours() + 1);
    nextHour.setMinutes(0);
    nextHour.setSeconds(0);
    nextHour.setMilliseconds(0);
    return toLocalISOString(nextHour);
}

/**
 * Converts a local ISO string (YYYY-MM-DDTHH:mm) to the UTC format required by Google Calendar (YYYYMMDDTHHMMSSZ).
 */
export function formatGoogleCalendarTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export interface GoogleCalendarEventParams {
    title: string;
    items: Item[];
    listId: string;
    startTime: string;
    endTime: string;
    linkText?: string;
}

/**
 * Generates a Google Calendar event URL for a list.
 */
export function buildGoogleCalendarUrl({
    title,
    items,
    listId,
    startTime,
    endTime,
    linkText = 'Öppna lista i LoopList',
}: GoogleCalendarEventParams): string {
    const encodedTitle = encodeURIComponent(title);
    const itemsText = items.map((item) => `• ${item.text}`).join('\n');
    const deepLink = `https://johanneskarnstam.github.io/looplist/#/list/${listId}`;
    const htmlLink = `<a href="${deepLink}">${linkText}</a>`;
    const description = encodeURIComponent(`${itemsText}\n\n${htmlLink}`);

    const startUtc = formatGoogleCalendarTime(startTime);
    const endUtc = formatGoogleCalendarTime(endTime);

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodedTitle}&details=${description}&dates=${startUtc}/${endUtc}`;
}
