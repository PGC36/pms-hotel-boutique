# --- Etapa 1: compilar el frontend con Vite ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# En producción la API se sirve en el mismo dominio, bajo /api (Nginx la redirige al backend).
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# --- Etapa 2: servir los archivos compilados con Nginx ---
FROM nginx:1.29-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/proxy-headers.inc /etc/nginx/conf.d/proxy-headers.inc
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/healthz || exit 1
