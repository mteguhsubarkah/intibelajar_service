import { BasicTracerProvider, type SpanProcessor } from '@opentelemetry/sdk-trace-base';
export function telemetry(processors:SpanProcessor[]=[]) {
  // No exporter or remote endpoint is configured. Attribute writers use an allow-list.
  const provider=new BasicTracerProvider({spanProcessors:processors});
  return {tracer:provider.getTracer('intibelajar-slice0','0.1.0'),close:()=>provider.shutdown()};
}
