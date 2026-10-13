const { Router } = require('express');
const SolicitudesController = require('../controllers/solicitudes.controller');

const router = Router();

router.get('/', SolicitudesController.getSolicitudes);
router.get('/equipo', SolicitudesController.getSolicitudesEquipo);
router.post('/', SolicitudesController.createSolicitud);
router.put('/:id/aprobar', SolicitudesController.aprobarSolicitud);
router.put('/:id/rechazar', SolicitudesController.rechazarSolicitud);
router.get('/:id', SolicitudesController.getSolicitudDetalle);

module.exports = router;
