# ZynCloud - Panel de Control Cloud

## Concepto

ZynCloud es una plataforma web de gestion de infraestructura personal. Funciona como un mini-AWS donde el usuario puede crear, administrar y monitorear servidores virtuales (contenedores Docker) desde una interfaz web moderna y oscura. Cada "instancia" es un servidor Ubuntu independiente con terminal accesible desde el navegador.

**Audiencia:** Desarrolladores que quieren gestionar sus propios servidores de forma visual.
**Tono visual:** Dashboard profesional estilo cloud provider. Tema oscuro con acentos azules. Minimalista, data-driven, con iconografia clara.

---

## Mapa de Paginas

### 1. Login / Registro (`/`)

**Que hace:** Pantalla de entrada. El usuario inicia sesion con email y contrasena o crea una cuenta nueva. Al autenticarse, se redirige al Dashboard.

**Elementos clave:**
- Logo ZynCloud con icono "Z" en cuadrado azul
- Formulario centrado (email + contrasena)
- Boton principal "Iniciar Sesion"
- Toggle para cambiar entre Login y Registro (el registro agrega campo "Nombre")
- Mensajes de error inline

**Estado actual:** Funcional, tema oscuro, centrado vertical.

---

### 2. Dashboard / Overview (`/dashboard`)

**Que hace:** Vista general del sistema. Muestra un resumen rapido de toda la infraestructura: cuantas instancias hay, cuanta CPU y RAM se esta usando, y cuantos dominios estan configurados.

**Elementos clave:**
- 4 tarjetas de estadisticas en fila:
  - **Instancias Totales** - numero total, con desglose "X activas, Y detenidas" (icono servidor, color azul)
  - **CPU en Uso** - porcentaje total de CPU consumido (icono procesador, color amarillo)
  - **RAM en Uso** - MB usados de MB asignados (icono memoria, color verde)
  - **Dominios** - cantidad de dominios configurados (icono globo, color morado)
- 2 botones de accion rapida: "+ Nueva Instancia" (primario) y "Ver Instancias" (secundario)

**Estado ideal:** Las tarjetas deberian tener mini-graficas sparkline mostrando tendencia de las ultimas horas.

---

### 3. Lista de Instancias (`/dashboard/instances`)

**Que hace:** Muestra todas las instancias/servidores del usuario en una lista. Desde aqui se pueden crear nuevas, y cada instancia tiene acciones rapidas.

**Elementos clave:**
- Header con contador de instancias ("5 instancias") y boton "+ Nueva Instancia"
- Lista de tarjetas, cada una mostrando:
  - Icono de servidor
  - Nombre de la instancia (clickeable, lleva al detalle)
  - Badge de estado: `running` (verde), `stopped` (rojo), `creating` (amarillo)
  - Specs resumidos: "512 MB RAM" y "0.5 CPU"
  - Botones de accion (iconos):
    - Terminal (abre consola web)
    - Monitoreo (graficas)
    - Play/Stop (encender/apagar)
    - Reiniciar
    - Eliminar (con confirmacion)
- Estado vacio: icono grande de servidor, mensaje "No tienes instancias aun", boton "Crear tu primera instancia"

---

### 4. Crear Instancia (`/dashboard/instances/new`)

**Que hace:** Formulario para crear un nuevo servidor. El usuario le pone nombre, elige el tamano (preset o custom), y al confirmar se crea el contenedor Docker automaticamente.

**Elementos clave:**
- Campo de texto: Nombre de la instancia (placeholder: "mi-servidor-next")
- Selector de tipo (3 tarjetas clickeables en fila):
  - **Micro** - 256 MB / 0.25 CPU - "Para apps livianas o pruebas"
  - **Small** - 512 MB / 0.5 CPU - "Next.js o NestJS en produccion" (seleccionado por defecto)
  - **Medium** - 1024 MB / 1 CPU - "Apps con mas carga"
- La tarjeta seleccionada tiene borde azul y fondo azul sutil
- 2 inputs numericos para ajuste manual: Memoria (MB) y CPU (cores)
- Info box: "Se creara un contenedor Ubuntu 22.04 con Node.js 20, Nginx y herramientas de desarrollo preinstaladas"
- Botones: "Crear Instancia" (primario) y "Cancelar" (secundario)

---

### 5. Detalle de Instancia (`/dashboard/instances/[id]`)

**Que hace:** Vista completa de una instancia especifica. Muestra su estado, permite controlarla, y da acceso directo a la terminal, monitoreo y backups.

**Elementos clave:**
- Badge de estado prominente (running/stopped)
- Fila de botones de control: Iniciar, Detener, Reiniciar, Eliminar
- 3 tarjetas de acceso rapido (grid):
  - **Terminal Web** - icono terminal, "Acceder a la consola"
  - **Monitoreo** - icono actividad, "CPU, RAM, red"
  - **Backups** - icono disco, "Crear y restaurar"
- Seccion "Detalles" con grid de info:
  - Container ID (primeros 12 caracteres, monospace)
  - IP Interna
  - Memoria asignada
  - CPU asignada
  - Fecha de creacion
  - Puerto interno
