const { Router } = require('express');
const OficinaController = require('../controllers/oficina.controller');

const router = Router();

// Endpoint para que Unity obtenga los muebles según el botón que presione (0, 1, 2, 3)
router.get('/inventario/:idUsuario/:ordenUI', OficinaController.getInventario);

// Endpoint para que Unity cargue la oficina al iniciar la escena
router.get('/:idUsuario', OficinaController.getOficina);

// Endpoint para que Unity guarde la oficina (Cuando se presiona el botón "Guardar")
router.post('/guardar', OficinaController.saveOficina);

module.exports = router;