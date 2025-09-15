# Firebase Realtime Database Rules - Lunch Module

Este archivo contiene las reglas de seguridad sugeridas para el módulo de almuerzos. **IMPORTANTE**: Estas reglas son solo una referencia y deben ser aplicadas manualmente en Firebase Console.

## Rutas creadas para el módulo:

- `lunch_menu`: Catálogo público de productos
- `lunch_orders`: Pedidos realizados por padres 
- `lunch_settings`: Configuración del módulo

## Reglas sugeridas:

```json
{
  "rules": {
    // Reglas existentes del sistema...
    
    // === MÓDULO DE ALMUERZOS ===
    
    // Menú de almuerzos - Solo lectura pública
    "lunch_menu": {
      ".read": true,
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() == 'admin')"
    },
    
    // Configuración de almuerzos - Solo admin
    "lunch_settings": {
      ".read": true,
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() == 'admin')"
    },
    
    // Pedidos de almuerzos
    "lunch_orders": {
      // Lectura: Admin puede ver todos, otros solo pueden ver el histórico (no en tiempo real)
      ".read": "auth != null && (root.child('users').child(auth.uid).child('role').val() == 'admin')",
      
      // Escritura: Admin total, o escribir pedidos propios bajo ciertas condiciones
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() == 'admin')",
      
      // Para pedidos individuales
      "$orderId": {
        // Validaciones para nuevos pedidos (sin auth pública - requerirá ajustes)
        ".validate": "newData.hasChildren(['code', 'clientId', 'clientName', 'items', 'total', 'status', 'createdAt']) && newData.child('code').isString() && newData.child('code').val().length > 0"
      }
    }
  }
}
```

## Consideraciones importantes:

### 1. Autenticación pública
El módulo público (`/pedidos`) está diseñado para funcionar **sin autenticación** (para padres que solo ingresan código del alumno). Sin embargo, Firebase Realtime Database requiere autenticación para escribir datos.

**Opciones de implementación:**

#### Opción A: Autenticación anónima
```javascript
// En el componente PublicLunchOrders, antes de escribir pedidos
import { signInAnonymously } from "firebase/auth";
import { getAuth } from "firebase/auth";

const auth = getAuth();
await signInAnonymously(auth);
```

#### Opción B: API Gateway/Cloud Functions
Crear una Cloud Function que maneje la escritura de pedidos y validaciones:
```javascript
// Cloud Function que recibe código + datos del pedido
// Valida que el código existe en /clients
// Escribe en /lunch_orders con validaciones de horario
```

#### Opción C: Token temporal
Generar tokens temporales con permisos limitados solo para escribir pedidos.

### 2. Reglas más específicas para pedidos:

```json
"lunch_orders": {
  "$orderId": {
    ".write": "
      // Admin puede escribir siempre
      (auth != null && root.child('users').child(auth.uid).child('role').val() == 'admin') ||
      
      // O es un pedido nuevo con código válido
      (
        !data.exists() && 
        newData.child('code').isString() && 
        root.child('clients').child(newData.child('code').val()).exists() &&
        newData.child('createdAt').val() > (now - 3600000) // Máximo 1 hora atrás
      ) ||
      
      // O es edición de pedido existente dentro del tiempo permitido
      (
        data.exists() && 
        data.child('status').val() == 'pending' &&
        (now - data.child('createdAt').val()) < (15 * 60 * 1000) // 15 minutos
      )
    ",
    
    ".validate": "
      newData.hasChildren(['code', 'clientId', 'clientName', 'items', 'total']) &&
      newData.child('code').isString() &&
      newData.child('total').isNumber() &&
      newData.child('total').val() >= 0
    "
  }
}
```

### 3. Validación de horarios
Para aplicar restricciones de `cutoffTime` a nivel de base de datos:

```json
".write": "
  // ... otras condiciones ...
  
  // Verificar que no ha pasado la hora límite (ejemplo: 11:00 = 39600000 ms desde medianoche)
  && (now - (now % 86400000)) + 39600000 > now
"
```

### 4. Limitaciones diarias
Para implementar `dailyLimit` por producto:

```json
// Esto sería complejo en reglas RTDB. Mejor manejar en el frontend/backend
// verificando la suma de quantities del día para cada producto
```

## Aplicación de reglas:

1. Ve a Firebase Console → Tu proyecto → Realtime Database → Rules
2. Copia y adapta las reglas según tu configuración existente
3. **Prueba en modo simulador** antes de publicar
4. **Configura índices** si planeas hacer consultas por fecha/código
5. **Habilita autenticación anónima** si eliges la Opción A

## Índices recomendados:

En Firebase Console → Realtime Database → Indexes:

```json
{
  "lunch_orders": {
    ".indexOn": ["code", "createdAt", "status"]
  }
}
```

---

**RECORDATORIO**: Estas reglas son una referencia. Revísalas y ajústalas según tus necesidades específicas de seguridad antes de aplicarlas en producción.