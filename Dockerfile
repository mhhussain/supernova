FROM arm32v7/node

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN npm install
# RUN npm ci --only--production

COPY . .

# EXPOSE 1001

ENTRYPOINT ["node", "index.js"]
