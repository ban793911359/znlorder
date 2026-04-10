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

    const existingMaxValue = maxOrderRows[0]?.max_value ?? 0;

    await tx.$executeRawUnsafe(
      `
      INSERT INTO order_sequences (biz_date, current_value, updated_at)
      VALUES (?, ?, NOW(3))
      ON DUPLICATE KEY UPDATE
        current_value = GREATEST(current_value, VALUES(current_value)),
        updated_at = NOW(3)
      `,
      bizDate,
      existingMaxValue,
    );

    await tx.$executeRawUnsafe(
      `
      UPDATE order_sequences
      SET current_value = LAST_INSERT_ID(GREATEST(current_value, ?) + 1),
          updated_at = NOW(3)
      WHERE biz_date = ?
      `,
      existingMaxValue,
      bizDate,
    );

    const rows = await tx.$queryRawUnsafe<Array<{ current_value: number }>>(
      `SELECT LAST_INSERT_ID() AS current_value`,
    );
    const nextValue = Number(rows[0]?.current_value);

    if (!Number.isInteger(nextValue) || nextValue < 1) {
      throw new Error('Failed to generate order sequence');
    }

    return `ZN${bizDateCode}${String(nextValue).padStart(3, '0')}`;
  }
}
