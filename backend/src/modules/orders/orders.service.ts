import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma, UploadBizType } from '@prisma/client';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import {
  almostEqualMoney,
  toCurrencyNumber,
} from '../../common/utils/decimal.util';
import { getDateRange, getTodayRange } from '../../common/utils/date-range.util';
import {
  generatePublicToken,
  hashPublicToken,
} from '../../common/utils/public-token.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { SaveOrderDraftDto } from './dto/order-draft.dto';
import { PublicOrderQueryDto } from './dto/public-order-query.dto';
import { ShipOrderDto } from './dto/ship-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import {
  presentOrderBase,
  presentOrderImages,
  presentOrderItems,
  presentOrderLogs,
} from './order-presenter';
import { OrderNumberService } from './order-number.service';

type OrderDraftRow = {
  id: number | bigint;
  title: string | null;
  payload: Prisma.JsonValue | string;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class OrdersService {
  private static readonly ORDER_NO_RETRY_TIMES = 3;
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderNumberService: OrderNumberService,
    private readonly configService: ConfigService,
  ) {}

  async listOrderDrafts(currentUser: JwtUser) {
    const drafts = await this.prisma.$queryRaw<OrderDraftRow[]>`
      SELECT id, title, payload, created_at, updated_at
      FROM order_drafts
      WHERE owner_id = ${currentUser.id}
      ORDER BY updated_at DESC
      LIMIT 20
    `;

    return {
      success: true,
      data: drafts.map((draft) => this.presentOrderDraftRow(draft)),
    };
  }

  async getOrderDraft(id: number, currentUser: JwtUser) {
    const drafts = await this.prisma.$queryRaw<OrderDraftRow[]>`
      SELECT id, title, payload, created_at, updated_at
      FROM order_drafts
      WHERE id = ${id} AND owner_id = ${currentUser.id}
      LIMIT 1
    `;
    const draft = drafts[0];

    if (!draft) {
      throw new NotFoundException('Order draft not found');
    }

    return {
      success: true,
      data: this.presentOrderDraftRow(draft),
    };
  }

  async saveOrderDraft(
    saveOrderDraftDto: SaveOrderDraftDto,
    currentUser: JwtUser,
  ) {
    const title = saveOrderDraftDto.title?.trim() || '未命名草稿';
    const payload = JSON.stringify(saveOrderDraftDto.payload ?? {});

    if (saveOrderDraftDto.id) {
      const existingDrafts = await this.prisma.$queryRaw<Array<{ id: number }>>`
        SELECT id
        FROM order_drafts
        WHERE id = ${saveOrderDraftDto.id} AND owner_id = ${currentUser.id}
        LIMIT 1
      `;
      const existingDraft = existingDrafts[0];

      if (!existingDraft) {
        throw new NotFoundException('Order draft not found');
      }

      await this.prisma.$executeRaw`
        UPDATE order_drafts
        SET title = ${title}, payload = ${payload}, updated_at = CURRENT_TIMESTAMP(3)
        WHERE id = ${saveOrderDraftDto.id} AND owner_id = ${currentUser.id}
      `;

      const updatedDrafts = await this.prisma.$queryRaw<OrderDraftRow[]>`
        SELECT id, title, payload, created_at, updated_at
        FROM order_drafts
        WHERE id = ${saveOrderDraftDto.id} AND owner_id = ${currentUser.id}
        LIMIT 1
      `;

      return {
        success: true,
        data: this.presentOrderDraftRow(updatedDrafts[0]),
      };
    }

    const draft = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO order_drafts (owner_id, title, payload, created_at, updated_at)
        VALUES (${currentUser.id}, ${title}, ${payload}, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
      `;

      const drafts = await tx.$queryRaw<OrderDraftRow[]>`
        SELECT id, title, payload, created_at, updated_at
        FROM order_drafts
        WHERE id = LAST_INSERT_ID()
        LIMIT 1
      `;

      return drafts[0];
    });

    return {
      success: true,
      data: this.presentOrderDraftRow(draft),
    };
  }

  async deleteOrderDraft(id: number, currentUser: JwtUser) {
    const existingDrafts = await this.prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM order_drafts
      WHERE id = ${id} AND owner_id = ${currentUser.id}
      LIMIT 1
    `;
    const existingDraft = existingDrafts[0];

    if (!existingDraft) {
      throw new NotFoundException('Order draft not found');
    }

    await this.prisma.$executeRaw`
      DELETE FROM order_drafts
      WHERE id = ${id} AND owner_id = ${currentUser.id}
    `;

    return {
      success: true,
      data: {
        id,
        deleted: true,
      },
    };
  }

  async createOrder(createOrderDto: CreateOrderDto, currentUser: JwtUser) {
    const receiverInfo = this.normalizeReceiverInfo({
      customerName: createOrderDto.customerName,
      customerMobile: createOrderDto.customerMobile,
      receiverName: createOrderDto.receiverName,
      receiverMobile: createOrderDto.receiverMobile,
      receiverAddress: createOrderDto.receiverAddress,
      receiverFullAddress: createOrderDto.receiverFullAddress,
      receiverProvince: createOrderDto.receiverProvince,
      receiverCity: createOrderDto.receiverCity,
      receiverDistrict: createOrderDto.receiverDistrict,
    });

    this.validateProductModelNos(createOrderDto.items);

    this.validateAmounts(
      createOrderDto.items,
      createOrderDto.totalAmount,
      createOrderDto.shippingFee ?? 0,
      createOrderDto.discountAmount ?? 0,
      createOrderDto.payableAmount,
    );

    const itemImageFileIds = this.collectItemImageFileIds(createOrderDto.items);
    const paymentImageFileIds = createOrderDto.paymentImageFileIds ?? [];
    await this.ensureUploadFilesAvailable(
      itemImageFileIds,
      undefined,
      UploadBizType.order_product_image,
    );
    await this.ensureUploadFilesAvailable(
      paymentImageFileIds,
      undefined,
      UploadBizType.order_payment_code_image,
    );

    let lastError: unknown;
    let result:
      | {
          orderId: number;
          orderNo: string;
          status: OrderStatus;
          clientToken: string;
          clientLinkPath: string;
          clientLink: string;
        }
      | undefined;

    for (
      let attempt = 1;
      attempt <= OrdersService.ORDER_NO_RETRY_TIMES;
      attempt += 1
    ) {
      try {
        result = await this.prisma.$transaction(async (tx) => {
          const now = new Date();
          const customer = await tx.customer.upsert({
            where: { mobile: createOrderDto.customerMobile },
            update: {
              name: createOrderDto.customerName,
              wechatNickname: createOrderDto.wechatNickname,
              receiverName: receiverInfo.receiverName,
              receiverMobile: receiverInfo.receiverMobile,
              receiverProvince: null,
              receiverCity: null,
              receiverDistrict: null,
              receiverAddress: receiverInfo.receiverFullAddress,
              lastOrderAt: now,
            },
            create: {
              name: createOrderDto.customerName,
              mobile: createOrderDto.customerMobile,
              wechatNickname: createOrderDto.wechatNickname,
              receiverName: receiverInfo.receiverName,
              receiverMobile: receiverInfo.receiverMobile,
              receiverProvince: null,
              receiverCity: null,
              receiverDistrict: null,
              receiverAddress: receiverInfo.receiverFullAddress,
              lastOrderAt: now,
            },
          });

          const orderNo = await this.orderNumberService.generateNextOrderNo(tx);
          const { rawToken, tokenHash } = generatePublicToken();
          const clientLinkPath = `/client/orders/${orderNo}`;

          const order = await tx.order.create({
            data: {
              orderNo,
              customerId: customer.id,
              status: OrderStatus.pending_shipment,
              clientTokenHash: tokenHash,
              clientLinkPath,
              createdById: currentUser.id,
              receiverName: receiverInfo.receiverName,
              receiverMobile: receiverInfo.receiverMobile,
              receiverProvince: null,
              receiverCity: null,
              receiverDistrict: null,
              receiverAddress: receiverInfo.receiverFullAddress,
              totalAmount: createOrderDto.totalAmount,
              shippingFee: createOrderDto.shippingFee ?? 0,
              discountAmount: createOrderDto.discountAmount ?? 0,
              payableAmount: createOrderDto.payableAmount,
              operatorRemark: createOrderDto.operatorRemark,
            },
          });

          for (const item of createOrderDto.items) {
            const createdItem = await tx.orderItem.create({
              data: {
                orderId: order.id,
                productName: item.productName?.trim() || '',
                productSpec: item.productSpec,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineAmount: item.lineAmount,
                remark: item.remark,
              },
            });

            if ((item.imageFileIds ?? []).length > 0) {
              await tx.uploadFile.updateMany({
                where: {
                  id: { in: item.imageFileIds },
                },
                data: {
                  orderId: order.id,
                  orderItemId: createdItem.id,
                },
              });
            }
          }

          if (paymentImageFileIds.length > 0) {
            await tx.uploadFile.updateMany({
              where: {
                id: { in: paymentImageFileIds },
              },
              data: {
                orderId: order.id,
                orderItemId: null,
              },
            });
          }

          await tx.orderStatusLog.create({
            data: {
              orderId: order.id,
              fromStatus: null,
              toStatus: OrderStatus.pending_shipment,
              action: 'create_order',
              operatorId: currentUser.id,
              note: 'Order created by operator',
            },
          });

          return {
            orderId: order.id,
            orderNo,
            status: OrderStatus.pending_shipment,
            clientToken: rawToken,
            clientLinkPath,
            clientLink: this.buildClientLink(orderNo, rawToken),
          };
        });

        break;
      } catch (error) {
        lastError = error;

        if (this.isOrderNoUniqueConflict(error)) {
          this.logger.warn(
            `Order number unique conflict while creating order; attempt=${attempt}/${OrdersService.ORDER_NO_RETRY_TIMES}; ${this.describePrismaError(error)}`,
          );

          if (attempt < OrdersService.ORDER_NO_RETRY_TIMES) {
            continue;
          }
        }

        this.logger.error(
          `Failed to create order; attempt=${attempt}/${OrdersService.ORDER_NO_RETRY_TIMES}; ${this.describePrismaError(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
        throw error;
      }
    }

    if (!result) {
      throw lastError ?? new Error('Failed to create order');
    }

    return {
      success: true,
      data: result,
    };
  }

  async updateOrder(
    id: number,
    updateOrderDto: UpdateOrderDto,
    currentUser: JwtUser,
  ) {
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            images: true,
          },
        },
        images: true,
      },
    });

    if (!existingOrder) {
      throw new NotFoundException('Order not found');
    }

    if (
      existingOrder.status === OrderStatus.shipped ||
      existingOrder.status === OrderStatus.completed ||
      existingOrder.status === OrderStatus.cancelled
    ) {
      throw new BadRequestException('Current order can no longer be edited');
    }

    const mergedItems =
      updateOrderDto.items ??
      existingOrder.items.map((item) => ({
        productName: item.productName,
        productSpec: item.productSpec ?? undefined,
        quantity: item.quantity,
        unitPrice: toCurrencyNumber(item.unitPrice),
        lineAmount: toCurrencyNumber(item.lineAmount),
        remark: item.remark ?? undefined,
        imageFileIds: item.images.map((image) => image.id),
      }));

    this.validateProductModelNos(mergedItems);

    const receiverInfo = this.normalizeReceiverInfo({
      customerName: updateOrderDto.customerName ?? existingOrder.customer.name,
      customerMobile:
        updateOrderDto.customerMobile ?? existingOrder.customer.mobile,
      receiverName: updateOrderDto.receiverName ?? existingOrder.receiverName,
      receiverMobile:
        updateOrderDto.receiverMobile ?? existingOrder.receiverMobile,
      receiverAddress:
        updateOrderDto.receiverAddress ?? existingOrder.receiverAddress,
      receiverFullAddress:
        updateOrderDto.receiverFullAddress ?? existingOrder.receiverAddress,
      receiverProvince:
        updateOrderDto.receiverProvince ?? existingOrder.receiverProvince,
      receiverCity: updateOrderDto.receiverCity ?? existingOrder.receiverCity,
      receiverDistrict:
        updateOrderDto.receiverDistrict ?? existingOrder.receiverDistrict,
    });

    const mergedTotalAmount =
      updateOrderDto.totalAmount ?? toCurrencyNumber(existingOrder.totalAmount);
    const mergedShippingFee =
      updateOrderDto.shippingFee ?? toCurrencyNumber(existingOrder.shippingFee);
    const mergedDiscountAmount =
      updateOrderDto.discountAmount ??
      toCurrencyNumber(existingOrder.discountAmount);
    const mergedPayableAmount =
      updateOrderDto.payableAmount ??
      toCurrencyNumber(existingOrder.payableAmount);

    this.validateAmounts(
      mergedItems,
      mergedTotalAmount,
      mergedShippingFee,
      mergedDiscountAmount,
      mergedPayableAmount,
    );

    if (updateOrderDto.items !== undefined) {
      await this.ensureUploadFilesAvailable(
        this.collectItemImageFileIds(updateOrderDto.items),
        id,
        UploadBizType.order_product_image,
      );
    }

    if (updateOrderDto.paymentImageFileIds !== undefined) {
      await this.ensureUploadFilesAvailable(
        updateOrderDto.paymentImageFileIds,
        id,
        UploadBizType.order_payment_code_image,
      );
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: {
          mobile: updateOrderDto.customerMobile ?? existingOrder.customer.mobile,
        },
        update: {
          name: updateOrderDto.customerName ?? existingOrder.customer.name,
          wechatNickname:
            updateOrderDto.wechatNickname ?? existingOrder.customer.wechatNickname,
          receiverName: receiverInfo.receiverName,
          receiverMobile: receiverInfo.receiverMobile,
          receiverProvince: null,
          receiverCity: null,
          receiverDistrict: null,
          receiverAddress: receiverInfo.receiverFullAddress,
          lastOrderAt: new Date(),
        },
        create: {
          name: updateOrderDto.customerName ?? existingOrder.customer.name,
          mobile: updateOrderDto.customerMobile ?? existingOrder.customer.mobile,
          wechatNickname:
            updateOrderDto.wechatNickname ?? existingOrder.customer.wechatNickname,
          receiverName: receiverInfo.receiverName,
          receiverMobile: receiverInfo.receiverMobile,
          receiverProvince: null,
          receiverCity: null,
          receiverDistrict: null,
          receiverAddress: receiverInfo.receiverFullAddress,
          lastOrderAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id },
        data: {
          customerId: customer.id,
          receiverName: receiverInfo.receiverName,
          receiverMobile: receiverInfo.receiverMobile,
          receiverProvince: null,
          receiverCity: null,
          receiverDistrict: null,
          receiverAddress: receiverInfo.receiverFullAddress,
          totalAmount: mergedTotalAmount,
          shippingFee: mergedShippingFee,
          discountAmount: mergedDiscountAmount,
          payableAmount: mergedPayableAmount,
          operatorRemark:
            updateOrderDto.operatorRemark ?? existingOrder.operatorRemark,
        },
      });

      if (updateOrderDto.items) {
        await tx.uploadFile.updateMany({
          where: {
            orderId: id,
            bizType: UploadBizType.order_product_image,
          },
          data: {
            orderId: null,
            orderItemId: null,
          },
        });

        await tx.orderItem.deleteMany({ where: { orderId: id } });

        for (const item of updateOrderDto.items) {
          const createdItem = await tx.orderItem.create({
            data: {
              orderId: id,
              productName: item.productName?.trim() || '',
              productSpec: item.productSpec,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineAmount: item.lineAmount,
              remark: item.remark,
            },
          });

          if ((item.imageFileIds ?? []).length > 0) {
            await tx.uploadFile.updateMany({
              where: {
                id: { in: item.imageFileIds },
              },
              data: {
                orderId: id,
                orderItemId: createdItem.id,
              },
            });
          }
        }
      }

      if (updateOrderDto.paymentImageFileIds) {
        await tx.uploadFile.updateMany({
          where: {
            orderId: id,
            bizType: UploadBizType.order_payment_code_image,
          },
          data: {
            orderId: null,
            orderItemId: null,
          },
        });

        if (updateOrderDto.paymentImageFileIds.length > 0) {
          await tx.uploadFile.updateMany({
            where: {
              id: { in: updateOrderDto.paymentImageFileIds },
            },
            data: {
              orderId: id,
              orderItemId: null,
            },
          });
        }
      }

      await tx.orderStatusLog.create({
        data: {
          orderId: id,
          fromStatus: existingOrder.status,
          toStatus: existingOrder.status,
          action: 'update_order',
          operatorId: currentUser.id,
          note: 'Order updated by operator',
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id },
        include: {
          customer: true,
          items: {
            include: {
              images: true,
            },
          },
          images: true,
          logs: {
            orderBy: { createdAt: 'desc' },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              displayName: true,
              role: true,
            },
          },
        },
      });
    });

    return {
      success: true,
      data: {
        ...presentOrderBase(updatedOrder),
        customer: {
          id: updatedOrder.customer.id,
          name: updatedOrder.customer.name,
          mobile: updatedOrder.customer.mobile,
          wechatNickname: updatedOrder.customer.wechatNickname,
        },
        operatorRemark: updatedOrder.operatorRemark,
        warehouseRemark: updatedOrder.warehouseRemark,
        createdBy: updatedOrder.createdBy,
        logs: presentOrderLogs(updatedOrder.logs),
      },
    };
  }

  async listOrders(query: ListOrdersQueryDto) {
    const timezone = this.configService.get<string>(
      'APP_TIMEZONE',
      'Asia/Shanghai',
    );
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    let createdAtFilter: Prisma.DateTimeFilter | undefined;
    if (query.todayOnly) {
      const range = getTodayRange(timezone);
      createdAtFilter = { gte: range.start, lte: range.end };
    } else if (query.dateFrom || query.dateTo) {
      createdAtFilter = getDateRange(timezone, query.dateFrom, query.dateTo);
    }

    const keyword = query.keyword?.trim();
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.orderNo ? { orderNo: { contains: query.orderNo } } : {}),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      ...(query.mobile
        ? {
            OR: [
              { receiverMobile: { contains: query.mobile } },
              { customer: { is: { mobile: { contains: query.mobile } } } },
            ],
          }
        : {}),
      ...(keyword
        ? {
            AND: [
              {
                OR: [
                  { orderNo: { contains: keyword } },
                  { receiverName: { contains: keyword } },
                  { receiverMobile: { contains: keyword } },
                  { receiverAddress: { contains: keyword } },
                  { customer: { is: { name: { contains: keyword } } } },
                  { customer: { is: { mobile: { contains: keyword } } } },
                  {
                    items: {
                      some: {
                        OR: [
                          { productName: { contains: keyword } },
                          { productSpec: { contains: keyword } },
                        ],
                      },
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              mobile: true,
            },
          },
          items: {
            include: {
              images: true,
            },
          },
          images: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              displayName: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        list: orders.map((order) => ({
          ...presentOrderBase(order),
          customer: order.customer,
          createdBy: order.createdBy,
        })),
        pagination: {
          page,
          pageSize,
          total,
        },
      },
    };
  }

  async getOrderDetail(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            images: true,
          },
        },
        images: true,
        logs: {
          orderBy: { createdAt: 'desc' },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      success: true,
      data: {
        ...presentOrderBase(order),
        customer: {
          id: order.customer.id,
          name: order.customer.name,
          mobile: order.customer.mobile,
          wechatNickname: order.customer.wechatNickname,
          note: order.customer.note,
          lastOrderAt: order.customer.lastOrderAt,
        },
        operatorRemark: order.operatorRemark,
        warehouseRemark: order.warehouseRemark,
        clientLinkPath: order.clientLinkPath,
        createdBy: order.createdBy,
        logs: presentOrderLogs(order.logs),
      },
    };
  }

  async cancelOrder(
    id: number,
    cancelOrderDto: CancelOrderDto,
    currentUser: JwtUser,
  ) {
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            images: true,
          },
        },
        images: true,
        logs: {
          orderBy: { createdAt: 'desc' },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
          },
        },
      },
    });

    if (!existingOrder) {
      throw new NotFoundException('Order not found');
    }

    if (
      existingOrder.status === OrderStatus.shipped ||
      existingOrder.status === OrderStatus.completed
    ) {
      throw new BadRequestException('Shipped or completed orders cannot be cancelled');
    }

    if (existingOrder.status === OrderStatus.cancelled) {
      throw new BadRequestException('Order is already cancelled');
    }

    const cancelledOrder = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.cancelled,
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: id,
          fromStatus: existingOrder.status,
          toStatus: OrderStatus.cancelled,
          action: 'cancel_order',
          operatorId: currentUser.id,
          note: cancelOrderDto.reason?.trim() || 'Order cancelled by operator',
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id },
        include: {
          customer: true,
          items: {
            include: {
              images: true,
            },
          },
          images: true,
          logs: {
            orderBy: { createdAt: 'desc' },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              displayName: true,
              role: true,
            },
          },
        },
      });
    });

    return {
      success: true,
      data: {
        ...presentOrderBase(cancelledOrder),
        customer: {
          id: cancelledOrder.customer.id,
          name: cancelledOrder.customer.name,
          mobile: cancelledOrder.customer.mobile,
          wechatNickname: cancelledOrder.customer.wechatNickname,
          note: cancelledOrder.customer.note,
          lastOrderAt: cancelledOrder.customer.lastOrderAt,
        },
        operatorRemark: cancelledOrder.operatorRemark,
        warehouseRemark: cancelledOrder.warehouseRemark,
        clientLinkPath: cancelledOrder.clientLinkPath,
        createdBy: cancelledOrder.createdBy,
        logs: presentOrderLogs(cancelledOrder.logs),
      },
    };
  }

  async getPendingShipmentOrders(query: ListOrdersQueryDto) {
    return this.getWarehouseOrders({
      ...query,
      status: OrderStatus.pending_shipment,
    });
  }

  async getWarehouseOrders(query: ListOrdersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;
    const warehouseStatuses: OrderStatus[] = [
      OrderStatus.pending_shipment,
      OrderStatus.shipped,
    ];
    const status =
      query.status && warehouseStatuses.includes(query.status)
        ? query.status
        : OrderStatus.pending_shipment;

    const keyword = query.keyword?.trim();
    const where: Prisma.OrderWhereInput = {
      status,
      ...(query.orderNo ? { orderNo: { contains: query.orderNo } } : {}),
      ...(query.mobile ? { receiverMobile: { contains: query.mobile } } : {}),
      ...(keyword
        ? {
            AND: [
              {
                OR: [
                  { orderNo: { contains: keyword } },
                  { receiverName: { contains: keyword } },
                  { receiverMobile: { contains: keyword } },
                  { receiverAddress: { contains: keyword } },
                  { customer: { is: { name: { contains: keyword } } } },
                  { customer: { is: { mobile: { contains: keyword } } } },
                  {
                    items: {
                      some: {
                        OR: [
                          { productName: { contains: keyword } },
                          { productSpec: { contains: keyword } },
                        ],
                      },
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: pageSize,
        orderBy:
          status === OrderStatus.shipped
            ? { shippedAt: 'desc' }
            : { createdAt: 'asc' },
        include: {
          customer: {
            select: {
              name: true,
              mobile: true,
            },
          },
          items: true,
          images: true,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        list: orders.map((order) => ({
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
          totalAmount: toCurrencyNumber(order.totalAmount),
          shippingFee: toCurrencyNumber(order.shippingFee),
          discountAmount: toCurrencyNumber(order.discountAmount),
          payableAmount: toCurrencyNumber(order.payableAmount),
          courierCompany: order.courierCompany,
          trackingNo: order.trackingNo,
          shippedAt: order.shippedAt,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          customer: order.customer,
          items: presentOrderItems(order.items),
          images: presentOrderImages(order.images),
          warehouseRemark:
            order.warehouseRemark ??
            this.extractWarehouseRemark(order.operatorRemark),
        })),
        pagination: {
          page,
          pageSize,
          total,
        },
      },
    };
  }

  async shipOrder(id: number, shipOrderDto: ShipOrderDto, currentUser: JwtUser) {
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            images: true,
          },
        },
        images: true,
      },
    });

    if (!existingOrder) {
      throw new NotFoundException('Order not found');
    }

    if (existingOrder.status !== OrderStatus.pending_shipment) {
      throw new BadRequestException('Only pending shipment orders can be shipped');
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id },
        data: {
          courierCompany: shipOrderDto.courierCompany,
          trackingNo: shipOrderDto.trackingNo,
          warehouseRemark: shipOrderDto.warehouseRemark,
          shippedAt: new Date(),
          status: OrderStatus.shipped,
        },
        include: {
          items: {
            include: {
              images: true,
            },
          },
          images: true,
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: id,
          fromStatus: existingOrder.status,
          toStatus: OrderStatus.shipped,
          action: 'ship_order',
          operatorId: currentUser.id,
          note: 'Order shipped by warehouse',
        },
      });

      return order;
    });

    return {
      success: true,
      data: {
        ...presentOrderBase(updatedOrder),
        warehouseRemark: shipOrderDto.warehouseRemark ?? null,
      },
    };
  }

  async getWarehouseOrderDetail(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            name: true,
            mobile: true,
          },
        },
        items: {
          include: {
            images: true,
          },
        },
        images: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      order.status !== OrderStatus.pending_shipment &&
      order.status !== OrderStatus.shipped
    ) {
      throw new BadRequestException('Only pending or shipped orders are available');
    }

    return {
      success: true,
      data: {
        ...presentOrderBase(order),
        customer: order.customer,
        warehouseRemark:
          order.warehouseRemark ?? this.extractWarehouseRemark(order.operatorRemark),
      },
    };
  }

  async getPublicOrderDetail(
    orderNo: string,
    publicOrderQueryDto: PublicOrderQueryDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { orderNo },
      include: {
        items: {
          include: {
            images: true,
          },
        },
        images: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const tokenHash = hashPublicToken(publicOrderQueryDto.token);
    if (tokenHash !== order.clientTokenHash) {
      throw new BadRequestException('Invalid order token');
    }

    return {
      success: true,
      data: {
        ...presentOrderBase(order),
      },
    };
  }

  private buildClientLink(orderNo: string, token: string) {
    const h5BaseUrl = this.configService.get<string>(
      'H5_BASE_URL',
      this.configService.get<string>('APP_BASE_URL', 'http://localhost:5173'),
    );

    return `${h5BaseUrl.replace(/\/$/, '')}/client/orders/${orderNo}?token=${token}`;
  }

  private validateAmounts(
    items: Array<{
      productName?: string;
      productSpec?: string | null;
      quantity: number;
      unitPrice: number;
      lineAmount: number;
    }>,
    totalAmount: number,
    shippingFee: number,
    discountAmount: number,
    payableAmount: number,
  ) {
    const computedTotal = items.reduce((sum, item) => {
      const expectedLineAmount = item.quantity * item.unitPrice;

      if (!almostEqualMoney(expectedLineAmount, item.lineAmount)) {
        throw new BadRequestException(
          `Invalid line amount for product ${item.productName ?? ''}`.trim(),
        );
      }

      return sum + item.lineAmount;
    }, 0);

    if (!almostEqualMoney(computedTotal, totalAmount)) {
      throw new BadRequestException('Total amount does not match item sum');
    }

    const computedPayable = totalAmount + shippingFee - discountAmount;
    if (!almostEqualMoney(computedPayable, payableAmount)) {
      throw new BadRequestException('Payable amount is incorrect');
    }
  }

  private validateProductModelNos(
    items: Array<{
      productSpec?: string | null;
    }>,
  ) {
    const invalidIndex = items.findIndex(
      (item) => !this.extractModelNo(item.productSpec),
    );

    if (invalidIndex >= 0) {
      throw new BadRequestException(`商品 ${invalidIndex + 1} 款号必填`);
    }
  }

  private extractModelNo(productSpec?: string | null) {
    return productSpec
      ?.split('|')
      .map((part) => part.trim())
      .find((part) => part.startsWith('款号:'))
      ?.replace('款号:', '')
      .trim();
  }

  private collectItemImageFileIds(
    items: Array<{
      imageFileIds?: number[];
    }>,
  ) {
    return items.flatMap((item) => item.imageFileIds ?? []);
  }

  private async ensureUploadFilesAvailable(
    imageFileIds: number[],
    currentOrderId?: number,
    bizType: UploadBizType = UploadBizType.order_product_image,
  ) {
    if (imageFileIds.length === 0) {
      return;
    }

    const uniqueIds = [...new Set(imageFileIds)];
    const files = await this.prisma.uploadFile.findMany({
      where: {
        id: { in: uniqueIds },
        bizType,
      },
    });

    if (files.length !== uniqueIds.length) {
      throw new BadRequestException('Some uploaded images do not exist');
    }

    const occupiedFile = files.find((file) => {
      if (file.orderId === null) {
        return false;
      }

      return file.orderId !== currentOrderId;
    });

    if (occupiedFile) {
      throw new BadRequestException(
        'Some uploaded images already belong to another order',
      );
    }
  }

  private extractWarehouseRemark(operatorRemark?: string | null) {
    if (!operatorRemark) {
      return null;
    }

    const normalizedRemark = operatorRemark
      .replaceAll('\\n', '\n')
      .replaceAll('`n', '\n');

    const matched = normalizedRemark
      .split('\n')
      .find((line) => line.startsWith('【仓库备注】'));

    if (!matched) {
      return null;
    }

    const value = matched.replace('【仓库备注】', '').trim();
    return value === '--' ? null : value;
  }

  private isOrderNoUniqueConflict(error: unknown) {
    const code = this.getErrorCode(error);
    const target =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.meta?.target
        : typeof error === 'object' && error !== null && 'meta' in error
          ? (error as { meta?: { target?: unknown } }).meta?.target
          : undefined;

    const normalizedTarget = Array.isArray(target)
      ? target.join(',')
      : target === undefined || target === null
        ? ''
        : String(target);

    return (
      code === 'P2002' &&
      (normalizedTarget.includes('orders_order_no_key') ||
        normalizedTarget.includes('order_no') ||
        normalizedTarget.includes('orderNo'))
    );
  }

  private describePrismaError(error: unknown) {
    const code = this.getErrorCode(error) ?? 'unknown';
    const message = error instanceof Error ? error.message : String(error);
    const target =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.meta?.target
        : typeof error === 'object' && error !== null && 'meta' in error
          ? (error as { meta?: { target?: unknown } }).meta?.target
          : undefined;

    return `code=${code}; target=${JSON.stringify(target)}; message=${message}`;
  }

  private getErrorCode(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : undefined;
  }

  private presentOrderDraftRow(draft: OrderDraftRow) {
    return {
      id: Number(draft.id),
      title: draft.title,
      payload: this.parseDraftPayload(draft.payload),
      createdAt: draft.created_at,
      updatedAt: draft.updated_at,
    };
  }

  private parseDraftPayload(payload: Prisma.JsonValue | string) {
    if (typeof payload !== 'string') {
      return payload;
    }

    try {
      return JSON.parse(payload) as Prisma.JsonValue;
    } catch {
      return {};
    }
  }

  private normalizeReceiverInfo(input: {
    customerName: string;
    customerMobile: string;
    receiverName?: string | null;
    receiverMobile?: string | null;
    receiverAddress?: string | null;
    receiverFullAddress?: string | null;
    receiverProvince?: string | null;
    receiverCity?: string | null;
    receiverDistrict?: string | null;
  }) {
    const receiverFullAddress =
      input.receiverFullAddress?.trim() ||
      [
        input.receiverName,
        input.receiverMobile,
        [input.receiverProvince, input.receiverCity, input.receiverDistrict, input.receiverAddress]
          .filter(Boolean)
          .join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .trim();

    if (!receiverFullAddress) {
      throw new BadRequestException('Receiver full address is required');
    }

    const mobileMatch = receiverFullAddress.match(/1\d{10}/);
    const parsedMobile =
      mobileMatch?.[0] || input.receiverMobile?.trim() || input.customerMobile;

    const nameSource = mobileMatch?.index
      ? receiverFullAddress.slice(0, mobileMatch.index)
      : receiverFullAddress;

    const normalizedLeft = nameSource
      .replace(/收货人|收件人|联系人|姓名/g, ' ')
      .replace(/联系电话|联系手机|手机号|手机|电话/g, ' ')
      .replace(/[：:,，;；|]/g, ' ')
      .trim();
    const receiverName =
      input.receiverName?.trim() ||
      normalizedLeft
        .split(/\s+/)
        .filter(Boolean)
        .find((item) => !/^\d+$/.test(item)) ||
      input.customerName ||
      '收件人待确认';

    return {
      receiverName,
      receiverMobile: parsedMobile,
      receiverFullAddress,
    };
  }
}
