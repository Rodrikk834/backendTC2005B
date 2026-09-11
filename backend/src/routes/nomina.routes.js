const { Router } = require('express');
const NominaController = require('../controllers/nomina.controller');

const router = Router();
router.get('/', NominaController.getNominas);
router.get('/:id', NominaController.getNominaDetalle);

module.exports = router;
