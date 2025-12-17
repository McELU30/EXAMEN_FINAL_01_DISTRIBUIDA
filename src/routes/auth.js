const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { poolClientes } = require('../db');

const router = express.Router();

// Middleware para proteger rutas con token de sesión
async function authMiddleware(req, res, next) {
  try {
    const token = req.headers['x-auth-token'];
    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }

    const [rows] = await poolClientes.query(
      'SELECT id, nombre, email, telefono FROM Usuarios WHERE token_sesion = ?',
      [token]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    req.usuario = rows[0];
    next();
  } catch (error) {
    console.error('Error en authMiddleware:', error);
    res.status(500).json({ error: 'Error interno de autenticación' });
  }
}

// Middleware para verificar administrador usando email (sin cambiar la BD)
function adminMiddleware(req, res, next) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@barberia.com';
  if (req.usuario && req.usuario.email === adminEmail) {
    return next();
  }
  return res.status(403).json({ error: 'Acceso solo para administrador' });
}

// ============================================
// ENDPOINTS PÚBLICOS
// ============================================

// Registro de usuario (rol implícito: usuario normal)
router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password, telefono } = req.body;

    if (!nombre || !email || !password) {
      return res
        .status(400)
        .json({ error: 'nombre, email y password son obligatorios' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await poolClientes.query(
      'INSERT INTO Usuarios (nombre, email, password_hash, telefono) VALUES (?, ?, ?, ?)',
      [nombre, email, passwordHash, telefono || null]
    );

    res.status(201).json({ message: 'Usuario registrado', id: result.insertId });
  } catch (error) {
    console.error('Error en /register:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Login de usuario
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email y password son obligatorios' });
    }

    const [rows] = await poolClientes.query(
      'SELECT id, nombre, email, password_hash FROM Usuarios WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const usuario = rows[0];
    const esValido = await bcrypt.compare(password, usuario.password_hash);
    if (!esValido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token de sesión simple (puede ser UUID/hex aleatorio)
    const token = crypto.randomBytes(32).toString('hex');

    await poolClientes.query('UPDATE Usuarios SET token_sesion = ? WHERE id = ?', [
      token,
      usuario.id,
    ]);

    res.json({
      message: 'Login exitoso',
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email },
    });
  } catch (error) {
    console.error('Error en /login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Dashboard básico protegido
router.get('/dashboard', authMiddleware, async (req, res) => {
  // Aquí podrías agregar estadísticas o datos adicionales
  res.json({
    message: 'Bienvenido al dashboard',
    usuario: req.usuario,
  });
});

// ============================================
// ENDPOINTS DE ADMINISTRACIÓN DE USUARIOS
// ============================================

// Listar todos los usuarios (admin)
router.get('/admin/usuarios', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await poolClientes.query(
      'SELECT id, nombre, email, telefono, fecha_registro FROM Usuarios ORDER BY fecha_registro DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error en GET /admin/usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Crear nuevo usuario (admin)
router.post('/admin/usuarios', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { nombre, email, password, telefono } = req.body;

    if (!nombre || !email || !password) {
      return res
        .status(400)
        .json({ error: 'nombre, email y password son obligatorios' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await poolClientes.query(
      'INSERT INTO Usuarios (nombre, email, password_hash, telefono) VALUES (?, ?, ?, ?)',
      [nombre, email, passwordHash, telefono || null]
    );

    res.status(201).json({ 
      message: 'Usuario creado correctamente', 
      id: result.insertId 
    });
  } catch (error) {
    console.error('Error en POST /admin/usuarios:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// Actualizar usuario (admin)
router.put('/admin/usuarios/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, password, telefono } = req.body;

    const campos = [];
    const valores = [];

    if (nombre) {
      campos.push('nombre = ?');
      valores.push(nombre);
    }
    if (email) {
      campos.push('email = ?');
      valores.push(email);
    }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      campos.push('password_hash = ?');
      valores.push(passwordHash);
    }
    if (telefono !== undefined) {
      campos.push('telefono = ?');
      valores.push(telefono || null);
    }

    if (campos.length === 0) {
      return res.status(400).json({ error: 'Debes enviar al menos un campo para actualizar' });
    }

    valores.push(id);

    await poolClientes.query(
      `UPDATE Usuarios SET ${campos.join(', ')} WHERE id = ?`,
      valores
    );

    res.json({ message: 'Usuario actualizado correctamente' });
  } catch (error) {
    console.error('Error en PUT /admin/usuarios/:id:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// Eliminar usuario (admin)
router.delete('/admin/usuarios/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await poolClientes.query('DELETE FROM Usuarios WHERE id = ?', [id]);

    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error en DELETE /admin/usuarios/:id:', error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = { router, authMiddleware, adminMiddleware };
