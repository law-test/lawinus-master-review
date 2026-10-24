import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import ReviewWorkspace from './review-workspace';
import {loadReviewConfig} from './review-api';
import EducationWordmark from './education-wordmark';
import './globals.css';
import {applyTextSize,readTextSize} from './text-size';
applyTextSize(readTextSize(),false);

function App() {
  const [state, setState] = useState<'loading'|'ready'|'setup'>('loading');
  useEffect(() => {
    let active = true;
    loadReviewConfig().then(() => { if (active) setState('ready'); }).catch(() => {
      if (!active) return;
      setState('setup');
    });
    return () => { active = false; };
  }, []);
  if (state === 'ready') return <ReviewWorkspace/>;
  return <main className="review-app"><section className="loading-screen" role="status" aria-live="polite">
    <EducationWordmark/>
    <h1>신현하 · 석사논문 검토실</h1>
    <h2>{state === 'setup' ? '발표 자료를 불러오지 못했습니다.' : '논문과 발표자료를 불러오는 중…'}</h2>
    {state === 'setup' ? <>
      <button className="primary" onClick={() => window.location.reload()}>다시 불러오기</button>
    </> : null}
  </section></main>;
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('화면을 표시할 영역이 없습니다.');
createRoot(rootElement).render(<App/>);
