import { z } from 'zod';

const id = z.string().min(1).max(200);
export const pointDraftSchema = z.strictObject({
  name: z.string().trim().min(1).max(300),
  address: z.string().trim().min(1).max(1000),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  categoryId: id.optional(),
  pendingImportId: id.optional(),
});
export const pointUpdateSchema = pointDraftSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const importSchema = z.strictObject({ url: z.string().url().max(2048) });
export const routePlanSchema = z.strictObject({
  pointIds: z.array(id).min(2).max(100),
  mode: z.enum(['walking', 'driving']),
  roundTrip: z.boolean(),
  optimize: z.boolean().optional(),
  fixedStartId: id.optional(),
  fixedEndId: id.optional(),
});

export async function parseJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T | undefined> {
  try {
    return schema.safeParse(await request.json()).data;
  } catch {
    return undefined;
  }
}
