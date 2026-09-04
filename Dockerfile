FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32
WORKDIR /app
COPY package*.json ./
# ðŸš€ Bypass the React 19 version conflict
RUN npm ci --legacy-peer-deps
COPY . .
RUN apk add --no-cache dos2unix \
    && dos2unix /app/docker-entrypoint.sh \
    && chmod +x /app/docker-entrypoint.sh \
    && cp /app/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
