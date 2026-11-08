module.exports = async function (window, page) {
  await window.webContents.executeJavaScript(`(async()=>{
    const call=async(n,p)=>{const r=await window.practicum[n](p);if(!r.ok)throw Error(r.error);return r.data;};
    const state=await call('state'),p={profileId:state.active};
    p.courseId=(await call('createCourse',{...p,name:'Обезличивание',group:'A',year:2026,semester:'Осень',mode:'Дневное'})).courses[0].id;
    const student=(await call('addStudent',{...p,name:'Max Tamm',number:'99'})).courses[0].students[0];
    p.assignmentId=(await call('saveAssignment',{...p,name:'Проверка текста',criteria:[{name:'Логика',points:5}]})).courses[0].assignments[0].id;
    await call('importNotebook',{...p,studentId:student.id,name:'Task.ipynb',base64:btoa(JSON.stringify({nbformat:4,cells:[{cell_type:'code',source:'# Alice Smith\\nmax_len = max(a)'}]}))});
  })()`);
  await window.loadURL(page);
  return window.webContents.executeJavaScript(`(async()=>{
    const until=async(fn)=>{for(let i=0;i<100;i++){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,50));}throw Error('Redaction UI timeout');};
    const button=async(text)=>{const el=await until(()=>Array.from(document.querySelectorAll('button')).find(b=>(b.textContent.trim()===text||b.getAttribute('aria-label')===text)));el.click();};
    const course=await until(()=>Array.from(document.querySelectorAll('.course-nav-item')).find(b=>b.textContent.includes('Обезличивание')));course.click();await button('Открыть задание');await button('Копия');
    await until(()=>document.querySelector('.manual-redaction')?.textContent.includes('Alice Smith'));
    await button('К ячейке 1');
    const editor=document.querySelector('.payload-editor');
    if(!editor.value.slice(editor.selectionStart,editor.selectionEnd).includes('"number": 1'))throw Error('Cell navigation failed');
    if(!editor.value.includes('max_len = max(a)'))throw Error('Code changed');
    await button('Подготовить заново');await until(()=>document.querySelector('dialog').textContent.includes('Редакция копии: 2'));
    if(document.querySelector('.checkline input').checked)throw Error('Regenerated copy unexpectedly reviewed');
    await button('Сохранить копию');await until(()=>!document.querySelector('dialog[open]'));
    return {manualReview:true,cellNavigation:true,regeneration:true,codePreserved:true};
  })()`);
};
