import ts from 'typescript';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const groups={identity:['app_user','auth_identity','auth_session','auth_transaction'],privacy:['learner','guardian','student_profile','consent_record','deletion_request','erasure_receipt','audit_event'],platform:['idempotency_record','job'],
  catalog:['curriculum_release','subject','topic','topic_relation','concept','concept_prerequisite','question','question_revision','question_concept','micro_lesson','micro_lesson_revision','lesson_concept','micro_assessment','catalog_alias'],
  learning:['learning_session','session_item','lesson_assignment','question_attempt','assistance_event'],assessment:['diagnosis_run','concept_evidence']};
const owner=new Map(Object.entries(groups).flatMap(([group,tables])=>tables.map(t=>[t,group])));
const failures=[];
for(const group of Object.keys(groups))for(const name of readdirSync('src/'+group).filter(n=>n.endsWith('.ts'))) {
  const file=join('src',group,name),source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  const check=table=>{table=table.replaceAll('"','').split(/\s|\./)[0];if(owner.has(table)&&owner.get(table)!==group)failures.push(`${file}: ${group} accesses ${table}, owned by ${owner.get(table)}`);};
  function visit(node){
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&['selectFrom','insertInto','updateTable','deleteFrom','innerJoin','leftJoin'].includes(node.expression.name.text)){
      const first=node.arguments[0];if(first&&ts.isStringLiteral(first))check(first.text);
    }
    if(ts.isTaggedTemplateExpression(node)&&node.tag.getText(source)==='sql'){
      const text=node.template.getText(source).replace(/\$\{[^}]*\}/g,' ');
      for(const match of text.matchAll(/\b(?:from|join|update|insert\s+into|delete\s+from)\s+([a-z_]+)/gi))check(match[1]);
    }
    ts.forEachChild(node,visit);
  }visit(source);
}
// INV-05: rubrics (answer keys) are read only by the publisher and, from Slice 2, the assessment module.
const rubricReaders=['src/catalog/publisher.ts','src/catalog/grading-source.ts'],rubricModules=['src/assessment/'];
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):e.name.endsWith('.ts')?[join(dir,e.name)]:[]);
for(const file of walk('src').map(f=>f.replaceAll('\\','/'))) {
  if(file==='src/database.generated.ts'||rubricReaders.includes(file)||rubricModules.some(m=>file.startsWith(m)))continue;
  const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  const flag=why=>failures.push(`${file}: ${why} (rubric is readable only in ${[...rubricReaders,...rubricModules].join(', ')})`);
  function visit(node){
    if(ts.isTaggedTemplateExpression(node)&&node.tag.getText(source)==='sql'&&/\brubric\b/i.test(node.template.getText(source)))flag('SQL mentions rubric');
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
      const name=node.expression.name.text;
      if(['select','selectAll','returning','returningAll'].includes(name)&&node.arguments.some(a=>/\brubric\b/.test(a.getText(source))))flag(name+' names rubric');
      if(['selectAll','returningAll'].includes(name)&&/selectFrom\(\s*['"]question_revision/.test(node.expression.expression.getText(source)))flag(name+' on question_revision');
    }
    ts.forEachChild(node,visit);
  }visit(source);
}
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('Module table ownership and rubric boundaries passed');
