const { Router } = require('express');
const AuthController = require('../controllers/auth.controller');

const router = Router();
router.post('/login', AuthController.login);
router.post('/verify-2fa', AuthController.verify2FA);
router.post('/resend-2fa', AuthController.resend2FA);

module.exports = router;
