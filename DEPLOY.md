# Publicar en Vercel con Supabase

La aplicación sirve la interfaz y las rutas `/api` desde Vercel. PostgreSQL debe ser
externo porque las funciones de Vercel no conservan un disco local. No hace falta comprar
un dominio: Vercel asigna uno terminado en `vercel.app`.

## 1. Crear la base de datos

1. Creá un proyecto PostgreSQL en Supabase y guardá la contraseña de la base.
2. En **Connect**, copiá la URI de **Transaction pooler**. Esa URI es para la aplicación
   en Vercel; reemplazá el marcador de contraseña y conservá `sslmode=require` si aparece.
3. Para aplicar las migraciones desde tu computadora, copiá también la URI de conexión
   directa de Supabase. Si tu red no puede conectarse por IPv6, usá la URI de **Session
   pooler** para esa tarea puntual.

No publiques ninguna de estas URI ni las agregues a Git.

## 2. Crear las tablas

En PowerShell, desde la carpeta del proyecto, establecé temporalmente la URI de Supabase.
El secreto de sesión de cada club se genera automáticamente al crear el club:

```powershell
$env:DATABASE_URL = "URI_DIRECTA_O_SESSION_POOLER_DE_SUPABASE"
npm run db:migrate
```

La migración crea las tablas y registra el club inicial `regatas-andino`. No migra datos
históricos de Google Sheets.

## 3. Importar el repositorio a Vercel

1. Iniciá sesión en [Vercel](https://vercel.com/) y elegí **Add New → Project**.
2. Importá `IvanCsir/sports-clubs-platform` desde GitHub.
3. Conservá la configuración de `vercel.json`: instala las dependencias de la raíz y del
   frontend, compila Vite y publica `frontend/dist` junto con las funciones de `api/`.
4. Agregá las variables de entorno de abajo antes del primer despliegue de producción.

La primera publicación queda disponible con un subdominio `vercel.app`. Cada cambio que
se incorpore a `main` generará un nuevo despliegue si el proyecto queda conectado a GitHub.

## 4. Variables de entorno en Vercel

En **Project → Settings → Environment Variables**, agregá estas variables para
**Production** (y también para **Preview** si vas a probar allí):

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | URI de Supabase **Transaction pooler** |
| `ADMIN_PASSWORD` | Contraseña fuerte para abrir `/admin` |
| `ADMIN_SECRET` | Secreto aleatorio de al menos 32 bytes para firmar la sesión de administración |
| `GOOGLE_CLIENT_ID` | ID OAuth de tipo aplicación web para el botón de ingreso con Google |
| `AMH_USER` | Usuario de AMH, si vas a usar la actualización del torneo |
| `AMH_PASSWORD` | Contraseña de AMH, si vas a usar la actualización del torneo |

No cargues `SUPABASE_SERVICE_ROLE_KEY`: este despliegue usa `DATABASE_URL` directamente.
Después de aplicar la migración, iniciá sesión en `/admin` y generá una invitación para el
email Google de la primera persona del cuerpo técnico.

Después de cargar variables, guardalas y volvé a desplegar. Las variables no se incluyen
automáticamente en despliegues que ya estaban creados.

En Google Cloud Console, creá un cliente OAuth de tipo **Aplicación web**, configurá el dominio publicado como origen autorizado (por ejemplo `https://tu-app.vercel.app`) y cargá su ID en `GOOGLE_CLIENT_ID`. Después aplicá las migraciones (`npm run db:migrate`). Desde `/admin`, usá **Invitar cuerpo técnico** en el club y enviá el enlace generado al email de Google de esa persona. Cada invitación vence en siete días y se puede usar una sola vez. Las personas ya invitadas pueden invitar a otros integrantes desde **Más → Accesos del cuerpo técnico**.

## 5. Verificar

Abrí la URL `vercel.app` asignada y comprobá:

- Que carga la página de inicio y el club desde `/?club=regatas-andino`.
- Que `/admin` pide la contraseña configurada en `ADMIN_PASSWORD`.
- Que el cuerpo técnico puede iniciar sesión y guardar una citación o un Plan partido.
- Que una evaluación y las estadísticas cargan desde la base de datos.
- Que un email invitado puede aceptar su invitación con Google y que otro email no puede usar ese enlace.
- Que el cuerpo técnico puede revocar una cuenta y que sus sesiones dejan de funcionar.

Si cambiás variables de entorno, generá un nuevo despliegue para que surtan efecto.
