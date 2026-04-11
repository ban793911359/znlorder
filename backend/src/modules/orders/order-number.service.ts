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

    const lockedRows = await tx.$queryRawUnsafe<Array<{ current_value: number }>>(
      `
      SELECT current_value
      FROM order_sequences
      WHERE biz_date = ?
      FOR UPDATE
      `,
      bizDate,
    );

    let nextValue: number;

    if (lockedRows.length > 0) {
      nextValue = Number(lockedRows[0]?.current_value ?? 0) + 1;

      await tx.$executeRawUnsafe(
        `
        UPDATE order_sequences
        SET current_value = ?, updated_at = NOW(3)
        WHERE biz_date = ?
        `,
        nextValue,
        bizDate,
      );
    } else {
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

      const existingMaxValue = Number(maxOrderRows[0]?.max_value ?? 0);
      nextValue = existingMaxValue + 1;

      try {
        await tx.$executeRawUnsafe(
          `
          INSERT INTO order_sequences (biz_date, current_value, updated_at)
          VALUES (?, ?, NOW(3))
          `,
          bizDate,
          nextValue,
        );
      } catch {
        const fallbackRows = await tx.$queryRawUnsafe<
          Array<{ current_value: number }>
        >(
          `
          SELECT current_value
          FROM order_sequences
          WHERE biz_date = ?
          FOR UPDATE
          `,
          bizDate,
        );

        nextValue = Number(fallbackRows[0]?.current_value ?? 0) + 1;

        await tx.$executeRawUnsafe(
          `
          UPDATE order_sequences
          SET current_value = ?, updated_at = NOW(3)
          WHERE biz_date = ?
          `,
          nextValue,
          bizDate,
        );
      }
    }

    if (!Number.isInteger(nextValue) || nextValue < 1) {
      throw new Error('Failed to generate order sequence');
    }

    return `ZN${bizDateCode}${String(nextValue).padStart(3, '0')}`;
  }
}
