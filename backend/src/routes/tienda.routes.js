const { Router } = require('express');
const TiendaController = require('../controllers/tienda.controller');

const router = Router();

router.get('/catalogo', TiendaController.obtenerCatalogo);

router.post('/comprar', TiendaController.comprarMueble);

module.exports = router;