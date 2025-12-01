import { z } from 'zod';

export const roleEnum = z.enum(['admin', 'manager', 'cashier']);

export const createUserSchema = z.object({
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres'),
  email: z.string().email('Debe ser un email válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role: roleEnum.default('cashier'),
  isActive: z.boolean().optional().default(true),
  avatarUrl: z.string().url().max(255).optional(),
});

export const updateUserSchema = z.object({
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
  avatarUrl: z.string().url().max(255).optional(),
});

export const userQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  role: roleEnum.optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['username', 'email', 'role', 'isActive', 'createdAt', 'lastLogin']).default('username'),
  sortOrder: z.enum(['ASC', 'DESC']).default('ASC'),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
