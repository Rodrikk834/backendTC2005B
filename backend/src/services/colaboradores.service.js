const { dbQuery } = require('../config/database');
const { hashPassword } = require('../utils/hashing');
const EmailService = require('./email.service');

const ColaboradoresService = {
  /**
   * Invita a un nuevo colaborador generando acceso con contraseña de un solo uso
   */
  async invitarColaborador({ email, rol, departamento, puesto, invitadoPorId, invitadoPorNombre }) {
    if (!email) {
      throw new Error('El correo electrónico es requerido.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanRol = rol || 'Colaborador';
    const cleanDepto = (departamento || 'General').trim();
    const cleanPuesto = (puesto || 'Colaborador').trim();

    // 1. Verificar si ya existe un usuario o persona con ese correo
    const existeUsuario = await dbQuery.getOne(`
      SELECT u.id_usuario 
      FROM USUARIOS_PORTAL u
      LEFT JOIN EMPLEADOS e ON u.id_empleado = e.id_empleado
      LEFT JOIN PERSONAS p ON e.id_persona = p.id_persona
      WHERE LOWER(u.username) = LOWER(@email) OR LOWER(p.correo_personal) = LOWER(@email)
    `, { email: cleanEmail });

    if (existeUsuario) {
      throw new Error('El correo electrónico ya se encuentra registrado en el sistema.');
    }

    // 2. Resolver o crear departamento
    let depto = await dbQuery.getOne(`
      SELECT id_departamento 
      FROM CAT_DEPARTAMENTOS 
      WHERE LOWER(nombre_departamento) = LOWER(@depto)
    `, { depto: cleanDepto });

    let idDepartamento = depto ? depto.id_departamento : null;
    if (!idDepartamento) {
      const nuevoDepto = await dbQuery.getOne(`
        INSERT INTO CAT_DEPARTAMENTOS (id_compania, nombre_departamento)
        VALUES (1, @depto);
        SELECT SCOPE_IDENTITY() AS id_departamento;
      `, { depto: cleanDepto });
      idDepartamento = nuevoDepto.id_departamento;
    }

    // 3. Resolver o crear puesto
    let puestoRow = await dbQuery.getOne(`
      SELECT id_puesto 
      FROM CAT_PUESTOS 
      WHERE LOWER(nombre_puesto) = LOWER(@puesto)
    `, { puesto: cleanPuesto });

    let idPuesto = puestoRow ? puestoRow.id_puesto : null;
    if (!idPuesto) {
      const nuevoPuesto = await dbQuery.getOne(`
        INSERT INTO CAT_PUESTOS (nombre_puesto, nivel_jerarquico)
        VALUES (@puesto, 3);
        SELECT SCOPE_IDENTITY() AS id_puesto;
      `, { puesto: cleanPuesto });
      idPuesto = nuevoPuesto.id_puesto;
    }

    // 4. Generar contraseña de un solo uso hasheada con Bcrypt
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const randomDigits = Math.floor(100 + Math.random() * 900);
    const tempPassword = `Eslabon.${randomSuffix}${randomDigits}!`;
    const passwordHash = await hashPassword(tempPassword);

    // 5. Crear registro inicial en PERSONAS
    const nuevaPersona = await dbQuery.getOne(`
      INSERT INTO PERSONAS (
        nombre, paterno, materno, correo_personal, fecha_nacimiento, rfc, curp
      )
      VALUES (
        'Pendiente de Registro', NULL, NULL, @email, NULL, NULL, NULL
      );
      SELECT SCOPE_IDENTITY() AS id_persona;
    `, { email: cleanEmail });
    const idPersona = nuevaPersona.id_persona;

    // 6. Crear registro en EMPLEADOS
    const jefeId = invitadoPorId && !isNaN(invitadoPorId) ? Number(invitadoPorId) : null;
    const nuevoEmpleado = await dbQuery.getOne(`
      INSERT INTO EMPLEADOS (
        id_persona, id_compania, id_departamento, id_puesto,
        fecha_ingreso, estatus, id_jefe_inmediato, numero_seguridad_social
      )
      VALUES (
        @id_persona, 1, @id_departamento, @id_puesto,
        CAST(GETDATE() AS DATE), 'Pendiente', @id_jefe, NULL
      );
      SELECT SCOPE_IDENTITY() AS id_empleado;
    `, {
      id_persona: idPersona,
      id_departamento: idDepartamento,
      id_puesto: idPuesto,
      id_jefe: jefeId
    });
    const idEmpleado = nuevoEmpleado.id_empleado;

    // 7. Crear usuario en USUARIOS_PORTAL con primer_acceso = 1
    const nuevoUsuario = await dbQuery.getOne(`
      INSERT INTO USUARIOS_PORTAL (
        id_empleado, username, password_hash, rol, primer_acceso, puntos_balance
      )
      VALUES (
        @id_empleado, @username, @password_hash, @rol, 1, 0
      );
      SELECT SCOPE_IDENTITY() AS id_usuario;
    `, {
      id_empleado: idEmpleado,
      username: cleanEmail,
      password_hash: passwordHash,
      rol: cleanRol
    });
    const idUsuario = nuevoUsuario.id_usuario;

    // 8. Enviar correo de invitación con credenciales temporales
    console.log('\n============================================================');
    console.log('🎉 [NUEVA INVITACIÓN DE COLABORADOR REGISTRADA]');
    console.log(`👤 Correo:           ${cleanEmail}`);
    console.log(`🏢 Departamento:     ${cleanDepto}`);
    console.log(`💼 Puesto:           ${cleanPuesto} (${cleanRol})`);
    console.log(`🔑 Pass Un Solo Uso: >>>  ${tempPassword}  <<<`);
    console.log('============================================================\n');

    try {
      await EmailService.enviarInvitacionColaborador(
        cleanEmail,
        tempPassword,
        cleanRol,
        cleanDepto,
        cleanPuesto,
        invitadoPorNombre
      );
    } catch (mailError) {
      console.warn('Advertencia al enviar correo de invitación:', mailError.message);
    }

    return {
      id: idUsuario,
      id_usuario: idUsuario,
      id_empleado: idEmpleado,
      email: cleanEmail,
      rol: cleanRol,
      departamento: cleanDepto,
      puesto: cleanPuesto,
      primerAcceso: true,
      tempPassword
    };
  },

  /**
   * Obtiene la lista de colaboradores con su estado (activo / pendiente de registro)
   */
  async getColaboradores({ departamento } = {}) {
    let query = `
      SELECT 
        e.id_empleado,
        u.id_usuario,
        u.username,
        u.rol,
        ISNULL(u.primer_acceso, 0) AS primer_acceso,
        e.estatus,
        e.fecha_ingreso,
        p.nombre,
        p.paterno,
        p.materno,
        p.correo_personal,
        ISNULL(d.nombre_departamento, 'General') AS departamento,
        ISNULL(pu.nombre_puesto, 'Colaborador') AS puesto
      FROM USUARIOS_PORTAL u
      JOIN EMPLEADOS e ON u.id_empleado = e.id_empleado
      JOIN PERSONAS p ON e.id_persona = p.id_persona
      LEFT JOIN CAT_DEPARTAMENTOS d ON e.id_departamento = d.id_departamento
      LEFT JOIN CAT_PUESTOS pu ON e.id_puesto = pu.id_puesto
    `;

    const params = {};
    if (departamento && departamento.trim() !== '') {
      query += ` WHERE LOWER(d.nombre_departamento) = LOWER(@departamento)`;
      params.departamento = departamento.trim();
    }

    query += ` ORDER BY e.id_empleado ASC`;

    const rows = await dbQuery.getAll(query, params);

    return rows.map(r => {
      const isPending = Boolean(r.primer_acceso);
      const nombreCompleto = (isPending && (!r.paterno || r.paterno.trim() === ''))
        ? 'Pendiente de Registro'
        : `${r.nombre || ''} ${r.paterno || ''} ${r.materno || ''}`.replace(/\s+/g, ' ').trim();

      return {
        id: r.id_empleado,
        id_empleado: r.id_empleado,
        id_usuario: r.id_usuario,
        nombre: nombreCompleto,
        email: r.correo_personal || r.username,
        departamento: r.departamento,
        puesto: r.puesto,
        rol: r.rol || 'Colaborador',
        estado: isPending ? 'pendiente' : (r.estatus ? r.estatus.toLowerCase() : 'activo'),
        primerAcceso: isPending,
        fechaIngreso: r.fecha_ingreso ? new Date(r.fecha_ingreso).toLocaleDateString('es-MX') : ''
      };
    });
  },

  /**
   * Completa el onboarding y expediente laboral de un colaborador invitado
   */
  async completarRegistro({
    userId,
    email,
    password,
    nombre,
    paterno,
    materno,
    rfc,
    curp,
    imss,
    telefono,
    banco,
    clabe_interbancaria,
    numero_cuenta
  }) {
    if (!password || password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres.');
    }
    if (!rfc || !curp) {
      throw new Error('El RFC y el CURP son obligatorios para completar el expediente.');
    }

    const searchId = userId && !isNaN(userId) ? Number(userId) : -1;
    const searchEmail = (email || '').trim().toLowerCase();

    // 1. Localizar al usuario y empleado
    const user = await dbQuery.getOne(`
      SELECT 
        u.id_usuario,
        u.id_empleado,
        u.username,
        u.rol,
        e.id_persona,
        d.nombre_departamento AS departamento,
        pu.nombre_puesto AS puesto
      FROM USUARIOS_PORTAL u
      JOIN EMPLEADOS e ON u.id_empleado = e.id_empleado
      LEFT JOIN CAT_DEPARTAMENTOS d ON e.id_departamento = d.id_departamento
      LEFT JOIN CAT_PUESTOS pu ON e.id_puesto = pu.id_puesto
      WHERE u.id_usuario = @searchId OR e.id_empleado = @searchId OR LOWER(u.username) = LOWER(@searchEmail)
    `, { searchId, searchEmail });

    if (!user) {
      throw new Error('No se encontró el colaborador para completar el expediente.');
    }

    // 2. Actualizar datos en PERSONAS
    await dbQuery.query(`
      UPDATE PERSONAS SET
        nombre = @nombre,
        paterno = @paterno,
        materno = @materno,
        rfc = @rfc,
        curp = @curp,
        telefono_movil = @telefono
      WHERE id_persona = @id_persona
    `, {
      nombre: (nombre || '').trim(),
      paterno: (paterno || '').trim(),
      materno: (materno || '').trim(),
      rfc: (rfc || '').trim().toUpperCase(),
      curp: (curp || '').trim().toUpperCase(),
      telefono: (telefono || '').trim(),
      id_persona: user.id_persona
    });

    // 3. Actualizar NSS y estatus en EMPLEADOS
    await dbQuery.query(`
      UPDATE EMPLEADOS SET
        numero_seguridad_social = @imss,
        estatus = 'Activo'
      WHERE id_empleado = @id_empleado
    `, {
      imss: (imss || '').trim(),
      id_empleado: user.id_empleado
    });

    // 4. Guardar cuenta bancaria en CUENTAS_BANCARIAS
    if (banco && clabe_interbancaria) {
      const existeCuenta = await dbQuery.getOne(`
        SELECT id_cuenta FROM CUENTAS_BANCARIAS WHERE id_empleado = @id_empleado
      `, { id_empleado: user.id_empleado });

      if (existeCuenta) {
        await dbQuery.query(`
          UPDATE CUENTAS_BANCARIAS SET
            banco = @banco,
            clabe_interbancaria = @clabe,
            numero_cuenta = @cuenta
          WHERE id_empleado = @id_empleado
        `, {
          banco: (banco || '').trim(),
          clabe: (clabe_interbancaria || '').trim(),
          cuenta: (numero_cuenta || '').trim(),
          id_empleado: user.id_empleado
        });
      } else {
        await dbQuery.query(`
          INSERT INTO CUENTAS_BANCARIAS (
            id_empleado, banco, clabe_interbancaria, numero_cuenta, tipo_cuenta
          )
          VALUES (
            @id_empleado, @banco, @clabe, @cuenta, 'Nómina'
          )
        `, {
          id_empleado: user.id_empleado,
          banco: (banco || '').trim(),
          clabe: (clabe_interbancaria || '').trim(),
          cuenta: (numero_cuenta || '').trim()
        });
      }
    }

    // 5. Actualizar contraseña permanente hasheada con Bcrypt y remover bandera primer_acceso
    const newPasswordHash = await hashPassword(password);
    await dbQuery.query(`
      UPDATE USUARIOS_PORTAL SET
        password_hash = @password_hash,
        primer_acceso = 0
      WHERE id_usuario = @id_usuario
    `, {
      password_hash: newPasswordHash,
      id_usuario: user.id_usuario
    });

    const nombreCompleto = `${nombre || ''} ${paterno || ''} ${materno || ''}`.replace(/\s+/g, ' ').trim();
    const finalToken = `jwt-active-${user.id_usuario}-${Date.now()}`;

    console.log('\n============================================================');
    console.log('✅ [EXPEDIENTE Y ONBOARDING COMPLETADO CON ÉXITO]');
    console.log(`👤 Colaborador:   ${nombreCompleto}`);
    console.log(`📧 Correo:        ${user.username}`);
    console.log(`🏢 Departamento:  ${user.departamento}`);
    console.log(`🔒 Cuenta:        Activada con nueva contraseña permanente`);
    console.log('============================================================\n');

    return {
      message: 'Expediente completado y cuenta activada con éxito.',
      token: finalToken,
      user: {
        id: user.id_empleado,
        id_empleado: user.id_empleado,
        id_usuario: user.id_usuario,
        no_empleado: String(user.id_empleado),
        nombre: nombreCompleto,
        name: nombreCompleto,
        email: user.username,
        username: user.username,
        rol: user.rol,
        role: user.rol,
        departamento: user.departamento,
        puesto: user.puesto,
        rfc: rfc.toUpperCase(),
        curp: curp.toUpperCase(),
        imss: imss,
        telefono: telefono,
        banco: banco,
        clabe_interbancaria: clabe_interbancaria,
        numero_cuenta: numero_cuenta,
        abono_cuenta: `${banco} - CLABE: ${clabe_interbancaria}`,
        avatar: '/assets/default-user.png',
        primerAcceso: false,
        primer_acceso: false
      }
    };
  }
};

module.exports = ColaboradoresService;
