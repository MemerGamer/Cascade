import type { LoggerOptions } from 'pino';
import { getContext } from 'hono/context-storage';
import { routePath } from 'hono/route';
import pino from 'pino';
import { pinoLogger as honoPinoLogger } from 'hono-pino';

export class GlobalLogger {
  private static _logger: pino.Logger;

  private static get options(): LoggerOptions {
    return {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname'
              }
            },
      hooks: {
        logMethod(inputArgs: any, method: any, _level: any) {
          try {
            const context = getContext();
            const vars = context?.var as any;
            if (context && vars && vars.requestId) {
              if (typeof inputArgs[0] === 'object') {
                inputArgs[0].requestId = vars.requestId;
                const matchedRoutePath = routePath(context);
                if (matchedRoutePath) {
                  inputArgs[0].route_path = matchedRoutePath;
                }
                inputArgs[0].reqId = undefined;
              } else {
                inputArgs.unshift({ requestId: vars.requestId });
              }
            }
          } catch {}
          return method.apply(this, inputArgs);
        }
      }
    };
  }

  public static get logger() {
    if (!this._logger) {
      this._logger = pino(this.options);
    }
    return this._logger;
  }
}

export function pinoLogger() {
  return honoPinoLogger({
    pino: GlobalLogger.logger,
    http: {
      reqId: () => crypto.randomUUID(),
      onResMessage: ctx => `Request completed ${ctx.req.method} ${ctx.req.path}`,
      onReqBindings: ctx => ({
        req: {
          url: ctx.req.path,
          method: ctx.req.method,
          headers: Object.fromEntries(
            Object.entries(ctx.req.header()).filter(([key]) => key.toLowerCase() !== 'cookie' && key.toLowerCase() !== 'authorization')
          )
        }
      })
    }
  });
}
