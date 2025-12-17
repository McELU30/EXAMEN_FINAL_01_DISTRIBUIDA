const express = require('express');
const { poolReservas } = require('../db');
const { authMiddleware, adminMiddleware } = require('./auth');

const router = express.Router();

// Simulación de generación asíncrona de PDF
function simularGeneracionPDF(codigoAtencion) {
  (async () => {
    try {
      // Marcar como GENERANDO
      await poolReservas.query(
        'UPDATE Reservas SET estado_pdf = ? WHERE codigo_atencion = ?',
        ['GENERANDO', codigoAtencion]
      );

      // Simula tarea pesada de 3 segundos (generar PDF)
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Marcar como LISTO
      await poolReservas.query(
        'UPDATE Reservas SET estado_pdf = ? WHERE codigo_atencion = ?',
        ['LISTO', codigoAtencion]
      );

      console.log(
        `PDF generado (simulado) para la reserva con código: ${codigoAtencion}`
      );
    } catch (error) {
      console.error(
        'Error durante la simulación de generación de PDF para',
        codigoAtencion,
        error
      );
    }
  })();
}

// Listar disponibilidad (slots)
router.get('/disponibilidad', async (req, res) => {
  try {
    const [rows] = await poolReservas.query(
      'SELECT id, fecha_hora, cupos_totales, cupos_reservados FROM Disponibilidad ORDER BY fecha_hora ASC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error en GET /disponibilidad:', error);
    res.status(500).json({ error: 'Error al obtener disponibilidad' });
  }
});

