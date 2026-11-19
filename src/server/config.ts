import { z } from 'zod';

const configSchema = z
  .object({
    APP_ENV: z.enum(['local', 'uat', 'production', 'test']).default('local'),
    APP_VERSION: z.string().trim().min(1).max(80).default('1.0.0'),
    DEMO_CONTROLS: z.enum(['true', 'false']).optional(),
    NEXT_PUBLIC_DEMO_CONTROLS: z.enum(['true', 'false']).default('false'),
  })
  .refine(
    (config) =>
      config.DEMO_CONTROLS === undefined ||
      config.DEMO_CONTROLS === config.NEXT_PUBLIC_DEMO_CONTROLS,
  );

/** Server-owned configuration; never import this module into client components. */
export function getServerConfig() {
  const parsed = configSchema.safeParse({
    APP_ENV: process.env.APP_ENV,
    APP_VERSION: process.env.APP_VERSION,
    DEMO_CONTROLS: process.env.DEMO_CONTROLS,
    NEXT_PUBLIC_DEMO_CONTROLS: process.env.NEXT_PUBLIC_DEMO_CONTROLS,
  });
  if (!parsed.success) throw new Error('Invalid server configuration');
  return {
    environment: parsed.data.APP_ENV,
    appVersion: parsed.data.APP_VERSION,
    demoControls: (parsed.data.DEMO_CONTROLS ?? parsed.data.NEXT_PUBLIC_DEMO_CONTROLS) === 'true',
  };
}
