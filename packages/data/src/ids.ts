import { randomUUID } from "node:crypto";

export const EntityIdPrefix = [
  "doc",
  "job",
  "run",
  "stg",
  "art",
  "led",
  "eval",
  "rev",
  "pb",
  "cmp"
] as const;

export type EntityIdPrefix = (typeof EntityIdPrefix)[number];

export function createEntityId(prefix: EntityIdPrefix, date: Date = new Date()): string {
  const timestamp = date.getTime().toString(36).padStart(10, "0");
  const random = randomUUID().replaceAll("-", "").slice(0, 16);

  return `${prefix}_${timestamp}${random}`;
}
