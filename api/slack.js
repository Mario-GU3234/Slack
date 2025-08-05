const { App } = require('@slack/bolt');
const sheetsService = require('./utils/sheets');
require('dotenv').config();

console.log('🚀 Iniciando Slack Bot...');

// Verificar variables de entorno
const requiredEnvVars = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'GOOGLE_SHEETS_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Variable de entorno faltante: ${envVar}`);
    process.exit(1);
  }
}

// Inicializar Slack App
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true, // Importante para Vercel
});

console.log('✅ Slack App configurada correctamente');

// ==========================================
// SLASH COMMAND: /formulario
// ==========================================
app.command('/formulario', async ({ command, ack, body, client }) => {
  console.log(`📝 Comando /formulario ejecutado por: ${body.user_name}`);
  
  // Responder INMEDIATAMENTE - Sin timeout
  await ack();

  try {
    // Abrir modal - SÚPER RÁPIDO, no hay procesamiento
    const result = await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'form_submission',
        title: {
          type: 'plain_text',
          text: '📋 Formulario de Registro'
        },
        submit: {
          type: 'plain_text',
          text: 'Enviar'
        },
        close: {
          type: 'plain_text',
          text: 'Cancelar'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*¡Hola! 👋 Completa la siguiente información:*'
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'input',
            block_id: 'nombre_block',
            element: {
              type: 'plain_text_input',
              action_id: 'nombre_input',
              placeholder: {
                type: 'plain_text',
                text: 'Ej: Juan Pérez García'
              },
              max_length: 100
            },
            label: {
              type: 'plain_text',
              text: '👤 Nombre Completo'
            }
          },
          {
            type: 'input',
            block_id: 'email_block',
            element: {
              type: 'plain_text_input',
              action_id: 'email_input',
              placeholder: {
                type: 'plain_text',
                text: 'ejemplo@empresa.com'
              }
            },
            label: {
              type: 'plain_text',
              text: '📧 Correo Electrónico'
            }
          },
          {
            type: 'input',
            block_id: 'departamento_block',
            element: {
              type: 'static_select',
              action_id: 'departamento_select',
              placeholder: {
                type: 'plain_text',
                text: 'Selecciona tu área de trabajo'
              },
              options: [
                {
                  text: { type: 'plain_text', text: '💼 Ventas' },
                  value: 'ventas'
                },
                {
                  text: { type: 'plain_text', text: '📈 Marketing' },
                  value: 'marketing'
                },
                {
                  text: { type: 'plain_text', text: '💻 Desarrollo/IT' },
                  value: 'desarrollo'
                },
                {
                  text: { type: 'plain_text', text: '👥 Recursos Humanos' },
                  value: 'rrhh'
                },
                {
                  text: { type: 'plain_text', text: '🎧 Soporte al Cliente' },
                  value: 'soporte'
                },
                {
                  text: { type: 'plain_text', text: '📊 Administración' },
                  value: 'admin'
                },
                {
                  text: { type: 'plain_text', text: '🏭 Operaciones' },
                  value: 'operaciones'
                },
                {
                  text: { type: 'plain_text', text: '🎯 Otro' },
                  value: 'otro'
                }
              ]
            },
            label: {
              type: 'plain_text',
              text: '🏢 Departamento'
            }
          },
          {
            type: 'input',
            block_id: 'mensaje_block',
            element: {
              type: 'plain_text_input',
              action_id: 'mensaje_input',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Describe tu solicitud, comentario o consulta aquí...'
              },
              max_length: 500
            },
            label: {
              type: 'plain_text',
              text: '💬 Mensaje o Consulta'
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '🔒 _Tus datos serán tratados de forma confidencial_'
              }
            ]
          }
        ]
      }
    });

    console.log(`✅ Modal abierto exitosamente para ${body.user_name}`);

  } catch (error) {
    console.error('❌ Error abriendo modal:', error);
    
    // Respuesta de fallback
    try {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ Hubo un error abriendo el formulario. Por favor intenta de nuevo.'
      });
    } catch (ephemeralError) {
      console.error('Error enviando mensaje de error:', ephemeralError);
    }
  }
});

