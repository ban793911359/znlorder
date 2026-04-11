"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPLOAD_BIZ_TYPES = exports.ORDER_PAYMENT_CODE_IMAGE_BIZ_TYPE = exports.ORDER_PRODUCT_IMAGE_BIZ_TYPE = void 0;
exports.isUploadImageBizType = isUploadImageBizType;
exports.ORDER_PRODUCT_IMAGE_BIZ_TYPE = 'order_product_image';
exports.ORDER_PAYMENT_CODE_IMAGE_BIZ_TYPE = 'order_payment_code_image';
exports.UPLOAD_BIZ_TYPES = [
    exports.ORDER_PRODUCT_IMAGE_BIZ_TYPE,
    exports.ORDER_PAYMENT_CODE_IMAGE_BIZ_TYPE,
];
function isUploadImageBizType(value) {
    return exports.UPLOAD_BIZ_TYPES.includes(value);
}
