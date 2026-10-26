import {readConfig} from '../src/config.js';
import {readMailbox} from '../src/development/mailbox.js';
const config=readConfig(),email=process.argv[2];
if(!email?.endsWith('.invalid'))throw new Error('Provide an exact synthetic .invalid address');
const messages=readMailbox(config).get(email)??[];
// Explicit local developer command; never called by the server logger.
for(const mail of messages)console.log(mail.kind==='signin'?`${config.origin}/auth/email#token=${encodeURIComponent(mail.token)}`:`${config.origin}/guardian-consents/${encodeURIComponent(mail.token)}`);
