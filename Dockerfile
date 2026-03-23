# Dockerfile - Empacota tudo para o Cloud Run

# Usar imagem oficial do Node.js
FROM node:18-slim

# Criar diretório de trabalho
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências
RUN npm install --production

# Copiar todo o código
COPY . .

# Criar pasta public se não existir
RUN mkdir -p public

# Expor porta (Cloud Run usa variável PORT)
EXPOSE 8080

# Variável de ambiente padrão
ENV NODE_ENV=production
ENV PORT=8080

# Comando para iniciar o servidor
CMD ["npm", "start"]
