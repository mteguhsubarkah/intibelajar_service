import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{randomUUID}from'node:crypto';import{sql}from'kysely';import{connect}from'../../src/db.js';import{migrate,verifyMigrations}from'../../src/migrate.js';import assert from'node:assert/strict';
const env=JSON.parse(readFileSync('.local/test-env.json','utf8')),base=new URL(env.DATABASE_URL);assert.match(base.pathname,/_test$/);assert.ok(['127.0.0.1','localhost'].includes(base.hostname));
const name='ib_connect_'+randomUUID().replaceAll('-','').slice(0,12)+'_test',adminUrl=new URL(base);adminUrl.pathname='/postgres';const admin=connect(adminUrl.href);let created=false;let db:ReturnType<typeof connect>|undefined;
try{
 await sql`create database ${sql.id(name)}`.execute(admin);created=true;const url=new URL(base);url.pathname='/'+name;db=connect(url.href);
 const version=Number((await sql<any>`select current_setting('server_version_num')::int v`.execute(db)).rows[0].v);assert.ok(version>=160000);
 await migrate(db);assert.equal(await verifyMigrations(db),true);
 for(let i=0;i<3;i++)await migrate(db,'down');
 assert.equal(Number((await sql<any>`select count(*) n from schema_migration`.execute(db)).rows[0].n),5);
 await migrate(db);assert.equal(await verifyMigrations(db),true);
 await assert.rejects(db.transaction().execute(async tx=>{await sql`create table isolated_failure_probe(id int)`.execute(tx);await sql`select * from nonexistent_failure_probe`.execute(tx);}));
 assert.equal((await sql`select 1 from information_schema.tables where table_name='isolated_failure_probe'`.execute(db)).rows.length,0);await migrate(db);assert.equal(await verifyMigrations(db),true);
 const result={ok:true,postgresql:version,phases:['all migrations up','0008/0007/0006 rollback','reapply all','transaction failure leaves no partial table','recovery verify'],isolatedDatabase:name};
 const out='docs/backend-implementation/evidence/connections-2026-10-20';mkdirSync(out,{recursive:true});writeFileSync(out+'/migration-recovery.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{if(db)await db.destroy();if(created){assert.match(name,/^ib_connect_[a-f0-9]{12}_test$/);await sql`drop database ${sql.id(name)}`.execute(admin);}await admin.destroy();}
