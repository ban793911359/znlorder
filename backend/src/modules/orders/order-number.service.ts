import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { dayjs } from '../../common/utils/dayjs.util';

@Injectable()
export class OrderNumberService {
  constructor(private readonly configService: ConfigService) {}

  async generateNextOrderNo(tx: Prisma.TransactionClient): Promise<string> {
    const timezone = this.configService.get<string>(
      'APP_TIMEZONE',
      'Asia/Shanghai',
    );
    const now = dayjs().tz(timezone);
    const bizDate = now.format('YYYY-MM-DD');
    const bizDateCode = now.format('YYYYMMDD');

    await tx.$executeRawUnsafe(
      `
      INSERT INTO order_sequences (biz_date, current_value, updated_at)
      VALUES (?, 0, NOW(3))
      ON DUPLICATE KEY UPDATE updated_at = NOW(3)
      `,
      bizDate,
    );

    const rows = await tx.$queryRawUnsafe<Array<{ current_value: number }>>(
      `SELECT current_value FROM order_sequences WHERE biz_date = ? FOR UPDATE`,
      bizDate,
    );

    if (!rows.length) {
      throw new Error('Failed to load order sequence');
    }

    const maxOrderRows = await tx.$queryRawUnsafe<
      Array<{ max_value: number | null }>
    >(
      `
      SELECT MAX(CAST(SUBSTRING(order_no, 11) AS UNSIGNED)) AS max_value
      FROM orders
      WHERE order_no LIKE ?
      `,
      `ZN${bizDateCode}%`,
    );

    const persistedValue = rows[0].current_value;
    const existingMaxValue = maxOrderRows[0]?.max_value ?? 0;
    const nextValue = Math.max(persistedValue, existingMaxValue) + 1;

    await tx.$executeRawUnsafe(
      `
      UPDATE order_sequences
      SET current_value = ?, updated_at = NOW(3)
      WHERE biz_date = ?
      `,
      nextValue,
      bizDate,
    );

    return `ZN${bizDateCode}${String(nextValue).padStart(3, '0')}`;
  }
}
