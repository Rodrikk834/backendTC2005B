const { Router } = require('express');
const authRoutes = require('./auth.routes');
const AuthController = require('../controllers/auth.controller');
const empleadoRoutes = require('./empleado.routes');
const nominaRoutes = require('./nomina.routes');

const apiRouter = Router();

apiRouter.post('/login', AuthController.login);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/', empleadoRoutes);
apiRouter.use('/nominas', nominaRoutes);

module.exports = apiRouter;
