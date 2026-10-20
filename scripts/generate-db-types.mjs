import pg from 'pg';
import {readFileSync,writeFileSync} from 'node:fs';
const env=process.env.DATABASE_URL?process.env:JSON.parse(readFileSync('.local/test-env.json','utf8'));
const client=new pg.Client({connectionString:env.DATABASE_URL});await client.connect();
try {
  const {rows}=await client.query("select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position");
  const types={uuid:'string',text:'string',varchar:'string',bpchar:'string',bool:'boolean',int2:'number',int4:'number',int8:'string',timestamptz:'Date',date:'Date',bytea:'Buffer',numeric:'string',jsonb:'unknown',_text:'string[]',_uuid:'string[]'};
  let result="// Generated from a migrated PostgreSQL database by scripts/generate-db-types.mjs.\nimport type { Generated } from 'kysely';\nexport interface Database {\n";
  for(const table of [...new Set(rows.map(r=>r.table_name))]) {
    result+=`  ${table}: {\n`;
    for(const column of rows.filter(r=>r.table_name===table)) {
      let type=types[column.udt_name];if(!type)throw new Error('Unknown PostgreSQL type '+column.udt_name);
      if(column.is_nullable==='YES')type+=' | null';if(column.column_default)type=`Generated<${type}>`;
      result+=`    ${column.column_name}: ${type};\n`;
    }result+='  };\n';
  }result+='}\n';writeFileSync('src/database.generated.ts',result);console.log('Generated Kysely types for',new Set(rows.map(r=>r.table_name)).size,'tables');
}finally{await client.end();}
