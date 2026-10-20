const { dbQuery } = require('../config/database');

const EmpresaService = {
  /**
   * Obtiene el branding de una empresa específica por id_empresa o preset
   * @param {number|string} empresaIdOrPreset
   */
  async getBranding(empresaIdOrPreset = null) {
    let empresa = null;

    if (empresaIdOrPreset) {
      if (!isNaN(empresaIdOrPreset)) {
        empresa = await dbQuery.getOne(`
          SELECT 
            id_empresa,
            nombre_empresa,
            nombre_corto,
            logo_url,
            color_primario_dark,
            color_primario_light,
            color_acento,
            color_acento_light,
            preset_nombre
          FROM EMPRESAS
          WHERE id_empresa = @id
        `, { id: parseInt(empresaIdOrPreset, 10) });
      } else {
        const cleanStr = String(empresaIdOrPreset).trim().toLowerCase();
        empresa = await dbQuery.getOne(`
          SELECT 
            id_empresa,
            nombre_empresa,
            nombre_corto,
            logo_url,
            color_primario_dark,
            color_primario_light,
            color_acento,
            color_acento_light,
            preset_nombre
          FROM EMPRESAS
          WHERE LOWER(preset_nombre) = LOWER(@str) 
             OR LOWER(nombre_corto) = LOWER(@str)
             OR LOWER(nombre_empresa) LIKE '%' + LOWER(@str) + '%'
        `, { str: cleanStr });
      }
    }

    // Si no se especificó o no se encontró, tomamos la empresa 1 (Atlas) por defecto
    if (!empresa) {
      empresa = await dbQuery.getOne(`
        SELECT TOP 1
          id_empresa,
          nombre_empresa,
          nombre_corto,
          logo_url,
          color_primario_dark,
          color_primario_light,
          color_acento,
          color_acento_light,
          preset_nombre
        FROM EMPRESAS
        ORDER BY id_empresa ASC
      `);
    }

    if (!empresa) {
      return {
        empresaId: 1,
        companyName: 'ATLAS SOLUTIONS S.A. DE C.V.',
        shortName: 'Atlas Solutions',
        logoUrl: '/assets/favicon/favicon.svg',
        primaryDark: '#1A365D',
        primaryLight: '#2B6CB0',
        accentColor: '#00B894',
        accentLight: '#E6F8F5',
        presetName: 'atlas'
      };
    }

    return {
      empresaId: empresa.id_empresa,
      companyName: empresa.nombre_empresa,
      shortName: empresa.nombre_corto || empresa.nombre_empresa,
      logoUrl: empresa.logo_url || '/assets/favicon/favicon.svg',
      primaryDark: empresa.color_primario_dark || '#1A365D',
      primaryLight: empresa.color_primario_light || '#2B6CB0',
      accentColor: empresa.color_acento || '#00B894',
      accentLight: empresa.color_acento_light || '#E6F8F5',
      presetName: empresa.preset_nombre || 'custom'
    };
  },

  /**
   * Actualiza el branding de la empresa con Aislamiento Estricto por ID de empresa
   */
  async updateBrandingByEmpresaId(empresaId, data) {
    const id = parseInt(empresaId, 10);
    if (!id || isNaN(id)) {
      throw new Error('ID de empresa no válido para actualizar branding.');
    }

    const shortName = data.shortName || data.nombre_corto || data.companyName;
    const logoUrl = data.logoUrl || data.logo_url;
    const primaryDark = data.primaryDark || data.color_primario_dark;
    const primaryLight = data.primaryLight || data.color_primario_light;
    const accentColor = data.accentColor || data.color_acento;
    const accentLight = data.accentLight || data.color_acento_light;
    const presetName = data.presetName || data.preset_nombre || 'custom';

    await dbQuery.query(`
      UPDATE EMPRESAS
      SET 
        nombre_corto = ISNULL(@shortName, nombre_corto),
        logo_url = ISNULL(@logoUrl, logo_url),
        color_primario_dark = ISNULL(@primaryDark, color_primario_dark),
        color_primario_light = ISNULL(@primaryLight, color_primario_light),
        color_acento = ISNULL(@accentColor, color_acento),
        color_acento_light = ISNULL(@accentLight, color_acento_light),
        preset_nombre = ISNULL(@presetName, preset_nombre),
        fecha_actualizacion = GETDATE()
      WHERE id_empresa = @empresaId;
    `, {
      shortName: shortName ? String(shortName).trim() : null,
      logoUrl: logoUrl ? String(logoUrl).trim() : null,
      primaryDark: primaryDark ? String(primaryDark).trim() : null,
      primaryLight: primaryLight ? String(primaryLight).trim() : null,
      accentColor: accentColor ? String(accentColor).trim() : null,
      accentLight: accentLight ? String(accentLight).trim() : null,
      presetName: presetName ? String(presetName).trim() : null,
      empresaId: id
    });

    console.log(`\n🎨 [BRANDING ACTUALIZADO] Empresa ID: ${id} | Nombre: ${shortName} | Preset: ${presetName}\n`);

    return {
      success: true,
      message: 'Marca corporativa actualizada exitosamente'
    };
  },

  /**
   * Obtiene la lista de todas las empresas en el sistema
   */
  async getListaEmpresas() {
    const list = await dbQuery.getAll(`
      SELECT 
        id_empresa,
        nombre_empresa,
        nombre_corto,
        logo_url,
        color_primario_dark,
        color_primario_light,
        color_acento,
        color_acento_light,
        preset_nombre,
        fecha_actualizacion
      FROM EMPRESAS
      ORDER BY id_empresa ASC
    `);

    return list.map(e => ({
      id: e.id_empresa,
      id_empresa: e.id_empresa,
      nombre_empresa: e.nombre_empresa,
      nombre_corto: e.nombre_corto || e.nombre_empresa,
      companyName: e.nombre_empresa,
      shortName: e.nombre_corto || e.nombre_empresa,
      logoUrl: e.logo_url,
      primaryDark: e.color_primario_dark,
      primaryLight: e.color_primario_light,
      accentColor: e.color_acento,
      accentLight: e.color_acento_light,
      presetName: e.preset_nombre
    }));
  }
};

module.exports = EmpresaService;
