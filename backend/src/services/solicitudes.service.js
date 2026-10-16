const { dbQuery } = require('../config/database');

const SolicitudesService = {
  async getSolicitudesByEmpleado(empleadoId) {
    const empParam = parseInt(empleadoId, 10) || 1;
    const sqlText = `
      SELECT 
        s.id_solicitud AS id,
        s.id_empleado_solicitante AS empleado_id,
        t.clave AS tipo_clave,
        t.descripcion AS tipo_descripcion,
        CASE 
          WHEN t.clave = 'VAC' THEN 'Vacaciones'
          WHEN t.clave = 'PRES' THEN 'Préstamo Personal'
          WHEN t.clave = 'ACT' THEN 'Actualización de Datos'
          ELSE t.descripcion
        END AS tipo,
        CONVERT(VARCHAR, s.fecha_solicitud, 23) AS fecha_solicitud,
        s.estatus,
        s.motivo_rechazo,
        s.id_empleado_autorizador AS autorizador_id,
        ISNULL(v.dias_solicitados, 0) AS dias_vacaciones,
        ISNULL(p.monto_solicitado, 0) AS monto_prestamo
      FROM SOLICITUDES_CABECERA s
      INNER JOIN CAT_TIPOS_SOLICITUD t ON s.id_tipo_solicitud = t.id_tipo_solicitud
      LEFT JOIN SOL_VACACIONES v ON s.id_solicitud = v.id_solicitud
      LEFT JOIN SOL_PRESTAMOS p ON s.id_solicitud = p.id_solicitud
      WHERE s.id_empleado_solicitante = @empParam 
         OR s.id_empleado_solicitante IN (SELECT id_empleado FROM USUARIOS_PORTAL WHERE id_usuario = @empParam)
      ORDER BY s.fecha_solicitud DESC, s.id_solicitud DESC
    `;

    return await dbQuery.getAll(sqlText, { empParam });
  },

  async getSolicitudById(id) {
    const sqlText = `
      SELECT 
        s.id_solicitud AS id,
        s.id_empleado_solicitante AS empleado_id,
        CONCAT(p.nombre, ' ', p.paterno, CASE WHEN p.materno IS NOT NULL AND p.materno <> '' THEN ' ' + p.materno ELSE '' END) AS empleado_nombre,
        pu.nombre_puesto AS puesto,
        d.nombre_departamento AS departamento,
        t.clave AS tipo_clave,
        t.descripcion AS tipo_descripcion,
        CASE 
          WHEN t.clave = 'VAC' THEN 'Vacaciones'
          WHEN t.clave = 'PRES' THEN 'Préstamo Personal'
          WHEN t.clave = 'ACT' THEN 'Actualización de Datos'
          ELSE t.descripcion
        END AS tipo,
        CONVERT(VARCHAR, s.fecha_solicitud, 23) AS fecha_solicitud,
        s.estatus,
        s.motivo_rechazo,
        s.id_empleado_autorizador AS autorizador_id,
        CONCAT(p_aut.nombre, ' ', p_aut.paterno) AS autorizador_nombre,
        CONVERT(VARCHAR, v.fecha_inicio, 23) AS vacaciones_fecha_inicio,
        CONVERT(VARCHAR, v.fecha_fin, 23) AS vacaciones_fecha_fin,
        CONVERT(VARCHAR, v.fecha_regreso, 23) AS vacaciones_fecha_regreso,
        ISNULL(v.dias_solicitados, 0) AS vacaciones_dias,
        ISNULL(pr.monto_solicitado, 0) AS prestamo_monto,
        ISNULL(pr.numero_plazos, 0) AS prestamo_plazos,
        CONVERT(VARCHAR, pr.fecha_primer_descuento, 23) AS prestamo_fecha_descuento,
        act.json_cambios_propuestos AS cambios_json,
        e_sol.id_departamento,
        pu.nivel_jerarquico AS empleado_nivel,
        u_sol.rol AS empleado_rol
      FROM SOLICITUDES_CABECERA s
      INNER JOIN EMPLEADOS e_sol ON s.id_empleado_solicitante = e_sol.id_empleado
      INNER JOIN PERSONAS p ON e_sol.id_persona = p.id_persona
      LEFT JOIN CAT_DEPARTAMENTOS d ON e_sol.id_departamento = d.id_departamento
      LEFT JOIN CAT_PUESTOS pu ON e_sol.id_puesto = pu.id_puesto
      LEFT JOIN USUARIOS_PORTAL u_sol ON e_sol.id_empleado = u_sol.id_empleado
      INNER JOIN CAT_TIPOS_SOLICITUD t ON s.id_tipo_solicitud = t.id_tipo_solicitud
      LEFT JOIN SOL_VACACIONES v ON s.id_solicitud = v.id_solicitud
      LEFT JOIN SOL_PRESTAMOS pr ON s.id_solicitud = pr.id_solicitud
      LEFT JOIN SOL_ACTUALIZACION_DATOS act ON s.id_solicitud = act.id_solicitud
      LEFT JOIN EMPLEADOS e_aut ON s.id_empleado_autorizador = e_aut.id_empleado
      LEFT JOIN PERSONAS p_aut ON e_aut.id_persona = p_aut.id_persona
      WHERE s.id_solicitud = @id
    `;

    return await dbQuery.getOne(sqlText, { id: parseInt(id, 10) || 1 });
  },

  async createSolicitud({ empleado_id, tipo, datos }) {
    const empParam = parseInt(empleado_id, 10) || 1;
    // Resolver id_empleado si pasaron id_usuario
    const empObj = await dbQuery.getOne(`
      SELECT id_empleado FROM EMPLEADOS WHERE id_empleado = @empParam
      UNION
      SELECT id_empleado FROM USUARIOS_PORTAL WHERE id_usuario = @empParam
    `, { empParam });
    const empId = empObj ? empObj.id_empleado : empParam;

    let claveTipo = 'VAC';
    const tipoStr = String(tipo || '').toLowerCase();
    if (tipoStr.includes('prestamo') || tipoStr.includes('pres')) claveTipo = 'PRES';
    else if (tipoStr.includes('act') || tipoStr.includes('dato')) claveTipo = 'ACT';

    const catTipo = await dbQuery.getOne(
      `SELECT id_tipo_solicitud FROM CAT_TIPOS_SOLICITUD WHERE clave = @clave`,
      { clave: claveTipo }
    );

    const idTipo = catTipo ? catTipo.id_tipo_solicitud : 1;

    const resCabecera = await dbQuery.getOne(`
      INSERT INTO SOLICITUDES_CABECERA (id_empleado_solicitante, id_tipo_solicitud, fecha_solicitud, estatus)
      OUTPUT INSERTED.id_solicitud
      VALUES (@empId, @idTipo, GETDATE(), 'Pendiente')
    `, { empId, idTipo });

    const idSolicitud = resCabecera.id_solicitud;

    if (claveTipo === 'VAC' && datos) {
      await dbQuery.query(`
        INSERT INTO SOL_VACACIONES (id_solicitud, fecha_inicio, fecha_fin, fecha_regreso, dias_solicitados)
        VALUES (@idSolicitud, @inicio, @fin, @regreso, @dias)
      `, {
        idSolicitud,
        inicio: datos.fecha_inicio || new Date(),
        fin: datos.fecha_fin || new Date(),
        regreso: datos.fecha_regreso || new Date(),
        dias: parseInt(datos.dias_solicitados, 10) || 1
      });
    } else if (claveTipo === 'PRES' && datos) {
      await dbQuery.query(`
        INSERT INTO SOL_PRESTAMOS (id_solicitud, monto_solicitado, numero_plazos, fecha_primer_descuento)
        VALUES (@idSolicitud, @monto, @plazos, @fechaDescuento)
      `, {
        idSolicitud,
        monto: parseFloat(datos.monto_solicitado) || 1000.00,
        plazos: parseInt(datos.numero_plazos, 10) || 6,
        fechaDescuento: datos.fecha_primer_descuento || new Date()
      });
    } else if (claveTipo === 'ACT' && datos) {
      await dbQuery.query(`
        INSERT INTO SOL_ACTUALIZACION_DATOS (id_solicitud, json_cambios_propuestos)
        VALUES (@idSolicitud, @json)
      `, {
        idSolicitud,
        json: typeof datos.json_cambios === 'string' ? datos.json_cambios : JSON.stringify(datos)
      });
    }

    return await this.getSolicitudById(idSolicitud);
  },

  async getSolicitudesEquipo(jefeId, filtros = {}) {
    const paramId = parseInt(jefeId, 10) || 1;

    // 1. Obtener información del supervisor solicitante (buscando por id_empleado o id_usuario)
    const jefeInfo = await dbQuery.getOne(`
      SELECT 
        e.id_empleado,
        e.id_departamento,
        u.rol,
        p.nivel_jerarquico,
        p.nombre_puesto
      FROM EMPLEADOS e
      LEFT JOIN USUARIOS_PORTAL u ON e.id_empleado = u.id_empleado
      LEFT JOIN CAT_PUESTOS p ON e.id_puesto = p.id_puesto
      WHERE e.id_empleado = @paramId OR u.id_usuario = @paramId
    `, { paramId });

    const jefeEmpId = jefeInfo ? jefeInfo.id_empleado : paramId;
    const rolStr = String(jefeInfo?.rol || '').toLowerCase();
    const puestoStr = String(jefeInfo?.nombre_puesto || '').toLowerCase();
    const nivelJerarquico = jefeInfo?.nivel_jerarquico != null ? parseInt(jefeInfo.nivel_jerarquico, 10) : 2;
    const esJefeJefazo = nivelJerarquico === 1 || ['director', 'directora'].some(w => puestoStr.includes(w));
    const deptoId = jefeInfo ? jefeInfo.id_departamento : null;

    let whereClause = '';
    const queryParams = { jefeEmpId };

    if (esJefeJefazo) {
      // El jefe jefazo sólo puede ver y aceptar solicitudes de los Jefes / Gerentes de área
      whereClause = `WHERE e_sol.id_empleado <> @jefeEmpId AND (pu.nivel_jerarquico = 2 OR u_sol.rol = 'Jefe' OR pu.nombre_puesto LIKE '%Gerente%')`;
    } else {
      // Cada jefe de área sólo puede ver y aceptar solicitudes de colaboradores de su propio departamento
      whereClause = `WHERE (e_sol.id_departamento = @deptoId AND e_sol.id_empleado <> @jefeEmpId AND (pu.nivel_jerarquico > @nivelJerarquico OR u_sol.rol = 'Colaborador' OR e_sol.id_jefe_inmediato = @jefeEmpId))`;
      queryParams.deptoId = deptoId;
      queryParams.nivelJerarquico = nivelJerarquico;
    }

    if (filtros.estatus) {
      whereClause += ' AND s.estatus = @estatusFiltro';
      queryParams.estatusFiltro = filtros.estatus;
    }

    const sqlText = `
      SELECT 
        s.id_solicitud AS id,
        s.id_empleado_solicitante AS empleado_id,
        CONCAT(p.nombre, ' ', p.paterno, CASE WHEN p.materno IS NOT NULL AND p.materno <> '' THEN ' ' + p.materno ELSE '' END) AS empleado_nombre,
        pu.nombre_puesto AS puesto,
        d.nombre_departamento AS departamento,
        t.clave AS tipo_clave,
        t.descripcion AS tipo_descripcion,
        CASE 
          WHEN t.clave = 'VAC' THEN 'Vacaciones'
          WHEN t.clave = 'PRES' THEN 'Préstamo Personal'
          WHEN t.clave = 'ACT' THEN 'Actualización de Datos'
          ELSE t.descripcion
        END AS tipo,
        CONVERT(VARCHAR, s.fecha_solicitud, 23) AS fecha_solicitud,
        s.estatus,
        s.motivo_rechazo,
        s.id_empleado_autorizador AS autorizador_id,
        CONCAT(p_aut.nombre, ' ', p_aut.paterno) AS autorizador_nombre,
        CONVERT(VARCHAR, v.fecha_inicio, 23) AS vacaciones_fecha_inicio,
        CONVERT(VARCHAR, v.fecha_fin, 23) AS vacaciones_fecha_fin,
        CONVERT(VARCHAR, v.fecha_regreso, 23) AS vacaciones_fecha_regreso,
        ISNULL(v.dias_solicitados, 0) AS vacaciones_dias,
        ISNULL(pr.monto_solicitado, 0) AS prestamo_monto,
        ISNULL(pr.numero_plazos, 0) AS prestamo_plazos,
        CONVERT(VARCHAR, pr.fecha_primer_descuento, 23) AS prestamo_fecha_descuento,
        act.json_cambios_propuestos AS cambios_json,
        e_sol.id_departamento,
        pu.nivel_jerarquico AS empleado_nivel,
        u_sol.rol AS empleado_rol
      FROM SOLICITUDES_CABECERA s
      INNER JOIN EMPLEADOS e_sol ON s.id_empleado_solicitante = e_sol.id_empleado
      INNER JOIN PERSONAS p ON e_sol.id_persona = p.id_persona
      LEFT JOIN CAT_DEPARTAMENTOS d ON e_sol.id_departamento = d.id_departamento
      LEFT JOIN CAT_PUESTOS pu ON e_sol.id_puesto = pu.id_puesto
      LEFT JOIN USUARIOS_PORTAL u_sol ON e_sol.id_empleado = u_sol.id_empleado
      INNER JOIN CAT_TIPOS_SOLICITUD t ON s.id_tipo_solicitud = t.id_tipo_solicitud
      LEFT JOIN SOL_VACACIONES v ON s.id_solicitud = v.id_solicitud
      LEFT JOIN SOL_PRESTAMOS pr ON s.id_solicitud = pr.id_solicitud
      LEFT JOIN SOL_ACTUALIZACION_DATOS act ON s.id_solicitud = act.id_solicitud
      LEFT JOIN EMPLEADOS e_aut ON s.id_empleado_autorizador = e_aut.id_empleado
      LEFT JOIN PERSONAS p_aut ON e_aut.id_persona = p_aut.id_persona
      ${whereClause}
      ORDER BY 
        CASE WHEN s.estatus = 'Pendiente' THEN 0 ELSE 1 END,
        s.fecha_solicitud DESC, 
        s.id_solicitud DESC
    `;

    const solicitudes = await dbQuery.getAll(sqlText, queryParams);

    // Métricas y KPIs de la bandeja de entrada
    const pendientes = solicitudes.filter(s => s.estatus === 'Pendiente').length;
    const mesActual = new Date().getMonth() + 1;
    const anioActual = new Date().getFullYear();

    const vacacionesAprobadasMes = solicitudes.filter(s => {
      if (s.tipo_clave !== 'VAC' || s.estatus !== 'Aprobada' || !s.fecha_solicitud) return false;
      const [y, m] = s.fecha_solicitud.split('-').map(Number);
      return y === anioActual && m === mesActual;
    }).length;

    const prestamosPendientesMonto = solicitudes
      .filter(s => s.tipo_clave === 'PRES' && s.estatus === 'Pendiente')
      .reduce((acc, curr) => acc + (Number(curr.prestamo_monto) || 0), 0);

    return {
      kpis: {
        pendientes,
        vacaciones_aprobadas_mes: vacacionesAprobadasMes,
        prestamos_pendientes_monto: prestamosPendientesMonto
      },
      solicitudes
    };
  },

  async aprobarSolicitud(id, autorizadorId) {
    const solicitudId = parseInt(id, 10);
    const autParam = parseInt(autorizadorId, 10) || null;
    let autId = autParam;
    if (autParam) {
      const empObj = await dbQuery.getOne(`
        SELECT id_empleado FROM EMPLEADOS WHERE id_empleado = @autParam
        UNION
        SELECT id_empleado FROM USUARIOS_PORTAL WHERE id_usuario = @autParam
      `, { autParam });
      if (empObj) autId = empObj.id_empleado;
    }

    const existente = await this.getSolicitudById(solicitudId);
    if (!existente) return null;

    // Validar autorización según jerarquía
    const autorizadorInfo = await dbQuery.getOne(`
      SELECT 
        e.id_empleado,
        e.id_departamento,
        u.rol,
        p.nivel_jerarquico,
        p.nombre_puesto
      FROM EMPLEADOS e
      LEFT JOIN USUARIOS_PORTAL u ON e.id_empleado = u.id_empleado
      LEFT JOIN CAT_PUESTOS p ON e.id_puesto = p.id_puesto
      WHERE e.id_empleado = @autId
    `, { autId });

    if (autorizadorInfo) {
      if (existente.empleado_id === autorizadorInfo.id_empleado) {
        throw new Error('Un supervisor o líder no puede autorizar su propia solicitud.');
      }

      const autNivel = autorizadorInfo.nivel_jerarquico != null ? parseInt(autorizadorInfo.nivel_jerarquico, 10) : 2;
      const autPuesto = String(autorizadorInfo.nombre_puesto || '').toLowerCase();
      const esJefazo = autNivel === 1 || ['director', 'directora'].some(w => autPuesto.includes(w));

      if (esJefazo) {
        // El Jefe Jefazo sólo puede autorizar solicitudes de los Jefes (nivel 2 / rol 'Jefe' / puesto Gerente)
        const solNivel = existente.empleado_nivel != null ? parseInt(existente.empleado_nivel, 10) : 3;
        const solRol = String(existente.empleado_rol || '').toLowerCase();
        const solPuesto = String(existente.puesto || '').toLowerCase();
        const esJefeSolicitante = solNivel === 2 || solRol === 'jefe' || solPuesto.includes('gerente');

        if (!esJefeSolicitante) {
          throw new Error('La Dirección General (Jefe Jefazo) sólo puede autorizar solicitudes de los Jefes y Gerentes de área.');
        }
      } else {
        // Cada jefe de área sólo puede autorizar a empleados de su propio departamento
        if (existente.id_departamento && autorizadorInfo.id_departamento && existente.id_departamento !== autorizadorInfo.id_departamento) {
          throw new Error('Sólo puedes autorizar solicitudes pertenecientes a colaboradores de tu propio departamento.');
        }
      }
    }

    await dbQuery.query(`
      UPDATE SOLICITUDES_CABECERA
      SET 
        estatus = 'Aprobada',
        id_empleado_autorizador = @autId,
        motivo_rechazo = NULL
      WHERE id_solicitud = @solicitudId
    `, { solicitudId, autId });

    return await this.getSolicitudById(solicitudId);
  },

  async rechazarSolicitud(id, autorizadorId, motivoRechazo) {
    const solicitudId = parseInt(id, 10);
    const autParam = parseInt(autorizadorId, 10) || null;
    let autId = autParam;
    if (autParam) {
      const empObj = await dbQuery.getOne(`
        SELECT id_empleado FROM EMPLEADOS WHERE id_empleado = @autParam
        UNION
        SELECT id_empleado FROM USUARIOS_PORTAL WHERE id_usuario = @autParam
      `, { autParam });
      if (empObj) autId = empObj.id_empleado;
    }
    const motivo = (motivoRechazo || 'Rechazada por el supervisor').trim();

    const existente = await this.getSolicitudById(solicitudId);
    if (!existente) return null;

    // Validar autorización según jerarquía
    const autorizadorInfo = await dbQuery.getOne(`
      SELECT 
        e.id_empleado,
        e.id_departamento,
        u.rol,
        p.nivel_jerarquico,
        p.nombre_puesto
      FROM EMPLEADOS e
      LEFT JOIN USUARIOS_PORTAL u ON e.id_empleado = u.id_empleado
      LEFT JOIN CAT_PUESTOS p ON e.id_puesto = p.id_puesto
      WHERE e.id_empleado = @autId
    `, { autId });

    if (autorizadorInfo) {
      if (existente.empleado_id === autorizadorInfo.id_empleado) {
        throw new Error('Un supervisor o líder no puede rechazar su propia solicitud.');
      }

      const autNivel = autorizadorInfo.nivel_jerarquico != null ? parseInt(autorizadorInfo.nivel_jerarquico, 10) : 2;
      const autPuesto = String(autorizadorInfo.nombre_puesto || '').toLowerCase();
      const esJefazo = autNivel === 1 || ['director', 'directora'].some(w => autPuesto.includes(w));

      if (esJefazo) {
        // El Jefe Jefazo sólo puede rechazar solicitudes de los Jefes (nivel 2 / rol 'Jefe' / puesto Gerente)
        const solNivel = existente.empleado_nivel != null ? parseInt(existente.empleado_nivel, 10) : 3;
        const solRol = String(existente.empleado_rol || '').toLowerCase();
        const solPuesto = String(existente.puesto || '').toLowerCase();
        const esJefeSolicitante = solNivel === 2 || solRol === 'jefe' || solPuesto.includes('gerente');

        if (!esJefeSolicitante) {
          throw new Error('La Dirección General (Jefe Jefazo) sólo puede rechazar solicitudes de los Jefes y Gerentes de área.');
        }
      } else {
        // Cada jefe de área sólo puede rechazar a empleados de su propio departamento
        if (existente.id_departamento && autorizadorInfo.id_departamento && existente.id_departamento !== autorizadorInfo.id_departamento) {
          throw new Error('Sólo puedes rechazar solicitudes pertenecientes a colaboradores de tu propio departamento.');
        }
      }
    }

    await dbQuery.query(`
      UPDATE SOLICITUDES_CABECERA
      SET 
        estatus = 'Rechazada',
        id_empleado_autorizador = @autId,
        motivo_rechazo = @motivo
      WHERE id_solicitud = @solicitudId
    `, { solicitudId, autId, motivo });

    return await this.getSolicitudById(solicitudId);
  }
};

module.exports = SolicitudesService;
