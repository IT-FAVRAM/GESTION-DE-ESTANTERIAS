-- ESTANTERIAS ROLES --

Este documento define los roles de la app, que puede hacer cada uno.

CALIDAD -- las personas con el rol CALIDAD tendrán las siguientes posibilidades:
a. Usar el kiosko de su sección, y el del resto de secciones -- ubicar, retirar, mover y buscar artículos.
b. Solicitar la recogida de material al carretillero
c. Tendrán usuario y contraseña, para poder:
	a) recibir las notificaciones push de verificación técnica y urgencias al móvil.
	b) consultar desde el ordenador el estado de su sección mas en detalle.
d. En la estantería REPROCESOS, deben de poder, para cada articulo de cada ubicación, poder meter una cantidad y un importe. El objetivo es tener controlado el importe de los reprocesos que tiene la empresa. EJ: hay 10.000€ pendientes de reproceso.


ADMIN: las personas con rol ADMIN acceso total a la app menos a los apartados de configuración. 
Tendrá dos grandes secciones:

1. ESTANTERIAS: podrá acceder a la visual kiosko de todas las estanterías, para de manera visual ver la saturación de una u otra sección. Se moverá entre secciones de manera sencilla. 
2. PANEL DE CONTROL: aquí tendrá submódulos (los actuales menos estanterías)  de gestión: informes, análisis etc pero no de CONFIGURACION

SUPER_ADMIN: acceso total y configuración de la app. Misma configuración que ADMIN pero añadiendo la CONFIGURACION de la app. Es decir, acceso total a la aplicación. 
Además, deben desde la pantalla que les da acceso a la visual de las estanterías, poder ubicar manualmente mediante texto (metiendo par articulo + OF), retirar de la misma manera,y mover simplemente o desplazando arrastrando el articulo, o dándole a mover y seleccionando el destino

CARRETILLERO: puede navegar por la visual kiosco de todas las estanterías. Recibe los avisos para recoger el material. En principio va a haber solo 1. 

OPERARIO: acceso a los kioskos y sus funcionalidades: buscar artículos, ubicar y retirar, mover y avisar al carretillero.

