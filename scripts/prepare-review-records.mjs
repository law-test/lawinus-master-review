import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const root=process.argv[2];if(!root)throw new Error('Provide the approved P486 root directory');
const read=name=>JSON.parse(readFileSync(join(root,name),'utf8'));
const citations=JSON.parse(readFileSync(new URL('../src/citation-data.json',import.meta.url),'utf8'));
const changes=read('revision-changes.json'),assessments=read('partial-review-all49.json'),ledger=read('reference-ledger-77.json');
const normalize=text=>text.replace(/\s+/g,'').normalize('NFC');
const revisions=changes.filter(change=>change.blockId!=='B109').map(change=>{
 const matches=citations.citations.filter(citation=>normalize(change.before).includes(normalize(citation.sentenceText||citation.text)));
 const related=assessments.filter(item=>item.blockId===change.blockId);
 return {id:change.blockId,page:change.pdfPage,printedPage:String(change.printedPage),before:change.before,proposedText:change.after,issues:change.reasons,sentenceIds:[...new Set([...matches.map(c=>c.sentenceId).filter(Boolean),...related.map(a=>a.sentenceId)])],referenceIds:[...new Set([...matches.flatMap(c=>c.referenceIds),...related.map(a=>a.referenceId)])],assessments:related.map(item=>({sentenceId:item.sentenceId,referenceId:item.referenceId,issue:item.missing,evidence:item.evidence,resolution:item.resolution})),status:'proposed'};
});
const result={meta:{thesisSha256:citations.meta.pdfSha256,reviewedAt:'2026-10-23',label:'기존 수정 검토본'},revisions,assessments:assessments.map(item=>({sentenceId:item.sentenceId,referenceId:item.referenceId,issue:item.missing,evidence:item.evidence,resolution:item.resolution})),readingBaseline:ledger.map(item=>({referenceId:item.referenceId,scope:item.scope,finding:item.finding,complete:item.complete,sourceSha256:item.sha256}))};
writeFileSync(new URL('../src/review-records.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({revisions:revisions.length,assessments:assessments.length,readingBaseline:ledger.length,unmatched:revisions.filter(r=>!r.sentenceIds.length).map(r=>r.id)}));
