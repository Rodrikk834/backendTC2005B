const { dbQuery } = require('../config/database');

const EmpleadoService = {
  async getPerfil(empleadoId) {
    const query = `
      SELECT 
        e.id,
        e.nombre,
        e.no_empleado,
        u.email,
        u.rol,
        u.avatar,
        e.rfc,
        e.curp,
        e.imss,
        e.departamento,
        e.puesto,
        e.fecha_ingreso,
        e.reporta_a,
        e.abono_cuenta
      FROM empleados e
      INNER JOIN usuarios u ON e.id = u.id
      WHERE e.id = ?
    `;

    return await dbQuery.get(query, [empleadoId]);
  }
};

module.exports = EmpleadoService;
