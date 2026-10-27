import {sql} from 'kysely';
import type {Connection} from '../db.js';
import {currentRelease,lessonFor} from './interface.js';
import {fail} from '../platform/errors.js';
export interface OwnCore {id:string;code:string;title:string;description:string|null;mapId:string;topicId:string|null;subject:string|null}
export async function ownCatalog(db:Connection){
 const release=await currentRelease(db);if(!release)return fail(409,'CONTENT_UNAVAILABLE');
 const rows=(await sql<OwnCore>`select c.id,c.code,c.title,c.subtitle as description,a.alias as "mapId",ta.alias as "topicId",sa.alias as subject
 from catalog_alias a join concept c on c.id=a.concept_id join topic t on t.id=c.topic_id
 left join catalog_alias ta on ta.release_id=a.release_id and ta.namespace='TOPIC' and ta.topic_id=t.id
 left join catalog_alias sa on sa.release_id=a.release_id and sa.namespace='SUBJECT' and sa.subject_id=t.subject_id
 where a.release_id=${release.id} and a.namespace='MAP' and not c.is_hidden order by c.ordinal,c.code limit 500`.execute(db)).rows;
 return {release,cores:rows};
}
export async function ownLesson(db:Connection,release:Awaited<ReturnType<typeof currentRelease>> & {},id:string){return (await lessonFor(db,release,{conceptId:id}))?.routeSlug ?? '';}
