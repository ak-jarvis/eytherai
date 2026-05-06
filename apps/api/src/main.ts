import "reflect-metadata";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

const apiBasePath = "/api/v1";

type HealthResponse = {
  ok: true;
  service: "api";
  phase: "gov-01-scaffold";
};

@Controller(apiBasePath)
class HealthController {
  @Get("health")
  health(): HealthResponse {
    return { ok: true, service: "api", phase: "gov-01-scaffold" };
  }
}

@Module({ controllers: [HealthController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
