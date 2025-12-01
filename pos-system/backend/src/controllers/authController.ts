import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { AuthRequest } from '../middleware/auth';
import { LoginInput, RegisterInput, ChangePasswordInput } from '../schemas/auth';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      console.log('🔍 AuthController.login - Datos recibidos:', req.body);
      const data: LoginInput = req.body;
      console.log('🔍 AuthController.login - Datos validados:', data);
      
      const result = await AuthService.login(data);
      console.log('✅ AuthController.login - Login exitoso:', { userId: result.user.id, username: result.user.username });
      
      res.json({
        success: true,
        message: 'Login exitoso',
        data: result,
      });
    } catch (error) {
      console.log('❌ AuthController.login - Error:', error instanceof Error ? error.message : 'Error de autenticación');
      res.status(401).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error de autenticación',
      });
    }
  }

  static async register(req: Request, res: Response) {
    try {
      const data: RegisterInput = req.body;
      const result = await AuthService.register(data);
      
      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al registrar usuario',
      });
    }
  }

  static async changePassword(req: AuthRequest, res: Response) {
    try {
      const data: ChangePasswordInput = req.body;
      const userId = req.user!.id;
      
      const result = await AuthService.changePassword(userId, data);
      
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al cambiar contraseña',
      });
    }
  }

  static async getProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await AuthService.getProfile(userId);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener perfil',
      });
    }
  }

  static async logout(req: AuthRequest, res: Response) {
    // En un sistema JWT stateless, el logout se maneja en el frontend
    // eliminando el token del almacenamiento local
    res.json({
      success: true,
      message: 'Logout exitoso',
    });
  }

  static async refresh(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await AuthService.refresh(userId);
      res.json({
        success: true,
        message: 'Token renovado',
        data: result,
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error instanceof Error ? error.message : 'No se pudo renovar el token',
      });
    }
  }
}
