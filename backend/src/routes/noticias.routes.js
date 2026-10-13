const { Router } = require('express');
const NoticiasController = require('../controllers/noticias.controller');

const router = Router();

router.get('/', NoticiasController.getNoticias);
router.post('/', NoticiasController.createNoticia);
router.get('/:id', NoticiasController.getNoticiaById);
router.put('/:id', NoticiasController.updateNoticia);
router.delete('/:id', NoticiasController.deleteNoticia);

module.exports = router;
