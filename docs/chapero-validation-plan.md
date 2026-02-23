# Plan de Validacion Chapero (CV + IA)

## Objetivo

Medir mejora de precision y consistencia del conteo de chapas con pipeline hibrido.

## Dataset recomendado

- 10 a 20 imagenes reales del entorno de produccion.
- Diversidad minima:
  - 4 fotos con luz uniforme.
  - 4 fotos con reflejos/sombras.
  - 4 fotos con fondo complejo o suciedad en cantos.
  - 2 a 8 fotos adicionales con perspectiva no ideal.

Guardar en `tests/chapero/images/` y mantener verdad terreno en `tests/chapero/ground-truth.csv`.

Formato CSV sugerido:

```
filename,material,thickness_mm,real_count
img_001.jpg,ACERO,1.5,42
img_002.jpg,INOX,2.0,31
```

## Metricas

1. Error absoluto por imagen: `abs(pred - real)`
2. Error absoluto medio (MAE): media de errores absolutos.
3. Precision alta fiable:
   - `%High<=1 = (#imagenes con confidence=high y error<=1) / (#imagenes con confidence=high)`
4. Estabilidad (consistencia):
   - Para 5 imagenes, repetir analisis 3 veces y medir desviacion estandar del resultado final.

## Criterios de aceptacion sugeridos

- MAE <= 1.5
- `%High<=1 >= 85%`
- Desviacion estandar promedio en repeticion <= 0.8

## Flujo de reproduccion manual

1. Abrir vista chapero.
2. Cargar imagen del dataset.
3. Activar recorte y delimitar solo el canto.
4. (Opcional) marcar 2 puntos en calibracion.
5. Ejecutar analisis.
6. Registrar en hoja de resultados:
   - conteo final operativo
   - conteo IA crudo
   - conteo CV
   - confianza
   - fuente usada (cv/ai/hybrid)
7. Repetir para todas las imagenes.

## Tabla de resultados sugerida

`tests/chapero/results.csv`

```
filename,real_count,final_count,ai_count,cv_count,source,confidence,abs_error
img_001.jpg,42,41,41,42,hybrid,high,1
```

## Observaciones cualitativas recomendadas

- Casos con separadores detectados.
- Casos donde CV fue fuerte pero IA discrepante.
- Casos donde el ajuste manual fue necesario.
