FROM ubuntu
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y docker.io ansible python3-pip && rm -rf /var/lib/apt/lists/*
RUN pip install docker --break-system-packages
RUN ansible-galaxy collection install community.docker
COPY --from=denoland/deno:bin-2.5.6 /deno /usr/local/bin/deno
WORKDIR /app
COPY src/mysite mysite

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-sys", "--allow-run", "mysite/main.ts"]