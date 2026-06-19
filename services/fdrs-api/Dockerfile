FROM node:18-alpine
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
# In monorepo, we copy all files and build, but for simple Dockerfile we can just use node:18
CMD ["npm", "start"]
