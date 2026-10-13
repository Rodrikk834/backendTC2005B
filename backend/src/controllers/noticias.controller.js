const NoticiasService = require('../services/noticias.service');

const NoticiasController = {
  async getNoticias(req, res) {
    try {
      const feed = await NoticiasService.getNoticiasFeed();
      return res.status(200).json(feed);
    } catch (error) {
      console.error('Error en NoticiasController.getNoticias:', error);
      return res.status(500).json({ error: 'Error interno al consultar noticias.' });
    }
  },

  async getNoticiaById(req, res) {
    try {
      const { id } = req.params;
      const noticia = await NoticiasService.getNoticiaById(id);
      if (!noticia) {
        return res.status(404).json({ error: 'Noticia no encontrada.' });
      }
      return res.status(200).json(noticia);
    } catch (error) {
      console.error('Error en NoticiasController.getNoticiaById:', error);
      return res.status(500).json({ error: 'Error interno al consultar noticia.' });
    }
  },

  async createNoticia(req, res) {
    try {
      const { titulo, categoria, resumen, contenido, autor, es_destacado } = req.body;

      if (!titulo || !contenido) {
        return res.status(400).json({ error: 'Los campos "titulo" y "contenido" son obligatorios.' });
      }

      const nuevaNoticia = await NoticiasService.createNoticia({
        titulo,
        categoria: categoria || 'Recursos Humanos',
        resumen,
        contenido,
        autor: autor || req.user?.nombre || 'Recursos Humanos',
        es_destacado: !!es_destacado
      });

      return res.status(201).json({
        message: 'Noticia creada exitosamente.',
        noticia: nuevaNoticia
      });
    } catch (error) {
      console.error('Error en NoticiasController.createNoticia:', error);
      return res.status(500).json({ error: 'Error interno al crear noticia.' });
    }
  },

  async updateNoticia(req, res) {
    try {
      const { id } = req.params;
      const noticia = await NoticiasService.updateNoticia(id, req.body);
      if (!noticia) {
        return res.status(404).json({ error: 'Noticia no encontrada.' });
      }

      return res.status(200).json({
        message: 'Noticia actualizada exitosamente.',
        noticia
      });
    } catch (error) {
      console.error('Error en NoticiasController.updateNoticia:', error);
      return res.status(500).json({ error: 'Error interno al actualizar noticia.' });
    }
  },

  async deleteNoticia(req, res) {
    try {
      const { id } = req.params;
      const eliminada = await NoticiasService.deleteNoticia(id);
      if (!eliminada) {
        return res.status(404).json({ error: 'Noticia no encontrada.' });
      }

      return res.status(200).json({
        message: 'Noticia eliminada exitosamente.',
        id: parseInt(id, 10)
      });
    } catch (error) {
      console.error('Error en NoticiasController.deleteNoticia:', error);
      return res.status(500).json({ error: 'Error interno al eliminar noticia.' });
    }
  }
};

module.exports = NoticiasController;
