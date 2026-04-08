import { dayjs } from './dayjs.util';

export function getTodayRange(timezone: string) {
  const now = dayjs().tz(timezone);

  return {
    start: now.startOf('day').toDate(),
    end: now.endOf('day').toDate(),
  };
}

export function getDateRange(
  timezone: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const range: { gte?: Date; lte?: Date } = {};

  if (dateFrom) {
    range.gte = dayjs.tz(dateFrom, timezone).startOf('day').toDate();
  }

  if (dateTo) {
    range.lte = dayjs.tz(dateTo, timezone).endOf('day').toDate();
  }

  return range;
}
