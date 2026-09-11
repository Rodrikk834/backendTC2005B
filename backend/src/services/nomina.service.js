const { dbQuery } = require('../config/database');

const NominaService = {
  async getNominasByEmpleado(empleadoId, { anio, mes } = {}) {
    let sql = `
      SELECT 
        n.id,
        n.folio,
        n.periodo_nombre,
        n.periodo_pago,
        n.fecha_pago,
        n.quincena_semana,
        n.anio,
        n.mes,
        n.estatus,
        n.total_percepciones,
        n.total_deducciones,
        n.neto_pagado,
        emp.nombre AS empresa_nombre
      FROM nominas n
      INNER JOIN empresa emp ON n.empresa_id = emp.id
      WHERE n.empleado_id = ?
    `;

    const params = [empleadoId];

    if (anio) {
      sql += ` AND n.anio = ?`;
      params.push(Number(anio));
    }

    if (mes) {
      sql += ` AND n.mes = ?`;
      params.push(Number(mes));
    }

    sql += ` ORDER BY n.fecha_pago DESC`;

    return await dbQuery.all(sql, params);
  },

  async getNominaDetalle(nominaId, empleadoId = null) {
    let sqlEncabezado = `
      SELECT 
        n.id,
        n.folio,
        n.periodo_nombre,
        n.periodo_pago,
        n.fecha_pago,
        n.sueldo_diario,
        n.dias_trabajados,
        n.horas_trabajadas,
        n.turno,
        n.jornada,
        n.quincena_semana,
        n.anio,
        n.mes,
        n.estatus,
        n.total_percepciones,
        n.total_deducciones,
        n.neto_pagado,
        emp.id AS emp_id,
        emp.nombre AS emp_nombre,
        emp.rfc AS emp_rfc,
        emp.registro_patronal AS emp_registro_patronal,
        e.id AS emp_empleado_id,
        e.nombre AS empleado_nombre,
        e.no_empleado,
        e.rfc AS empleado_rfc,
        e.curp AS empleado_curp,
        e.imss AS empleado_imss,
        e.departamento,
        e.puesto,
        e.abono_cuenta
      FROM nominas n
      INNER JOIN empresa emp ON n.empresa_id = emp.id
      INNER JOIN empleados e ON n.empleado_id = e.id
      WHERE n.id = ?
    `;

    const params = [nominaId];
    if (empleadoId) {
      sqlEncabezado += ` AND n.empleado_id = ?`;
      params.push(empleadoId);
    }

    const row = await dbQuery.get(sqlEncabezado, params);
    if (!row) return null;

    const conceptos = await dbQuery.all(
      `SELECT id, tipo, concepto, importe FROM conceptos_nomina WHERE nomina_id = ? ORDER BY id ASC`,
      [nominaId]
    );

    const percepciones = conceptos.filter(c => c.tipo === 'percepcion').map(c => ({ id: c.id, concepto: c.concepto, importe: c.importe }));
    const deducciones = conceptos.filter(c => c.tipo === 'deduccion').map(c => ({ id: c.id, concepto: c.concepto, importe: c.importe }));
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
