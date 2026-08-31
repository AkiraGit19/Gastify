DROP INDEX "Gasto_rucEmisor_numeroComprobante_key";

CREATE UNIQUE INDEX "Gasto_empresaId_rucEmisor_numeroComprobante_key" ON "Gasto"("empresaId", "rucEmisor", "numeroComprobante");
