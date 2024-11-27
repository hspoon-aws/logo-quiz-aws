FROM node:8-alpine
ENV PORT=4200

# Change directory so that our commands run inside this new directory
WORKDIR /usr/src/app

# Copy npm package files
COPY package*.json ./

RUN apk add --no-cache python3 py3-pip

RUN echo "https://dl-cdn.alpinelinux.org/alpine/v3.15/community"  >> /etc/apk/repositories
RUN apk add python2 make g++ && rm -rf /var/cache/apk/*

# Install npm dependencies
RUN npm install

# Copy app files to container
COPY . .

# Build app
# RUN npm run build:api
RUN npx browserslist@latest --update-db
RUN npm run build:frontend

# CMD ["npm", "run", "start:api:prod"]
CMD ["npm", "run", "start:frontend"]
# CMD npm run start:api:prod & npm run start:frontend