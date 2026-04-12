"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHIPMENT_STATUS = exports.SHIPMENT_STATUS_VALUES = exports.ORDER_STATUS = exports.ORDER_STATUS_VALUES = void 0;
exports.ORDER_STATUS_VALUES = [
    'draft',
    'pending_shipment',
    'partial_shipped',
    'shipped',
    'completed',
    'cancelled',
];
exports.ORDER_STATUS = {
    draft: 'draft',
    pending_shipment: 'pending_shipment',
    partial_shipped: 'partial_shipped',
    shipped: 'shipped',
    completed: 'completed',
    cancelled: 'cancelled',
};
exports.SHIPMENT_STATUS_VALUES = ['partial_shipped', 'shipped'];
exports.SHIPMENT_STATUS = {
    partial_shipped: 'partial_shipped',
    shipped: 'shipped',
};
