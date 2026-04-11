"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderNumberService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const dayjs_util_1 = require("../../common/utils/dayjs.util");
let OrderNumberService = class OrderNumberService {
    constructor(configService) {
        this.configService = configService;
    }
    async generateNextOrderNo(tx) {
        const timezone = this.configService.get('APP_TIMEZONE', 'Asia/Shanghai');
        const now = (0, dayjs_util_1.dayjs)().tz(timezone);
        const bizDate = now.format('YYYY-MM-DD');
        const bizDateCode = now.format('YYYYMMDD');
        const lockedRows = await tx.$queryRawUnsafe(`
      SELECT current_value
      FROM order_sequences
      WHERE biz_date = ?
      FOR UPDATE
      `, bizDate);
        let nextValue;
        if (lockedRows.length > 0) {
            nextValue = Number(lockedRows[0]?.current_value ?? 0) + 1;
            await tx.$executeRawUnsafe(`
        UPDATE order_sequences
        SET current_value = ?, updated_at = NOW(3)
        WHERE biz_date = ?
        `, nextValue, bizDate);
        }
        else {
            const maxOrderRows = await tx.$queryRawUnsafe(`
        SELECT MAX(CAST(SUBSTRING(order_no, 11) AS UNSIGNED)) AS max_value
        FROM orders
        WHERE order_no LIKE ?
        `, `ZN${bizDateCode}%`);
            const existingMaxValue = Number(maxOrderRows[0]?.max_value ?? 0);
            nextValue = existingMaxValue + 1;
            try {
                await tx.$executeRawUnsafe(`
          INSERT INTO order_sequences (biz_date, current_value, updated_at)
          VALUES (?, ?, NOW(3))
          `, bizDate, nextValue);
            }
            catch {
                const fallbackRows = await tx.$queryRawUnsafe(`
          SELECT current_value
          FROM order_sequences
          WHERE biz_date = ?
          FOR UPDATE
          `, bizDate);
                nextValue = Number(fallbackRows[0]?.current_value ?? 0) + 1;
                await tx.$executeRawUnsafe(`
          UPDATE order_sequences
          SET current_value = ?, updated_at = NOW(3)
          WHERE biz_date = ?
          `, nextValue, bizDate);
            }
        }
        if (!Number.isInteger(nextValue) || nextValue < 1) {
            throw new Error('Failed to generate order sequence');
        }
        return `ZN${bizDateCode}${String(nextValue).padStart(3, '0')}`;
    }
};
exports.OrderNumberService = OrderNumberService;
exports.OrderNumberService = OrderNumberService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OrderNumberService);
