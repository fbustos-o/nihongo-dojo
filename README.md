# LightKanji (web, Docker)

Despliegue de producción de la versión web de [LightKanji](https://github.com/alatasnova/LightKanji) con nginx.

## Uso

```sh
docker compose up -d --build
```

Abrir http://localhost:8081

El puerto se define en `.env` (`LIGHTKANJI_PORT`, por defecto 8080 si no existe). Está en 8081 porque el 8080 lo usa otro proyecto.

## Actualizar

```sh
git -C LightKanji pull
docker compose up -d --build
```

## Tests

```sh
docker compose build --build-arg RUN_TESTS=true
```

## Notas

- Los datos estructurales de Kanjium no están disponibles en web (limitación del proyecto original).
- El progreso se guarda en el `localStorage` del navegador; no hay backend, y cambiar de navegador o borrar datos del sitio lo elimina.
