import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { toCurrencyNumber } from '../../common/utils/decimal.util';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async identifyByMobile(mobile: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { mobile },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            orderNo: true,
            status: true,
            receiverName: true,
            receiverMobile: true,
            receiverProvince: true,
            receiverCity: true,
            receiverDistrict: true,
            receiverAddress: true,
            payableAmount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!customer) {
      return {
        success: true,
        data: {
          isExistingCustomer: false,
          customer: null,
          lastShippingInfo: null,
          recentOrders: [],
        },
      };
    }

    return {
      success: true,
      data: {
        isExistingCustomer: true,
        customer: {
          id: customer.id,
          name: customer.name,
          mobile: customer.mobile,
          wechatNickname: customer.wechatNickname,
          note: customer.note,
          lastOrderAt: customer.lastOrderAt,
        },
        lastShippingInfo: {
          receiverName: customer.receiverName,
          receiverMobile: customer.receiverMobile,
          receiverFullAddress: customer.receiverAddress,
          receiverProvince: customer.receiverProvince,
          receiverCity: customer.receiverCity,
          receiverDistrict: customer.receiverDistrict,
          receiverAddress: customer.receiverAddress,
        },
        recentOrders: customer.orders.map((order) => ({
          id: order.id,
          orderNo: order.orderNo,
          status: order.status,
          receiverName: order.receiverName,
          receiverMobile: order.receiverMobile,
          receiverFullAddress: order.receiverAddress,
          receiverProvince: order.receiverProvince,
          receiverCity: order.receiverCity,
          receiverDistrict: order.receiverDistrict,
          receiverAddress: order.receiverAddress,
          payableAmount: toCurrencyNumber(order.payableAmount),
          createdAt: order.createdAt,
        })),
      },
    };
  }
}
