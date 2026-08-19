-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('super_admin', 'admin', 'aprobador', 'empleado');

-- CreateEnum
CREATE TYPE "EstadoGasto" AS ENUM ('pendiente', 'aprobado', 'rechazado', 'pendiente_validacion');

-- CreateEnum
CREATE TYPE "Categoria" AS ENUM ('movilidad', 'alimentacion', 'hospedaje', 'otros');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "fechaAlta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT,
    "nombre" TEXT NOT NULL,
    "telefonoWhatsapp" TEXT,
    "email" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "aprobadorId" TEXT,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fechaGasto" TIMESTAMP(3) NOT NULL,
    "categoria" "Categoria" NOT NULL,
    "rucEmisor" TEXT,
    "razonSocialEmisor" TEXT,
    "numeroComprobante" TEXT,
    "imagenUrl" TEXT NOT NULL,
    "estado" "EstadoGasto" NOT NULL DEFAULT 'pendiente',
    "validadoSunat" BOOLEAN NOT NULL DEFAULT false,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aprobacion" (
    "id" TEXT NOT NULL,
    "gastoId" TEXT NOT NULL,
    "aprobadorId" TEXT NOT NULL,
    "decision" BOOLEAN NOT NULL,
    "fechaDecision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comentario" TEXT,

    CONSTRAINT "Aprobacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicLink" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_ruc_key" ON "Empresa"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_telefonoWhatsapp_key" ON "Usuario"("telefonoWhatsapp");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_empresaId_idx" ON "Usuario"("empresaId");

-- CreateIndex
CREATE INDEX "Gasto_empresaId_idx" ON "Gasto"("empresaId");

-- CreateIndex
CREATE INDEX "Gasto_usuarioId_idx" ON "Gasto"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Gasto_rucEmisor_numeroComprobante_key" ON "Gasto"("rucEmisor", "numeroComprobante");

-- CreateIndex
CREATE UNIQUE INDEX "MagicLink_token_key" ON "MagicLink"("token");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_aprobadorId_fkey" FOREIGN KEY ("aprobadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aprobacion" ADD CONSTRAINT "Aprobacion_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "Gasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aprobacion" ADD CONSTRAINT "Aprobacion_aprobadorId_fkey" FOREIGN KEY ("aprobadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicLink" ADD CONSTRAINT "MagicLink_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
