console.log('=== LOADING DB CONFIG ===');
import { Sequelize } from 'sequelize';
import * as dotenv from 'dotenv';
import * as path from 'path';

console.log('=== DOTENV CONFIG ===');
dotenv.config();

const dbClient = (process.env.DB_CLIENT || process.env.DB_DIALECT || 'sqlite').toLowerCase();
console.log('DB Client:', dbClient);

let sequelize: Sequelize;

if (dbClient === 'postgres' || dbClient === 'pg') {
  // Configuración Postgres/Neon
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  const hasUrl = !!url;

  const host = process.env.PGHOST || process.env.POSTGRES_HOST || '';
  const database = process.env.PGDATABASE || process.env.POSTGRES_DB || '';
  const username = process.env.PGUSER || process.env.POSTGRES_USER || '';
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '';
  const portRaw = process.env.PGPORT || process.env.POSTGRES_PORT || '';
  const port = portRaw ? Number(portRaw) : undefined;
  const sslmode = (process.env.PGSSLMODE || process.env.POSTGRES_SSLMODE || 'require').toLowerCase();
  const requireSsl = sslmode !== 'disable';

  console.log('Creating Sequelize instance with Postgres/Neon...');
  if (hasUrl) {
    sequelize = new Sequelize(url, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: requireSsl ? { require: true, rejectUnauthorized: false } : undefined,
      },
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
    });
  } else {
    sequelize = new Sequelize(database, username, password, {
      host,
      port,
      dialect: 'postgres',
      dialectOptions: {
        ssl: requireSsl ? { require: true, rejectUnauthorized: false } : undefined,
      },
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
    });
  }
} else if (dbClient === 'mysql') {
  // Configuración MySQL
  const host = process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost';
  const database = process.env.MYSQL_DB || process.env.DB_NAME || 'pos_system';
  const username = process.env.MYSQL_USER || process.env.DB_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || process.env.DB_PASS || '';
  const portRaw = process.env.MYSQL_PORT || process.env.DB_PORT || '3306';
  const port = portRaw ? Number(portRaw) : 3306;

  console.log('Creating Sequelize instance with MySQL...');
  sequelize = new Sequelize(database, username, password, {
    host,
    port,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      // Permitir conexiones locales sin SSL; si se requiere, usar variables de entorno
    }
  });
} else {
  // Configuración SQLite por defecto
  const defaultSqliteRel = './data/pos_system.db';
  const envSqlite = process.env.SQLITE_PATH;
  // Resolver ruta: si es absoluta, usarla; si es relativa, anclar al directorio del backend
  const sqlitePath = envSqlite
    ? (path.isAbsolute(envSqlite) ? envSqlite : path.resolve(__dirname, '../../', envSqlite))
    : path.resolve(__dirname, '../../', defaultSqliteRel);

  console.log('Creating Sequelize instance with SQLite...');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: sqlitePath,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  });
}

console.log('Sequelize instance created:', !!sequelize);
console.log('Sequelize authenticate method:', typeof (sequelize as any).authenticate);

export { sequelize };
export default sequelize;
