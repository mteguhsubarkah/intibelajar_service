import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
mkdirSync('.local',{recursive:true});
const password=readFileSync('.local/pg-password','utf8').trim();
const base=`postgresql://slice0:${password}@127.0.0.1:55432/`;
const client=new pg.Client({connectionString:base+'postgres'});await client.connect();
try {if(!(await client.query("select 1 from pg_database where datname='intibelajar_slice0_test'")).rowCount)await client.query('create database intibelajar_slice0_test');}
finally {await client.end();}
const env={NODE_ENV:'test',DATABASE_URL:base+'intibelajar_slice0_test',APP_ORIGIN:'http://localhost:5173',APP_KEY:randomBytes(32).toString('hex'),SYNTHETIC_FIXTURES:'true'};
writeFileSync('.local/test-env.json',JSON.stringify(env,null,2));
console.log('Isolated PostgreSQL test database prepared; credentials kept under ignored .local');
