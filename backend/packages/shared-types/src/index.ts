import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi';
import type { Schema } from 'hono';
import type { PinoLogger } from 'hono-pino';

export interface BaseAppBindings {
  Variables: {
    logger: PinoLogger;
    user?: any;
    session?: any;
  };
}

export type AppOpenAPI<T extends BaseAppBindings = BaseAppBindings, S extends Schema = {}> = OpenAPIHono<T, S>;
export type AppRouteHandler<R extends RouteConfig, T extends BaseAppBindings = BaseAppBindings> = RouteHandler<R, T>;
