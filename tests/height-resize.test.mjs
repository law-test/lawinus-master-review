import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const code=ts.transpileModule(readFileSync(new URL('../src/height-resize-model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {clampHeight,draggedHeight,keyboardHeight,readStoredHeight,saveStoredHeight}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('vertical dragging uses Y displacement and respects available heights',()=>{
 assert.equal(draggedHeight(100,250,290,1,44,200),140);
 assert.equal(draggedHeight(100,250,-90,1,44,200),44);
 assert.equal(draggedHeight(100,250,900,1,44,200),200);
 assert.equal(draggedHeight(60,250,300,.2,20,80),70);
 assert.equal(clampHeight(250,44,120),120);
 assert.equal(clampHeight(NaN,44,120),44);
 assert.equal(clampHeight(80,44,20),44);
});
test('height separators support vertical keyboard movement, boundaries and ignore unrelated keys',()=>{
 assert.equal(keyboardHeight('ArrowUp',60,44,200,8),52);
 assert.equal(keyboardHeight('ArrowDown',60,44,200,8),68);
 assert.equal(keyboardHeight('Home',60,44,200),44);
 assert.equal(keyboardHeight('End',60,44,200),200);
 assert.equal(keyboardHeight('ArrowLeft',60,44,200),null);
 assert.equal(keyboardHeight('ArrowUp',44,44,200),44);
});
test('restored heights clamp on smaller screens and unavailable storage does not prevent reading',()=>{
 let value;const storage={getItem:()=>value,setItem:(_,next)=>{value=next;}};
 assert.equal(readStoredHeight(storage,'height',104,44,280),104);
 saveStoredHeight(storage,'height',240,44,280);assert.equal(value,'240');
 assert.equal(readStoredHeight(storage,'height',104,44,120),120);
 value='not a number';assert.equal(readStoredHeight(storage,'height',104,44,120),104);
 value='';assert.equal(readStoredHeight(storage,'height',104,44,120),104);
 const blocked={getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');}};
 assert.equal(readStoredHeight(blocked,'height',104,44,120),104);
 assert.doesNotThrow(()=>saveStoredHeight(blocked,'height',240,44,120));
});
