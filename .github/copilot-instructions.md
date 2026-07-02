# Instrucciones del repositorio

Si en el fichero .env, la variable ENTORNO=servidor, entonces realiza los siguientes pasos:

1. Después de cualquier cambio en este repositorio, ejecuta `npm run build` desde la raíz del proyecto. En tareaqxxi este script es un no-op (no hay paso de compilación) y existe solo por simetría con el flujo de despliegue.
2. Cuando el build termine correctamente, ejecuta `pm2 restart tareaqxxi` desde la raíz del proyecto.
3. No des una tarea por terminada si alguno de esos pasos falla; informa el error al usuario.
