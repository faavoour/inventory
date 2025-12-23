import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => ({
    nameUnique: uniqueIndex("payment_methods_name_unique").on(t.name),
  })
);
