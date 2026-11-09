# LEVEL Barbería · Frontend

Sitio estático (HTML + módulos ES, sin build). Panel del dueño en negro y dorado con efecto cristal.

```sh
npx serve -l 5173 .
```

- **Con backend:** en el login abre "Conexión con el servidor" y pon la URL de la API (`http://localhost:8000/api/v1`) y el slug del negocio. En el backend agrega `http://localhost:5173` a `CORS_ORIGENES` del `.env`.
- **Sin backend:** botón "Ver demo con datos de ejemplo" (`js/mock.js`, mismas formas que la API).

Módulos: Panel · Citas · Registro · Caja · Fidelización · Clientes, más el sitio público de reservas (`#/reservar`).
