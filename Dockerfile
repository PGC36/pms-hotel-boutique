# --- Etapa 1: compilar el frontend con Vite ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# En producción la API se sirve en el mismo dominio, bajo /api (Nginx la redirige al backend).
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Sentry (docs/sentry.md). Todo opcional: sin DSN la app no carga Sentry, y sin
# SENTRY_ORG/SENTRY_PROJECT/token no se generan ni suben source maps.
ARG VITE_SENTRY_DSN=
ARG VITE_SENTRY_ENVIRONMENT=production
ARG VITE_SENTRY_RELEASE=
ARG SENTRY_ORG=
ARG SENTRY_PROJECT=
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN} \
    VITE_SENTRY_ENVIRONMENT=${VITE_SENTRY_ENVIRONMENT} \
    VITE_SENTRY_RELEASE=${VITE_SENTRY_RELEASE} \
    SENTRY_ORG=${SENTRY_ORG} \
    SENTRY_PROJECT=${SENTRY_PROJECT}

# El token llega como secret de BuildKit (--secret id=sentry_auth_token): no queda en
# ninguna capa ni en el historial de la imagen. Los .map se suben a Sentry y se borran
# de dist antes de copiarlo a Nginx; el último find falla el build si quedara alguno.
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" npm run build \
 && find dist -name '*.map' -delete \
 && [ -z "$(find dist -name '*.map')" ]

# --- Etapa 2: servir los archivos compilados con Nginx ---
FROM nginx:1.29-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/proxy-headers.inc /etc/nginx/conf.d/proxy-headers.inc
COPY --from=build /app/dist /usr/share/nginx/html

# Puntos de montaje del HTTPS de producción; vacíos en la imagen (ver docker/nginx.conf).
RUN mkdir -p /etc/nginx/tls /etc/nginx/certs

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/healthz || exit 1
