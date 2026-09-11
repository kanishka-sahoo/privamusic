# Build the GUI runtime first with scripts/prepare.sh.
FROM privamusic-spotiflac-gui:local
RUN apt-get -o Acquire::ForceIPv4=true -o Acquire::https::Timeout=20 -o Acquire::Retries=3 update && DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::ForceIPv4=true -o Acquire::https::Timeout=20 -o Acquire::Retries=3 install -y --no-install-recommends x11vnc && rm -rf /var/lib/apt/lists/*
COPY build/node /usr/local/bin/node
COPY build/bridge-inject.so /opt/privamusic/bridge-inject.so
COPY build/app /app
WORKDIR /opt/privamusic
COPY package.json package-lock.json ./
COPY node_modules/ws ./node_modules/ws
COPY node_modules/@novnc/novnc ./node_modules/@novnc/novnc
COPY src ./src
COPY web ./web
COPY scripts/start.sh /usr/local/bin/privamusic-start
ENV PORT=8080 NEXT_BRIDGE_SCRIPT=/run/next-bridge.js
EXPOSE 8080
ENTRYPOINT ["sh", "/usr/local/bin/privamusic-start"]
