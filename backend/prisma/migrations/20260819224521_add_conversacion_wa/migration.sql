-- CreateTable
CREATE TABLE "ConversacionWA" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "paso" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversacionWA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConversacionWA_usuarioId_key" ON "ConversacionWA"("usuarioId");
