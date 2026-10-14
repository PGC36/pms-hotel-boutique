import { type AddPaymentDto, type Payment } from '@/shared/types/entities/payment';
import type { ID } from '@/shared/types/common';
import { guestAccountService } from './guestAccountService';
import { mockUtils, simulateLatency } from './mockUtils';

export const paymentService = {
  async getPaymentsByBookingId(bookingId: ID): Promise<Payment[]> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible cargar los pagos.');
    return guestAccountService.getPaymentsByBookingId(bookingId);
  },
  async addCharge(data: AddPaymentDto): Promise<Payment> {
    await simulateLatency();
    mockUtils.throwIfSimulatingError('No fue posible registrar el pago.');
    return guestAccountService.createPayment(data);
  },
};
export default paymentService;
