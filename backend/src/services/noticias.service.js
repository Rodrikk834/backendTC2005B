const { dbQuery } = require('../config/database');

const NoticiasService = {
  async getNoticiasFeed() {
    try {
      const sqlNoticias = `
        SELECT 
          id_noticia AS id,
          titulo,
          categoria,
          resumen,
          contenido,
          autor,
          CONVERT(VARCHAR, fecha_publicacion, 23) AS fecha_publicacion,
          es_destacado
        FROM NOTICIAS
        ORDER BY es_destacado DESC, fecha_publicacion DESC
      `;

      const sqlEventos = `
        SELECT 
          id_evento AS id,
          titulo,
          subtitulo,
          CONVERT(VARCHAR, fecha_evento, 23) AS fecha_evento,
          tipo
        FROM EVENTOS_INSTITUCIONALES
        ORDER BY fecha_evento ASC
      `;

      const noticias = await dbQuery.getAll(sqlNoticias);
      const eventos = await dbQuery.getAll(sqlEventos);

      return {
        noticias,
        eventos
      };
    } catch (err) {
      console.warn('Tablas NOTICIAS / EVENTOS_INSTITUCIONALES no creadas aún en la BD:', err.message);
      return { noticias: [], eventos: [] };
    }
  },

  async getNoticiaById(id) {
    const noticiaId = parseInt(id, 10);
    const sqlText = `
      SELECT 
        id_noticia AS id,
        titulo,
        categoria,
        resumen,
        contenido,
        autor,
        CONVERT(VARCHAR, fecha_publicacion, 23) AS fecha_publicacion,
        es_destacado
      FROM NOTICIAS
      WHERE id_noticia = @noticiaId
    `;
    return await dbQuery.getOne(sqlText, { noticiaId });
  },

  async createNoticia({ titulo, categoria, resumen, contenido, autor, es_destacado }) {
    const sqlText = `
      INSERT INTO NOTICIAS (titulo, categoria, resumen, contenido, autor, fecha_publicacion, es_destacado)
      OUTPUT INSERTED.id_noticia
      VALUES (@titulo, @categoria, @resumen, @contenido, @autor, GETDATE(), @esDestacado)
    `;

    const res = await dbQuery.getOne(sqlText, {
      titulo: titulo.trim(),
      categoria: (categoria || 'Recursos Humanos').trim(),
      resumen: resumen ? resumen.trim() : null,
      contenido: contenido.trim(),
      autor: autor ? autor.trim() : 'Recursos Humanos',
      esDestacado: es_destacado ? 1 : 0
    });

    return await this.getNoticiaById(res.id_noticia);
  },

  async updateNoticia(id, datos) {
    const noticiaId = parseInt(id, 10);
    const existente = await this.getNoticiaById(noticiaId);
    if (!existente) return null;

    const sets = [];
    const params = { noticiaId };

    if (datos.titulo !== undefined) {
      sets.push('titulo = @titulo');
      params.titulo = datos.titulo.trim();
    }
    if (datos.categoria !== undefined) {
      sets.push('categoria = @categoria');
      params.categoria = datos.categoria.trim();
    }
    if (datos.resumen !== undefined) {
      sets.push('resumen = @resumen');
      params.resumen = datos.resumen ? datos.resumen.trim() : null;
    }
    if (datos.contenido !== undefined) {
      sets.push('contenido = @contenido');
      params.contenido = datos.contenido.trim();
    }
    if (datos.autor !== undefined) {
      sets.push('autor = @autor');
      params.autor = datos.autor ? datos.autor.trim() : null;
    }
    if (datos.es_destacado !== undefined) {
      sets.push('es_destacado = @esDestacado');
      params.esDestacado = datos.es_destacado ? 1 : 0;
    }

    if (sets.length > 0) {
      const sqlText = `UPDATE NOTICIAS SET ${sets.join(', ')} WHERE id_noticia = @noticiaId`;
      await dbQuery.query(sqlText, params);
    }

    return await this.getNoticiaById(noticiaId);
  },

  async deleteNoticia(id) {
    const noticiaId = parseInt(id, 10);
    const existente = await this.getNoticiaById(noticiaId);
    if (!existente) return false;

    await dbQuery.query(`DELETE FROM NOTICIAS WHERE id_noticia = @noticiaId`, { noticiaId });
    return true;
  }
};

module.exports = NoticiasService;
