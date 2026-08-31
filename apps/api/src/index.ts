import {
  CONTRACT_VERSION,
  HealthResponseSchema,
} from "@contextlines/contracts";
import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (context) => {
  const payload = HealthResponseSchema.parse({
    status: "ok",
    version: CONTRACT_VERSION,
  });

  return context.json(payload);
});

export default app;
