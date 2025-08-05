// sheets.js
const { GoogleSpreadsheet } = require('google-spreadsheet');

class SheetsService {
  constructor() {
    // 👇 Obtiene el ID del Spreadsheet desde la env var
    this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID);
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      console.log('🔄 Inicializando Google Sheets…');

      // 👇 Parseamos el JSON completo de credenciales desde la env var
      const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);

      // 👇 Autenticación con la cuenta de servicio
      await this.doc.useServiceAccountAuth({
        client_email: creds.client_email,
        private_key:   creds.private_key.replace(/\\n/g, '\n')
      });

      await this.doc.loadInfo();
      this.initialized = true;

      console.log(`✅ Google Sheets conectado: "${this.doc.title}"`);
    } catch (err) {
      console.error('❌ Error inicializando Google Sheets:', err.message);
      throw new Error(`Error conectando con Google Sheets: ${err.message}`);
    }
  }

  async addRow(data) {
    try {
      await this.initialize();

      const sheet = this.doc.sheetsByIndex[0];
      const rows  = await sheet.getRows();

      if (rows.length === 0) {
        console.log('📝 Creando headers en la hoja...');
        await sheet.setHeaderRow([
          'Fecha y Hora',
          'Usuario Slack',
          'Nombre Completo',
          'Email',
          'Departamento',
          'Mensaje',
          'ID Usuario'
        ]);
      }

      const rowData = {
        'Fecha y Hora': new Date()
          .toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
        'Usuario Slack': data.userSlack,
        'Nombre Completo': data.nombre,
        'Email': data.email,
        'Departamento': data.departamento,
        'Mensaje': data.mensaje,
        'ID Usuario': data.userId
      };

      await sheet.addRow(rowData);
      console.log('✅ Fila agregada exitosamente:', rowData);
      return { success: true, message: 'Datos guardados correctamente' };
    } catch (err) {
      console.error('❌ Error agregando fila a Sheets:', err);
      return {
        success: false,
        error: err.message,
        message: 'Error al guardar en la hoja de cálculo'
      };
    }
  }

  async getSheetInfo() {
    try {
      await this.initialize();
      return {
        title:           this.doc.title,
        sheetCount:      this.doc.sheetCount,
        firstSheetTitle: this.doc.sheetsByIndex[0].title
      };
    } catch (err) {
      throw new Error(`Error obteniendo info de la hoja: ${err.message}`);
    }
  }
}

module.exports = new SheetsService();
