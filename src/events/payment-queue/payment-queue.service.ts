import { Injectable, Logger } from '@nestjs/common';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { PaymentOrderMessage } from '../payments-queue.interface';

@Injectable()
export class PaymentQueueService {
  private readonly logger = new Logger(PaymentQueueService.name);

  private readonly ROUTING_KEY = 'payment.order';
  private readonly EXCHANGE = 'payments';

  constructor(private readonly rabbitmqService: RabbitmqService) {}

  async publishPaymentOrder(paymentOrder: PaymentOrderMessage): Promise<void> {
    this.logger.log(`Publishing payment order: ${paymentOrder.orderId}`);

    try {
      const enrichementMessage: PaymentOrderMessage = {
        ...paymentOrder,
        createdAt: paymentOrder.createdAt || new Date(),
        metadata: {
          service: 'checkout-service',
          timestamp: new Date().toISOString(),
        },
      };

      await this.rabbitmqService.publishMessage(
        this.EXCHANGE,
        this.ROUTING_KEY,
        enrichementMessage,
      );

      this.logger.log(
        `Payment order details: ${JSON.stringify(enrichementMessage)}`,
      );
    } catch (error) {
      this.logger.error(
        `Error publishing payment order: ${paymentOrder.orderId}`,
        error,
      );
      throw error;
    }
  }

  private validatePaymentOrder(paymentOrder: PaymentOrderMessage): boolean {
    if (!paymentOrder.orderId) {
      this.logger.error('❌ Invalid payment order: missing orderId');

      return false;
    }

    if (!paymentOrder.userId) {
      this.logger.error('❌ Invalid payment order: missing userId');

      return false;
    }

    if (!paymentOrder.amount || paymentOrder.amount <= 0) {
      this.logger.error('❌ Invalid payment order: invalid amount');

      return false;
    }

    if (!paymentOrder.items || paymentOrder.items.length === 0) {
      this.logger.error('❌ Invalid payment order: no items');

      return false;
    }

    return true;
  }

  async publishPaymentOrderSafe(
    paymentOrder: PaymentOrderMessage,
  ): Promise<void> {
    if (!this.validatePaymentOrder(paymentOrder)) {
      throw new Error('Invalid payment order');
    }

    await this.publishPaymentOrder(paymentOrder);
  }
}
