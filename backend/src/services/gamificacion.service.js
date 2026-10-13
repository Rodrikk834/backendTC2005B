const { dbQuery } = require('../config/database');

function calcularNivel(puntos) {
  const p = Number(puntos) || 0;
  if (p >= 15000) {
    return { nombre: 'Nivel Diamante ⭐', tier: 'Diamante' };
  } else if (p >= 5000) {
    return { nombre: 'Nivel Oro 🥇', tier: 'Oro' };
  } else if (p >= 1000) {
    return { nombre: 'Nivel Plata 🥈', tier: 'Plata' };
  } else {
    return { nombre: 'Nivel Bronce 🥉', tier: 'Bronce' };
  }
}

const GamificacionService = {
  async getLeaderboard() {
    try {
      const sqlText = `
        SELECT 
          d.id_departamento,
          d.nombre_departamento AS departamento,
          COUNT(DISTINCT e.id_empleado) AS total_empleados,
          ISNULL(SUM(u.puntos_balance), 0) AS puntos_totales
        FROM CAT_DEPARTAMENTOS d
        LEFT JOIN EMPLEADOS e ON d.id_departamento = e.id_departamento
        LEFT JOIN USUARIOS_PORTAL u ON u.id_empleado = e.id_empleado
        GROUP BY d.id_departamento, d.nombre_departamento
        ORDER BY puntos_totales DESC
      `;

      return await dbQuery.getAll(sqlText);
    } catch (err) {
      console.warn('Error en GamificacionService.getLeaderboard:', err.message);
      return [];
    }
  },

  async getResumen(usuarioId) {
    const uId = parseInt(usuarioId, 10) || 1;

    // a) Consultar USUARIOS_PORTAL
    const user = await dbQuery.getOne(`
      SELECT 
        id_usuario, 
        id_empleado, 
        username, 
        ISNULL(puntos_balance, 0) AS puntos_balance, 
        ISNULL(rol, 'Colaborador') AS rol 
      FROM USUARIOS_PORTAL 
      WHERE id_usuario = @uId OR id_empleado = @uId
    `, { uId });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const resolvedUserId = user.id_usuario;
    const idEmpleado = user.id_empleado || resolvedUserId;
    const puntosBalance = user.puntos_balance;
    const rol = user.rol;

    // b) Consultar PARTIDAS_JUGADAS de hoy
    const partidaHoy = await dbQuery.getOne(`
      SELECT TOP 1 
        id_partida,
        puntuacion_obtenida,
        CONVERT(VARCHAR, fecha_partida, 120) AS fecha_partida
      FROM PARTIDAS_JUGADAS
      WHERE id_usuario = @resolvedUserId
        AND CAST(fecha_partida AS DATE) = CAST(GETDATE() AS DATE)
      ORDER BY fecha_partida DESC
    `, { resolvedUserId });

    const yaJugoHoy = !!partidaHoy;
    const puedeJugarHoy = !yaJugoHoy;
    const aporteHoy = partidaHoy ? Number(partidaHoy.puntuacion_obtenida) || 0 : 0;

    // c) Consultar REGISTROS_ASISTENCIA para racha de días consecutivos
    let rachaDias = 0;
    try {
      const asistencias = await dbQuery.getAll(`
        SELECT TOP 30 
          fecha, 
          estado 
        FROM REGISTROS_ASISTENCIA
        WHERE id_empleado = @idEmpleado
        ORDER BY fecha DESC
      `, { idEmpleado });

      for (const a of asistencias) {
        const est = String(a.estado || '').toLowerCase();
        if (est.includes('puntual') || est.includes('retardo') || est.includes('asistencia')) {
          rachaDias++;
        } else {
          break;
        }
      }
    } catch (asistErr) {
      console.warn('No se pudieron leer registros de asistencia para racha:', asistErr.message);
      rachaDias = 0;
    }

    const mod7 = rachaDias % 7;
    const proximoBonoDias = mod7 === 0 ? 7 : (7 - mod7);

    // d) Verificar en TRANSACCIONES_PUNTOS si ya reclamó la recompensa diaria hoy
    let yaReclamoHoy = false;
    try {
      const reclamoTrans = await dbQuery.getOne(`
        SELECT TOP 1 id_transaccion 
        FROM TRANSACCIONES_PUNTOS
        WHERE id_usuario = @resolvedUserId
          AND tipo_transaccion = 'RECOMPENSA_DIARIA'
          AND CAST(fecha_transaccion AS DATE) = CAST(GETDATE() AS DATE)
      `, { resolvedUserId });

      yaReclamoHoy = !!reclamoTrans;
    } catch (txErr) {
      console.warn('TRANSACCIONES_PUNTOS no disponible:', txErr.message);
      yaReclamoHoy = false;
    }

    const puedeReclamarDiario = !yaReclamoHoy;

    // e) Calcular nivel
    const nivel = calcularNivel(puntosBalance);

    return {
      userId: resolvedUserId,
      puntos_balance: puntosBalance,
      rol,
      racha_dias: rachaDias,
      proximo_bono_dias: proximoBonoDias,
      puede_reclamar_diario: puedeReclamarDiario,
      puede_jugar_hoy: puedeJugarHoy,
      aporte_hoy: aporteHoy,
      nivel
    };
  },

  async reclamarPuntosDiarios(usuarioId) {
    const uId = parseInt(usuarioId, 10) || 1;

    const user = await dbQuery.getOne(`
      SELECT id_usuario, puntos_balance 
      FROM USUARIOS_PORTAL 
      WHERE id_usuario = @uId OR id_empleado = @uId
    `, { uId });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const resolvedUserId = user.id_usuario;

    // Validar si ya reclamó hoy
    try {
      const reclamoHoy = await dbQuery.getOne(`
        SELECT TOP 1 id_transaccion 
        FROM TRANSACCIONES_PUNTOS
        WHERE id_usuario = @resolvedUserId
          AND tipo_transaccion = 'RECOMPENSA_DIARIA'
          AND CAST(fecha_transaccion AS DATE) = CAST(GETDATE() AS DATE)
      `, { resolvedUserId });

      if (reclamoHoy) {
        const error = new Error('ALREADY_CLAIMED_TODAY');
        throw error;
      }
    } catch (checkErr) {
      if (checkErr.message === 'ALREADY_CLAIMED_TODAY') throw checkErr;
      console.warn('Aviso verificando TRANSACCIONES_PUNTOS:', checkErr.message);
    }

    // Actualizar puntos_balance
    await dbQuery.query(`
      UPDATE USUARIOS_PORTAL
      SET puntos_balance = ISNULL(puntos_balance, 0) + 50
      WHERE id_usuario = @resolvedUserId
    `, { resolvedUserId });

    // Insertar en TRANSACCIONES_PUNTOS
    try {
      await dbQuery.query(`
        INSERT INTO TRANSACCIONES_PUNTOS (
          id_usuario, 
          tipo_transaccion, 
          cantidad_puntos, 
          fecha_transaccion, 
          referencia_origen
        )
        VALUES (
          @resolvedUserId, 
          'RECOMPENSA_DIARIA', 
          50, 
          GETDATE(), 
          'Acceso Diario'
        )
      `, { resolvedUserId });
    } catch (insErr) {
      console.warn('Nota: TRANSACCIONES_PUNTOS no pudo registrarse:', insErr.message);
    }

    const userActualizado = await dbQuery.getOne(`
      SELECT puntos_balance FROM USUARIOS_PORTAL WHERE id_usuario = @resolvedUserId
    `, { resolvedUserId });

    return {
      puntos_ganados: 50,
      nuevo_balance: userActualizado ? userActualizado.puntos_balance : user.puntos_balance + 50
    };
  },

  async verificarIntentoHoy(usuarioId, minijuegoId = 1) {
    const uId = parseInt(usuarioId, 10) || 1;
    const mId = parseInt(minijuegoId, 10) || 1;

    const user = await dbQuery.getOne(`
      SELECT id_usuario, ISNULL(puntos_balance, 0) AS puntos_balance FROM USUARIOS_PORTAL WHERE id_usuario = @uId OR id_empleado = @uId
    `, { uId });

    const resolvedUserId = user ? user.id_usuario : uId;
    const puntosBalance = user ? user.puntos_balance : 0;

    const partidaHoy = await dbQuery.getOne(`
      SELECT 
        id_partida,
        id_usuario,
        id_minijuego,
        puntuacion_obtenida,
        tiempo_jugado_segundos,
        CONVERT(VARCHAR, fecha_partida, 120) AS fecha_partida
      FROM PARTIDAS_JUGADAS
      WHERE id_usuario = @resolvedUserId
        AND CAST(fecha_partida AS DATE) = CAST(GETDATE() AS DATE)
    `, { resolvedUserId });

    return {
      puedeJugar: !partidaHoy,
      yaJugoHoy: !!partidaHoy,
      partidaHoy: partidaHoy || null,
      id_usuario: resolvedUserId,
      puntos_balance: puntosBalance
    };
  },

  async registrarPartida({ userId, score, minigameId = 1, tiempoJugado = 90 }) {
    const puntuacion = Math.max(0, parseInt(score, 10) || 0);
    const tiempo = Math.max(0, parseInt(tiempoJugado, 10) || 90);
    const idMinijuego = parseInt(minigameId, 10) || 1;

    const user = await dbQuery.getOne(`
      SELECT id_usuario, puntos_balance 
      FROM USUARIOS_PORTAL 
      WHERE id_usuario = @userId OR id_empleado = @userId
    `, { userId: parseInt(userId, 10) || 1 });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const resolvedUserId = user.id_usuario;

    const estadoIntento = await this.verificarIntentoHoy(resolvedUserId, idMinijuego);
    if (estadoIntento.yaJugoHoy) {
      const error = new Error('ALREADY_PLAYED_TODAY');
      error.partidaPrevia = estadoIntento.partidaHoy;
      throw error;
    }

    const minijuego = await dbQuery.getOne(`
      SELECT id_minijuego FROM CAT_MINIJUEGOS WHERE id_minijuego = @idMinijuego
    `, { idMinijuego });

    if (!minijuego) {
      await dbQuery.query(`
        IF NOT EXISTS (SELECT 1 FROM CAT_MINIJUEGOS WHERE id_minijuego = @idMinijuego)
        BEGIN
          SET IDENTITY_INSERT CAT_MINIJUEGOS ON;
          INSERT INTO CAT_MINIJUEGOS (id_minijuego, nombre_juego, descripcion, activo)
          VALUES (@idMinijuego, 'Minijuego Unity', 'Minijuego interactivo del portal', 1);
          SET IDENTITY_INSERT CAT_MINIJUEGOS OFF;
        END
      `, { idMinijuego });
    }

    const insertResult = await dbQuery.getOne(`
      INSERT INTO PARTIDAS_JUGADAS (
        id_usuario, 
        id_minijuego, 
        puntuacion_obtenida, 
        tiempo_jugado_segundos, 
        fecha_partida
      )
      OUTPUT 
        INSERTED.id_partida,
        INSERTED.id_usuario,
        INSERTED.id_minijuego,
        INSERTED.puntuacion_obtenida,
        INSERTED.tiempo_jugado_segundos,
        CONVERT(VARCHAR, INSERTED.fecha_partida, 120) AS fecha_partida
      VALUES (
        @resolvedUserId, 
        @idMinijuego, 
        @puntuacion, 
        @tiempo, 
        GETDATE()
      )
    `, { resolvedUserId, idMinijuego, puntuacion, tiempo });

    await dbQuery.query(`
      UPDATE USUARIOS_PORTAL
      SET puntos_balance = ISNULL(puntos_balance, 0) + @puntuacion
      WHERE id_usuario = @resolvedUserId
    `, { resolvedUserId, puntuacion });

    try {
      await dbQuery.query(`
        INSERT INTO TRANSACCIONES_PUNTOS (
          id_usuario, 
          tipo_transaccion, 
          cantidad_puntos, 
          fecha_transaccion, 
          referencia_origen
        )
        VALUES (
          @resolvedUserId, 
          'PARTIDA_UNITY', 
          @puntuacion, 
          GETDATE(), 
          'Minijuego Unity'
        )
      `, { resolvedUserId, puntuacion });
    } catch (txErr) {
      console.warn('Nota: TRANSACCIONES_PUNTOS no pudo registrarse:', txErr.message);
    }

    const nuevoUser = await dbQuery.getOne(`
      SELECT puntos_balance FROM USUARIOS_PORTAL WHERE id_usuario = @resolvedUserId
    `, { resolvedUserId });

    return {
      id_partida: insertResult.id_partida,
      id_usuario: insertResult.id_usuario,
      id_minijuego: insertResult.id_minijuego,
      puntuacion_obtenida: insertResult.puntuacion_obtenida,
      tiempo_jugado_segundos: insertResult.tiempo_jugado_segundos,
      fecha_partida: insertResult.fecha_partida,
      puntos_balance_actual: nuevoUser ? nuevoUser.puntos_balance : user.puntos_balance + puntuacion
    };
  }
};

module.exports = GamificacionService;