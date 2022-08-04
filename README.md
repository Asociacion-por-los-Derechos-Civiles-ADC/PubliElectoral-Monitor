# PubliElectoral-Monitor

Proyecto de [ADC Digital](https://adcdigital.org.ar/)

El proyecto consiste en un script que se ejecutará periódicamente en el cron del sistema.
El script buscará las publicaciones en facebook de las fan pages públicas de distintos partidos políticos y sus cuentas satelites (candidatos) configuradas y, almacenará en una base de datos MongoDB el texto, imágenes, link y fecha de cada publicación


## Requerimientos
```
mongo 3.6  
node v10
```

## Levantar el Proyecto

```
git clone https://github.com/Asociacion-por-los-Derechos-Civiles-ADC/PubliElectoral-Monitor.git
cd PubliElectoral-Monitor
npm install
npm start
```

Para cambiar la freciencia de ejecución de debe modificar el valor de la variable CHECK_INTERVAL_MINUTES.
Este valor expresa la frecuencia con la que se va a ejecutar el script y utiliza la misma sintaxis del crontab de Linux.
1. [https://help.ubuntu.com/community/CronHowto](https://help.ubuntu.com/community/CronHowto)
2. [https://geekytheory.com/programar-tareas-en-linux-usando-crontab](https://geekytheory.com/programar-tareas-en-linux-usando-crontab)


## Tests  
``` bash
npm test
```

