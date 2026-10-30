# 🏑 Plataforma multi-club de citaciones y rendimiento

Página web de citaciones oficial para el **Plantel Superior B (1ra e Intermedia)** de **Hockey Femenino de Regatas Andino**.

---

## Datos y migración desde Google Sheets

La aplicación puede servir a varios clubes desde el mismo despliegue. Cada club se abre
con `?club=slug`; por ejemplo:

```text
https://tu-dominio.com/?club=regatas-andino
```

PostgreSQL es la fuente operativa para el plantel, las citaciones, las evaluaciones físicas y los eventos del tracker. La interfaz no consulta ni escribe planillas durante el uso normal.

Aplicá las migraciones y cargá el estado actual de las planillas:

```powershell
npm run db:up
npm run db:migrate
npm run db:import-sheets -- --club=regatas-andino
```

El importador carga convocatorias actuales, resultados físicos e historial de partidos si `DT_IMPORT_WEBHOOK_URL` apunta temporalmente al Apps Script anterior. La importación puede repetirse sin duplicar las convocatorias o los eventos ya identificados. Cuando verifiques la información, podés revocar el acceso del Apps Script y quitar esa variable de entorno. Las planillas quedan como copia histórica hasta que decidas archivarlas o eliminarlas.

---

## Configuración multi-club

En desarrollo local copiá `.env.example` a `.env`. Para un único club se pueden conservar
`GOOGLE_CLIENT_ID` para habilitar el acceso del cuerpo técnico con Google. Para varios clubes, configurá
`CLUBS_CONFIG_JSON` en Vercel o en el entorno de ejecución con un array JSON.

Cada perfil contiene un `slug`, identidad visual, configuración del torneo y sus credenciales
privadas dentro de `auth`. Los IDs de planillas se conservan sólo como fuente temporal de la
importación histórica y nunca se devuelven al navegador. La API `/api/config` sólo devuelve los campos
públicos; las contraseñas nunca llegan al navegador. Las sesiones y caches del navegador se
aislan usando el slug del club, y un token de autenticación no puede reutilizarse entre clubes.

Ejemplo mínimo:

```json
[{
  "slug": "club-ejemplo",
  "name": "CLUB EJEMPLO",
  "shortName": "EJEMPLO",
  "sport": "Hockey",
  "teamName": "PLANTEL SUPERIOR",
  "logoUrl": "/logos/club-ejemplo.png",
  "auth": { "secret": "SECRET_LARGO_Y_ALEATORIO" }
}]
```

La botonera y las estadísticas guardan sus eventos en PostgreSQL.

### Panel de administración de clubes

`/admin` permite agregar, editar y eliminar clubes e invitar a su cuerpo técnico. Requiere
`ADMIN_PASSWORD`, `ADMIN_SECRET` y `DATABASE_URL`: el catálogo de clubes vive en la tabla
`club_catalog` de PostgreSQL (en producción, Supabase). Para el PostgreSQL local:

```env
DATABASE_URL=postgresql://clubs:clubs@localhost:5432/clubs
```

La aplicación se conecta a la base sólo desde el backend. La Data API de Supabase queda
bloqueada para las claves públicas (migración `014_lock_down_data_api.sql`).

## Aplicación y desarrollo

El portal React de `frontend/` es la interfaz principal y consume las API del proyecto
a través de `frontend/src/api.js`. En desarrollo, iniciá el servidor local con `npm start`;
compila el portal y lo sirve en `http://localhost:3000/`. `server.js` enruta `/api/*` a los
archivos de `api/` igual que Vercel, así que no hay lógica duplicada. También podés ejecutar
`npm run dev` para usar Vite en `http://localhost:5173/` mientras el servidor local está
activo para atender las API.

`npm test` corre los tests del backend y GitHub Actions los ejecuta junto con el build en
cada push a `main` y en cada pull request.

El portal permite seleccionar clubes, gestionar su plantel, preparar citaciones, consultar
evaluaciones físicas y registrar eventos del partido. Las jugadoras pueden consultar las
evaluaciones físicas desde el enlace público del club; la carga y edición requieren una sesión
del cuerpo técnico. El resto de los datos privados y las escrituras también requieren esa sesión.

El cuerpo técnico puede ingresar con una cuenta Google invitada al email correspondiente. La invitación inicial se crea desde `/admin`; una vez dentro, cada integrante puede invitar a otras personas y revocar accesos. El enlace es de un solo uso y vence en siete días. Configurá `GOOGLE_CLIENT_ID` y aplicá las migraciones para habilitar el registro.

Desde "Editar perfil" se puede subir el escudo del club (PNG, JPG o SVG de hasta 1 MB).
Las citaciones se consultan y editan mediante `/api/club-data`; la consulta de evaluaciones es pública por club, pero su edición y el acceso a eventos requieren una sesión del cuerpo técnico. Las escrituras se guardan en PostgreSQL.

La configuración de torneo AMH también es propia de cada club. En el perfil se deben
completar el nombre del torneo, la URL base de AMH, el ID del torneo y el ID del club
dentro de AMH. Las rutas `/api/torneo` y `/api/torneo/matches` usan esos valores del
club solicitado y no reutilizan el torneo de otro club.

Para no tener que conocer esos IDs, el perfil incluye "Buscar torneos y equipos".
Ese selector consulta AMH y permite elegir el torneo, el equipo y la división; al
seleccionar las opciones se completan automáticamente los identificadores usados por
la sincronización.

Para generar el portal de producción:

```bash
npm run frontend:build
```

---

## 🌐 Publicación

La guía paso a paso para publicar la aplicación en Vercel y conectar Supabase está en
[DEPLOY.md](DEPLOY.md). Vercel asigna un subdominio `vercel.app`; un dominio propio es
opcional.
