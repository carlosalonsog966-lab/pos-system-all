import { Request, Response } from 'express';

export class CategoryController {
  static async getCategories(req: Request, res: Response) {
    try {
      // Categorías predefinidas para joyería
      const categories = [
        { 
          id: '1', 
          name: 'Anillos', 
          description: 'Anillos de compromiso y matrimonio', 
          parentId: undefined, 
          isActive: true, 
          productCount: 0, 
          createdAt: new Date().toISOString() 
        },
        { 
          id: '2', 
          name: 'Collares', 
          description: 'Collares y cadenas', 
          parentId: undefined, 
          isActive: true, 
          productCount: 0, 
          createdAt: new Date().toISOString() 
        },
        { 
          id: '3', 
          name: 'Pulseras', 
          description: 'Pulseras y brazaletes', 
          parentId: undefined, 
          isActive: true, 
          productCount: 0, 
          createdAt: new Date().toISOString() 
        },
        { 
          id: '4', 
          name: 'Aretes', 
          description: 'Aretes y pendientes', 
          parentId: undefined, 
          isActive: true, 
          productCount: 0, 
          createdAt: new Date().toISOString() 
        },
        { 
          id: '5', 
          name: 'Relojes', 
          description: 'Relojes de lujo', 
          parentId: undefined, 
          isActive: true, 
          productCount: 0, 
          createdAt: new Date().toISOString() 
        },
        { 
          id: '6', 
          name: 'Otros', 
          description: 'Otros artículos de joyería', 
          parentId: undefined, 
          isActive: true, 
          productCount: 0, 
          createdAt: new Date().toISOString() 
        }
      ];

      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener categorías',
      });
    }
  }

  static async getCategoryById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // Buscar la categoría por ID
      const categories = [
        { id: '1', name: 'Anillos', description: 'Anillos de compromiso y matrimonio' },
        { id: '2', name: 'Collares', description: 'Collares y cadenas' },
        { id: '3', name: 'Pulseras', description: 'Pulseras y brazaletes' },
        { id: '4', name: 'Aretes', description: 'Aretes y pendientes' },
        { id: '5', name: 'Relojes', description: 'Relojes de lujo' },
        { id: '6', name: 'Otros', description: 'Otros artículos de joyería' }
      ];

      const category = categories.find(cat => cat.id === id);

      if (!category) {
        return res.status(404).json({
          success: false,
          error: 'Categoría no encontrada',
        });
      }

      res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener categoría',
      });
    }
  }
}