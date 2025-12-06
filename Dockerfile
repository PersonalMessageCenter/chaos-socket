FROM node:18-alpine

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install --only=production

# Copiar código da aplicação
COPY . .

# Expor portas
EXPOSE 4001 9101

# Comando para iniciar
CMD ["node", "index.js"]
