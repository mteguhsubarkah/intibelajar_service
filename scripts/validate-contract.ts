import SwaggerParser from '@apidevtools/swagger-parser';
import { contract } from '../src/platform/contract.js';
await SwaggerParser.validate(structuredClone(contract));
console.log('OpenAPI 3.1: @apidevtools/swagger-parser validation passed');
