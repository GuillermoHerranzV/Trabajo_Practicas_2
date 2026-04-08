FROM ubuntu
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y docker.io && rm -rf /var/lib/apt/lists/*
COPY --from=denoland/deno:bin-2.5.6 /deno /usr/local/bin/deno
WORKDIR /app
COPY src/mysite mysite

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-sys", "--allow-run", "mysite/main.ts"]