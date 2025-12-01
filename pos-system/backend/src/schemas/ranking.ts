import { z } from 'zod';

export const weeklyRankingQuerySchema = z.object({
  weekOffset: z.string().transform(str => parseInt(str)).optional(),
});

export const monthlyRankingQuerySchema = z.object({
  monthOffset: z.string().transform(str => parseInt(str)).optional(),
});

export const customRankingQuerySchema = z.object({
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
});

export const performanceQuerySchema = z.object({
  startDate: z.string().transform(str => new Date(str)).optional(),
  endDate: z.string().transform(str => new Date(str)).optional(),
});

export const productPerformanceQuerySchema = z.object({
  startDate: z.string().transform(str => new Date(str)).optional(),
  endDate: z.string().transform(str => new Date(str)).optional(),
  limit: z.string().transform(str => parseInt(str)).optional(),
});