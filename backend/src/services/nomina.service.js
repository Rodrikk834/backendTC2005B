const { dbQuery } = require('../config/database');

const NominaService = {
  async getNominasByEmpleado(empleadoId, { anio, mes } = {}) {
    let sqlText = `
      SELECT 
        r.id_recibo AS id,
        CONCAT('REC-', YEAR(r.fecha_pago), '-', RIGHT('000' + CAST(r.id_recibo AS VARCHAR), 4)) AS folio,
        r.periodo AS periodo_nombre,
        CONCAT(CONVERT(VARCHAR, r.fecha_inicio, 103), ' al ', CONVERT(VARCHAR, r.fecha_fin, 103)) AS periodo_pago,
        CONVERT(VARCHAR, r.fecha_pago, 23) AS fecha_pago,
        r.periodo AS quincena_semana,
        YEAR(r.fecha_pago) AS anio,
        MONTH(r.fecha_pago) AS mes,
        'Pagado' AS estatus,
        r.total_percepciones,
        r.total_deducciones,
        r.sueldo_neto AS neto_pagado,
        comp.razon_social AS empresa_nombre
      FROM RECIBOS_NOMINA r
      INNER JOIN EMPLEADOS e ON r.id_empleado = e.id_empleado
      LEFT JOIN CAT_COMPANIAS comp ON e.id_compania = comp.id_compania
      WHERE r.id_empleado = @empleadoId
    `;

    const params = { empleadoId: parseInt(empleadoId, 10) || 1 };

    if (anio) {
      sqlText += ` AND YEAR(r.fecha_pago) = @anio`;
      params.anio = parseInt(anio, 10);
    }

    if (mes) {
      sqlText += ` AND MONTH(r.fecha_pago) = @mes`;
      params.mes = parseInt(mes, 10);
    }

    sqlText += ` ORDER BY r.fecha_pago DESC`;

    return await dbQuery.getAll(sqlText, params);
  },

  async getNominaDetalle(nominaId) {
    const sqlEncabezado = `
      SELECT 
        r.id_recibo AS id,
        CONCAT('REC-', YEAR(r.fecha_pago), '-', RIGHT('000' + CAST(r.id_recibo AS VARCHAR), 4)) AS folio,
        r.periodo AS periodo_nombre,
        CONCAT(CONVERT(VARCHAR, r.fecha_inicio, 103), ' al ', CONVERT(VARCHAR, r.fecha_fin, 103)) AS periodo_pago,
        CONVERT(VARCHAR, r.fecha_pago, 23) AS fecha_pago,
        ISNULL(hs.salario_mensual / 30.0, 0) AS sueldo_diario,
        DATEDIFF(day, r.fecha_inicio, r.fecha_fin) + 1 AS dias_trabajados,
        (DATEDIFF(day, r.fecha_inicio, r.fecha_fin) + 1) * 8 AS horas_trabajadas,
        'Matutino' AS turno,
        'Diurna (8 hrs)' AS jornada,
        r.periodo AS quincena_semana,
        YEAR(r.fecha_pago) AS anio,
        MONTH(r.fecha_pago) AS mes,
        'Pagado' AS estatus,
        r.total_percepciones,
        r.total_deducciones,
        r.sueldo_neto AS neto_pagado,
        comp.id_compania AS emp_id,
        comp.razon_social AS emp_nombre,
        comp.rfc AS emp_rfc,
        CONCAT('RP-', comp.id_compania) AS emp_registro_patronal,
        e.id_empleado AS emp_empleado_id,
        CONCAT(p.nombre, ' ', p.paterno, ' ', ISNULL(p.materno, '')) AS empleado_nombre,
        CAST(e.id_empleado AS VARCHAR) AS no_empleado,
        p.rfc AS empleado_rfc,
        p.curp AS empleado_curp,
        e.numero_seguridad_social AS empleado_imss,
        d.nombre_departamento AS departamento,
        pu.nombre_puesto AS puesto,
        CONCAT(cb.banco, ' - CLABE: ', cb.clabe_interbancaria) AS abono_cuenta
      FROM RECIBOS_NOMINA r
      INNER JOIN EMPLEADOS e ON r.id_empleado = e.id_empleado
      INNER JOIN PERSONAS p ON e.id_persona = p.id_persona
      LEFT JOIN CAT_COMPANIAS comp ON e.id_compania = comp.id_compania
      LEFT JOIN CAT_DEPARTAMENTOS d ON e.id_departamento = d.id_departamento
      LEFT JOIN CAT_PUESTOS pu ON e.id_puesto = pu.id_puesto
      LEFT JOIN CUENTAS_BANCARIAS cb ON cb.id_empleado = e.id_empleado
      LEFT JOIN (
          SELECT id_empleado, salario_mensual, 
                 ROW_NUMBER() OVER(PARTITION BY id_empleado ORDER BY fecha_aplicacion DESC) as rn
          FROM HISTORIAL_SALARIAL
      ) hs ON hs.id_empleado = e.id_empleado AND hs.rn = 1
      WHERE r.id_recibo = @nominaId
    `;

    const row = await dbQuery.getOne(sqlEncabezado, { nominaId: parseInt(nominaId, 10) || 1 });
    if (!row) return null;

    const conceptos = await dbQuery.getAll(
      `SELECT id_detalle AS id, LOWER(naturaleza) AS tipo, descripcion AS concepto, importe FROM DETALLE_NOMINA WHERE id_recibo = @nominaId ORDER BY id_detalle ASC`,
      { nominaId: parseInt(nominaId, 10) || 1 }
    );

    const percepciones = conceptos.filter(c => c.tipo === 'percepcion' || c.tipo === 'percepción').map(c => ({ id: c.id, concepto: c.concepto, importe: c.importe }));
    const deducciones = conceptos.filter(c => c.tipo === 'deduccion' || c.tipo === 'deducción').map(c => ({ id: c.id, concepto: c.concepto, importe: c.importe }));
    const informativos = conceptos.filter(c => c.tipo === 'informativo').map(c => ({ id: c.id, concepto: c.concepto, importe: c.importe }));

    return {
      id: row.id,
      folio: row.folio,
      periodo_nombre: row.periodo_nombre,
      periodo_pago: row.periodo_pago,
      fecha_pago: row.fecha_pago,
      sueldo_diario: row.sueldo_diario,
      dias_trabajados: row.dias_trabajados,
      horas_trabajadas: row.horas_trabajadas,
      turno: row.turno,
      jornada: row.jornada,
      quincena_semana: row.quincena_semana,
      anio: row.anio,
      mes: row.mes,
      estatus: row.estatus,
      total_percepciones: row.total_percepciones,
      total_deducciones: row.total_deducciones,
      neto_pagado: row.neto_pagado,
      empresa: {
        id: row.emp_id,
        nombre: row.emp_nombre,
        rfc: row.emp_rfc,
        registro_patronal: row.emp_registro_patronal
      },
      empleado: {
        id: row.emp_empleado_id,
        nombre: row.empleado_nombre,
        no_empleado: row.no_empleado,
        rfc: row.empleado_rfc,
        curp: row.empleado_curp,
        imss: row.empleado_imss,
        departamento: row.departamento,
        puesto: row.puesto,
        abono_cuenta: row.abono_cuenta
      },
      conceptos: {
        percepciones,
        deducciones,
        informativos
      }
    };
  }
};

module.exports = NominaService;
