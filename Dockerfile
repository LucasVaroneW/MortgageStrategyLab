# ============================================================
# Mortgage Strategy Lab - Imagen Docker
# ============================================================
# Construir:   docker build -t mortgage-lab .
# Ejecutar:    docker run -d --name msl -p 8000:8000 mortgage-lab
# O usar:      docker compose up -d
# ============================================================

FROM node:20-alpine

# Puerto por defecto
ENV PORT=8000

# Directorio de trabajo
WORKDIR /app

# Copiar solo lo necesario (mejor cache de capas)
COPY package.json ./
COPY server.cjs ./
COPY index.html ./
COPY tests.html ./
COPY styles ./styles
COPY src ./src
COPY data ./data

# Documentar el puerto
EXPOSE 8000

# Healthcheck simple
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:8000/ || exit 1

# Arrancar el servidor
CMD ["node", "server.cjs"]