// Crear reserva con control de concurrencia
router.post('/reservar', authMiddleware, async (req, res) => {
  const connection = await poolReservas.getConnection();
  try {
    const { id_disponibilidad, id_barbero } = req.body;
    const id_usuario = req.usuario.id; // viene del servicio de clientes/login

    if (!id_disponibilidad || !id_barbero) {
      connection.release();
      return res
        .status(400)
        .json({ error: 'id_disponibilidad e id_barbero son obligatorios' });
    }

    // Iniciar transacción para simular el "Lock"
    await connection.beginTransaction();

    // Bloquear la fila de disponibilidad mientras se verifica/actualiza
    const [dispRows] = await connection.query(
      'SELECT * FROM Disponibilidad WHERE id = ? FOR UPDATE',
      [id_disponibilidad]
    );

    if (dispRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Slot de disponibilidad no encontrado' });
    }

    const disponibilidad = dispRows[0];
    const cuposDisponibles =
      disponibilidad.cupos_totales - disponibilidad.cupos_reservados;

    if (cuposDisponibles <= 0) {
      await connection.rollback();
      connection.release();
      return res
        .status(409)
        .json({ error: 'No hay cupos disponibles para este horario' });
    }

    // Actualizar cupos_reservados (+1)
    await connection.query(
      'UPDATE Disponibilidad SET cupos_reservados = cupos_reservados + 1 WHERE id = ?',
      [id_disponibilidad]
    );

    // Generar un código de atención simple
    const codigoAtencion = `COD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Crear la reserva, estado_pdf inicialmente PENDIENTE
    await connection.query(
      'INSERT INTO Reservas (id_usuario, id_barbero, fecha_hora_cita, codigo_atencion, estado_pdf) VALUES (?, ?, ?, ?, ?)',
      [
        id_usuario,
        id_barbero,
        disponibilidad.fecha_hora,
        codigoAtencion,
        'PENDIENTE',
      ]
    );

    // Confirmar la transacción
    await connection.commit();
    connection.release();

    // Lanzar la generación asíncrona del PDF (no bloquea la respuesta)
    simularGeneracionPDF(codigoAtencion);

    res.status(201).json({
      message:
        'Reserva creada correctamente. La ficha PDF se está generando en segundo plano.',
      codigo_atencion: codigoAtencion,
    });
  } catch (error) {
    console.error('Error en POST /reservar:', error);
    await connection.rollback();
    connection.release();
    res.status(500).json({ error: 'Error al crear la reserva' });
  }
});

// Consultar estado del PDF por código de atención
router.get('/estado-pdf/:codigo', authMiddleware, async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await poolReservas.query(
      'SELECT codigo_atencion, estado_pdf FROM Reservas WHERE codigo_atencion = ?',
      [codigo]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error en GET /estado-pdf/:codigo', error);
    res.status(500).json({ error: 'Error al consultar el estado del PDF' });
  }
});

// Listar reservas del usuario actual (no requiere admin)
router.get('/mis-reservas', authMiddleware, async (req, res) => {
  try {
    const id_usuario = req.usuario.id;
    const [rows] = await poolReservas.query(
      `SELECT r.id, r.id_usuario, r.id_barbero, r.fecha_hora_cita, r.codigo_atencion, r.estado_pdf,
              b.nombre as nombre_barbero, b.especialidad
       FROM Reservas r
       LEFT JOIN Barberos b ON r.id_barbero = b.id
       WHERE r.id_usuario = ?
       ORDER BY r.fecha_hora_cita DESC`,
      [id_usuario]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error en GET /mis-reservas:', error);
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
});

// Listar reservas por barbero (vista del barbero)
router.get('/por-barbero/:idBarbero', authMiddleware, async (req, res) => {
  try {
    const { idBarbero } = req.params;
    const [rows] = await poolReservas.query(
      'SELECT id, id_usuario, id_barbero, fecha_hora_cita, codigo_atencion, estado_pdf FROM Reservas WHERE id_barbero = ? ORDER BY fecha_hora_cita DESC',
      [idBarbero]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error en GET /por-barbero/:idBarbero', error);
    res.status(500).json({ error: 'Error al obtener reservas del barbero' });
  }
});

// Listar todos los barberos (para que el usuario elija)
router.get('/barberos', async (req, res) => {
  try {
    const [rows] = await poolReservas.query(
      'SELECT id, nombre, especialidad FROM Barberos ORDER BY nombre ASC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error en GET /barberos', error);
    res.status(500).json({ error: 'Error al obtener barberos' });
  }
});

// ------------------- Endpoints de ADMIN para CRUD de reservas -------------------

// Listar todas las reservas (admin) con nombres
router.get('/admin', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await poolReservas.query(
      `SELECT r.id, r.id_usuario, r.id_barbero, r.fecha_hora_cita, r.codigo_atencion, r.estado_pdf,
              b.nombre as nombre_barbero, b.especialidad
       FROM Reservas r
       LEFT JOIN Barberos b ON r.id_barbero = b.id
       ORDER BY r.fecha_hora_cita DESC`
    );
    
    // Obtener nombres de usuarios desde la otra base
    const { poolClientes } = require('../db');
    const reservasConNombres = await Promise.all(
      rows.map(async (r) => {
        try {
          const [usuarios] = await poolClientes.query(
            'SELECT nombre, email FROM Usuarios WHERE id = ?',
            [r.id_usuario]
          );
          return {
            ...r,
            nombre_cliente: usuarios[0]?.nombre || `Usuario ${r.id_usuario}`,
            email_cliente: usuarios[0]?.email || '',
          };
        } catch (err) {
          return {
            ...r,
            nombre_cliente: `Usuario ${r.id_usuario}`,
            email_cliente: '',
          };
        }
      })
    );
    
    res.json(reservasConNombres);
  } catch (error) {
    console.error('Error en GET /admin', error);
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
});

// Actualizar datos básicos de una reserva (admin)
router.put('/admin/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { id_barbero, fecha_hora_cita } = req.body;

    if (!id_barbero && !fecha_hora_cita) {
      return res
        .status(400)
        .json({ error: 'Debe enviar al menos un campo para actualizar' });
    }

    const campos = [];
    const valores = [];
    if (id_barbero) {
      campos.push('id_barbero = ?');
      valores.push(id_barbero);
    }
    if (fecha_hora_cita) {
      campos.push('fecha_hora_cita = ?');
      valores.push(fecha_hora_cita);
    }
    valores.push(id);

    await poolReservas.query(
      `UPDATE Reservas SET ${campos.join(', ')} WHERE id = ?`,
      valores
    );

    res.json({ message: 'Reserva actualizada correctamente' });
  } catch (error) {
    console.error('Error en PUT /admin/:id', error);
    res.status(500).json({ error: 'Error al actualizar la reserva' });
  }
});

// Eliminar reserva (admin) - se ajusta cupos_reservados si hay disponibilidad asociada
router.delete(
  '/admin/:id',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const connection = await poolReservas.getConnection();
    try {
      const { id } = req.params;
      await connection.beginTransaction();

      // Obtener la reserva
      const [resRows] = await connection.query(
        'SELECT fecha_hora_cita FROM Reservas WHERE id = ?',
        [id]
      );
      if (resRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: 'Reserva no encontrada' });
      }

      const reserva = resRows[0];

      // Buscar disponibilidad con la misma fecha_hora
      const [dispRows] = await connection.query(
        'SELECT id, cupos_reservados FROM Disponibilidad WHERE fecha_hora = ?',
        [reserva.fecha_hora_cita]
      );

      if (dispRows.length > 0) {
        const disp = dispRows[0];
        const nuevoCupo =
          disp.cupos_reservados > 0 ? disp.cupos_reservados - 1 : 0;
        await connection.query(
          'UPDATE Disponibilidad SET cupos_reservados = ? WHERE id = ?',
          [nuevoCupo, disp.id]
        );
      }

      // Eliminar la reserva
      await connection.query('DELETE FROM Reservas WHERE id = ?', [id]);

      await connection.commit();
      connection.release();
      res.json({ message: 'Reserva eliminada correctamente' });
    } catch (error) {
      console.error('Error en DELETE /admin/:id', error);
      await connection.rollback();
      connection.release();
      res.status(500).json({ error: 'Error al eliminar la reserva' });
    }
  }
);

module.exports = router;


