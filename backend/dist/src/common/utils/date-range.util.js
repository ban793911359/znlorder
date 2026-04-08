"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayRange = getTodayRange;
exports.getDateRange = getDateRange;
const dayjs_util_1 = require("./dayjs.util");
function getTodayRange(timezone) {
    const now = (0, dayjs_util_1.dayjs)().tz(timezone);
    return {
        start: now.startOf('day').toDate(),
        end: now.endOf('day').toDate(),
    };
}
function getDateRange(timezone, dateFrom, dateTo) {
    const range = {};
    if (dateFrom) {
        range.gte = dayjs_util_1.dayjs.tz(dateFrom, timezone).startOf('day').toDate();
    }
    if (dateTo) {
        range.lte = dayjs_util_1.dayjs.tz(dateTo, timezone).endOf('day').toDate();
    }
    return range;
}
