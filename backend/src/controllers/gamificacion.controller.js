const GamificacionService = require('../services/gamificacion.service');

const GamificacionController = {
  async getResumen(req, res) {
    try {
      const usuarioId = req.query.userId || req.query.empleado_id || req.query.id_usuario || req.user?.id || 1;
      const resumen = await GamificacionService.getResumen(usuarioId);
      return res.status(200).json(resumen);
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ error: 'Usuario no encontrado en el sistema.' });
      }
      console.error('Error en GamificacionController.getResumen:', error);
      return res.status(500).json({ error: 'Error interno al consultar resumen de gamificación.' });
    }
  },

  async getLeaderboard(req, res) {
    try {
      const leaderboard = await GamificacionService.getLeaderboard();
      return res.status(200).json(leaderboard);
    } catch (error) {
      console.error('Error en GamificacionController.getLeaderboard:', error);
      return res.status(500).json({ error: 'Error interno al consultar leaderboard.' });
    }
  },

  async reclamarDiario(req, res) {
    try {
      const usuarioId = req.user?.id || req.body.usuario_id || req.body.id_usuario || req.body.userId || 1;
      const resultado = await GamificacionService.reclamarPuntosDiarios(usuarioId);
      return res.status(200).json({
        message: '¡Puntos diarios reclamados con éxito! (+50 pts)',
        nuevo_balance: resultado.nuevo_balance
      });
    } catch (error) {
      if (error.message === 'ALREADY_CLAIMED_TODAY') {
        return res.status(409).json({
          error: 'Ya has reclamado tu recompensa de hoy.'
        });
      }
      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ error: 'Usuario no encontrado en el sistema.' });
      }
      console.error('Error en GamificacionController.reclamarDiario:', error);
      return res.status(500).json({ error: 'Error interno al reclamar puntos diarios.' });
    }
  },

  async getEstadoPartida(req, res) {
    try {
      const usuarioId = req.query.userId || req.query.id_usuario || req.query.empleado_id || req.user?.id || 1;
      const minijuegoId = req.query.minigameId || req.query.id_minijuego || 1;

      const estado = await GamificacionService.verificarIntentoHoy(usuarioId, minijuegoId);
      return res.status(200).json(estado);
    } catch (error) {
      console.error('Error en GamificacionController.getEstadoPartida:', error);
      return res.status(500).json({ error: 'Error interno al verificar estado de la partida.' });
    }
  },

  async registrarPartida(req, res) {
    try {
      const userId = req.body.userId || req.body.id_usuario || req.body.usuario_id || req.user?.id;
      const score = req.body.score !== undefined ? req.body.score : req.body.puntuacion;
      const minigameId = req.body.minigameId || req.body.id_minijuego || 1;
      const tiempoJugado = req.body.tiempo_jugado_segundos || req.body.tiempoJugado || req.body.time || 60;

      if (!userId) {
        return res.status(400).json({ error: 'El identificador de usuario (userId) es requerido.' });
      }

      if (score === undefined || isNaN(Number(score))) {
        return res.status(400).json({ error: 'La puntuación (score) debe ser un número válido.' });
      }

      const partida = await GamificacionService.registrarPartida({
        userId,
        score,
        minigameId,
        tiempoJugado
      });

      return res.status(201).json({
        message: 'Partida registrada exitosamente.',
        partida
      });
    } catch (error) {
      if (error.message === 'ALREADY_PLAYED_TODAY') {
        return res.status(409).json({
          error: 'Ya has completado tu partida diaria de hoy. Solo se permite 1 intento por día.',
          puedeJugar: false,
          partidaPrevia: error.partidaPrevia
        });
      }

      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ error: 'Usuario no encontrado en el sistema.' });
      }

      console.error('Error en GamificacionController.registrarPartida:', error);
      return res.status(500).json({ error: 'Error interno al registrar partida en la base de datos.' });
    }
  }
};

module.exports = GamificacionController;
