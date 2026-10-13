const sql = require('mssql');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const dbConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'password123',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'Kiosco_LibresyLocos',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false'
  }
};

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(dbConfig).catch(err => {
      console.error('Error de conexión a SQL Server:', err);
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

const dbQuery = {
  async query(sqlText, params = {}) {
    const pool = await getPool();
    const request = pool.request();
    Object.keys(params).forEach(key => {
      request.input(key, params[key]);
    });
    return await request.query(sqlText);
  },
  async getOne(sqlText, params = {}) {
    const result = await dbQuery.query(sqlText, params);
    return result.recordset[0] || null;
  },
  async getAll(sqlText, params = {}) {
    const result = await dbQuery.query(sqlText, params);
    return result.recordset || [];
  }
};

module.exports = {
  sql,
  getPool,
  dbQuery
};