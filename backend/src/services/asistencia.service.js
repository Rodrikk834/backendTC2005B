const { dbQuery } = require('../config/database');

const AsistenciaService = {
  async getAsistenciaByEmpleado(empleadoId, { anio, mes } = {}) {
    let sqlText = `
      SELECT 
        id_registro AS id,
        CONVERT(VARCHAR, fecha, 23) AS fecha,
        CONVERT(VARCHAR, hora_entrada, 108) AS hora_entrada,
        CONVERT(VARCHAR, hora_salida, 108) AS hora_salida,
        horas_ordinarias,
        horas_extra,
        metodo,
        estado
      FROM REGISTROS_ASISTENCIA
      WHERE id_empleado = @empleadoId
    `;

    const params = { empleadoId: parseInt(empleadoId, 10) || 1 };

    if (anio) {
      sqlText += ` AND YEAR(fecha) = @anio`;
      params.anio = parseInt(anio, 10);
    }

    if (mes) {
      sqlText += ` AND MONTH(fecha) = @mes`;
      params.mes = parseInt(mes, 10);
    }

    sqlText += ` ORDER BY fecha DESC`;

    try {
      return await dbQuery.getAll(sqlText, params);
    } catch (err) {
      console.warn('Tabla REGISTROS_ASISTENCIA no creada aún en la BD:', err.message);
      return [];
    }
  },

  async getBitacoraByEmpleado(empleadoId) {
    const registros = await this.getAsistenciaByEmpleado(empleadoId);

    const totalAsistencias = registros.filter(r => r.estado === 'Puntual' || r.estado === 'Retardo').length;
    const totalRetardos = registros.filter(r => r.estado === 'Retardo').length;
    const totalFaltas = registros.filter(r => r.estado === 'Falta').length;
    const horasExtraTotales = registros.reduce((acc, r) => acc + (Number(r.horas_extra) || 0), 0);

    return {
      kpis: {
        totalAsistencias,
        totalRetardos,
        totalFaltas,
        horasExtraTotales
      },
      bitacora: registros
    };
  }
};

module.exports = AsistenciaService;
