export async function initOTel() {
  const enabled = (process.env.ENABLE_OTEL === 'true' || process.env.ENABLE_OTEL === '1');
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '';
  if (!enabled || !endpoint) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

  const traceExporter = new OTLPTraceExporter({ url: endpoint });

  const sdk = new NodeSDK({
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  await sdk.start();
  // eslint-disable-next-line no-console
  console.log('[OTel] NodeSDK started');
  return sdk;
}
