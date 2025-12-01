import { z } from 'zod';

// Core value objects
export const PeriodSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

export const GuideSchema = z.object({
  id: z.string(),
  name: z.string(),
  agency: z
    .object({ id: z.string(), name: z.string() })
    .optional(),
});

export const EmployeeSchema = z.object({
  id: z.string(),
  name: z.string(),
  branch: z
    .object({ id: z.string(), name: z.string() })
    .optional(),
});

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().optional().default(''),
  category: z.string().optional().default(''),
});

export const AgencySchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string().optional().default(''),
});

// Rankings entries
export const GuideRankingSchema = z.object({
  id: z.string(),
  guide: GuideSchema,
  totalSales: z.number().nonnegative().default(0),
  totalRevenue: z.number().nonnegative().default(0),
  averageTicket: z.number().nonnegative().default(0),
  totalCommission: z.number().nonnegative().default(0),
  totalPeopleRegistered: z.number().nonnegative().default(0),
  closurePercentage: z.number().min(0).max(100).default(0),
  rank: z.number().int().nonnegative(),
});

export const EmployeeRankingSchema = z.object({
  id: z.string(),
  employee: EmployeeSchema,
  totalSales: z.number().nonnegative().default(0),
  totalRevenue: z.number().nonnegative().default(0),
  averageTicket: z.number().nonnegative().default(0),
  totalCommission: z.number().nonnegative().default(0),
  rank: z.number().int().nonnegative(),
});

export const ProductRankingSchema = z.object({
  id: z.string(),
  product: ProductSchema,
  totalQuantitySold: z.number().nonnegative().default(0),
  totalRevenue: z.number().nonnegative().default(0),
  rank: z.number().int().nonnegative(),
});

export const AgencyRankingSchema = z.object({
  id: z.string(),
  agency: AgencySchema,
  totalSales: z.number().nonnegative().default(0),
  totalRevenue: z.number().nonnegative().default(0),
  averageTicket: z.number().nonnegative().default(0),
  totalCommission: z.number().nonnegative().default(0),
  rank: z.number().int().nonnegative(),
});

export const RankingDataSchema = z.object({
  guides: z.array(GuideRankingSchema).default([]),
  employees: z.array(EmployeeRankingSchema).default([]),
  products: z.array(ProductRankingSchema).default([]),
  agencies: z.array(AgencyRankingSchema).default([]),
  period: PeriodSchema,
  totalSales: z.number().nonnegative().default(0),
  totalRevenue: z.number().nonnegative().default(0),
});

// Sales payloads (simplified normalization contract)
export const SaleResultSchema = z.object({
  id: z.string().optional(),
  total: z.number().nonnegative().default(0),
  status: z.string().optional(),
});

export type RankingDataParsed = z.infer<typeof RankingDataSchema>;
export type SaleResultParsed = z.infer<typeof SaleResultSchema>;

