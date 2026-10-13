ESTANTERIAS formato estanterías 

Este documento define como quiero que se vean visualmente las estanterías de los kioskos, y en general en la app cuando se acceda a la visual de una estantería

En primer lugar, el requisito básico y lo mas importante, es que debe representar de la manera mas fiel posible la forma de la estantería real. Es decir, que mirando la pantalla, sea como mirar la estantería. por lo tanto, te voy a definir cada una de las secciones como quiero que se vean.

--> SECCION PRENSAS: imagen 1.jpg --> 1 ESTANTERIA

Son 3 filas, 3 columnas es decir, 9 ubicaciones.
La primera. PRE 001, será la superior izquierda, y se ubicaran de esta manera

PRE 001  PRE 002  PRE 003
PRE 004  PRE 005  PRE 006
PRE 007  PRE 008  PRE 009

--> SECCION MECANIZADO: imagen 2.jpg --> 1 ESTANTERIA

MEC 001 (URGENTE) MEC 005  MEC 006  MEC 007 
MEC 002 (URGENTE) MEC 008  MEC 009  MEC 010 MEC 017  MEC 018  MEC 019 MEC 026  MEC 027  MEC 028
MEC 003 (URGENTE) MEC 011  MEC 012  MEC 013 MEC 020  MEC 021  MEC 022 MEC 029  MEC 030  MEC 031
MEC 004 (URGENTE) MEC 014  MEC 015  MEC 016 MEC 023  MEC 025  MEC 026 MEC 032  MEC 033  MEC 034

--> SECCION PLEGADO --> 2 ESTANTERIAS

Se compone de dos estanterías.
La primera de ellas, es donde se encuentran los urgentes, que son 6

ESTANTERIA 1

PRE 007           PRE 008            PLE 017  PLE 018
PRE 009           PRE 010            PLE 019  PLE 020
PRE 011           PRE 012            PLE 021  PLE 022
PRE 013           PRE 014            PLE 022  PLE 024
PRE 015           PRE 016            PLE 025  PLE 026
PRE 001 (URGENTE) PRE 002 (URGENTE)  PLE 027  PLE 028
PRE 003 (URGENTE) PRE 004 (URGENTE)  PLE 029  PLE 030
PRE 005 (URGENTE) PRE 006 (URGENTE)  PLE 031  PLE 032

ESTANTERIA 2 -- PUNZONADORA

PLE 033  PLE 034  PLE 035
PLE 036  PLE 037  PLE 038
PLE 039  PLE 040  PLE 041
PLE 042  PLE 043  PLE 044
PLE 045  PLE 046  PLE 047
PLE 048  PLE 049  PLE 050
PLE 051  PLE 052  PLE 053

--> SECCION SOLDADURA POR PUNTOS (SXP) --> 1 ESTANTERIA  

SXP 001  SXP 002
SXP 003  SXP 004
SXP 005  SXP 006
SXP 007  SXP 008
SXP 009  SXP 010

--> SECCION COMODIN --> 2 ESTANTERIAS

                           COM 019  COM 020
COM 001  COM 002  COM 003  COM 021  COM 022
COM 004  COM 005  COM 006  COM 023  COM 024
COM 007  COM 008  COM 009  COM 025  COM 026
COM 010  COM 011  COM 012  COM 027  COM 028
COM 013  COM 014  COM 015  COM 029  COM 030
COM 016  COM 017  COM 018  COM 031  COM 032

--> SECCION ROBOT DE SOLDADURA (ROB. SOL) --> 1 ESTANTERIA

ROB. SOL 001  ROB. SOL 002  
ROB. SOL 003  ROB. SOL 004
ROB. SOL 005  ROB. SOL 006
ROB. SOL 007  ROB. SOL 008


--> SECCION ROBOT DE PLEGADO --> 1 ESTANTERIA

ESTANTERIA 1

ROB. PLE 001  ROB. PLE 002 ROB. PLE 003
ROB. PLE 004  ROB. PLE 005 ROB. PLE 006
ROB. PLE 007  ROB. PLE 008 ROB. PLE 009
ROB. PLE 010  ROB. PLE 011 ROB. PLE 012
ROB. PLE 013  ROB. PLE 014 ROB. PLE 015
ROB. PLE 016  ROB. PLE 017 ROB. PLE 018
ROB. PLE 019  ROB. PLE 020 ROB. PLE 021

--> SECCION ZINCADO --> 1 ESTANTERIA

ZIN 001
ZIN 002
ZIN 003
ZIN 004
ZIN 005

--> SECCION PINTURA --> 2 ESTANTERIAS

ESTANTERIA 1 --> DENTRO

PIN 001  PIN 002  PIN 003  PIN 004  PIN 005 
PIN 006  PIN 007  PIN 008  PIN 009  PIN 010  
PIN 011  PIN 012  PIN 013  PIN 014  PIN 015   

ESTANTERIA 2 --> FUERA

PIN 016  PIN 017  PIN 018
PIN 019  PIN 020  PIN 021
PIN 022  PIN 023  PIN 024

--> SECCION REPASADO --> 4 ESTANTERIAS

Repasado es algo mas compleja pero vamos a resolverlo de manera sencilla.
Tiene una estantería de 4 ubicaciones verticales urgentes

REP 001
REP 002
REP 003
REP 004

Tiene dos estanterías de ALUMINIO, pero en la app que aparezca como una sola de dos columnas verticales

REP 005  REP 010
REP 006  REP 011
REP 007  REP 012
REP 008  REP 013
REP 009  REP 014

Después, tiene una estantería general de 10 ubicaciones

REP 015  REP 016
REP 017  REP 018
REP 019  REP 020
REP 021  REP 022
REP 023  REP 024

Por ultimo un almacén modular de 15 ubicaciones de la REP 025 a la REP 039.
Tres columnas y 5 filas.

--> SECCION SOLDADURA --> 1 ESTENTERIA (GRANDE)

Soldadura serán en total 56 posiciones. esto es porque es la sección mas grande y con mas operarios
Las urgentes, se consideraran como una sola, porque tiene una forma un tanto difícil de pasar a la app.
Las demás, te he dejado la imagen ESTANTERIA SOLDADURA.png para que puedas comprobar la forma que tiene, las filas y las columnas.

Son 56 + la posición urgente.

--> CALIDAD --> 2 ESTANTERIAS

ESTANTERIA 1

Aquí, voy a explicarte una lógica que vamos a implementar.
La estantería 1, será la que almacenes los artículos que vamos a tener que reprocesar.
Por lo tanto, se llamara REPROCESOS.

Quiero que de alguna manera, a los artículos que incluyamos en estas estanterías, se pudiera añadir un importe y una cantidad, para saber cuanto dinero tenemos en ese momento parado en reprocesos

CAL 001  CAL 002
CAL 003  CAL 004  CAL 011  CAL 012  CAL 013
CAL 005  CAL 006  CAL 014  CAL 015  CAL 016
CAL 007  CAL 008  CAL 017  CAL 018  CAL 019
CAL 009  CAL 010  CAL 020  CAL 021  CAL 022

ESTANTERIA 2

CAL 023  CAL 024  CAL 025
CAL 026  CAL 027  CAL 028
CAL 029 (VERIFICACION TECNICA) CAL 030  CAL 031 (URGENTE)
CAL 032 (VERIFICACION TECNICA) CAL 033  CAL 034 (URGENTE)










