const { dbQuery } = require('../config/database');

const EmpleadoService = {
  async getPerfil(empleadoId) {
    const sqlText = `
      SELECT 
        e.id_empleado AS id,
        u.id_usuario,
        u.username,
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
        ISNULL(e.id_empresa, ISNULL(e.id_compania, 1)) AS id_empresa,
        ISNULL(emp.nombre_empresa, comp.razon_social) AS empresa,
        emp.nombre_corto AS shortName,
        emp.logo_url,
        emp.color_primario_dark,
        emp.color_primario_light,
        emp.color_acento,
        emp.color_acento_light,
        emp.preset_nombre
      FROM EMPLEADOS e
      INNER JOIN PERSONAS p ON e.id_persona = p.id_persona
      LEFT JOIN USUARIOS_PORTAL u ON u.id_empleado = e.id_empleado
      LEFT JOIN EMPRESAS emp ON ISNULL(e.id_empresa, e.id_compania) = emp.id_empresa
      LEFT JOIN CAT_COMPANIAS comp ON e.id_compania = comp.id_compania
      LEFT JOIN CAT_DEPARTAMENTOS d ON e.id_departamento = d.id_departamento
      LEFT JOIN CAT_PUESTOS pu ON e.id_puesto = pu.id_puesto
      LEFT JOIN CUENTAS_BANCARIAS cb ON cb.id_empleado = e.id_empleado
      WHERE e.id_empleado = @empleadoId OR u.id_usuario = @empleadoId
    `;

    const row = await dbQuery.getOne(sqlText, { empleadoId: parseInt(empleadoId, 10) || 1 });
    if (!row) return null;

    const branding = {
      empresaId: row.id_empresa || 1,
      companyName: row.empresa || 'Atlas Solutions',
      shortName: row.shortName || 'Atlas Solutions',
      logoUrl: row.logo_url || '/assets/favicon/favicon.svg',
      primaryDark: row.color_primario_dark || '#1A365D',
      primaryLight: row.color_primario_light || '#2B6CB0',
      accentColor: row.color_acento || '#00B894',
      accentLight: row.color_acento_light || '#E6F8F5',
      presetName: row.preset_nombre || 'atlas'
    };

    return {
      ...row,
      id_empresa: row.id_empresa || 1,
      empresa: row.empresa || 'Atlas Solutions',
      branding
    };
  }
};

module.exports = EmpleadoService;
