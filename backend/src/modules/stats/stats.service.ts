import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { getTodayRange } from '../../common/utils/date-range.util';
import { toCurrencyNumber } from '../../common/utils/decimal.util';
import { PrismaService } from '../../database/prisma/prisma.service';

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

    const statusMap = new Map<OrderStatus, number>();
    grouped.forEach((item) => {
      statusMap.set(item.status, item._count.status);
    });

    return {
      success: true,
      data: {
        totalOrders,
        draftCount: statusMap.get(OrderStatus.draft) ?? 0,
        pendingShipmentCount:
          (statusMap.get(OrderStatus.pending_shipment) ?? 0) +
          (statusMap.get(OrderStatus.partial_shipped) ?? 0),
        shippedCount: statusMap.get(OrderStatus.shipped) ?? 0,
        completedCount: statusMap.get(OrderStatus.completed) ?? 0,
        cancelledCount: statusMap.get(OrderStatus.cancelled) ?? 0,
        totalPayableAmount: toCurrencyNumber(sumResult._sum.payableAmount ?? 0),
      },
    };
  }
}
