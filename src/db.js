const mysql = require('mysql2/promise');
require('dotenv').config();

// Conexión a Barberia_Clientes
const poolClientes = mysql.createPool({
  host: process.env.DB_CLIENTES_HOST || 'localhost',
  user: process.env.DB_CLIENTES_USER || 'root',
  password: process.env.DB_CLIENTES_PASSWORD || '',
  database: process.env.DB_CLIENTES_NAME || 'Barberia_Clientes',
  waitForConnections: true,
  connectionLimit: 10,
});

// Conexión a Barberia_Reservas
const poolReservas = mysql.createPool({
  host: process.env.DB_RESERVAS_HOST || 'localhost',
  user: process.env.DB_RESERVAS_USER || 'root',
  password: process.env.DB_RESERVAS_PASSWORD || '',
  database: process.env.DB_RESERVAS_NAME || 'Barberia_Reservas',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = { poolClientes, poolReservas };


