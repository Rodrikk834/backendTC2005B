const { dbQuery } = require('../config/database');

class TiendaController {
    static async obtenerCatalogo(req, res) {
        try {
            const sqlText = `
                SELECT 
                    id_objeto,
                    nombre,
                    descripcion,
                    costo_puntos,
                    unity_asset_key,
                    id_categoria,
                    tipo_articulo
                FROM CAT_OBJETOS_TIENDA
            `;

            const catalogoBD = await dbQuery.getAll(sqlText);
            return res.json({
                success: true,
                items: catalogoBD
            });

        } catch (error) {
            console.error('Error al obtener el catálogo de la tienda:', error);
            return res.status(500).json({ 
                success: false, 
                error: 'Error interno al cargar la tienda' 
            });
        }
    }

static async comprarMueble(req, res) {
        const { id_usuario, id_objeto } = req.body;

        try {
            const resultado = await dbQuery.getOne(
                `EXEC sp_ComprarObjetoTienda @IdUsuario = ${id_usuario}, @IdObjeto = ${id_objeto}`
            );

            return res.json({ 
                success: true, 
                message: '¡Compra exitosa!',
                nuevo_saldo: resultado.puntos_balance
            });

        } catch (error) {
            console.error('Error en la compra:', error.message);

            if (error.message.includes('Saldo insuficiente')) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Saldo insuficiente para realizar la compra.' 
                });
            }

            return res.status(500).json({ 
                success: false, 
                error: 'Error del servidor al procesar la compra.' 
            });
        }
    }
}

module.exports = TiendaController;