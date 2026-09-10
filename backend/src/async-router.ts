import { Router, type RequestHandler, type IRouter } from "express";

// Express 4 no captura el rechazo de un handler declarado `async`: la promesa queda sin manejar
// y Node 22 termina el proceso. En la práctica eso significa que un solo error inesperado —una
// restricción de la base, una API caída— deja sin backend a TODOS los clientes a la vez.
//
// Se descubrió editando un gasto hacia un número de comprobante ya existente: el índice único
// saltaba, nadie lo atrapaba, y el servidor entero se caía.
//
// Express 5 lo resuelve de fábrica; mientras tanto esto envuelve cada handler para que el error
// llegue a next() y lo atienda el middleware de errores de index.ts.
const METODOS = ["get", "post", "patch", "put", "delete", "all"] as const;

export function asyncRouter(): IRouter {
  const router = Router();

  for (const metodo of METODOS) {
    const original = router[metodo].bind(router) as (...args: unknown[]) => unknown;
    (router as unknown as Record<string, unknown>)[metodo] = (path: unknown, ...handlers: RequestHandler[]) =>
      original(path, ...handlers.map(envolver));
  }

  return router;
}

function envolver(handler: RequestHandler): RequestHandler {
  // Los handlers síncronos pasan igual: Promise.resolve de un valor normal no cambia nada.
  return (req, res, next) => {
    try {
      Promise.resolve(handler(req, res, next)).catch(next);
    } catch (err) {
      next(err);
    }
  };
}