// ==========================================
// MODAL SUBMISSION: Procesar formulario  
// ==========================================
app.view('form_submission', async ({ ack, body, view, client }) => {
  console.log(`📤 Formulario enviado por: ${body.user.name}`);
  
  // Responder inmediatamente que recibimos el formulario
  await ack();

  const user = body.user;
  const values = view.state.values;
  
  try {
    // Extraer y validar datos del formulario
    const nombre = values.nombre_block.nombre_input.value?.trim();
    const email = values.email_block.email_input.value?.trim();
    const departamentoValue = values.departamento_block.departamento_select.selected_option?.value;
    const departamentoText = values.departamento_block.departamento_select.selected_option?.text?.text;
    const mensaje = values.mensaje_block.mensaje_input.value?.trim();

    // Validaciones básicas
    if (!nombre || !email || !departamentoValue || !mensaje) {
      throw new Error('Todos los campos son obligatorios');
    }

    // Validación básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('El formato del email no es válido');
    }

    // Preparar datos para Google Sheets
    const formData = {
      userSlack: user.name,
      userId: user.id,
      nombre: nombre,
      email: email,
      departamento: departamentoText,
      mensaje: mensaje
    };

    console.log('📋 Datos del formulario:', {
      usuario: formData.userSlack,
      nombre: formData.nombre,
      departamento: formData.departamento,
      email: formData.email.substring(0, 3) + '***' // Log parcial por seguridad
    });

    // Enviar a Google Sheets
    console.log('📊 Enviando datos a Google Sheets...');
    const result = await sheetsService.addRow(formData);
    
    if (result.success) {
      // ✅ ÉXITO - Mensaje por DM
      await client.chat.postMessage({
        channel: user.id,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *¡Formulario enviado correctamente!*\n\n¡Gracias *${formData.nombre}*! Hemos recibido tu información correctamente.`
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*👤 Nombre:*\n${formData.nombre}`
              },
              {
                type: 'mrkdwn',
                text: `*🏢 Departamento:*\n${formData.departamento}`
              },
              {
                type: 'mrkdwn',
                text: `*📧 Email:*\n${formData.email}`
              },
              {
                type: 'mrkdwn',
                text: `*📅 Fecha:*\n${new Date().toLocaleString('es-MX')}`
              }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*💬 Tu mensaje:*\n_"${formData.mensaje}"_`
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '🔄 _Te contactaremos pronto. Gracias por usar nuestro formulario._'
              }
            ]
          }
        ]
      });

      console.log(`✅ Formulario procesado exitosamente para ${formData.nombre}`);
      
    } else {
      throw new Error(result.message || 'Error desconocido al guardar datos');
    }
    
  } catch (error) {
    console.error('❌ Error procesando formulario:', error);
    
    // ❌ ERROR - Mensaje por DM
    await client.chat.postMessage({
      channel: user.id,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `❌ *Error al enviar formulario*\n\nHubo un problema procesando tu información:`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `\`\`\`${error.message}\`\`\``
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*¿Qué puedes hacer?*\n• Intenta enviar el formulario nuevamente\n• Verifica que todos los campos estén completos\n• Contacta al administrador si el problema persiste'
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🔄 Intentar de nuevo'
              },
              action_id: 'retry_form',
              style: 'primary'
            }
          ]
        }
      ]
    });
  }
});

// ==========================================
// MANEJO DE ERRORES GLOBALES
// ==========================================
app.error((error) => {
  console.error('❌ Error global en Slack App:', error);
});

// ==========================================
// HEALTH CHECK
// ==========================================
app.event('app_mention', async ({ event, client }) => {
  try {
    await client.chat.postMessage({
      channel: event.channel,
      text: `¡Hola <@${event.user}>! 👋 Usa el comando \`/formulario\` para abrir nuestro formulario de registro.`
    });
  } catch (error) {
    console.error('Error en app_mention:', error);
  }
});

// ==========================================
// EXPORT PARA VERCEL - VERSIÓN CORREGIDA
// ==========================================
module.exports = async (req, res) => {
  try {
    console.log('📥 Request recibido:', req.method, req.url);
    
    // Configurar headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Manejar preflight OPTIONS
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    // Solo aceptar POST requests
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    
    // ✅ CORRECCIÓN: Usar directamente el método start() de Slack Bolt
    // En lugar de intentar acceder al receiver manualmente
    await app.processEvent({
      body: req.body,
      headers: req.headers,
      isBase64Encoded: false
    });
    
    // Responder con éxito
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Error en Vercel handler:', error);
    
    // Si es un error de verificación de Slack, responder adecuadamente
    if (error.code === 'SLACK_REQUEST_VERIFICATION_FAILURE') {
      res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid signature' 
      });
      return;
    }
    
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
};

console.log('🎯 Slack Bot configurado y listo para recibir requests');