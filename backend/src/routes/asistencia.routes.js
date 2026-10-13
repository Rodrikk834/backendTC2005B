const { Router } = require('express');
const AsistenciaController = require('../controllers/asistencia.controller');

const router = Router();
router.get('/', AsistenciaController.getAsistencia);
router.get('/bitacora', AsistenciaController.getBitacora);

module.exports = router;
