const { dbQuery } = require('../config/database');

const OficinaService = {
  
  // 1. Obtener los muebles del usuario por categoría (para el UI de Unity)
  async obtenerInventario(idUsuario, ordenUI) {
    try {
      // Usamos dbQuery.query con sintaxis EXEC en lugar de execute
      const sqlText = `EXEC sp_GetInventarioUI @IdUsuario = @idUsuario, @OrdenUI = @ordenUI`;
      
      const resultado = await dbQuery.query(sqlText, {
        idUsuario: parseInt(idUsuario, 10),
        ordenUI: parseInt(ordenUI, 10)
      });
      
      // Dependiendo de cómo armaste tu wrapper dbQuery, puede devolver el arreglo
      // directo o dentro de un objeto 'recordset'. Esto cubre ambas opciones.
      return resultado.recordset ? resultado.recordset : resultado;
    } catch (error) {
      console.error('Error en OficinaService.obtenerInventario:', error);
      throw error;
    }
  },

  // 2. Obtener el layout actual de la oficina del usuario
  async obtenerOficina(idUsuario) {
    try {
      const sqlText = `
        SELECT layout_json 
        FROM OFICINAS_VIRTUALES 
        WHERE id_usuario = @idUsuario
      `;
      const result = await dbQuery.getOne(sqlText, { idUsuario: parseInt(idUsuario, 10) });
      return result ? result.layout_json : null;
    } catch (error) {
      console.error('Error en OficinaService.obtenerOficina:', error);
      throw error;
    }
  },

  // 3. Guardar o actualizar la oficina del usuario
  async guardarOficina(idUsuario, layoutJson) {
    try {
      // Utilizamos MERGE o lógica de IF/ELSE en SQL para hacer Upsert
      const sqlText = `
        IF EXISTS (SELECT 1 FROM OFICINAS_VIRTUALES WHERE id_usuario = @idUsuario)
        BEGIN
            UPDATE OFICINAS_VIRTUALES 
            SET layout_json = @layoutJson, ultima_modificacion = GETDATE()
            WHERE id_usuario = @idUsuario;
        END
        ELSE
        BEGIN
            INSERT INTO OFICINAS_VIRTUALES (id_usuario, layout_json)
            VALUES (@idUsuario, @layoutJson);
        END
      `;
      await dbQuery.query(sqlText, {
        idUsuario: parseInt(idUsuario, 10),
        layoutJson: JSON.stringify(layoutJson) // Aseguramos que se guarde como string
      });
      return true;
    } catch (error) {
      console.error('Error en OficinaService.guardarOficina:', error);
      throw error;
    }
  }
};

module.exports = OficinaService;