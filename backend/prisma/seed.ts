import {
  OrderStatus,
  PrismaClient,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { hashPassword } from '../src/common/utils/password.util';
import { hashPublicToken } from '../src/common/utils/public-token.util';

const prisma = new PrismaClient();

type SeedUser = {
  username: string;
  displayName: string;
  mobile: string;
  role: UserRole;
  password: string;
};

type SeedCustomer = {
  name: string;
  mobile: string;
  wechatNickname: string;
  receiverName: string;
  receiverMobile: string;
  receiverProvince: string;
  receiverCity: string;
  receiverDistrict: string;
  receiverAddress: string;
  note?: string;
  lastOrderAt: Date;
};

type SeedOrder = {
  orderNo: string;
  customerMobile: string;
  createdByUsername: string;
  status: OrderStatus;
  clientToken: string;
  receiverName: string;
  receiverMobile: string;
  receiverProvince: string;
  receiverCity: string;
  receiverDistrict: string;
  receiverAddress: string;
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  payableAmount: number;
  operatorRemark?: string;
  warehouseRemark?: string | null;
  courierCompany?: string | null;
  trackingNo?: string | null;
  shippedAt?: Date | null;
  createdAt: Date;
  items: Array<{
    productName: string;
    productSpec: string;
    quantity: number;
    unitPrice: number;
    lineAmount: number;
    remark?: string;
  }>;
};

function dateOffset(days: number, hour: number, minute: number) {
  const base = new Date();
  base.setDate(base.getDate() + days);
  base.setHours(hour, minute, 0, 0);
  return base;
}

function formatDateCode(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createOrderNo(date: Date, sequence: number) {
  return `ZN${formatDateCode(date)}${String(sequence).padStart(3, '0')}`;
}

async function upsertUser(user: SeedUser) {
  const passwordHash = await hashPassword(user.password);

  return prisma.user.upsert({
    where: { username: user.username },
    update: {
      displayName: user.displayName,
      mobile: user.mobile,
      passwordHash,
      role: user.role,
      status: UserStatus.active,
    },
    create: {
      username: user.username,
      displayName: user.displayName,
      mobile: user.mobile,
      passwordHash,
      role: user.role,
      status: UserStatus.active,
    },
  });
}

async function upsertCustomer(customer: SeedCustomer) {
  return prisma.customer.upsert({
    where: { mobile: customer.mobile },
    update: {
      name: customer.name,
      wechatNickname: customer.wechatNickname,
      receiverName: customer.receiverName,
      receiverMobile: customer.receiverMobile,
      receiverProvince: customer.receiverProvince,
      receiverCity: customer.receiverCity,
      receiverDistrict: customer.receiverDistrict,
      receiverAddress: customer.receiverAddress,
      note: customer.note,
      lastOrderAt: customer.lastOrderAt,
    },
    create: customer,
  });
}

async function upsertOrder(order: SeedOrder) {
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { mobile: order.customerMobile },
  });
  const createdBy = await prisma.user.findUniqueOrThrow({
    where: { username: order.createdByUsername },
  });

  const savedOrder = await prisma.order.upsert({
    where: { orderNo: order.orderNo },
    update: {
      customerId: customer.id,
      createdById: createdBy.id,
      status: order.status,
      clientTokenHash: hashPublicToken(order.clientToken),
      clientLinkPath: `/client/orders/${order.orderNo}`,
      receiverName: order.receiverName,
      receiverMobile: order.receiverMobile,
      receiverProvince: order.receiverProvince,
      receiverCity: order.receiverCity,
      receiverDistrict: order.receiverDistrict,
      receiverAddress: order.receiverAddress,
      totalAmount: order.totalAmount,
      shippingFee: order.shippingFee,
      discountAmount: order.discountAmount,
      payableAmount: order.payableAmount,
      operatorRemark: order.operatorRemark,
      warehouseRemark: order.warehouseRemark,
      courierCompany: order.courierCompany,
      trackingNo: order.trackingNo,
      shippedAt: order.shippedAt,
    },
    create: {
      orderNo: order.orderNo,
      customerId: customer.id,
      createdById: createdBy.id,
      status: order.status,
      clientTokenHash: hashPublicToken(order.clientToken),
      clientLinkPath: `/client/orders/${order.orderNo}`,
      receiverName: order.receiverName,
      receiverMobile: order.receiverMobile,
      receiverProvince: order.receiverProvince,
      receiverCity: order.receiverCity,
      receiverDistrict: order.receiverDistrict,
      receiverAddress: order.receiverAddress,
      totalAmount: order.totalAmount,
      shippingFee: order.shippingFee,
      discountAmount: order.discountAmount,
      payableAmount: order.payableAmount,
      operatorRemark: order.operatorRemark,
      warehouseRemark: order.warehouseRemark,
      courierCompany: order.courierCompany,
      trackingNo: order.trackingNo,
      shippedAt: order.shippedAt,
      createdAt: order.createdAt,
    },
  });

  await prisma.orderItem.deleteMany({
    where: { orderId: savedOrder.id },
  });

  await prisma.orderItem.createMany({
    data: order.items.map((item) => ({
      orderId: savedOrder.id,
      productName: item.productName,
      productSpec: item.productSpec,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineAmount: item.lineAmount,
      remark: item.remark,
      createdAt: order.createdAt,
    })),
  });

  await prisma.orderStatusLog.deleteMany({
    where: { orderId: savedOrder.id },
  });

  await prisma.orderStatusLog.create({
    data: {
      orderId: savedOrder.id,
      fromStatus: null,
      toStatus: OrderStatus.pending_shipment,
      action: 'seed_create_order',
      operatorId: createdBy.id,
      note: 'Seeded sample order',
      createdAt: order.createdAt,
    },
  });

  if (order.status === OrderStatus.shipped) {
    await prisma.orderStatusLog.create({
      data: {
        orderId: savedOrder.id,
        fromStatus: OrderStatus.pending_shipment,
        toStatus: OrderStatus.shipped,
        action: 'seed_ship_order',
        operatorId: createdBy.id,
        note: 'Seeded shipped order',
        createdAt: order.shippedAt ?? order.createdAt,
      },
    });
  }

  if (order.status === OrderStatus.cancelled) {
    await prisma.orderStatusLog.create({
      data: {
        orderId: savedOrder.id,
        fromStatus: OrderStatus.pending_shipment,
        toStatus: OrderStatus.cancelled,
        action: 'seed_cancel_order',
        operatorId: createdBy.id,
        note: 'Seeded cancelled order',
        createdAt: order.createdAt,
      },
    });
  }

  return savedOrder;
}

