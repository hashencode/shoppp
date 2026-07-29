import { createApp } from "./http/app";
import type { ApiBindings } from "./http/context";
import { expireDueReservations } from "./inventory/expiry";
import {
  consumeNotificationQueue,
  dispatchPendingNotifications,
} from "./automation/queue-consumer";

export { NotificationDeliveryWorkflow } from "./automation/workflows";
export { D1BackupWorkflow } from "./operations/d1-backup";

const app = createApp();

export default {
  fetch: app.fetch,
  async scheduled(
    _controller: ScheduledController,
    env: ApiBindings,
    _context: ExecutionContext,
  ): Promise<void> {
    await expireDueReservations(env.DB);
    if (env.NOTIFICATION_QUEUE) {
      await dispatchPendingNotifications(env.DB, env.NOTIFICATION_QUEUE);
    }
  },
  async queue(
    batch: MessageBatch<unknown>,
    env: ApiBindings,
    _context: ExecutionContext,
  ): Promise<void> {
    await consumeNotificationQueue(batch, env);
  },
} satisfies ExportedHandler<ApiBindings>;
