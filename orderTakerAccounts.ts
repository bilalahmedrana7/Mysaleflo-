import { OrderTaker } from '../types';
import { store } from './store';
import { api } from './api';

// Order Taker accounts must exist on the SERVER (that is where they log in) and in the dealer's data
// (that is what the dealer sees and what the server uses to check the order taker is allowed to sell).
// The server decides the account's ID; the same ID is then used locally.

interface CreateInput {
  name: string;
  username: string;
  email: string;
  phone: string;
  password?: string;
  active?: boolean;
  locationSharingEnabled?: boolean;
}

export const accounts = {
  async create(dealerId: string, input: CreateInput): Promise<OrderTaker> {
    const res = await api.createOrderTakerAccount({
      name: input.name,
      fullName: input.name,
      username: input.username,
      email: input.email,
      phone: input.phone,
      password: input.password,
      active: input.active,
      status: input.active === false ? 'INACTIVE' : 'ACTIVE',
      locationSharingEnabled: input.locationSharingEnabled,
    });
    const srv = res.orderTaker;
    // Never keep the password in the browser copy
    return store.addOrderTaker(dealerId, {
      id: srv.id,
      employeeCode: srv.employeeCode,
      name: srv.name,
      username: srv.username,
      email: srv.email,
      phone: srv.phone,
      active: srv.active,
      locationSharingEnabled: srv.locationSharingEnabled,
    });
  },

  async update(dealerId: string, id: string, updates: Partial<OrderTaker>): Promise<OrderTaker> {
    await api.updateOrderTakerAccount(id, {
      name: updates.name,
      fullName: updates.name,
      username: updates.username,
      email: updates.email,
      phone: updates.phone,
      password: updates.password,
      active: updates.active,
      status: updates.active === undefined ? undefined : updates.active ? 'ACTIVE' : 'INACTIVE',
      locationSharingEnabled: updates.locationSharingEnabled,
    });
    const { password: _drop, ...local } = updates;
    return store.updateOrderTaker(dealerId, id, local);
  },

  async toggle(dealerId: string, id: string): Promise<OrderTaker> {
    const current = store.getDealerOrderTakers(dealerId).find((o) => o.id === id);
    if (!current) throw new Error('Order Taker not found.');
    await api.updateOrderTakerAccount(id, {
      active: !current.active,
      status: !current.active ? 'ACTIVE' : 'INACTIVE',
    });
    return store.toggleOrderTakerActive(dealerId, id);
  },

  async deactivate(dealerId: string, id: string) {
    await api.updateOrderTakerAccount(id, { active: false, status: 'INACTIVE' });
    return store.deactivateOrderTaker(dealerId, id);
  },

  // The dealer's own records decide if deletion is allowed (sales history blocks it)
  async remove(dealerId: string, id: string) {
    const result = store.deleteOrderTaker(dealerId, id); // throws if the order taker has sales history
    try {
      await api.deleteOrderTakerAccount(id);
    } catch (e) {
      console.warn('Server account removal failed (account may still exist on the server):', e);
    }
    return result;
  },
};
