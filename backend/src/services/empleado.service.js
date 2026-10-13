const { dbQuery } = require('../config/database');

const EmpleadoService = {
  async getPerfil(empleadoId) {
    const sqlText = `
      SELECT 
        e.id_empleado AS id,
        CONCAT(p.nombre, ' ', p.paterno, ' ', ISNULL(p.materno, '')) AS nombre,
        CAST(e.id_empleado AS VARCHAR) AS no_empleado,
        ISNULL(p.correo_personal, u.username) AS email,
        u.rol,
        ISNULL(u.puntos_balance, 0) AS puntos_balance,
        p.rfc,
        p.curp,
        e.numero_seguridad_social AS imss,
        d.nombre_departamento AS departamento,
        pu.nombre_puesto AS puesto,
        CONVERT(VARCHAR, e.fecha_ingreso, 23) AS fecha_ingreso,
        cb.banco,
        cb.clabe_interbancaria,
        cb.numero_cuenta,
        CASE 
          WHEN cb.clabe_interbancaria IS NOT NULL THEN CONCAT(cb.banco, ' - CLABE: ', cb.clabe_interbancaria)
          ELSE NULL
        END AS abono_cuenta,
        comp.razon_social AS empresa
      FROM EMPLEADOS e
      INNER JOIN PERSONAS p ON e.id_persona = p.id_persona
      LEFT JOIN USUARIOS_PORTAL u ON u.id_empleado = e.id_empleado
      LEFT JOIN CAT_COMPANIAS comp ON e.id_compania = comp.id_compania
      LEFT JOIN CAT_DEPARTAMENTOS d ON e.id_departamento = d.id_departamento
      LEFT JOIN CAT_PUESTOS pu ON e.id_puesto = pu.id_puesto
      LEFT JOIN CUENTAS_BANCARIAS cb ON cb.id_empleado = e.id_empleado
      WHERE e.id_empleado = @empleadoId OR u.id_usuario = @empleadoId
    `;

    return await dbQuery.getOne(sqlText, { empleadoId: parseInt(empleadoId, 10) || 1 });
  }
};

module.exports = EmpleadoService;
