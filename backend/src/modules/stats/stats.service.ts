import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getTodayRange } from '../../common/utils/date-range.util';
import { toCurrencyNumber } from '../../common/utils/decimal.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ORDER_STATUS } from '../orders/order-status.constants';

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getTodayOrderStats() {
    const timezone = this.configService.get<string>(
      'APP_TIMEZONE',
      'Asia/Shanghai',
    );
    const { start, end } = getTodayRange(timezone);

    const [totalOrders, grouped, sumResult] = await Promise.all([
      this.prisma.order.count({
        where: {
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
        where: {
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      }),
      this.prisma.order.aggregate({
        _sum: {
          payableAmount: true,
        },
        where: {
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      }),
    ]);

    const statusMap = new Map<string, number>();
    grouped.forEach((item) => {
      statusMap.set(item.status, item._count.status);
    });

    return {
      success: true,
      data: {
        totalOrders,
        draftCount: statusMap.get(ORDER_STATUS.draft) ?? 0,
        pendingShipmentCount:
          (statusMap.get(ORDER_STATUS.pending_shipment) ?? 0) +
          (statusMap.get(ORDER_STATUS.partial_shipped) ?? 0),
        shippedCount: statusMap.get(ORDER_STATUS.shipped) ?? 0,
        completedCount: statusMap.get(ORDER_STATUS.completed) ?? 0,
        cancelledCount: statusMap.get(ORDER_STATUS.cancelled) ?? 0,
        totalPayableAmount: toCurrencyNumber(sumResult._sum.payableAmount ?? 0),
      },
    };
  }
}
