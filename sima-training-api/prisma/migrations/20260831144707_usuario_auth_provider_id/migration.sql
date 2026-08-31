-- authProviderId: id de la identidad en Auth0 (`sub`). Nullable hasta el
-- primer login por Auth0 (se completa vía linkeo por email en
-- JwtAuthGuard, nunca a mano). Postgres permite múltiples NULL bajo un
-- UNIQUE, así que no hace falta un índice parcial como en otras tablas del
-- proyecto.
ALTER TABLE "usuarios" ADD COLUMN "auth_provider_id" TEXT;

CREATE UNIQUE INDEX "usuarios_auth_provider_id_key" ON "usuarios"("auth_provider_id");
