const { Router } = require('express');
const GamificacionController = require('../controllers/gamificacion.controller');

const router = Router();
router.get('/resumen', GamificacionController.getResumen);
router.get('/leaderboard', GamificacionController.getLeaderboard);
router.post('/reclamar-diario', GamificacionController.reclamarDiario);

router.get('/partida/estado', GamificacionController.getEstadoPartida);
router.get('/partidas/estado', GamificacionController.getEstadoPartida);
router.post('/partida', GamificacionController.registrarPartida);
router.post('/partidas', GamificacionController.registrarPartida);

module.exports = router;
