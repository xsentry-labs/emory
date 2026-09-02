import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 does not catch a rejected promise from an async route handler —
 * left unwrapped, that either hangs the request forever or, since Node 15+
 * terminates the process by default on an unhandled rejection, can take the
 * whole server down. Wrap every async handler with this so a thrown/rejected
 * error always reaches the error-handling middleware in index.ts instead.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