async function syncOrderSequences(orders: SeedOrder[]) {
  const map = new Map<string, number>();

  for (const order of orders) {
    const dateKey = formatDateKey(order.createdAt);
    const sequence = Number(order.orderNo.slice(-3));
    map.set(dateKey, Math.max(map.get(dateKey) ?? 0, sequence));
  }

  for (const [dateKey, currentValue] of map.entries()) {
    const likePrefix = `ZN${dateKey.replaceAll('-', '')}%`;
    const rows = await prisma.$queryRawUnsafe<Array<{ max_value: number | null }>>(
      `
      SELECT MAX(CAST(SUBSTRING(order_no, 11) AS UNSIGNED)) AS max_value
      FROM orders
      WHERE order_no LIKE ?
      `,
      likePrefix,
    );
    const existingMaxValue = rows[0]?.max_value ?? 0;
    const nextCurrentValue = Math.max(currentValue, existingMaxValue);

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO order_sequences (biz_date, current_value, updated_at)
      VALUES (?, ?, NOW(3))
      ON DUPLICATE KEY UPDATE
        current_value = GREATEST(current_value, VALUES(current_value)),
        updated_at = NOW(3)
      `,
      dateKey,
      nextCurrentValue,
    );
  }
}

async function main() {
  const todayA = dateOffset(0, 9, 15);
  const todayB = dateOffset(0, 13, 40);
  const yesterday = dateOffset(-1, 17, 30);
  const twoDaysAgo = dateOffset(-2, 11, 5);

  const users: SeedUser[] = [
    {
      username: 'operator',
      displayName: '运营账号',
      mobile: '13800000001',
      role: UserRole.operator,
      password: 'Operator@123',
    },
    {
      username: 'warehouse',
      displayName: '仓库账号',
      mobile: '13800000002',
      role: UserRole.warehouse,
      password: 'Warehouse@123',
    },
    {
      username: 'superadmin',
      displayName: '超级管理员',
      mobile: '13800000003',
      role: UserRole.super_admin,
      password: 'SuperAdmin@123',
    },
  ];

  const customers: SeedCustomer[] = [
    {
      name: '李小姐',
      mobile: '13811112222',
      wechatNickname: 'lili_style',
      receiverName: '李小姐',
      receiverMobile: '13811112222',
      receiverProvince: '广东省',
      receiverCity: '深圳市',
      receiverDistrict: '南山区',
      receiverAddress: '科技园科苑路 88 号 1201',
      note: '偏好浅色款，沟通响应快',
      lastOrderAt: todayB,
    },
    {
      name: '王女士',
      mobile: '13933334444',
      wechatNickname: 'wang_home',
      receiverName: '王女士',
      receiverMobile: '13933334444',
      receiverProvince: '浙江省',
      receiverCity: '杭州市',
      receiverDistrict: '西湖区',
      receiverAddress: '文三路 208 号 6 栋 702',
      note: '复购客户，地址稳定',
      lastOrderAt: yesterday,
    },
    {
      name: '陈先生',
      mobile: '13755556666',
      wechatNickname: 'chen_daily',
      receiverName: '陈先生',
      receiverMobile: '13755556666',
      receiverProvince: '江苏省',
      receiverCity: '苏州市',
      receiverDistrict: '工业园区',
      receiverAddress: '星湖街 168 号 3 单元 1602',
      note: '下单前会确认尺码',
      lastOrderAt: twoDaysAgo,
    },
  ];

  const orders: SeedOrder[] = [
    {
      orderNo: createOrderNo(todayA, 1),
      customerMobile: '13811112222',
      createdByUsername: 'operator',
      status: OrderStatus.pending_shipment,
      clientToken: 'demo-token-a001',
      receiverName: '李小姐',
      receiverMobile: '13811112222',
      receiverProvince: '广东省',
      receiverCity: '深圳市',
      receiverDistrict: '南山区',
      receiverAddress: '科技园科苑路 88 号 1201',
      totalAmount: 399,
      shippingFee: 12,
      discountAmount: 20,
      payableAmount: 391,
      operatorRemark:
        '【客户备注】喜欢宽松版型\n【内部备注】老客户，优先安排\n【仓库备注】发货前复核颜色',
      warehouseRemark: null,
      createdAt: todayA,
      items: [
        {
          productName: '针织开衫',
          productSpec: '款号:KS-2026-01 | 颜色:米白 | 尺码:M',
          quantity: 1,
          unitPrice: 399,
          lineAmount: 399,
        },
      ],
    },
    {
      orderNo: createOrderNo(todayB, 2),
      customerMobile: '13811112222',
      createdByUsername: 'operator',
      status: OrderStatus.shipped,
      clientToken: 'demo-token-a002',
      receiverName: '李小姐',
      receiverMobile: '13811112222',
      receiverProvince: '广东省',
      receiverCity: '深圳市',
      receiverDistrict: '南山区',
      receiverAddress: '科技园科苑路 88 号 1201',
      totalAmount: 268,
      shippingFee: 10,
      discountAmount: 8,
      payableAmount: 270,
      operatorRemark:
        '【客户备注】搭配日常通勤\n【内部备注】同地址复购\n【仓库备注】外箱贴易碎',
      warehouseRemark: '外箱已加固',
      courierCompany: '顺丰速运',
      trackingNo: 'SF1234567890',
      shippedAt: dateOffset(0, 16, 10),
      createdAt: todayB,
      items: [
        {
          productName: '雪纺衬衫',
          productSpec: '款号:CF-2026-07 | 颜色:天蓝 | 尺码:S',
          quantity: 1,
          unitPrice: 168,
          lineAmount: 168,
        },
        {
          productName: '半身裙',
          productSpec: '款号:QZ-2026-12 | 颜色:灰蓝 | 尺码:M',
          quantity: 1,
          unitPrice: 100,
          lineAmount: 100,
        },
      ],
    },
    {
      orderNo: createOrderNo(yesterday, 1),
      customerMobile: '13933334444',
      createdByUsername: 'operator',
      status: OrderStatus.cancelled,
      clientToken: 'demo-token-b001',
      receiverName: '王女士',
      receiverMobile: '13933334444',
      receiverProvince: '浙江省',
      receiverCity: '杭州市',
      receiverDistrict: '西湖区',
      receiverAddress: '文三路 208 号 6 栋 702',
      totalAmount: 520,
      shippingFee: 0,
      discountAmount: 20,
      payableAmount: 500,
      operatorRemark:
        '【客户备注】修改收货时间\n【内部备注】客户临时取消\n【仓库备注】无需备货',
      warehouseRemark: null,
      createdAt: yesterday,
      items: [
        {
          productName: '羊毛大衣',
          productSpec: '款号:DY-2026-20 | 颜色:驼色 | 尺码:L',
          quantity: 1,
          unitPrice: 520,
          lineAmount: 520,
        },
      ],
    },
    {
      orderNo: createOrderNo(twoDaysAgo, 1),
      customerMobile: '13755556666',
      createdByUsername: 'operator',
      status: OrderStatus.pending_shipment,
      clientToken: 'demo-token-c001',
      receiverName: '陈先生',
      receiverMobile: '13755556666',
      receiverProvince: '江苏省',
      receiverCity: '苏州市',
      receiverDistrict: '工业园区',
      receiverAddress: '星湖街 168 号 3 单元 1602',
      totalAmount: 188,
      shippingFee: 8,
      discountAmount: 0,
      payableAmount: 196,
      operatorRemark:
        '【客户备注】确认深色优先\n【内部备注】首次下单\n【仓库备注】核对尺码再发',
      warehouseRemark: null,
      createdAt: twoDaysAgo,
      items: [
        {
          productName: '休闲卫衣',
          productSpec: '款号:WY-2026-03 | 颜色:深灰 | 尺码:XL',
          quantity: 1,
          unitPrice: 188,
          lineAmount: 188,
        },
      ],
    },
  ];

  for (const user of users) {
    await upsertUser(user);
  }

  for (const customer of customers) {
    await upsertCustomer(customer);
  }

  for (const order of orders) {
    await upsertOrder(order);
  }

  await syncOrderSequences(orders);

  console.log('Seed completed.');
  console.log('Default users:');
  console.log('  operator / Operator@123');
  console.log('  warehouse / Warehouse@123');
  console.log('  superadmin / SuperAdmin@123');
  console.log('Demo public links:');
  orders.forEach((order) => {
    console.log(`  ${order.orderNo} -> token: ${order.clientToken}`);
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
