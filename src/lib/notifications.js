/** Where a clicked notification should take the reader, or null when there is nowhere sensible to go. */
export const notificationTarget = (type, data) => {
  switch (type) {
    case 'order_paid':
    case 'order_shipped':
    case 'order_refunded':
      return data?.orderId ? `/orders/${data.orderId}` : '/orders';
    case 'order_new':
    case 'order_received':
    case 'ship_reminder':
      return '/dashboard/orders';
    case 'instagram_reconnect':
      return '/dashboard/settings';
    default:
      return null;
  }
};
