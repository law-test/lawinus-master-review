import assert from 'node:assert/strict';
import {test} from 'node:test';
import {formatRevisionComparison,parseRevisionComparison} from '../src/master-revision-composite.ts';
import {bodyReadingKey,parseBodyReadingPosition,bodyAnchorTop} from '../src/master-body-reading-position.ts';
test('comparison roundtrip preserves the exact manuscript, while saving only the After part',()=>{
 const parts={before:'본문 원문\n\n  인용 (한정란, 2025)',after:'수정문\n\n둘째 문단',reason:'원전 근거\n확인'};
 assert.deepEqual(parseRevisionComparison(formatRevisionComparison(parts)),{ok:true,parts});
 assert.equal(parseRevisionComparison(formatRevisionComparison({...parts,after:''})).parts.after,'');
 for(const invalid of ['Before\n바뀐 표지',formatRevisionComparison(parts)+'\n【After】',formatRevisionComparison(parts).replace('---','')])assert.equal(parseRevisionComparison(invalid).ok,false);
});
test('reading position is master-only and rejects malformed saved browser state',()=>{
 assert.equal(bodyReadingKey('dataset:thesis'),'master-body-position-v1:dataset:thesis');
 assert.equal(parseBodyReadingPosition('{bad'),null);assert.equal(parseBodyReadingPosition(JSON.stringify({page:0,reportedPage:4,fraction:.5,leftRatio:0,zoom:1})),null);
 const position={page:4,reportedPage:4,fraction:.5,leftRatio:0,zoom:1};assert.deepEqual(parseBodyReadingPosition(JSON.stringify(position)),position);assert.equal(bodyAnchorTop(100,400,.5),300);
});