- Seccion "Dominios asociados" (si hay): lista de dominios con badge SSL activo/inactivo

---

### 6. Consola / Terminal Web (`/dashboard/instances/[id]/console`)

**Que hace:** Terminal interactiva en el navegador. Es como conectarse por SSH al servidor pero directamente desde la web. El usuario puede ejecutar cualquier comando de Linux en tiempo real.

**Elementos clave:**
- Header muestra "Consola - [nombre de instancia]"
- Indicador de conexion: punto verde "Conectado" o punto amarillo pulsante "Conectando..."
- Area de terminal que ocupa toda la pantalla disponible:
  - Fondo oscuro casi negro (#0a0e1a)
  - Texto claro
  - Cursor azul parpadeante
  - Font monospace (JetBrains Mono / Fira Code)
  - Borde sutil alrededor
- La terminal es completamente interactiva: acepta input de teclado, muestra output en tiempo real, soporta colores ANSI

**Nota UI:** Esta pagina debe sentirse como una terminal real. Minima distraccion, maximo espacio para el terminal.

---

### 7. Monitoreo (`/dashboard/instances/[id]/monitoring`)

**Que hace:** Dashboard de metricas en tiempo real de una instancia. Muestra el consumo de recursos actualizado cada 2 segundos con mini-graficas de tendencia.

**Elementos clave:**
- 4 tarjetas de metricas en grid:
  - **CPU** (azul): porcentaje actual + mini-grafica de linea con historico
  - **RAM** (verde): MB usados de MB asignados + porcentaje + mini-grafica
  - **Red** (morado): MB recibidos (RX) y enviados (TX)
  - **Disco** (amarillo): MB leidos y escritos
- Las mini-graficas son SVG simples que muestran los ultimos 60 data points
- Si la instancia no esta corriendo: mensaje centrado "Esperando datos de monitoreo..."
- Los datos se actualizan en vivo via WebSocket (cada 2 segundos)

**Estado ideal:** Las graficas deberian ser mas grandes y detalladas, con tooltips al hacer hover, y opcion de ver historico de 1h/6h/24h.

---

### 8. Dominios (`/dashboard/domains`)

**Que hace:** Gestiona los dominios/subdominios que apuntan a las instancias. Permite agregar un dominio, asignarlo a una instancia, y activar SSL (HTTPS) automatico.

**Elementos clave:**
- Header con contador y boton "+ Agregar Dominio"
- Formulario desplegable para agregar dominio (3 campos en fila):
  - Dominio (text input, placeholder: "app.midominio.com")
  - Puerto destino (number input, default 3000)
  - Instancia (dropdown select con todas las instancias)
- Lista de dominios existentes, cada tarjeta muestra:
  - Icono de globo
  - Nombre del dominio (font monospace)
  - Flecha indicando a que instancia apunta y en que puerto
  - Badge "SSL" verde si tiene HTTPS activado
  - Boton "Activar SSL" si no tiene HTTPS
  - Boton eliminar

---

### 9. Backups (`/dashboard/backups`)

**Que hace:** Gestiona snapshots/copias de seguridad de las instancias. Permite crear un backup (foto del estado actual del servidor), restaurarlo, o eliminarlo.

**Elementos clave:**
- Dropdown para filtrar por instancia ("Todas las instancias" o una especifica)
- Boton "Crear Backup" (aparece al seleccionar una instancia)
- Lista de backups, cada tarjeta muestra:
  - Icono de disco duro
  - Nombre del archivo (ej: "mi-servidor-2026-07-05T16-30.tar")
  - Nombre de la instancia + tamano del archivo + fecha
  - Boton restaurar (icono refresh)
  - Boton eliminar (icono trash)
- Estado vacio: icono grande de disco, "No hay backups"

---

### 10. Configuracion (`/dashboard/settings`)

**Que hace:** Muestra informacion del sistema y configuracion general de la plataforma.

**Elementos clave:**
- Tarjeta "Informacion del Sistema" con grid:
  - Version: ZynCloud v0.1.0
  - Motor: Docker Engine
  - Base de Datos: SQLite + Prisma
  - Proxy: Nginx
- Tarjeta "Imagen Base de Instancias":
  - Descripcion de que incluye cada instancia creada (Ubuntu 22.04, Node.js 20, Nginx, git, vim, curl, htop)

**Estado ideal:** Agregar configuracion de usuario (cambiar contrasena, email), limites del sistema, y estado de Docker/Nginx.




## Flujos Principales

1. **Crear servidor:** Login → Dashboard → "+ Nueva Instancia" → Elegir nombre y tamano → "Crear" → Redirige a lista con instancia corriendo
2. **Usar terminal:** Instancias → Click instancia → "Terminal Web" → Terminal interactiva → Ejecutar comandos
3. **Configurar dominio:** Dominios → "+ Agregar Dominio" → Escribir dominio + seleccionar instancia → Guardar → "Activar SSL"
4. **Ver rendimiento:** Instancias → Click instancia → "Monitoreo" → Graficas en tiempo real
5. **Hacer backup:** Backups → Seleccionar instancia → "Crear Backup" → Esperar → Backup aparece en lista
