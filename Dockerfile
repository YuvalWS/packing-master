# Temporary single-stage image used for scaffolding and installs.
# Replaced by a real multi-stage Dockerfile in step 0.3.
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache git
EXPOSE 5173
CMD ["sh"]
