const path = require('path');
require('dotenv').config();

// Detectar cliente de BD
const dbClient = (process.env.DB_CLIENT || process.env.DB_DIALECT || 'sqlite').toLowerCase();

// Config común
const common = (logging) => ({ logging });

function sqliteConfig(logging) {
  // Usa SQLITE_PATH si es absoluta; si es relativa, se ancla al directorio del backend.
  const defaultSqliteRel = './data/pos_system.db';
  const envSqlite = process.env.SQLITE_PATH || process.env.SQLITE_STORAGE;
  const sqlitePath = envSqlite
    ? (path.isAbsolute(envSqlite) ? envSqlite : path.resolve(__dirname, '../../', envSqlite))
    : path.resolve(__dirname, '../../', defaultSqliteRel);
  return {
    dialect: 'sqlite',
    storage: sqlitePath,
    ...common(logging),
  };
}

function mysqlConfig(logging) {
  return {
    dialect: 'mysql',
    host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
    username: process.env.MYSQL_USER || process.env.DB_USER || 'root',
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASS || '',
    database: process.env.MYSQL_DB || process.env.DB_NAME || 'pos_system',
    ...common(logging),
  };
}

function pgConfig(logging) {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  if (url) {
    return { use_env_variable: 'DATABASE_URL', dialect: 'postgres', ...common(logging) };
  }
  return {
    dialect: 'postgres',
    host: process.env.PGHOST || process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.PGPORT || process.env.POSTGRES_PORT || 5432),
    username: process.env.PGUSER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '',
    database: process.env.PGDATABASE || process.env.POSTGRES_DB || 'pos_system',
    dialectOptions: {
      ssl: (process.env.PGSSLMODE || process.env.POSTGRES_SSLMODE || 'require').toLowerCase() !== 'disable'
        ? { require: true, rejectUnauthorized: false }
        : undefined,
    },
    ...common(logging),
  };
}

function byClient(logging) {
  if (dbClient === 'mysql') return mysqlConfig(logging);
  if (dbClient === 'postgres' || dbClient === 'pg') return pgConfig(logging);
  return sqliteConfig(logging);
}

module.exports = {
  development: byClient(console.log),
  test: sqliteConfig(false),
  production: byClient(false),
};
