const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Configuración del Transporter de Nodemailer para SMTP
 */
function createTransporter() {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '465', 10);
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  // Verificamos si las credenciales son válidas o siguen en placeholder
  const isConfigured = user && pass && !user.includes('tu_cuenta@') && !pass.includes('tu_app_password');

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: isConfigured ? { user, pass } : undefined,
    tls: {
      rejectUnauthorized: false
    }
  });

  return { transporter, isConfigured, user, from: process.env.EMAIL_FROM || '"Eslabón Cloud" <no-reply@eslabon.com>' };
}

/**
 * Genera la plantilla HTML responsive con la identidad de Eslabón Cloud / PeopleTech para 2FA
 */
function generarPlantilla2FA(nombreEmpleado, codigo) {
  const nombreSeguro = nombreEmpleado || 'Colaborador';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Seguridad 2FA - Eslabón Cloud</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 40px 12px;">
    <tr>
      <td align="center">
        <!-- Tarjeta Principal -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Encabezado con fondo oscuro (#0f172a) -->
          <tr>
            <td style="background-color: #0f172a; padding: 34px 30px; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">
                    <div style="background-color: #2563eb; color: #ffffff; width: 40px; height: 40px; line-height: 40px; text-align: center; border-radius: 10px; font-weight: bold; font-size: 22px; display: inline-block;">
                      ☁️
                    </div>
                  </td>
                  <td style="vertical-align: middle; text-align: left;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">ESLABÓN CLOUD</h1>
                    <div style="color: #94a3b8; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 3px; font-weight: 600;">
                      BY PEOPLETECH
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo del Mensaje -->
          <tr>
            <td style="padding: 38px 36px 30px 36px; color: #334155; line-height: 1.6;">
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">
                Hola, ${nombreSeguro}
              </h2>
              
              <p style="margin: 0 0 22px 0; font-size: 15px; color: #475569;">
                Hemos recibido una solicitud para acceder a tu cuenta en el <strong>Portal de Autoservicio</strong>.
              </p>
              
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #64748b;">
                Para completar tu inicio de sesión de manera segura, ingresa el siguiente código de verificación en dos pasos:
              </p>

              <!-- Caja Destacada con el Código 2FA -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #eff6ff; border: 2px dashed #93c5fd; border-radius: 12px; padding: 24px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">
                      Código de Verificación (2FA)
                    </div>
                    <div style="font-size: 32px; letter-spacing: 6px; font-weight: 800; color: #2563eb; font-family: 'Courier New', Courier, monospace; margin: 8px 0 10px 0;">
                      ${codigo}
                    </div>
                    <p style="margin: 0; font-size: 13px; color: #64748b; font-weight: 500;">
                      ⏱️ Este código es válido durante los próximos <strong>5 minutos</strong>.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Advertencia de Seguridad -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 6px; margin-top: 26px;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                      ⚠️ <strong>Advertencia de seguridad:</strong> Si tú no solicitaste este código, ignora este mensaje o comunícate de inmediato con el área de TI. Nunca compartas este código con nadie.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Pie de Página -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 30px; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.5;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #64748b;">
                Eslabón Cloud HRMS • PeopleTech Solutions
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                Este es un mensaje automático de seguridad, por favor no respondas a este correo.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Genera la plantilla HTML responsive para la invitación de nuevos colaboradores
 */
function generarPlantillaInvitacion(correoDestino, temporalPassword, rol, departamento, puesto, invitadoPorNombre) {
  const portalUrl = process.env.PORTAL_URL || 'http://localhost:5173/';
  const anfitrion = invitadoPorNombre ? ` por <strong>${invitadoPorNombre}</strong>` : '';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitación a Eslabón Cloud</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 40px 12px;">
    <tr>
      <td align="center">
        <!-- Tarjeta Principal -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Encabezado con fondo oscuro (#0f172a) -->
          <tr>
            <td style="background-color: #0f172a; padding: 34px 30px; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">
                    <div style="background-color: #2563eb; color: #ffffff; width: 42px; height: 42px; line-height: 42px; text-align: center; border-radius: 10px; font-weight: bold; font-size: 22px; display: inline-block;">
                      ☁️
                    </div>
                  </td>
                  <td style="vertical-align: middle; text-align: left;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">ESLABÓN CLOUD</h1>
                    <div style="color: #94a3b8; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 3px; font-weight: 600;">
                      PORTAL DE AUTOSERVICIO DEL COLABORADOR
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo del Mensaje -->
          <tr>
            <td style="padding: 38px 36px 30px 36px; color: #334155; line-height: 1.6;">
              <div style="display: inline-block; background-color: #dbeafe; color: #1e40af; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">
                🎉 ¡Bienvenido(a) al equipo!
              </div>

              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 22px; font-weight: 800;">
                Has sido invitado(a) a Eslabón Cloud
              </h2>
              
              <p style="margin: 0 0 18px 0; font-size: 15px; color: #475569;">
                Has sido dado(a) de alta en la plataforma corporativa como <strong>${puesto || 'Colaborador'}</strong> en el departamento de <strong>${departamento || 'General'}</strong>${anfitrion}.
              </p>
              
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #64748b;">
                A continuación encontrarás tus credenciales de acceso inicial y tu contraseña provisional de un solo uso para activar tu cuenta:
              </p>

              <!-- Caja Destacada con Credenciales -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin: 20px 0 24px 0; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Correo de acceso:</span><br>
                    <span style="font-size: 15px; font-weight: 700; color: #0f172a;">${correoDestino}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px; background-color: #eff6ff; text-align: center;">
                    <div style="font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px;">
                      Contraseña Temporal (Un solo uso)
                    </div>
                    <div style="font-size: 26px; letter-spacing: 3px; font-weight: 800; color: #1e40af; font-family: 'Courier New', Courier, monospace; margin: 6px 0 8px 0;">
                      ${temporalPassword}
                    </div>
                    <span style="font-size: 12px; color: #64748b;">
                      🔒 Se te pedirá cambiarla inmediatamente al iniciar sesión
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Botón de Acción -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 20px 0; text-align: center;">
                <tr>
                  <td align="center">
                    <a href="${portalUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; letter-spacing: 0.5px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);">
                      Ingresar al Portal de Autoservicio →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Pasos de Activación -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; border-radius: 10px; padding: 18px 20px; margin-top: 24px;">
                <tr>
                  <td>
                    <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">
                      📋 Pasos para completar tu alta:
                    </div>
                    <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.7;">
                      <li>Inicia sesión con tu correo y la contraseña temporal proporcionada arriba.</li>
                      <li>Completa tu expediente obligatorio (RFC, CURP, NSS, teléfono y cuenta bancaria para nómina).</li>
                      <li>Define tu contraseña permanente personal.</li>
                    </ol>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Pie de Página -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 30px; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.5;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #64748b;">
                Eslabón Cloud HRMS • PeopleTech Solutions
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                Este correo fue enviado de forma automática tras el alta de tu usuario por parte de la empresa.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

const EmailService = {
  /**
   * Envía el código de autenticación de 2 pasos al correo especificado
   */
  async enviarCodigo2FA(correoDestino, nombreEmpleado, codigo) {
    const { transporter, isConfigured, from } = createTransporter();
    const htmlContent = generarPlantilla2FA(nombreEmpleado, codigo);

    const mailOptions = {
      from,
      to: correoDestino,
      subject: `🔐 Tu código de verificación Eslabón Cloud: ${codigo}`,
      text: `Hola ${nombreEmpleado},\n\nHemos recibido una solicitud para acceder a tu cuenta en el Portal de Autoservicio Eslabón Cloud.\n\nTu código de verificación de 6 dígitos es: ${codigo}\n\nEste código es válido durante los próximos 5 minutos.\n\nSi tú no solicitaste este código, ignora este mensaje o comunícate de inmediato con el área de TI.\n\nAtentamente,\nEslabón Cloud • PeopleTech Solutions`,
      html: htmlContent
    };

    if (!isConfigured) {
      console.log('\n============================================================');
      console.log('📧 [EMAIL 2FA - MODO LOCAL / SIMULACIÓN]');
      console.log(`👤 Para:      ${nombreEmpleado} <${correoDestino}>`);
      console.log(`🔑 Código:    >>>  ${codigo}  <<<`);
      console.log('ℹ️  Nota:      Configura EMAIL_USER y EMAIL_PASS en .env para entrega SMTP real.');
      console.log('============================================================\n');
      return {
        success: true,
        simulated: true,
        message: 'Código enviado (modo simulación / consola activa)'
      };
    }

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('\n============================================================');
      console.log('✉️  [EMAIL 2FA - ENVIADO CON ÉXITO]');
      console.log(`👤 Para:        ${nombreEmpleado} <${correoDestino}>`);
      console.log(`🔑 Código:      >>>  ${codigo}  <<<`);
      console.log(`📬 Message ID:  ${info.messageId}`);
      console.log('============================================================\n');

      return {
        success: true,
        simulated: false,
        messageId: info.messageId
      };
    } catch (error) {
      console.warn('\n============================================================');
      console.warn('⚠️  [EMAIL 2FA - ERROR AL ENVIAR POR SMTP]');
      console.warn(`👤 Destino:     ${correoDestino}`);
      console.warn(`❌ Error SMTP:  ${error.message}`);
      console.warn(`🔑 Código 2FA:  >>>  ${codigo}  <<< (Disponible para pruebas)`);
      console.warn('============================================================\n');

      return {
        success: false,
        simulated: true,
        error: error.message,
        message: 'No se pudo enviar el correo por SMTP, se mantiene disponible el código generado.'
      };
    }
  },

  /**
   * Envía la invitación con contraseña de un solo uso para onboarding
   */
  async enviarInvitacionColaborador(correoDestino, temporalPassword, rol, departamento, puesto, invitadoPorNombre) {
    const { transporter, isConfigured, from } = createTransporter();
    const htmlContent = generarPlantillaInvitacion(correoDestino, temporalPassword, rol, departamento, puesto, invitadoPorNombre);

    const mailOptions = {
      from,
      to: correoDestino,
      subject: `🎉 Bienvenido a Eslabón Cloud - Tu acceso de primer ingreso`,
      text: `Hola,\n\nHas sido invitado a formar parte de Eslabón Cloud como ${puesto} en ${departamento}.\n\nTu usuario de acceso: ${correoDestino}\nTu contraseña temporal de un solo uso: ${temporalPassword}\n\nIngresa al portal para completar tu expediente y definir tu contraseña permanente: ${process.env.PORTAL_URL || 'http://localhost:5173/'}\n\nAtentamente,\nEslabón Cloud • PeopleTech Solutions`,
      html: htmlContent
    };

    if (!isConfigured) {
      console.log('\n============================================================');
      console.log('📧 [EMAIL INVITACIÓN - MODO SIMULACIÓN]');
      console.log(`👤 Para:         <${correoDestino}>`);
      console.log(`🔑 Temp Pass:    >>>  ${temporalPassword}  <<<`);
      console.log(`🏢 Área/Puesto:  ${departamento} / ${puesto} (${rol})`);
      console.log('============================================================\n');
      return {
        success: true,
        simulated: true,
        message: 'Invitación generada (modo simulación / consola activa)'
      };
    }

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('\n============================================================');
      console.log('✉️  [EMAIL INVITACIÓN - ENVIADO CON ÉXITO]');
      console.log(`👤 Para:        <${correoDestino}>`);
      console.log(`🔑 Temp Pass:   >>>  ${temporalPassword}  <<<`);
      console.log(`📬 Message ID:  ${info.messageId}`);
      console.log('============================================================\n');

      return {
        success: true,
        simulated: false,
        messageId: info.messageId
      };
    } catch (error) {
      console.warn('\n============================================================');
      console.warn('⚠️  [EMAIL INVITACIÓN - ERROR SMTP]');
      console.warn(`👤 Destino:    ${correoDestino}`);
      console.warn(`❌ Error SMTP: ${error.message}`);
      console.warn(`🔑 Temp Pass:  >>>  ${temporalPassword}  <<< (Disponible para pruebas)`);
      console.warn('============================================================\n');

      return {
        success: false,
        simulated: true,
        error: error.message,
        message: 'No se pudo enviar por SMTP, credenciales disponibles en consola.'
      };
    }
  }
};

module.exports = EmailService;
