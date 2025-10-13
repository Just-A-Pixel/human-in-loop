import type { Producer } from "kafkajs";

/**
 * Express Type Augmentation
 * --------------------------
 * By default, Express's `app.locals` and `res.locals` objects are typed as
 * generic `Record<string, any>`, which means TypeScript has no idea what
 * custom properties (like a Kafka producer) we’ve attached to them.
 *
 * This file uses module augmentation to extend the built-in Express
 * `Locals` interface so that `app.locals.producer` and `req.app.locals.producer`
 * are recognized as a fully-typed `Producer` instance from kafkajs.
 *
 * ✅ Benefits:
 * - Removes the need for unsafe `(app as any)` casts.
 * - Enables IDE autocompletion for Kafka producer methods.
 * - Makes dependency injection (via app.locals) type-safe across routes.
 */
declare global {
  namespace Express {
    interface Locals {
      producer: Producer;
    }
  }
}
