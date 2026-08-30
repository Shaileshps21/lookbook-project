import type { SchemaOptions } from "mongoose";

/**
 * Shared `toJSON`/`toObject` behavior for all models: expose a clean `id`
 * string instead of `_id`, and drop internal fields like `__v` and any
 * sensitive `password` field, so API responses map 1:1 onto the frontend's
 * TypeScript types (which use `id: string`).
 */
export const baseSchemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret._id;
      delete ret.password;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
  },
} satisfies SchemaOptions;
