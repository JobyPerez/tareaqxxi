# Instrucciones del repositorio

Antes de decidir cualquier paso de despliegue o reinicio, lee el fichero `.env` de la raíz y aplica esta matriz:

## `ENTORNO=local`

1. No uses PM2.
2. Ignora la variable `DESPLIEGUE`.
3. Para levantar la aplicación en caliente usa `npm run dev` desde la raíz del proyecto. Esto arranca Express con `node --watch`.
4. No ejecutes `npm run build` ni `pm2 restart tareaqxxi` como parte normal de un cambio local.

## `ENTORNO=servidor` y `DESPLIEGUE=produccion`

1. No hay paso de compilación: `server.js` se ejecuta directamente con Node. El script `npm run build` es un no-op y existe solo por simetría con el flujo de despliegue.
2. Después de cualquier cambio en este repositorio, ejecuta `pm2 restart tareaqxxi` desde la raíz del proyecto. Este comando solo reinicia los procesos existentes; no ejecuta build, install ni pull.
3. No des una tarea por terminada si ese paso falla; informa el error al usuario.

## `ENTORNO=servidor` y `DESPLIEGUE=desarrollo`

1. Usa PM2 para mantener vivo `tareaqxxi` mientras trabajas en el servidor.
2. La ejecución debe ser en caliente: el servidor con `node --watch` (puedes usar `pm2 start npm --name tareaqxxi -- run dev` o similar, según tu flujo).
3. No des una tarea por terminada si el reinicio o arranque de PM2 falla; informa el error al usuario.
