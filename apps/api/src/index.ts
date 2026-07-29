import { createApp } from "./http/app";
import type { ApiBindings } from "./http/context";
import { expireDueReservations } from "./inventory/expiry";

const app = createApp();

export default {
  fetch: app.fetch,
  async scheduled(
    _controller: ScheduledController,
    env: ApiBindings,
    _context: ExecutionContext,
  ): Promise<void> {
    await expireDueReservations(env.DB);
  },
} satisfies ExportedHandler<ApiBindings>;
