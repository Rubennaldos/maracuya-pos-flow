# Sistema POS Maracuyá Villa Gratia

Sistema de Punto de Venta desarrollado con React + TypeScript + Vite + Tailwind CSS + Firebase Realtime Database.

## 🚀 Características

### Backend: Firebase Realtime Database (RTDB)
- **Base de datos en tiempo real** para productos, ventas, clientes, cuentas por cobrar
- **Autenticación simple** con PIN hasheado (sin Firebase Auth)
- **Sincronización automática** entre dispositivos
- **Transacciones seguras** para correlativos y contadores

### Funcionalidades Principales
- ✅ **Punto de Venta** - Interfaz táctil con flujo por ENTER
- ✅ **Ventas Programadas** - Lista de entregas pendientes
- ✅ **Almuerzos Escolares** - Gestión especial para estudiantes
- ✅ **Cuentas por Cobrar** - Con integración WhatsApp
- ✅ **Cierre de Caja** - Cuadre diario automático
- ✅ **Ventas Históricas** - Registro con fecha manual
- ✅ **Promociones y Combos** - Sistema de descuentos
- ✅ **Recovery** - Recuperación de ventas no registradas
- ✅ **Impresión 80mm** - Tickets y comandas de cocina

### Impresión Térmica 80mm
Dos modos configurables desde `/config` en RTDB:

#### Modo Kiosk (Recomendado)
```bash
# Lanzar Chrome/Edge en modo kiosk con impresión automática
chrome --kiosk --kiosk-printing --disable-web-security http://localhost:5173
```

#### Modo RAW (ESC/POS)
- Soporte para QZ Tray o Electron
- Comandos ESC/POS listos para integración
- Configuración de impresora por nombre

## 🛠️ Instalación

### Prerrequisitos
- Node.js 18+
- npm o yarn
- Proyecto Firebase con Realtime Database

### Pasos

1. **Clonar repositorio**
```bash
git clone [repo-url]
cd pos-maracuya
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar Firebase**
Editar `src/lib/rtdb.ts` con tu configuración de Firebase:
```typescript
const firebaseConfig = {
  apiKey: "tu-api-key",
  authDomain: "tu-proyecto.firebaseapp.com",
  databaseURL: "https://tu-proyecto-default-rtdb.firebaseio.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

4. **Configurar Reglas RTDB (SOLO DESARROLLO)**
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
⚠️ **ADVERTENCIA**: Estas reglas son abiertas y SOLO deben usarse en desarrollo. En producción implementar autenticación adecuada.

5. **Ejecutar aplicación**
```bash
npm run dev
```

## 🔐 Usuarios Demo

El sistema inicializa automáticamente usuarios demo:

| Usuario | PIN | Rol | Permisos |
|---------|-----|-----|-----------|
| Admin | `1234` | admin | Todos los módulos |
| Cajero | `5678` | cajero | POS, Ventas, Clientes, Cierre |
| Cobranzas | `9999` | cobranzas | Cuentas por Cobrar |

## 📱 Uso del Sistema

### Flujo Principal (ENTER)
1. **Productos** - Seleccionar items del catálogo
2. **Cliente** - Elegir cliente o "Varios"
3. **Pago** - Método de pago (efectivo, crédito, etc.)
4. **Confirmación** - Procesar venta

### Atajos de Teclado
- `Enter` - Avanzar en flujo
- `F2` - Guardar borrador
- `F3` - Modo venta programada
- `F4` - Modo almuerzos
- `Esc` - Cancelar/volver
- `Ctrl+F` - Buscar productos/clientes

### Impresión Automática
- **Productos de cocina**: Se imprimen automáticamente al confirmar venta
- **Otros productos**: Preguntan antes de imprimir
- **Comandas**: Solo incluyen items de cocina, sin precios

## 🗄️ Estructura de Datos RTDB

```
/
├── users/               # Usuarios del sistema
├── products/            # Catálogo de productos
├── sales/               # Ventas completadas
├── clients/             # Base de clientes
├── accounts_receivable/ # Cuentas por cobrar
├── cash_closes/         # Cierres de caja
├── drafts/              # Borradores de venta
├── scheduled_sales/     # Ventas programadas
├── lunches/             # Almuerzos escolares
├── promotions/          # Promociones y combos
├── unregistered_sales/  # Ventas con errores
├── config/              # Configuración del sistema
├── correlatives/        # Contadores de comprobantes
└── logs/                # Logs de auditoría
```

## ⚙️ Configuración

### Variables en `/config`
```json
{
  "printingMode": "kiosk",           // "kiosk" | "raw"
  "printerName": "",                 // Nombre de impresora (modo raw)
  "autoPrintKitchen": true,          // Imprimir cocina automáticamente
  "ticketHeader": "Maracuyá...",     // Encabezado de tickets
  "ticketFooter": "Gracias...",      // Pie de tickets
  "taxRate": 0.18,                   // Tasa de impuestos
  "currency": "PEN"                  // Moneda
}
```

## 🔧 Desarrollo

### Estructura del Código
```
src/
├── lib/
│   ├── rtdb.ts          # Inicialización Firebase RTDB
│   ├── rt.ts            # Helpers CRUD para RTDB
│   ├── enterFlow.ts     # Manejador de flujo ENTER
│   └── print.ts         # Sistema de impresión
├── state/
│   └── session.ts       # Gestión de sesión (sin Firebase Auth)
├── components/modules/  # Módulos principales
└── components/ui/       # Componentes Shadcn/UI
```

### Criterios de Aceptación
- ✅ Sin dependencias de Supabase o "integración nativa"
- ✅ Solo Firebase RTDB para datos
- ✅ Login con PIN hasheado verificado en RTDB
- ✅ Soporte impresión kiosk y raw ESC/POS
- ✅ Correlativo seguro con transaction()
- ✅ Módulos funcionales: POS, AR, cierre, productos, etc.

## 🚨 Producción

### Seguridad
1. **Cambiar reglas RTDB**:
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

2. **Implementar autenticación** adicional según necesidades

3. **Cambiar PINs** de usuarios demo

4. **Variables de entorno** para claves Firebase

### Deploy
```bash
npm run build
# Subir contenido de dist/ a tu hosting
```

## 📄 Licencia

Propietario - Maracuyá Tiendas y Concesionarias Saludables

---

**IMPORTANTE**: Este sistema usa exclusivamente Firebase Realtime Database. No incluye Supabase, Postgres, ni otras integraciones.