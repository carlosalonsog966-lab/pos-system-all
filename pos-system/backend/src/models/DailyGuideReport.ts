import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/config';

interface DailyGuideReportAttributes {
  id: string;
  guideId: string;
  date: Date;
  totalPeople: number; // Cantidad total de personas que trajo el guía
  totalSales: number; // Total de ventas generadas
  totalSalesCount: number; // Número de ventas realizadas
  closingPercentage?: number; // % de cierre calculado
  averageTicket?: number; // Ticket promedio calculado
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface DailyGuideReportCreationAttributes extends Optional<DailyGuideReportAttributes, 'id' | 'totalSales' | 'totalSalesCount' | 'closingPercentage' | 'averageTicket' | 'notes' | 'createdAt' | 'updatedAt'> {}

class DailyGuideReport extends Model<DailyGuideReportAttributes, DailyGuideReportCreationAttributes> implements DailyGuideReportAttributes {
  public id!: string;
  public guideId!: string;
  public date!: Date;
  public totalPeople!: number;
  public totalSales!: number;
  public totalSalesCount!: number;
  public closingPercentage?: number;
  public averageTicket?: number;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public Guide?: any;

  // Instance methods
  public calculateMetrics(): void {
    if (this.totalPeople > 0 && this.totalSalesCount > 0) {
      // % de cierre = (personas que compraron / total personas) * 100
      this.closingPercentage = (this.totalSalesCount / this.totalPeople) * 100;
      
      // Ticket promedio = total ventas / personas que compraron
      this.averageTicket = this.totalSales / this.totalSalesCount;
    } else {
      this.closingPercentage = 0;
      this.averageTicket = 0;
    }
  }

  public updateSalesData(totalSales: number, salesCount: number): void {
    this.totalSales = totalSales;
    this.totalSalesCount = salesCount;
    this.calculateMetrics();
  }
}

DailyGuideReport.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    guideId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'guides',
        key: 'id',
      },
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    totalPeople: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
      },
      comment: 'Cantidad total de personas que trajo el guía',
    },
    totalSales: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
      comment: 'Total de ventas generadas por el guía',
    },
    totalSalesCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
      comment: 'Número de ventas realizadas',
    },
    closingPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 100,
      },
      comment: 'Porcentaje de cierre calculado',
    },
    averageTicket: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
      comment: 'Ticket promedio calculado',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'DailyGuideReport',
    tableName: 'daily_guide_reports',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['guideId', 'date'],
        name: 'unique_guide_date',
      },
      {
        fields: ['date'],
      },
      {
        fields: ['guideId'],
      },
    ],
  }
);

export default DailyGuideReport;