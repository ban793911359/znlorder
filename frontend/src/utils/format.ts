import dayjs from 'dayjs';

export function formatDateTime(value?: string | null, pattern = 'YYYY-MM-DD HH:mm') {
  if (!value) {
    return '--';
  }

  return dayjs(value).format(pattern);
}

export function formatMoney(value?: number | string | null) {
  const numberValue = Number(value ?? 0);
  return `¥${numberValue.toFixed(2)}`;
}

export function formatAddress(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function formatReceiverFullAddress(input: {
  receiverFullAddress?: string | null;
  receiverName?: string | null;
  receiverMobile?: string | null;
  receiverProvince?: string | null;
  receiverCity?: string | null;
  receiverDistrict?: string | null;
  receiverAddress?: string | null;
}) {
  if (input.receiverFullAddress) {
    return input.receiverFullAddress;
  }

  return [
    input.receiverName,
    input.receiverMobile,
    formatAddress([
      input.receiverProvince,
      input.receiverCity,
      input.receiverDistrict,
      input.receiverAddress,
    ]),
  ]
    .filter(Boolean)
    .join(' ');
}

export function ensureOrderNo(orderNo?: string | null) {
  if (!orderNo) {
    return '--';
  }

  return orderNo.startsWith('ZN') ? orderNo : `ZN${orderNo}`;
}

export function resolveMediaUrl(url?: string | null) {
  if (!url) {
    return '';
  }

  if (/^https?:\/\//.test(url)) {
    return url;
  }

  const base = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  return base ? `${base}${url}` : url;
}

export function isImageAvailable(input?: {
  available?: boolean;
  expiresAt?: string | null;
  deletedAt?: string | null;
}) {
  if (!input) {
    return false;
  }

  if (input.available === false) {
    return false;
  }

  if (input.deletedAt) {
    return false;
  }

  if (input.expiresAt && dayjs(input.expiresAt).isBefore(dayjs())) {
    return false;
  }

  return true;
}
