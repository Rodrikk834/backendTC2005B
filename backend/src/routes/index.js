const { Router } = require('express');
const authRoutes = require('./auth.routes');
const AuthController = require('../controllers/auth.controller');
const empleadoRoutes = require('./empleado.routes');
const nominaRoutes = require('./nomina.routes');
const solicitudesRoutes = require('./solicitudes.routes');
const asistenciaRoutes = require('./asistencia.routes');
const noticiasRoutes = require('./noticias.routes');
const gamificacionRoutes = require('./gamificacion.routes');
const GamificacionController = require('../controllers/gamificacion.controller');

const apiRouter = Router();

apiRouter.post('/login', AuthController.login);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/perfil', empleadoRoutes);
apiRouter.use('/', empleadoRoutes);
apiRouter.use('/nominas', nominaRoutes);
apiRouter.use('/solicitudes', solicitudesRoutes);
apiRouter.use('/asistencia', asistenciaRoutes);
apiRouter.use('/noticias', noticiasRoutes);
apiRouter.use('/gamificacion', gamificacionRoutes);

// Alias directo para partidas de Unity
apiRouter.post('/partida', GamificacionController.registrarPartida);
apiRouter.post('/partidas', GamificacionController.registrarPartida);

module.exports = apiRouter;
