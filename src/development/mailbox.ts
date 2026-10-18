import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import type {Config} from '../config.js';
import type {Mailbox} from '../identity/service.js';
import {encrypt,decrypt} from '../platform/crypto.js';
const path=new URL('../../.local/synthetic-mailbox.enc',import.meta.url);
export function saveMailbox(config:Config,mailbox:Mailbox) {
  if(config.mode!=='development'||!config.synthetic)return;
  mkdirSync(new URL('../../.local/',import.meta.url),{recursive:true});
  writeFileSync(path,encrypt(config.key,JSON.stringify([...mailbox])),{mode:0o600});
}
export function readMailbox(config:Config) {
  if(config.mode!=='development'||!config.synthetic)throw new Error('Synthetic development mailbox is disabled');
  return new Map(JSON.parse(decrypt(config.key,readFileSync(fileURLToPath(path))))) as Mailbox;
}
