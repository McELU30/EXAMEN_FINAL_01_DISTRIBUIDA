const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { router: authRouter } = require('./routes/auth');
const reservasRouter = require('./routes/reservas');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Endpoint de prueba para verificar conexión a BD
app.get('/api/test-db', async (req, res) => {
  try {
    const { poolClientes } = require('./db');
    const [rows] = await poolClientes.query('SELECT COUNT(*) as total FROM Usuarios');
    res.json({ 
      success: true, 
      message: 'Conexión a BD exitosa',
      usuarios_encontrados: rows[0].total 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Error al conectar con la base de datos. Verifica tu configuración.'
    });
  }
});

// Rutas básicas para probar
app.get('/', (req, res) => {
  // Redirigir a login como página principal
  res.redirect('/login.html');
});

// Rutas de autenticación y dashboard
app.use('/api/auth', authRouter);

// Rutas de reservas
app.use('/api/reservas', reservasRouter);

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});


