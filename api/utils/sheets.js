const { GoogleSpreadsheet } = require('google-spreadsheet');
const path = require('path');

class SheetsService {
  constructor() {
    this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID);
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('🔄 Inicializando Google Sheets...');
      
      // Cargar credenciales desde U-Bot.json
      const credentialsPath = path.join(process.cwd(), 'U-Bot.json');
      const credentials = require(credentialsPath);
      
      await this.doc.useServiceAccountAuth({
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      });
      
      await this.doc.loadInfo();
      this.initialized = true;
      
      console.log(`✅ Google Sheets conectado: "${this.doc.title}"`);
      
    } catch (error) {
      console.error('❌ Error inicializando Google Sheets:', error.message);
      throw new Error(`Error conectando con Google Sheets: ${error.message}`);
    }
  }

  async addRow(data) {
    try {
      await this.initialize();
      
      // Obtener primera hoja
      const sheet = this.doc.sheetsByIndex[0];
      
      // Verificar si necesitamos headers
      const rows = await sheet.getRows();
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
      
      // Preparar datos para insertar
      const rowData = {
        'Fecha y Hora': new Date().toLocaleString('es-MX', {
          timeZone: 'America/Mexico_City',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        'Usuario Slack': data.userSlack,
        'Nombre Completo': data.nombre,
        'Email': data.email,
        'Departamento': data.departamento,
        'Mensaje': data.mensaje,
        'ID Usuario': data.userId
      };
      
      // Insertar fila
      await sheet.addRow(rowData);
      
      console.log('✅ Fila agregada exitosamente:', {
        nombre: data.nombre,
        departamento: data.departamento
      });
      
      return { 
        success: true, 
        message: 'Datos guardados correctamente' 
      };
      
    } catch (error) {
      console.error('❌ Error agregando fila a Sheets:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'Error al guardar en la hoja de cálculo'
      };
    }
  }

  async getSheetInfo() {
    try {
      await this.initialize();
      return {
        title: this.doc.title,
        sheetCount: this.doc.sheetCount,
        firstSheetTitle: this.doc.sheetsByIndex[0].title
      };
    } catch (error) {
      throw new Error(`Error obteniendo info de la hoja: ${error.message}`);
    }
  }
}

module.exports = new SheetsService();