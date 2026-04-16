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
    this.logger.log(`Publicando ordem de pagamento: ${paymentOrder.orderId}`);

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
        `Detalhes da ordem de pagamento: ${JSON.stringify(enrichementMessage)}`,
      );
    } catch (error) {
      this.logger.error(
        `Erro ao publicar ordem de pagamento: ${paymentOrder.orderId}`,
        error,
      );
      throw error;
    }
  }

  private validatePaymentOrder(paymentOrder: PaymentOrderMessage): boolean {
    if (!paymentOrder.orderId) {
      this.logger.error('❌ Ordem de pagamento inválida: orderId ausente');

      return false;
    }

    if (!paymentOrder.userId) {
      this.logger.error('❌ Ordem de pagamento inválida: userId ausente');

      return false;
    }

    if (!paymentOrder.amount || paymentOrder.amount <= 0) {
      this.logger.error('❌ Ordem de pagamento inválida: valor inválido');

      return false;
    }

    if (!paymentOrder.items || paymentOrder.items.length === 0) {
      this.logger.error('❌ Ordem de pagamento inválida: sem itens');

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
