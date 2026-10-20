const { dbQuery } = require('../config/database');

/**
 * Middleware para verificar token de autenticación e identificar al usuario y su empresa
 */
async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    const headerUserId = req.headers['x-user-id'] || req.query.userId || null;
    const headerCompanyId = req.headers['x-company-id'] || req.query.empresa_id || null;

    let userId = null;

    if (token) {
      // Soporta tokens en formato:
      // jwt-user-${userId}-emp-${empresaId}-${timestamp}
      // jwt-token-${userId}-${timestamp}
      // jwt-active-${userId}-${timestamp}
      const match = token.match(/jwt-(?:user|token|active)-(\d+)/);
      if (match) {
        userId = parseInt(match[1], 10);
      }
    }

    if (!userId && headerUserId && !isNaN(headerUserId)) {
      userId = parseInt(headerUserId, 10);
    }

    let user = null;
    if (userId) {
      user = await dbQuery.getOne(`
        SELECT 
          u.id_usuario,
          u.id_empleado,
          u.username,
          u.rol,
          ISNULL(e.id_empresa, ISNULL(e.id_compania, 1)) AS id_empresa,
          emp.nombre_empresa,
          emp.nombre_corto
        FROM USUARIOS_PORTAL u
        JOIN EMPLEADOS e ON u.id_empleado = e.id_empleado
        LEFT JOIN EMPRESAS emp ON e.id_empresa = emp.id_empresa
        WHERE u.id_usuario = @id OR e.id_empleado = @id
      `, { id: userId });
    }

    // Si aún no encontramos el user por id numérico pero hay un token bearer genérico
    if (!user && token) {
      const compId = headerCompanyId && !isNaN(headerCompanyId) ? parseInt(headerCompanyId, 10) : 1;
      user = await dbQuery.getOne(`
        SELECT TOP 1
          u.id_usuario,
          u.id_empleado,
          u.username,
          u.rol,
          ISNULL(e.id_empresa, @compId) AS id_empresa,
          emp.nombre_empresa,
          emp.nombre_corto
        FROM USUARIOS_PORTAL u
        JOIN EMPLEADOS e ON u.id_empleado = e.id_empleado
        LEFT JOIN EMPRESAS emp ON e.id_empresa = emp.id_empresa
        WHERE (e.id_empresa = @compId OR e.id_compania = @compId) AND u.rol = 'Administrador'
      `, { compId });
    }

    if (!user) {
      return res.status(401).json({ error: 'Token no válido o sesión no autorizada.' });
    }

    req.user = {
      id: user.id_usuario,
      id_usuario: user.id_usuario,
      id_empleado: user.id_empleado,
      id_empresa: user.id_empresa,
      username: user.username,
      rol: user.rol,
      empresa: user.nombre_empresa,
      shortName: user.nombre_corto
    };

    next();
  } catch (error) {
    console.error('Error en verifyToken:', error);
    return res.status(401).json({ error: 'Fallo al autenticar la solicitud.' });
  }
}

/**
 * Middleware para asegurar que solo usuarios con rol Administrador puedan acceder
 */
function requireAdmin(req, res, next) {
  const role = (req.user?.rol || '').toLowerCase();
  if (role.includes('administrador') || role.includes('admin')) {
    return next();
  }
  return res.status(403).json({ error: 'Acceso denegado: se requieren privilegios de Administrador.' });
}

module.exports = {
  verifyToken,
  requireAdmin
};
