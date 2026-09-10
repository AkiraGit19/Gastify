-- CreateEnum
CREATE TYPE "TipoComprobante" AS ENUM ('factura', 'boleta', 'recibo_honorarios', 'otro');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoGasto" ADD VALUE 'pagado';
ALTER TYPE "EstadoGasto" ADD VALUE 'anulado';

-- AlterTable
ALTER TABLE "Gasto" ADD COLUMN     "fechaPago" TIMESTAMP(3),
ADD COLUMN     "igv" DECIMAL(10,2),
ADD COLUMN     "imagenHash" TEXT,
ADD COLUMN     "motivoAnulacion" TEXT,
ADD COLUMN     "tipoComprobante" "TipoComprobante" NOT NULL DEFAULT 'otro';

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "bloqueadoHasta" TIMESTAMP(3),
ADD COLUMN     "intentosFallidos" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EdicionGasto" (
    "id" TEXT NOT NULL,
    "gastoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EdicionGasto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EdicionGasto_gastoId_idx" ON "EdicionGasto"("gastoId");

-- CreateIndex
CREATE INDEX "Gasto_empresaId_imagenHash_idx" ON "Gasto"("empresaId", "imagenHash");

-- AddForeignKey
ALTER TABLE "EdicionGasto" ADD CONSTRAINT "EdicionGasto_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "Gasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdicionGasto" ADD CONSTRAINT "EdicionGasto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
