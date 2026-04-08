"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCurrencyNumber = toCurrencyNumber;
exports.almostEqualMoney = almostEqualMoney;
function toCurrencyNumber(value) {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        return Number(value);
    }
    if (typeof value === 'object' &&
        value !== null &&
        'toNumber' in value &&
        typeof value.toNumber === 'function') {
        return value.toNumber();
    }
    return Number(value);
}
function almostEqualMoney(a, b) {
    return Math.abs(a - b) < 0.01;
}
