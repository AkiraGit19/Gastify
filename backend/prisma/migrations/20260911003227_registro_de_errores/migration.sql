-- CreateTable
CREATE TABLE "ErrorRegistrado" (
    "id" TEXT NOT NULL,
    "huella" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "metodo" TEXT NOT NULL,
    "stack" TEXT,
    "conteo" INTEGER NOT NULL DEFAULT 1,
    "primeraVez" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaVez" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorRegistrado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErrorRegistrado_huella_key" ON "ErrorRegistrado"("huella");

-- CreateIndex
CREATE INDEX "ErrorRegistrado_ultimaVez_idx" ON "ErrorRegistrado"("ultimaVez");
