import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {currentTocId, visibleToc} from '../src/thesis-toc-model.ts';

const toc = JSON.parse(readFileSync(new URL('../src/thesis-toc-data.json', import.meta.url), 'utf8'));

test('contents identify the exact attached 44-page thesis with 36 unique anchors', () => {
  assert.equal(toc.pdfSha256, '92b73e8ad50829cd5df52b7b4e40addd8994499be051b663c0286a804938cd2d');
  assert.equal(toc.pageCount, 44);
  assert.equal(toc.entries.length, 36);
  assert.equal(new Set(toc.entries.map(entry => entry.id)).size, 36);
  for (const entry of toc.entries) {
    assert.ok(Number.isInteger(entry.page) && entry.page >= 1 && entry.page <= toc.pageCount);
    assert.ok(Number.isInteger(entry.level) && entry.level >= 1 && entry.level <= 4);
  }
  for (let index = 1; index < toc.entries.length; index++) {
    assert.ok(toc.entries[index].page >= toc.entries[index - 1].page);
    assert.ok(toc.entries[index].level <= toc.entries[index - 1].level + 1);
  }
});

test('navigation follows actual body pages, including the stale printed contents entry', () => {
  const heading = title => toc.entries.find(entry => entry.title === title);
  assert.equal(heading('Ⅰ. 서론').page, 4);
  assert.equal(heading('2. 연구문제').page, 8);
  assert.equal(heading('3. 용어의 정의').page, 9);
  assert.equal(heading('1. 노인학습자의 개념과 특성').page, 10);
  assert.equal(heading('1. 노인학습자의 개념과 특성').printedPage, '7');
  assert.equal(heading('나. Jarvis의 경험학습').page, 22);
  assert.equal(heading('4. 가능한 자기의 개념과 구성요소').page, 24);
  assert.equal(heading('Ⅲ. 연구방법').page, 32);
  assert.equal(heading('가. 연구참여자').page, 34);
  assert.equal(heading('나. 자료수집 방법').page, 35);
  assert.equal(heading('참고문헌').page, 37);
  assert.equal(heading('참고문헌').printedPage, '34');
});

test('search keeps ancestors, including when matching a deep numbered heading', () => {
  const found = visibleToc(toc.entries, '기대하는  자기', false);
  assert.deepEqual(found.map(entry => entry.level), [1, 2, 3, 4]);
  assert.deepEqual(found.map(entry => entry.title), [
    'Ⅱ. 이론적 배경',
    '4. 가능한 자기의 개념과 구성요소',
    '나. 가능한 자기의 구성요소',
    '2) 기대하는 자기',
  ]);
  assert.equal(found.at(-1).page, 26);
  assert.equal(found[0].page, 10);
  assert.deepEqual(visibleToc(toc.entries, '존재하지않는목차', true), []);
});

test('chapter/section mode does not hide a detailed search result', () => {
  assert.ok(visibleToc(toc.entries, '', false).every(entry => entry.level <= 2));
  assert.equal(visibleToc(toc.entries, '', true).length, 36);
  assert.ok(visibleToc(toc.entries, '신체적 특성', false).some(entry => entry.level === 4 && entry.page === 13));
});

test('same-page headings preserve a clicked title; scrolling selects the corresponding chapter', () => {
  const chapter = toc.entries.find(entry => entry.title === 'Ⅲ. 연구방법');
  assert.equal(currentTocId(toc.entries, 32, chapter.id), chapter.id);
  assert.equal(toc.entries.find(entry => entry.id === currentTocId(toc.entries, 34, chapter.id)).title, '가. 연구참여자');
  assert.equal(toc.entries.find(entry => entry.id === currentTocId(toc.entries, 44)).title, '참고문헌');
  assert.equal(currentTocId(toc.entries, 0), undefined);
});
